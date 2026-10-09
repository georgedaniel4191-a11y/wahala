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
