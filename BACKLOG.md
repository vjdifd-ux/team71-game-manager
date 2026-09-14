# Team 71 Game Manager — Detailed Product Backlog

**Status:** Backlog only — do not implement unless explicitly requested
**Current scope:** East Islip GU7 Team 71 only
**Primary goal:** Make game-day operation reliable, fast, obvious, and low-effort.

## Product Principles

- The app should assist the coach, not control the coach.
- The game flow must never become blocked because a suggested substitution was not made.
- One device is authoritative: the Primary Coach.
- Goal, player, sub, and quarter taps must feel immediate.
- The Bench Coach should be able to glance at the screen and instantly know who is playing, who is sitting, and what is next.
- Avoid typing-heavy game-day workflows.
- Fairness should consider total minutes, position diversity, skill balance, and goalie assignments.

---

## P0 — Reliability / Architecture

### P0.1 Touch Reliability and Responsiveness

**Problem:** In the first real game, player and goal taps sometimes did not register or felt slow.

**Requirements**

- Player taps, goal buttons, substitution actions, and quarter controls must respond on first tap.
- Provide immediate visible feedback before cloud sync completes where safe.
- Prevent accidental double-goals or duplicate substitutions from rapid taps.
- Sync failures must not make the UI feel frozen.
- Test on iPhone/PWA, poor signal, rapid tapping, and two connected phones.

**Acceptance**

- One intentional tap registers once.
- User gets visible confirmation almost immediately.
- Cloud failure does not block normal local game operation.

### P0.2 Single Authoritative Primary Coach

There should be exactly one Primary Coach device per active game.

**Primary Coach**
Full control of clock, goals, lineup, substitutions, goalie changes, quarter changes, availability, undo, and game end. This device is the source of truth.

**Bench Coach**
Operational assistant view. It should consume the Primary Coach state, have a Sync to Coach / Refresh from Coach button, and never silently overwrite Primary state.

If Bench proposes an authoritative change, it should become a request that the Primary explicitly approves or rejects.

**Viewer**
Strictly read-only. Can see score, clock, lineup, bench, next suggested sub, and game status.

**UI**

Every major screen should clearly show role/status, for example:

- PRIMARY • LIVE
- BENCH • Synced 3s ago
- VIEWER • Read only

**Rules**

- Only one Primary at a time.
- Bench/Viewer cannot silently become Primary.
- Primary handoff requires explicit confirmation.
- Secondary devices cannot pause/re-anchor the Primary clock.

### P0.3 Sync Model / Conflict Prevention

- Primary is authoritative.
- Secondary devices pull from Primary/shared state.
- Add visible last-sync age.
- Add Sync to Coach on Bench and Viewer.
- Bench changes should be pending requests, not direct overwrites.
- Never silently merge conflicting lineup state.
- Clock ownership stays with Primary.

---

## P1 — Game-Day Usability

### P1.1 Dedicated Bench Coach View

**Goal:** A stripped-down, glanceable sideline screen.

**Show prominently**

ON FIELD
- GK
- Forward
- Mid/Support
- Left Back
- Right Back

ON BENCH
- each sitting player
- total minutes played
- optionally time since last entered

WHAT'S NEXT — very large recommendation such as:
- Olivia IN
- Kennedy OUT
- Right Back

**Behavior**

- No admin/history clutter.
- Score and clock visible but secondary.
- Bench coach can press Sync to Coach.
- If request workflow exists, Bench may press Request This Sub.

**Acceptance:** In 2–3 seconds, a coach should know who is on, who is off, who should go in, who should come out, and where.

### P1.2 Flexible Substitution Timing

**Problem:** A forced 6:00 stop did not work in a real game.

**Requirements**

- Clock never stops automatically at 6:00.
- At 6:00, only remind the coach and show a suggested substitution.
- Coach may sub before, at, or after 6:00 whenever play allows.
- Recommendation should keep recalculating from actual minutes.
- No "must finish sub before resume" state.
- Manual substitutions remain available at all times.

### P1.3 Clear Substitution Workflow

- Prefer one-for-one recommendations instead of confusing 3-player batches.
- Show exactly:
  - player IN
  - player OUT
  - affected position
- Example: Olivia IN → Kennedy OUT (Right Back)
- After one sub, immediately calculate the next fair recommendation.
- Manual sub should be simple: select bench player, then field player/position.
- Clock must never jump because of a substitution.

### P1.4 Position Diversity / Rotation

**Problem:** Equal minutes alone can still leave one girl playing defense all game.

**Track by player**

- total field minutes
- GK minutes
- forward minutes
- mid/support minutes
- left/right defense minutes
- optionally attacking vs defensive minutes

**Recommendation logic should consider**

1. total playing time
2. bench time
3. position history this game
4. recent position
5. skill balance
6. goalie assignment
7. availability

**Rules**

- Avoid repeating the same position when reasonable.
- Avoid one player being stuck on defense.
- Aim for both attacking and defensive exposure over time.
- Coach can always override.

