# v25 PRINT — what changed and why

Baseline: the v24 SIDELINE package.

---

## A one-page fallback record of the game plan

The ask: something to fall back on if the app crashes, the phone dies, or
there's no signal — printable at home if the coach is still there, or
screenshotted on a phone on the way out the door if not.

**Print / Save Game Plan** on the Pregame tab opens a one-page sheet with:

- Opponent and home/away
- Who has snack (and that she's the Q4 default goalie)
- The goalie plan for all four quarters
- The starting lineup (once Build Game Plan has run — before that, it says
  so plainly rather than showing a lineup that isn't real yet)
- Every roster player's attendance and status for the day, snack player
  flagged

It reflects whatever's currently on screen — the goalie planner's live
draft if you haven't pressed Build Game Plan yet, the committed plan once
you have — so it's useful at any point in setup, not just at the end.

**No new dependencies.** This is styled HTML in a modal, not a rendered
image — deliberately, so the offline-first PWA doesn't need to load an
image-rendering library just for this. Two ways to get it off the screen:

- **Print** — on desktop this goes to a printer; on a phone, the browser's
  print dialog offers "Save as PDF" as a destination.
- **Screenshot** — the sheet is one flat card, laid out to be legible when
  photographed or screenshotted directly, no extra step needed.

*Tests: "the printable game plan is a fallback record of the pregame setup",
"the printable game plan reflects the committed lineup once the plan is
built".*

---

## Still open

- The sheet always lists the full roster, not just who's present today —
  deliberate, so a coach checking the sheet cold can see who's missing, not
  just who's coming.
- No image (PNG) export. If "Save as PDF" or a screenshot isn't good enough
  in practice, an actual canvas-rendered image is possible without adding a
  library — it's just more code (manually drawing each line of text) for
  marginal benefit over what phones already do natively. Say the word if
  it's needed.
