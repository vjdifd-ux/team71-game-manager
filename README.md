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
