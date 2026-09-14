# v30 BENCH — what changed and why

Baseline: the v29 SHEET package. The ask: clean up the Viewer/bench-coach
side of the app around the field view, and give a second sideline adult a
real role — one who can flag a substitution without being able to just make
it unilaterally. This is P0.2/P0.3 from the backlog (Primary/Bench/Viewer
roles, requests instead of direct overwrites), scoped to the part that was
actually asked for.

---

## 1. A third role: Bench Coach

`shareRole` gains a third value alongside `coach` and `viewer`. A Bench
Coach:

- Gets the same simplified live-game page as Viewer (no Pregame/History/
  Backup tabs — nothing there needs editing from the sideline).
- Can select a bench player and tap a field position, or tap **Propose This
  Sub** for the current whole-bench suggestion — exactly the same gestures
  a coach uses.
- Can never apply a substitution directly. `canEdit()` now means "is Coach"
  specifically (it used to mean "is not Viewer," which would have quietly
  let Bench Coach through); every direct-apply path — goals, manual subs,
  the goalie plan, quarter transitions — was already gated behind it, so
  closing that gap needed no changes to those paths themselves.

Join it from the **Active Team 71 Game** card's new **Join as Bench Coach**
button, or the role dropdown on the manual code-entry form.

## 2. Propose → Approve/Decline, never a silent overwrite

A Bench Coach's tap doesn't touch `state.lineup` at all — it writes
`state.pendingSubRequest` (who's proposed in, who's out, which position),
synced through its own `request` domain so it can never collide with or
overwrite the lineup, clock, or score domains. The Primary Coach sees an
**Approve / Decline** card the moment a request arrives:

- **Approve** applies it exactly like accepting a suggested sub would
  (settles the clock first, updates the goalie plan if the slot was GK,
  logs it to the audit trail) and clears the request for both phones.
- **Decline** just clears the request — the field is untouched.

Undo deliberately never touches `pendingSubRequest` (added to
`UNDO_PROTECTED`, the same list that already protects the clock and
accumulated minutes) — a request is a live, three-way conversation between
two phones, not local editable game data one Undo tap should be able to
resurrect out of sync with what the other phone sees.

*Tests: "a Bench Coach's proposed sub only applies once the coach approves
it", "the coach can decline a Bench Coach's proposed sub, leaving the field
untouched", "a Bench Coach can propose a single manual sub the same way a
coach makes one".*

## 3. The field view itself: goals on the shirt, who's rotating

Requested alongside the role: make the field view carry more information on
its own, for Viewer and Bench Coach alike (and there's no reason to keep it
from the Coach's own screen either, so everyone gets it).

- A small badge appears on any shirt for a player who's scored — "who
  scored" is answerable from the field alone, not just the goal log.
- Whichever swap is currently live — a coach's own suggestion, or a Bench
  Coach's request awaiting approval — tags the field position leaving as
  **OUT next** and the bench player coming in as **IN next**, so "who's
  rotating in or out" doesn't require reading the separate suggestion box.

Score was already the first thing shown on the shared page before this
release; no change was needed there.

*Tests: "a goal shows as a badge on top of the scorer's shirt", "the field
and bench show who is rotating out and in next".*

---

## Still open

- A request is one at a time — a second bench proposal while one is
  already pending is refused with a status message rather than queued.
  Fine for one Bench Coach; would need real queuing for more than one.
- No per-request history — once approved or declined, a request is gone
  from `state`; the audit log is the only record of it having existed.
- The printable Game Plan sheet's "manual change" highlighting (v29) does
  not yet know about approved bench requests specifically — it compares the
  live lineup to the plan regardless of whether the change came from the
  coach directly or from an approved proposal. That's already the correct
  behavior for what the sheet is for (is the field different from the plan
  right now), so no change was made there.
