# Wahala — private case, sealed ballots and the Big Reveal

Next.js, TypeScript, Tailwind CSS, and a long-running Express/Socket.IO backend.
This slice implements room creation, joining, ready/unready, seat recovery, and
secure story initialization / role assignment. The host starts the case when all
five owners are connected and ready. The room enters `ROLES`; each owner receives
only their authored opening card. The server then runs three timed investigation
rounds with settlement, evidence, abilities and private memory, followed by sealed
voting and the staged Big Reveal. Afterparty, Gist Lounge and bot fill are deferred.

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
and selects **Proceed to Investigation** to acknowledge it. Investigation begins
when everyone acknowledges or the 45-second server role deadline expires.
After the final settlement, each player seals a three-part ballot. Results appear
when all five ballots are sealed or the 45-second voting deadline expires.

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

The browser tests start/stop both built services themselves. A worker starts the
built backend with an injected test clock controlled only through process IPC,
so full matches run quickly without adding clock controls to production sockets
or HTTP routes. The frontend remains the production Next.js build. Install a Playwright
Chromium browser (`npx playwright install chromium`), or point to an existing one:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

## Workspace

- `client/`: mobile Welcome, five-slot Private Lobby, and confidential Secret Dossier, Investigation, Voting and Reveal UI.
- `server/src/`: guest sessions, authoritative lobby domain, investigation/voting processor, pure scoring and socket gateway.
- `packages/shared/`: normative wire types, strict Zod command schemas, and exact case schema.
- `packages/content/`: the exact server-only screenshot case extracted from the spec.
- `server/src/case.ts`: AJV 2020 and reference validation, seeded allocation, immutable truth, and owner-safe card projection.
- `server/src/generated/`: server-only TypeScript types generated from the exact JSON schema.
- `server/test/`: domain, authorization, concurrency, idempotency, consent, and recovery tests.
- `e2e/`: five independent browser sessions, capacity, readiness, reload, and consent tests.
- `GAME_SPEC.md`: the attached master specification, preserved verbatim.

The existing npm workspace layout is retained for this approved private-game slice.
The broader roadmap's pnpm topology, PostgreSQL, bots, and
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
- `chat:send`: GAME statements (500 characters); ACK `{ messageId }`.
- `action:submit`: room ID, round, exact `ActionSelection`; ACK `{ accepted: true, selectedAction }`.
- `action:respond`: addressed challenge ID, ANSWER/REFUSE and optional text; ACK `{ recorded: true }`.
- `deal:respond`: addressed offer ID and accept flag; ACK `{ recorded: true }`.
- `vote:cast`: room/request IDs plus `causeId`, `principalActorParticipantId`,
  `resolutionId`; ACK `{ sealed: true }`. One immutable ballot per owner.
- `vote:receipt`: owner-only `{ roomId, sealed: true }`.
- `game:reveal`: public `{ roomId, reveal: RevealView }`, emitted once after voting
  closes. Exact spec fields: correct ballot, three tally maps, group success, actor
  identification, canonical chronological chain, mission outcomes, CASUAL mode,
  authored summary and case content hash. No raw ballots, seed, hidden identities
  or role-card array. Reveal is restored through owner snapshots after reconnect.
- Investigation events use the exact spec names: `role:memory`, `game:twist`,
  `game:event`, `evidence:private`, `evidence:public`, `action:respond_requested`,
  `deal:offered`, `action:resolved`, and `chat:message`. Private evidence, memories,
  requests and resolution receipts are unicast to the authenticated owner.

`role:assign` has exactly the spec payload: `roomId`, `personaId`, `startingMemory`,
`mission` (ID/description), `ability` (ID/description), and `startingEvidence`.
No full role array, `blindInvolvement`, canonical chain, correct answers, mission
predicates, or seed is delivered. Midgame memory is delivered only to its owner in
round two. `game:started` exposes only the
public intro/cast and seed commitment. Private snapshots restore only the owner's
role, unlocked memories, evidence, ability usage and current action; a second tab
with the same session gets the same private state. Pending settlement requests and
owner resolution receipts are replayed on resume.

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
- In the lobby, the last socket disconnect resets readiness/consent and reserves the seat for 90 seconds.
  Returning within that window preserves participant ID. Other tabs keep the seat connected.
