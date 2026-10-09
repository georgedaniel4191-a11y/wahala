import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { createApplication } from "../src/app";
import type { GuestSession } from "../src/sessions";
import { Lounge } from "../src/lounge";
import { loungeJoinSchema } from "@wahala/shared";

it("gates production lounge unless closed-alpha admission and moderation are configured", async () => {
  const closed = createApplication({ production: true, loungeEnabled: true });
  expect(closed.lounge.enabled).toBe(false); await closed.close();
  const alpha = createApplication({ production: true, loungeEnabled: true, loungeAccessCode: "invite", moderatorToken: "moderator" });
  expect(alpha.lounge.enabled).toBe(true); await alpha.close();
});
it("requires admission and adult boundary; reconnect preserves blocks and real presence", () => {
  let now = 10;
  const lounge = new Lounge(true, "invite", () => now);
  const session: GuestSession = { userId: randomUUID(), roomId: null, expiresAtMs: 100 };
  const profile = { nickname: "Ada", avatarId: "gold" };
  expect(() => lounge.join(session, "one", profile)).toThrow("access code");
  expect(loungeJoinSchema.safeParse({ ...profile, requestId: randomUUID(), acceptedAdultBoundary: false }).success).toBe(false);
  lounge.join(session, "one", { ...profile, accessCode: "invite" }); lounge.attach(session, "two"); expect(lounge.presence()).toHaveLength(1);
  lounge.disconnect(session.userId, "one"); expect(lounge.presence()).toHaveLength(1);
  lounge.disconnect(session.userId, "two"); expect(lounge.presence()).toHaveLength(0);
  lounge.attach(session, "three"); expect(lounge.presence()).toHaveLength(1);
  session.roomId = randomUUID(); expect(() => lounge.join(session, "four", profile)).toThrow("private room");
  now = 100; lounge.cleanup(); expect(lounge.members.size).toBe(0);
});
