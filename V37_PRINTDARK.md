# v37 PRINTDARK — what changed and why

Baseline: the v36 FIELDBAR package, merged to `main` and live. Direct
feedback after actually printing a game plan sheet on a real printer:
"the girls names cannot be read the gray is too lite."

---

## The real bug, and the belt-and-suspenders fix

The printable game plan sheet (`#planPrintModal` → `.print-sheet`) is meant
to read as a plain light-background document — white background, dark
text — regardless of the rest of the app's dark theme. On screen this
already worked (`#planPrintCard{background:#fff;color:#111}` forces it).
On paper, one real bug was found and a second precaution was added
alongside it:

- **Column headers were genuinely broken.** A page-wide rule,
  `th{color:var(--muted)}`, is tuned for the app's own dark-background
  tables and directly matches *every* `<th>` on the page — including the
  print sheet's "Time", "GK", "Player", "Status", etc. A rule that directly
  matches an element always wins over a color the element would otherwise
  *inherit* from an ancestor, no matter how specific that ancestor's own
  rule is — so `#planPrintCard{color:#111}` never stood a chance against
  it. The result: headers rendered in `--muted` (`#94a3b8`, a medium
  gray-blue meant to sit on a near-black background) on top of an
  already-light header background (`#f1f5f9`) — about as low-contrast a
  combination as this sheet could produce. Confirmed by measuring the
  actual computed color in a real headless-Chromium render with print
  media emulated: `rgb(148, 163, 184)` before the fix, `rgb(17, 17, 17)`
  after. Fixed with a `.print-sheet th{color:#111}` override.
- **Every player's name is now bold**, not just correctly dark. This is
  the direct answer to "names can't be read" specifically — the header bug
  above explains a real defect, but a name's `<td>` was never proven to
  have the wrong *color* in testing, and thin, small, normal-weight text
  on a table can still look faint on a real consumer printer even when the
  color is technically almost-black (uneven ink/toner coverage on this app
  can't see or control from CSS). Bold text is far more reliably solid
  on paper, so every name-bearing cell (each attendance row, every
  position in the schedule grid, the bench list) now wraps the name in a
  `.pname` span with `font-weight:700`, both in the in-app print sheet and
  the standalone "Download" HTML export.

## What this doesn't touch

The schedule table's own shrink-to-fit print size
(`.print-sheet .schedule{font-size:.62rem}` under `@media print`, added
back in v25) is unchanged — this round didn't have evidence pointing at
size as the cause, only color and weight, and shrinking it further would
work against the very legibility this fix is trying to restore. If names
are still hard to read after this, that's the next thing to look at.

---

*Test: "REGRESSION: the print sheet's headers and player names are dark
and bold, not the app's pale dark-theme gray" — checks that every rendered
name in the sheet is wrapped for the `.pname` bold rule, and reads the
actual CSSOM rules for `.print-sheet th` and `.print-sheet .pname` to
confirm the color and font-weight declarations exist with the right
values (there are two separate `.print-sheet th{...}` rules — one for
background, one for this fix's color — so the test checks every matching
rule for the property it cares about, not just the first one found).
Verified against the real regression by reverting both CSS rules and
confirming the test fails exactly the way the bug reads (`undefined`
where `'#111'`/`'700'` should be).*

## Still open

- This was verified by measuring real computed CSS under Chromium's print
  media emulation, and by reverting the fix to confirm the failure — a
  large step up from guessing, but still not the same as a physical
  printout. If names are still hard to read after this ships, the next
  things to check are the schedule table's print-only font size (above)
  and whatever ink/toner economy setting the specific printer itself is
  using, which no amount of CSS on this end can see or control.
