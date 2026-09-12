# v21 TEST CLOCK

## Test Speed button
The Game screen has one button that cycles:

- 1× — normal real-time game clock
- 10× — a 12-minute quarter takes about 72 real seconds
- 60× — a 12-minute quarter takes about 12 real seconds

Test Speed can only be changed while the clock is paused. This prevents
mid-run clock jumps.

When Test Speed is active:
- the button turns red and says TEST 10× or TEST 60×
- player minutes and goalkeeper minutes advance at the same accelerated rate
- 6-minute substitution reminders still fire
- quarter boundaries still stop the clock
- shared-game clients receive the selected clock rate
- New Game / Reset returns Test Speed to 1×

## Recommended full-flow QA
1. Build a lineup.
2. Set Test Speed to 60×.
3. Start Q1.
4. At ~6 real seconds verify the 6:00 sub reminder appears and clock does NOT stop.
5. Make a suggested substitution; verify the timer keeps moving.
6. At ~12 real seconds verify Q1 stops and Q2 lineup is prepared.
7. Press Start for Q2 and repeat through Q4.
8. Test goal +1 buttons during the accelerated clock.
9. Test Next Quarter / Set Lineup manually.
10. New Game and verify Test Speed returns to 1×.
