import express from "express";
import cors from "cors";
import { createServer, type IncomingMessage } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import {
  actionSubmitSchema, actionRespondSchema, dealRespondSchema, chatSendSchema, CASE_ID, CASE_TITLE, createRoomSchema, joinRoomSchema, readyRoomSchema, roomCommandSchema,
} from "@wahala/shared";
import type { Ack, ClientToServerEvents, ServerToClientEvents } from "@wahala/shared";
import { CommandError, Lobby, type LobbyRoom } from "./lobby";
import { loadCasePack } from "./case";
import type { Delivery } from "./investigation";
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
  const sorted = (v: unknown): unknown => Array.isArray(v) ? v.map(sorted) : v !== null && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, child]) => [k, sorted(child)])) : v;
  return JSON.stringify(sorted(value));
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
    cases: [{ caseId: CASE_ID, title: CASE_TITLE, seats: 5, investigationLeads: loadCasePack().variants[0].investigationLeads.map(({ id, label }) => ({ id, label })) }],
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
  function snapshot(socket: LobbySocket, room: LobbyRoom, announceStarted = true) {
    socket.emit("state:snapshot", {
      roomId: room.roomId, public: lobby.view(room),
      self: lobby.self(socket.data.session, room.roomId), recentChat: room.investigation?.chat ?? [], reveal: null,
    });
    const started = lobby.started(room);
    if (started && announceStarted) socket.emit("game:started", started);
    const card = lobby.role(socket.data.session, room.roomId);
    if (card && room.phase === "ROLES") socket.emit("role:assign", card);
    for (const delivery of room.investigation?.pending(lobby.self(socket.data.session, room.roomId).participantId) ?? []) emitDelivery(socket, delivery);
  }
  function emitDelivery(target: { emit: unknown }, delivery: Delivery) {
    // Delivery is a discriminated event/payload union; this bridge only adapts
    // Socket.IO's overloaded emitter. Owner routing is enforced below.
    (target.emit as (event: string, payload: unknown) => void).call(target, delivery.event, delivery.payload);
  }
  function synchronize(room: LobbyRoom) {
    const deliveries = room.investigation?.drain() ?? [];
    for (const delivery of deliveries) {
      if (!delivery.owner) emitDelivery(io.to(room.roomId), delivery);
      else for (const socket of io.sockets.sockets.values()) {
        const member = room.participants.get(socket.data.session.userId);
        if (member?.participantId === delivery.owner && socket.data.session.roomId === room.roomId) emitDelivery(socket, delivery);
      }
    }
    const view = lobby.view(room);
    io.to(room.roomId).emit("game:phase", { roomId: room.roomId, phase: view.phase, round: view.round, version: view.version, deadlineAt: view.deadlineAt, serverNow: view.serverNow });
    for (const socket of io.sockets.sockets.values()) {
      if (socket.data.session.roomId === room.roomId && room.participants.has(socket.data.session.userId)) snapshot(socket, room, false);
    }
    publish(room);
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
      if (event === "room:start") {
        const started = lobby.started(room)!;
        io.to(room.roomId).emit("game:started", started);
        // Each socket's session determines its card, including duplicate tabs.
        // The role projector is never used for a room broadcast.
        for (const memberSocket of io.sockets.sockets.values()) {
          if (room.participants.has(memberSocket.data.session.userId) && memberSocket.data.session.roomId === room.roomId) {
            snapshot(memberSocket, room, false);
          }
        }
        io.to(room.roomId).emit("game:phase", { roomId: room.roomId, phase: room.phase,
          round: 0, version: room.version, deadlineAt: lobby.view(room).deadlineAt, serverNow: new Date(now()).toISOString() });
      } else attachAll(session, room);
      if (room.investigation && event !== "room:start") synchronize(room);
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
    socket.on("room:start", (payload, ack) => command(socket, "room:start", roomCommandSchema, payload, ack,
      (value) => lobby.start(session, socket.id, value)));
    socket.on("role:acknowledge", (payload, ack) => command(socket, "role:acknowledge", roomCommandSchema, payload, ack,
      (value) => lobby.acknowledge(session, socket.id, value)));
    socket.on("action:submit", (payload, ack) => command(socket, "action:submit", actionSubmitSchema, payload, ack,
      value => lobby.gameCommand(session, socket.id, "action:submit", value)));
    socket.on("action:respond", (payload, ack) => command(socket, "action:respond", actionRespondSchema, payload, ack,
      value => lobby.gameCommand(session, socket.id, "action:respond", value)));
    socket.on("deal:respond", (payload, ack) => command(socket, "deal:respond", dealRespondSchema, payload, ack,
      value => lobby.gameCommand(session, socket.id, "deal:respond", value)));
    socket.on("chat:send", (payload, ack) => command(socket, "chat:send", chatSendSchema, payload, ack,
      value => lobby.gameCommand(session, socket.id, "chat:send", value)));
    socket.on("disconnect", () => {
      const room = lobby.disconnect(session, socket.id);
      if (room) { room.investigation?.tick(); if (room.investigation) synchronize(room); else publish(room); }
    });
  });

  function cleanup() {
    for (const room of lobby.tick()) synchronize(room);
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
  const timer = setInterval(cleanup, options.cleanupIntervalMs ?? 100);
  timer.unref();
  async function close() {
    clearInterval(timer);
    await new Promise<void>((resolve) => io.close(() => resolve()));
  }
  return { app, httpServer, io, lobby, cleanup, close };
}
