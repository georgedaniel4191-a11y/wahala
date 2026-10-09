import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CASE_ID, type CreateRoomCommand } from "@wahala/shared";
import { CommandError, Lobby, RECONNECT_GRACE_MS, ROOM_IDLE_MS } from "../src/lobby";
import { RateLimiter, type GuestSession } from "../src/sessions";

function guest(): GuestSession {
  return { userId: randomUUID(), roomId: null, expiresAtMs: Date.now() + 100_000 };
}
function creation(botPolicy: CreateRoomCommand["botPolicy"] = "none"): CreateRoomCommand {
  return { requestId: randomUUID(), caseId: CASE_ID, nickname: "Ada", avatarId: "gold", mode: "PRIVATE", botPolicy };
}

describe("lobby domain", () => {
  it("requires both consent flags for allow_bots and clears consent on unready", () => {
    const lobby = new Lobby("http://localhost:3000");
    const session = guest();
    const { room } = lobby.create(session, "socket", creation("allow_bots"));
    const command = { requestId: randomUUID(), roomId: room.roomId, ready: true };
    for (const consent of [{}, { acceptBotFill: true }, { acceptedIdentityHiddenDisclosure: true },
      { acceptBotFill: false, acceptedIdentityHiddenDisclosure: true }]) {
      expect(() => lobby.ready(session, "socket", { ...command, ...consent })).toThrowError(CommandError);
      expect(lobby.view(room).participants[0].ready).toBe(false);
    }
    lobby.ready(session, "socket", { ...command, acceptBotFill: true, acceptedIdentityHiddenDisclosure: true });
    expect(lobby.view(room).botFillConsented).toBe(true);
    lobby.ready(session, "socket", { ...command, ready: false });
    expect(lobby.view(room).botFillConsented).toBe(false);
    expect(room.participants.get(session.userId)?.acceptedIdentityHiddenDisclosure).toBe(false);
  });

  it("reserves a disconnected seat, then expires it and transfers host ownership", () => {
    let now = 1_000;
    const lobby = new Lobby("http://localhost:3000", () => now);
    const host = guest();
    const next = guest();
    const { room } = lobby.create(host, "host", creation());
    lobby.join(next, "next", { requestId: randomUUID(), code: room.code, nickname: "Zainab", avatarId: "mint" });
    const original = lobby.self(host, room.roomId).participantId;
    lobby.ready(host, "host", { requestId: randomUUID(), roomId: room.roomId, ready: true });
    lobby.disconnect(host, "host");
    expect(lobby.view(room).participants[0]).toMatchObject({ participantId: original, connected: false, ready: false });
    now += RECONNECT_GRACE_MS - 1;
    lobby.cleanup();
    lobby.attach(host, "back", room.roomId);
    expect(lobby.self(host, room.roomId).participantId).toBe(original);
    lobby.disconnect(host, "back");
    now += RECONNECT_GRACE_MS;
    lobby.cleanup();
    expect(lobby.view(room).participants).toHaveLength(1);
    expect(lobby.view(room).participants[0].isHost).toBe(true);
    expect(() => lobby.attach(host, "too-late", room.roomId)).toThrowError(CommandError);
  });

  it("does not disconnect a participant when another socket remains", () => {
    const lobby = new Lobby("http://localhost:3000");
    const session = guest();
    const { room } = lobby.create(session, "one", creation());
    lobby.attach(session, "two", room.roomId);
    lobby.ready(session, "one", { requestId: randomUUID(), roomId: room.roomId, ready: true });
    lobby.disconnect(session, "one");
    expect(lobby.view(room).participants[0]).toMatchObject({ connected: true, ready: true });
    expect(room.participants.size).toBe(1);
  });

  it("denies locked-room joining and prevents owning seats in two rooms", () => {
    const lobby = new Lobby("http://localhost:3000");
    const host = guest();
    const other = guest();
    const { room } = lobby.create(host, "one", creation());
    const { room: second } = lobby.create(other, "two", creation());
    const join = { requestId: randomUUID(), code: second.code, nickname: "Ada", avatarId: "gold" as const };
    expect(() => lobby.join(host, "one", join)).toThrowError(CommandError);
    second.locked = true;
    expect(() => lobby.join(guest(), "three", join)).toThrowError("locked");
    expect(room.participants.size).toBe(1);
    expect(second.participants.size).toBe(1);
  });

  it("closes idle rooms even if a browser stays connected", () => {
    let now = 0;
    const lobby = new Lobby("http://localhost:3000", () => now);
    const { room } = lobby.create(guest(), "one", creation());
    now += ROOM_IDLE_MS;
    expect(lobby.cleanup().closed).toEqual([room.roomId]);
    expect(lobby.rooms.size).toBe(0);
  });

  it("rate limits within a time window and permits requests after expiry", () => {
    let now = 0;
    const limiter = new RateLimiter(() => now);
    expect(limiter.allow("guest", 2)).toBe(true);
    expect(limiter.allow("guest", 2)).toBe(true);
    expect(limiter.allow("guest", 2)).toBe(false);
    now = 60_000;
    limiter.cleanup();
    expect(limiter.allow("guest", 2)).toBe(true);
  });
});
