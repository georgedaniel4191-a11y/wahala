import type { ErrorCode } from "@wahala/shared";

export class CommandError extends Error {
  constructor(public readonly code: ErrorCode, message: string) { super(message); }
}
