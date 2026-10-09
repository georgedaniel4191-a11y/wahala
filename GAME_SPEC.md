# WAHALA — Master Game Specification & Technical Architecture

**Canonical filename:** `GAME_SPEC.md`  
**Product:** Wahala V1 — **The Wahala Chain**  
**Revision:** 2.1 / optional identity-hidden, disclosed AI participation  
**Status:** Implementation blueprint subject to gameplay validation; no claim that the unbuilt features are production-tested  
**Primary client:** Mobile-first web, portrait-first, PWA-capable  
**Technology:** Next.js / TypeScript / Tailwind; Node.js / Socket.IO; PostgreSQL; optional Redis for scale  
**Age policy:** 18+ for public matchmaking and stranger chat in initial release. A protected minors/family mode requires its own separate product and controls.

## Executive decisions and source-of-truth hierarchy

1. **Build V1 as an independent game.** V2's persistent cities, property, wealth simulation and walkable virtual world are a separate product alternative; **do not build them as V1 prerequisites**.
2. **A case has exactly five PARTICIPANT seats, not five required humans.** Human-first matchmaking starts the standard casual five-seat case with **three to five real people**, filling 0–2 seats with server-identified AI participants. Public identities may remain hidden during an explicitly consented match. All-human private rooms remain possible.
3. **AI-presence disclosure is mandatory; per-character disclosure can be optional.** Before opting in, every player sees a clear, non-repetitive notice that some characters may be AI-controlled, and can choose Humans Only. For the separately consented `IDENTITY_HIDDEN` presentation, no per-character AI badges or counts appear during a match; an optional post-game reveal identifies AI-controlled characters. Never claim an AI is human, fabricate human occupancy or promise friendship with an NPC.
4. **There is a viable nonmatchmaking path.** Solo practice is clearly presented as 1 human against four AI-controlled characters before entry, although in-match character cards may use the normal visual style. Two humans plus three AI is an **experiment**, not the default live social queue.
5. **Truth is deterministic; strategy is not.** The case's full causal truth, evidence and secret goals are locked before role assignment. Only player and bot choices change the information available, decisions and result. No AI model may invent facts, rewrite canonical truth, award points or adjudicate winning.
6. **Private role + blind involvement coexist.** Every participant knows their public persona, starting memory, one-use ability and personal objective. They initially lack full knowledge of the effect of their fictional past actions. Their secret involvement is discoverable through case-consistent evidence and memory fragments.
7. **Decisions are expensive and reversible only until submitted actions lock.** Each participant has one consequential action per investigation round, three rounds per case, and a deterministic action-resolution protocol.
8. **Game first, social second, ad-supported later.** Match fun, fair deduction and strong replay are launch gates; Lounge, mutual friendship, recurring community play and sponsored placements increase retention and commercial scope after safe foundations exist.

**Rule precedence:** (a) security/privacy/access control and truthful consent > (b) locked server rules > (c) semantic case validator > (d) bot policy > (e) identity-hidden presentation and storytelling. If text examples conflict with normative types, the typed wire contract, case schema and tested reducer should be amended *together*, never silently diverge.

**Feature status:** `MVP` = required to ship closed beta; `BETA` = after core playtest, before public social scale; `LATER` = research roadmap; `EXPERIMENT` = A/B or manual tests, not assumed viable.

---

# 1. CORE GAMEPLAY LOOP & RETENTION SYSTEMS

## 1.1 Fantasy, differentiation and non-goals

**Player promise:** **“You know what you did. You don't know what it caused.”**  
**The hook:** **“Everybody knows something. Nobody knows everything.”**

Wahala is a multiplayer, role-hidden, socially generated strategy game. A fictional crisis already happened. Each participant has incomplete but accurate private memories, potentially conflicting missions and constrained powers. During a match they investigate, interrogate, expose receipts, conceal information, make bargains and issue a collective verdict. The **Big Reveal** reconstructs what the server-established causal chain really was and how the group's choices changed the outcome. Nobody is eliminated early.

Core difference from a scripted detective story: **the player is implicated in the situation** and must balance a collective resolution against self-interest. The outcomes should be driven by actual actions, not by scripted “surprise, you were guilty” rewrites. Case generators change a valid *causal framework*, not randomly swap a culprit without fixing downstream receipts.

MVP flagship case: **Who Leaked the Screenshot?** The same engine will later support **Family Meeting, Wedding Committee, Hostel Politics, Office Wahala, The ₦50 Million Mistake and Compound Association**. None of these additional case packs is required for the first successful vertical slice.

**Explicit non-goals:** virtual property/economy/trading; large avatar-operated city; political campaign features; ad interruption during role/ballot/reveal; unmoderated public stranger chat; AI falsely claiming to be a real person; free-form LLM control over story truth; leaderboard points earned by farming practice bots.

## 1.2 Seating, human requirements and game modes

| Queue / mode | Human seats | Bot seats | Start rule | Scoring | Status |
|---|---:|---:|---|---|---|
| Friends / Humans Only | 5 | 0 | All five ready, host starts | Casual, human-only statistics | MVP |
| Friends / Allow Bots | 3–5 | 0–2 | Host taps **Fill & Start** after all ≥3 human participants consent to possible AI participation and identity-hidden display; seats fill atomically | Unranked casual; server records mix | MVP |
| Quick Play / Human-first | 3–5 | 0–2 | Search humans first, then offer an explicit choice to play with possible hidden-identity AI after wait threshold | Unranked casual; server records mix | BETA |
| Solo Case Practice | 1 | 4 | On demand; mode itself is clearly labelled AI practice before entry | Tutorial only; no competitive rank or referral rewards | MVP, reduced content |
| Duos + NPCs | 2 | 3 | Separate consented experiment | Unranked | EXPERIMENT |
| Human-only Competitive | 5 | 0 | All real, anti-collusion checks, enough population | May support seasonal skill ratings | LATER |

**Five seats is a content-schema constraint, not an onboarding constraint.** The current case JSON sets `settings.playerCount = 5`. Keep that constant through the initial release. Do **not** also ship hastily shortened three-person case variants: they would require new evidence, mission and quorum balancing. In the mixed session, three humans + two bots still play the full five-role case.

**Matchmaking policy proposal:** On Quick Play press, show 'Finding people', queue by age entitlement, requested language/region preference if voluntarily provided, and party compatibility. Seek all-human games first. After **15–25 seconds** (configurable, product hypothesis), offer **Play now — this match may include AI-controlled characters; which ones are AI stays hidden until you choose to reveal after the round**. This notice is shown and accepted **before** any AI fill. Never silently insert AI after promising a humans-only game. Start upon ≥3 confirmed humans (pre-match disconnects do not count). Private rooms allow host setting `humans_only | allow_bots`; **each human must consent to possible AI and identity-hidden presentation in the ready flow** before host fill. Changing policy resets consent and ready state. Show one concise consent notice and a persistent accessible help entry; do not show per-character AI badges during the match. Backend telemetry always retains true counts. A bot seat cannot later be replaced with a human once the canonical case is committed. Players who arrive afterward may queue for the next match.

**Disconnects:** 90-second human reconnection reservation and deterministic `PASS`/`ABSTAIN` while absent; do not quietly replace a live human with a bot. A bot takeover may be tested in a separate future mode only after clear pre-entry disclosure of takeover possibility and consent; never covertly replace a connected human. If live human count drops below two for >120 seconds in standard social play, cancel as `ABANDONED` with no leaderboard rewards. Practice continues separately.

## 1.3 Normative phase machine and timing

| Public phase | Target duration* | Player experience | Server actions |
|---|---:|---|---|
| `LOBBY` | Untimed; room TTL | Find players, opt into bots, invite, chat, ready | Enforce chosen fill policy and verified human count; lock seats on start |
| `ROLES` | 45s | Private dossier and optional tap-to-reveal | Lock seed and story variant, persona mapping and bot policies; send owner-only cards |
| `INVESTIGATION_1` | 120s | Read crisis, question, choose first move, casual discussion | Receive at most one action per seat, override until lock; bot engine chooses internally |
| `SETTLING_1` | ≤20s | Review reactions, answer challenge/deal requests | Freeze actions; resolve deterministic categories; handle concessions and responses |
| `TWIST` | 30s | Show verified world event, spark new suspicion | Release scheduled public information, apply valid optional delay |
| `INVESTIGATION_2` | 120s | Midgame memory fragments, evidence, negotiations | Deliver once-per-seat memory; action round 2 |
| `SETTLING_2` | ≤20s | Resolve challenges and deals | Apply deferred evidence transactions |
| `INVESTIGATION_3` | 120s | Final action and negotiation | Action round 3; no new rounds after expiry |
| `SETTLING_3` | ≤20s | Last replies and final evidence | Clear pending offers/challenges, flush stable ledger |
| `VOTING` | 45s | Sealed cause + principal actor + resolution ballot | All human and NPC ballots count by same rules; missing => abstain |
| `REVEAL` | 60s | Results → identities → receipts → mission outcomes | Evaluate from locked truth; issue safe public reveal projections |
| `AFTERPARTY` | Until exit or TTL | Chat, friend request, share, rematch, return to lounge | Persist analytics, consent to publishing, rematch reseeds and refills explicitly |

*Timings are **playtest defaults**; actual session is ~10–12 min, excluding room wait and afterparty. `SETTLING_*` is an **explicit protocol phase**, visible as a nonblocking “Resolving actions” panel. No reply request is issued after its deadline. Each settled round freezes a start-of-round inventory snapshot for eligibility.

**Opening beat:** Players receive a public intro, but **no role** is exposed in public roster beyond the fictional public persona. **Twists:** verified facts may redirect attention but must not fabricate evidence; role memories are accurate albeit incomplete. **Voting:** no early elimination; clients cannot inspect other ballots before REVEAL. **Afterparty:** no compulsory exit, with explicit content/report controls and a two-tap same-group rematch.

## 1.4 Information model, deductions and truth

| Category | Before reveal | Guarantee |
|---|---|---|
| Canonical chain, correct cause/actor/resolution | Server-only, locked | Immutable |
| Public clues and system-verified receipts | Room or approved owner | Factually accurate |
| Private initial memory / midgame memory | Assigned participant only | Accurate but incomplete |
| Full personal involvement | Server; owner can unlock portions | Fixed, discoverable |
| Private objective, one-use ability | Assigned participant / bot policy | Server-evaluated |
| Chat statement / promise / accusation | Addressees | Can be mistaken or a bluff |
| Bot identity | **Server at all times; optional player-triggered postgame disclosure** | All humans consent to AI possibility before play; no claim that AI is human |

**Fairness invariant:** A seeded case must expose **≥2 independent routes to decisive facts**, and at least one must remain accessible to humans in a 3-human/2-bot game without assuming a bot voluntarily reveals the truth. A bot holding a unique clue must not create an involuntary information bottleneck. A red herring is a **true but misleadingly contextualised fact**, not falsified “verified evidence”. Room truth, role assignment and bot observation boundaries must never be bundled in public web assets.

## 1.5 Action taxonomy, simultaneous decisions and response windows

Each of five participants chooses **one** action each of the three investigation rounds. Bots use the identical action schema and are never privileged with the truth. Players may change choices until the cutoff; last legal submitted action wins. Each action is server-authorised. Responses to encounters are handled in the ensuing `SETTLING_N` response period and do **not** cost the recipient's next investigation action.

| Action | Arguments | Resolution | Cost / counterplay |
|---|---|---|---|
| `INVESTIGATE` | `leadId` | Grant next eligible private verified clue from lead | Uses action; lead can be exhausted |
| `CONFRONT` | `targetParticipantId`, `question` | Publicly open challenge, collect answer/refusal in settlement | Answer can bluff; no forced truth |
| `EXPOSE` | evidence owned at round start | Publish verified receipt to group | Irreversible; may undermine secret mission |
| `MAKE_DEAL` | target, offered receipt, requested receipt | If both held at round start and accepted in settlement, atomically exchange copies | Target may refuse; no fabricated evidence |
| `DEFEND` | accusationId, target, explanation | Contest an existing public accusation marker | Cannot delete a fact, vote or evidence |
| `TRACE_SELF` | none | Unlock next own memory fragment | Gives self-knowledge instead of external clue |
| `ABILITY` | own ability ID + validated target | One-use special effect (e.g., grant evidence, trace investigated lead, delay noncritical twist) | Same action slot, strict preconditions |
| `PASS` | none | No change | Automatic after timeout |

**Resolution invariant:** At investigation cutoff: lock choices, build immutable start-of-round snapshot, resolve `TRACE_SELF`/`INVESTIGATE` → `ABILITY` → `EXPOSE` → `CONFRONT`/`DEFEND` → issue `MAKE_DEAL` offers. Bot responders choose a deterministic response from their allowed observation before settlement deadline; humans respond or timeout. Finalise replies/deals, publish bounded public events, persist snapshot, advance. Receipt discovered in round N **cannot** be exposed/traded until round N+1; all `EXPOSE` and `MAKE_DEAL` ownership checks use snapshot holdings. If bot-to-bot trade would produce cascading receipts, no same-round re-use is permitted.

`DEFEND` marks accusations contested; it does not alter guilt probabilities. Open and contested accusations may be displayed as counts, **never as a misleading numeric “guilt score”**. Every bot is subject to the same phase validation, power exhaustion, ownership and replay ledger as a human.

## 1.6 Sealed ballot, win and loss

All five seats cast one ballot (bots do so through the internal bot policy; disconnected humans default to abstain):

1. `causeId` — choose among case-listed explanations;
2. `principalActorParticipantId` — choose the participant assigned the key causal persona;
3. `resolutionId` — choose among case-listed resolutions.

**Majority per field is ≥3 of 5**, independently. Ties, no majority and abstention preventing majority yield `unresolved` for that field. There is no host tie-breaker. `groupSuccess = (majorityCause == correctCauseId && majorityResolution == correctResolutionId)`. Show `actorIdentified = (majorityActor == canonicalPrincipalActor)` separately. Personal mission evaluated from explicit deterministic predicates in story data, not by AI. Mixed-human/bot matches use same outcome rules but are tagged `MIXED_CASUAL`, not rated. Solo practice never earns competitive rewards.

