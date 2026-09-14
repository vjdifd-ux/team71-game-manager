# v34 PRINTLAYOUT — what changed and why

Baseline: the v33 PRINTFIX package. That release shipped a real fix, but a
follow-up real-device test (screenshot of an actual iOS print preview)
still showed 4 pages with a black background. This release fixes the part
v33 missed.

---

## What v33 got right, and what it missed

v33 correctly identified and fixed two problems: `position:fixed` only
painting on the first printed page, and the modal's `max-height:85vh`
scroll cap clipping the sheet before it could print. Both fixes are still
in place and still correct.

What it missed: the technique hiding the rest of the app during print was
`body *{visibility:hidden}` with `#planPrintModal` set back to
`visibility:visible`. **`visibility:hidden` hides painting, not layout** —
an element styled this way keeps its full box size and still occupies
space in the document, it just doesn't draw anything into that space. The
app (`.app`, everything inside the `<body>` except the modals) is the
entire single-page UI — whichever tab is active, with every one of its
cards — and that whole thing kept its real, full height even while
invisible. Since v33 also switched `#planPrintModal` to `position:static`
so it would sit in normal document flow (needed for correct pagination),
it now sat *after* this enormous invisible block in that flow. The printer
paginated across the full height of the hidden app, not just the sheet —
which is exactly the 4-pages-with-a-black-background result: real content
at the top of page 1, then page after page of an invisible-but-still
full-height app with nothing rendered on it.

## The fix

Replace the visibility trick with `display:none` on `.app` (and, for
safety, any other modal that isn't the print modal) during print:

```css
.app,.modal:not(#planPrintModal){display:none!important}
```

`display:none` removes an element from the render tree entirely — zero
layout, zero height, zero pages. `#planPrintModal` is now the only thing
with any layout at all when printing, so it's the only thing that
paginates.

*Test: extended the existing print-CSS regression test to also assert
`.app,.modal:not(#planPrintModal)` gets `display:none` in the parsed
`@media print` rules. Verified against the exact real regression by
reverting to the old `visibility:hidden` approach and confirming the test
fails.*

---

## Still open

- Still no way to render an actual paginated print preview in the test
  suite (jsdom limitation, same as v33) — this fix is verified by asserting
  the CSS rule that removes `.app` from layout, not by rendering a page.
  A real-device check (Print → Save as PDF) is the only way to see the
  actual page count and confirm this looks right before a game.
