import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash, createHmac, randomBytes } from "node:crypto";
import Ajv2020 from "ajv/dist/2020";
import type { WahalaChainCasePackV1 as CasePack } from "./generated/case";
import type { RoleAssignment, VerifiedClue } from "@wahala/shared";

export type { CasePack };
export type Variant = CasePack["variants"][number];
const schema = JSON.parse(readFileSync(resolve(__dirname, "../../packages/shared/schemas/case.v1.schema.json"), "utf8"));
const validateSchema = new Ajv2020({ allErrors: true }).compile<CasePack>(schema);

function unique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label} IDs.`);
}
function must(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function validateCasePack(value: unknown): asserts value is CasePack {
  if (!validateSchema(value)) throw new Error(`Invalid case schema: ${JSON.stringify(validateSchema.errors)}`);
  const personaIds = value.personas.map((p) => p.id);
  unique(personaIds, "persona");
  unique(value.variants.map((v) => v.id), "variant");
  unique(value.causeOptions.map((o) => o.id), "cause");
  unique(value.resolutionOptions.map((o) => o.id), "resolution");
  for (const variant of value.variants) {
    for (const [name, collection] of Object.entries({ evidence: variant.evidence, mission: variant.missions,
      ability: variant.abilities, lead: variant.investigationLeads, chain: variant.chain })) {
      unique(collection.map((item) => item.id), name);
    }
    unique(variant.roleCards.map((c) => c.personaId), "role card");
    must(personaIds.every((id) => variant.roleCards.some((card) => card.personaId === id)), "Each persona needs exactly one role card.");
    must(personaIds.includes(variant.correct.principalActorPersonaId), "Unknown principal actor.");
    must(value.causeOptions.some((o) => o.id === variant.correct.causeId), "Unknown correct cause.");
    must(value.resolutionOptions.some((o) => o.id === variant.correct.resolutionId), "Unknown correct resolution.");
    for (const event of variant.chain) must(personaIds.includes(event.actorPersonaId), "Unknown chain actor.");
    for (const mission of variant.missions) {
      if ("roleId" in mission.predicate) must(personaIds.includes(mission.predicate.roleId), "Unknown mission persona.");
      if ("evidenceId" in mission.predicate) {
        const evidenceId = mission.predicate.evidenceId;
        must(variant.evidence.some((e) => e.id === evidenceId), "Unknown mission evidence.");
      }
    }
    for (const card of variant.roleCards) {
      must(variant.missions.some((m) => m.id === card.missionId), "Unknown role mission.");
      must(variant.abilities.some((a) => a.id === card.abilityId), "Unknown role ability.");
      for (const id of card.startingEvidenceIds) must(variant.evidence.some((e) => e.id === id && e.release === "private_start" && e.initialOwnerRoleId === card.personaId), "Invalid starting evidence ownership.");
      for (const id of card.traceEvidenceIds) must(variant.evidence.some((e) => e.id === id && e.release === "trace_self" && e.initialOwnerRoleId === card.personaId), "Invalid trace evidence ownership.");
    }
    for (const evidence of variant.evidence) {
      if (evidence.initialOwnerRoleId) must(personaIds.includes(evidence.initialOwnerRoleId), "Unknown evidence owner.");
      if (evidence.release === "public_start") must(evidence.kind === "public_clue", "Invalid public clue.");
      if (evidence.release === "investigate") must(variant.investigationLeads.some((lead) => lead.id === evidence.leadId && lead.evidenceIds.includes(evidence.id)), "Unreachable investigation evidence.");
    }
    for (const lead of variant.investigationLeads) for (const id of lead.evidenceIds) {
      must(variant.evidence.some((e) => e.id === id && e.release === "investigate" && e.leadId === lead.id), "Invalid lead reference.");
    }
    for (const ability of variant.abilities) {
      if ("evidenceId" in ability.effect) {
        const evidenceId = ability.effect.evidenceId;
        const evidence = variant.evidence.find((e) => e.id === evidenceId);
        must(evidence, "Unknown ability evidence.");
        if (ability.effect.kind === "delay_optional_clue") must(evidence.release === "twist" && !evidence.factTags?.includes("decisive"), "Cannot delay decisive evidence.");
      }
    }
    for (const id of variant.twist.publicEvidenceIds) must(variant.evidence.some((e) => e.id === id && e.release === "twist"), "Unknown twist evidence.");
  }
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) freeze(entry);
    Object.freeze(value);
  }
  return value;
}
const sha256 = (input: string | Buffer) => createHash("sha256").update(input).digest("hex");

export function loadCasePack(): CasePack {
  const pack: unknown = JSON.parse(readFileSync(resolve(__dirname, "../../packages/content/screenshot_leak_001.json"), "utf8"));
  validateCasePack(pack);
  return freeze(pack);
}

export function initializeCase(pack: CasePack, participantIds: string[], seed = randomBytes(32)) {
  validateCasePack(pack);
  must(participantIds.length === 5 && new Set(participantIds).size === 5, "A case requires five unique participants.");
  must(seed.length === 32, "A secure seed must be 32 bytes.");
  let counter = 0;
  function int(max: number) {
    const limit = Math.floor(0x1_0000_0000 / max) * max;
    let draw: number;
    do { draw = createHmac("sha256", seed).update(String(counter++)).digest().readUInt32BE(0); }
    while (draw >= limit);
    return draw % max;
  }
  const variant = pack.variants[int(pack.variants.length)];
  const shuffled = [...participantIds];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const chosen = int(index + 1);
    [shuffled[index], shuffled[chosen]] = [shuffled[chosen], shuffled[index]];
  }
  const canonical = freeze({ variantId: variant.id,
    personaToParticipant: Object.fromEntries(pack.personas.map((persona, index) => [persona.id, shuffled[index]])),
    truth: structuredClone(variant.correct), chain: structuredClone(variant.chain), roleCards: structuredClone(variant.roleCards),
  });
  return freeze({ canonical, variant, sealedSeedHex: seed.toString("hex"),
    commitment: sha256(Buffer.concat([seed, Buffer.from(canonicalJson(canonical))])),
    caseContentHash: sha256(canonicalJson(pack)),
  });
}
export type CaseInitialization = ReturnType<typeof initializeCase>;

export function clueView(evidence: Variant["evidence"][number]): VerifiedClue {
  return { id: evidence.id, title: evidence.title, body: evidence.body, verified: true };
}
export function projectRole(match: CaseInitialization, roomId: string, participantId: string): RoleAssignment {
  const personaId = Object.entries(match.canonical.personaToParticipant).find(([, id]) => id === participantId)?.[0];
  must(personaId, "No role belongs to this participant.");
  const card = match.canonical.roleCards.find((c) => c.personaId === personaId)!;
  const mission = match.variant.missions.find((m) => m.id === card.missionId)!;
  const ability = match.variant.abilities.find((a) => a.id === card.abilityId)!;
  return { roomId, personaId, startingMemory: card.startingMemory,
    mission: { id: mission.id, description: mission.description },
    ability: { id: ability.id, description: ability.description },
    startingEvidence: card.startingEvidenceIds.map((id) => clueView(match.variant.evidence.find((e) => e.id === id)!)),
  };
}
