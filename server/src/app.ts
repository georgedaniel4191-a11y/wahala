import express from "express";
import cors from "cors";
import { createServer, type IncomingMessage } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import {
  CASE_ID, CASE_TITLE, createRoomSchema, joinRoomSchema, readyRoomSchema, roomCommandSchema,
} from "@wahala/shared";
import type { Ack, ClientToServerEvents, ServerToClientEvents } from "@wahala/shared";
import { CommandError, Lobby, type LobbyRoom } from "./lobby";
import { COOKIE_NAME, Sessions, RateLimiter, type GuestSession } from "./sessions";

type SocketData = { session: GuestSession };
type LobbySocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type Options = {
  clientOrigin?: string; sessionSecret?: string; secureCookies?: boolean;
  now?: () => number; cleanupIntervalMs?: number;
};
type CachedRequest = { fingerprint: string; ack: Ack<unknown>; expiresAtMs: number };
const CACHE_AGE_MS = 24 * 60 * 60_000;

function canonical(value: unknown): string {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
  }
  return JSON.stringify(value);
}

export function createApplication(options: Options = {}) {
  const now = options.now ?? Date.now;
  const clientOrigin = options.clientOrigin ?? "http://localhost:3000";
  function trustedSocketOrigin(request: IncomingMessage) {
    if (request.headers.origin) return request.headers.origin === clientOrigin;
    // Same-origin browser XHR polling omits Origin; its Referer is still
    // browser-controlled. Never allow a mismatched Origin via this fallback.
    try { return new URL(request.headers.referer ?? "").origin === clientOrigin; }
    catch { return false; }
  }
  const sessions = new Sessions(options.sessionSecret ?? randomBytes(32).toString("hex"), now);
  const limiter = new RateLimiter(now);
  const lobby = new Lobby(clientOrigin, now);
  const requests = new Map<string, CachedRequest>();
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: clientOrigin, credentials: true }));
  app.use(express.json({ limit: "4kb" }));
  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    cors: { origin: clientOrigin, credentials: true }, maxHttpBufferSize: 8_192,
    allowRequest: (request, callback) => {
      const originAllowed = trustedSocketOrigin(request);
      const rateAllowed = limiter.allow(`handshake:${request.socket.remoteAddress}`, 120);
      callback(null, originAllowed && rateAllowed && sessions.read(request) !== null);
    },
  });

  app.get("/health", (_request, response) => response.json({ status: "ok" }));
  app.get("/ready", (_request, response) => response.json({ status: "ok" }));
  app.get("/api/cases", (_request, response) => response.json({
    cases: [{ caseId: CASE_ID, title: CASE_TITLE, seats: 5 }],
  }));
  app.post("/api/session/guest", (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.headers.origin !== clientOrigin) {
      response.status(403).json({ error: "Untrusted origin." }); return;
    }
    if (!limiter.allow(`session:${request.socket.remoteAddress}`, 30)) {
      response.status(429).json({ error: "Too many session requests. Please wait a minute." }); return;
    }
    if (!sessions.read(request)) {
      const { cookieValue } = sessions.issue();
      response.cookie(COOKIE_NAME, cookieValue, {
        httpOnly: true, secure: options.secureCookies ?? false,
        sameSite: "lax", maxAge: CACHE_AGE_MS, path: "/",
      });
    }
    // No identity or bearer token is returned to JavaScript.
    response.json({ ok: true });
  });

  io.use((socket, next) => {
    cleanup();
    const session = sessions.read(socket.request);
    if (!session || !trustedSocketOrigin(socket.request)) {
      const error = new Error("Guest session required. Reload to reconnect.");
      Object.assign(error, { data: { code: "UNAUTHENTICATED" } });
      next(error); return;
    }
    socket.data.session = session;
    next();
  });

  function publish(room: LobbyRoom) {
    io.to(room.roomId).emit("room:updated", { roomId: room.roomId, view: lobby.view(room) });
  }
  function snapshot(socket: LobbySocket, room: LobbyRoom) {
    socket.emit("state:snapshot", {
      roomId: room.roomId, public: lobby.view(room),
      self: lobby.self(socket.data.session, room.roomId), recentChat: [], reveal: null,
    });
  }
  function attachAll(session: GuestSession, room: LobbyRoom) {
    for (const socket of io.sockets.sockets.values()) {
      if (socket.data.session.userId !== session.userId) continue;
      lobby.attach(session, socket.id, room.roomId);
      void socket.join(room.roomId);
      snapshot(socket, room);
    }
  }

  function command<T, D>(socket: LobbySocket, event: string, schema: z.ZodType<T>, payload: unknown,
    ack: ((response: Ack<D>) => void) | undefined,
    execute: (value: T) => { room: LobbyRoom; data: D },
  ) {
    if (typeof ack !== "function") return;
    const session = socket.data.session;
    const rawRequestId = payload !== null && typeof payload === "object" && "requestId" in payload ? payload.requestId : undefined;
    const requestId = typeof rawRequestId === "string" ? rawRequestId : randomUUID();
    const fail = (code: CommandError["code"], message: string): Ack<D> => ({
      ok: false, requestId, error: { code, message }, serverNow: new Date(now()).toISOString(),
    });
    if (session.expiresAtMs <= now()) { ack(fail("UNAUTHENTICATED", "Your guest session expired. Reload to reconnect.")); return; }
    cleanup();
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      const code = event === "room:join" && parsed.error.issues.some((issue) => issue.path[0] === "code")
        ? "INVALID_ROOM_CODE" : "BAD_PAYLOAD";
      ack(fail(code, parsed.error.issues[0]?.message ?? "Invalid command.")); return;
    }
    const key = `${session.userId}:${requestId}`;
    const fingerprint = `${event}:${canonical(parsed.data)}`;
    const cached = requests.get(key);
    if (cached && cached.expiresAtMs > now()) {
      if (cached.fingerprint !== fingerprint) { ack(fail("REQUEST_CONFLICT", "This request ID was already used for a different command.")); return; }
      ack(cached.ack as Ack<D>);
      if (cached.ack.ok && session.roomId) {
        const room = lobby.rooms.get(session.roomId);
        if (room?.participants.has(session.userId)) {
          attachAll(session, room);
          publish(room);
        }
      }
      return;
    }
    if (!limiter.allow(`command:${session.userId}`, 60)) { ack(fail("RATE_LIMITED", "Too many commands. Please wait a minute.")); return; }
    if ((event === "room:create" || event === "room:join") && !limiter.allow(`${event}:${socket.handshake.address}`, 30)) {
      ack(fail("RATE_LIMITED", "Too many lobby attempts. Please wait a minute.")); return;
    }
    let response: Ack<D>;
    try {
      // The in-memory adapter and domain mutations are synchronous: each command
      // validates and commits without an await, including the five-seat check.
      const { room, data } = execute(parsed.data);
      attachAll(session, room);
      response = { ok: true, requestId, data, serverNow: new Date(now()).toISOString() };
      requests.set(key, { fingerprint, ack: response, expiresAtMs: session.expiresAtMs });
      ack(response);
      publish(room);
      return;
    } catch (error) {
      if (error instanceof CommandError) response = fail(error.code, error.message);
      else { console.error("Lobby command failed", error); response = fail("INTERNAL_ERROR", "The server could not process this command."); }
    }
    requests.set(key, { fingerprint, ack: response, expiresAtMs: session.expiresAtMs });
    ack(response);
  }

  io.on("connection", (socket) => {
    const session = socket.data.session;
    if (session.roomId) {
      try {
        const room = lobby.attach(session, socket.id, session.roomId);
        void socket.join(room.roomId);
        snapshot(socket, room);
        publish(room);
      } catch { session.roomId = null; }
    }
    socket.on("room:create", (payload, ack) => command(socket, "room:create", createRoomSchema, payload, ack,
      (value) => lobby.create(session, socket.id, value)));
    socket.on("room:join", (payload, ack) => command(socket, "room:join", joinRoomSchema, payload, ack,
      (value) => lobby.join(session, socket.id, value)));
    socket.on("room:ready", (payload, ack) => command(socket, "room:ready", readyRoomSchema, payload, ack,
      (value) => lobby.ready(session, socket.id, value)));
    socket.on("state:resume", (payload, ack) => command(socket, "state:resume", roomCommandSchema, payload, ack,
      (value) => ({ room: lobby.attach(session, socket.id, value.roomId), data: { resumed: true as const } })));
    socket.on("disconnect", () => {
      const room = lobby.disconnect(session, socket.id);
      if (room) publish(room);
    });
  });

  function cleanup() {
    const result = lobby.cleanup();
    for (const room of result.updated) publish(room);
    for (const roomId of result.closed) {
      io.to(roomId).emit("room:closed", { roomId, reason: "IDLE" });
      io.in(roomId).socketsLeave(roomId);
      for (const socket of io.sockets.sockets.values()) {
        if (socket.data.session.roomId === roomId) socket.data.session.roomId = null;
      }
    }
    for (const socket of io.sockets.sockets.values()) {
      if (socket.data.session.expiresAtMs <= now()) socket.disconnect(true);
    }
    for (const [key, entry] of requests) { if (entry.expiresAtMs <= now()) requests.delete(key); }
    sessions.cleanup();
    limiter.cleanup();
  }
  const timer = setInterval(cleanup, options.cleanupIntervalMs ?? 5_000);
  timer.unref();
  async function close() {
    clearInterval(timer);
    await new Promise<void>((resolve) => io.close(() => resolve()));
  }
  return { app, httpServer, io, lobby, cleanup, close };
}
