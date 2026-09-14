# v33 PRINTFIX — what changed and why

Baseline: the v32 SCHEDULE package. Bug report: printing the Game Plan
sheet produced 4 pages with a black background instead of a clean one-page
printout.

---

## Root cause

Two rules interacted badly, both on `#planPrintModal`/`.modal-card`:

- `.modal-card{max-height:85vh;overflow-y:auto}` — added back in v27 so the
  sheet scrolls inside the modal on screen when it's taller than the
  viewport. The `@media print` block reset `box-shadow`, `border`, `width`,
  `padding`, and `margin` for print, but never cleared `max-height` or
  `overflow`. So at print time the sheet was still capped to one
  viewport-tall box with the rest clipped off — never actually reaching the
  printer as more than a fragment.
- `#planPrintModal{position:fixed;inset:0}` — `position:fixed` elements
  only paint once, on the first page, in most browsers' print engines. Once
  content is capped and needs multiple print pages, `position:fixed`
  doesn't repeat the sheet across them; the leftover pages fell through to
  the app's own dark page background showing through — the black pages.

## The fix

- `#planPrintModal` switches to `position:static` for print, so it
  paginates in normal document flow like any other content instead of
  relying on fixed positioning that only renders on page one.
- `.modal-card`'s print rule now also sets `max-height:none;overflow:visible`,
  removing the on-screen scroll cap so the full sheet is available to print,
  not just one viewport's worth.
- `html,body{background:#fff!important}` added as a safety net, so even a
  genuinely multi-page sheet never shows the app's dark background on any
  page.

The Download button (a fully standalone HTML file with its own inline
light-theme styles) was never affected by this — it doesn't share the
print stylesheet at all. This was a Print-button-only bug.

*Test: "REGRESSION: printing the game plan sheet does not clip content or
paginate onto blank pages" — reads the parsed `@media print` CSS rules
directly (jsdom can't actually run print layout/pagination) and asserts
`position:static` on the modal and `max-height:none`/`overflow:visible` on
the card. Verified against the real regression by reverting the fix and
confirming the test fails.*

---

## Still open

- jsdom can't render an actual print preview, so this fix is verified by
  asserting the CSS declarations directly, not by rendering a paginated
  page. Worth a real-device check (Print → Save as PDF) before the next
  game to confirm it's visually one page as expected.
