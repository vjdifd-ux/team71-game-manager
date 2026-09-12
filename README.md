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


## v11 stale active-game fix

- Added an explicit **Clear Active Game** button.
- Active-game discovery now self-cleans ended games.
- Paused/abandoned games older than 30 minutes are automatically removed.
- Any active marker older than 12 hours is automatically removed.
- New Game / Reset also clears the active-game marker.
- End Game clears the team-wide active-game marker instead of relying on the local game code.


## v12 FINAL pre-game QA fixes

- Fixed the biggest synchronization issue: the old service worker cached `/api/` responses, which could make both phones repeatedly see stale game, history, and active-game data.
- API requests are now network-only and never stored in Cache Storage.
- Page navigation is network-first, so new GitHub deployments appear on the first reload.
- New Game / Clear Active / End Game now delete the old live game session so a stale phone cannot recreate it.
- Only **Create Shared Game** can mark a session active; ordinary sync writes cannot resurrect a cleared game.
- Timer now uses a wall-clock anchor and screen Wake Lock when supported.
- If the phone/browser pauses, playing time advances only to the next required substitution or quarter boundary, then stops there instead of silently over-counting.
- Accidental early **Next Quarter** jumps are blocked.
- Quarter breaks cannot accidentally resume the previous quarter.
- Added **Skip / Mark Complete** for the rare case where the scheduled six-minute rotation is intentionally skipped.
- If only five players are available, the app no longer pauses unnecessarily at six minutes.
- History uses a stable game ID so repeated End Game attempts cannot duplicate the same game.
- Old local-only history is migrated into D1 instead of being overwritten by an empty cloud history.
- Actual goalkeeper time is used for season goalkeeper-quarter totals.


### Final QA patch
- Deleting an individual history record no longer allows another phone's stale local cache to re-upload it.
- Offline/failed history saves are tracked as pending and retried; normal cloud history is authoritative.
- A phone automatically detaches when the shared live session has been ended/deleted.
- Viewer permissions can no longer accidentally re-enable game controls.
- Imported backups never resume an old running clock automatically.


## v13 FINAL field/quarter UX

- Player cumulative minutes now appear directly on the visual field next to each active player's position.
- Quarter break now shows the entire next-quarter lineup before the clock starts.
- The preview includes Goalkeeper, Forward, Left Back, Right Back, and Support/Mid.
- The exact previewed lineup is the one applied when **Start Quarter With This Lineup** is pressed.
- Selected bench state is cleared at the quarter transition to prevent an accidental immediate substitution.
- Manual field substitutions are disabled for Viewer mode and after the game has ended.


## v14 emergency fixes

- Fixed early substitutions changing/jumping the game clock.
  - The clock is settled to the exact click time.
  - Player-time attribution changes at that instant.
  - The game clock is immediately re-anchored at the same elapsed time.
- Fixed a two-coach synchronization race:
  - A successful PUT no longer causes a phone to skip a concurrent update from the other coach.
  - Every successful write immediately pulls the merged server state.
  - Conflict retries preserve the original user action rather than overwriting it with a cloud pull.
- Removed duplicate goal-scorer buttons.
- Added a fifth **Audit** tab with a shared server-side event log.
- Audit records goals, goal undo, substitutions, player status, clock start/pause, quarter starts, plan creation, and game end.
- Audit refreshes automatically while connected and can be manually refreshed.


## v16 Goalie Hotfix
- Build Plan now preserves valid manually-selected Q1–Q4 goalies instead of replacing them with automatic defaults.
- Fixed quarter-transition off-by-one: the lineup previewed for the next quarter is now the exact lineup applied when that quarter starts.
- Added emergency/manual goalie substitution: select a bench player, then tap the goalie on the field.
- New Game explicitly clears Q1–Q4 goalie assignments and the starting lineup while preserving each player's GK eligibility preference.
- Added Clear Goalies so the Q1–Q4 plan can be reset independently without resetting the whole game.
