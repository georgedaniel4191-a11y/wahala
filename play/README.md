# WAHALA! — After Dark, the Drama Room

A complete mobile-first browser game, independently deployable from the `play/` directory.

## Play

Public game: https://wahala-game-eight.vercel.app

Six playable mystery cases: three new, escalating two-twist thrillers followed by the three original simpler cases. The new cases are **The Bride Was at Two Weddings**, **The Dead Man Joined the Meeting**, and **One Voice Note. Five Confessions.**

## Gameplay

1. Pick a case and choose solo or pass-the-phone mode (2–5 human players). All remaining seats are honestly identified as computer-controlled.
2. Watch the three-part animated opening, then get private dossiers and objectives.
3. Investigate one lead per human player in each of three rounds. Use a one-time ability instead of an investigation if you wish.
4. Open a sealed evidence envelope, then decide whether to share the verified receipt or keep it private.
5. After round one, see the first twist. In new stories, after round two **Call the Twist** requires one public theory commitment; every human receives a +12-point bonus for a correct deduction. Watch the second twist.
6. Seal three-part individual ballots (actor, cause, best response). Resolve the truth, hidden role missions, evidence chain, team decisions and score, then replay.

All event truth and causal chains are authored and deterministic. Investigations influence what the team knows; public evidence influences computer-player voting. Both solo and local pass-the-phone modes are supported, **not live online play** in this static edition.

## Sound

`audio.js` is a lightweight original generative Web Audio soundtrack; it plays no copyrighted recorded songs, tracks or other external audio files. Five adaptive arrangements (lounge, suspense, investigation, danger, resolution) and distinct effects (tap, discovery, seal, twist, success, reveal). **Music and effects are off by default** until the player chooses **Enable Music** in the game's header. A volume slider controls the in-browser level and persists locally. The game respects mobile audio-unlock restrictions and pauses audio when the tab is hidden. Gameplay works silently.

## Files

- `index.html`: boot order — new episodes, audio engine, original core game, animated UI.
- `after-dark-cases.js`: three new fictional cases, roles, two twists, leads, timelines, and source of truth.
- `game.js`: all original core gameplay, outcomes, scoring, double-twist and theory-wager additions.
- `audio.js`: original synthetic adaptive score / effects and audio controls.
- `arcade-ui.js`, `arcade.css`: illustrated characters, tap-to-meet stage, in-game cast, cutscenes, evidence envelope.
- `after-dark.css`: new story covers, theory board, score reveal, sound settings.
- `style.css`: base visual system.

## Verification and limitations

On November 12, 2026, simulated complete end-to-end state-machine matches passed across six cases, 1/2/3/5 human seat counts and both correct/incorrect theory wagers (27 checked paths). The original Web Audio engine was exercised with a simulated browser audio context; enabling, theme changes, effects, volume, muting and cleanup passed. Vercel production deployment reached READY and every new script/style URL returned HTTP 200. This is not a substitute for an actual iPhone/Android/Desktop browser usability and audio test; those remain to be done.

The existing `client/` + `server/` Socket.IO implementation is separate and still requires persistent multiplayer hosting. The static browser edition does not send players to a real server and does not support cross-location multiplayer yet.
