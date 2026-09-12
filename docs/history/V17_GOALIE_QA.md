# v17 Goalie Fix

## Reproduced symptom
Pregame showed Q1 = Olivia, while the live field/goalie strip showed Q1 = Shalom.

## Root cause
Goalie dropdown edits were each firing shared cloud writes while the coach was still configuring Q1-Q4. Because writes/pulls are asynchronous, an older shared snapshot could replace a newer local selection before Build Plan used it.

## Fix
- Pregame goalie dropdown edits remain local until Build Game Plan.
- Build Game Plan reads the currently visible dropdown values directly.
- Build Plan waits for the shared merge before switching to Game.
- Starting field GK is explicitly forced to Q1 goalie.
- At 0:00 the Game view self-heals any Q1 goalie mismatch.
- Manual mid-quarter GK substitutions remain supported.

## Test
1. New Game.
2. Set Q1 Olivia, Q2 Serafina, Q3 Norah, Q4 Luna.
3. Build Game Plan.
4. Confirm live field GK = Olivia and rotation strip shows Olivia / Serafina / Norah / Luna.
5. Start clock.
6. Select a bench player and tap GK. Confirm GK changes and clock does not jump.
