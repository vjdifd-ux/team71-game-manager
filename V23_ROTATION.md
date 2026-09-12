# v23 ROTATION — what changed and why

Baseline: the v22 STABLE package. These three changes came directly from
feedback after v22 shipped, watching a real game day.

---

## 1. The whole bench subs in at once again, on one tap

v20 replaced the old "sub 3 players at once" button with a continuous
one-for-one suggestion, recalculated after every swap. That turned out to be
more taps than a coach wants mid-game: the ask was for the old all-bench swap
back, but still a deliberate button press rather than something that fires on
its own at 6:00.

**Sub In Whole Bench** now pairs every bench player with an equal number of
field players — fewest minutes in, most minutes out — and swaps them all in
one tap, whenever the coach presses it. It is not automatic and not forced at
6:00; the reminder is still just a reminder, and the clock never stops for it.
Manual one-at-a-time subs (tap a bench player, tap a field position) are
unchanged and still work anytime.

*Tests: "the suggested swap brings the whole bench on at once", "Sub In Whole
Bench pairs fewest-minutes bench with most-minutes field, one for one".*

## 2. The 6:00 reminder now flashes until you act on it

Previously the reminder sat quietly as a countdown pill with no particular
urgency once it hit zero. It's easy to miss during a game. The reminder card
now flashes (a background/border pulse, and the countdown pill turns orange)
starting the moment the 6:00 mark passes and the quarter's rotation still
isn't done, and stops the instant you sub or dismiss it. `prefers-reduced-motion`
is respected — it switches to a static highlight instead of animating.

*Test: "the reminder starts flashing once 6:00 passes and stops once the sub is
made".*

## 3. Marking someone Out or Rest mid-game asks who's coming in

The v22 fix made the Pregame "Out" controls do the same full repair as the
in-game Player Status buttons — but both silently auto-picked the lowest-
minutes bench player to fill the vacated spot. A coach who wanted to choose
(say, to keep a certain pairing on the field, or because the auto-pick isn't
who they'd send in for an emergency) had no way to.

Marking a field player Out or Rest during a live game now opens a picker:
the bench, sorted by fewest minutes (same order the auto-pick used), and the
coach taps who goes in — or leaves the spot empty for now and subs manually
later. Nothing is decided silently anymore.

### The player who comes off doesn't get pulled back the moment she's marked Available again

This was the sharper ask: if Luna comes off injured mid-rotation and Olivia
covers for her from the bench, the fairness engine (both "Sub In Whole Bench"
and the plain suggestion) must not immediately try to swap Olivia back out for
Luna the instant Luna is marked Available again — Olivia earned the rest of
that rotation, and the *next* one too, before Luna's low minutes make her look
like the obvious "should be in" candidate.

Confirming a replacement from the picker now records that the incoming player
is **covering** for the one who left. While that lock is active:

- The fairness engine will not suggest bringing the covered player back in.
- The fairness engine will not suggest subbing the covering player back out.
- Both are still available for a **manual** sub at any time — this only gates
  the automatic suggestions, never the coach's own judgement.

The lock clears after two rotation checkpoints pass (the one being covered,
plus the covering player's own next one) — a scheduled sub being made or
dismissed, or a quarter ending, each count as one. It also clears immediately
if the coach takes the resting player off Rest and then subs her back in by
hand.

**This is a best-effort reading of "she shouldn't be pulled back out until her
own rotation and the one she covered are both done."** If two checkpoints
doesn't match what you had in mind on game day, say so and it's a one-line
change (`rotationsLeft:2` in `confirmReplacement()`, `public/index.html`) —
easier to tune the number than to guess it right from a description alone.

*Tests: "marking a field player Out mid-game opens a picker instead of
auto-filling", "the covering player is protected from the fairness engine
for two rotation checkpoints", "a manual sub always overrides an active cover
lock", "the cover lock clears at the second checkpoint".*

---

## Still open

- The cover-lock checkpoint count (2) is a judgement call, not something
  demonstrated by a real game — flag it if it doesn't feel right after using
  it.
- Cover locks are per covering-player, keyed by name; if the same player
  covers for two different teammates before the first lock clears, only the
  most recent cover relationship is tracked for her. This should be rare in a
  5v5 game with an 8-player roster, but worth knowing.
