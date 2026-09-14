# v36 FIELDBAR — what changed and why

Baseline: the v35 FIELDHUD package. Follow-up feedback on the very same field
view, one release later, in two rounds.

---

## Round 1: bars flush with the field's own edges

"Close but not right — want the score on the field not on top... I do not
like the clock, it's overlapping and does not feel part of image view, it's
just floating on top."

v35 put the scoreboard in the same *card* as the field, and the quarter/clock
in corner *badges* on top of the field graphic. That's not quite the same
thing as being on the field — the scoreboard still sat above it as a
separate block, and the corner badges were small independently-rounded
pills that looked pasted on rather than part of the graphic.

First fix: move the scoreboard and quarter/clock into bars flush with the
field's own top and bottom edges, inside `.field` itself, using the field's
own `border-radius`/`overflow:hidden` to clip their corners to match.

## Round 2: the bars still didn't feel like part of the field

A screenshot showed the fix from round 1 wasn't right either — the bars had
a solid dark background that read as a strip laid over the grass, unrelated
to the field's own color. Feedback, point by point:

- **"The gray makes it feel disconnected."** Confirmed — `rgba(0,0,0,.6)`
  over green grass renders as a muddy strip. Fixed by dropping the boxed
  background entirely: team names, score, quarter, and clock now sit
  directly on the grass as plain text with a shadow for legibility, no box
  at all.
- **"Remove the dash."** Done — the `–` separator between the two scores is
  gone.
- **"Alternate team colors — home/red, away/blue."** The score number for
  each team is now colored using the same home/away colors already used for
  the shirt icons on the field (`--home` red, `--away` blue) — whichever
  jersey Team 71 is actually wearing that day, matching the opponent to the
  opposite color. This reuses `state.homeAway`, already set on Pregame.
- **"Timestamp and quarter repeated twice."** Confirmed and fixed — the
  total-game-time line used to read "Game 12:00 • Quarter 2 of 4", which
  restated the quarter a second time right next to the "Q2" badge already
  showing it. It now just reads "Game 12:00".
- **Goalie and Support/Mid overlapping.** This was a real bug from round 1:
  the Goalie marker had been nudged up to clear the old boxed bar, without
  accounting for how tall the Support/Mid marker's own label text gets once
  it wraps ("Support / Mid • 0 min" on two lines). Since round 2 drops the
  boxed bars entirely, that nudge was unnecessary — both markers are back
  at their original spacing, confirmed clear of each other and of the new
  transparent bars by actually loading the app in a headless browser and
  screenshotting the field at phone width (previous rounds shipped on CSS
  math alone, which is exactly what caused this overlap in the first
  place).
- **The "Lineup ready" reminder pill.** Found the same way — it was still
  using the old solid dark chip style, which broke out past the bottom of
  the field. Restyled to match the plain text-with-shadow treatment, and
  the bottom bar's two sides (`#quarterLabel` and the clock) were each given
  explicit flex sizing so a long reminder message doesn't crowd the
  clock into wrapping onto extra lines.

---

*Test: "the score, clock and quarter are shown right on the field, and the
field comes before Goalie Rotation" — checks that the score, quarter, and
clock are all descendants of `.field` itself (not a separate `.scoreboard`
card above it). "the on-field score is colored by whichever jersey we're
actually wearing, and the total time doesn't repeat the quarter" — checks
the score's home/away color class in both a home and an away game, and that
the total-time text no longer contains "Quarter". Both verified against the
actual regressions above by reverting each fix and confirming the test
fails.*

## Still open

- Real device rendering (an actual phone, in bright sunlight, mid-game) is
  still the real test — this round was checked with a headless browser
  screenshot at phone width, which is a large step up from CSS math alone
  but still not the same as seeing it on the sideline.
