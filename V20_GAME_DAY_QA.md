# v20 GAME DAY SIMPLE — Product/QA Reset

This version intentionally simplifies the sideline workflow after real-game feedback.

## Core principles
- The game clock only stops when the coach taps Pause, a quarter ends, or the coach advances quarters.
- The 6-minute point is a reminder, never a forced stop.
- Substitution advice is one player in / one player out at a time.
- Recommendations are based on actual accumulated playing time.
- Goal buttons are large and always available for every active player.
- The main timer resets visually to 0:00 each quarter; total game time is shown underneath.
- Quarter transition is one action. The next lineup appears immediately and waits for Start.

## Real-game feedback addressed
1. Goal clicks unreliable -> large dedicated +1 buttons; event propagation prevented.
2. Uneven subs -> lowest-minutes bench player for highest-minutes field player, recalculated after each swap.
3. Timing confusing -> quarter clock + total game clock.
4. Subs unclear -> one suggested swap, no forced 3-player batch.
5. Next did not work -> explicit confirmed Next Quarter action.
6. Failure after ~30 minutes -> removed mid-quarter timer boundary state machine that could leave the app stuck.
7. Could not always sub at 6 -> 6-minute reminder no longer pauses anything.