At reveal, show (a) majority selections and per-category success, (b) evidence-backed causal chain, (c) everyone’s private mission and success, and (d) the decisive player actions. All matches may end in group + personal success, either alone, or both failing.

**Bots and tie outcomes:** AI has full legitimate ballot participation, which can change a majority in a mixed match. That makes these matches **casual** by design. For public beta, compare bot-impact rates and whether bots dominate votes; if so, lower NPC number, alter bot policy, or limit modes rather than covertly fixing ballot outcomes.

## 1.7 Replayability and retention architecture

**Within a round:** blind involvement → asymmetrical evidence → personal mission conflict → limited action trade-offs → socially negotiated commitments → verifiable result. This needs to hold up when players replay the same framework.

**Immediate rematch:** reshuffle real/bot participants across personas, choose next prevalidated causal variant, reset memory/evidence/mission/power resources, offer two-tap rematch, retain friend group if desired. Do not re-roll the actual truth in the middle of a session.

**Revisit reasons:** real friendships and afterparty conversations; unique assignments and hidden-chain variants; meaningful mastery and match histories; opt-in social reputation titles (“Master Investigator”, “Chaos Magnet”, “Diplomat”) and cosmetics; scheduled Mystery Nights and community sessions; weekly *The Wahala Times* with upcoming games and **consented** highlight stories. NPC names do not become artificial friends or send fake personal notifications; postgame friendship actions are available only for actual human accounts.

**The Wahala Times (V1 edition):** weekly in-world case bulletin, fictional case highlights, new cases, community game-night programme, consented player achievements and transparently sponsored editorial inventory. It is **not** V2’s persistent virtual civic newspaper. Never publish private-chat transcripts or sensitive identity in a share card without opt-in.

**Social Lounge:** `BETA` moderated adult live chat and discovery, quick-play queue, interest-based group rooms and mutual friends. An audience must be able to talk without being forced to play a role. **Afterparty** is included with the first private vertical slice; the public lounge is released only with staffing, abuse report handling, anti-spam and age boundaries.

**Commercial model (post proof of fun):** labelled game-lobby sponsorship, optionally sponsored case environments, hosted game nights, sponsored content in *The Wahala Times*, premium hosting and optional cosmetic content. Ads cannot access private roles, chat, scoring or votes, and cannot alter role assignment or probabilities. Log aggregated viewable ad engagement only. A limited non-withdrawable cosmetic currency is `LATER`; billions, virtual property, businesses and billboards are V2, not V1.

**Politics:** a future fictional/nonpartisan civic-budget game is optional. No real candidate endorsements, partisan manipulations, or pay-for-political-choice voting/rewards. Protect the integrity of the platform around election periods.

## 1.8 Bot system — normative, not a decorative fill feature

### Identity, informed participation and fairness

**Policy: `IDENTITY_HIDDEN` is a consented presentation mode, not a deception engine.** Backend always stores `kind: 'human' | 'bot'` for each seat. Before a mixed match, humans must receive a concise disclosure that AI-controlled characters **may participate** and their individual identities will not be displayed during play. Users must be able to decline bot fill or choose Humans Only before committing. Do not use fake human occupancy counters, human typing indicators for bot messages, false personal histories, or bots pretending to be actual people. A player can review the disclosure in `Match Info` throughout the session without displaying AI badges next to each character.

**Hidden presentation:** Human-facing lobby roster, case cast, investigation chat, voting and default Big Reveal use the same character presentation regardless of seat type; **no `AI`/`HUMAN` label per seat and no exact bot count before optional identity reveal**. Player names are fictional character aliases, not deceptive claims of a real-world identity. The server alone has the full seat-type mapping. The standard reveal still shows truthful votes, missions and chain, but AI identity attribution is delivered separately only when the user taps **Reveal AI identities**. That per-user request must not change the shared game state or reveal hidden information prematurely.

**Limits of identity concealment:** Removing `AI` badges protects the surprise at the interface level; it does **not** guarantee that an attentive player cannot infer who is AI. In private rooms, people who personally invited the human participants may already know which seats were filled later. Do not advertise this as unbreakable anonymity. Future Quick Play can optionally assign fresh fictional display personas at match start to reduce obvious roster clues, but that requires a carefully tested identifier mapping and must not conceal actual humans from safety/reporting tools.

**Afterparty:** Do not present fictional character aliases as verified human friends. Characters are not presented as available real friends. The afterparty does not simulate continuing friendships or DMs from bots. Optional **Connect with real players** intentionally opens the post-game human/AI identity view before friend actions. Any failed attempt to connect to a bot is answered honestly. Actual human friend request and messaging permissions are verified on the server. Solo practice states **AI practice** prominently before launch, without giving each character a distracting in-game badge.

Bot characters may use fictional names such as Chief Bode, Aunty Amaka and Zee, but those names and personality are **not evidence of role or culpability**. Culture, region, accent, religion and gender are never used as a proxy for dishonesty or ability.

**Solo practice distinction:** the 1H+4B route may guide the learner by releasing preapproved practice prompts/evidence; it must never be described as a balanced human competitive session, and need not guarantee a group win. The canonical truth is still fixed.

**MVP bot policy:** server-local **rule/utility-based engine** with seeded pseudo-random tie breaks and finite templates. It consumes only a `BotObservation` allowlist: own memory, own objectives, own evidence, own remaining ability, public clues, public actions, visible messages and explicitly shared private messages addressed to it. It does **not** receive canonical truth, other players' private facts, unrevealed roles, seed or final answers. If the bot's own memory *legitimately* explains its involvement, that knowledge is allowed; otherwise no oracle.

**Five policy dimensions:** information seeking, trust in social claims, willingness to disclose, collaboration/negotiation preference, risk tolerance. Choose from pretested personality profiles, independent of the assigned case persona. Examples: `assertive_accuser`, `cautious_investigator`, `cooperative_negotiator`. Each submits intents with explanation codes for testability (not full chain-of-thought). They may bluff in dialogue, but never manufacture forged *verified* receipts.

### Bot planner lifecycle

1. Build `BotObservation` from the same owner-safe projector used for clients; additionally provide legal move descriptors (not spoilers).
2. Enumerate all legal actions. Score expected usefulness toward bot's mission and current evidence with fixed weights and deterministic tie-breaking RNG. Respect intentional imperfect-information behavior. No omniscient pathfinding.
3. Choose action *during the same investigation window* as humans and save through the **same validated action command service**; no bot-only outcome shortcut.
4. On `CONFRONT`/`MAKE_DEAL` directed at the bot, compute `answer/refuse` or `accept/refuse` using its own information, legal ownership and personality within the settlement deadline.
5. Generate short chat lines from bounded templates keyed to legal observations, public events and declared personality; internally retain `authorKind`, but use the identity-hidden chat projection with no author-type badge during consented matches. Bots have per-phase dialogue quotas (default ≤2 unsolicited messages) and cannot spam, make unsolicited DMs, or chat as real users in the lounge.
6. During VOTING, submit a sealed ballot built only from case options and information observed. Use a calibrated guess rule if uncertain; never query `correct.*` directly.
7. Log observation hash, policy version, action scores or ranking IDs, selected action, dialogue template and RNG substream for reproducible audits. Do **not** log unrelated private chat outside stated retention policy.

**Optional generative dialogue (`LATER`):** an LLM can *rewrite a policy-selected utterance* for naturalness after receiving a strictly filtered context, output grammar, token budget, rate limit and toxicity filter. It never chooses the legal action, invents evidence, determines win conditions, sees truth or overrides the validation engine. Failure must fall back to templates immediately. **No paid external AI API is required for MVP.**

### Bot-fill safeguards and operational observability

- A bot cannot receive friend requests as a human or count toward “people online”; internal analytics distinguish live humans and NPCs, but identity-hidden match rosters do not label individual seats.
- Humans are prioritised before NPCs in public queue; users can opt out of bot fill. Bot slots are added atomically before role assignment; the pre-match AI possibility is disclosed and consented, while individual AI seats stay hidden until optional postgame disclosure.
- At 3 humans / 2 bots, critical evidence must remain human-discoverable. Investigations held exclusively by bots must not be the only solvable path.
- No bot-only or mixed mode supports cash-equivalent rewards, purchases tied to winning, real-money wagers or human-only ratings.
- Track **server-only** `humanCount`, `botCount`, `waitMs`, `fillConsent`, `humanToHumanMessages`, `botInterventions`, `botVoteSwing`, `rematchRate`, `D1/D7 retention`, `moderationIncidents`, abandonment and failure rates.
- Compare 5H, 4H+1B, 3H+2B; separately test 2H+3B and 1H+4B as experimental/practice cohorts. Shorter waits alone do not prove engagement.

## 1.9 Acceptance tests for replay and retention

- Run the **10-Round Challenge** with ≥5 groups, around 10 matches per group across multiple days. Record how many voluntarily request rematches after repetitions, not only first-session smiles.
- Verify every generated case has unambiguous truth, valid role missions and at least two independent factual routes, including one human-accessible route in 3H+2B.
- Compare case/completion scores, turns spent communicating with **other humans**, rematches and retention by human/bot mix; do not treat NPC messages as organic community growth.
- Proposed pilot thresholds (design hypotheses): first match completion ≥70%; groups voluntarily rematching ≥35%; invitation/share ≥25%; 7-day new-host rate ≥10%; technical failures <2%. Measure results and revise thresholds rather than treating them as industry standards.
- Track excitement *and* fairness: “Did I have a meaningful choice?”, “Could I have uncovered the answer?”, “Did the bot have an unfair advantage?”, “Would I choose to play again?”

---

# 2. DETERMINISTIC STORY SCHEMA (JSON)

**Revision 2.1 clarification — case schema vs participant roster.** The following original JSON Schema and flagship JSON case are deliberately preserved as **five-seat causal content**. The authored story does not need to know whether a seat belongs to a human or an NPC. The **room runtime**, not the story pack, binds five abstract seat IDs to `human | bot` participants. Therefore `settings.playerCount: 5` means five characters in the case, not five required human accounts. Do not add `socketId`, human identity, bot knowledge, bot personality, queue consent or AI prompts to the case JSON. Those are authenticated runtime/policy concerns under Section 3.

**Artifact extraction contract:** Embed the two JSON code blocks below as separate, unmodified server-owned artifacts: `packages/shared/schemas/case.v1.schema.json` and `packages/content/screenshot_leak_001.json`. Preserve `schemaVersion: 1.0.0` for content, and bump only when the content schema actually changes.

## 2.1 Canonical contract

The following is a **valid JSON Schema Draft 2020-12** for case packs. Store it at `packages/shared/schemas/case.v1.schema.json` and use an AJV 2020 validator at build time and before case publication. Treat this schema as the **source of truth** for authoring data; generate TypeScript types rather than hand-maintaining conflicting interfaces. `additionalProperties: false` disallows accidental game-rule keys.

