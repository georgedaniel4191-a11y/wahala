import { z } from "zod";
import type { Ack, RoomView, SelfView, ChatMessage, RevealView } from "./contracts";

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

// This implementation intentionally exposes only the approved lobby subset.
export interface ClientToServerEvents {
  "room:create": (p: CreateRoomCommand, ack: (a: Ack<CreateRoomResult>) => void) => void;
  "room:join": (p: JoinRoomCommand, ack: (a: Ack<JoinRoomResult>) => void) => void;
  "room:ready": (p: ReadyRoomCommand, ack: (a: Ack<{ ready: boolean }>) => void) => void;
  "state:resume": (p: ResumeCommand, ack: (a: Ack<{ resumed: true }>) => void) => void;
}
export interface ServerToClientEvents {
  "room:updated": (p: { roomId: string; view: RoomView }) => void;
  "state:snapshot": (p: Snapshot) => void;
  "room:closed": (p: { roomId: string; reason: "IDLE" | "HOST_CLOSED" | "ABANDONED" | "MODERATION" }) => void;
}
