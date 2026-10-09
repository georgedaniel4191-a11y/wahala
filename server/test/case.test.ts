import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { loadCasePack, validateCasePack, initializeCase, projectRole } from "../src/case";

const pack = loadCasePack();

describe("server-owned screenshot case", () => {
  it("preserves both JSON artifacts exactly from GAME_SPEC.md", () => {
    const root = resolve(__dirname, "../..");
    const spec = readFileSync(resolve(root, "GAME_SPEC.md"), "utf8");
    for (const [section, filename] of [["## 2.1 Canonical contract", "packages/shared/schemas/case.v1.schema.json"],
      ["## 2.2 Flagship exemplar", "packages/content/screenshot_leak_001.json"]]) {
      const expected = spec.split(section)[1].match(/```json\n([\s\S]*?)\n```/)![1] + "\n";
      expect(readFileSync(resolve(root, filename), "utf8")).toBe(expected);
    }
    expect(pack.personas.map((p) => p.displayName)).toEqual(["Tobi", "Ada", "Zainab", "Emeka", "Feyi"]);
  });

  it("rejects broken references, duplicate roles, ownership errors and fabricated verified clues", () => {
    const brokenMission = structuredClone(pack);
    brokenMission.variants[0].roleCards[0].missionId = "missing_mission";
    expect(() => validateCasePack(brokenMission)).toThrow("mission");
    const duplicate = structuredClone(pack);
    duplicate.personas[0].id = duplicate.personas[1].id;
    expect(() => validateCasePack(duplicate)).toThrow("Duplicate persona");
    const incorrectOwner = structuredClone(pack);
    incorrectOwner.variants[0].roleCards[0].startingEvidenceIds = ["ada_note"];
    expect(() => validateCasePack(incorrectOwner)).toThrow("ownership");
    const unverified = structuredClone(pack) as unknown as { variants: { evidence: { verified: boolean }[] }[] };
    unverified.variants[0].evidence[0].verified = false;
    expect(() => validateCasePack(unverified)).toThrow("schema");
  });

  it("replays the same seed exactly with a unique five-person mapping and immutable truth", () => {
    const ids = Array.from({ length: 5 }, () => randomUUID());
    const first = initializeCase(pack, ids, Buffer.alloc(32, 11));
    const repeat = initializeCase(pack, ids, Buffer.alloc(32, 11));
    expect(repeat).toEqual(first);
    expect(Object.values(first.canonical.personaToParticipant).sort()).toEqual([...ids].sort());
    expect(first.commitment).toMatch(/^[a-f0-9]{64}$/);
    expect(first.caseContentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.isFrozen(first.canonical)).toBe(true);
    expect(Object.isFrozen(first.canonical.roleCards)).toBe(true);
    expect(() => initializeCase(pack, ids.slice(1))).toThrow("five unique");
    expect(() => initializeCase(pack, Array(5).fill(ids[0]))).toThrow("five unique");
    const seen = new Set<string>();
    for (let index = 0; index < 12; index += 1) seen.add(JSON.stringify(initializeCase(pack, ids, Buffer.alloc(32, index)).canonical.personaToParticipant));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("projects only the owner's authored opening card and starting evidence", () => {
    const ids = Array.from({ length: 5 }, () => randomUUID());
    const match = initializeCase(pack, ids);
    for (const id of ids) {
      const projected = projectRole(match, randomUUID(), id);
      const authored = pack.variants[0].roleCards.find((card) => card.personaId === projected.personaId)!;
      expect(projected.startingMemory).toBe(authored.startingMemory);
      expect(projected.startingEvidence.map((e) => e.id)).toEqual(authored.startingEvidenceIds);
      expect(Object.keys(projected).sort()).toEqual(["ability", "mission", "personaId", "roomId", "startingEvidence", "startingMemory"]);
      const serialized = JSON.stringify(projected);
      for (const card of match.canonical.roleCards) {
        expect(serialized).not.toContain(card.blindInvolvement);
        expect(serialized).not.toContain(card.midgameMemory);
        if (card.personaId !== projected.personaId) expect(serialized).not.toContain(card.startingMemory);
      }
      expect(serialized).not.toContain(match.sealedSeedHex);
    }
    expect(() => projectRole(match, randomUUID(), randomUUID())).toThrow("No role");
  });
});
