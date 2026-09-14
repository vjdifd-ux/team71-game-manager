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

## Round 3: the overlap was still there — screenshots weren't enough either

Round 2 claimed the Goalie/Support-Mid overlap was fixed and backed that with
a screenshot. It wasn't actually fixed — eyeballing a picture isn't a
reliable way to catch a 15-20px overlap between two boxes that are visually
close together anyway. Called out directly, correctly, with the request to
stop guessing and ask before finishing next time.

This round switched from "look at a screenshot" to actually measuring: a
headless browser loads the real page, and every position marker's and every
piece of on-field text's actual `getBoundingClientRect()` is checked against
every other one, pairwise, for real pixel overlap — not judged by eye.

What that turned up and fixed:

- **Goalie really did overlap Support/Mid** (confirmed: an 18px overlap,
  not a close call). Fixing it required moving Support/Mid down slightly
  (66% → 69%) in addition to Goalie (→ 88%), since the two markers'
  clearance is a function of both positions together.
- **Left Back and Right Back also overlapped Support/Mid** — smaller (14
  and 21px) and never reported, found only because this round checked every
  pair, not just the one that was called out.
- **Forward overlapped the scoreboard itself** — its shirt icon sat under
  the bottom edge of the score digits by about 14px. Also never reported;
  also only caught by measuring, since visually the two are far enough
  apart on screen to not obviously look wrong in a quick glance. Fixed by
  moving Forward from 20% down to 26%.
- The field position labels also dropped their "• N min" suffix (minutes
  are still shown in the bench list and the minutes table) so all five
  marker boxes render at one consistent, shorter height instead of varying
  by how long each position's name happens to be.

The quarter/clock layout also went through a couple of corrections based on
direct feedback: first moved to a single block on the left, then corrected
to put the quarter alone on the left and the clock (quarter time stacked
above total game time) on the right — which, as a side effect, also removed
the last source of horizontal collision with Goalie, since neither text
block now sits anywhere near the center of the field where Goalie lives.

Every pairwise combination — all five field positions against each other,
and all five against the actual score/quarter/clock text — now measures
zero overlap, including the transient "Lineup ready" reminder state, which
needed its own width cap once it was checked directly instead of assumed
fine.

---

## Still open

- **This class of bug can't be caught by `npm test`.** jsdom (what the
  existing test suite runs against) doesn't compute real CSS layout — no
  `getBoundingClientRect()`, no actual pixel positions — so an automated
  test can check DOM structure but not "does this visually overlap that."
  Catching it requires an actual browser, which is how round 3 verified
  this: a temporary, not-committed headless-Chromium script. Making that a
  permanent, always-run part of the test suite would mean adding a real
  browser dependency (and likely a network fetch to install one) to a
  project whose whole test suite currently runs in ~20 seconds with no
  network or browser required — a real tradeoff, not applied here without
  asking first.
- Real device rendering (an actual phone, in bright sunlight, mid-game) is
  still the final test. This round's verification is a large step up from
  both CSS math alone (round 1) and a single screenshot glance (round 2),
  but it's still a phone-width headless browser, not an actual phone.
