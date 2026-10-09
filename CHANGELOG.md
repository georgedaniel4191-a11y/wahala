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
