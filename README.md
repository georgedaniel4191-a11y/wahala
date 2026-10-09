# Wahala — private lobby and secret roles

Next.js, TypeScript, Tailwind CSS, and a long-running Express/Socket.IO backend.
This slice implements room creation, joining, ready/unready, seat recovery, and
secure story initialization / role assignment. The host starts the case when all
five owners are connected and ready. The room enters `ROLES`; each owner receives
only their authored opening card. Investigation, voting, and bot fill are deferred.

## Run locally

Use Node.js 24 LTS and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open **http://localhost:3000**. The backend runs on port **4000**.
Use separate browsers or incognito browser sessions to represent separate players.
Tabs in the same browser session share one guest identity and one seat.
Create a room, copy its invite, and let other players join and mark themselves ready.
The host can then select **Start case**. Each player reveals their private dossier
and selects **Proceed to Investigation** to acknowledge it. This currently records
acknowledgment and keeps the room in `ROLES`, awaiting the next implementation slice.

```sh
npm run build       # shared contracts, server JS output, Next.js production build
npm start           # both built services
npm run dev:server  # backend only
npm run dev:client  # frontend only
npm run lint
npm run typecheck   # strict checks, including server tests
npm test            # domain and real Socket.IO integration tests
npm run test:e2e    # browser lobby tests; build first
```

The browser tests start/stop both built services themselves. Install a Playwright
Chromium browser (`npx playwright install chromium`), or point to an existing one:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

## Workspace

- `client/`: mobile Welcome, five-slot Private Lobby, and confidential Secret Dossier UI.
- `server/src/`: guest sessions, authoritative lobby domain, socket gateway.
- `packages/shared/`: normative wire types, strict Zod command schemas, and exact case schema.
- `packages/content/`: the exact server-only screenshot case extracted from the spec.
- `server/src/case.ts`: AJV 2020 and reference validation, seeded allocation, immutable truth, and owner-safe card projection.
- `server/src/generated/`: server-only TypeScript types generated from the exact JSON schema.
- `server/test/`: domain, authorization, concurrency, idempotency, consent, and recovery tests.
- `e2e/`: five independent browser sessions, capacity, readiness, reload, and consent tests.
- `GAME_SPEC.md`: the attached master specification, preserved verbatim.

The existing npm workspace layout is retained for this approved lobby-only slice.
The broader roadmap's pnpm topology, PostgreSQL, investigation reducer, bots, and
later game phases are deferred. Shared runtime contracts contain no authored case
truth. The schema and exemplar JSON are copied verbatim from `GAME_SPEC.md`; case
content is read only by the backend, never imported into the frontend. Build/type
checks regenerate server case types (`npm run generate:case --workspace server`).

## Socket contract implemented

Every command uses a UUIDv4 `requestId` and the spec's success/error ACK envelope
(`ok`, `requestId`, `serverNow`, and either `data` or `error`).

- `room:create`: private mode, case ID, nickname, avatar, `botPolicy`.
- `room:join`: six-character room code, nickname, avatar.
- `room:ready`: room ID, boolean readiness, optional AI consent flags.
- `state:resume`: room ID; authenticated owner only.
- `room:start`: room ID; host-only, exactly five connected ready owners; ACK `{ phase: "ROLES", version }`.
- `role:acknowledge`: room ID; authenticated owner only; ACK `{ acknowledged: true }`.
- Server events: `room:updated`, owner-only `state:snapshot`, expiry `room:closed`,
  public `game:started` / `game:phase`, and owner-only `role:assign`.

`role:assign` has exactly the spec payload: `roomId`, `personaId`, `startingMemory`,
`mission` (ID/description), `ability` (ID/description), and `startingEvidence`.
No full role array, `blindInvolvement`, midgame memory, canonical chain, correct
answers, mission predicates, or seed is delivered. `game:started` exposes only the
public intro/cast and seed commitment. Private snapshots restore only the owner's
opening role and receipts; a second tab with the same session gets the same card.