### P1.5 Game Log Clarity — One Player Per Line

Combined substitution log entries are too hard to scan.

Use:
- 18:42 — Olivia Carpenter IN for Kennedy Kozlosky
- 18:42 — Norah Dineen IN for Shalom Amaya
- 18:42 — Luna Scrivano IN for Aria Stagnitta

**Keep events for**

- substitution per player
- goal
- goal undo
- goalie change
- quarter start/end
- game start/end
- player unavailable/injured/resting
- undo action

Do not add typing-based freeform game notes.

### P1.6 Undo Last Action

Support one-tap undo for at least:

- goal
- substitution
- goalie change
- availability status
- quarter transition if safe

UX example:
`Goal: Norah +1   [UNDO]`

Undo must reverse local and authoritative shared state and log the undo itself.

---

## P2 — Pregame Planning

### P2.1 Player Skill Ratings

Give each player a coach-only overall skill rating, initially 1–5.

**Possible later categories**

- ball control
- speed
- passing
- defense
- finishing
- confidence/game awareness

**Use ratings to**

- avoid stacking all strongest players together
- avoid one weak rotation following one very strong rotation
- balance starting lineup and later groups
- work alongside playing-time fairness and position diversity

Never block a coach override.

### P2.2 "Do the Starting Lineup, Please"

Add a simple Build Starting Lineup assistant.

**Inputs**

- attendance
- availability
- planned goalie
- skill rating
- recent/historical playing time
- position history
- position diversity
- line balance

**Output**

- GK
- Forward
- Mid/Support
- Left Back
- Right Back
- 3 bench players

**Actions**

- Accept
- Regenerate
- Adjust

**Future natural-language examples**

- "Give Norah a break first quarter."
- "Don't bench Olivia and Serafina together."
- "Give me the strongest starting lineup."
- "Balance the first two groups."
- "Who should start based on playing time?"

Never silently apply the suggestion without coach confirmation.

### P2.3 Balanced Lines Across the Whole Game

Do not optimize only the first five.

When generating planned rotations:

- compare combined skill of each expected group
- keep total minutes reasonably equal
- avoid repeating the same player combinations too much
- rotate positions
- preserve planned goalies

---

## P2 — Printable Sheets

### P2.4 Stale Printable Sheet Indicator

When a printable sheet is generated/printed, save a fingerprint/version of all information represented on that sheet.

If relevant data later changes:

- button changes color and/or briefly pulses
- wording becomes Print Updated Sheet

After reprinting, it returns to normal.

**Should mark stale**

- attendance
- availability
- starting lineup
- goalie assignments
- positions
- planned substitutions/rotation plan
- anything else actually printed

**Should NOT mark stale**

- tab changes
- clock movement
- score
- sync age
- opening history/settings

---

## P2 — Postgame

### P2.5 Post-Game Summary Screen

Create a clean screen designed for a fast screenshot.

**Include**

- final score
- opponent/date
- each player's total minutes
- GK minutes
- goals
- position distribution
- useful substitution summary
- game duration/status

Future option: compare today vs season average.

---

## P2 — Testing / QA

### P2.6 Accelerated Test Clock

**Modes**

- 1× normal
- 10×
- 60×

**When accelerated**

- player minutes accelerate correctly
- GK minutes accelerate correctly
- 6-minute reminder still fires
- quarter boundaries still work
- next-quarter flow still works
- goals/subs remain usable
- shared state remains coherent

**Safety**

- Very obvious TEST MODE
- New Game always returns to 1×

---

## P3 — Future / Low Priority

### P3.1 Multi-Team / Public Product Support

Do not build this now.

Current scope stays: East Islip GU7 Team 71.

**Possible future expansion**

- team onboarding
- editable roster
- configurable game length
- configurable positions
- other league rules
- multiple teams
- coach invitations
- generic branding

Do not make Team 71 harder to use just to make the app generic.

---

## Explicitly Rejected

### In-Game Freeform Notes

Do not add a typing workflow during play.

Reason: coach does not have time to type during a game.

If revisited later, notes should be automated or one-tap structured events.

---

## Suggested Implementation Order

1. Touch reliability / responsiveness
2. Primary Coach authoritative architecture
3. Bench Coach + Viewer roles
4. Dedicated Bench "What's Next" view
5. Flexible substitution engine
6. Per-player game log + Undo
7. Position-diversity tracking
8. Skill ratings + balanced lineup engine
9. Starting-lineup assistant
10. Stale printable-sheet indicator
11. Post-game summary
12. Only later consider public/multi-team support

---

## Instruction for Claude Code

This is a product backlog, not an implementation request.

Do not implement everything at once.

**Before coding any item:**

1. identify the exact requested backlog item
2. inspect current architecture
3. propose the smallest safe design
4. identify regression risks
5. preserve game-day reliability over feature count
6. add targeted tests
7. avoid unrelated redesigns

**Most important design rule:**

> The clock and game must keep working even if the coach ignores every recommendation the app makes.
