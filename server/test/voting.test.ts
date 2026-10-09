import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Ballot } from "@wahala/shared";
import { initializeCase, loadCasePack } from "../src/case";
import { Investigation } from "../src/investigation";
import { majority, missionSucceeded, scoreCase, type ScoringState } from "../src/scoring";

function fixture() {
  let clock = 1_800_000_000_000;
  let version = 1;
  const pack = loadCasePack();
  const ids = Array.from({ length: 5 }, () => randomUUID());
  const match = initializeCase(pack, ids, Buffer.alloc(32, 21));
  const mapping = match.canonical.personaToParticipant;
  const seats = ids.map(participantId => ({ participantId, personaId: Object.keys(mapping).find(persona => mapping[persona] === participantId)!, roleAcknowledged: true, socketIds: new Set([participantId]) }));
  const game = new Investigation(randomUUID(), match, seats, pack.settings.seconds, () => clock, () => ++version, pack);
  const correct: Ballot = { causeId: match.canonical.truth.causeId, principalActorParticipantId: mapping[match.canonical.truth.principalActorPersonaId], resolutionId: match.canonical.truth.resolutionId };
  const advance = (ms: number, tick = true) => { clock += ms; if (tick) game.tick(); };
  const open = () => { game.acknowledge(); advance(390_000); expect(game.phase).toBe("VOTING"); game.drain(); };
  return { game, pack, match, seats, ids, mapping, correct, open, advance, now: () => clock, version: () => version };
}

function state(ballots: Map<string, Ballot> = new Map()): ScoringState {
  return { ballots, publicEvidence: new Set(), traceSelfUsed: new Set() };
}

