# v27 TOUCH — what changed and why

Baseline: the v26 ROSTER package. This is P0.1 from the product backlog
(`BACKLOG.md`): touch reliability. No feature or design changes — the goal
was making the existing controls feel instant and never double-fire, per
the backlog's own instruction to prefer the smallest safe fix and preserve
game-day reliability over feature count.

---

## 1. Taps felt slow

Every tappable control (`button`, the field-position shirts, bench-player
rows, tab buttons) now sets `touch-action:manipulation`. Without it, some
mobile browsers wait roughly 300ms after a tap to see if a second tap is
coming (double-tap-to-zoom detection) before registering the first one as a
real click. `manipulation` tells the browser there's nothing to zoom, so a
tap registers as fast as the device reports it.

This can't be checked with an automated test — jsdom's `getComputedStyle`
doesn't implement `touch-action` at all (confirmed directly: it comes back
`undefined` regardless of what's in the stylesheet). It's shipped as a
disclosed, unverified-by-test fix; worth confirming by feel on an actual
phone before a game.

## 2. No confirmation a tap registered

Buttons and field shirts now get a visible `:active` state — a slight scale
down and brightness bump — the instant a finger is down, before any render
or network round trip completes. On iOS in standalone/PWA mode especially,
the previous flat CSS gave no feedback at all between "I tapped" and "the
screen changed," which reads as a missed or slow tap even when it wasn't.

One thing to watch for here: `.fp` (the field-position shirt) already
carries `transform:translate(-50%,-50%)` for centering. A shared
`:active{transform:scale(.96)}` rule would have replaced that transform
outright and snapped shirts to the wrong spot on tap — caught in review
before shipping, not by a test. `.fp:active` has its own rule that keeps
the translate and adds the scale.

Buttons also got a `min-height:44px` floor (already true for `.fp`), so a
touch target is never so small that a slightly-off tap misses it.

## 3. A same-instant duplicate tap could double an action

Reported as "duplicate substitutions" and worth checking for goals too: a
ghost click firing after `touchend`, or a second real tap landing before
the button's own re-render disables it, could run a state-mutating action
twice in the same instant. A new `rapidRepeat(key, ms=500)` guard blocks a
second call with the same key within 500ms of the first, and is applied to
the four actions that had no existing natural guard against this:

- `teamGoal(player)` and `oppGoal()` — a duplicate tap could no longer
  double-count a goal.
- `acceptSuggestedSub()` (Sub In Whole Bench) — a duplicate tap can no
  longer re-run the swap a moment after the first one already applied.
- `confirmReplacement(slot, ...)` (the emergency-replacement picker) — a
  duplicate tap can no longer assign the same cover player twice.

Two similar-looking functions were deliberately left unguarded, per the
backlog's "identify regression risks" / "avoid unrelated redesigns"
instruction: `makeManualSub` already nulls out `selectedBench` on the first
call, so a second tap has nothing to act on; `nextQuarter` and
`skipScheduledSub` are already gated behind a blocking `confirm()` dialog,
so a duplicate tap can't reach the state change without a second deliberate
confirmation. Adding `rapidRepeat` to those would have been redundant, not
safer.

*Tests: "a rapid duplicate tap ... never double-counts a goal" (covers both
`teamGoal` and `oppGoal`), "a rapid duplicate tap on the emergency-
replacement picker only records one action". Both were verified against a
real regression by temporarily removing the guard and confirming the new
tests fail, then restoring it.*

## 4. Confirmed: a sync/network failure never blocks local game actions

`cloudPush()` was already fire-and-forget and non-blocking before this
release, but there was no test locking that guarantee in place. Added one:
with `fetch` forced to always reject, a goal is still recorded locally and
the screen still updates immediately, and further actions (a manual sub)
keep working. No code change here — this closes a gap in test coverage for
behavior the backlog calls out explicitly (touch reliability must survive
sync failures), not a new fix.

---

## Still open

- `touch-action` itself has no automated test (see #1) — it's a
  fix that needs a real phone to confirm, not just `npm test`.
- `renderAll()` still fully rebuilds the DOM on every action. That's a
  plausible contributor to sluggish-feeling taps under some conditions, but
  changing it is a much larger redesign with real regression risk, and is
  out of scope for this pass. Flag it separately if taps still feel slow
  after this release.
- `rapidRepeat`'s 500ms window is a guess at "same instant," not measured
  against real ghost-click timings on the actual devices coaches use.
