# Wahala — private lobby foundation

Next.js, TypeScript, Tailwind CSS, and a long-running Express/Socket.IO backend.
This slice implements room creation, joining, ready/unready, and seat recovery.
All rooms stay in `LOBBY`; there is no story engine, voting, bot fill, or game start.

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

- `client/`: mobile Welcome and five-slot Private Lobby UI.
- `server/src/`: guest sessions, authoritative lobby domain, socket gateway.
- `packages/shared/`: normative wire types and strict Zod command schemas.
- `server/test/`: domain, authorization, concurrency, idempotency, consent, and recovery tests.
- `e2e/`: five independent browser sessions, capacity, readiness, reload, and consent tests.
- `GAME_SPEC.md`: the attached master specification, preserved verbatim.

The existing npm workspace layout is retained for this approved lobby-only slice.
The broader roadmap's pnpm topology, PostgreSQL, deterministic engine, content
validation, and game phases are deferred. Shared contracts contain wire types,
not the story exemplar or canonical case truth.

## Socket contract implemented

Every command uses a UUIDv4 `requestId` and the spec's success/error ACK envelope
(`ok`, `requestId`, `serverNow`, and either `data` or `error`).

- `room:create`: private mode, case ID, nickname, avatar, `botPolicy`.
- `room:join`: six-character room code, nickname, avatar.
- `room:ready`: room ID, boolean readiness, optional AI consent flags.
- `state:resume`: room ID; authenticated owner only.
- Server events: `room:updated`, owner-only `state:snapshot`, and expiry `room:closed`.

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
- The last socket disconnect resets readiness/consent and reserves the seat for 90 seconds.
  Returning within that window preserves participant ID. Other tabs keep the seat connected.
- Disconnected seats expire after 90 seconds; if the host expires, the oldest remaining
  participant becomes host. An empty room closes. Idle lobbies close after 30 minutes.
- Humans-only is the default. An AI-enabled lobby requires both explicit consent flags
  before ready. Unready/disconnect clears consent. No bots are inserted in this slice.
- All-ready updates the lobby display only; it never advances the phase.
- Leave, kick, lock controls, changing bot policy, chat, fill, and start are deferred.
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
