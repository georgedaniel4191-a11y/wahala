/* Generated from the master case schema. Run npm run generate:case --workspace server. */

export type Id = string;

export interface WahalaChainCasePackV1 {
  schemaVersion: "1.0.0";
  caseId: string;
  metadata: {
    title: string;
    subtitle: string;
    locale: string;
    rating: "adult_18_plus";
    estimatedMinutes: number;
    tags: string[];
    sponsorLabel: string | null;
  };
  settings: {
    playerCount: 5;
    actionRounds: 3;
    actionsPerRound: 1;
    allowEarlyElimination: false;
    seconds: {
      roles: number;
      round: number;
      twist: number;
      vote: number;
      reveal: number;
      response: number;
    };
  };
  /**
   * @minItems 3
   * @maxItems 4
   */
  causeOptions: [Option, Option, Option] | [Option, Option, Option, Option];
  /**
   * @minItems 3
   * @maxItems 4
   */
  resolutionOptions: [Option, Option, Option] | [Option, Option, Option, Option];
  /**
   * @minItems 5
   * @maxItems 5
   */
  personas: [Persona, Persona, Persona, Persona, Persona];
  /**
   * @minItems 1
   */
  variants: [Variant, ...Variant[]];
}
export interface Option {
  id: Id;
  label: string;
}
export interface Persona {
  id: Id;
  displayName: string;
  publicBio: string;
}
export interface Variant {
  id: Id;
  publicIntro: string;
  correct: {
    causeId: Id;
    resolutionId: Id;
    principalActorPersonaId: Id;
  };
  /**
   * @minItems 3
   */
  chain: [ChainEvent, ChainEvent, ChainEvent, ...ChainEvent[]];
  /**
   * @minItems 5
   * @maxItems 5
   */
  roleCards: [RoleCard, RoleCard, RoleCard, RoleCard, RoleCard];
  /**
   * @minItems 5
   * @maxItems 5
   */
  missions: [Mission, Mission, Mission, Mission, Mission];
  /**
   * @minItems 5
   * @maxItems 5
   */
  abilities: [Ability, Ability, Ability, Ability, Ability];
  /**
   * @minItems 8
   */
  evidence: [Evidence, Evidence, Evidence, Evidence, Evidence, Evidence, Evidence, Evidence, ...Evidence[]];
  twist: Twist;
  /**
   * @minItems 2
   */
  investigationLeads: [
    {
      id: Id;
      label: string;
      /**
       * @minItems 1
       */
      evidenceIds: [Id, ...Id[]];
    },
    {
      id: Id;
      label: string;
      /**
       * @minItems 1
       */
      evidenceIds: [Id, ...Id[]];
    },
    ...{
      id: Id;
      label: string;
      /**
       * @minItems 1
       */
      evidenceIds: [Id, ...Id[]];
    }[]
  ];
  revealSummary: string;
}
export interface ChainEvent {
  id: Id;
  minute: string;
  actorPersonaId: Id;
  truth: string;
}
export interface RoleCard {
  personaId: Id;
  startingMemory: string;
  midgameMemory: string;
  blindInvolvement: string;
  missionId: Id;
  abilityId: Id;
  startingEvidenceIds: Id[];
  /**
   * @minItems 1
   */
  traceEvidenceIds: [Id, ...Id[]];
}
export interface Mission {
  id: Id;
  description: string;
  predicate:
    | {
        kind: "group_success";
      }
    | {
        kind: "role_not_majority_accused";
        roleId: Id;
      }
    | {
        kind: "evidence_published";
        evidenceId: Id;
      }
    | {
        kind: "voted_for_actor";
        roleId: Id;
      }
    | {
        kind: "trace_self_used";
      };
}
export interface Ability {
  id: Id;
  kind: "audit" | "messenger" | "insider" | "protector" | "observer";
  description: string;
  limit: 1;
  effect:
    | {
        kind: "grant_evidence";
        evidenceId: Id;
      }
    | {
        kind: "peek_investigation_lead";
      }
    | {
        kind: "delay_optional_clue";
        evidenceId: Id;
        delayRounds: 1;
      };
}
export interface Evidence {
  id: Id;
  title: string;
  body: string;
  kind: "public_clue" | "private_evidence" | "memory_fragment";
  verified: true;
  release: "public_start" | "private_start" | "investigate" | "twist" | "trace_self";
  leadId: string | null;
  initialOwnerRoleId?: string | null;
  factTags?: Id[];
}
export interface Twist {
  id: Id;
  afterRound: 1;
  headline: string;
  /**
   * @minItems 1
   */
  publicEvidenceIds: [Id, ...Id[]];
}
