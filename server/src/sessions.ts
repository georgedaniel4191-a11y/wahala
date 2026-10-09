import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

export const COOKIE_NAME = "wahala_guest";
const SESSION_AGE_MS = 24 * 60 * 60 * 1000;
export type GuestSession = { userId: string; expiresAtMs: number; roomId: string | null };

export class Sessions {
  private readonly entries = new Map<string, GuestSession>();
  constructor(private readonly secret: string, private readonly now = Date.now) {}

  private sign(value: string) {
    return createHmac("sha256", this.secret).update(value).digest("base64url");
  }

  issue() {
    const token = randomBytes(32).toString("base64url");
    const session: GuestSession = {
      userId: randomUUID(), expiresAtMs: this.now() + SESSION_AGE_MS, roomId: null,
    };
    this.entries.set(token, session);
    return { session, cookieValue: `${token}.${this.sign(token)}` };
  }

  read(request: IncomingMessage): GuestSession | null {
    const cookie = request.headers.cookie?.split(";").map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
    if (!cookie) return null;
    const parts = cookie.split(".");
    if (parts.length !== 2 || !/^[A-Za-z0-9_-]{43}$/.test(parts[0])) return null;
    const [token, signature] = parts;
    const expected = Buffer.from(this.sign(token));
    const supplied = Buffer.from(signature);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const session = this.entries.get(token);
    if (!session || session.expiresAtMs <= this.now()) return null;
    return session;
  }

  cleanup() {
    for (const [token, session] of this.entries) {
      if (session.expiresAtMs <= this.now()) this.entries.delete(token);
    }
  }
}

export class RateLimiter {
  private readonly windows = new Map<string, { count: number; until: number }>();
  constructor(private readonly now = Date.now) {}
  allow(key: string, maximum: number, windowMs = 60_000) {
    const existing = this.windows.get(key);
    if (!existing || existing.until <= this.now()) {
      this.windows.set(key, { count: 1, until: this.now() + windowMs });
      return true;
    }
    existing.count += 1;
    return existing.count <= maximum;
  }
  cleanup() {
    for (const [key, value] of this.windows) {
      if (value.until <= this.now()) this.windows.delete(key);
    }
  }
}
