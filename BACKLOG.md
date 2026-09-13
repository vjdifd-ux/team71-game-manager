# Team 71 Game Manager — Backlog

Product direction: **single team only.** This is East Islip GU7's own tool,
not a multi-team product — every decision below should optimize for one
team's game-day reliability and role clarity, not for generality or a
future customer base.

Priority tiers are P0 (blocking, fix before relying on this for a real
game), High, Should-have, and Low (deliberately deferred). Within a tier,
order is not significance — pick whichever fits the session.

Each item below names the real pain it comes from (several are things this
app has already hit in actual games) and, where useful, which part of the
codebase it touches, so a session can start reading code immediately
instead of re-deriving context.

---

## P0 — game-day blocking

### Touch reliability
Mis-taps and dead-zone taps on the field/bench/status buttons under real
game conditions (one-handed, outdoors, moving) are a different failure mode
than "the logic is wrong" — the logic can be perfect and the game can still
go sideways because a tap didn't register or hit the wrong target. Needs a
pass over `public/index.html`'s tap targets: `.fp` (field positions),
`.bench-btn`, the Player Status buttons, and the sub-suggestion controls —
hit-area sizing, tap debouncing/double-tap guards, and visual confirmation
that a tap registered before the DOM re-renders out from under a finger.

### Single authoritative primary coach
Today only the **clock** has a single owner (`timerOwnerId`, checked in
`startPause()`, `tick()`, `advanceClockToNow()`). Every other action —
subs, goals, availability, the goalie plan — is a free-for-all merged by
domain (`DOMAIN_FIELDS` in `src/worker.js`), which is fine for casual
co-coaching but not for "who is actually running this game." Needs a real
primary/secondary coach model: one coach designated authoritative for
lineup and scoring decisions too, not just the clock, with the second
coach's phone clearly in a supporting role rather than equally-privileged.

### Explicit bench-coach sync button
Sync is currently pure background polling (`POLL_STATE_MS` = 2s via
`cloudPull()`, `POLL_AUDIT_MS` = 5s). There is no way for a coach to force
"get me current truth right now" — `connectionTestBtn` only checks
reachability, it doesn't pull state. On a flaky sideline connection, a
bench coach needs a button that says "sync now" and gives a clear
success/fail result, not just trust in the next poll tick.

### Clear role status on all screens
`#syncStatus` (the dot + "Shared • synced" text) lives in one card on the
Pregame tab (`public/index.html` ~line 173) — invisible on the Game tab,
where coaches spend the whole match, and invisible to a Viewer entirely
(the v24 viewer-mode simplification hid the Pregame panel, sync status
included). Every screen a coach or viewer can be on needs an always-visible
"who am I, and am I synced" indicator: role (Primary Coach / Bench Coach /
Viewer) plus connection health, not buried in a tab nobody's looking at
mid-game.

---

## High priority

### Dedicated "Bench: What's Next" view
The bench coach's actual job during play is narrow: know who's coming in
next and when. Today that's the `#nextSubBox` card mixed in among the
field diagram, goalie strip, and quick-score card on the Game tab — a lot
of visual noise for someone whose only question is "who's up." Worth a
purpose-built view (could reuse the Viewer-mode simplification pattern
from v24 — see `body.viewer-mode` CSS and `renderShared()`) scoped to just:
countdown, suggested swap, and bench order.

### Flexible sub timing
The rotation model is fixed at exactly 6-minute windows
(`SUBINT = 360` in `public/index.html`). Real games don't stop on a timer —
stoppages, blowouts, and injuries all argue for subs at moments the clock
doesn't control. This already has an escape valve (manual subs, "Sub In
Whole Bench" is available anytime, not gated to the 6:00 mark) but the
*fairness math* (`suggestSub()`, the cover-lock window math in
`coverLockUnlockElapsed()`) is still anchored to the fixed grid. Worth
revisiting whether fairness should be computed off a rolling window instead
of a fixed one, so an early or late sub doesn't throw off the next
suggestion's timing.

---

## Should have

- **Postgame summary** — a one-screen recap (final score, minutes played,
  goals, goalie quarters) generated at End Game, distinct from the season
  History list. `endGame()` in `public/index.html` already has all the
  numbers in hand at the moment it saves to history.
- **Per-player sub log** — right now substitution history lives only in the
  Audit feed (`game_audit` table, `renderAudit()`), which is
  chronological-by-event, not organized by player. A per-player view
  ("Luna: in at 0:00, out at 18:24, in at 24:00...") would need a new
  read/aggregation, not new write-side data — the audit log already has
  everything.
- **Undo** — already exists (`pushUndo`/`undo()`, `UNDO_PROTECTED` list) but
  is a single-level stack with a 20-entry cap and no visibility into what's
  on it beyond the last label. Worth a "what would this undo?" preview and
  possibly deeper history.
- **Position diversity** — the fairness engine (`suggestSub`, the Build
  Game Plan field-fill) only tracks total minutes, not which positions a
  player has played. A kid could play F every single rotation and never
  see a back line. Would need a new per-position minutes bucket alongside
  the existing `state.play`.
- **Skill ratings** — nothing like this exists today; roster is a flat
  array of names (`const roster = [...]`). Any positional or matchup
  intelligence beyond "fewest minutes" needs this as a prerequisite.
- **Starting lineup assistant** — Build Game Plan's field-fill is a single
  sort by season minutes (`buildPlan()`). A real assistant would want
  position history and skill ratings (both above) to suggest a starting
  five, not just impose one.
- **Stale print indicator** — the printable game plan (`renderGamePlanPrint()`,
  v25/v26) already re-renders fresh every time it's opened or Refreshed,
  but a sheet that was printed or downloaded 20 minutes ago has no visible
  "this may be out of date" marker once it's off-screen (on paper, or in a
  downloaded HTML file). Worth stamping the generated-at time more
  prominently and/or color-coding it once it's a certain age, at least for
  the on-screen modal view.

---

## Low priority — deliberately deferred

- **Multi-team or public product expansion.** This app is intentionally
  single-team (hardcoded roster, hardcoded team name, no accounts, no
  tenancy). Nothing above should be built in a way that *requires* solving
  multi-team support first, but nothing above should be blocked waiting for
  it either — nice-to-not-close-the-door-on, not a goal.
