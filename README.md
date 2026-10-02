# Team 71 Game Manager — v37 PRINTDARK

East Islip GU7 • 5v5 • 4 × 12-minute quarters

A Cloudflare Worker with static assets and a D1 database, so two coaches' phones
can run the same game at the same time. Works offline after the first load.

- **Live:** https://team71.vjdifd.workers.dev/
- **Deploying:** see [`DEPLOY.md`](DEPLOY.md) — read the first section, it is the
  thing that goes wrong
- **What changed in v37:** see [`V37_PRINTDARK.md`](V37_PRINTDARK.md)
- **Earlier changes:** [`V36_FIELDBAR.md`](V36_FIELDBAR.md),
  [`V35_FIELDHUD.md`](V35_FIELDHUD.md),
  [`V34_PRINTLAYOUT.md`](V34_PRINTLAYOUT.md),
  [`V33_PRINTFIX.md`](V33_PRINTFIX.md) (incomplete — see V34),
  [`V32_SCHEDULE.md`](V32_SCHEDULE.md), [`V31_CLEAN.md`](V31_CLEAN.md),
  [`V30_BENCH.md`](V30_BENCH.md) (mostly reverted — see V31),
  [`V29_SHEET.md`](V29_SHEET.md), [`V28_LINEUP.md`](V28_LINEUP.md),
  [`V27_TOUCH.md`](V27_TOUCH.md), [`V26_ROSTER.md`](V26_ROSTER.md),
  [`V25_PRINT.md`](V25_PRINT.md), [`V24_SIDELINE.md`](V24_SIDELINE.md),
  [`V23_ROTATION.md`](V23_ROTATION.md), [`V22_FIXES.md`](V22_FIXES.md)

## Checking which version is live

Under the title on the home screen:

```
East Islip GU7 • 5v5 • 4 × 12-minute quarters • v37 PRINTDARK
```

Worth a glance before every game. If it does not say `v37 PRINTDARK`, the deploy
did not land and you are running older code.

---

## How a game day works

**Pregame tab**

1. **This week's game** — pick from the season schedule dropdown to fill in
   opponent, jersey/side, and the snack assignment together. Or set them by
   hand: opponent, home/away, and who has snack today — she takes goalie in
   Q4 by default (the Q4 goalie dropdown shows this as soon as snack is set,
   not just after Build Game Plan runs). Everyone else is equally eligible
   for goalie; there's no per-player preference to set.
2. Set attendance for each girl. Marking someone Out here does the same thing
   as marking her Out during the game: she comes off the field, her minutes
   stop, any quarter where she was the planned goalie is reassigned right
   away, and — if the game is already underway — you're asked who from the
   bench should take her spot. **Rest** is different: it's a break, not gone
   for the day, so it only affects the goalie plan if she was due in goal
   *this* quarter — a future quarter's assignment (the snack player's Q4,
   say) is left alone. Each player also has a **coach-only skill ranking**
   (1–5) here — it only ever softens a tie in playing time, so it can't
   override real fairness, but it stops a brand-new or lower-ranked player
   from ending up in the starting five by pure coincidence of roster order.
3. Pick a goalie for each of the four quarters, or leave some blank.
4. **Starting Lineup** — a suggested GK/LB/RB/M/F for kickoff, weighing season
   minutes first, skill ranking as a tiebreaker, and each player's position
   history so the same fair pick doesn't also repeat her most-played
   position. Each card shows the picked player's ranking directly. Change
   any position by hand, or **Regenerate Suggestion** to recompute from the
   current attendance/skill/goalie choices.
5. **Build Game Plan** — commits the goalie plan and the starting lineup (as
   adjusted above) to the shared game in one write, so the Q1 keeper and
   starting five on screen are always what's actually on the field. Stays on
   Pregame afterward — switch to the Game tab yourself when you're ready.
6. **Print / Save Game Plan** — a one-page fallback record: opponent, snack,
   a full-game rotation projected every 6 minutes (goalie, all four field
   positions, and the bench), and everyone's attendance. Works before or
   after Build Game Plan runs, and reflects whatever's current if you reopen
   or hit Refresh later. Once the game is underway, a window whose 6 minutes
   have already finished is crossed off automatically, and if the current
   window's real lineup no longer matches what was planned (a manual sub),
   the changed position is highlighted with what actually happened and what
   the plan said. Column headers and every player's name print bold and
   solid black, not the app's own pale gray, so the sheet is actually
   readable off a real printer. Print it, Download it as a standalone HTML
   file, or just screenshot it on a phone — worth doing before you leave the
   house in case the app or the phone lets you down mid-game. Reachable from
   the **Game tab** too (a **Game Plan** button next to the other game
   controls, not just Pregame), including for a Viewer's phone.

**Sharing with the second phone**

- The **Shared Game** card handles create, join, and connection status in
  one place. Tap **Create Shared Game** to start one. Once a game is active,
  **Join as Viewer** (read-only, for a second adult on the sideline or a
  parent watching from the stands) and **Join as Coach** buttons appear —
  there's no code to type or role to pick by hand.
- Only the phone that started the clock owns it. The other phone cannot pause or
  restart it, which is deliberate — one official clock.
- Both phones can record goals and make substitutions. Changes are merged by
  domain, so a substitution on one phone never disturbs the clock on the other.
