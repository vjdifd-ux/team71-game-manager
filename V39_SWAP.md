# v39 SWAP — what changed and why

Baseline: the v38 FRESHSTART package. Off-season improvement list, item #4:
"Swap players already on the field."

---

## The feature

Previously, moving a player to a different position mid-game meant going
through the bench — sub her off, then sub someone back on at the position
you actually wanted her in. Fixing two players who are simply standing in
the wrong spots took two separate substitutions and briefly had the wrong
player on the field in between.

Now: tap one on-field player (she's highlighted, a blue outline on her
shirt), then tap another — anywhere, including goalie — and the two trade
positions directly. Tap the same player again, or tap a bench player
instead, to cancel the pick without swapping anything.

- **Total playing time is untouched.** Both players were on the field the
  whole time either way — a swap only changes which *position* each is
  credited for from that instant on (and which player is credited for
  goalie minutes, if GK is one of the two spots), never `state.play`.
- **The goalie plan updates** the same way a manual sub into goal already
  does, if the swap touches GK — this quarter's planned keeper becomes
  whoever is actually standing in goal now.
- **Never moves the clock**, same as every other substitution.
- Tapping an *empty* position while one is selected cancels the pick
  instead of doing nothing silently — there's no such thing as a swap with
  an empty slot.
- Selecting a bench player and picking a field player for a swap are
  mutually exclusive — starting one cancels whichever of the two you'd
  already started.

Implementation note: `makeManualSub()`'s whole-field-sub logic and this new
`swapFieldPositions()` both call `settleClock()` first, crediting minutes
up to the exact instant of the action before changing `state.lineup` — the
same pattern, just trading two positions instead of bringing someone off
the bench.

The new `selectedField` piece of state (which player is picked up,
mid-swap) is this phone's own momentary intent, exactly like
`selectedBench` — added straight into `LOCAL_ONLY_FIELDS` from the
refactor two versions back, so it can't suffer the same "forgot to list it
somewhere" sync bug `selectedBench` once did.

---

*Tests: seven new ones covering selecting a player, deselecting her,
completing a swap (including the minutes-untouched check), a swap
touching goalie updating the plan, tapping an empty slot canceling instead
of swapping, and the bench/field mutual-exclusivity in both directions.
Verified against the real regression by reverting the field-tap click
handler and confirming six of the seven fail (the seventh — "tapping the
same slot twice deselects" — is vacuously true once nothing can be
selected in the first place, which the adjacent "selecting" test already
covers on its own).*

## Still open

- No equivalent "undo the swap with one tap" beyond the general Undo
  button — swapping back is just swapping again.
