import { createHash, randomUUID } from "node:crypto";
import type { ActionSelection, ChatMessage, Phase, PublicGameEvent, RoomView, SelfView, ServerToClientEvents } from "@wahala/shared";
import { clueView, type CaseInitialization } from "./case";
import { CommandError } from "./errors";

type Payload<E extends keyof ServerToClientEvents> = Parameters<ServerToClientEvents[E]>[0];
type PrivateEvent = "state:snapshot" | "role:assign" | "role:memory" | "evidence:private" | "action:respond_requested" | "deal:offered" | "action:resolved";
export type Delivery = { [E in keyof ServerToClientEvents]: { event: E; payload: Payload<E> } & (E extends PrivateEvent ? { owner: string } : { owner?: never }) }[keyof ServerToClientEvents];
type Seat = { participantId: string; personaId: string | null; roleAcknowledged: boolean; socketIds: Set<string> };
type Player = { evidence: Set<string>; memory: Set<string>; start: Set<string>; selected: ActionSelection | null; used: boolean; midgame: boolean };
type Challenge = { id: string; from: string; to: string; question: string; done: boolean };
type Deal = { id: string; from: string; to: string; offered: string; requested: string; done: boolean };

/** One synchronous processor per room. No awaits between authorization and mutation. */
export class Investigation {
  phase: Phase = "ROLES";
  round: 0 | 1 | 2 | 3 = 0;
  deadline: number | null;
  readonly players = new Map<string, Player>();
  readonly publicEvidence = new Set<string>();
  readonly events: PublicGameEvent[] = [];
  readonly chat: ChatMessage[] = [];
  readonly accusations: RoomView["accusationMarkers"] = [];
  readonly challenges = new Map<string, Challenge>();
  readonly deals = new Map<string, Deal>();
  private delayed = new Set<string>();
  private deliveries: Delivery[] = [];
  private receipts: Delivery[] = [];
  stateHash = "";
  private belowMinimumSince: number | null = null;
  // Server-internal ordered audit trail; never projected into public payloads.
  readonly ledger: { sequence: number; at: number; kind: string; actor?: string; data: unknown; hash: string }[] = [];

