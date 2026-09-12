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

### 1.1 A repeat press now asks first, so it can't silently thrash

Reported from a real game's audit log: when the bench is exactly as big as
the number of swappable field slots (the normal case for a full-strength
5v5 roster), a second press of "Sub In Whole Bench" exactly undoes the
first — the whole field and the whole bench trade places right back. A
handful of taps in quick succession (an accidental double-tap, or pressing
it again out of habit) produced a run of identical swaps that cancelled
each other out, cluttering the audit log without changing anyone's minutes.

Once a quarter's rotation is already marked done, pressing the button again
now asks for confirmation ("This quarter's rotation is already done. Swap
the whole bench again anyway?") instead of firing immediately, and the
button relabels itself to "Swap Again (asks first)" so it's visibly a
different action. Declining leaves the lineup untouched. This only guards
the repeat case — the first press each quarter is still the single
deliberate tap it always was.

*Test: "pressing Sub In Whole Bench again after the rotation is done asks
first instead of silently re-swapping".*

### 1.2 Why the countdown can jump straight to ~12:00 — not a bug

Accepting a whole-bench swap marks the quarter's rotation as done (see §1),
so the countdown's target immediately switches from the 6:00 reminder to
the actual quarter-end boundary. If you make that swap right as a quarter
begins — lineup set, clock still paused, Start not yet pressed — quarter
end is a full 12:00 away, and since the clock isn't running yet, the
countdown just sits at that number instead of visibly ticking down. It
looks like a freeze but isn't one: press Start and it counts down normally
from there. No fix needed here — flagging it so it doesn't come back as a
"frozen timer" report.

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
