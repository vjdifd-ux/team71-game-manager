# v32 SCHEDULE — what changed and why

Baseline: the v31 CLEAN package. A batch of feedback from real use: one new
feature (the season schedule) plus a round of UI cleanup — remove clutter,
stop moving screens on the coach unasked, and fix things that were getting
visually cut off.

---

## 1. Season schedule dropdown

Pregame's "This week's game" dropdown holds the team's 8-game schedule
(from the coach's own game-day email) — date, opponent, home/away, and
snack assignment. Picking one sets opponent, jersey/side, and the snack
player together in one tap, instead of three separate fields. Since the
snack player already drives the Q4 goalie default, this also gets Q4 set
correctly the moment the game is picked.

## 2. Q4 goalie default is now visible before Build Game Plan

`computeGoaliePlan()` always resolved a blank Q4 to the snack player at
Build Game Plan time — that logic didn't change. What was missing: the Q4
dropdown itself still showed "Choose goalie" until you built the plan, so
the default wasn't visible until after the fact. It now shows the snack
player pre-selected as soon as snack is set, with no change to what
actually gets committed.

## 3. Starting Lineup: no more clipped stars

The per-position dropdowns showed a repeated-star rating (`★★★`) that got
visually clipped on a phone-width select. Replaced with a plain `(3)`
number, and each position card now also shows "Ranking: N" directly next
to the dropdown, visible without opening it. The Pregame roster's own
rating picker dropped its stars too, for the same reason — it's "Rank 3"
now, not `★★★ (3)`.

## 4. One shared-game card, not two

Create Shared Game, Connection Test, and the auto-detected active game
used to live in two separate cards, with a second manual "enter a code and
pick a role" form alongside the auto-detect one. Now it's one card: Create
Shared Game and Connection Test moved in, the manual code/role form is
gone entirely (auto-detect via **Join as Viewer** / **Join as Coach** was
already doing the same job), and Join as Coach sits at the bottom.

## 5. Player rows: ranking next to availability, not stacked under it

On a phone, each of the 8 player rows used to stack name, availability, and
skill ranking as three full-width rows. Availability and ranking now sit
side by side under the name, cutting the list's height by roughly a third.

## 6. Build Game Plan no longer jumps to the Game tab

It used to switch to the Game tab automatically the moment the plan
committed. Coaches wanted to review the plan on Pregame first — it now
stays put, and you move to the Game tab yourself when ready.

## 7. Test Speed & Sound moved to their own card

They used to sit in the same control row as Start/Pause/End Game at the
top of the Game tab. Moved to a dedicated card at the bottom, out of the
way of what you actually need mid-game.

## 8. Scoreboard restyle, shorter quarter label

The score is now its own dark scoreboard strip — team name, then a large
number, on each side of a centered dash — instead of one plain line of
text. The quarter label dropped "of 4"; it's just "Q1", "Q2", etc.

## 9. Less to read on the Game tab

Removed the standalone "Substitution Help" card and the paragraph of
sub-mechanics text under the sub suggestion box — both described the same
thing the Sub In Whole Bench / manual-tap workflow already makes obvious by
using it. Also removed the **OUT next** tag on the field (kept the **IN
next** tag on the bench, and the goal-count badge on each shirt).

---

## On the earlier clock-sync report

No further clock-sync issue was reported after v31's revert, so nothing
further changed here. If it recurs, it needs its own report with specifics
(which phone owned the clock, what each screen showed) to chase down.

## Still open

- The season schedule is hardcoded from this year's email — if the
  schedule changes or a new season starts, the list needs a manual edit to
  `SEASON_SCHEDULE` in `public/index.html`. Flag it if this should instead
  be editable from the app itself.
