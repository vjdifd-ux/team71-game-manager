# v38 FRESHSTART — what changed and why

Baseline: the v37 PRINTDARK package, merged and live. First item off the
off-season improvement list: "Starting a game: always start fresh."

---

## The actual problem

State persists in `localStorage` forever by design — that's what makes the
app survive a phone restart or a crash mid-game without losing anything.
But nothing ever told it when a game was *over and done with*, so the exact
same persistence that protects a live game also means whatever was last on
screen — mid-game, paused, or properly ended but never reset — is exactly
what greets the next person to open the app, a day or a week later. The fix
for that has always existed (**New Game / Reset**), but it's a step a coach
has to remember to take, every single time, with no reminder that last
week's game is still sitting there.

The worker already had a *related* safety net — `DEAD_GAME_MS` (12 hours)
expires the server's "which game is active right now" pointer, so a second
phone won't auto-discover and join a dead game. That's a different problem
though: it only protects *cross-phone discovery*, not a single phone's own
locally-cached, unfinished game. The two had never been connected.

## The fix

A new check runs once at boot, before the first render: if the persisted
game is more than a day old (`STALE_GAME_MS`, 24 hours — comfortably longer
than any real game, short enough to always have reset by the next game
day), it's closed out automatically:

- If it has real progress (`planBuilt` or `elapsed > 0`) and was never
  properly ended, it's saved to season history first — reusing the exact
  same code **End Game** itself runs (extracted into `closeOutGame()`), so
  a forgotten End Game tap doesn't mean the numbers are lost once the next
  game resets things.
- Either way, it's then wiped to a clean slate — reusing the exact same
  code **New Game / Reset** itself runs (extracted into
  `hardResetToFresh()`).
- A game already properly ended isn't re-saved (checked directly: saving
  it twice would be harmless on its own, since the history upsert already
  de-dupes by id, but there's no reason to do the extra network round
  trips for nothing).
- A game from earlier the same day is left completely alone — this is
  only ever a "we're all the way into next week" safety net, never a
  same-day behavior change.

Both `endGame()` and `resetGame()` now call these two extracted functions
instead of duplicating their own copies of the same logic — one less place
for the two to quietly drift apart, in the same spirit as the sync-merge
refactor just before this.

---

*Tests: four new ones. A stale game with real progress is closed out to
season history and reset, with the status line explaining why. A stale
game with nothing worth saving is reset silently, with no blank history
entry. A stale game already properly ended is reset without duplicating
its history entry. A game from earlier the same day is left completely
untouched. Verified against the real regression: disabling the boot-time
check and confirming the first three tests fail (and the "same day, left
alone" test correctly still passes, since that one isn't exercising the
check at all).*

## Still open

- The 24-hour threshold is a judgment call, not something the doc specified
  down to the hour — it was chosen to comfortably clear a same-day
  double-header while still always having reset by the next game day a
  week later. Worth revisiting if a double-header ever spans more than a
  day for some reason (a Friday-night-into-Saturday tournament, say).