**Important separation:** Case pack JSON is **server-only content** and contains spoilers. Only derived, access-controlled projections are ever sent to clients. The values under `correct`, `chain`, `blindInvolvement`, secret missions and unreleased evidence are never bundled in the Next.js frontend or sent as public room state.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://wahala.game/schemas/case.v1.schema.json",
  "title": "Wahala Chain Case Pack v1",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "caseId",
    "metadata",
    "settings",
    "causeOptions",
    "resolutionOptions",
    "personas",
    "variants"
  ],
  "properties": {
    "schemaVersion": {
      "const": "1.0.0"
    },
    "caseId": {
      "type": "string",
      "pattern": "^[a-z0-9_]{3,64}$"
    },
    "metadata": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "title",
        "subtitle",
        "locale",
        "rating",
        "estimatedMinutes",
        "tags",
        "sponsorLabel"
      ],
      "properties": {
        "title": {
          "type": "string",
          "minLength": 3
        },
        "subtitle": {
          "type": "string",
          "minLength": 1
        },
        "locale": {
          "type": "string",
          "minLength": 2
        },
        "rating": {
          "enum": [
            "adult_18_plus"
          ]
        },
        "estimatedMinutes": {
          "type": "integer",
          "minimum": 5,
          "maximum": 20
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        },
        "sponsorLabel": {
          "type": [
            "string",
            "null"
          ]
        }
      }
    },
    "settings": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "playerCount",
        "actionRounds",
        "actionsPerRound",
        "seconds",
        "allowEarlyElimination"
      ],
      "properties": {
        "playerCount": {
          "const": 5
        },
        "actionRounds": {
          "const": 3
        },
        "actionsPerRound": {
          "const": 1
        },
        "allowEarlyElimination": {
          "const": false
        },
        "seconds": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "roles",
            "round",
            "twist",
            "vote",
            "reveal",
            "response"
          ],
          "properties": {
            "roles": {
              "type": "integer",
              "minimum": 10,
              "maximum": 300
            },
            "round": {
              "type": "integer",
              "minimum": 10,
              "maximum": 300
            },
            "twist": {
              "type": "integer",
              "minimum": 10,
              "maximum": 300
            },
            "vote": {
              "type": "integer",
              "minimum": 10,
              "maximum": 300
            },
            "reveal": {
              "type": "integer",
              "minimum": 10,
              "maximum": 300
            },
            "response": {
              "type": "integer",
              "minimum": 10,
              "maximum": 300
            }
          }
        }
      }
    },
    "causeOptions": {
      "type": "array",
      "minItems": 3,
      "maxItems": 4,
      "items": {
        "$ref": "#/$defs/option"
      }
    },
    "resolutionOptions": {
      "type": "array",
      "minItems": 3,
      "maxItems": 4,
      "items": {
        "$ref": "#/$defs/option"
      }
    },
    "personas": {
      "type": "array",
      "minItems": 5,
      "maxItems": 5,
      "items": {
        "$ref": "#/$defs/persona"
      }
    },
    "variants": {
      "type": "array",
      "minItems": 1,
      "items": {
        "$ref": "#/$defs/variant"
      }
    }
  },
  "$defs": {
    "option": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "label"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "label": {
          "type": "string",
          "minLength": 3
        }
      }
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]{1,63}$"
    },
    "persona": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "displayName",
        "publicBio"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "displayName": {
          "type": "string",
          "minLength": 2
        },
        "publicBio": {
          "type": "string",
          "minLength": 1
        }
      }
    },
    "mission": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "description",
        "predicate"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "description": {
          "type": "string",
          "minLength": 4
        },
        "predicate": {
          "oneOf": [
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "kind"
              ],
              "properties": {
                "kind": {
                  "const": "group_success"
                }
              }
            },
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "kind",
                "roleId"
              ],
              "properties": {
                "kind": {
                  "const": "role_not_majority_accused"
                },
                "roleId": {
                  "$ref": "#/$defs/id"
                }
              }
            },
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "kind",
                "evidenceId"
              ],
              "properties": {
                "kind": {
                  "const": "evidence_published"
                },
                "evidenceId": {
                  "$ref": "#/$defs/id"
                }
              }
            },
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "kind",
                "roleId"
              ],
              "properties": {
                "kind": {
                  "const": "voted_for_actor"
                },
                "roleId": {
                  "$ref": "#/$defs/id"
                }
              }
            },
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "kind"
              ],
              "properties": {
                "kind": {
                  "const": "trace_self_used"
                }
              }
            }
          ]
        }
      }
    },
    "ability": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "kind",
        "description",
        "limit",
        "effect"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "kind": {
          "enum": [
            "audit",
            "messenger",
            "insider",
            "protector",
            "observer"
          ]
        },
        "description": {
          "type": "string"
        },
        "limit": {
          "const": 1
        },
        "effect": {
          "oneOf": [
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "kind",
                "evidenceId"
              ],
              "properties": {
                "kind": {
                  "const": "grant_evidence"
                },
                "evidenceId": {
                  "$ref": "#/$defs/id"
                }
              }
            },
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "kind"
              ],
              "properties": {
                "kind": {
                  "const": "peek_investigation_lead"
                }
              }
            },
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "kind",
                "evidenceId",
                "delayRounds"
              ],
              "properties": {
                "kind": {
                  "const": "delay_optional_clue"
                },
                "evidenceId": {
                  "$ref": "#/$defs/id"
                },
                "delayRounds": {
                  "const": 1
                }
              }
            }
          ]
        }
      }
    },
    "evidence": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "title",
        "body",
        "kind",
        "release",
        "verified",
        "leadId"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "title": {
          "type": "string",
          "minLength": 3
        },
        "body": {
          "type": "string",
          "minLength": 8
        },
        "kind": {
          "enum": [
            "public_clue",
            "private_evidence",
            "memory_fragment"
          ]
        },
        "verified": {
          "const": true
        },
        "release": {
          "enum": [
            "public_start",
            "private_start",
            "investigate",
            "twist",
            "trace_self"
          ]
        },
        "leadId": {
          "type": [
            "string",
            "null"
          ]
        },
        "initialOwnerRoleId": {
          "type": [
            "string",
            "null"
          ]
        },
        "factTags": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/id"
          },
          "uniqueItems": true
        }
      }
    },
    "roleCard": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "personaId",
        "startingMemory",
        "midgameMemory",
        "blindInvolvement",
        "missionId",
        "abilityId",
        "startingEvidenceIds",
        "traceEvidenceIds"
      ],
      "properties": {
        "personaId": {
          "$ref": "#/$defs/id"
        },
        "startingMemory": {
          "type": "string",
          "minLength": 8
        },
        "midgameMemory": {
          "type": "string",
          "minLength": 8
        },
        "blindInvolvement": {
          "type": "string",
          "minLength": 8
        },
        "missionId": {
          "$ref": "#/$defs/id"
        },
        "abilityId": {
          "$ref": "#/$defs/id"
        },
        "startingEvidenceIds": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/id"
          },
          "uniqueItems": true
        },
        "traceEvidenceIds": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/id"
          },
          "minItems": 1,
          "uniqueItems": true
        }
      }
    },
    "chainEvent": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "minute",
        "actorPersonaId",
        "truth"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "minute": {
          "type": "string",
          "pattern": "^[0-2][0-9]:[0-5][0-9]$"
        },
        "actorPersonaId": {
          "$ref": "#/$defs/id"
        },
        "truth": {
          "type": "string",
          "minLength": 8
        }
      }
    },
    "twist": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "afterRound",
        "headline",
        "publicEvidenceIds"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "afterRound": {
          "const": 1
        },
        "headline": {
          "type": "string",
          "minLength": 4
        },
        "publicEvidenceIds": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/$defs/id"
          },
          "uniqueItems": true
        }
      }
    },
    "variant": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "publicIntro",
        "correct",
        "chain",
        "roleCards",
        "missions",
        "abilities",
        "evidence",
        "twist",
        "investigationLeads",
        "revealSummary"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "publicIntro": {
          "type": "string",
          "minLength": 20
        },
        "correct": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "causeId",
            "resolutionId",
            "principalActorPersonaId"
          ],
          "properties": {
            "causeId": {
              "$ref": "#/$defs/id"
            },
            "resolutionId": {
              "$ref": "#/$defs/id"
            },
            "principalActorPersonaId": {
              "$ref": "#/$defs/id"
            }
          }
        },
        "chain": {
          "type": "array",
          "minItems": 3,
          "items": {
            "$ref": "#/$defs/chainEvent"
          }
        },
        "roleCards": {
          "type": "array",
          "minItems": 5,
          "maxItems": 5,
          "items": {
            "$ref": "#/$defs/roleCard"
          }
        },
        "missions": {
          "type": "array",
          "minItems": 5,
          "maxItems": 5,
          "items": {
            "$ref": "#/$defs/mission"
          }
        },
        "abilities": {
          "type": "array",
          "minItems": 5,
          "maxItems": 5,
          "items": {
            "$ref": "#/$defs/ability"
          }
        },
        "evidence": {
          "type": "array",
          "minItems": 8,
          "items": {
            "$ref": "#/$defs/evidence"
          }
        },
        "twist": {
          "$ref": "#/$defs/twist"
        },
        "investigationLeads": {
          "type": "array",
          "minItems": 2,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "id",
              "label",
              "evidenceIds"
            ],
            "properties": {
              "id": {
                "$ref": "#/$defs/id"
              },
              "label": {
                "type": "string"
              },
              "evidenceIds": {
                "type": "array",
                "minItems": 1,
                "items": {
                  "$ref": "#/$defs/id"
                },
                "uniqueItems": true
              }
            }
          }
        },
        "revealSummary": {
          "type": "string",
          "minLength": 20
        }
      }
    }
  }
}
```

## 2.2 Flagship exemplar: `screenshot_leak_001`

This **schema-valid working exemplar** converts the original “Who Leaked the Screenshot?” into the newer Wahala Chain design. All five personas contributed to the confusion; the principal action was an unintended wrong-attachment forward. Tobi does **not** receive an opening card declaring “you are the leaker.” Tobi knows they forwarded *a file*; `TRACE_SELF` can establish that it was the private screenshot; the scheduled Round 2 memory only reveals that Tobi never previewed the file. The true chain and correct resolution are fixed at generation time. There are two independent investigate-able paths (`delivery_log`, `archive_audit`) to the decisive transfer evidence.

One authored variant is present below (`wrong_attachment_v1`); publication requires at least two additional, internally coherent variants with different actual causal chains. Do **not** synthesize variants by merely changing `correct.causeId` while leaving the evidence unchanged.

```json
{
  "schemaVersion": "1.0.0",
  "caseId": "screenshot_leak_001",
  "metadata": {
    "title": "Who Leaked the Screenshot?",
    "subtitle": "Five friends. One forwarded file. Nobody has the whole story.",
    "locale": "en-NG",
    "rating": "adult_18_plus",
    "estimatedMinutes": 10,
    "tags": [
      "mystery",
      "social",
      "nigeria",
      "blind_involvement"
    ],
    "sponsorLabel": null
  },
  "settings": {
    "playerCount": 5,
    "actionRounds": 3,
    "actionsPerRound": 1,
    "seconds": {
      "roles": 45,
      "round": 120,
      "twist": 30,
      "vote": 45,
      "reveal": 60,
      "response": 20
    },
    "allowEarlyElimination": false
  },
  "causeOptions": [
    {
      "id": "wrong_file_forward",
      "label": "A private image was forwarded to an outsider by mistake"
    },
    {
      "id": "edited_public_quote",
      "label": "A misleading public quote was mistaken for the screenshot"
    },
    {
      "id": "external_account_access",
      "label": "Someone outside the group accessed a member account"
    }
  ],
  "resolutionOptions": [
    {
      "id": "secure_and_correct",
      "label": "Tell the affected person, secure the chat, and correct the record"
    },
    {
      "id": "accuse_publicly",
      "label": "Publish an accusation before the evidence is settled"
    },
    {
      "id": "do_nothing",
      "label": "Ignore the leak and take no further action"
    }
  ],
  "personas": [
    {
      "id": "tobi",
      "displayName": "Tobi",
      "publicBio": "Handles sharing links and event files"
    },
    {
      "id": "ada",
      "displayName": "Ada",
      "publicBio": "Organised the original group discussion"
    },
    {
      "id": "zainab",
      "displayName": "Zainab",
      "publicBio": "Keeps receipts and timelines"
    },
    {
      "id": "emeka",
      "displayName": "Emeka",
      "publicBio": "Often mediates disagreements"
    },
    {
      "id": "feyi",
      "displayName": "Feyi",
      "publicBio": "Made a provocative joke earlier in the chat"
    }
  ],
  "variants": [
    {
      "id": "wrong_attachment_v1",
      "publicIntro": "A private group screenshot appeared outside the chat at 20:42. You must establish how it happened and decide what the group should do.",
      "correct": {
        "causeId": "wrong_file_forward",
        "resolutionId": "secure_and_correct",
        "principalActorPersonaId": "tobi"
      },
      "chain": [
        {
          "id": "capture",
          "minute": "20:14",
          "actorPersonaId": "ada",
          "truth": "Ada saved a screenshot for personal notes within the group."
        },
        {
          "id": "sync",
          "minute": "20:20",
          "actorPersonaId": "ada",
          "truth": "Ada synced her screenshot from personal notes into the shared folder."
        },
        {
          "id": "mislabel",
          "minute": "20:26",
          "actorPersonaId": "emeka",
          "truth": "Emeka renamed a shared folder so the event flyer and screenshot had similar labels."
        },
        {
          "id": "forward",
          "minute": "20:41",
          "actorPersonaId": "tobi",
          "truth": "Tobi forwarded the screenshot attachment to outsider Kemi, believing it was the event flyer."
        },
        {
          "id": "spread",
          "minute": "20:42",
          "actorPersonaId": "zainab",
          "truth": "Zainab noticed the image outside the group and warned the members."
        },
        {
          "id": "joke",
          "minute": "20:45",
          "actorPersonaId": "feyi",
          "truth": "Feyi joked that they had planned to leak it, but did not forward the file."
        }
      ],
      "missions": [
        {
          "id": "m_tobi",
          "description": "Avoid receiving a majority of personal-blame votes.",
          "predicate": {
            "kind": "role_not_majority_accused",
            "roleId": "tobi"
          }
        },
        {
          "id": "m_ada",
          "description": "Get the group to settle the incident responsibly.",
          "predicate": {
            "kind": "group_success"
          }
        },
        {
          "id": "m_zainab",
          "description": "Identify the person who actually forwarded the attachment.",
          "predicate": {
            "kind": "voted_for_actor",
            "roleId": "tobi"
          }
        },
        {
          "id": "m_emeka",
          "description": "Publish the verified file-label receipt.",
          "predicate": {
            "kind": "evidence_published",
            "evidenceId": "file_label_receipt"
          }
        },
        {
          "id": "m_feyi",
          "description": "Avoid receiving a majority of personal-blame votes.",
          "predicate": {
            "kind": "role_not_majority_accused",
            "roleId": "feyi"
          }
        }
      ],
      "abilities": [
        {
          "id": "a_tobi",
          "kind": "observer",
          "description": "Learn which lead one chosen person investigated, not its result.",
          "limit": 1,
          "effect": {
            "kind": "peek_investigation_lead"
          }
        },
        {
          "id": "a_ada",
          "kind": "messenger",
          "description": "Unlock an additional link from the file-transfer timeline.",
          "limit": 1,
          "effect": {
            "kind": "grant_evidence",
            "evidenceId": "backup_match"
          }
        },
        {
          "id": "a_zainab",
          "kind": "audit",
          "description": "Verify the delivery log for a matching outbound file.",
          "limit": 1,
          "effect": {
            "kind": "grant_evidence",
            "evidenceId": "delivery_receipt"
          }
        },
        {
          "id": "a_emeka",
          "kind": "insider",
          "description": "Retrieve a hash match from the archive.",
          "limit": 1,
          "effect": {
            "kind": "grant_evidence",
            "evidenceId": "backup_match"
          }
        },
        {
          "id": "a_feyi",
          "kind": "protector",
          "description": "Delay the optional public joke clue by one round if used in round one.",
          "limit": 1,
          "effect": {
            "kind": "delay_optional_clue",
            "evidenceId": "joke_receipt",
            "delayRounds": 1
          }
        }
      ],
      "roleCards": [
        {
          "personaId": "tobi",
          "startingMemory": "You sent Kemi a file at about 20:41, thinking it was the event flyer.",
          "midgameMemory": "You sent the file without opening its preview first.",
          "blindInvolvement": "The attachment was the private screenshot; your forward caused the leak.",
          "missionId": "m_tobi",
          "abilityId": "a_tobi",
          "startingEvidenceIds": [],
          "traceEvidenceIds": [
            "tobi_trace"
          ]
        },
        {
          "personaId": "ada",
          "startingMemory": "You created a screenshot for your own notes at about 20:14.",
          "midgameMemory": "Your notes app later synchronised with the shared folder.",
          "blindInvolvement": "Your original image was copied into the shared file folder, but you did not send it outside.",
          "missionId": "m_ada",
          "abilityId": "a_ada",
          "startingEvidenceIds": [
            "ada_note"
          ],
          "traceEvidenceIds": [
            "ada_trace"
          ]
        },
        {
          "personaId": "zainab",
          "startingMemory": "You saw the screenshot outside the group at about 20:42.",
          "midgameMemory": "You posted a warning shortly after seeing it.",
          "blindInvolvement": "Your warning started a rumour but did not cause the external leak.",
          "missionId": "m_zainab",
          "abilityId": "a_zainab",
          "startingEvidenceIds": [
            "zainab_alert"
          ],
          "traceEvidenceIds": [
            "zainab_trace"
          ]
        },
        {
          "personaId": "emeka",
          "startingMemory": "You reorganised file names while cleaning a shared folder yesterday.",
          "midgameMemory": "You remember one screenshot and one flyer had nearly identical names.",
          "blindInvolvement": "Your folder change made a filename mix-up more likely.",
          "missionId": "m_emeka",
          "abilityId": "a_emeka",
          "startingEvidenceIds": [
            "file_label_receipt"
          ],
          "traceEvidenceIds": [
            "emeka_trace"
          ]
        },
        {
          "personaId": "feyi",
          "startingMemory": "You made an exaggerated joke about leaking the group chat.",
          "midgameMemory": "Your message was sent after the screenshot had already appeared outside.",
          "blindInvolvement": "Your remark became a false lead; you did not forward the screenshot.",
          "missionId": "m_feyi",
          "abilityId": "a_feyi",
          "startingEvidenceIds": [],
          "traceEvidenceIds": [
            "feyi_trace"
          ]
        }
      ],
      "evidence": [
        {
          "id": "public_time",
          "title": "First external appearance",
          "body": "The screenshot first appeared outside the group at 20:42.",
          "kind": "public_clue",
          "release": "public_start",
          "leadId": null,
          "initialOwnerRoleId": null,
          "verified": true,
          "factTags": [
            "time_2042"
          ]
        },
        {
          "id": "ada_note",
          "title": "Original image",
          "body": "Ada saved an image in her private notes at 20:14.",
          "kind": "private_evidence",
          "release": "private_start",
          "leadId": null,
          "initialOwnerRoleId": "ada",
          "verified": true,
          "factTags": [
            "image_origin"
          ]
        },
        {
          "id": "zainab_alert",
          "title": "Warning message",
          "body": "Zainab alerted the group shortly after 20:42.",
          "kind": "private_evidence",
          "release": "private_start",
          "leadId": null,
          "initialOwnerRoleId": "zainab",
          "verified": true,
          "factTags": [
            "warning"
          ]
        },
        {
          "id": "file_label_receipt",
          "title": "Folder rename log",
          "body": "Two file names were similar after a shared-folder cleanup at 20:26.",
          "kind": "private_evidence",
          "release": "private_start",
          "leadId": null,
          "initialOwnerRoleId": "emeka",
          "verified": true,
          "factTags": [
            "file_ambiguity"
          ]
        },
        {
          "id": "delivery_receipt",
          "title": "Outbound delivery log",
          "body": "Tobi sent a file to Kemi at 20:41. The file hash matches the screenshot.",
          "kind": "private_evidence",
          "release": "investigate",
          "leadId": "delivery_log",
          "initialOwnerRoleId": null,
          "verified": true,
          "factTags": [
            "transfer_actor",
            "decisive"
          ]
        },
        {
          "id": "backup_match",
          "title": "Archive hash match",
          "body": "Independent archive metadata shows Tobi sent Kemi a file at 20:41 with the private screenshot hash.",
          "kind": "private_evidence",
          "release": "investigate",
          "leadId": "archive_audit",
          "initialOwnerRoleId": null,
          "verified": true,
          "factTags": [
            "transfer_file",
            "decisive"
          ]
        },
        {
          "id": "joke_receipt",
          "title": "Suspicious joke",
          "body": "Feyi joked about leaking the chat before the emergency meeting. This does not prove a leak.",
          "kind": "public_clue",
          "release": "twist",
          "leadId": null,
          "initialOwnerRoleId": null,
          "verified": true,
          "factTags": [
            "red_herring"
          ]
        },
        {
          "id": "tobi_trace",
          "title": "Your file preview",
          "body": "Your 20:41 attachment preview was the private screenshot, not the event flyer.",
          "kind": "memory_fragment",
          "release": "trace_self",
          "leadId": null,
          "initialOwnerRoleId": "tobi",
          "verified": true,
          "factTags": [
            "self_discovery"
          ]
        },
        {
          "id": "ada_trace",
          "title": "Your original copy",
          "body": "Your notes image moved into the shared folder, but your device sent nothing outside.",
          "kind": "memory_fragment",
          "release": "trace_self",
          "leadId": null,
          "initialOwnerRoleId": "ada",
          "verified": true,
          "factTags": [
            "self_discovery"
          ]
        },
        {
          "id": "zainab_trace",
          "title": "Your warning effect",
          "body": "Your message spread suspicion after the external appearance.",
          "kind": "memory_fragment",
          "release": "trace_self",
          "leadId": null,
          "initialOwnerRoleId": "zainab",
          "verified": true,
          "factTags": [
            "self_discovery"
          ]
        },
        {
          "id": "emeka_trace",
          "title": "Your folder effect",
          "body": "Your earlier rename left two confusingly similar attachments.",
          "kind": "memory_fragment",
          "release": "trace_self",
          "leadId": null,
          "initialOwnerRoleId": "emeka",
          "verified": true,
          "factTags": [
            "self_discovery"
          ]
        },
        {
          "id": "feyi_trace",
          "title": "Your joke in context",
          "body": "Your comment was performative; no transfer originated from your account.",
          "kind": "memory_fragment",
          "release": "trace_self",
          "leadId": null,
          "initialOwnerRoleId": "feyi",
          "verified": true,
          "factTags": [
            "self_discovery"
          ]
        }
      ],
      "twist": {
        "id": "red_herring_joke",
        "afterRound": 1,
        "headline": "An old message makes Feyi look suspicious.",
        "publicEvidenceIds": [
          "joke_receipt"
        ]
      },
      "investigationLeads": [
        {
          "id": "delivery_log",
          "label": "Check outbound file delivery",
          "evidenceIds": [
            "delivery_receipt"
          ]
        },
        {
          "id": "archive_audit",
          "label": "Audit the original group archive",
          "evidenceIds": [
            "backup_match"
          ]
        }
      ],
      "revealSummary": "Tobi forwarded the wrong file to Kemi at 20:41. The file-name collision contributed to the mistake; later jokes and warnings confused the group."
    }
  ]
}
```

## 2.3 Runtime construction, seeded determinism, validation

**Deterministic setup pseudocode:**

```ts
function createMatch(casePack: CasePack, secureSeed: Uint8Array, participantIds: string[]) {
  assert(participantIds.length === casePack.settings.playerCount);
  validateCasePack(casePack);              // JSON Schema + semantic referential validation
  const rng = makeHmacSha256CounterRng(secureSeed); // unbiased integer sampling via rejection
  const variant = casePack.variants[rng.int(casePack.variants.length)];
  const shuffledParticipants = fisherYates(participantIds, rng);
  const personaToParticipant = Object.fromEntries(
    casePack.personas.map((p, i) => [p.id, shuffledParticipants[i]])
  );
  const canonical = deepFreeze({ variantId: variant.id, personaToParticipant,
    truth: variant.correct, chain: variant.chain, roleCards: variant.roleCards });
  const commitment = sha256(concat(secureSeed, canonicalJson(canonical)));
  return { canonical, commitment, sealedSeed: secureSeed, variant };
}
```

Do **not** serialize `sealedSeed` or `canonical` to a browser event. Keep a server-side commitment and reveal the seed/variant only after the round **if** an audit/debug view is authorized; otherwise the player reveal receives a safely curated explanation. The seed does not replace cryptographic authentication. Use a CSPRNG for initial seed creation. If matching variants must repeat in deterministic integration tests, allow a seed only from a privileged test harness, never a public Socket event.

**Required semantic validator** (JSON Schema alone cannot enforce all cross-object references):

- Exactly five **unique persona IDs** and exactly one `roleCard` per persona in every variant; no duplicate evidence, mission, lead, ability or chain IDs in their respective scopes.
- All roleCard `missionId`, `abilityId`, `startingEvidenceIds` and `traceEvidenceIds` resolve within the variant; trace items have `release=trace_self` and correct owner.
- All `initialOwnerRoleId`, chain actors, culprit persona and mission predicate `roleId` resolve to a persona; cause and resolution IDs resolve to offered options.
- Every `public_start` clue has `kind=public_clue`; every `twist` evidence ID has `release=twist`; all investigate leads contain evidence with `release=investigate` and matching `leadId`.
- Every granted ability evidence ID resolves; delayable evidence is **noncritical**, has `release=twist`, and any delay concludes no later than the end of Round 2. Reject a Protector effect that could hide a decisive receipt.
- Critical cause/actor can be inferred from at least two independently reachable investigation routes. This is a **content review + simulated playthrough requirement**, not a simplistic graph-count check.
- All canonical chain timestamps, clue statements, role memories and true explanations are consistent; no false fact is marked verified. The case has an achievable correct resolution and no logically impossible secret mission.
- The `schemaVersion` and case metadata are pinned with each saved session; updates to authored data cannot retroactively rewrite an active match.
- Cases are authored, versioned and published with a `caseContentHash` computed from canonical JSON. Include the hash in session persistence and developer logs.

**Derived outputs:** `publicIntro`, public persona roster, offered ballots, and released clue projections are client-visible. Private role memory and `midgameMemory`, own mission, own evidence IDs and own available ability are delivered only to that player's authenticated socket. `blindInvolvement` stays on the server until its exact memory is unlocked or the reveal is authorized.

---




## 2.4 Bot policy schema (separate from immutable case truth)

Bot personality and dialogue style are **not properties of a case persona**. The same policy can be assigned to any case role without implying culpability. Store the following separately at `packages/shared/schemas/bot-policy.v1.schema.json`, and its instances as server-only files. All profiles must pass AJV and semantic policy checks. The engine decides how to choose moves; these fields only configure weights and line limits.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://wahala.game/schemas/bot-policy.v1.schema.json",
  "title": "Wahala Bot Policy v1",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "policyId",
    "policyVersion",
    "displayName",
    "personality",
    "difficulty",
    "weights",
    "temperature",
    "maxUnsolicitedLinesPerPhase"
  ],
  "properties": {
    "policyId": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]{2,48}$"
    },
    "policyVersion": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"
    },
    "displayName": {
      "type": "string",
      "minLength": 2,
      "maxLength": 36
    },
    "personality": {
      "enum": [
        "assertive_accuser",
        "cautious_investigator",
        "cooperative_negotiator"
      ]
    },
    "difficulty": {
      "enum": [
        "basic",
        "intermediate"
      ]
    },
    "weights": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "information",
        "mission",
        "cooperation",
        "risk"
      ],
      "properties": {
        "information": {
          "type": "number",
          "minimum": 0,
          "maximum": 3
        },
        "mission": {
          "type": "number",
          "minimum": 0,
          "maximum": 3
        },
        "cooperation": {
          "type": "number",
          "minimum": 0,
          "maximum": 3
        },
        "risk": {
          "type": "number",
          "minimum": 0,
          "maximum": 3
        }
      }
    },
    "temperature": {
      "type": "number",
      "minimum": 0.1,
      "maximum": 2.0
    },
    "maxUnsolicitedLinesPerPhase": {
      "type": "integer",
      "minimum": 0,
      "maximum": 3
    }
  }
}
```

