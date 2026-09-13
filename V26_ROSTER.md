# v26 ROSTER — what changed and why

Baseline: the v25 PRINT package. Two real bugs and two feature follow-ups,
all reported from the same game.

---

## 1. A Viewer's phone could get permanently stuck

v24 gave a Viewer's phone one simplified page instead of the coach's full
tab set — but the controls to leave the shared game or switch back to Coach
lived on the Pregame tab, which is exactly what got hidden. Once a phone
joined as Viewer, there was no way back to Pregame from that phone at all.

A small bar now sits at the top of the Game tab, visible only in Viewer
mode, with **Game Plan** and **Leave Shared Game**. Leaving drops the phone
back to local/Coach mode, which brings the full tab set back immediately.

*Test: "a viewer can always get back out of viewer mode".*

## 2. Resting the snack/Q4 goalie could permanently bump her

Reported: the snack player was correctly set as Q4's goalie before kickoff,
but ended up replaced by the first alphabetically-tied player once the game
was underway. Root cause: marking anyone Rest or Out reassigns every
*remaining* quarter's goalie plan (`i >= current quarter`) away from her —
correct for Out (she's gone for the day), but the same eager reassignment
fired for Rest too, even though Rest is meant to be a quick breather. A
player rested during Q1 could permanently lose a Q4 assignment two quarters
away, with everyone tied on 0 goalie-minutes pregame, so the fallback
tie-break (fewest minutes, then roster order) landed on whoever's listed
first — not a real "decision," just the tie-break's roster-order default.

Rest now only reassigns the *current* quarter's goalie, if she was actually
due in goal right now. Every other quarter's assignment — the snack
player's Q4 included — is left untouched, and resolves normally (through
its own fallback) if she's genuinely still unavailable when that quarter
actually starts. Out is unchanged: still gone for the rest of the game,
still reassigned immediately.

*Tests: "resting the Q4 goalie mid-game doesn't strand her future
assignment on a tie-break default", "marking the Q4 goalie fully Out still
reassigns her future quarter right away".*

## 3. The printable game plan now projects the whole game, not just Q1

The ask: a fallback that's useful mid-game, not just at kickoff — the full
game, every 6 minutes, who's in each field position, who's in goal, who's
on the bench.

The print sheet's "Starting Lineup" section is now a **Projected Rotation
Plan**: all 8 half-quarters, each row showing GK / LB / RB / M / F / Bench.
It's computed with the same "lowest minutes in" rule the live fairness
engine uses, seeded from the current goalie plan (snack rule included) and
today's attendance — so it's what the *plan* looks like, not a transcript
of what actually happened. Real subs, injuries, and manual changes during
the actual game will diverge from it, and it says so on the sheet. Reopen
the sheet (or tap Refresh) any time — pregame or mid-game — to re-project
from whoever's currently marked available.

`computeGoaliePlan()` is now shared between Build Game Plan and the
projection, so the two can never disagree about who's in goal when.

*Tests: extended the printable-game-plan tests to check the full 8-window
table and that Out/Rest players are excluded from the rotation (not just
the attendance list); "Refresh re-renders the sheet from the current state
without closing the modal".*

## 4. Download, and Viewer access to the game plan

Two smaller asks that came with the above: a Viewer's phone couldn't reach
the print sheet at all (fixed as part of #1 — the new Game tab bar has a
**Game Plan** button), and there was no way to get an actual file off the
sheet beyond Print or a screenshot. **Download** now saves a standalone
HTML file (`team71-gameplan-YYYY-MM-DD.html`) with the sheet's content and
its own inline styles — openable later with no network, no app, and no
dependency on this session. Still no new libraries: it's a `Blob` and an
`<a download>`, both standard browser features.

*Tests: "Download produces a standalone HTML file of the current game plan
sheet", "a viewer can open the game plan sheet without leaving viewer
mode".*

---

## Still open

- The rotation projection always starts from an even split at kickoff; it
  does not pick up from actual minutes played so far if reopened mid-game.
  That's a deliberate scope line (see v25's own "Still open"), not an
  oversight — flag it if a mid-game "continue from here" projection is
  wanted instead.
