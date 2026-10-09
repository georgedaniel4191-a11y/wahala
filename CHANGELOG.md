# Changelog

## 2026-10-09 — Lobby foundation

- Retained the existing npm/client/server scaffold and added shared TypeScript wire contracts.
- Converted the backend to strict TypeScript with a compiled production entry point.
- Added signed opaque HttpOnly guest sessions and authenticated Socket.IO connections.
- Implemented authoritative private create/join/ready/resume commands, strict Zod validation,
  UUID request receipts, deduplication, membership checks, and five-seat capacity.
- Added public-only room updates, owner-only snapshots, rate limits, 90-second reconnect
  reservations, multi-tab seat reuse, idle expiry, and host transfer after seat expiry.
- Added mobile create/join forms, invite links, five-seat roster, ready/unready, connectivity,
  and explicit readiness consent for AI-enabled room preferences.
- Added domain/integration tests and browser tests covering separate guests, synchronized
  readiness, capacity, cookie privacy, recovery, and consent.
- Story, voting, bot fill, start transitions, persistence, and the remaining roadmap are deferred.

See README.md for assumptions, environment variables, and verification commands.

## 2026-10-09 — Story initialization and secret role assignment

- Added spec-exact `room:start`, `game:started`, `game:phase`, `role:assign`, and
  `role:acknowledge` contracts; the server transitions `LOBBY -> ROLES`.
- Extracted the exact JSON schema / screenshot case from the master spec, generated
  server-only types, and added AJV 2020 plus semantic reference/ownership validation.
- Added cryptographically seeded, unbiased five-person allocation, immutable canonical
  truth, case hash, and seed commitment. Only the host can start five connected ready seats.
- Added owner-only role delivery and private snapshot recovery, preserving Tobi, Ada,
  Zainab, Emeka, and Feyi cards verbatim, with no public roles/seed/truth exposure.
- Locked roster after start and added idempotent owner acknowledgment.
- Added sealed/reveal/hide Secret Dossier screen and host start button.
- Added deterministic case, authorization, privacy, multi-tab, reconnect, and browser
  role-flow tests. Investigation timers, chat/actions, voting, and bot fill remain deferred.

## 2026-10-09 — Investigation, evidence and player actions

- Added 45-second server-owned role deadline and early advance on all role acknowledgments;
  no host-force-advance event. Implemented exact investigation/settlement/twist phases.
- Added server-authoritative 120-second rounds, 30-second twist and bounded 20-second
  response windows, with deterministic catch-up and a deliberate pre-voting pause.
- Implemented all eight action kinds, revised selection, round-start inventory eligibility,
  deterministic category resolution, addressed replies, atomic copy deals, one-use authored
  abilities, public exposure, contested accusations, private traces and round-two memories.
- Added exact investigation socket contracts, strict schemas and private delivery routing,
  pending-request/receipt replay on resume, a private hash-chain ledger and settlement records.
- Added investigation phase/countdown, statement feed, expandable evidence board, private
  dossier, action drawer, challenge/deal response controls and public lead metadata.
- Added timer, authorization, privacy, inventory, ability, expiry, disconnect, abandonment,
  nested-payload deduplication and five-player browser investigation tests.
- Voting, reveal, bots and durable PostgreSQL recovery remain deferred.