**Example bot personality profiles** (not five fixed character roles):

```json
[
  {
    "policyId": "chief_bode",
    "policyVersion": "1.0.0",
    "displayName": "Chief Bode",
    "personality": "assertive_accuser",
    "difficulty": "basic",
    "weights": {
      "information": 1.3,
      "mission": 1.1,
      "cooperation": 0.4,
      "risk": 0.5
    },
    "temperature": 0.8,
    "maxUnsolicitedLinesPerPhase": 2
  },
  {
    "policyId": "aunty_amaka",
    "policyVersion": "1.0.0",
    "displayName": "Aunty Amaka",
    "personality": "cooperative_negotiator",
    "difficulty": "basic",
    "weights": {
      "information": 1.0,
      "mission": 1.0,
      "cooperation": 1.6,
      "risk": 1.0
    },
    "temperature": 0.9,
    "maxUnsolicitedLinesPerPhase": 2
  },
  {
    "policyId": "zee",
    "policyVersion": "1.0.0",
    "displayName": "Zee",
    "personality": "cautious_investigator",
    "difficulty": "basic",
    "weights": {
      "information": 1.8,
      "mission": 1.0,
      "cooperation": 0.7,
      "risk": 1.1
    },
    "temperature": 0.6,
    "maxUnsolicitedLinesPerPhase": 1
  }
]
```

**Binding:** `case persona + BotPolicy + bot-only RNG substream` yields one NPC's private observation and decision policy. The schema intentionally has no key for `correctCause`, `truthChain`, `privateRolesOfOthers` or `secretSeed`; the bot context projector rejects them. In a single match, a bot name/policy must not indicate guilty/innocent assignment. AI participation is disclosed before opt-in; character-specific `AI player` labels are intentionally withheld in the consented identity-hidden match presentation.

### Content publication validation beyond JSON Schema

- Validate `case.settings.playerCount===5`, distinct assigned participant seats and fair support for the supported 3H+2B / 4H+1B / 5H rosters.
- For 3H+2B play, ensure at least one independent route to each decisive fact can be accessed via eligible human investigation leads without relying on bot altruism; simulate every selection of two bot-assigned personas.
- Validate all referenced lead/evidence/mission/ability IDs, zero fabricated verified clues, clue timestamps and causal ordering, finite ability power, and correct resolution options.
- Verify trial cases where bot decides `PASS`, refuses deals and abstains; these must still terminate deterministically and fairly (even if the group fails).
- Pin published content hash, bot-policy version and RNG commitment per session for audit and regression tests.

---

# 3. REAL-TIME MULTIPLAYER STATE MACHINE & SOCKET CONTRACTS

## 3.1 System boundaries and deployment

```text
                         Mobile browser / Next.js
                   360–430 px portrait, Socket.IO client
                          | HTTPS/WSS + HttpOnly cookie
                          v
                       API / Socket Gateway
         Auth/session • room ACL • sanitization • throttling • ACK
                          |
         +----------------+---------------------+----------------+
         |                |                     |                |
         v                v                     v                v
     Room/Queue       Game Reducer         Bot Runtime      Social/Moderation
     coordinator      & scheduler          (internal)       (public beta)
         |                |                     |                |
         +----------------+---------------------+----------------+
                          |
                 Event ledger + snapshots
                          |
                  PostgreSQL (server only)
                          |
         Optional Redis leases / adapter when multi-instance
```

