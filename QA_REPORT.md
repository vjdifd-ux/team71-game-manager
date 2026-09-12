# Team 71 Game Manager — v15 QA FINAL

## Issues found/fixed
1. Non-timer coach substitutions no longer overwrite the other phone's official clock or player-time totals.
2. A second coach cannot take over or pause a running clock owned by the first phone.
3. Active-game discovery refreshes every 5 seconds when a phone is not connected.
4. Added a visible last-sync age so stale connectivity is obvious.
5. Added a one-tap Connection Test for Cloudflare, D1, and the current shared session.
6. The just-finished game's audit remains viewable after End Game closes the live session.
7. Quarter start is blocked if the preview cannot produce 5 valid available players.
8. Season totals are hardened against older/incomplete history records.
9. Audit rows older than 30 days are cleaned up opportunistically.

## Deliberately not changed
- 4 x 12-minute quarters
- 6-minute rotation concept
- Goalie-per-quarter model
- Roster and positions
- D1/Cloudflare architecture
- Coach/Viewer roles
- Existing season-history data model

## Pre-game smoke test
1. Coach A: Connection Test.
2. Coach A: Create Shared Game.
3. Coach B: wait up to 5 seconds for Active Game to appear; Join as Coach.
4. Coach A: Start clock.
5. Coach B: press Start/Pause; app should refuse because Coach A owns the live clock.
6. Coach B: record a goal; Coach A should receive it.
7. Coach B: make a manual sub; Coach A should receive the lineup change and the clock must not jump.
8. Coach A: make an early sub; game clock must remain continuous.
9. Verify Audit on both phones.
10. At 12:00 verify buzzer and full next-quarter lineup preview.
11. End Game; verify History saves and Active Game disappears.
