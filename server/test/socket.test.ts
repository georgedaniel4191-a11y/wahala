import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import type { AddressInfo } from "node:net";
import { CASE_ID, type Ack, type RoomView, type Snapshot } from "@wahala/shared";
import { createApplication } from "../src/app";
import { RECONNECT_GRACE_MS } from "../src/lobby";

const ORIGIN = "http://localhost:3000";
let application: ReturnType<typeof createApplication>;
let url: string;
let clock: number;
const clients: Socket[] = [];

beforeEach(async () => {
  clock = Date.now();
  application = createApplication({ clientOrigin: ORIGIN, now: () => clock });
  await new Promise<void>((resolve) => application.httpServer.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(application.httpServer.address() as AddressInfo).port}`;
});
afterEach(async () => {
  for (const client of clients.splice(0)) { client.removeAllListeners(); client.disconnect(); }
  await application.close();
});

async function issueCookie() {
  const response = await fetch(`${url}/api/session/guest`, { method: "POST", headers: { Origin: ORIGIN } });
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie")!.split(";")[0];
}
async function connect(cookie?: string, transport: "websocket" | "polling" = "websocket") {
  const signedCookie = cookie ?? await issueCookie();
  const socket = io(url, {
    autoConnect: false, transports: [transport], reconnection: false,
    extraHeaders: { Origin: ORIGIN, Cookie: signedCookie },
  });
  clients.push(socket);
  const views: RoomView[] = [];
  const snapshots: Snapshot[] = [];
  socket.on("room:updated", ({ view }) => views.push(view));
  socket.on("state:snapshot", (snapshot) => snapshots.push(snapshot));
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve); socket.once("connect_error", reject); socket.connect();
  });
  return { socket, cookie: signedCookie, views, snapshots };
}
async function command<T = Record<string, unknown>>(socket: Socket, event: string, payload: unknown): Promise<Ack<T>> {
  return socket.timeout(2_000).emitWithAck(event, payload) as Promise<Ack<T>>;
}
function createPayload() {
  return { requestId: randomUUID(), caseId: CASE_ID, nickname: "Ada", avatarId: "gold", mode: "PRIVATE", botPolicy: "none" };
}
function unwrap<T>(ack: Ack<T>): T {
  expect(ack.ok).toBe(true);
  if (!ack.ok) throw new Error(ack.error.message);
  return ack.data;
}
async function create(socket: Socket) {
  return unwrap(await command<{ roomId: string; code: string; participantId: string; inviteUrl: string }>(socket, "room:create", createPayload()));
}

describe("real Socket.IO lobby commands", () => {
  it("authenticates via signed HttpOnly cookies and rejects missing, forged or wrong-origin sessions", async () => {
    expect((await fetch(`${url}/api/session/guest`, { method: "POST" })).status).toBe(403);
    const response = await fetch(`${url}/api/session/guest`, { method: "POST", headers: { Origin: ORIGIN } });
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/);
    expect(response.headers.get("set-cookie")).toMatch(/SameSite=Lax/);
    expect(await response.json()).toEqual({ ok: true });
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    const invalidHeaders: Record<string, string>[] = [{ Origin: ORIGIN }, { Origin: ORIGIN, Cookie: `${cookie.slice(0, -1)}!` },
      { Origin: "https://untrusted.example", Cookie: cookie }];
    for (const headers of invalidHeaders) {
      const socket = io(url, { autoConnect: false, reconnection: false, transports: ["websocket"], extraHeaders: headers });
      clients.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.once("connect_error", () => resolve());
        socket.once("connect", () => reject(new Error("Unauthenticated socket connected")));
        socket.connect();
      });
    }
    const refresh = await fetch(`${url}/api/session/guest`, { method: "POST", headers: { Origin: ORIGIN, Cookie: cookie } });
    expect(refresh.headers.get("set-cookie")).toBeNull();
  });

  it("creates, joins and synchronizes ready/unready across five clients without starting", async () => {
    const host = await connect();
    const room = await create(host.socket);
    expect(room.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(room.inviteUrl).toBe(`${ORIGIN}/?code=${room.code}`);
    const members = [host];
    for (let index = 1; index < 5; index += 1) {
      const member = await connect(undefined, index === 1 ? "polling" : "websocket");
      unwrap(await command(member.socket, "room:join", {
        requestId: randomUUID(), code: room.code.toLowerCase(), nickname: `Player ${index}`, avatarId: "mint",
      }));
      members.push(member);
    }
    for (const member of members) unwrap(await command(member.socket, "room:ready", {
      requestId: randomUUID(), roomId: room.roomId, ready: true,
    }));
    for (const member of members) {
      await expect.poll(() => member.views.at(-1)?.participants.every((p) => p.ready)).toBe(true);
      expect(member.views.at(-1)?.participants).toHaveLength(5);
      expect(member.views.at(-1)?.phase).toBe("LOBBY");
      expect(member.snapshots.at(-1)?.self.participantId).toBeDefined();
    }
    unwrap(await command(host.socket, "room:ready", { requestId: randomUUID(), roomId: room.roomId, ready: false }));
    await expect.poll(() => members[4].views.at(-1)?.participants[0].ready).toBe(false);
  });

  it("never overbooks the fifth seat under concurrent joins", async () => {
    const host = await connect();
    const room = await create(host.socket);
    const joiners = await Promise.all(Array.from({ length: 5 }, () => connect()));
    const results = await Promise.all(joiners.map(({ socket }, index) => command(socket, "room:join", {
      requestId: randomUUID(), code: room.code, nickname: `Guest ${index}`, avatarId: "sky",
    })));
    expect(results.filter((ack) => ack.ok)).toHaveLength(4);
    expect(results.find((ack) => !ack.ok)).toMatchObject({ ok: false, error: { code: "ROOM_FULL" } });
    expect(application.lobby.rooms.get(room.roomId)?.participants.size).toBe(5);
  });

  it("deduplicates concurrent create/join/ready and rejects reuse with different payloads", async () => {
    const host = await connect();
    const payload = createPayload();
    const [first, duplicate] = await Promise.all([command(host.socket, "room:create", payload), command(host.socket, "room:create", payload)]);
    expect(duplicate).toEqual(first);
    expect(application.lobby.rooms.size).toBe(1);
    const room = unwrap(first) as unknown as { roomId: string; code: string };
    const member = await connect();
    const joining = { requestId: randomUUID(), code: room.code, nickname: "Zainab", avatarId: "mint" };
    const [joined, joinedAgain] = await Promise.all([command(member.socket, "room:join", joining), command(member.socket, "room:join", joining)]);
    expect(joinedAgain).toEqual(joined);
    expect(application.lobby.rooms.get(room.roomId)?.participants.size).toBe(2);
    const readiness = { requestId: randomUUID(), roomId: room.roomId, ready: true };
    const ready = await command(host.socket, "room:ready", readiness);
    const version = application.lobby.rooms.get(room.roomId)!.version;
    expect(await command(host.socket, "room:ready", readiness)).toEqual(ready);
    expect(application.lobby.rooms.get(room.roomId)!.version).toBe(version);
    expect(await command(host.socket, "room:ready", { ...readiness, ready: false }))
      .toMatchObject({ ok: false, error: { code: "REQUEST_CONFLICT" } });
    // A delayed retry returns its original receipt, not a second state change.
    unwrap(await command(host.socket, "room:ready", { ...readiness, requestId: randomUUID(), ready: false }));
    expect(await command(host.socket, "room:ready", readiness)).toEqual(ready);
    expect(application.lobby.view(application.lobby.rooms.get(room.roomId)!).participants[0].ready).toBe(false);
  });

  it("rejects malformed payloads, unknown cases, forged membership and forged participant IDs", async () => {
    const host = await connect();
    const room = await create(host.socket);
    const outsider = await connect();
    for (const event of ["room:ready", "state:resume"]) {
      const payload = { requestId: randomUUID(), roomId: room.roomId, ...(event === "room:ready" ? { ready: true } : {}) };
      expect(await command(outsider.socket, event, payload)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    }
    expect(outsider.views).toHaveLength(0);
    expect(outsider.snapshots).toHaveLength(0);
    expect(await command(host.socket, "room:ready", { requestId: randomUUID(), roomId: room.roomId, ready: true, participantId: room.participantId }))
      .toMatchObject({ ok: false, error: { code: "BAD_PAYLOAD" } });
    expect(await command(host.socket, "room:ready", { requestId: "not-a-uuid", roomId: room.roomId, ready: "yes" }))
      .toMatchObject({ ok: false, error: { code: "BAD_PAYLOAD" } });
    expect(await command(outsider.socket, "room:create", { ...createPayload(), mode: "QUICK_CASUAL" }))
      .toMatchObject({ ok: false, error: { code: "BAD_PAYLOAD" } });
    expect(await command(outsider.socket, "room:create", { ...createPayload(), caseId: "unknown_case" }))
      .toMatchObject({ ok: false, error: { code: "CASE_UNAVAILABLE" } });
    expect(await command(outsider.socket, "room:join", { requestId: randomUUID(), code: "!!!!", nickname: "Guest", avatarId: "gold" }))
      .toMatchObject({ ok: false, error: { code: "INVALID_ROOM_CODE" } });
    expect(await command(outsider.socket, "room:join", { requestId: randomUUID(), code: "ZZZZZZ", nickname: "Guest", avatarId: "gold" }))
      .toMatchObject({ ok: false, error: { code: "ROOM_NOT_FOUND" } });
  });

  it("keeps one seat across tabs and reconnects, then frees it after the reservation expires", async () => {
    const host = await connect();
    const room = await create(host.socket);
    const secondTab = await connect(host.cookie);
    await expect.poll(() => secondTab.snapshots.length).toBeGreaterThan(0);
    expect(secondTab.snapshots.at(-1)?.self.participantId).toBe(room.participantId);
    expect(application.lobby.rooms.get(room.roomId)?.participants.size).toBe(1);
    host.socket.disconnect();
    await expect.poll(() => application.lobby.rooms.get(room.roomId)?.participants.values().next().value?.socketIds.size).toBe(1);
    expect(application.lobby.view(application.lobby.rooms.get(room.roomId)!).participants[0].connected).toBe(true);
    secondTab.socket.disconnect();
    await expect.poll(() => application.lobby.view(application.lobby.rooms.get(room.roomId)!).participants[0].connected).toBe(false);
    const reconnect = await connect(host.cookie);
    await expect.poll(() => reconnect.snapshots.length).toBeGreaterThan(0);
    expect(reconnect.snapshots.at(-1)?.self.participantId).toBe(room.participantId);
    const other = await connect();
    unwrap(await command(other.socket, "room:join", { requestId: randomUUID(), code: room.code, nickname: "Emeka", avatarId: "sky" }));
    reconnect.socket.disconnect();
    await expect.poll(() => application.lobby.view(application.lobby.rooms.get(room.roomId)!).participants[0].connected).toBe(false);
    clock += RECONNECT_GRACE_MS + 1;
    application.cleanup();
    const late = await connect(host.cookie);
    expect(await command(late.socket, "state:resume", { requestId: randomUUID(), roomId: room.roomId }))
      .toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(application.lobby.view(application.lobby.rooms.get(room.roomId)!).participants).toHaveLength(1);
  });

  it("never projects session IDs, cookies, socket IDs, seat kinds or private state into public views", async () => {
    const host = await connect();
    const room = await create(host.socket);
    await expect.poll(() => host.views.length).toBeGreaterThan(0);
    const view = host.views.at(-1)!;
    expect(Object.keys(view.participants[0]).sort()).toEqual(["avatarId", "connected", "isHost", "nickname", "participantId", "personaId", "ready"]);
    expect(view.publicClues).toEqual([]);
    const json = JSON.stringify(host.snapshots);
    for (const forbidden of ["userId", "socketIds", "kind", "humanCount", "botCount", "acceptedIdentityHiddenDisclosure", "secret"]) {
      expect(json).not.toContain(`"${forbidden}"`);
    }
    expect(json).not.toContain(host.cookie);
    expect(host.snapshots.at(-1)?.self).toMatchObject({ participantId: room.participantId, mission: null, myBallot: null });
  });

  it("rate limits guessed codes and requires consent before ready in AI-enabled lobbies", async () => {
    const host = await connect();
    const ack = await command<{ roomId: string }>(host.socket, "room:create", { ...createPayload(), botPolicy: "allow_bots" });
    const room = unwrap(ack);
    expect(await command(host.socket, "room:ready", { requestId: randomUUID(), roomId: room.roomId, ready: true }))
      .toMatchObject({ ok: false, error: { code: "BOT_FILL_NOT_ALLOWED" } });
    unwrap(await command(host.socket, "room:ready", { requestId: randomUUID(), roomId: room.roomId, ready: true,
      acceptBotFill: true, acceptedIdentityHiddenDisclosure: true }));
    const outsider = await connect();
    let last: Ack<unknown> | undefined;
    for (let index = 0; index < 31; index += 1) {
      last = await command(outsider.socket, "room:join", { requestId: randomUUID(), code: "ZZZZZZ", nickname: "Guest", avatarId: "gold" });
    }
    expect(last).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } });
  });
});
