# v19 Goalie Root Fix

The screenshot proved two different states existed at once:
- Pregame goalie planner: Olivia / Serafina / Norah / Luna
- Game state: Shalom / Olivia / Norah / Kennedy

That means this was not a lineup-calculation bug anymore; it was a state-synchronization bug.

## Architectural fix
1. The four goalie dropdowns now use `goalieDraft`, separate from shared cloud state.
2. Polling cannot alter that draft while the coach is selecting goalies.
3. Build Game Plan copies the draft into the game state.
4. The entire goalie plan + starting lineup is committed in one dedicated `/api/plan/<code>` transaction.
5. The Worker itself enforces `lineup.GK = goaliePlan[0]`.
6. The returned server state becomes the canonical local state before the Game tab is shown.

## Exact test
Set:
- Q1 Olivia
- Q2 Serafina
- Q3 Norah
- Q4 Luna

Press Build Game Plan.

Expected on Game tab:
- Q1 strip = Olivia
- Q2 strip = Serafina
- Q3 strip = Norah
- Q4 strip = Luna
- Field GK = Olivia
