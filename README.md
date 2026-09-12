# Team 71 Game Manager

Cloudflare Worker + static assets + D1 shared game state.

## Cloudflare configuration

- Worker name: `team71`
- D1 binding: `DB`
- D1 database: `team71-game-state`
- D1 database ID: `d2545cc6-6d5f-4ac3-b75b-a38ddac63d89`
- Static assets binding: `ASSETS`

## Deploy with Cloudflare Git integration

This repository is ready to connect directly to the existing Cloudflare Worker named `team71`.

Cloudflare should use:

- Production branch: `main`
- Build command: leave blank
- Deploy command: `npx wrangler deploy`

The Worker name in `wrangler.json` is already `team71`, matching the Cloudflare Worker.

## Files

- `src/worker.js` — API + D1 synchronization code
- `public/` — Team 71 website/PWA files
- `wrangler.json` — Worker, assets, and D1 configuration
- `package.json` — Wrangler dependency and deploy scripts

## Shared game

One phone can create a shared game code. A second phone can join the same code as Coach or Viewer.

The D1 `game_state` table is created automatically by the Worker on first use.


## v9 fixes

- New Game / Reset returns the current game to 0:00 while keeping season history.
- 3-player rotation no longer blindly adds six minutes to the schedule.
- The countdown now shows the next actual rotation event: the 6-minute sub or the quarter ending.
- Sound alerts:
  - 30-second warning before the 6-minute rotation
  - 3-beep alert at 6:00
  - 30-second warning before quarter end
  - long buzzer at 12:00
- Multiple Coach phones can now be connected concurrently.
  - Shared updates are merged by domain (clock/stats, lineup, score, setup)
  - The phone that starts/resumes the clock owns official time accumulation
  - Another Coach can record goals, substitutions, or player status without overwriting the running clock


## v10 fixes

- Game history now persists in the shared D1 database, not only one phone's localStorage.
- History can be deleted one game at a time or cleared completely.
- Active shared game discovery:
  - No code required for normal use.
  - If Team 71 has an active shared game, it automatically appears on Pregame.
  - Maureen can tap Join as Viewer or Join as Coach.
- Shared sync polls every second.
- Live clock/stat writes are less frequent to reduce conflicts.
- Conflict responses automatically pull the newest state and retry.