Use one authoritative Node.js application server and PostgreSQL for early tests. Redis pub/sub/adapter, distributed queue and horizontal workers are introduced only if actual concurrency requires them. **Never** run the bot planner in untrusted client code or create fake sockets for NPC seats. Socket handlers call the same domain command service as internal bot decisions.

**Packages / suggested repository topology**:

```text
apps/web/                        Next.js UI
apps/server/                     HTTP + Socket.IO + room scheduling
packages/shared/schemas/        case.v1.schema.json, session event schemas
packages/shared/contracts/      TypeScript event types, Zod runtime validators
packages/engine/                pure reducers, proof/mission scoring, seed PRNG
packages/bots/                  observation projector, policies, dialogue templates
packages/content/               server-only case JSON; NEVER browser bundled
packages/ui/                    tokens, components, reveal animations
infra/                          migrations, deploy, environment templates
```

HTTP routes: `POST /api/session/guest` (creates a signed opaque guest session), `GET /api/cases` (**public** catalogue projection only), `GET /health`, `GET /ready`, later read-only public weekly-news feed and approved sponsor inventory. All mutating gameplay runs through command service; Socket.IO is the primary live transport.

## 3.2 State transitions, phase clock and concurrency

```mermaid
stateDiagram-v2
  [*] --> LOBBY
  LOBBY --> ROLES: host start / queue start / practice start
  ROLES --> INVESTIGATION_1: acknowledged or role deadline
  INVESTIGATION_1 --> SETTLING_1: timer or all locked
  SETTLING_1 --> TWIST: requests resolved or 20s expiry
  TWIST --> INVESTIGATION_2: scheduled release
  INVESTIGATION_2 --> SETTLING_2: timer or all locked
  SETTLING_2 --> INVESTIGATION_3: requests resolved or expiry
  INVESTIGATION_3 --> SETTLING_3: timer or all locked
  SETTLING_3 --> VOTING: requests resolved or expiry
  VOTING --> REVEAL: complete or ballot deadline
  REVEAL --> AFTERPARTY: reveal timer
  AFTERPARTY --> LOBBY: host rematch; new opt-in and seed
  LOBBY --> CLOSED: TTL / host closure
  AFTERPARTY --> CLOSED: TTL
  INVESTIGATION_1 --> ABANDONED: insufficient humans
  INVESTIGATION_2 --> ABANDONED: insufficient humans
  INVESTIGATION_3 --> ABANDONED: insufficient humans
  VOTING --> ABANDONED: insufficient humans
  ABANDONED --> CLOSED
```

There are no phase-advancing client timers. Every room has `deadlineAtMs`, `phaseVersion`, and `version`. Clock ticks can be rendered locally from `serverNow`; server decides expiry. Use one serial command processor / transaction per room. Any transition follows **check version → freeze legal submissions → compute deterministic effects → persist ledger and snapshot → increment version → publish authorised projections**. Re-running the same `(roomId, phaseVersion, transitionId)` must have no effect. A node restart must reconstruct the room from snapshot and append-only ledger before scheduling a new deadline, or explicitly mark interrupted/abandoned and suppress rewards. No state may become “winning” from partial write.

**Bot timing:** Planner decisions occur in the real phase window, not as privileged last-second reactions to secret human actions. Its observation may contain only **publicly committed** human chat/actions, not uncommitted action selections, other ballots or the full cause chain. The policy may be scheduled after a seeded, variable delay within the phase (e.g., 8–40s); **never** use real-world sleep as game truth. During settlement, bot replies are generated after requests exist and before response deadline. Default `PASS`/`ABSTAIN` on bot runtime exceptions; the match must finish without external AI APIs.

**No midmatch bot replacement:** `LOBBY -> ROLES` seals the seat roster. Bot count, persona mapping, policy version, seed and case hash persist for the match. A late human may join a new queue, not evict an NPC from an active case.

## 3.3 Wire contract (TypeScript, normative)

Wire messages use JSON-compatible types and Runtime Zod validators; **no JavaScript `Map` or `Set` on the wire**. Every mutating command uses UUIDv4 `requestId` and a response ACK. On duplicate `(session, requestId)` return the cached result without re-executing. A `roomId` in a payload is not proof of membership. For room events, sender identity comes solely from authenticated socket/session scope. A `participantId` can refer to an NPC but **only internal server code can submit NPC actions**, never a client.

```ts
// packages/shared/contracts/socket.ts
export type UUID = string; // UUIDv4, server-validated
export type RoomId = UUID;
export type HumanUserId = UUID;
export type ParticipantId = UUID;
export type EvidenceId = string;
export type PersonaId = string;
export type ISOTime = string; // UTC ISO-8601
export type ParticipantKind = 'human' | 'bot';
export type BotPolicy = 'none' | 'allow_bots';
export type Mode = 'PRIVATE' | 'QUICK_CASUAL' | 'SOLO_PRACTICE' | 'DUO_EXPERIMENT';
export type Phase =
  | 'LOBBY' | 'ROLES' | 'INVESTIGATION_1' | 'SETTLING_1' | 'TWIST'
  | 'INVESTIGATION_2' | 'SETTLING_2' | 'INVESTIGATION_3' | 'SETTLING_3'
  | 'VOTING' | 'REVEAL' | 'AFTERPARTY' | 'ABANDONED' | 'CLOSED';
export type Round = 1 | 2 | 3;
export type ErrorCode =
  | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'ROOM_NOT_FOUND' | 'ROOM_FULL'
  | 'INVALID_ROOM_CODE' | 'ROOM_LOCKED' | 'WRONG_PHASE' | 'NOT_READY'
  | 'NOT_HOST' | 'INVALID_ACTION' | 'ALREADY_USED' | 'EVIDENCE_NOT_OWNED'
  | 'INVALID_TARGET' | 'DEADLINE_PASSED' | 'BAD_PAYLOAD' | 'RATE_LIMITED'
  | 'REQUEST_CONFLICT' | 'CASE_UNAVAILABLE' | 'BOT_FILL_NOT_ALLOWED'
  | 'HUMAN_MINIMUM_NOT_MET' | 'UNSUPPORTED_MODE' | 'QUEUE_EXPIRED'
  | 'NOT_YOUR_SEAT' | 'NO_OPEN_RESPONSE' | 'INTERNAL_ERROR';
export type Ack<T> =
  | { ok: true; requestId: UUID; data: T; serverNow: ISOTime }
  | { ok: false; requestId: UUID; error: { code: ErrorCode; message: string }; serverNow: ISOTime };
export type RoomCommand = { roomId: RoomId; requestId: UUID };
export type QueueCommand = { requestId: UUID };
export type ActionSelection =
  | { kind: 'INVESTIGATE'; leadId: string }
  | { kind: 'CONFRONT'; targetParticipantId: ParticipantId; question: string }
  | { kind: 'EXPOSE'; evidenceId: EvidenceId }
  | { kind: 'MAKE_DEAL'; targetParticipantId: ParticipantId;
      offerEvidenceId: EvidenceId; requestEvidenceId: EvidenceId }
  | { kind: 'DEFEND'; targetParticipantId: ParticipantId;
      accusationId: UUID; explanation: string }
  | { kind: 'TRACE_SELF' }
  | { kind: 'ABILITY'; abilityId: string; targetParticipantId?: ParticipantId }
  | { kind: 'PASS' };

export type ParticipantPublic = {
  participantId: ParticipantId;
  nickname: string; avatarId: string;
  connected: boolean; ready: boolean;
  personaId: PersonaId | null; isHost: boolean;
  // Intentionally no `kind`, bot policy, AI badge, account ID or online-human claim.
  // Apply for all characters in an opted-in IDENTITY_HIDDEN match.
};
export type IdentityDisclosure = {
  participantId: ParticipantId; kind: ParticipantKind;
  nickname: string; avatarId: string;
};

export type VerifiedClue = { id: EvidenceId; title: string; body: string; verified: true };
export type ChatMessage = {
  id: UUID; roomId: RoomId; channel: 'LOBBY' | 'GAME' | 'AFTERPARTY';
  fromParticipantId: ParticipantId;
  // Author type is server-internal, never broadcast during identity-hidden play.
  text: string; createdAt: ISOTime;
};
export type PublicGameEvent = { id: UUID; sequence: number; kind: string;
  text: string; createdAt: ISOTime; fromParticipantId?: ParticipantId };
export type Ballot = {
  causeId: string; principalActorParticipantId: ParticipantId; resolutionId: string;
};
export type RoomView = {
  roomId: RoomId; code: string | null; caseId: string;
  title: string; mode: Mode;
  phase: Phase; round: 0 | 1 | 2 | 3;
  version: number; serverNow: ISOTime; deadlineAt: ISOTime | null;
  botPolicy: BotPolicy; botFillConsented: boolean;
  aiPresenceDisclosure: 'HUMANS_ONLY' | 'MAY_INCLUDE_AI' | 'SOLO_AI_PRACTICE';
  // Human/bot counts and seat kinds are server-only until opt-in postgame reveal.
  participants: ParticipantPublic[]; locked: boolean;
  publicClues: VerifiedClue[]; publicEvents: PublicGameEvent[];
  accusationMarkers: { id: UUID; byParticipantId: ParticipantId;
    targetParticipantId: ParticipantId; status: 'open' | 'contested' }[];
  causeOptions: { id: string; label: string }[];
  resolutionOptions: { id: string; label: string }[];
};
export type SelfView = {
  participantId: ParticipantId; personaId: PersonaId | null;
  startingMemory: string | null; midgameMemory: string | null;
  mission: { id: string; description: string } | null;
  ability: { id: string; description: string; used: boolean } | null;
  myEvidence: VerifiedClue[]; myMemoryFragments: VerifiedClue[];
  selectedAction: ActionSelection | null; actionLocked: boolean;
  myBallot: Ballot | null;
};
export type RevealView = {
  correct: Ballot;
  tallies: {
    causes: Record<string, number>;
    actors: Record<ParticipantId, number>;
    resolutions: Record<string, number>;
  };
  groupSuccess: boolean; actorIdentified: boolean;
  chain: { minute: string; personaId: PersonaId; truth: string }[];
  missions: { participantId: ParticipantId; personaId: PersonaId;
    missionDescription: string; success: boolean }[];
  publicMode: 'CASUAL' | 'PRACTICE'; // Server retains MIXED_CASUAL/HUMAN_CASUAL classification.
  summary: string; caseContentHash: string;
};
```

**Identity-hidden projection security (normative):** Never serialize `ParticipantRuntime.kind`, `authorKind`, internal NPC IDs, `botCount`, `humanCount`, `MIXED_CASUAL` analytics mode, or policy metadata into `ParticipantPublic`, `ChatMessage`, default `RoomView`, `game:started`, or default `RevealView`. Internal analytics, moderation and seat management still retain them. A separate owner-only `identity:reveal_result` may provide `IdentityDisclosure[]` **only once `game:reveal` has been delivered**, and only following that authenticated player's `identity:reveal_request` during `REVEAL` or `AFTERPARTY`. Team/friend controls must verify human kind server-side, return an honest explanation if the target is AI, and must never create bot social accounts. The server shall not hide the fact that AI **may** participate: the acceptance notice is an explicit, required pre-match consent state.

### Client → server: complete initial feature-set

No `bot:choose`, `bot:speak` or `bot:vote` Socket event is exposed to browsers. NPC moves run through internal `gameCommandService` with authenticated server-only `actorContext`.

```ts
export interface ClientToServerEvents {
  'room:create': (p: { requestId: UUID; caseId: string;
    nickname: string; avatarId: string; mode: 'PRIVATE'; botPolicy: BotPolicy },
    ack: (a: Ack<{ roomId: RoomId; code: string;
      participantId: ParticipantId; inviteUrl: string }>) => void) => void;
  'room:join': (p: { requestId: UUID; code: string;
    nickname: string; avatarId: string },
    ack: (a: Ack<{ roomId: RoomId; participantId: ParticipantId }>) => void) => void;
  'room:leave': (p: RoomCommand, ack: (a: Ack<{ left: true }>) => void) => void;
  'room:close': (p: RoomCommand, ack: (a: Ack<{ closed: true }>) => void) => void;
  'room:ready': (p: RoomCommand & { ready: boolean; acceptBotFill?: boolean;
    acceptedIdentityHiddenDisclosure?: boolean },
    ack: (a: Ack<{ ready: boolean }>) => void) => void;
  'room:lock': (p: RoomCommand & { locked: boolean },
    ack: (a: Ack<{ locked: boolean }>) => void) => void;
  'room:kick': (p: RoomCommand & { targetParticipantId: ParticipantId },
    ack: (a: Ack<{ removedParticipantId: ParticipantId }>) => void) => void;
  'room:bot_policy': (p: RoomCommand & { policy: BotPolicy },
    ack: (a: Ack<{ policy: BotPolicy }>) => void) => void; // host, lobby only
  'room:fill_bots': (p: RoomCommand & { confirm: true },
    ack: (a: Ack<{ seatsOccupied: 5; consentConfirmed: true }>) => void) => void; // host only, 3+ humans, max 2 bots; no count of bots
  'room:start': (p: RoomCommand,
    ack: (a: Ack<{ phase: 'ROLES'; version: number }>) => void) => void;
  'room:rematch': (p: RoomCommand & { allowBots: boolean },
    ack: (a: Ack<{ phase: 'LOBBY'; version: number }>) => void) => void;
  'state:resume': (p: RoomCommand,
    ack: (a: Ack<{ resumed: true }>) => void) => void;
  'role:acknowledge': (p: RoomCommand,
    ack: (a: Ack<{ acknowledged: true }>) => void) => void;
  'chat:send': (p: RoomCommand & { channel: 'LOBBY' | 'GAME' | 'AFTERPARTY'; text: string },
    ack: (a: Ack<{ messageId: UUID }>) => void) => void;
  'action:submit': (p: RoomCommand & { round: Round; action: ActionSelection },
    ack: (a: Ack<{ accepted: true; selectedAction: ActionSelection }>) => void) => void;
  'action:respond': (p: RoomCommand & { challengeId: UUID;
    response: 'ANSWER' | 'REFUSE'; text?: string },
    ack: (a: Ack<{ recorded: true }>) => void) => void;
  'deal:respond': (p: RoomCommand & { offerId: UUID; accept: boolean },
    ack: (a: Ack<{ recorded: true }>) => void) => void;
  'vote:cast': (p: RoomCommand & Ballot,
    ack: (a: Ack<{ sealed: true }>) => void) => void;
  'report:submit': (p: RoomCommand & {
    targetParticipantId?: ParticipantId;
    category: 'HARASSMENT' | 'SPAM' | 'HATE' | 'PRIVACY' | 'OTHER';
    description?: string; messageId?: UUID },
    ack: (a: Ack<{ reportId: UUID }>) => void) => void;
  'player:block': (p: RoomCommand & { targetParticipantId: ParticipantId; blocked: boolean },
    ack: (a: Ack<{ blocked: boolean }>) => void) => void;
  // Available only after canonical game:reveal has been emitted, in REVEAL or AFTERPARTY.
  'identity:reveal_request': (p: RoomCommand,
    ack: (a: Ack<{ requested: true }>) => void) => void;

  // BETA: quick play / public matchmaking; not required for private closed alpha.
  'match:enqueue': (p: QueueCommand & { caseId: string; nickname: string; avatarId: string;
    botFillConsent: boolean; identityHiddenConsent: boolean; language?: string },
    ack: (a: Ack<{ ticketId: UUID; waitStartedAt: ISOTime }>) => void) => void;
  'match:cancel': (p: QueueCommand & { ticketId: UUID },
    ack: (a: Ack<{ cancelled: true }>) => void) => void;
  'match:accept': (p: QueueCommand & { matchOfferId: UUID; accept: boolean },
    ack: (a: Ack<{ recorded: true }>) => void) => void;
  'match:fill_consent': (p: QueueCommand & { ticketId: UUID; allowBots: boolean;
    acceptedIdentityHiddenDisclosure: boolean },
    ack: (a: Ack<{ allowBots: boolean }>) => void) => void;

  // MVP: practice uses an explicitly separate launch path; no artificial human crowd.
  'practice:start': (p: QueueCommand & { caseId: string; nickname: string; avatarId: string; acceptedAiPracticeDisclosure: true },
    ack: (a: Ack<{ roomId: RoomId; participantId: ParticipantId; mode: 'SOLO_PRACTICE' }>) => void) => void;
}
```