describe("sealed voting and canonical reveal", () => {
  it("retains final settlement before starting the exact 45-second voting window", () => {
    const f = fixture(); f.game.acknowledge(); f.advance(270_000); expect(f.game.phase).toBe("INVESTIGATION_3");
    f.game.submit(f.ids[0], 3, { kind: "CONFRONT", targetParticipantId: f.ids[1], question: "One last question?" });
    f.advance(120_000); expect(f.game.phase).toBe("SETTLING_3");
    expect(() => f.game.vote(f.ids[0], f.correct)).toThrow("during VOTING");
    f.advance(19_999); expect(f.game.phase).toBe("SETTLING_3");
    f.advance(1); expect(f.game.phase).toBe("VOTING"); expect(f.game.deadline).toBe(f.now() + 45_000);
  });
  it("seals private immutable ballots without public versions, counts or reveal data", () => {
    const f = fixture(); f.open();
    const before = JSON.stringify(f.game.publicView()); const version = f.version();
    const ballot = { ...f.correct };
    expect(f.game.vote(f.ids[0], ballot)).toEqual({ sealed: true }); ballot.causeId = "changed_after_submit";
    expect(f.game.self(f.ids[0]).myBallot).toEqual(f.correct);
    for (const id of f.ids.slice(1)) expect(f.game.self(id).myBallot).toBeNull();
    expect(JSON.stringify(f.game.publicView())).toBe(before); expect(f.version()).toBe(version);
    expect(f.game.revealView()).toBeNull();
    const deliveries = f.game.drain(); expect(deliveries).toEqual([{ event: "vote:receipt", owner: f.ids[0], payload: { roomId: f.game.roomId, sealed: true } }]);
    expect(() => f.game.vote(f.ids[0], f.correct)).toThrow("already sealed");
    expect(f.game.ledger.filter(e => e.kind === "BALLOT_SEALED")).toHaveLength(1);
  });
  it("waits for five complete ballots then reveals exactly once and freezes the result", () => {
    const f = fixture(); f.open();
    for (const id of f.ids.slice(0, 4)) f.game.vote(id, f.correct);
    expect(f.game.phase).toBe("VOTING"); expect(f.game.revealView()).toBeNull();
    f.game.vote(f.ids[4], f.correct); expect(f.game.phase).toBe("REVEAL");
    expect(f.game.deadline).toBe(f.now() + 60_000);
    const reveal = f.game.revealView()!; expect(reveal).toMatchObject({ correct: f.correct, groupSuccess: true, actorIdentified: true, publicMode: "CASUAL", caseContentHash: f.match.caseContentHash });
    expect(reveal.tallies.actors[f.correct.principalActorParticipantId]).toBe(5);
    expect(Object.isFrozen(reveal)).toBe(true); expect(Object.isFrozen(reveal.missions)).toBe(true);
    expect(f.game.drain().filter(d => d.event === "game:reveal")).toHaveLength(1);
    expect(() => f.game.vote(f.ids[4], f.correct)).toThrow("during VOTING");
    f.advance(60_000); expect(f.game.phase).toBe("AFTERPARTY"); expect(f.game.deadline).toBeNull();
    f.seats.forEach(s => s.socketIds.clear()); f.advance(999_999);
    expect(f.game.phase).toBe("AFTERPARTY"); expect(f.game.revealView()).toBe(reveal);
    expect(f.game.drain().filter(d => d.event === "game:reveal")).toHaveLength(0);
  });
  it("does not reveal at 44,999ms; missing and disconnected seats abstain at 45,000ms", () => {
    const f = fixture(); f.open(); f.game.vote(f.ids[0], f.correct); f.game.vote(f.ids[1], f.correct);
    f.seats[4].socketIds.clear(); f.advance(44_999); expect(f.game.phase).toBe("VOTING"); expect(f.game.revealView()).toBeNull();
    f.advance(1); expect(f.game.phase).toBe("REVEAL");
    const reveal = f.game.revealView()!; expect(reveal.groupSuccess).toBe(false); expect(reveal.actorIdentified).toBe(false);
    expect(Object.values(reveal.tallies.causes).reduce((a, b) => a + b, 0)).toBe(2);
    expect(f.game.self(f.ids[4]).myBallot).toBeNull();
  });
  it("rejects late, invalid, foreign and outsider ballots before mutation", () => {
    const f = fixture(); f.open();
    expect(() => f.game.vote(randomUUID(), f.correct)).toThrow("own a seat");
    expect(() => f.game.vote(f.ids[0], { ...f.correct, causeId: "forged" })).toThrow("case-listed");
    expect(() => f.game.vote(f.ids[0], { ...f.correct, resolutionId: "forged" })).toThrow("case-listed");
    expect(() => f.game.vote(f.ids[0], { ...f.correct, principalActorParticipantId: randomUUID() })).toThrow("participant in this case");
    expect(f.game.self(f.ids[0]).myBallot).toBeNull();
    f.advance(45_000, false); expect(() => f.game.vote(f.ids[0], f.correct)).toThrow("deadline has passed");
    f.game.tick(); expect(f.game.revealView()!.tallies.causes[f.correct.causeId]).toBe(0);
  });
  it("catches up through voting and reveal without fabricated ballots or repeated reveal", () => {
    const f = fixture(); f.advance(45_000 + 390_000 + 45_000 + 60_000);
    expect(f.game.phase).toBe("AFTERPARTY"); expect(f.game.deadline).toBeNull();
    expect(f.game.revealView()!.groupSuccess).toBe(false);
    expect(f.game.drain().filter(d => d.event === "game:reveal")).toHaveLength(1);
  });
});

