import { randomUUID, timingSafeEqual } from "node:crypto";
import type { LoungeMember, LoungeMessage, LoungeSnapshot } from "@wahala/shared";
import type { GuestSession } from "./sessions";
import { CommandError } from "./errors";

type Member = LoungeMember & { userId: string; sockets: Set<string>; blocked: Set<string>; admittedUntil: number };
export class Lounge {
  readonly members = new Map<string, Member>();
  readonly messages: LoungeMessage[] = [];
  readonly reports: { reportId: string; byMemberId: string; category: string; message: LoungeMessage; createdAt: string }[] = [];
  constructor(readonly enabled: boolean, readonly accessCode: string | undefined, private readonly now: () => number) {}
  join(session: GuestSession, socketId: string, profile: { nickname: string; avatarId: string; accessCode?: string }) {
    if (!this.enabled) throw new CommandError("FORBIDDEN", "The Gist Lounge is currently closed.");
    if (session.roomId) throw new CommandError("ROOM_LOCKED", "Leave your private room before joining the lounge.");
    let member = this.members.get(session.userId);
    if (!member && this.accessCode) {
      const expected = Buffer.from(this.accessCode); const supplied = Buffer.from(profile.accessCode ?? "");
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new CommandError("FORBIDDEN", "A closed-alpha access code is required.");
    }
    if (!member) { member = { memberId: randomUUID(), userId: session.userId, nickname: profile.nickname, avatarId: profile.avatarId, sockets: new Set(), blocked: new Set(), admittedUntil: session.expiresAtMs }; this.members.set(session.userId, member); }
    member.sockets.add(socketId); return member;
  }
  member(session: GuestSession, socketId: string) {
    const member = this.members.get(session.userId);
    if (!this.enabled || !member?.sockets.has(socketId)) throw new CommandError("FORBIDDEN", "Join the lounge first.");
    return member;
  }
  attach(session: GuestSession, socketId: string) { const m = this.members.get(session.userId); if (m && !session.roomId) m.sockets.add(socketId); return m && !session.roomId ? m : null; }
  disconnect(userId: string, socketId: string) { this.members.get(userId)?.sockets.delete(socketId); }
  leave(userId: string) { this.members.delete(userId); }
  presence(): LoungeMember[] { return [...this.members.values()].filter(m => m.sockets.size).map(({ memberId, nickname, avatarId }) => ({ memberId, nickname, avatarId })); }
  canSee(userId: string, message: LoungeMessage) { return !this.members.get(userId)?.blocked.has(message.fromMemberId); }
  snapshot(userId: string): LoungeSnapshot {
    const m = this.members.get(userId)!;
    return { selfMemberId: m.memberId, members: this.presence(), messages: this.messages.filter(message => this.canSee(userId, message)), blockedMemberIds: [...m.blocked] };
  }
  send(session: GuestSession, socketId: string, text: string) {
    const m = this.member(session, socketId);
    const message: LoungeMessage = { id: randomUUID(), fromMemberId: m.memberId, nickname: m.nickname, text, createdAt: new Date(this.now()).toISOString() };
    this.messages.push(message); if (this.messages.length > 100) this.messages.shift(); return message;
  }
  block(session: GuestSession, socketId: string, target: string, blocked: boolean) {
    const m = this.member(session, socketId);
    if (target === m.memberId || !m.blocked.has(target) && !this.messages.some(msg => msg.fromMemberId === target) && !this.presence().some(p => p.memberId === target)) throw new CommandError("INVALID_TARGET", "Choose a lounge participant.");
    if (blocked) m.blocked.add(target); else m.blocked.delete(target);
    return { blocked };
  }
  report(session: GuestSession, socketId: string, messageId: string, category: string) {
    const m = this.member(session, socketId); const message = this.messages.find(msg => msg.id === messageId);
    if (!message) throw new CommandError("INVALID_TARGET", "That message is no longer in the lounge history.");
    if (this.reports.length >= 1000) throw new CommandError("RATE_LIMITED", "The report queue is full. Please contact the alpha host.");
    const reportId = randomUUID(); this.reports.push({ reportId, byMemberId: m.memberId, category, message: { ...message }, createdAt: new Date(this.now()).toISOString() }); return { reportId };
  }
  cleanup() { for (const [userId, m] of this.members) if (m.admittedUntil <= this.now()) this.members.delete(userId); }
}