### Server → client: complete initial feature-set

All room broadcasts pass through a **public projection**. Self projections are unicast to the authenticated human seat; NPCs have no client listener. `room:updated` is public-only and **cannot** contain case internals, hidden evidence, uncast ballots or policy weights.

```ts
export interface ServerToClientEvents {
  'room:updated': (p: { roomId: RoomId; view: RoomView }) => void;
  'room:closed': (p: { roomId: RoomId;
    reason: 'IDLE' | 'HOST_CLOSED' | 'ABANDONED' | 'MODERATION' }) => void;
  'room:kicked': (p: { roomId: RoomId; reason: string }) => void; // target only
  'room:bot_filled': (p: { roomId: RoomId;
    occupiedSeatCount: 5; consentConfirmed: true }) => void; // No per-character AI labels
  'game:started': (p: { roomId: RoomId; caseId: string;
    publicIntro: string; commitment: string;
    cast: { participantId: ParticipantId; personaId: PersonaId;
      displayName: string; publicBio: string }[] }) => void;
  'role:assign': (p: { roomId: RoomId; personaId: PersonaId;
    startingMemory: string; mission: { id: string; description: string };
    ability: { id: string; description: string }; startingEvidence: VerifiedClue[] }) => void; // human owner only
  'role:memory': (p: { roomId: RoomId; midgameMemory: string }) => void; // human owner only
  'game:phase': (p: { roomId: RoomId; phase: Phase; round: 0 | Round;
    version: number; deadlineAt: ISOTime | null; serverNow: ISOTime }) => void;
  'game:twist': (p: { roomId: RoomId; headline: string;
    publicClues: VerifiedClue[] }) => void;
  'game:event': (p: { roomId: RoomId; event: PublicGameEvent }) => void;
  'evidence:private': (p: { roomId: RoomId; evidence: VerifiedClue;
    source: 'INVESTIGATE' | 'TRACE_SELF' | 'ABILITY' | 'DEAL' }) => void; // owner only
  'evidence:public': (p: { roomId: RoomId; evidence: VerifiedClue;
    byParticipantId: ParticipantId | null }) => void;
  'action:respond_requested': (p: { roomId: RoomId; challengeId: UUID;
    fromParticipantId: ParticipantId; question: string; deadlineAt: ISOTime }) => void; // target only
  'deal:offered': (p: { roomId: RoomId; offerId: UUID;
    fromParticipantId: ParticipantId; offeredEvidenceId: EvidenceId;
    requestedEvidenceId: EvidenceId; deadlineAt: ISOTime }) => void; // target only
  'action:resolved': (p: { roomId: RoomId; round: Round;
    eventId: UUID; status: 'DONE' | 'FAILED' | 'EXPIRED';
    text: string; grantedEvidenceIds: EvidenceId[] }) => void; // initiator only
  'vote:receipt': (p: { roomId: RoomId; sealed: true }) => void; // voter only
  'game:reveal': (p: { roomId: RoomId; reveal: RevealView }) => void;
  'identity:reveal_result': (p: { roomId: RoomId; participants: IdentityDisclosure[] }) => void; // unicast only after request and after REVEAL
  'chat:message': (p: { roomId: RoomId; message: ChatMessage }) => void;
  'state:snapshot': (p: { roomId: RoomId; public: RoomView;
    self: SelfView; recentChat: ChatMessage[];
    reveal: RevealView | null }) => void; // requester only
  'report:acknowledged': (p: { roomId: RoomId; reportId: UUID }) => void; // reporter only

  // BETA: Quick Play, with explicit consent, human-first assembly and timeout.
  'match:queued': (p: { ticketId: UUID; estimatedWaitSeconds: number | null }) => void; // measured or null; no fake waiting people
  'match:bot_offer': (p: { ticketId: UUID; available: true;
    disclosure: 'AI_MAY_FILL_EMPTY_SEATS'; identityHidden: true }) => void;
  'match:found': (p: { matchOfferId: UUID; expiresAt: ISOTime;
    castSize: 5; aiPresenceDisclosure: 'HUMANS_ONLY' | 'MAY_INCLUDE_AI';
    botFillConsentRequired: boolean }) => void;
  'match:started': (p: { roomId: RoomId; participantId: ParticipantId;
    castSize: 5 }) => void;
  'match:cancelled': (p: { ticketId: UUID;
    reason: 'USER' | 'EXPIRED' | 'NO_MATCH' | 'SAFETY' }) => void;
}
```

### Wire flow: identity-hidden mixed lobby, action round, reveal

```text
User A -> room:create {mode:'PRIVATE',botPolicy:'allow_bots'} => ACK code
Users B,C -> room:join {code} => ACK human participantIDs
UI (each human, before AI fill) -> displays consent notice: "AI-controlled characters may fill empty seats; who is AI stays hidden until you choose to reveal after the round. Humans-only is available."
All A,B,C -> room:ready {ready:true,acceptBotFill:true,acceptedIdentityHiddenDisclosure:true}
Host A -> room:fill_bots {confirm:true} => ACK seatsOccupied:5 (no bot IDs or bot count)
Server -> room:bot_filled {occupiedSeatCount:5} ; all five character aliases look alike
Host A -> room:start => ACK ROLES
Server -> game:started {cast:[five character aliases, no kind], commitment}
Server -> private-human role:assign (three unicasts; no bot sockets)
Internal policy -> role dossier projector for bots only
Server -> game:phase INVESTIGATION_1
Humans -> action:submit; bots internally choose legal actions from owner-limited observations
Server -> projected chat and events (no `authorKind` in identity-hidden public payloads)
... round settling, twist, final ballots ...
Server -> game:reveal (canonical chain, tallies, missions; no AI seat attribution by default)
Human chooses "Reveal AI identities" -> identity:reveal_request
Server -> identity:reveal_result (private, that user's view only)
Server -> game:phase AFTERPARTY
Human chooses "Connect with real players" -> identity disclosure first, then human-only friend list
```

**ACK semantics:** `room:fill_bots` is rejected unless `mode=PRIVATE`, `botPolicy=allow_bots`, 3–4 verified human seats all ready **with `acceptBotFill: true` and `acceptedIdentityHiddenDisclosure: true`**, zero current AI seats, and room is in `LOBBY`. If `botPolicy` is changed, reset all human `ready`, `acceptBotFill`, and `acceptedIdentityHiddenDisclosure` flags so new consent is collected. Bots added and seat inventory committed atomically; if adding would race a human join, recheck available seats within transaction. Only **server-internal** `RoomRuntime` and bot planner receive the actual bot IDs and participant kinds; identity-hidden client projections strip them until an authorised postgame identity disclosure after canonical `game:reveal`. `room:start` requires five assigned seats and ready state. Quick queue match assembly performs the equivalent server-side transaction *only after all proposed humans have accepted*, with prior **individual** bot-fill consent.

## 3.4 In-memory room state, queues and NPC runtime

The room runtime below is internal to the authoritative server. It is **never** serialized directly to any socket payload. Production must replace illustrative generated-content references with types compiled from the JSON schema.

```ts
type ParticipantRuntime =
  | {
      kind: 'human'; participantId: ParticipantId; humanUserId: HumanUserId;
      nickname: string; avatarId: string; seat: 0 | 1 | 2 | 3 | 4;
      socketIds: Set<string>; connected: boolean; disconnectedAtMs: number | null;
      ready: boolean; acceptBotFill: boolean; roleAcknowledged: boolean; personaId: PersonaId | null;
      selectedAction: ActionSelection | null; actionLocked: boolean;
      usedAbility: boolean; ownedEvidenceIds: Set<EvidenceId>;
      unlockedMemoryIds: Set<EvidenceId>; midgameMemoryDelivered: boolean;
      ballot: Ballot | null; blockedParticipantIds: Set<ParticipantId>;
    }
  | {
      kind: 'bot'; participantId: ParticipantId;
      nickname: string; avatarId: string; seat: 0 | 1 | 2 | 3 | 4;
      connected: true; ready: true; roleAcknowledged: true; personaId: PersonaId | null;
      policyId: string; policyVersion: string;
      personalityId: string; difficulty: 'basic' | 'intermediate';
      botRngCounter: number; utterancesThisPhase: number;
      selectedAction: ActionSelection | null; actionLocked: boolean;
      usedAbility: boolean; ownedEvidenceIds: Set<EvidenceId>;
      unlockedMemoryIds: Set<EvidenceId>; midgameMemoryDelivered: boolean;
      ballot: Ballot | null;
    };

type BotObservation = {
  self: { participantId: ParticipantId; personaId: PersonaId;
    missionId: string; missionDescription: string;
    availableAbilityId: string | null; startingMemory: string;
    unlockedMemoryTexts: string[]; ownedEvidence: VerifiedClue[] };
  public: {
    phase: Phase; round: 0 | Round; publicClues: VerifiedClue[];
    statements: ChatMessage[]; publicEvents: PublicGameEvent[];
    accusations: { id: UUID; by: ParticipantId;
      target: ParticipantId; status: 'open' | 'contested' }[];
    participants: ParticipantPublic[];
    causeOptions: { id: string; label: string }[];
    resolutionOptions: { id: string; label: string }[];
  };
  legalActions: ActionSelection[];
  pendingDirectRequests: { id: UUID; kind: 'CONFRONT' | 'DEAL';
    from: ParticipantId; expiresAt: ISOTime }[];
};

type RoomRuntime = {
  roomId: RoomId; code: string; hostHumanId: HumanUserId | null;
  mode: Mode; botPolicy: BotPolicy; botFillConsented: boolean;
  minimumHumans: number;
  version: number; phase: Phase; phaseVersion: number;
  deadlineAtMs: number | null; createdAtMs: number; lastActivityAtMs: number;
  locked: boolean;
  caseId: string; caseContentHash: string;
  participants: Map<ParticipantId, ParticipantRuntime>; // invariant: max 5 seats
  secret: null | {
    variantId: string; sealedSeedHex: string; commitment: string;
    truthChain: { minute: string; actorPersonaId: PersonaId; truth: string }[];
    correctCauseId: string; correctResolutionId: string;
    principalActorPersonaId: PersonaId;
    personaToParticipant: Map<PersonaId, ParticipantId>;
    roleCards: Map<PersonaId, unknown>; evidenceDefinitions: Map<EvidenceId, unknown>;
    missionDefinitions: Map<string, unknown>;
  };
  round: 0 | Round;
  roundStartEvidence: Map<ParticipantId, Set<EvidenceId>>;
  selectedActions: Map<ParticipantId, { requestId: UUID; round: Round;
    selection: ActionSelection; submittedAtMs: number }>;
  pendingChallenges: Map<UUID, { from: ParticipantId; to: ParticipantId;
    question: string; responseText?: string; response?: 'ANSWER' | 'REFUSE';
    expiresAtMs: number }>;
  pendingDeals: Map<UUID, { from: ParticipantId; to: ParticipantId;
    offeredEvidenceId: EvidenceId; requestedEvidenceId: EvidenceId;
    accept?: boolean; expiresAtMs: number }>;
  publicEvidenceIds: Set<EvidenceId>;
  delayedClues: Map<EvidenceId, Round>;
  accusations: Map<UUID, { by: ParticipantId; target: ParticipantId;
    status: 'open' | 'contested'; explanation?: string }>;
  publicEvents: PublicGameEvent[]; chatTail: ChatMessage[];
  votes: Map<ParticipantId, Ballot | null>;
  reveal: RevealView | null;
  processedRequests: Map<UUID, Ack<unknown>>;
  eventSequence: number; stateHash: string;
};

const activeRooms = new Map<RoomId, RoomRuntime>();
const roomIdsByCode = new Map<string, RoomId>();
const pendingQuickTickets = new Map<UUID, {
  guestId: HumanUserId; caseId: string;
  botFillConsent: boolean; joinedAtMs: number; matchOfferId: UUID | null;
}>();
```

**Participant identity:** `ParticipantId` exists for a human or bot seat; `HumanUserId` exists only for a real authenticated/guest person. Only `kind==='human'` has live sockets. Bots never claim to be online friends. Human role and legal-action permissions are always checked against the **authenticated membership**, not the `participantId` typed by a client.

