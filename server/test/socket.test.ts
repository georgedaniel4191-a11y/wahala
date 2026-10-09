import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import type { AddressInfo } from "node:net";
import { CASE_ID, type Ack, type RoomView, type Snapshot, type RoleAssignment, type GameStarted } from "@wahala/shared";
import { createApplication } from "../src/app";
import { RECONNECT_GRACE_MS } from "../src/lobby";
import { loadCasePack } from "../src/case";

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

async function fivePlayers() {
  const members = [await connect()];
  const room = await create(members[0].socket);
  for (let index = 1; index < 5; index += 1) {
    const member = await connect();
    unwrap(await command(member.socket, "room:join", { requestId: randomUUID(), code: room.code, nickname: `Guest ${index}`, avatarId: "gold" }));
    members.push(member);
  }
  const cards: RoleAssignment[][] = members.map(() => []);
  const publicStarts: GameStarted[][] = members.map(() => []);
  members.forEach(({ socket }, index) => {
    socket.on("role:assign", (card) => cards[index].push(card));
    socket.on("game:started", (event) => publicStarts[index].push(event));
  });
  return { members, room, cards, publicStarts };
}
async function readyAll(players: Awaited<ReturnType<typeof fivePlayers>>) {
  for (const member of players.members) unwrap(await command(member.socket, "room:ready", {
    requestId: randomUUID(), roomId: players.room.roomId, ready: true,
  }));
}