- Disconnected lobby seats expire after 90 seconds; if the host expires, the oldest remaining
  participant becomes host. An empty lobby closes. Idle rooms close after 30 minutes.
  Once in `ROLES`, the five-seat roster remains immutable, even if a player is absent;
  disconnect/reconnect never reshuffles or replaces roles. Readiness and role
  acknowledgment remain locked for those original participants.
- Humans-only is the default. An AI-enabled lobby requires both explicit consent flags
  before ready. Unready/disconnect clears consent. No bots are inserted in this slice.
- All-ready enables the host start button; readiness alone never advances the phase.
- `ROLES` lasts at most 45 seconds, with early advance on all acknowledgments. There
  is no host-force-advance event. Role acknowledgment is idempotent while in ROLES.
- Exact flow: `INVESTIGATION_1 -> SETTLING_1 -> TWIST -> INVESTIGATION_2 ->
  SETTLING_2 -> INVESTIGATION_3 -> SETTLING_3`. Rounds last 120 seconds, twist 30
  seconds, and settlement up to 20 seconds; settlement finishes early when no
  responses remain. Final settlement advances into a 45-second VOTING window.
- Choices can be revised until cutoff; the last legal selection wins. Absent seats
  default to PASS. Freeze round-start inventories; resolve discovery, abilities,
  exposure, challenges/defense, then deals. Newly acquired receipts become eligible
  for exposure/trade next round. Deals copy both verified receipts atomically.
- One-use abilities are consumed at resolution, not selection. Tobi observes only
  another participant's selected lead, never their result; Ada/Zainab/Emeka grant
  their authored receipts; Feyi delays only the optional joke clue in round one,
  which is released no later than round-two settlement. The true joke context is
  used verbatim; no fabricated accusation is labeled verified evidence.
- Public evidence and accusations survive reconnect. Defense marks an accusation
  contested and never deletes evidence. Player statements are labeled separately
  from verified receipts and may be mistaken. Two independent decisive leads remain
  accessible. Public lead IDs/labels come from `/api/cases`, without private content.
- Server deadlines drive all progression, with deterministic catch-up after delayed
  callbacks. Client countdowns use server time plus monotonic elapsed time only for
  display. Fewer than two connected players for over 120 seconds abandons the case.
- The synchronous per-room processor maintains a private ordered hash-chain ledger
  and round-settlement inventory records. These are in-memory development records,
  not durable database snapshots or kill/restart recovery.
- Each owner seals exactly one validated cause/actor/resolution ballot. Other
  owners cannot inspect it. Ordinary votes do not change public versions, events
  or counts. The owner's `SelfView.myBallot` restores their selections on resume;
  identical request retries return the original ACK without casting again.
- VOTING ends on all five ballots or the exact 45-second server deadline. Missing
  ballots abstain; the electorate remains five and every category needs at least
  three votes. Ties and fewer than three votes are unresolved; there is no host
  tie-breaker. Group success requires the correct cause AND resolution majorities;
  actor identification is independent. Missions use the authored predicates,
  including the participant's own vote, public evidence and executed trace actions.
- REVEAL shows accusations/tallies, the canonical cause/actor/resolution, then the
  chronological chain, important public actions, memory gaps and mission outcomes.
  Chapters are skippable, keyboard accessible and support reduced motion. Claims
  remain distinct from verified facts; no automatic lie detection is invented.
- The reveal presentation has the spec's 60-second server deadline. On expiry the
  server stays in REVEAL with `deadlineAt: null`; results remain readable. There is
  no Afterparty, Gist Lounge, rematch or identity epilogue in this slice. Once a
  canonical reveal exists, subsequent disconnects cannot cancel or rescore it.
- The exemplar has one authored variant (`wrong_attachment_v1`). No new variants or
  character cards are invented; content publication/solvability review remains future work.
- Leave, kick, lock controls, changing bot policy, lobby/afterparty chat, and fill are deferred.
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
