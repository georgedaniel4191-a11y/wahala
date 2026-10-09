export type UUID = string; // UUIDv4, server-validated
export type RoomId = UUID;
export type HumanUserId = UUID;
export type ParticipantId = UUID;
export type EvidenceId = string;
export type PersonaId = string;
export type ISOTime = string; // UTC ISO-8601
export type ParticipantKind = 'human' | 'bot';
export type BotPolicy = 'none' | 'allow_bots';
export type Mode = 'PRIVATE' | 'QUICK_CASUAL' | 'SOLO_PRACTICE' | 'DUO_EXPERIMENT';
export type Phase =
  | 'LOBBY' | 'ROLES' | 'INVESTIGATION_1' | 'SETTLING_1' | 'TWIST'
  | 'INVESTIGATION_2' | 'SETTLING_2' | 'INVESTIGATION_3' | 'SETTLING_3'
  | 'VOTING' | 'REVEAL' | 'AFTERPARTY' | 'ABANDONED' | 'CLOSED';
export type Round = 1 | 2 | 3;
export type ErrorCode =
  | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'ROOM_NOT_FOUND' | 'ROOM_FULL'
  | 'INVALID_ROOM_CODE' | 'ROOM_LOCKED' | 'WRONG_PHASE' | 'NOT_READY'
  | 'NOT_HOST' | 'INVALID_ACTION' | 'ALREADY_USED' | 'EVIDENCE_NOT_OWNED'
  | 'INVALID_TARGET' | 'DEADLINE_PASSED' | 'BAD_PAYLOAD' | 'RATE_LIMITED'
  | 'REQUEST_CONFLICT' | 'CASE_UNAVAILABLE' | 'BOT_FILL_NOT_ALLOWED'
  | 'HUMAN_MINIMUM_NOT_MET' | 'UNSUPPORTED_MODE' | 'QUEUE_EXPIRED'
  | 'NOT_YOUR_SEAT' | 'NO_OPEN_RESPONSE' | 'INTERNAL_ERROR';
export type Ack<T> =
  | { ok: true; requestId: UUID; data: T; serverNow: ISOTime }
  | { ok: false; requestId: UUID; error: { code: ErrorCode; message: string }; serverNow: ISOTime };
export type RoomCommand = { roomId: RoomId; requestId: UUID };
export type QueueCommand = { requestId: UUID };
export type ActionSelection =
  | { kind: 'INVESTIGATE'; leadId: string }
  | { kind: 'CONFRONT'; targetParticipantId: ParticipantId; question: string }
  | { kind: 'EXPOSE'; evidenceId: EvidenceId }
  | { kind: 'MAKE_DEAL'; targetParticipantId: ParticipantId;
      offerEvidenceId: EvidenceId; requestEvidenceId: EvidenceId }
  | { kind: 'DEFEND'; targetParticipantId: ParticipantId;
      accusationId: UUID; explanation: string }
  | { kind: 'TRACE_SELF' }
  | { kind: 'ABILITY'; abilityId: string; targetParticipantId?: ParticipantId }
  | { kind: 'PASS' };

export type ParticipantPublic = {
  participantId: ParticipantId;
  nickname: string; avatarId: string;
  connected: boolean; ready: boolean;
  personaId: PersonaId | null; isHost: boolean;
  // Intentionally no `kind`, bot policy, AI badge, account ID or online-human claim.
  // Apply for all characters in an opted-in IDENTITY_HIDDEN match.
};
export type IdentityDisclosure = {
  participantId: ParticipantId; kind: ParticipantKind;
  nickname: string; avatarId: string;
};

export type VerifiedClue = { id: EvidenceId; title: string; body: string; verified: true };
export type ChatMessage = {
  id: UUID; roomId: RoomId; channel: 'LOBBY' | 'GAME' | 'AFTERPARTY';
  fromParticipantId: ParticipantId;
  // Author type is server-internal, never broadcast during identity-hidden play.
  text: string; createdAt: ISOTime;
};
export type PublicGameEvent = { id: UUID; sequence: number; kind: string;
  text: string; createdAt: ISOTime; fromParticipantId?: ParticipantId };
export type Ballot = {
  causeId: string; principalActorParticipantId: ParticipantId; resolutionId: string;
};
export type RoomView = {
  roomId: RoomId; code: string | null; caseId: string;
  title: string; mode: Mode;
  phase: Phase; round: 0 | 1 | 2 | 3;
  version: number; serverNow: ISOTime; deadlineAt: ISOTime | null;
  botPolicy: BotPolicy; botFillConsented: boolean;
  aiPresenceDisclosure: 'HUMANS_ONLY' | 'MAY_INCLUDE_AI' | 'SOLO_AI_PRACTICE';
  // Human/bot counts and seat kinds are server-only until opt-in postgame reveal.
  participants: ParticipantPublic[]; locked: boolean;
  publicClues: VerifiedClue[]; publicEvents: PublicGameEvent[];
  accusationMarkers: { id: UUID; byParticipantId: ParticipantId;
    targetParticipantId: ParticipantId; status: 'open' | 'contested' }[];
  causeOptions: { id: string; label: string }[];
  resolutionOptions: { id: string; label: string }[];
};
export type SelfView = {
  participantId: ParticipantId; personaId: PersonaId | null;
  startingMemory: string | null; midgameMemory: string | null;
  mission: { id: string; description: string } | null;
  ability: { id: string; description: string; used: boolean } | null;
  myEvidence: VerifiedClue[]; myMemoryFragments: VerifiedClue[];
  selectedAction: ActionSelection | null; actionLocked: boolean;
  myBallot: Ballot | null;
};
export type RevealView = {
  correct: Ballot;
  tallies: {
    causes: Record<string, number>;
    actors: Record<ParticipantId, number>;
    resolutions: Record<string, number>;
  };
  groupSuccess: boolean; actorIdentified: boolean;
  chain: { minute: string; personaId: PersonaId; truth: string }[];
  missions: { participantId: ParticipantId; personaId: PersonaId;
    missionDescription: string; success: boolean }[];
  publicMode: 'CASUAL' | 'PRACTICE'; // Server retains MIXED_CASUAL/HUMAN_CASUAL classification.
  summary: string; caseContentHash: string;
};
