# v29 SHEET — what changed and why

Baseline: the v28 LINEUP package. User feedback on the printable/exportable
Game Plan sheet: it's the feature that gets used most on the sideline, but
it was hard to reach for the coach mid-game, and once printed it went stale
immediately — no way to tell what had already happened, or where a real
substitution had already diverged from the plan.

---

## 1. Easy access from the Game tab

The **Game Plan** button used to live only on Pregame, plus a copy in the
Viewer bar. A coach spends the entire live game on the Game tab and had to
switch tabs to reprint or re-download the sheet. There's now a **Game Plan**
button right in the Game tab's own control row, next to Start/Pause/Undo —
same sheet, same Print/Download/Refresh actions, no tab switch.

*Test: "the Game tab has its own Game Plan button, not just Pregame and the
viewer bar".*

## 2. Finished rotation windows are crossed off

Once a projected 6-minute window's end time has passed, its row on the
sheet is shown struck through with a ✓, like a paper checklist. Reopen or
Refresh the sheet any time during the game and you can see at a glance
what's already happened and what's still ahead — no new tracking needed for
this, the game clock already knows what time it is.

*Test: "a finished rotation window is crossed off on the printable game
plan".*

## 3. A manual change is highlighted, not silently absorbed

The window currently in progress is checked against the real field. If a
manual substitution has already moved someone to a different position than
the plan called for, that cell is highlighted (amber) showing who's actually
there now, with a small "manual change — plan: X" note underneath. Nothing
is flagged for a window that's already finished (it's crossed off instead,
not re-litigated) or one that hasn't started yet (there's nothing to check
against).

This needed one small addition: `state.kickoffLineup`, a snapshot of the
starting five frozen the instant Build Game Plan commits. Without it, the
sheet's own "planned" value for the opening window would just mirror
whatever the live lineup currently is — comparing the current lineup to
itself can never show a difference. The snapshot is synced to both coaches'
phones the same way the goalie plan already is (part of the atomic
`/api/plan/<code>` commit), so either phone's sheet can make the same
comparison.

*Tests: "a manual change during the current window is highlighted on the
printable game plan, a later one is not"; worker-side, "plan commit carries
the frozen kickoff lineup snapshot through to the other phone".*

---

## Still open

- This is a live "is it currently different" check, not a full substitution
  ledger — the sheet doesn't keep a record of every past window's actual
  lineup, only whether the window in progress right now matches the plan.
  A true per-window history (what really happened in window 3, reprinted
  after window 6) is a bigger feature and wasn't part of this ask.
- The Viewer's own field view (bigger jersey display, goals shown per
  player, a bench-coach propose-and-approve workflow) is a separate,
  larger request that came in the same conversation and needs its own scope
  discussion before starting — not built in this pass.
