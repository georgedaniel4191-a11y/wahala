import { z } from "zod";
import type { Ack, RoomView, SelfView, ChatMessage, RevealView, Phase, VerifiedClue, ActionSelection, PublicGameEvent } from "./contracts";

export const CASE_ID = "screenshot_leak_001";
export const CASE_TITLE = "Who Leaked the Screenshot?";
export const AVATARS = ["gold", "mint", "coral", "lavender", "sky"] as const;
export const SEAT_COUNT = 5;
export const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

const uuid = z.uuid({ version: "v4" });
const nickname = z.string().trim().min(1).max(24)
  .regex(/^[\p{L}\p{N} _.'-]+$/u, "Use letters, numbers, spaces, or simple punctuation.");
const profile = { nickname, avatarId: z.enum(AVATARS) };
export const roomCommandSchema = z.strictObject({ requestId: uuid, roomId: uuid });
export const createRoomSchema = z.strictObject({
  requestId: uuid, caseId: z.string().min(1).max(64), ...profile,
  mode: z.literal("PRIVATE"), botPolicy: z.enum(["none", "allow_bots"]),
});
export const joinRoomSchema = z.strictObject({
  requestId: uuid, code: z.string().trim().toUpperCase().regex(ROOM_CODE_PATTERN), ...profile,
});
export const readyRoomSchema = roomCommandSchema.extend({
  ready: z.boolean(), acceptBotFill: z.boolean().optional(),
  acceptedIdentityHiddenDisclosure: z.boolean().optional(),
});
const id = z.string().min(1).max(64);
const statement = z.string().trim().min(1).max(500);
export const actionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("INVESTIGATE"), leadId: id }),
  z.strictObject({ kind: z.literal("CONFRONT"), targetParticipantId: uuid, question: statement }),
  z.strictObject({ kind: z.literal("EXPOSE"), evidenceId: id }),
  z.strictObject({ kind: z.literal("MAKE_DEAL"), targetParticipantId: uuid, offerEvidenceId: id, requestEvidenceId: id }),
  z.strictObject({ kind: z.literal("DEFEND"), targetParticipantId: uuid, accusationId: uuid, explanation: statement }),
  z.strictObject({ kind: z.literal("TRACE_SELF") }),
  z.strictObject({ kind: z.literal("ABILITY"), abilityId: id, targetParticipantId: uuid.optional() }),
  z.strictObject({ kind: z.literal("PASS") }),
]);
export const actionSubmitSchema = roomCommandSchema.extend({ round: z.union([z.literal(1), z.literal(2), z.literal(3)]), action: actionSchema });
export const actionRespondSchema = roomCommandSchema.extend({ challengeId: uuid, response: z.enum(["ANSWER", "REFUSE"]), text: statement.optional() });
export const dealRespondSchema = roomCommandSchema.extend({ offerId: uuid, accept: z.boolean() });
export const chatSendSchema = roomCommandSchema.extend({ channel: z.enum(["LOBBY", "GAME", "AFTERPARTY"]), text: statement });

export type CreateRoomCommand = z.infer<typeof createRoomSchema>;
export type JoinRoomCommand = z.infer<typeof joinRoomSchema>;
export type ReadyRoomCommand = z.infer<typeof readyRoomSchema>;
export type ResumeCommand = z.infer<typeof roomCommandSchema>;
export type CreateRoomResult = { roomId: string; code: string; participantId: string; inviteUrl: string };
export type JoinRoomResult = { roomId: string; participantId: string };
export type Snapshot = {
  roomId: string; public: RoomView; self: SelfView;
  recentChat: ChatMessage[]; reveal: RevealView | null;
};

export type RoleAssignment = {
  roomId: string; personaId: string; startingMemory: string;
  mission: { id: string; description: string };
  ability: { id: string; description: string };
  startingEvidence: VerifiedClue[];
};
export type GameStarted = {
  roomId: string; caseId: string; publicIntro: string; commitment: string;
  cast: { participantId: string; personaId: string; displayName: string; publicBio: string }[];
};
export type GamePhase = {
  roomId: string; phase: Phase; round: 0 | 1 | 2 | 3;
  version: number; deadlineAt: string | null; serverNow: string;
};

// Approved lobby, roles and investigation subset of the normative wire contract.
export interface ClientToServerEvents {
  "action:submit": (p: z.infer<typeof actionSubmitSchema>, ack: (a: Ack<{ accepted: true; selectedAction: ActionSelection }>) => void) => void;
  "action:respond": (p: z.infer<typeof actionRespondSchema>, ack: (a: Ack<{ recorded: true }>) => void) => void;
  "deal:respond": (p: z.infer<typeof dealRespondSchema>, ack: (a: Ack<{ recorded: true }>) => void) => void;
  "chat:send": (p: z.infer<typeof chatSendSchema>, ack: (a: Ack<{ messageId: string }>) => void) => void;
  "room:create": (p: CreateRoomCommand, ack: (a: Ack<CreateRoomResult>) => void) => void;
  "room:join": (p: JoinRoomCommand, ack: (a: Ack<JoinRoomResult>) => void) => void;
  "room:ready": (p: ReadyRoomCommand, ack: (a: Ack<{ ready: boolean }>) => void) => void;
  "state:resume": (p: ResumeCommand, ack: (a: Ack<{ resumed: true }>) => void) => void;
  "room:start": (p: ResumeCommand, ack: (a: Ack<{ phase: "ROLES"; version: number }>) => void) => void;
  "role:acknowledge": (p: ResumeCommand, ack: (a: Ack<{ acknowledged: true }>) => void) => void;
}
export interface ServerToClientEvents {
  "role:memory": (p: { roomId: string; midgameMemory: string }) => void;
  "game:twist": (p: { roomId: string; headline: string; publicClues: VerifiedClue[] }) => void;
  "game:event": (p: { roomId: string; event: PublicGameEvent }) => void;
  "evidence:private": (p: { roomId: string; evidence: VerifiedClue; source: "INVESTIGATE" | "TRACE_SELF" | "ABILITY" | "DEAL" }) => void;
  "evidence:public": (p: { roomId: string; evidence: VerifiedClue; byParticipantId: string | null }) => void;
  "action:respond_requested": (p: { roomId: string; challengeId: string; fromParticipantId: string; question: string; deadlineAt: string }) => void;
  "deal:offered": (p: { roomId: string; offerId: string; fromParticipantId: string; offeredEvidenceId: string; requestedEvidenceId: string; deadlineAt: string }) => void;
  "action:resolved": (p: { roomId: string; round: 1 | 2 | 3; eventId: string; status: "DONE" | "FAILED" | "EXPIRED"; text: string; grantedEvidenceIds: string[] }) => void;
  "chat:message": (p: { roomId: string; message: ChatMessage }) => void;
  "room:updated": (p: { roomId: string; view: RoomView }) => void;
  "state:snapshot": (p: Snapshot) => void;
  "room:closed": (p: { roomId: string; reason: "IDLE" | "HOST_CLOSED" | "ABANDONED" | "MODERATION" }) => void;
  "game:started": (p: GameStarted) => void;
  "role:assign": (p: RoleAssignment) => void;
  "game:phase": (p: GamePhase) => void;
}
