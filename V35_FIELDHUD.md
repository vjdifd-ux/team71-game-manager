> **Refined — see V36.** The corner HUD badges described below were replaced
> in v36 with full-width bars flush with the field's own edges. See
> [`V36_FIELDBAR.md`](V36_FIELDBAR.md).

# v35 FIELDHUD — what changed and why

Baseline: the v34 PRINTLAYOUT package. Continuing the field-view cleanup
from a few releases back: put the score, clock, and quarter directly with
the field itself instead of scattered across separate cards, and move the
goalie rotation reference table out of the way since it's not something to
check constantly.

---

## One card, one view

The scoreboard (team names on top, score underneath — unchanged from v32)
now sits directly above the field inside the same card, and the quarter
and clock are corner badges right on the field graphic itself:

- **Quarter** ("Q1", "Q2", …) — bottom-left corner of the field.
- **Clock** (the quarter timer, with total game time as a smaller line
  underneath) — bottom-right corner.

Score, who's on the field and in what position, and time left are now all
readable from a single glance at one card, instead of three separate
pieces of the old top card (scoreboard + quarter/timer block) plus the
field card below it. The old top card is now just the coach's controls
(Start/Pause/End Game/…), status line, and the Last Sub banner — nothing
duplicated between it and the field card.

## Goalie Rotation moved below the field

**Goalie Rotation — Full Game** used to sit between the sub-suggestion box
and the field. It's a reference table, not something a coach or viewer
needs to check every few seconds during play, so it now comes after the
field card instead of before it.

*Test: "the clock and quarter are shown right on the field, and the field
comes before Goalie Rotation" — checks that `#quarterLabel`/`#timer` are
actual descendants of `.field`, that the scoreboard lives in the same card
as the field, and that the Goalie Rotation card comes after the field card
in DOM order. Verified against two separate real regressions (HUD badges
moved out of the field; card order reverted) by reverting each and
confirming the test fails.*

This applies to the Coach's own Game tab as well as the Viewer's
simplified page — both share the same markup, so there was no reason to
build it twice.

---

## Still open

- The corner HUD badges are sized for a phone-width field card; no
  particular tablet/desktop-width tuning was done beyond what already
  existed for the rest of the layout.