## 3.5 Bot decision service — executable contract

```ts
type BotChoice = { action: ActionSelection; rationaleCode: string;
  scoringVersion: string; observationHash: string };
interface BotPolicyEngine {
  decideAction(obs: BotObservation, ctx: {
    policyId: string; policyVersion: string; rng: SeededRng;
  }): BotChoice;
  decideConfrontResponse(obs: BotObservation, challengeId: UUID):
    { response: 'ANSWER' | 'REFUSE'; text?: string };
  decideDealResponse(obs: BotObservation, offerId: UUID): { accept: boolean };
  decideBallot(obs: BotObservation): Ballot;
  draftUtterance(obs: BotObservation, trigger: string):
    { text: string; templateId: string } | null;
}
```

**Do not pass `RoomRuntime.secret` to BotPolicyEngine.** Build `BotObservation` from a filtered view for each NPC, include the legal action catalogue generated by the game reducer, and type-test/inspect the **absence** of secret fields. Tests must catch canonical truth strings, other private role cards and pre-reveal votes anywhere in the observation JSON. Never `JSON.stringify(room)` as a prompt to an LLM.

**Simple MVP utility scoring (illustrative, adjust by playtest):**

```ts
function chooseBotMove(obs: BotObservation, p: Personality, rng: SeededRng) {
  const choices = obs.legalActions; // engine-provided, already legal
  const values = choices.map(action => {
    const infoValue = informationGainHeuristic(obs, action);
    const missionValue = goalFitHeuristic(obs.self.missionId, action);
    const safety = avoidsUnsupportedClaims(action, obs) ? 1 : 0;
    const social = p.cooperationWeight * interactionValue(action);
    const risk = p.riskWeight * exposureRisk(obs, action);
    return { action, utility: infoValue + missionValue + social - risk + safety };
  });
  return seededSoftmaxSelect(values, rng, p.temperature);
}
```

`informationGainHeuristic`, `goalFitHeuristic` and `exposureRisk` must be functions of **observed** facts only and have unit tests. Softmax temperature calibrates variability; it is not a license for irrational, sabotaging NPC behavior. Dialogue in MVP is filtered, local and templated; can reference only received evidence, public statements and generic uncertainty. When a bot deliberately bluffs it must not claim to hold **verified** evidence it does not possess.

**Determinism nuance:** The case truth and reducer are deterministic under a committed seed + event sequence. NPC stochastic choices are also reproducible when policy version and dedicated RNG stream are persisted. Chat wording need not affect game outcomes; if an optional LLM is introduced later, its output is **never** part of the authoritative scoring state. A failed NPC planner degrades to `PASS` or `ABSTAIN` and produces an operational incident record, not an invalid case or a secret omniscient action.

## 3.6 Safety, abuse, anti-cheat and recovery

- Guest authentication: issue random opaque guest session in `HttpOnly; Secure; SameSite=Lax` cookie; validate socket origin and signed session. Display nickname is **not** identity. A room code is not a bearer secret. Rate-limit guessed codes, queue entry, joins, room creation, messages, actions, invites and reports; use exact trusted member mapping for authorisation.
- Anti-cheat: roles, dossiers, case truth, seed, owned evidence, unrevealed missions, private votes and other users' private chat stay server side. Cross-player secret access and client-claimed bot acting are rejected even if a forged `participantId` is supplied.
- One action slot per investigation round, one vote per seat, one-use ability, idempotency per `(session,requestId)`, server-controlled deadlines, strong event ledger, restart reconstruction, approved action ownership and evidence allowlists.
- Moderation for public beta: report/block/mute, abuse rate limits, content logging under retention policy, queue-level player exclusions, moderator tooling, chat sanitation, and consistent consequences. Public adult stranger chat must not launch before its controls are operational. No fabricated crowd, forced harassment, or location claims; opt-in city labels are cosmetic.
- Privacy and consent: minimal personal data, account deletion workflow, opt-in public achievements, no publication of confidential role/chat transcripts in *The Wahala Times* without consent. Advertising uses aggregate reach, not direct/private message content; clearly label paid placements.
- Reconnection: human reconnects reclaim only original reserved seat using same session; role-safe `state:snapshot` includes private self view only. In-flight bot routines must survive crash and not double-submit. Duplicate sockets share one human seat; Socket transport disconnect does not grant a second action.
- Crash recovery: every game step stored as immutable typed event; persist snapshot at phase transitions; rehydrate deterministic seed/variant and bot policy version securely; if restoration impossible, mark abandoned and don't silently score.

## 3.7 Database and telemetry

**Tables:** `guest_sessions`, `profiles`, `rooms`, `participants` (`kind`, bot metadata or human identity), `matchmaking_tickets`, `match_offers`, `game_sessions` (seed commitment / case hash / policy version / mode), `game_events`, `encrypted_snapshots`, `evidence_grants`, `ballots` (sealed before reveal), `mission_results`, `chat_messages`, `moderation_reports`, `blocks`, `friend_requests` (beta), `publications` (*The Wahala Times*, beta), `sponsor_placements` and `aggregate_ad_events` (later). Separate raw moderation chat from aggregate analytics; define minimisation and retention periods with counsel.

**Core analytics:** Include `ai_presence_notice_shown`, `ai_presence_consent_accepted`, `identity_reveal_requested`, `identity_reveal_completed`, `humans_only_selected` and `friend_connect_identity_explained`, plus `queue_entered`, `match_human_offer`, `match_bot_offer`, `bot_fill_consented`, `bot_seats_added`, `match_started`, `first_action`, `action_rejected`, `bot_action`, `human_human_message`, `human_bot_message`, `bot_spontaneous_message`, `round_settled`, `vote_cast`, `case_completed`, `case_abandoned`, `rematch_clicked`, `friend_connection`, `share_clicked`, `sponsor_impression_viewable`, `ad_click`, `report_submitted`. Dimensional slices include `mode`, `humanCount`, `botCount`, `variantId`, `policyVersion`, `locale` and device/network class (with privacy minimisation).

**SLO-like pilot targets (not promises):** room-event p95 under 1s, ACK p95 under 500ms on supported networks, no wrong-role delivery in adversarial automated tests, <2% technical case failures and recovery of server state after kill/restart. Load test mixed rooms as well as all-human rooms. Calculate `timeToPlayable`, organic human–human messages per session, bot vote swing, D1/D7 retention, repeat match count and player-reported bot fairness.

---

# 4. MOBILE-FIRST UI/UX SYSTEM

## 4.1 Interaction priorities, visual identity and tokens

The look is a **premium Nigerian social thriller**, not a spreadsheet, simple quiz, full 3D city, or fake-chat simulator. Make the **human conversation** the largest interactive element; let cinematic dossier, receipts and reveals punctuate it. Dark midnight backdrop; warm confidential-file gold; sea-green only for verified facts; coral for urgency or contested claims; muted paper for *The Wahala Times* and evidence. Nigerian authenticity belongs in carefully written scenarios, character expression, vocabulary and cultural settings, not in overloading UI labels with slang or relying on stereotypes.

**Rules for engagement:** (1) hook before instructions; (2) a player understands their role and objective in one card; (3) make the next choice obvious; (4) explain action costs; (5) disclose possible AI participation before consent without exposing character types mid-round; (6) never assert an AI is human or offer it as a genuine friend; (7) close with a fair, memorable reveal and opt-in rematch.

```ts
// packages/ui/tokens.ts (can be exported into Tailwind v4 @theme)
export const wahalaTheme = {
  colors: {
    background: '#11151B',
    surface: '#1A202A',
    raised: '#252D39',
    divider: '#39414E',
    primary: '#F3C261',   // Wahala Gold
    primaryMuted: '#4A3B20',
    suspicion: '#E36B66',
    verified: '#72B6A0',
    paper: '#F3EBD9',
    text: '#F7F7F7',
    secondaryText: '#C6CCD6',
  },
  radius: { card: '16px', button: '12px', sheet: '20px' },
  typography: { display: 'clamp(1.65rem,5vw,2.5rem)', body: '16px', label: '14px' },
  safeArea: { bottom: 'env(safe-area-inset-bottom)' },
  tapTarget: '44px',
} as const;
```

**Device targets:** minimum 320px wide, primary 360/375/390/430 px mobile viewports, modern Android Chrome/mobile Safari, common low-power phones, unreliable data networks, virtual keyboard open, low-motion setting. Default sound off. Meet WCAG AA contrast where applicable; explicit text/icons for Verified vs Claim; never communicate correctness by colour alone. Responsive desktop may show chat + evidence side-by-side but permissions and gameplay are identical.

## 4.2 Screen sequence, hierarchy and retention intent

| Screen | Primary CTA | Interaction / information hierarchy | Hook and failure safeguards |
|---|---|---|---|
| **Welcome** | `Quick Play`, `Play with Friends`, `Practice Solo` | Mystery hook; 5-seat case + “3+ real players can play”; no registration barrier | Don't promise instant humans; plain-language expectations |
| **Mode / Queue** | `Find people`, `Allow AI fill` after threshold | Human search status, measured wait estimates, optional AI-presence and identity-hidden consent | One concise disclosure; no individual AI IDs or artificial human counts |
| **Gist Lounge** (`BETA`) | Join conversation or game | Moderated adult rooms with **real-human** occupancy only, mutual friend reconnect | AI characters are not fake social accounts in the lounge; no empty-world inflation |
| **Private Lobby** | `Ready`, host `Fill & Start` | 5 character seats with identical appearance, nickname/avatar, readiness, code/share, chat | Short AI-presence consent notice shown before fill; no individual AI badges |
| **Secret Dossier** | `Reveal my card`, `Ready` | Persona, precise opening memory, mission, ability; hidden involvement locked | Close/hide immediately; no other role leakage |
| **Investigation** | Select/lock one action | Sticky server timer + round; conversation centre; evidence, own dossier and action tray reachable | Clear `1 of 1 action` badge, verify evidence vs claims |
| **Action Settlement** | Respond to challenge/deal or wait | Non-blocking “Resolving moves…”; bounded 20s response panel | Never ask for reply after deadline; identity-hidden player views stay uniform |
| **Twist** | `Continue` | Brief verified public clue; dramatic but not overstimulating | If clue delayed, accurately state what is / isn't known |
| **Voting** | `Seal my verdict` | Cause selector, persona/participant actor selector, resolution selector, confirmation | Never expose votes before reveal; server ACK before success |
| **Big Reveal** | `See the receipts` | 1 vote tallies → 2 cause → 3 causal chain → 4 missions; optional **Reveal AI identities** | Fair, readable, skippable; truthful ballots without per-character AI attribution by default |
| **Afterparty** | `Run it back`, `Keep chatting` | Chat with actual humans, approved recap, opt-in **Connect with real players**, return to Lounge | Connection action explicitly opens AI identity disclosure; NPCs never send personal messages |
| **The Wahala Times** (`BETA`) | Read new cases and hosted nights | Opt-in human stories, new challenges, event calendar, labelled sponsors | Real-user consent and disclosure; not fabricated celebrity content |

### Lobby — identity-hidden, consented composition

```text
WAHALA.                           ROOM W7K9 [Copy]
Who Leaked the Screenshot?
Five characters • Five secrets
-------------------------------------------------
You                         Ready ✓
Zainab                      Ready ✓
Emeka                       Ready ✓
Chief Bode                  Ready ✓
Aunty Amaka                 Ready ✓
-------------------------------------------------
Match info: AI-controlled characters may take part.
You agreed to keep individual identities hidden while playing.
[     START INVESTIGATION     ]      [Match info]
```

**Before bot fill and first readiness**, display a short plain-language AI-participation notice and a visible human-only choice. After consent, all five game character tiles are visually identical: no AI badges, no participant-kind field delivered to the browser, and no deceptive human counts. The system must not invent typing indicators, human online status, personal histories or interpersonal promises for AI characters. If player cancels consent, route to human-only waiting or practice rather than silently inserting AI.

**Solo entry screen** must state: **“Solo practice: four AI-controlled characters.”** In-match character presentation may remain uniform for visual consistency.

### Investigation — mobile layout

- **Sticky top 10–15%:** logo/round, countdown derived from server clock, connectivity, crisis headline.
- **Central content:** scrollable group chat, verifiable statements shown as distinct receipt cards (never let unverified chat bubbles mimic receipts); author identity type is not displayed; all character messages use equal visual treatment after prior informed consent.
- **Bottom sticky rail:** `Chat` / `Receipts` / `My File` / `Action`. Action bottom sheet shows remaining action and available inputs; confirm selection via server ACK.
- **Incoming requests:** confront and deal overlays do not permanently block chat; deadline, information to be exchanged, accept/decline buttons and disclosure consequences are explicit.
- **Reconnect overlay:** “Reconnecting to your seat”, never issue a duplicate fake role or re-ask sealed vote.

### The Big Reveal — the product's signature moment

1. **What the group believed:** cause, suspected character and resolution tallies, without AI/human labels on voters by default.
2. **What was true:** verified principal cause/actor and viable resolution, without sensational real-person allegations.
3. **The Wahala Chain:** chronological evidence sequence and important legal actions.
4. **Your involvement:** memory gaps and private mission; then fully authorised fictional character motivations.
5. **Optional identity epilogue:** button **Reveal AI identities** calls `identity:reveal_request` only after `game:reveal` has been delivered; server unicasts the kind mapping to that one player, never pre-reveal. A participant who never taps it is not forced to see bot labels.
6. **Connect or replay:** **Connect with real players** opens the identity epilogue before exposing human-only friend controls. Postmatch human conversations may continue; bots never send chat messages in the afterparty pretending to be available users. **Run it back** renews AI-fill consent. Use a skippable, readable 45–60s reveal with reduced-motion settings.

## 4.3 Role-specific views: owner projection only

The same UI component framework renders whichever case role its owner receives, without guessing from username/avatar or using hardcoded character names. The role card should be one screen: public persona, what you remember, private mission, special power, and “You don't yet know the full consequence of your action.” New memory fragment opens a private drawer, not a public banner.

