# v16 Goalie Hotfix QA

## Bugs fixed
1. Build Plan overwrote manually-selected goalie assignments.
2. Quarter transition had an off-by-one bug: it previewed the next quarter, incremented the quarter, then recalculated using the following quarter.
3. The goalie field position was intentionally blocked from manual substitution.
4. New Game relied on implicit fresh-state behavior rather than explicitly clearing goalie/lineup state.

## Expected behavior
- Start New Game: Q1-Q4 all display Choose goalie.
- Pick Q1-Q4 goalies manually, then press Build Game Plan: those choices remain.
- Leave one quarter blank, press Build Game Plan: only the blank quarter is auto-filled.
- At the Q1 break, the Q2 preview goalie is the goalie actually used when Q2 starts.
- During a running quarter, select a bench player and tap the GK position: that player becomes GK immediately and the game clock does not jump.
- A manual GK change updates only the current quarter's goalie label; future planned quarters remain unchanged.
