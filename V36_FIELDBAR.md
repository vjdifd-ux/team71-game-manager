# v36 FIELDBAR — what changed and why

Baseline: the v35 FIELDHUD package. Follow-up feedback on the very same field
view, one release later: "close but not right — want the score on the field
not on top... I do not like the clock, it's overlapping and does not feel
part of image view, it's just floating on top."

v35 put the scoreboard in the same *card* as the field, and the quarter/clock
in corner *badges* on top of the field graphic. That's not quite the same
thing as being on the field — the scoreboard still sat above it as a
separate block, and the corner badges were small independently-rounded
pills that looked pasted on rather than part of the graphic.

---

## Score and clock are now part of the field graphic itself

The scoreboard and the quarter/clock are now bars flush with the field's own
top and bottom edges, inside `.field` itself rather than beside or on top of
it:

- **Top bar** — team names and score (same 2.5rem score size as before,
  unchanged per the "font is right for score" feedback).
- **Bottom bar** — quarter ("Q1", "Q2", …) on the left, clock and total game
  time on the right.

Both bars span the full width of the field and use the field's own
`border-radius`/`overflow:hidden` to get their outer corners clipped to
match the field exactly, instead of floating as separately-rounded badges
with a gap around them. That's the concrete fix for "does not feel part of
image view it's just floating on top" — the bars are now literally clipped
by the same shape as the field, so they read as one graphic rather than an
overlay.

Score, quarter, clock, and every position on the field are all still
readable at a glance; nothing about the underlying game logic changed.

## Field position spacing nudged for the new bars

Two of the five position markers were close enough to the new edge bars that
they'd otherwise sit under them:

- **Forward** moved from `top:20%` to `top:25%`, clearing the new top bar.
- **Goalie** moved from `top:86%` to `top:78%`, clearing the new bottom bar.

Left back, right back, and midfield were already clear and are unchanged.

---

## Still open

- Real print/browser rendering can't be verified without a physical device
  — this was a purely visual layout change based on written feedback, not a
  screenshot, so there may be another round of small adjustments once it's
  seen live (bar height, spacing around the position markers, etc.).
- If a quarter just ended and the "Lineup ready — press Start when
  positioned" reminder is showing, that text now wraps to a second line
  under the quarter number inside the bottom bar, rather than the old
  wider floating badge. Worth a look the first time it comes up mid-game.

*Test: "the score, clock and quarter are shown right on the field, and the
field comes before Goalie Rotation" — checks that `#ourScore`, `#quarterLabel`,
and `#timer` are all descendants of `.field` itself (not a separate
`.scoreboard` card above it), and specifically that the score sits inside
`.field-bar.top` and the quarter/clock inside `.field-bar.bottom`. Verified
against the v35 regression (score back in a standalone `.scoreboard` above
the field) by reverting to it and confirming the test fails.*
