# v24 SIDELINE — what changed and why

Baseline: the v23 ROTATION package. All four changes here came from watching
the app used on an actual sideline.

---

## 1. Pregame is simpler: attendance only, snack player takes Q4

The per-player "Will play GK / Prefer not GK / Cannot GK" control added
complexity nobody was using. It's gone. Every present, available player is
now equally eligible for goalie.

In its place: **who has snack today?** — one dropdown on the Pregame tab.
Whoever's family brought snack takes goalie in the last quarter. Build Game
Plan fills a blank Q4 with her (if she's here); a manual Q4 pick, or a season-
minutes fallback if she isn't here, both still work exactly as before. The
Goalie Planner marks her option "(snack — Q4 default)" for the quarter so it's
visible, not just implied.

This also simplified the fallback goalie logic in three places
(`pickReplacementGoalie`, `previewNextQuarterLineup`, `buildPlan`) that used
to juggle a preference score — now it's just fewest goalie minutes, with the
snack check ahead of it for Q4.

*Tests: "the snack player takes the last quarter in goal by default", "a
manual Q4 pick overrides the snack default", "if the snack player is
unavailable, Q4 falls back to normal fairness".*

## 2. A cover lock lasted up to 18 minutes, not ~12

v23 protected a player covering an emergency sub by counting down 2
"rotation checkpoints" — a scheduled sub being accepted or dismissed, or a
quarter ending. In practice a coach who used manual subs instead of the
scheduled-sub buttons for a whole quarter never spent a checkpoint, so the
lock could run for a full extra quarter before clearing — 18 minutes or more
in the case reported, not the "sits out the current 6 minutes and the next 6"
that was intended.

The lock is now a straight game-clock computation instead of counting UI
interactions: `unlockAtElapsed = (currentSixMinuteWindow + 2) × 6:00`. It
clears exactly when the clock reaches that instant, however the coach chose
to run the rest of the game. A scheduled goalie change is still never
blocked by an active lock — that was already true, since `goaliePlan` and the
quarter-transition lineup never consult cover locks in the first place; only
the fairness-suggestion engine does.

*Tests: "a player covering an emergency sub is protected from the fairness
engine for the rest of this 6-minute window plus the next", "a scheduled
goalie change is never blocked by an active cover lock".*

## 3. Viewers get one page instead of the coach's full tab set

A Viewer's phone used to show the same Pregame / Game / History / Audit /
Backup tabs as the coach, just with the edit controls disabled — tabs full of
nothing to do, and the one thing worth seeing (recent activity) was a tap
away on its own tab.

A Viewer now lands on a single page: score, clock, field, bench, goalie
rotation, and the live activity feed, all at once — no tabs to switch, no
Pregame/History/Backup to see and immediately realize there's nothing to do
there. Coach-only controls (Start/Pause, End Game, the sub-accept buttons,
Quick Score, Player Status buttons, the Substitution Help card) are hidden
rather than just disabled. This is a `body.viewer-mode` CSS switch plus
forcing the Game tab active — nothing about the coach's own view changed.

*Test: extended "a viewer phone follows along but cannot change anything"
to check the one-page layout.*

## 4. A "Last sub" banner, so a name change is never a silent surprise

The complaint: watching lineup names change on the field with no context is
confusing, especially for a Viewer who wasn't the one who made the change.
Every substitution — manual, "Sub In Whole Bench," or a replacement picked
from the emergency-sub popup — now sets a persistent banner ("Last sub —
at 12:34 / Aria Stagnitta IN for Luna Scrivano") on the Game tab, visible to
both coach and viewer. It stays until the next substitution; it's "what just
happened," not a running log — the Audit feed is still there for the full
history.

*Test: "a substitution leaves a persistent 'last sub' banner, so a name
change is never a silent surprise".*

---

## Still open

- The snack rotation itself (whose turn it is to bring snack) isn't tracked
  across games — it's a per-game manual pick, same as Opponent or Home/Away.
- The Sound and Test Speed controls are hidden for Viewers along with the
  other coach-only rows. If a Viewer wants sound alerts, say so — it's a
  one-line change to stop wrapping that row as `coach-only`.
