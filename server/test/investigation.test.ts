import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { initializeCase, loadCasePack } from "../src/case";
import { Investigation } from "../src/investigation";
import type { ActionSelection } from "@wahala/shared";

function fixture() {
  let clock = 1_800_000_000_000;
  const pack = loadCasePack();
  const ids = Array.from({ length: 5 }, () => randomUUID());
  const match = initializeCase(pack, ids, Buffer.alloc(32, 11));
  const seats = ids.map(participantId => ({ participantId, personaId: Object.entries(match.canonical.personaToParticipant).find(([, id]) => id === participantId)![0], roleAcknowledged: false, socketIds: new Set([participantId]) }));
  const game = new Investigation(randomUUID(), match, seats, pack.settings.seconds, () => clock, () => 1, pack);
  const id = (persona: string) => seats.find(s => s.personaId === persona)!.participantId;
  const advance = (ms: number) => { clock += ms; game.tick(); };
  const begin = () => { for (const s of seats) s.roleAcknowledged = true; game.acknowledge(); game.drain(); };
  const select = (persona: string, action: ActionSelection) => game.submit(id(persona), game.round, action);
  return { game, pack, match, seats, id, begin, advance, select, now: () => clock };
}

describe("server-owned investigation", () => {
  it("uses the exact 45-second role deadline and catches up without client advancement", () => {
    const f = fixture(); f.advance(44_999); expect(f.game.phase).toBe("ROLES");
    f.advance(1); expect(f.game.phase).toBe("INVESTIGATION_1"); expect(f.game.deadline).toBe(f.now() + 120_000);
    f.advance(120_000); expect(f.game.phase).toBe("TWIST");
    expect(f.game.publicView().publicClues.map(c => c.id)).toContain("joke_receipt");
    f.advance(30_000); expect(f.game.phase).toBe("INVESTIGATION_2");
    const deliveries = f.game.drain().filter(d => d.event === "role:memory");
    expect(deliveries).toHaveLength(5); expect(new Set(deliveries.map(d => d.owner)).size).toBe(5);
    f.advance(120_000); expect(f.game.phase).toBe("INVESTIGATION_3");
    f.advance(120_000); expect(f.game.phase).toBe("VOTING"); expect(f.game.deadline).toBe(f.now() + 45_000);
    f.advance(999_999); expect(f.game.phase).toBe("REVEAL");
    expect(f.game.ledger.filter(e => e.kind === "ROUND_SETTLED")).toHaveLength(3);
  });
  it("advances early only when every role is acknowledged", () => {
    const f = fixture(); f.seats.slice(0, 4).forEach(s => s.roleAcknowledged = true); f.game.acknowledge(); expect(f.game.phase).toBe("ROLES");
    f.seats[4].roleAcknowledged = true; f.game.acknowledge(); expect(f.game.phase).toBe("INVESTIGATION_1");
    f.game.acknowledge(); expect(f.game.round).toBe(1);
  });
  it("locks the last legal choice and prevents same-round evidence exposure", () => {
    const f = fixture(); f.begin();
    f.select("tobi", { kind: "TRACE_SELF" }); f.select("tobi", { kind: "INVESTIGATE", leadId: "delivery_log" });
    expect(() => f.select("tobi", { kind: "EXPOSE", evidenceId: "delivery_receipt" })).toThrow("start of this round");
    expect(f.game.self(f.id("tobi")).selectedAction).toEqual({ kind: "INVESTIGATE", leadId: "delivery_log" });
    f.advance(120_000); expect(f.game.self(f.id("tobi")).myEvidence?.map(c => c.id)).toContain("delivery_receipt");
    expect(f.game.self(f.id("tobi")).myMemoryFragments).toEqual([]);
    expect(() => f.select("tobi", { kind: "PASS" })).toThrow("current investigation");
    f.advance(30_000); f.select("tobi", { kind: "EXPOSE", evidenceId: "delivery_receipt" }); f.advance(120_000);
    expect(f.game.publicView().publicClues.map(c => c.id)).toContain("delivery_receipt");
  });
  it("keeps private clues, traces and ability results owner-only", () => {
    const f = fixture(); f.begin();
    f.select("ada", { kind: "ABILITY", abilityId: "a_ada" });
    f.select("zainab", { kind: "INVESTIGATE", leadId: "delivery_log" });
    f.select("tobi", { kind: "ABILITY", abilityId: "a_tobi", targetParticipantId: f.id("zainab") });
    f.select("emeka", { kind: "TRACE_SELF" }); f.advance(120_000);
    const deliveries = f.game.drain();
    expect(deliveries.filter(d => d.event === "evidence:private").every(d => Boolean(d.owner))).toBe(true);
    const peek = deliveries.find(d => d.event === "action:resolved" && d.owner === f.id("tobi"));
    expect(peek?.payload).toMatchObject({ text: expect.stringContaining("delivery"), grantedEvidenceIds: [] });
    const publicJSON = JSON.stringify([f.game.publicView(), deliveries.filter(d => !d.owner)]);
    for (const id of ["backup_match", "delivery_receipt", "emeka_trace"]) expect(publicJSON).not.toContain(id);
    for (const card of f.match.variant.roleCards) expect(publicJSON).not.toContain(card.startingMemory);
    expect(JSON.stringify(peek)).not.toContain(f.match.variant.evidence.find(e => e.id === "delivery_receipt")!.body);
    f.advance(30_000); expect(() => f.select("ada", { kind: "ABILITY", abilityId: "a_ada" })).toThrow("already been used");
  });
  it("does not consume an ability until resolution and rejects another persona's ability", () => {
    const f = fixture(); f.begin();
    expect(() => f.select("ada", { kind: "ABILITY", abilityId: "a_emeka" })).toThrow("own ability");
    expect(() => f.select("tobi", { kind: "ABILITY", abilityId: "a_tobi", targetParticipantId: f.id("tobi") })).toThrow("another participant");
    f.select("ada", { kind: "ABILITY", abilityId: "a_ada" }); f.select("ada", { kind: "PASS" }); f.advance(120_000); f.advance(30_000);
    expect(f.game.self(f.id("ada")).ability?.used).toBe(false);
    f.select("ada", { kind: "ABILITY", abilityId: "a_ada" });
  });
  it("delays only Feyi's optional twist clue until the end of round two", () => {
    const f = fixture(); f.begin(); f.select("feyi", { kind: "ABILITY", abilityId: "a_feyi" });
    f.select("ada", { kind: "INVESTIGATE", leadId: "archive_audit" }); f.advance(120_000);
    expect(f.game.publicEvidence.has("joke_receipt")).toBe(false);
    const twist = f.game.drain().find(d => d.event === "game:twist"); expect(twist?.payload).toMatchObject({ publicClues: [] });
    expect(JSON.stringify(twist)).not.toContain("Feyi");
    f.advance(30_000); expect(() => f.select("feyi", { kind: "ABILITY", abilityId: "a_feyi" })).toThrow("already been used");
    f.advance(120_000); expect(f.game.publicEvidence.has("joke_receipt")).toBe(true);
    const g = fixture(); g.begin(); g.advance(150_000); expect(() => g.select("feyi", { kind: "ABILITY", abilityId: "a_feyi" })).toThrow("round one");
  });
  it("authorizes settlement answers, marks accusations and accepts defense next round", () => {
    const f = fixture(); f.begin(); f.select("ada", { kind: "CONFRONT", targetParticipantId: f.id("tobi"), question: "What did you send?" }); f.advance(120_000);
    expect(f.game.phase).toBe("SETTLING_1"); const c = [...f.game.challenges.values()][0];
    expect(f.game.pending(f.id("tobi")).filter(d => d.event === "action:respond_requested")).toHaveLength(1); expect(f.game.pending(f.id("feyi")).filter(d => d.event === "action:respond_requested")).toHaveLength(0);
    expect(() => f.game.respond(f.id("feyi"), c.id, "REFUSE")).toThrow("addressed participant");
    expect(() => f.game.respond(f.id("tobi"), c.id, "ANSWER")).toThrow("Write an answer");
    f.game.respond(f.id("tobi"), c.id, "ANSWER", "I remember sending a flyer."); expect(f.game.phase).toBe("TWIST");
    f.advance(30_000); f.select("feyi", { kind: "DEFEND", targetParticipantId: f.id("tobi"), accusationId: c.id, explanation: "We should check the attachment first." }); f.advance(120_000);
    expect(f.game.accusations[0].status).toBe("contested"); expect(f.game.publicEvidence.has("public_time")).toBe(true);
  });
  it("exchanges copies atomically from frozen inventories and never leaks deal receipts", () => {
    const f = fixture(); f.begin();
    expect(() => f.select("ada", { kind: "MAKE_DEAL", targetParticipantId: f.id("tobi"), offerEvidenceId: "ada_note", requestEvidenceId: "delivery_receipt" })).toThrow("start of this round");
    f.select("ada", { kind: "MAKE_DEAL", targetParticipantId: f.id("emeka"), offerEvidenceId: "ada_note", requestEvidenceId: "file_label_receipt" }); f.advance(120_000);
    const d = [...f.game.deals.values()][0];
    expect(f.game.pending(f.id("emeka")).filter(d => d.event === "deal:offered")).toHaveLength(1);
    expect(() => f.game.deal(f.id("tobi"), d.id, true)).toThrow("addressed participant");
    f.game.deal(f.id("emeka"), d.id, true);
    expect(f.game.players.get(f.id("ada"))!.evidence.has("file_label_receipt")).toBe(true);
    expect(f.game.players.get(f.id("emeka"))!.evidence.has("ada_note")).toBe(true);
    expect(f.game.players.get(f.id("ada"))!.evidence.has("ada_note")).toBe(true);
    const grants = f.game.drain().filter(d => d.event === "evidence:private"); expect(grants).toHaveLength(2); expect(grants.every(d => d.owner)).toBe(true);
    expect(() => f.game.deal(f.id("emeka"), d.id, true)).toThrow("settlement");
  });
  it("defaults disconnected players to PASS without changing their seats or roles", () => {
    const f = fixture(); f.begin(); f.select("ada", { kind: "ABILITY", abilityId: "a_ada" });
    f.seats.find(s => s.participantId === f.id("ada"))!.socketIds.clear(); f.advance(120_000);
    expect(f.game.self(f.id("ada")).selectedAction).toEqual({ kind: "PASS" });
    expect(f.game.self(f.id("ada")).ability?.used).toBe(false); expect(f.seats).toHaveLength(5);
  });
  it("abandons only after fewer than two live humans remain for more than 120 seconds", () => {
    const f = fixture(); f.begin(); f.seats.slice(1).forEach(s => s.socketIds.clear()); f.game.tick();
    f.advance(120_000); expect(f.game.phase).not.toBe("ABANDONED");
    f.advance(1); expect(f.game.phase).toBe("ABANDONED"); expect(f.game.deadline).toBeNull();
    const g = fixture(); g.begin(); g.seats.slice(1).forEach(s => s.socketIds.clear()); g.game.tick(); g.advance(60_000);
    g.seats[1].socketIds.add(randomUUID()); g.game.tick(); g.advance(70_000); expect(g.game.phase).not.toBe("ABANDONED");
  });
  it("expires missing replies after 20 seconds and does not issue already-expired requests", () => {
    const f = fixture(); f.begin(); f.select("ada", { kind: "CONFRONT", targetParticipantId: f.id("tobi"), question: "Why?" }); f.advance(139_999); expect(f.game.phase).toBe("SETTLING_1");
    f.advance(1); expect(f.game.phase).toBe("TWIST"); expect(f.game.drain().filter(d => d.event === "action:resolved").some(d => d.payload.status === "EXPIRED")).toBe(true);
    const g = fixture(); g.begin(); g.select("ada", { kind: "CONFRONT", targetParticipantId: g.id("tobi"), question: "Why?" }); g.advance(140_000);
    expect(g.game.drain().filter(d => d.event === "action:respond_requested")).toHaveLength(0);
  });
});