The server sets participant identity from the guest session, never from a claimed
participant ID. Public participant projections omit account IDs, socket IDs,
participant kinds, consent internals, and private game data. Commands reject
unknown fields. Room mutations commit synchronously on one process with no await
between capacity checks and insertion. Duplicate `(session, requestId)` commands
return their original ACK; reuse with different validated data/event is rejected.

## Current behavior and assumptions

- One lobby per guest session; nickname is a display label, not an identity.
- Nicknames: 1–24 characters, letters/numbers and basic punctuation. Five preset avatar IDs.
- Room codes: six cryptographically random characters, excluding ambiguous `I`, `O`, `0`, `1`.
- Exactly five available seats; disconnected reserved seats still occupy capacity.
- Start uses a server-generated 256-bit seed and HMAC-SHA256 counter RNG with
  rejection sampling / Fisher–Yates shuffle. Variant, persona assignment, truth,
  seed commitment, and case hash lock before any card is delivered. Client-supplied
  seeds/participant IDs are rejected by the strict command schema. The seeded
  function can be called directly by server-only tests for deterministic replay.
- The last socket disconnect resets readiness/consent and reserves the seat for 90 seconds.
  Returning within that window preserves participant ID. Other tabs keep the seat connected.
- Disconnected seats expire after 90 seconds; if the host expires, the oldest remaining
  participant becomes host. An empty lobby closes. Idle rooms close after 30 minutes.
  Once in `ROLES`, the five-seat roster remains immutable, even if a player is absent;
  disconnect/reconnect never reshuffles or replaces roles. Readiness and role
  acknowledgment remain locked for those original participants.
- Humans-only is the default. An AI-enabled lobby requires both explicit consent flags
  before ready. Unready/disconnect clears consent. No bots are inserted in this slice.
- All-ready enables the host start button; readiness alone never advances the phase.
- Role acknowledgment is stored server-side and repeat acknowledgments are no-ops.
  Role countdown/scheduling and `ROLES -> INVESTIGATION_1` are deliberately deferred;
  `deadlineAt` stays null. After reload, repeating acknowledgment is safe.
- The exemplar has one authored variant (`wrong_attachment_v1`). No new variants or
  character cards are invented; content publication/solvability review remains future work.
- Leave, kick, lock controls, changing bot policy, chat, and fill are deferred.
  Closing all tabs and waiting for seat expiry releases membership.
- **State is in memory.** Guest sessions, request receipts, and rooms are lost on server
  restart; the client returns to entry when its previous seat is unavailable. This is
  a local development foundation, not the spec's PostgreSQL-backed production recovery.

## Environment and deployment

The Next.js client proxies `/api/session/*` and `/socket.io/` to the backend, so
session cookies and socket transport are same-origin in the browser. Next.js is
configured to preserve Engine.IO's required trailing slash. Polling can upgrade to
WebSocket; both remain cookie-authenticated. Same-origin polling validates Referer
when the browser omits Origin; mismatched Origin is always rejected.

- `CLIENT_ORIGIN`: backend trusted browser origin (default `http://localhost:3000`).
- `SERVER_URL`: backend URL for Next.js rewrites (default `http://127.0.0.1:4000`);
  set before building the client when the backend address differs.
- `SESSION_SECRET`: server-only signing key; required with at least 32 characters
  when `NODE_ENV=production`. Development uses a random per-process key.
- `COOKIE_SECURE`: defaults to true in production and false locally. Keep true behind HTTPS.

The guest cookie is opaque, signed, HttpOnly, SameSite=Lax, and valid for 24 hours.
Session creation, connection attempts, and commands are rate limited. Supply server
variables through the environment; `server/.env.example` documents them. Nothing
secret is returned to browser JavaScript. Before deployment, add durable storage,
shared rate limits, TLS, and a single trusted reverse proxy origin as required by
the master spec. This change does not publish or deploy the app.