| Example role function | Private information priority | Action affordance |
|---|---|---|
| Involved forwarder | What file you remember sending vs actual proof | Personal trace, evidence trade, bluff/defend |
| Original material creator | Source and provenance | Document chain, controlled exposure |
| Timeline witness | Time and delivery information | Investigate/verify receipt |
| File organiser | Folder/revision history | Link evidence, defend prior action |
| Suspicious joker | Misleading public remark vs actual involvement | Counter accusation; protect verified optional clue |

`BotObservation` derives from a **parallel** owner-filtered view, not from the raw `RoomRuntime`. Bots use the same fictional persona treatment by default. No fake human read receipts, actual-account links, or human social status; per-character AI identities become visible only after a player requests the optional postgame epilogue.

## 4.4 Marketing/sponsorship inventory without broken immersion

MVP `adSlots` are design **placeholders**, not active monetisation: lobby sponsor banner, optional labelled episode partner, afterparty sponsor card and editorial placements in *The Wahala Times*. Advertisers can later commission branded fictional locations/cases with visibly paid labels. No ads on private dossier, live evidence, time-limited action, sealed vote, final reveal or security modal. No commercial actor can change a bot's win policy, canonical story facts or matchmaking fairness. Viewability must be real and measured from valid events; never advertise fake live crowds.

## 4.5 Empty states, accessibility and social safeguards

- **Finding players:** truthful “Searching for other players” and non-guaranteed time estimate; show a bot-fill option only where standard casual policy allows and player explicitly opts in.
- **Insufficient humans:** don't start standard 1H+4B disguised as social match; offer `Practice Solo` as a clearly named mode. 2H+3B requires experiment flag and separate consent.
- **Weak network:** suspense/animations are not critical logic; recover using `state:snapshot` and visible authoritative clock. Animations are skippable and disabled in reduced-motion.
- **Language:** plain English labels; optional culturally reviewed Nigerian English/Pidgin dialogue. Names/accents/region choices are not moral hints or matchmaking proxies for trustworthiness.
- **Trust:** controls for block, mute, report, voice absent in MVP, public adult age boundary, host moderation, and appropriate private-chat defaults. Result cards require informed sharing and must not carry confidential messages or real-world accusations.

---

# 5. STEP-BY-STEP CODEX IMPLEMENTATION ROADMAP

**Agent execution policy:** Run prompts **sequentially** in one repository. Every phase ends with passing lint/types/unit/integration tests, an updated changelog and a clear list of remaining assumptions. Do not skip a phase because its UI looks complete. Use Node LTS, `pnpm` monorepo, TypeScript strict mode, Next.js, a long-running Node Socket.IO server, AJV 2020, Zod, PostgreSQL, Vitest, Playwright and CI. **Core match and fair NPC behavior must function without calling an LLM API.** Each coding prompt below is copy-ready.

## Phase 1 — Monorepo, schema, deterministic rules and tests

**Codex prompt:**

> Create `apps/web`, `apps/server`, `packages/shared`, `packages/engine`, `packages/bots`, `packages/content`, and `packages/ui` using pnpm. Configure TypeScript strict, ESLint, formatting, Vitest, Playwright scaffold, CI and local PostgreSQL Docker Compose. Implement the exact JSON Schema and content exemplar in Section 2, compile TypeScript types, and validate using AJV 2020 **plus** a semantic referential validator and human-accessible clue-route checks. Add migration tables for guests, rooms, five-seat participants with kind `human | bot`, sessions, events, snapshots, ballots and reports. Keep content JSON and truth off client builds. Build pure helpers for seeded variant selection, five-seat shuffled persona allocation, mission predicates, group majority-of-five outcomes and deterministic game replay.

**Acceptance:** All checks pass offline with local Docker; provided case validates; broken references/fake verified clues fail; fixed-seed case replays exactly; `packages/content` isn't in a public Next.js bundle. Unit-test 5-seat invariants, unique persona allocation, 3H+2B roster mapping and independent critical evidence routes. **Do not write matchmaking or UI before deterministic rules work.**

## Phase 2 — Guest security, room/lobby Socket contract and opt-in bot fill

**Codex prompt:**

> Implement secure opaque guest sessions bound to Socket.IO handshakes; room create/join/leave/close/lock/kick/ready/start/rematch, validated commands, strict ACKs, idempotency, random room codes, room snapshots, rate limits and sanitized lobby chat. Render Welcome and Private Lobby mobile views with five slots. Add `botPolicy: none | allow_bots`, host-controlled `room:bot_policy` and `room:fill_bots`, with policy enforcement: 3–5 **real ready humans**; exactly 5 total seats; up to 2 bots; explicit host and per-human bot-presence + identity-hidden consent in the ready flow; no per-character AI badges during the match; add server-only kind mapping and public projection tests. Once started, roster immutable. Build bot seats as server-internal participants without socket IDs and without human account records.

**Acceptance:** Five real browsers start; 3 consenting humans + 2 bots start; a nonconsenting ready human blocks fill; 2 humans cannot use standard fill; 6th participant denied; nonhost fill/start fails; concurrent bot fill + join never overbooks; every opted-in client sees the pre-entry AI-possibility notice, but no character-specific `kind` or `AI` field before an optional postgame reveal; clients cannot forge a bot participant command; bots never count toward human online totals. Disconnect/reconnect keeps same seat.

## Phase 3 — Case role allocation, private projections and server-authoritative bot observations

**Codex prompt:**

> Generate the case's single immutable hidden truth, seed commitment, hash, and shuffled persona-to-participant mapping when starting. Build owner-only public/private projectors and `role:assign`; deliver human private cards only to their authorised sockets. Create a separate `buildBotObservation(room, botParticipantId)` that calls the allowed owner projector, adds legal moves and explicitly excludes canonical chain, correct cause/actor, others' private memories and sealed votes. Implement role acknowledgment and `ROLES -> INVESTIGATION_1` transition. Bot receives its private data only inside the server.

**Acceptance:** Three human devices receive only their own cards in a 3H+2B room. Bots never trigger `role:assign` socket events. Attempted cross-player role access, SSR/API leak, forged participant IDs and serialisation of internal room state fail. BotObservation negative-leakage snapshot tests pass for all personas.

## Phase 4 — Bot policy V0 and scripted dialogue (no AI API)

**Codex prompt:**

> Implement `BotPolicyEngine` from Section 3 with `decideAction`, `decideConfrontResponse`, `decideDealResponse`, `decideBallot`, and `draftUtterance`. Supply tested policy profiles (`assertive_accuser`, `cautious_investigator`, `cooperative_negotiator`) with configuration independent of assigned persona. Use legal action enumeration, observation-only utility heuristics and per-bot seeded RNG substreams. Write bounded, culturally reviewed line templates keyed to actual known facts and public events; deliver NPC lines without a visible author-type badge in identity-hidden games, after pre-match disclosure. Add per-phase max 2 unsolicited lines, no unsolicited private DMs, fallback PASS/ABSTAIN on planner failure, and audit events for choice/policy version/observation hash. Never read case `correct` or canonical chain in the bot scoring module.

**Acceptance:** Bots always choose legal options, don't reveal secret receipts they lack, never claim a real-world human identity, respect non-spam quotas, can respond coherently to confront/deal, and produce reproducible actions from fixed observation/seed. Fuzz policy with unsupported/private-data injection; no secrets escape. A force-failing bot doesn't crash the game.

## Phase 5 — Full three-round action/state machine, bots and humans together

**Codex prompt:**

> Implement ROLES/INVESTIGATION_1/SETTLING_1/TWIST/INVESTIGATION_2/SETTLING_2/INVESTIGATION_3/SETTLING_3/VOTING transitions with authoritative deadlines, room serialisation, append-only events, snapshots and pure reducer. Implement `INVESTIGATE`, `CONFRONT`, `EXPOSE`, `MAKE_DEAL`, `DEFEND`, `TRACE_SELF`, `ABILITY`, `PASS`, one action per seat per round. Run human and bot actions through a **single domain command executor** with same permission checks. Freeze start-of-round evidence; implement 20-second settlement responses, automatic declines, delayed optional twist clue policy, and round-2 memory fragments. Build portrait Investigation UI with chat/evidence/action/dossier bottom tray.

**Acceptance:** Complete mixed-room cases with three real clients + two policy bots, and all-human five clients, through all three rounds. Simultaneous conflicting actions resolve deterministically. Human cannot override bot seat; bot cannot read another player's uncommitted move. Server crash/restart rehydrates correct room; evidence cannot be double-granted, power double-spent or deal double-executed. Test weak networks and late ACKs.

## Phase 6 — Sealed ballots, bot votes, the Big Reveal and rematches

**Codex prompt:**

> Implement one private cause/principal participant/resolution ballot per seat; bots pick using observed evidence only and cast via server-internal service. Evaluate 3-of-5 majority per category, group success, separate actor identification and private mission predicates. Mark `HUMAN_CASUAL`, `MIXED_CASUAL` and `PRACTICE` outcomes distinctly. Build cinematic but accessible `REVEAL` and full chronological chain viewer; provide Afterparty, safe share card and host rematch. Generate two additional genuinely different, reviewed, fully solvable causal variants of the screenshot case; semantic-check each with exhaustive role mappings and replay fixtures.

**Acceptance:** No ballots or NPC identities leak early. Bot votes count normally and are never secretly “corrected”; their individual kinds are visible only when the user requests the postgame AI identity epilogue. Tie/abstain fixtures pass, missions use explicit predicates, mixed/practice games never update human-only ranked stats, reveal is truthful, bot personas are only identified to a player after that player requests the optional postgame AI identity disclosure. Rematch retains humans who opt in but generates new seed and fills NPC seats only after renewed consent.

## Phase 7 — Quick Play, solo practice, safety, retention and sponsor surfaces

**Codex prompt:**

> Build public adult Quick Play with `match:enqueue`, `match:bot_offer`, `match:fill_consent`, `match:found`, `match:accept`, `match:started`, cancel/expiry; try compatible humans first, then suggest bot fill after configurable wait. Commit roster only after all humans accept the offer. Add truthful population/wait UI and clearly disclosed 1H+4 AI solo practice before entry (uniform in-game character art) with no competitive rewards. Add moderated/opt-in social rooms when operationally ready, mutual friendship, afterparty and scheduled game nights. Scaffold The Wahala Times with new cases, consented achievements, events and sponsor-labelled sections. Add nonintrusive ad inventory in lobby and afterparty but no ads on dossier/vote/reveal. Add moderation tools, age boundary, rate limits and consent workflows.

**Acceptance:** 3H+2B queue requires explicit informed consent; all-human queue remains human-only; no AI-seat identity is present in room snapshots, match-found events, chat messages or default reveal; `identity:reveal_request` is rejected before the actual reveal and works only for the requesting socket afterward; no fake occupancy; two human users aren't quietly matched into a standard 3H minimum game; practice is correctly labelled and unranked; reports, blocks and safety routing work; sponsor placements cannot affect canonical case, bot policy or scoring.

## Phase 8 — Production QA, 10-Round Challenge, fairness and release gate

**Codex prompt:**

> Run repeated social playtests (at least five cohorts of five humans across ~10 cases each) and mixed-session 5H / 4H+1B / 3H+2B experiments. Track completion, rematch and unprompted return, human-to-human messages, human-bot interactions, bot vote swing, player understanding, role fairness and perceived manipulation. Run schema/reducer fuzz tests across roles, simulated cases, disconnects, concurrent joins, duplicate commands and process restarts. Load-test at least 100 rooms with mixed bot/human populations, validate application-level SLO hypotheses, audit for spoiler leaks in the browser, logs and analytics. Produce a go/no-go report with root-cause analysis and documented blockers.

**Acceptance:** No known cross-player role exposure; deterministic case/reducer and NPC decisions replay from committed inputs; complete games under fallback PASS/ABSTAIN; social connections and replay show positive directional signal beyond reduced queue time; moderation capacity is demonstrably ready before opening unrestricted public discovery. Do not ship paid ads to brands until inventory measurement and real audience value are verified.

## 5.9 MVP boundaries, decisions still requiring tests, and release criteria

**Required for CLOSED ALPHA:** one valid flagship case, 3H+2B private rooms, five-human private rooms, guest auth, full role/action/vote/reveal/afterparty loop, basic rule-driven NPCs with a one-time AI-presence consent notice and identity-hidden character view, optional postgame AI reveal, disclosed solo practice, reconnection, core reporting/blocking, deterministic replay and instrumentation. **Not required:** open public Lounge, free-form AI-generated speech, sophisticated rankings, property ownership, currency, creator marketplace, sponsorship payments or a persistent city.

**Required before PUBLIC BETA:** public Quick Play and opt-in bot fill, staffed moderation and reports, reasonable match wait measurement, systematic abuse mitigations, 3 validated causal variants, enough content/variance to pass repeated playtest, stable operations, accessible mobile UI, consented Times surfaces and truthful marketing.

**Open uncertainties to resolve through playtest, not assumed facts:** is 3H+2B as socially fun as 5H? Are bot negotiations enjoyable or irritating? Does bot-first availability cannibalise human friendships? Can three action rounds create a clear proof without being repetitive? Does Blind Involvement empower players or confuse them? How often do NPC votes determine majority? Is there sufficient genuine human activity for sponsor engagement and returning players?

**Operational success is not only faster queues.** The product north star is **voluntary repeat play among real humans with memorable, fair, evidence-backed stories**, supported—not replaced—by AI characters.

---

## Appendix — Project hand-off checklist

- [ ] `GAME_SPEC.md` treated as design source; repo contracts and code must be generated/tested where possible.
- [ ] Split Section 2's case schema/flagship data into `packages/shared/schemas/case.v1.schema.json` and `packages/content/screenshot_leak_001.json` **server-only**.
- [ ] Build cross-validated event contracts and central `participantId` rather than client-controlled player IDs.
- [ ] Implement private lobby before public matchmaking; three humans plus two AI must complete same five-seat case.
- [ ] Assert server-only human/NPC counts, mandatory pre-entry AI notice, hidden per-character types during matches, and postgame on-demand identity reveal in integration and Playwright tests.
- [ ] Formalise bot policy versioning and negative-leakage test suite before sophisticated chat.
- [ ] Release with a kill switch for NPC matchmaking and ability to route to humans-only / practice.
- [ ] Preserve social consent, adult safety, fair ads and nonpartisan civic content boundaries.
