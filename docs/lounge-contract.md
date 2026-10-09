# Closed-alpha lounge extension

GAME_SPEC.md remains the source of truth. This document defines the approved extension for the Gist Lounge; it does not change the master spec. Open public lounge release remains deferred under §1.7.

Every command uses the existing signed guest session, UUID v4 requestId, strict shared schema and cached ACK envelope. No user IDs or credentials are exposed in lounge projections.

| Event | Payload besides requestId | ACK data |
| --- | --- | --- |
| lounge:join | nickname, avatarId, acceptedAdultBoundary: true, optional accessCode | joined: true |
| lounge:leave | none | left: true |
| lounge:send | text (1–500 characters) | messageId |
| lounge:block | targetMemberId, blocked | blocked |
| lounge:report | messageId, category: HARASSMENT/SPAM/HATE/PRIVACY/OTHER | reportId |

Server `lounge:snapshot` contains selfMemberId, real connected guest members, the last 100 visible messages, and owner-only blockedMemberIds. Snapshot updates replace the feed and membership after commands and connections. `lounge:left {reason: LEFT | ROOM_JOINED}` detaches every tab for that guest. Reserved presence/message events are typed but the current adapter uses complete snapshots. Local mute hides messages in the current screen; block filters history and future messages server-side, including reconnects. Reports retain a private message copy for moderator review. The queue is bounded at 1,000 reports; overflow produces an explicit error.

Development enables the lounge by default. Production is closed unless LOUNGE_MODE=closed_alpha, LOUNGE_ACCESS_CODE and LOUNGE_MODERATOR_TOKEN are configured. Admission requires an adult self-attestation and the invite code. This does not verify age or provide public-release staffing. GET /api/lounge exposes availability only. GET /api/moderation/lounge/reports requires the moderator token in an Authorization Bearer header; this route is not proxied by the frontend. Assign a human moderator for alpha operations. Storage is in memory and reports must be reviewed/exported before restarting the server.

Chat is rendered as escaped text, limited to 500 characters, and limited to 15 sends per guest per minute across room/lounge channels. There are no bots or fabricated lounge occupants. Private room joining removes lounge admission across tabs; lounge commands cannot join private room broadcasts.

The normative room:rematch payload is {roomId, requestId, allowBots}; only the host in AFTERPARTY may reset. The room ID and participants are retained; private match state, consent, readiness, role acknowledgment and chat are cleared. The next start obtains a new server seed; the single authored variant can repeat and random persona assignments can coincide. Request deduplication survives rematches so stale retries cannot replay mutations.

REVEAL advances to AFTERPARTY after the authored 60 seconds, preserving its canonical recap. Room chat uses the spec's AFTERPARTY channel. room:leave uses the normative command/ACK; the extension notification room:left {roomId} clears the departing guest's room in all tabs. Active-match leave is rejected to keep the roster immutable. Friends, publishing, open matchmaking and public social release remain outside this implementation.
