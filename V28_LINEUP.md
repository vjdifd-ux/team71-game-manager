# v28 LINEUP — what changed and why

Baseline: the v27 TOUCH package. Three related backlog items, requested
together because they feed each other: player skill ratings (P2.1),
position-diversity-aware substitutions (P1.4), and a starting-lineup
assistant (P2.2).

The trigger: equal playing time alone was still leaving some girls playing
the same position all game, and a brand-new player with zero minutes could
end up starting alongside three other equally-new players purely because of
where her name falls in the roster — not because anyone chose that lineup.

---

## 1. Player skill ratings

Each player now has a coach-only 1–5 rating, set on the Pregame tab next to
her attendance/availability controls. It never overrides fairness — a real
difference in season minutes always wins — it only breaks a *tie*, most
often the tie every player starts a season in (0 minutes, 0 history). That's
deliberate: the backlog's own rule is "never block a coach override," and a
rating is exactly the kind of subjective judgment that should nudge, not
decide.

Ratings live outside the per-game `state` object, in their own persisted
store, because they're the coach's ongoing assessment of a player — not a
fact about one game. They survive New Game / Reset, and sync between two
coaches' phones the same way attendance and the snack pick already do (added
to the `setup` domain in `src/worker.js`).

*Test: "a skill rating updates state and survives New Game / Reset".*

## 2. Position-diversity-aware substitutions

`state` now tracks minutes *per position* for every player (`posPlay`), not
just total playing time, accumulated the same way total minutes always were
and carried into season history for future games.

**Sub In Whole Bench** used the fairest possible rule for *who* comes off
and *who* comes on (lowest minutes in, highest minutes out) but then paired
them up arbitrarily — incoming player N took whatever slot outgoing player N
happened to vacate. That could quietly repeat a player's most-played
position swap after swap. The pairing now still picks incoming players in
the exact same fairness order as before, but each one is handed the open
slot she's played the *least* this game, so a fair sub doesn't also happen
to put her back at left back for the fourth time. Nothing about who plays or
how much changed — only which specific spot each of them lands in.

*Test: "REGRESSION: a rotation swap avoids putting a player back in the
position she's already played the most" — seeds a player with heavy prior
time at one position and confirms the swap routes her elsewhere instead.*

## 3. Starting Lineup assistant

A new **Starting Lineup** card sits between the goalie planner and Build
Game Plan, showing a suggested GK/LB/RB/M/F. The algorithm: season minutes
first (unchanged fairness rule), skill rating as the tiebreaker described
above, then each player is slotted into whichever field position she's
played the least historically (season `posMinutes`, the same idea as #2 but
looking at past games instead of this one).

- **Adjust** — every position is a dropdown; change any one by hand.
- **Regenerate Suggestion** — discards any manual edit and recomputes fresh,
  for after changing attendance or a skill rating.
- **Accept** — pressing **Build Game Plan** commits whatever's currently
  shown (suggested or adjusted) exactly like it always has; there's no
  separate commit step to learn.

A stale or manually-broken draft (say, attendance changed after it was
shown, or the same player picked for two slots) is silently repaired at the
moment Build Game Plan runs, the same safety-net approach already used for
the goalie plan — it can never produce an invalid lineup, only fall back to
the suggestion for whatever position is affected.

*Tests: "a tie in season minutes no longer falls back to plain roster
order" (the brand-new-player case), "the coach can manually adjust a
starting-lineup slot before Build Game Plan", "Regenerate Suggestion
discards a manual adjustment and recomputes".*

---

## Still open

- The printable Game Plan sheet's own rotation projection
  (`projectFullGameSchedule`) still simulates a fresh even split from
  kickoff and does not use skill rating or position history — it's a
  paper-fallback projection, not the actual built lineup, and extending it
  is a separate change from what was asked for here.
- Skill rating is a single overall 1–5 number, not the category breakdown
  (ball control, speed, passing, etc.) the backlog lists as a possible
  future refinement — flag it if that level of detail is wanted.
- Balancing skill *across the whole game's* rotation groups (not just the
  starting five) is its own larger backlog item (P2.3) and was not built
  here — this pass only covers the opening lineup and in-game position
  variety, not multi-quarter line balancing.
