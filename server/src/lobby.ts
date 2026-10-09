import { randomInt, randomUUID } from "node:crypto";
import { CASE_ID, CASE_TITLE, SEAT_COUNT } from "@wahala/shared";
import type { BotPolicy, CreateRoomCommand, JoinRoomCommand, ReadyRoomCommand, RoomView, SelfView, ErrorCode } from "@wahala/shared";
import type { GuestSession } from "./sessions";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const RECONNECT_GRACE_MS = 90_000;
export const ROOM_IDLE_MS = 30 * 60_000;

export class CommandError extends Error {
  constructor(public readonly code: ErrorCode, message: string) { super(message); }
}

type Participant = {
  participantId: string; userId: string; nickname: string; avatarId: string;
  socketIds: Set<string>; disconnectedAtMs: number | null;
  ready: boolean; acceptBotFill: boolean; acceptedIdentityHiddenDisclosure: boolean;
};
export type LobbyRoom = {
  roomId: string; code: string; hostUserId: string; caseId: string;
  phase: "LOBBY"; version: number; locked: boolean; botPolicy: BotPolicy;
  lastActivityAtMs: number; participants: Map<string, Participant>;
};

export class Lobby {
  readonly rooms = new Map<string, LobbyRoom>();
  private readonly codes = new Map<string, string>();
  constructor(private readonly clientOrigin: string, private readonly now = Date.now) {}

  private newCode() {
    let code: string;
    do { code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(""); }
    while (this.codes.has(code));
    return code;
  }

  private checkAvailable(session: GuestSession) {
    if (session.roomId && this.rooms.get(session.roomId)?.participants.has(session.userId)) {
      throw new CommandError("REQUEST_CONFLICT", "You already have a seat in another lobby. Reconnect to that lobby first.");
    }
    session.roomId = null;
  }

  private add(room: LobbyRoom, session: GuestSession, socketId: string, profile: { nickname: string; avatarId: string }) {
    const participant: Participant = {
      participantId: randomUUID(), userId: session.userId, ...profile,
      socketIds: new Set([socketId]), disconnectedAtMs: null, ready: false,
      acceptBotFill: false, acceptedIdentityHiddenDisclosure: false,
    };
    room.participants.set(session.userId, participant);
    session.roomId = room.roomId;
    return participant;
  }

  create(session: GuestSession, socketId: string, command: CreateRoomCommand) {
    if (command.caseId !== CASE_ID) throw new CommandError("CASE_UNAVAILABLE", "That case is unavailable.");
    this.checkAvailable(session);
    const room: LobbyRoom = {
      roomId: randomUUID(), code: this.newCode(), hostUserId: session.userId,
      caseId: command.caseId, phase: "LOBBY", version: 1, locked: false,
      botPolicy: command.botPolicy, lastActivityAtMs: this.now(), participants: new Map(),
    };
    const participant = this.add(room, session, socketId, command);
    this.rooms.set(room.roomId, room);
    this.codes.set(room.code, room.roomId);
    return { room, data: {
      roomId: room.roomId, code: room.code, participantId: participant.participantId,
      inviteUrl: `${this.clientOrigin}/?code=${room.code}`,
    } };
  }

  join(session: GuestSession, socketId: string, command: JoinRoomCommand) {
    const roomId = this.codes.get(command.code);
    const room = roomId ? this.rooms.get(roomId) : undefined;
    if (!room) throw new CommandError("ROOM_NOT_FOUND", "No lobby was found with that code.");
    const existing = room.participants.get(session.userId);
    if (existing) {
      this.attach(session, socketId, room.roomId);
      return { room, data: { roomId: room.roomId, participantId: existing.participantId } };
    }
    this.checkAvailable(session);
    if (room.phase !== "LOBBY") throw new CommandError("WRONG_PHASE", "Joining is only available in the lobby.");
    if (room.locked) throw new CommandError("ROOM_LOCKED", "This lobby is locked.");
    if (room.participants.size >= SEAT_COUNT) throw new CommandError("ROOM_FULL", "All five seats are occupied.");
    const participant = this.add(room, session, socketId, command);
    this.touch(room);
    return { room, data: { roomId: room.roomId, participantId: participant.participantId } };
  }