describe("real Socket.IO lobby commands", () => {
  it("starts only for the host with five connected ready owners, and locks the roster", async () => {
    const players = await fivePlayers();
    const { members, room } = players;
    expect(await command(members[1].socket, "room:start", { requestId: randomUUID(), roomId: room.roomId }))
      .toMatchObject({ ok: false, error: { code: "NOT_HOST" } });
    expect(await command(members[0].socket, "room:start", { requestId: randomUUID(), roomId: room.roomId }))
      .toMatchObject({ ok: false, error: { code: "NOT_READY" } });
    expect(await command(members[0].socket, "role:acknowledge", { requestId: randomUUID(), roomId: room.roomId }))
      .toMatchObject({ ok: false, error: { code: "WRONG_PHASE" } });
    await readyAll(players);
    expect(await command(members[0].socket, "room:start", { requestId: randomUUID(), roomId: room.roomId, seed: "chosen_by_client" }))
      .toMatchObject({ ok: false, error: { code: "BAD_PAYLOAD" } });
    const payload = { requestId: randomUUID(), roomId: room.roomId };
    const [started, duplicate] = await Promise.all([command(members[0].socket, "room:start", payload), command(members[0].socket, "room:start", payload)]);
    expect(duplicate).toEqual(started);
    expect(unwrap(started)).toMatchObject({ phase: "ROLES" });
    const runtime = application.lobby.rooms.get(room.roomId)!;
    const commitment = runtime.secret!.commitment;
    expect(runtime).toMatchObject({ phase: "ROLES", locked: true, phaseVersion: 1 });
    expect(await command(members[0].socket, "room:start", { ...payload, requestId: randomUUID() }))
      .toMatchObject({ ok: false, error: { code: "WRONG_PHASE" } });
    expect(runtime.secret!.commitment).toBe(commitment);
    expect(await command(members[1].socket, "room:ready", { ...payload, requestId: randomUUID(), ready: false }))
      .toMatchObject({ ok: false, error: { code: "WRONG_PHASE" } });
    const newcomer = await connect();
    expect(await command(newcomer.socket, "room:join", { requestId: randomUUID(), code: room.code, nickname: "Late", avatarId: "mint" }))
      .toMatchObject({ ok: false, error: { code: "WRONG_PHASE" } });
  });

  it("delivers one exact authored card per owner without leaking truth or other private cards", async () => {
    const players = await fivePlayers();
    const outsider = await connect();
    const outsiderCards: RoleAssignment[] = [];
    outsider.socket.on("role:assign", (card) => outsiderCards.push(card));
    await readyAll(players);
    unwrap(await command(players.members[0].socket, "room:start", { requestId: randomUUID(), roomId: players.room.roomId }));
    const pack = loadCasePack();
    const runtime = application.lobby.rooms.get(players.room.roomId)!;
    const secret = runtime.secret!;
    for (let index = 0; index < 5; index += 1) {
      const member = players.members[index];
      await expect.poll(() => players.cards[index].length).toBe(1);
      expect(players.publicStarts[index]).toHaveLength(1);
      const card = players.cards[index][0];
      const self = member.snapshots.at(-1)!.self;
      const authored = pack.variants[0].roleCards.find((c) => c.personaId === card.personaId)!;
      expect(card.startingMemory).toBe(authored.startingMemory);
      expect(card.mission).toEqual({ id: authored.missionId, description: pack.variants[0].missions.find((m) => m.id === authored.missionId)!.description });
      expect(card.ability).toEqual({ id: authored.abilityId, description: pack.variants[0].abilities.find((a) => a.id === authored.abilityId)!.description });
      expect(self.personaId).toBe(card.personaId);
      expect(self.startingMemory).toBe(card.startingMemory);
      expect(secret.canonical.personaToParticipant[card.personaId]).toBe(self.participantId);
      const publicJSON = JSON.stringify({ updates: member.views, started: players.publicStarts[index], public: member.snapshots.map((s) => s.public) });
      const ownerJSON = JSON.stringify({ snapshots: member.snapshots, cards: players.cards[index] });
      expect(publicJSON).not.toContain(secret.sealedSeedHex);
      for (const privateCard of pack.variants[0].roleCards) {
        expect(publicJSON).not.toContain(privateCard.startingMemory);
        expect(ownerJSON).not.toContain(privateCard.blindInvolvement);
        expect(ownerJSON).not.toContain(privateCard.midgameMemory);
        if (privateCard.personaId !== card.personaId) expect(ownerJSON).not.toContain(privateCard.startingMemory);
      }
      expect(ownerJSON).not.toContain(secret.sealedSeedHex);
      for (const key of ["canonical", "sealedSeedHex", "truth", "chain", "correct", "predicate", "roleCards"]) {
        expect(publicJSON).not.toContain(`"${key}"`);
        expect(ownerJSON).not.toContain(`"${key}"`);
      }
      expect(players.publicStarts[index][0].cast).toHaveLength(5);
    }
    expect(new Set(players.cards.map((cards) => cards[0].personaId)).size).toBe(5);
    expect(outsiderCards).toHaveLength(0);
    expect(outsider.snapshots).toHaveLength(0);
    expect(await command(outsider.socket, "state:resume", { requestId: randomUUID(), roomId: players.room.roomId }))
      .toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await command(outsider.socket, "role:acknowledge", { requestId: randomUUID(), roomId: players.room.roomId }))
      .toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("restores only the same owner's role across tabs/reconnects and records acknowledgment idempotently", async () => {
    const players = await fivePlayers();
    await readyAll(players);
    unwrap(await command(players.members[0].socket, "room:start", { requestId: randomUUID(), roomId: players.room.roomId }));
    const owner = players.members[2];
    await expect.poll(() => players.cards[2].length).toBe(1);
    const card = players.cards[2][0];
    const runtime = application.lobby.rooms.get(players.room.roomId)!;
    const payload = { requestId: randomUUID(), roomId: players.room.roomId };
    const ack = await command(owner.socket, "role:acknowledge", payload);
    expect(unwrap(ack)).toEqual({ acknowledged: true });
    const version = runtime.version;
    expect(await command(owner.socket, "role:acknowledge", payload)).toEqual(ack);
    unwrap(await command(owner.socket, "role:acknowledge", { ...payload, requestId: randomUUID() }));
    expect(runtime.version).toBe(version);
    expect([...runtime.participants.values()].filter((p) => p.roleAcknowledged)).toHaveLength(1);
    expect(await command(owner.socket, "role:acknowledge", { ...payload, requestId: randomUUID(), participantId: players.room.participantId }))
      .toMatchObject({ ok: false, error: { code: "BAD_PAYLOAD" } });
    const anotherTab = await connect(owner.cookie);
    await expect.poll(() => anotherTab.snapshots.length).toBeGreaterThan(0);
    expect(anotherTab.snapshots.at(-1)!.self.startingMemory).toBe(card.startingMemory);
    owner.socket.disconnect(); anotherTab.socket.disconnect();
    await expect.poll(() => application.lobby.view(runtime).participants.find((p) => p.personaId === card.personaId)!.connected).toBe(false);
    clock += RECONNECT_GRACE_MS + 1;
    application.cleanup();
    expect(runtime.participants.size).toBe(5);
    const back = await connect(owner.cookie);
    const backCards: RoleAssignment[] = [];
    back.socket.on("role:assign", (value) => backCards.push(value));
    unwrap(await command(back.socket, "state:resume", { ...payload, requestId: randomUUID() }));
    await expect.poll(() => back.snapshots.length).toBeGreaterThan(0);
    expect(backCards).toHaveLength(0);
    expect(back.snapshots.at(-1)!.self.startingMemory).toBe(card.startingMemory);
    expect(runtime.phase).toBe("INVESTIGATION_1");
    expect(runtime.secret!.commitment).toBe(players.publicStarts[0][0].commitment);
  });

  it("routes investigation receipts only to owners and deduplicates concurrent nested action commands", async () => {
    const players = await fivePlayers(); await readyAll(players);
    unwrap(await command(players.members[0].socket, "room:start", { roomId: players.room.roomId, requestId: randomUUID() }));
    for (const member of players.members) unwrap(await command(member.socket, "role:acknowledge", { roomId: players.room.roomId, requestId: randomUUID() }));
    const runtime = application.lobby.rooms.get(players.room.roomId)!;
    expect(runtime.phase).toBe("INVESTIGATION_1");
    const received: unknown[][] = players.members.map(() => []);
    players.members.forEach((m, index) => m.socket.on("evidence:private", value => received[index].push(value)));
    const payload = { roomId: players.room.roomId, requestId: randomUUID(), round: 1, action: { kind: "INVESTIGATE", leadId: "delivery_log" } };
    const [first, retry] = await Promise.all([command(players.members[0].socket, "action:submit", payload), command(players.members[0].socket, "action:submit", { ...payload, action: { leadId: "delivery_log", kind: "INVESTIGATE" } })]);
    expect(unwrap(first)).toEqual({ accepted: true, selectedAction: payload.action }); expect(retry).toEqual(first);
    expect(runtime.investigation!.ledger.filter(e => e.kind === "ACTION_SELECTED")).toHaveLength(1);
    expect(await command(players.members[0].socket, "action:submit", { ...payload, action: { kind: "PASS" } })).toMatchObject({ ok: false, error: { code: "REQUEST_CONFLICT" } });
    expect(await command(players.members[1].socket, "action:submit", { ...payload, requestId: randomUUID(), participantId: players.room.participantId })).toMatchObject({ ok: false, error: { code: "BAD_PAYLOAD" } });
    clock += 120_000; application.cleanup();
    await expect.poll(() => received[0].length).toBe(1);
    expect(received[0][0]).toMatchObject({ source: "INVESTIGATE", evidence: { id: "delivery_receipt" } });
    for (const other of received.slice(1)) expect(other).toEqual([]);
    await expect.poll(() => players.members[1].views.at(-1)!.phase).toBe("TWIST");
    for (const member of players.members) expect(JSON.stringify(member.views)).not.toContain("delivery_receipt");
    const back = await connect(players.members[0].cookie);
    await expect.poll(() => back.snapshots.length).toBeGreaterThan(0);
    expect(back.snapshots.at(-1)!.self.myEvidence.map(e => e.id)).toContain("delivery_receipt");
    expect(back.snapshots.at(-1)!.self.selectedAction).toEqual(payload.action);
    clock += 30_000; application.cleanup();
    const outsider = await connect();
    expect(await command(outsider.socket, "action:submit", { roomId: players.room.roomId, requestId: randomUUID(), round: 2, action: { kind: "PASS" } })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("restores outstanding owner-only settlement requests and rejects forged or repeated responses", async () => {
    const players = await fivePlayers(); await readyAll(players);
    unwrap(await command(players.members[0].socket, "room:start", { roomId: players.room.roomId, requestId: randomUUID() }));
    clock += 45_000; application.cleanup();
    const targetId = players.members[1].snapshots.at(-1)!.self.participantId;
    // Wait for the initial snapshot if this member's socket has not flushed yet.
    const runtime = application.lobby.rooms.get(players.room.roomId)!;
    const addressed = [...runtime.participants.values()][1].participantId;
    expect(targetId).toBe(addressed);
    unwrap(await command(players.members[0].socket, "action:submit", { roomId: players.room.roomId, requestId: randomUUID(), round: 1, action: { kind: "CONFRONT", targetParticipantId: addressed, question: "Can you explain the attachment?" } }));
    const requests: unknown[][] = players.members.map(() => []);
    players.members.forEach((m, i) => m.socket.on("action:respond_requested", value => requests[i].push(value)));
    clock += 120_000; application.cleanup();
    await expect.poll(() => requests[1].length).toBeGreaterThan(0);
    expect(requests.filter((_, i) => i !== 1).flat()).toHaveLength(0);
    const anotherTab = await connect(players.members[1].cookie);
    const restored: unknown[] = []; anotherTab.socket.on("action:respond_requested", value => restored.push(value));
    unwrap(await command(anotherTab.socket, "state:resume", { roomId: players.room.roomId, requestId: randomUUID() }));
    await expect.poll(() => restored.length).toBeGreaterThan(0);
    const challengeId = [...runtime.investigation!.challenges.keys()][0];
    const response = { roomId: players.room.roomId, requestId: randomUUID(), challengeId, response: "ANSWER", text: "I remember a flyer." };
    expect(await command(players.members[2].socket, "action:respond", response)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    const [answer, replay] = await Promise.all([command(anotherTab.socket, "action:respond", response), command(anotherTab.socket, "action:respond", response)]);
    expect(unwrap(answer)).toEqual({ recorded: true }); expect(replay).toEqual(answer); expect(runtime.phase).toBe("TWIST");
    expect(runtime.investigation!.events.filter(e => e.kind === "ANSWER")).toHaveLength(1);
  });

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
