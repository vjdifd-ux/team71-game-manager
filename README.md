# Team 71 Game Manager — v22 STABLE

East Islip GU7 • 5v5 • 4 × 12-minute quarters

A Cloudflare Worker with static assets and a D1 database, so two coaches' phones
can run the same game at the same time. Works offline after the first load.

- **Live:** https://team71.vjdifd.workers.dev/
- **Deploying:** see [`DEPLOY.md`](DEPLOY.md) — read the first section, it is the
  thing that goes wrong
- **What changed in v22:** see [`V22_FIXES.md`](V22_FIXES.md)

## Checking which version is live

Under the title on the home screen:

```
East Islip GU7 • 5v5 • 4 × 12-minute quarters • v22 STABLE
```

Worth a glance before every game. If it does not say `v22 STABLE`, the deploy did
not land and you are running older code.

---

## How a game day works

**Pregame tab**

1. Set the opponent and home/away.
2. Set attendance and availability for each girl, plus whether she can play
   goalie. Marking someone Out here does the same thing as marking her Out during
   the game: she comes off the field, her minutes stop, and any quarter where she
   was the planned goalie is reassigned.
3. Pick a goalie for each of the four quarters, or leave some blank.
4. **Build Game Plan** — your manual choices are kept, blanks are filled in from
   season goalie minutes, and the starting five is chosen by lowest season
   minutes. This is committed to the shared game in one write, so the Q1 keeper
   on screen is always the Q1 keeper on the field.

**Sharing with the second phone**

- Coach A taps **Create Shared Game**.
- Coach B opens the app; the live game appears under *Active Team 71 Game* within
  about ten seconds. Tap **Join as Coach** (can make changes) or **Join as
  Viewer** (follows along, read-only).
- Only the phone that started the clock owns it. The other phone cannot pause or
  restart it, which is deliberate — one official clock.
- Both phones can record goals and make substitutions. Changes are merged by
  domain, so a substitution on one phone never disturbs the clock on the other.

**Game tab**

- The big timer is the **quarter** clock, resetting to 0:00 each quarter. Total
  game time is underneath.
- The clock stops only when you tap Pause, when a quarter ends, or when you tap
  End Period. The 6:00 mark is a reminder, never a forced stop.
- At 6:00 you get a suggested one-for-one swap: the bench player with the fewest
  minutes for the field player with the most, recalculated after each swap. Take
  it when play allows, ignore it, or dismiss it.
- To sub by hand: tap a sideline player, then tap any field position, including
  goalie. Substitutions never move the game clock.
- **End Period / Set Up Next Quarter** deliberately ends the period, moves the
  clock to the quarter boundary, applies the next quarter's lineup, and waits for
  you to press Start. This is the one button that does move the clock.
- **End Game** saves the game to season history and closes the shared session.

**Test Speed** cycles 1× → 10× → 60×, changeable only while paused. At 60× a
12-minute quarter takes about 12 real seconds — useful for walking through a full
game before a match. It resets to 1× on New Game.

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
test/                101 tests — see below
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

101 tests, about 20 seconds, no network or Cloudflare account required.

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