  member(session: GuestSession, roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) throw new CommandError("ROOM_NOT_FOUND", "This lobby has expired or the server restarted.");
    const participant = room.participants.get(session.userId);
    if (!participant || session.roomId !== roomId) throw new CommandError("FORBIDDEN", "You do not own a seat in this lobby.");
    return { room, participant };
  }

  attach(session: GuestSession, socketId: string, roomId: string) {
    const { room, participant } = this.member(session, roomId);
    const wasConnected = participant.socketIds.size > 0;
    participant.socketIds.add(socketId);
    participant.disconnectedAtMs = null;
    if (!wasConnected) this.touch(room);
    return room;
  }

  ready(session: GuestSession, socketId: string, command: ReadyRoomCommand) {
    const { room, participant } = this.member(session, command.roomId);
    if (!participant.socketIds.has(socketId)) throw new CommandError("FORBIDDEN", "Reconnect to your seat first.");
    if (room.phase !== "LOBBY") throw new CommandError("WRONG_PHASE", "Readiness can only change in the lobby.");
    if (command.ready && room.botPolicy === "allow_bots" &&
      !(command.acceptBotFill === true && command.acceptedIdentityHiddenDisclosure === true)) {
      throw new CommandError("BOT_FILL_NOT_ALLOWED", "Accept possible AI participation and hidden identities before becoming ready, or join a humans-only lobby.");
    }
    const accept = command.ready && room.botPolicy === "allow_bots";
    if (participant.ready !== command.ready || participant.acceptBotFill !== accept || participant.acceptedIdentityHiddenDisclosure !== accept) {
      participant.ready = command.ready;
      participant.acceptBotFill = accept;
      participant.acceptedIdentityHiddenDisclosure = accept;
      this.touch(room);
    }
    return { room, data: { ready: participant.ready } };
  }

  disconnect(session: GuestSession, socketId: string) {
    if (!session.roomId) return null;
    const room = this.rooms.get(session.roomId);
    const participant = room?.participants.get(session.userId);
    if (!room || !participant || !participant.socketIds.delete(socketId)) return null;
    if (participant.socketIds.size === 0) {
      participant.disconnectedAtMs = this.now();
      participant.ready = false;
      participant.acceptBotFill = false;
      participant.acceptedIdentityHiddenDisclosure = false;
      this.touch(room);
    }
    return room;
  }

  cleanup(): { updated: LobbyRoom[]; closed: string[] } {
    const updated: LobbyRoom[] = [];
    const closed: string[] = [];
    for (const room of this.rooms.values()) {
      let changed = false;
      for (const [userId, participant] of room.participants) {
        if (participant.disconnectedAtMs !== null && this.now() - participant.disconnectedAtMs >= RECONNECT_GRACE_MS) {
          room.participants.delete(userId);
          changed = true;
        }
      }
      if (!room.participants.size || this.now() - room.lastActivityAtMs >= ROOM_IDLE_MS) {
        this.rooms.delete(room.roomId);
        this.codes.delete(room.code);
        closed.push(room.roomId);
      } else if (changed) {
        if (!room.participants.has(room.hostUserId)) room.hostUserId = room.participants.keys().next().value!;
        this.touch(room);
        updated.push(room);
      }
    }
    return { updated, closed };
  }

  private touch(room: LobbyRoom) {
    room.version += 1;
    room.lastActivityAtMs = this.now();
  }

  view(room: LobbyRoom): RoomView {
    const participants = [...room.participants.values()];
    return {
      roomId: room.roomId, code: room.code, caseId: room.caseId, title: CASE_TITLE,
      mode: "PRIVATE", phase: room.phase, round: 0, version: room.version,
      serverNow: new Date(this.now()).toISOString(), deadlineAt: null,
      botPolicy: room.botPolicy,
      botFillConsented: room.botPolicy === "allow_bots" && participants.every((p) => p.ready && p.acceptBotFill && p.acceptedIdentityHiddenDisclosure),
      aiPresenceDisclosure: room.botPolicy === "none" ? "HUMANS_ONLY" : "MAY_INCLUDE_AI",
      participants: participants.map((p) => ({
        participantId: p.participantId, nickname: p.nickname, avatarId: p.avatarId,
        connected: p.socketIds.size > 0, ready: p.ready, personaId: null,
        isHost: p.userId === room.hostUserId,
      })),
      locked: room.locked, publicClues: [], publicEvents: [], accusationMarkers: [],
      causeOptions: [], resolutionOptions: [],
    };
  }

  self(session: GuestSession, roomId: string): SelfView {
    const { participant } = this.member(session, roomId);
    return {
      participantId: participant.participantId, personaId: null, startingMemory: null,
      midgameMemory: null, mission: null, ability: null, myEvidence: [], myMemoryFragments: [],
      selectedAction: null, actionLocked: false, myBallot: null,
    };
  }
}