- A Viewer's phone shows one simplified page — score on top, clock, field,
  bench, goalie rotation, and recent activity — instead of the coach's full
  tab set, since there's nothing to edit on Pregame/History/Backup. Each
  field position shows a small badge for goals already scored and another
  for minutes played, on opposite corners of the shirt. A **Last sub**
  banner stays on screen after every substitution so a name changing on the
  field is never a silent surprise. A small bar at the top has **Game
  Plan** (opens the same printable/downloadable sheet) and **Leave Shared
  Game**, so a Viewer's phone is never stuck with no way back to Pregame.

**Game tab**

- The top card (Start/Pause and the other game controls) shows the quarter
  and the running clock too, not just the field further down — no need to
  scroll to check the time while you're working the controls.
- One card holds the whole picture: the score, the field, and the clock are
  one graphic. Team names, score, quarter ("Q1", "Q2", …), and clock sit
  directly on the grass — no boxed background, just text with a shadow for
  legibility — at the field's own top and bottom edges, so nothing reads as
  a badge floating on top of it. The score is colored for whichever jersey
  Team 71 is actually wearing that day (red when home, blue when away, the
  opponent in the other color), matching the shirts on the field itself.
  Score, positions, and time left are all in one glance instead of
  scattered across separate cards. Bottom-left is the quarter ("Q1", "Q2",
  …); bottom-right, the **quarter** clock (resetting to 0:00 each quarter)
  stacked above the smaller total-game-time line underneath it.
- **Goalie Rotation — Full Game** sits below the field now — useful as a
  reference, not something you need to check every few seconds.
- The clock stops only when you tap Pause, when a quarter ends, or when you tap
  End Period. The 6:00 mark is a reminder, never a forced stop — the reminder
  card starts flashing once you're past it and the rotation still isn't done.
- **Sub In Whole Bench** brings every bench player on at once — fewest minutes
  in, most minutes out, one for one — whenever you tap it. Which incoming
  player lands at which open position also favors whichever of the vacated
  spots she's played the least this game, so a fair swap on minutes doesn't
  also happen to repeat her most-played position. It's a suggestion, never
  automatic: the clock keeps running and you make the swap when play allows.
- A player who comes off mid-rotation for an emergency (hurt, doesn't want to
  play right now) doesn't get auto-subbed back in the moment you flip her back
  to Available. Whoever covered for her keeps that spot until the current
  rotation and the covering player's own next one are both done, so she isn't
  yanked straight back out. A manual sub always overrides this.
- To sub by hand: tap a sideline player, then tap any field position, including
  goalie. Substitutions never move the game clock.
- **End Period / Set Up Next Quarter** deliberately ends the period, moves the
  clock to the quarter boundary, applies the next quarter's lineup, and waits for
  you to press Start. This is the one button that does move the clock.
- **End Game** saves the game to season history and closes the shared session.
- **Test Speed & Sound** lives in its own card at the bottom of the tab, out
  of the way of the controls you actually need mid-game. Test Speed cycles
  1× → 10× → 60×, changeable only while paused. At 60× a 12-minute quarter
  takes about 12 real seconds — useful for walking through a full game
  before a match. It resets to 1× on New Game.

---

## Cloudflare setup

| | |
| --- | --- |
| Worker | `team71` |
| D1 binding | `DB` |
| D1 database | `team71-game-state` |
| D1 database ID | `d2545cc6-6d5f-4ac3-b75b-a38ddac63d89` |
| Assets binding | `ASSETS` |

Tables (`game_state`, `active_game`, `game_history`, `game_audit`) are created
automatically on the first API request.

## Layout

```
src/worker.js        API and D1 synchronisation
public/index.html    the whole app — markup, styles, and logic in one file
public/sw.js         service worker (offline shell; never caches /api/)
public/manifest.json PWA manifest
wrangler.json        Worker, assets and D1 configuration
test/                147 tests — see below
docs/history/        QA notes from v15 through v21
```

## API

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/health` | GET | connectivity and D1 probe |
| `/api/active` | GET, DELETE | which game is live right now |
| `/api/game/<code>` | GET, PUT, DELETE | live shared game state |
| `/api/plan/<code>` | PUT | atomic pregame goalie + lineup commit |
| `/api/history` | GET, POST, DELETE | season history |
| `/api/history/<id>` | DELETE | remove one saved game |
| `/api/audit/<code>` | GET, POST | live activity feed |

A bulk `DELETE /api/history` requires `?confirm=DELETE-ALL`.

## Tests

```bash
npm install
npm test
```

147 tests, about 20 seconds, no network or Cloudflare account required.

- `test/worker.test.mjs` — the real Worker code against a D1 stand-in built on
  `node:sqlite`: routing, domain merging, optimistic locking, the active-game
  lifecycle, history and audit.
- `test/app.test.mjs` — the real `index.html` loaded in jsdom, driven by clicking
  buttons and changing selects, with `fetch` wired into the real Worker. Covers
  the clock, substitutions, goalie rotation, quarter transitions, scoring, undo,
  test speed, two phones sharing a game, and end-of-game history.
- `test/harness.mjs` — jsdom setup plus a virtual clock, so a 48-minute game runs
  in milliseconds.
- `test/fixtures/v21-shipped-index.html` — the build that was actually live,
  kept so several tests can demonstrate the old broken behaviour alongside the
  fix. Do not edit it.

Run `npm test` before deploying.
