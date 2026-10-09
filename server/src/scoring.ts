import type { Ballot, RevealView } from "@wahala/shared";
import type { CaseInitialization, CasePack } from "./case";
import type { Mission } from "./generated/case";

export type BallotOptions = Pick<CasePack, "causeOptions" | "resolutionOptions">;
export type ScoringState = {
  ballots: ReadonlyMap<string, Ballot>;
  publicEvidence: ReadonlySet<string>;
  traceSelfUsed: ReadonlySet<string>;
};

/** Fixed electorate of five. Abstention never lowers the threshold. */
export function majority(tallies: Record<string, number>): string | null {
  return Object.keys(tallies).find(id => tallies[id] >= 3) ?? null;
}

export function missionSucceeded(predicate: Mission["predicate"], participantId: string,
  state: ScoringState, personaToParticipant: Readonly<Record<string, string>>,
  actors: Record<string, number>, groupSuccess: boolean): boolean {
  switch (predicate.kind) {
    case "group_success": return groupSuccess;
    case "role_not_majority_accused": return (actors[personaToParticipant[predicate.roleId]] ?? 0) < 3;
    case "evidence_published": return state.publicEvidence.has(predicate.evidenceId);
    case "voted_for_actor": return state.ballots.get(participantId)?.principalActorParticipantId === personaToParticipant[predicate.roleId];
    case "trace_self_used": return state.traceSelfUsed.has(participantId);
  }
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** Pure owner-independent public projection, called only once voting closes. */
export function scoreCase(match: CaseInitialization, options: BallotOptions, state: ScoringState): RevealView {
  const mapping = match.canonical.personaToParticipant;
  const correct: Ballot = { causeId: match.canonical.truth.causeId,
    principalActorParticipantId: mapping[match.canonical.truth.principalActorPersonaId],
    resolutionId: match.canonical.truth.resolutionId };
  const tallies = {
    causes: Object.fromEntries(options.causeOptions.map(o => [o.id, 0])),
    actors: Object.fromEntries(Object.values(mapping).map(id => [id, 0])),
    resolutions: Object.fromEntries(options.resolutionOptions.map(o => [o.id, 0])),
  };
  for (const participantId of Object.values(mapping)) {
    const ballot = state.ballots.get(participantId);
    if (!ballot) continue;
    tallies.causes[ballot.causeId] += 1;
    tallies.actors[ballot.principalActorParticipantId] += 1;
    tallies.resolutions[ballot.resolutionId] += 1;
  }
  const groupSuccess = majority(tallies.causes) === correct.causeId && majority(tallies.resolutions) === correct.resolutionId;
  return freeze({ correct, tallies, groupSuccess,
    actorIdentified: majority(tallies.actors) === correct.principalActorParticipantId,
    chain: match.canonical.chain.map(e => ({ minute: e.minute, personaId: e.actorPersonaId, truth: e.truth })).sort((a, b) => a.minute.localeCompare(b.minute)),
    missions: match.canonical.roleCards.map(card => {
      const participantId = mapping[card.personaId];
      const mission = match.variant.missions.find(m => m.id === card.missionId)!;
      return { participantId, personaId: card.personaId, missionDescription: mission.description,
        success: missionSucceeded(mission.predicate, participantId, state, mapping, tallies.actors, groupSuccess) };
    }),
    publicMode: "CASUAL", summary: match.variant.revealSummary, caseContentHash: match.caseContentHash,
  });
}
