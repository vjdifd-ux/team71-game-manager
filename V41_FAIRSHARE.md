# v41 FAIRSHARE — what changed and why

Baseline: the v40 SCHEDULED package. Off-season improvement list, item #2:
"Season-long fairness." The coach's own framing for this one: *use player
rank, also avoid girls sitting twice in a row.*

---

## What was already true

Season-long goalie balance already existed — `computeGoaliePlan()` has
weighed each player's season goalie-quarters (`gkQ`), not just this game's,
since the season-history work landed. That part of the improvement-list item
needed no new code, just confirming it.

## The actual gaps

1. **The coach-only skill ranking (1–5) was only ever used for the Starting
   Lineup suggestion.** Every other fairness decision — who comes off the
   bench mid-game, who sits when minutes are tied, who takes over in goal
   for an unavailable keeper — broke ties on plain roster order instead.
2. **Nothing remembered who sat out last time.** With this roster's numbers
   (8 players, 5 on the field, 3 on the bench) "Sub In Whole Bench" always
   swaps the entire bench at once, so in ordinary play nobody's ever stuck
   out twice in a row by accident. But that's a happy accident of this
   particular roster size, not a guarantee — a cover-lock emergency, or a
   bigger roster next season, can shrink the number of open field slots
   below the size of the bench, and when that happens the old code had no
   memory of who'd already sat once.

## The fix

**Skill rank is now a consistent tiebreaker everywhere fairness is
decided**, not just the starting lineup: the suggested whole-bench swap
(who's brought on, and which of the field players sits), the season goalie
plan, and an emergency goalie replacement all now fall back to the same
rule the starting lineup already used — a tie in minutes (or goalie-quarters)
is broken toward the higher-rated player, never roster order. It's still
only ever a tiebreaker; it can't override a real difference in playing time.

**A new `benchStreak` count remembers, per player, how many rotation
decisions in a row she's sat out.** It resets to 0 the instant she comes
on — by the scheduled whole-bench swap, a manual sub, or an emergency
replacement pick — and only increments when a real rotation decision
leaves her on the bench again. The scheduled-swap suggestion now sorts the
bench by this streak first, minutes second, skill third: whoever's sat out
longest in a row gets priority, same spirit as the minutes-based fairness
it sits alongside.

---

*Tests: five new ones. A lower-rated field player is benched first on a
pure minutes tie; a higher-rated player is preferred for an unassigned
goalie quarter and for an emergency goalie replacement, both on a pure tie.
The `benchStreak` tests are necessarily a constructed scenario — this
roster's numbers mean the whole bench always swaps at once in ordinary
play, so "sitting twice in a row" can't be reached through normal gameplay
with 8 players. Seeding two empty field slots (GK and F) while everyone's
present shrinks the open slots below the bench size the same way a bigger
roster or simultaneous emergencies would for real, and from there: the
player with an existing streak is prioritized into the first available
spots, the ones left out have their streak bumped, and the next rotation
prioritizes exactly those two over players who'd just been playing.
Verified against the real regression for each: reverting the skill-tiebreak
sort on `suggestSub`, `computeGoaliePlan`, and `pickReplacementGoalie` each
fails its own new test; reverting the `benchStreak` sort key fails the
streak test. 170 tests total.*

## Still open

- `openReplacementPicker()`'s bench ordering was updated to match
  (streak, then minutes, then skill) for consistency, but there's no
  dedicated regression test for it beyond the existing fewest-minutes one —
  low risk since it shares the exact same sort as the now-tested
  `suggestSub()` bench ordering.
- `benchStreak` is genuinely inert for this specific 8-player roster under
  ordinary play. It's correct and will matter the moment the roster grows
  or a rule changes the swap size — worth knowing that going in, not a
  claim that it changes anything about this season's games.