  constructor(readonly roomId: string, readonly match: CaseInitialization, readonly seats: Seat[],
    private readonly seconds: { roles: number; round: number; response: number; twist: number },
    private readonly now: () => number, private readonly changed: (phase: Phase, phaseChanged: boolean) => number) {
    this.deadline = now() + seconds.roles * 1000;
    for (const seat of seats) {
      const card = this.card(seat.participantId);
      this.players.set(seat.participantId, { evidence: new Set(card.startingEvidenceIds), memory: new Set(), start: new Set(), selected: null, used: false, midgame: false });
    }
    for (const clue of match.variant.evidence) if (clue.release === "public_start") this.publicEvidence.add(clue.id);
    this.record("ROLES", null, { deadline: this.deadline });
  }
  private card(id: string) { return this.match.variant.roleCards.find(c => c.personaId === this.seats.find(s => s.participantId === id)?.personaId)!; }
  private definition(id: string) { return this.match.variant.evidence.find(e => e.id === id)!; }
  private record(kind: string, actor: string | null, data: unknown) {
    const entry = { sequence: this.ledger.length + 1, at: this.now(), kind, ...(actor ? { actor } : {}), data: structuredClone(data) };
    this.stateHash = createHash("sha256").update(this.stateHash + JSON.stringify(entry)).digest("hex");
    this.ledger.push({ ...entry, hash: this.stateHash });
  }
  private send<E extends keyof ServerToClientEvents>(event: E, payload: Payload<E>, ...routing: E extends PrivateEvent ? [owner: string] : []) {
    const [owner] = routing;
    this.deliveries.push({ event, payload, ...(owner ? { owner } : {}) } as Delivery);
  }
  drain() { const result = this.deliveries; this.deliveries = []; return result; }
  private event(kind: string, text: string, actor?: string) {
    const event: PublicGameEvent = { id: randomUUID(), sequence: this.events.length + 1, kind, text, createdAt: new Date(this.now()).toISOString(), ...(actor ? { fromParticipantId: actor } : {}) };
    this.events.push(event);
    this.send("game:event", { roomId: this.roomId, event });
    return event.id;
  }
  private transition(phase: Phase, at: number, seconds: number | null) {
    this.phase = phase; this.deadline = seconds === null ? null : at + seconds * 1000;
    this.record("PHASE", null, { phase, round: this.round, deadline: this.deadline });
    const version = this.changed(phase, true);
    this.send("game:phase", { roomId: this.roomId, phase, round: this.round, version, deadlineAt: this.deadline === null ? null : new Date(this.deadline).toISOString(), serverNow: new Date(this.now()).toISOString() });
  }
  private beginRound(round: 1 | 2 | 3, at: number) {
    this.round = round;
    for (const seat of this.seats) {
      const player = this.players.get(seat.participantId)!;
      player.start = new Set([...player.evidence, ...player.memory]); player.selected = null;
      if (round === 2 && !player.midgame) {
        player.midgame = true;
        this.send("role:memory", { roomId: this.roomId, midgameMemory: this.card(seat.participantId).midgameMemory }, seat.participantId);
      }
    }
    this.transition(`INVESTIGATION_${round}`, at, this.seconds.round);
    this.event("ROUND", round === 1 ? this.match.variant.publicIntro : `Investigation round ${round} has begun.`);
  }
  acknowledge() { if (this.phase === "ROLES" && this.seats.every(s => s.roleAcknowledged)) this.beginRound(1, this.now()); }
  tick() {
    if (this.phase === "ABANDONED") return;
    if (this.seats.filter(s => s.socketIds.size > 0).length < 2) {
      this.belowMinimumSince ??= this.now();
      if (this.now() - this.belowMinimumSince > 120_000) {
        this.transition("ABANDONED", this.now(), null); this.event("ABANDONED", "The case ended after fewer than two players remained connected for two minutes."); return;
      }
    } else this.belowMinimumSince = null;
    // Catch up deterministically against recorded deadlines, not timer callback drift.
    while (this.deadline !== null && this.now() >= this.deadline) {
      const at = this.deadline;
      if (this.phase === "ROLES") this.beginRound(1, at);
      else if (this.phase.startsWith("INVESTIGATION_")) this.settle(at);
      else if (this.phase.startsWith("SETTLING_")) this.finishSettlement(at);
      else if (this.phase === "TWIST") this.beginRound(2, at);
      else break;
    }
  }
  private target(actor: string, target: string, allowSelf = false) {
    if (!this.players.has(target) || (!allowSelf && target === actor)) throw new CommandError("INVALID_TARGET", "Choose another participant in this case.");
  }
  submit(actor: string, round: number, action: ActionSelection) {
    if (this.phase !== `INVESTIGATION_${round}` || this.round !== round) throw new CommandError("WRONG_PHASE", "Actions are only selected during the current investigation round.");
    if (this.deadline === null || this.now() >= this.deadline) throw new CommandError("DEADLINE_PASSED", "The action cutoff has passed.");
    const player = this.players.get(actor)!;
    if (action.kind === "INVESTIGATE" && !this.match.variant.investigationLeads.some(l => l.id === action.leadId)) throw new CommandError("INVALID_ACTION", "Choose an available investigation lead.");
    if (action.kind === "CONFRONT" || action.kind === "MAKE_DEAL") this.target(actor, action.targetParticipantId);
    if (action.kind === "EXPOSE" && !player.start.has(action.evidenceId)) throw new CommandError("EVIDENCE_NOT_OWNED", "You must have owned that receipt at the start of this round.");
    if (action.kind === "MAKE_DEAL" && (!player.start.has(action.offerEvidenceId) || !this.players.get(action.targetParticipantId)!.start.has(action.requestEvidenceId))) throw new CommandError("EVIDENCE_NOT_OWNED", "Both receipts must have been held by their owners at the start of this round.");
    if (action.kind === "DEFEND") {
      this.target(actor, action.targetParticipantId, true);
      if (!this.accusations.some(a => a.id === action.accusationId && a.targetParticipantId === action.targetParticipantId)) throw new CommandError("INVALID_TARGET", "Choose an existing accusation against that participant.");
    }
    if (action.kind === "ABILITY") {
      if (player.used) throw new CommandError("ALREADY_USED", "Your ability has already been used.");
      const ability = this.match.variant.abilities.find(a => a.id === this.card(actor).abilityId)!;
      if (action.abilityId !== ability.id) throw new CommandError("FORBIDDEN", "You can only use your own ability.");
      if (ability.effect.kind === "peek_investigation_lead") {
        if (!action.targetParticipantId) throw new CommandError("INVALID_TARGET", "Select a participant to observe.");
        this.target(actor, action.targetParticipantId);
      } else if (action.targetParticipantId) throw new CommandError("INVALID_TARGET", "This ability does not take a target.");
      if (ability.effect.kind === "delay_optional_clue" && round !== 1) throw new CommandError("INVALID_ACTION", "This optional clue can only be delayed in round one.");
    }
    player.selected = structuredClone(action);
    this.record("ACTION_SELECTED", actor, { round, action }); this.changed(this.phase, false);
    return { accepted: true as const, selectedAction: structuredClone(action) };
  }
  private grant(actor: string, id: string, source: "INVESTIGATE" | "TRACE_SELF" | "ABILITY" | "DEAL") {
    const player = this.players.get(actor)!;
    const evidence = this.definition(id);
    const inventory = evidence.kind === "memory_fragment" ? player.memory : player.evidence;
    if (inventory.has(id)) return false;
    inventory.add(id); this.record("EVIDENCE_GRANTED", actor, { id, source });
    this.send("evidence:private", { roomId: this.roomId, evidence: clueView(evidence), source }, actor);
    return true;
  }
  private publish(id: string, actor: string | null) {
    if (this.publicEvidence.has(id)) return;
    this.publicEvidence.add(id); this.record("EVIDENCE_PUBLIC", actor, { id });
    this.send("evidence:public", { roomId: this.roomId, evidence: clueView(this.definition(id)), byParticipantId: actor });
  }
  private resolved(actor: string, text: string, grantedEvidenceIds: string[] = [], status: "DONE" | "FAILED" | "EXPIRED" = "DONE") {
    const payload = { roomId: this.roomId, round: this.round as 1 | 2 | 3, eventId: randomUUID(), status, text, grantedEvidenceIds };
    this.send("action:resolved", payload, actor);
    this.receipts.push({ event: "action:resolved", payload, owner: actor });
    this.record("ACTION_RESOLVED", actor, { round: this.round, status, text, grantedEvidenceIds });
  }
  private settle(at: number) {
    this.challenges.clear(); this.deals.clear();
    this.transition(`SETTLING_${this.round as 1 | 2 | 3}`, at, this.seconds.response);
    const ordered = this.seats.map(s => ({ actor: s.participantId, action: (s.socketIds.size ? this.players.get(s.participantId)!.selected : null) ?? { kind: "PASS" } as ActionSelection }));
    for (const { actor, action } of ordered) this.players.get(actor)!.selected = action;
    for (const { actor, action } of ordered) {
      const player = this.players.get(actor)!;
      const ids = action.kind === "TRACE_SELF" ? this.card(actor).traceEvidenceIds : action.kind === "INVESTIGATE" ? this.match.variant.investigationLeads.find(l => l.id === action.leadId)!.evidenceIds : null;
      if (ids) {
        const next = ids.find(id => !player.evidence.has(id) && !player.memory.has(id));
        if (next) { this.grant(actor, next, action.kind as "TRACE_SELF" | "INVESTIGATE"); this.resolved(actor, "A verified receipt was added to your private dossier.", [next]); }
        else this.resolved(actor, "There are no further receipts on this lead.", [], "FAILED");
      }
    }
    for (const { actor, action } of ordered) if (action.kind === "ABILITY") {
      const player = this.players.get(actor)!;
      const effect = this.match.variant.abilities.find(a => a.id === action.abilityId)!.effect;
      player.used = true;
      if (effect.kind === "grant_evidence") { this.grant(actor, effect.evidenceId, "ABILITY"); this.resolved(actor, "Your one-use ability delivered a verified receipt.", [effect.evidenceId]); }
      if (effect.kind === "peek_investigation_lead") {
        const selected = this.players.get(action.targetParticipantId!)!.selected;
        const lead = selected?.kind === "INVESTIGATE" ? this.match.variant.investigationLeads.find(l => l.id === selected.leadId) : null;
        this.resolved(actor, lead ? `The participant investigated: ${lead.label}. Their result remains private.` : "The participant did not investigate a lead this round.");
      }
      if (effect.kind === "delay_optional_clue") { this.delayed.add(effect.evidenceId); this.resolved(actor, "The optional clue is delayed until the end of round two."); }
    }
    for (const { actor, action } of ordered) if (action.kind === "EXPOSE") {
      this.publish(action.evidenceId, actor); this.event("EXPOSE", `Published verified receipt: ${this.definition(action.evidenceId).title}.`, actor); this.resolved(actor, "Your verified receipt is now public.");
    }
    for (const { actor, action } of ordered) {
      if (action.kind === "CONFRONT") {
        const id = randomUUID();
        this.accusations.push({ id, byParticipantId: actor, targetParticipantId: action.targetParticipantId, status: "open" });
        this.event("CONFRONT", action.question, actor);
        this.challenges.set(id, { id, from: actor, to: action.targetParticipantId, question: action.question, done: false });
      }
      if (action.kind === "DEFEND") {
        this.accusations.find(a => a.id === action.accusationId)!.status = "contested";
        this.event("DEFEND", action.explanation, actor); this.resolved(actor, "The accusation is contested. Verified evidence is unchanged.");
      }
      if (action.kind === "PASS") this.resolved(actor, "No action this round.");
    }
    for (const { actor, action } of ordered) if (action.kind === "MAKE_DEAL") {
      const id = randomUUID();
      this.deals.set(id, { id, from: actor, to: action.targetParticipantId, offered: action.offerEvidenceId, requested: action.requestEvidenceId, done: false });
    }
    // A delayed scheduler cannot issue reply requests after the recorded cutoff.
    if (this.now() < this.deadline!) {
      for (const c of this.challenges.values()) this.send("action:respond_requested", { roomId: this.roomId, challengeId: c.id, fromParticipantId: c.from, question: c.question, deadlineAt: new Date(this.deadline!).toISOString() }, c.to);
      for (const d of this.deals.values()) this.send("deal:offered", { roomId: this.roomId, offerId: d.id, fromParticipantId: d.from, offeredEvidenceId: d.offered, requestedEvidenceId: d.requested, deadlineAt: new Date(this.deadline!).toISOString() }, d.to);
    }
    if (!this.challenges.size && !this.deals.size) this.finishSettlement(at);
  }
  private checkResponse(actor: string, item: Challenge | Deal | undefined) {
    if (!this.phase.startsWith("SETTLING_")) throw new CommandError("WRONG_PHASE", "Responses are only accepted during settlement.");
    if (this.deadline === null || this.now() >= this.deadline) throw new CommandError("DEADLINE_PASSED", "The response deadline has passed.");
    if (!item || item.done) throw new CommandError("NO_OPEN_RESPONSE", "This request is no longer open.");
    if (item.to !== actor) throw new CommandError("FORBIDDEN", "Only the addressed participant can respond.");
  }
  respond(actor: string, id: string, response: "ANSWER" | "REFUSE", text?: string) {
    const challenge = this.challenges.get(id);
    this.checkResponse(actor, challenge);
    if (response === "ANSWER" && !text?.trim()) throw new CommandError("BAD_PAYLOAD", "Write an answer or choose refuse.");
    challenge!.done = true;
    this.record("CHALLENGE_RESPONSE", actor, { id, response, text });
    this.event(response, response === "ANSWER" ? text! : "Declined to answer the challenge.", actor);
    this.resolved(challenge!.from, response === "ANSWER" ? "Your challenge received an answer." : "Your challenge was refused.");
    this.afterResponse(); return { recorded: true as const };
  }
  deal(actor: string, id: string, accept: boolean) {
    const deal = this.deals.get(id); this.checkResponse(actor, deal);
    const d = deal!; d.done = true;
    if (accept) {
      // Copy exchange is atomic; no await and no cascading ownership checks.
      this.grant(d.to, d.offered, "DEAL"); this.grant(d.from, d.requested, "DEAL");
      this.record("DEAL_ACCEPTED", actor, { id });
      this.resolved(d.from, "The deal was accepted; verified copies were exchanged.", [d.requested]);
    } else { this.record("DEAL_REFUSED", actor, { id }); this.resolved(d.from, "The deal was refused.", [], "FAILED"); }
    this.afterResponse(); return { recorded: true as const };
  }
  private afterResponse() {
    this.changed(this.phase, false);
    if ([...this.challenges.values(), ...this.deals.values()].every(r => r.done)) this.finishSettlement(this.now());
  }
  private finishSettlement(at: number) {
    for (const c of this.challenges.values()) if (!c.done) { c.done = true; this.event("REFUSE", "The challenge expired without an answer.", c.to); this.resolved(c.from, "The response window expired.", [], "EXPIRED"); }
    for (const d of this.deals.values()) if (!d.done) { d.done = true; this.resolved(d.from, "The deal expired without acceptance.", [], "EXPIRED"); }
    this.record("ROUND_SETTLED", null, { round: this.round, inventories: [...this.players].map(([id, p]) => ({ id, evidence: [...p.evidence], memory: [...p.memory] })) });
    if (this.round === 1) {
      this.transition("TWIST", at, this.seconds.twist);
      for (const id of this.match.variant.twist.publicEvidenceIds) if (!this.delayed.has(id)) this.publish(id, null);
      const clues = this.match.variant.twist.publicEvidenceIds.filter(id => this.publicEvidence.has(id)).map(id => clueView(this.definition(id)));
      // Do not leak the delayed clue via the headline.
      const headline = clues.length ? this.match.variant.twist.headline : "An optional clue has been delayed until the end of round two.";
      this.event("TWIST", headline); this.send("game:twist", { roomId: this.roomId, headline, publicClues: clues });
    } else if (this.round === 2) {
      for (const id of this.delayed) this.publish(id, null);
      if (this.delayed.size) this.event("TWIST", this.match.variant.twist.headline);
      this.delayed.clear(); this.beginRound(3, at);
    } else {
      // Voting belongs to the next sprint. This is a deliberate server-side pause.
      this.transition("SETTLING_3", at, null); this.event("INVESTIGATION_COMPLETE", "Investigation complete. Voting will be available in the next build.");
    }
  }
  sendChat(actor: string, channel: ChatMessage["channel"], text: string) {
    if (channel !== "GAME" || this.phase === "ROLES" || this.phase === "ABANDONED") throw new CommandError("WRONG_PHASE", "Game statements are available during investigation.");
    const message: ChatMessage = { id: randomUUID(), roomId: this.roomId, channel, fromParticipantId: actor, text, createdAt: new Date(this.now()).toISOString() };
    this.chat.push(message); if (this.chat.length > 100) this.chat.shift();
    this.record("CHAT", actor, message); this.send("chat:message", { roomId: this.roomId, message }); this.changed(this.phase, false);
    return { messageId: message.id };
  }
  self(actor: string): Partial<SelfView> {
    const p = this.players.get(actor)!; const card = this.card(actor);
    const ability = this.match.variant.abilities.find(a => a.id === card.abilityId)!;
    return { midgameMemory: p.midgame ? card.midgameMemory : null, ability: { id: ability.id, description: ability.description, used: p.used },
      myEvidence: [...p.evidence].map(id => clueView(this.definition(id))), myMemoryFragments: [...p.memory].map(id => clueView(this.definition(id))),
      selectedAction: p.selected, actionLocked: !this.phase.startsWith("INVESTIGATION_") };
  }
  publicView() {
    return { phase: this.phase, round: this.round, deadlineAt: this.deadline === null ? null : new Date(this.deadline).toISOString(),
      publicClues: [...this.publicEvidence].map(id => clueView(this.definition(id))), publicEvents: this.events.slice(-100), accusationMarkers: this.accusations.map(a => ({ ...a })) };
  }
  pending(actor: string): Delivery[] {
    const receipts = this.receipts.filter(r => r.owner === actor);
    if (!this.phase.startsWith("SETTLING_") || this.deadline === null || this.now() >= this.deadline) return receipts;
    const deadlineAt = new Date(this.deadline).toISOString();
    return [
      ...receipts,
      ...[...this.challenges.values()].filter(c => c.to === actor && !c.done).map(c => ({ event: "action:respond_requested" as const, owner: actor, payload: { roomId: this.roomId, challengeId: c.id, fromParticipantId: c.from, question: c.question, deadlineAt } })),
      ...[...this.deals.values()].filter(d => d.to === actor && !d.done).map(d => ({ event: "deal:offered" as const, owner: actor, payload: { roomId: this.roomId, offerId: d.id, fromParticipantId: d.from, offeredEvidenceId: d.offered, requestedEvidenceId: d.requested, deadlineAt } })),
    ];
  }
}