describe("fixed majority and authored mission predicates", () => {
  it("requires three votes even for unanimous remaining voters; ties stay unresolved", () => {
    expect(majority({ a: 2, b: 2, c: 1 })).toBeNull();
    expect(majority({ a: 2, b: 0 })).toBeNull();
    expect(majority({ a: 0, b: 0 })).toBeNull();
    expect(majority({ a: 3, b: 2 })).toBe("a");
  });
  it("keeps group cause/resolution success independent of actor identification", () => {
    const f = fixture();
    const incorrectCause = f.pack.causeOptions.find(o => o.id !== f.correct.causeId)!.id;
    const incorrectResolution = f.pack.resolutionOptions.find(o => o.id !== f.correct.resolutionId)!.id;
    const incorrectActor = f.mapping.feyi;
    const ballots = new Map<string, Ballot>(f.ids.map(id => [id, { ...f.correct, principalActorParticipantId: incorrectActor }]));
    let reveal = scoreCase(f.match, f.pack, state(ballots)); expect(reveal.groupSuccess).toBe(true); expect(reveal.actorIdentified).toBe(false);
    for (const id of f.ids) ballots.set(id, { ...f.correct, causeId: incorrectCause });
    reveal = scoreCase(f.match, f.pack, state(ballots)); expect(reveal.groupSuccess).toBe(false); expect(reveal.actorIdentified).toBe(true);
    for (const id of f.ids) ballots.set(id, { ...f.correct, resolutionId: incorrectResolution });
    expect(scoreCase(f.match, f.pack, state(ballots)).groupSuccess).toBe(false);
    for (const id of f.ids.slice(0, 3)) ballots.set(id, f.correct);
    expect(scoreCase(f.match, f.pack, state(ballots)).groupSuccess).toBe(true);
  });
  it("counts each ballot field independently even when different trios form its majorities", () => {
    const f = fixture();
    const wrongCause = f.pack.causeOptions.find(o => o.id !== f.correct.causeId)!.id;
    const wrongResolution = f.pack.resolutionOptions.find(o => o.id !== f.correct.resolutionId)!.id;
    const ballots = new Map<string, Ballot>(f.ids.map((id, index) => [id, { ...f.correct, causeId: index < 3 ? f.correct.causeId : wrongCause, resolutionId: index >= 2 ? f.correct.resolutionId : wrongResolution }]));
    const reveal = scoreCase(f.match, f.pack, state(ballots));
    expect(reveal.groupSuccess).toBe(true); expect(reveal.tallies.causes[f.correct.causeId]).toBe(3); expect(reveal.tallies.resolutions[f.correct.resolutionId]).toBe(3);
  });
  it("scores all five Case 001 missions from the exact authored predicates", () => {
    const f = fixture(); const ballots = new Map<string, Ballot>(f.ids.map(id => [id, f.correct]));
    const published = new Set(["file_label_receipt"]);
    let reveal = scoreCase(f.match, f.pack, { ballots, publicEvidence: published, traceSelfUsed: new Set() });
    const outcome = () => Object.fromEntries(reveal.missions.map(m => [m.personaId, m.success]));
    expect(outcome()).toEqual({ tobi: false, ada: true, zainab: true, emeka: true, feyi: true });
    published.clear(); ballots.delete(f.mapping.zainab);
    for (const id of [f.mapping.tobi, f.mapping.ada, f.mapping.emeka]) ballots.set(id, { ...f.correct, principalActorParticipantId: f.mapping.feyi });
    reveal = scoreCase(f.match, f.pack, { ballots, publicEvidence: published, traceSelfUsed: new Set() });
    expect(outcome()).toEqual({ tobi: true, ada: true, zainab: false, emeka: false, feyi: false });
  });
  it("evaluates trace_self_used from executed actions, not tentative selections", () => {
    const f = fixture(); const s = state();
    expect(missionSucceeded({ kind: "trace_self_used" }, f.ids[0], s, f.mapping, {}, false)).toBe(false);
    expect(missionSucceeded({ kind: "trace_self_used" }, f.ids[0], { ...s, traceSelfUsed: new Set([f.ids[0]]) }, f.mapping, {}, false)).toBe(true);
  });
  it("projects chronological truth and missions without identities, seed, private cards or raw ballots", () => {
    const f = fixture(); const reveal = scoreCase(f.match, f.pack, state());
    expect(reveal.chain.map(e => e.minute)).toEqual([...reveal.chain.map(e => e.minute)].sort());
    expect(reveal.chain).toEqual(f.match.canonical.chain.map(e => ({ minute: e.minute, personaId: e.actorPersonaId, truth: e.truth })).sort((a, b) => a.minute.localeCompare(b.minute)));
    expect(Object.keys(reveal).sort()).toEqual(["correct", "tallies", "groupSuccess", "actorIdentified", "chain", "missions", "publicMode", "summary", "caseContentHash"].sort());
    const text = JSON.stringify(reveal);
    for (const forbidden of ["sealedSeedHex", "personaToParticipant", "roleCards", "predicate", "ballots", "kind", "humanCount", "botCount", "MIXED_CASUAL"]) expect(text).not.toContain(`"${forbidden}"`);
    expect(text).not.toContain(f.match.sealedSeedHex);
    for (const card of f.match.variant.roleCards) expect(text).not.toContain(card.startingMemory);
  });
});
