# v40 SCHEDULED — what changed and why

Baseline: the v39 SWAP package. Off-season improvement list, item #5:
"Schedule management."

---

## The actual problem

The season schedule has existed since v32, but only as a hardcoded array
baked into `public/index.html` — the only way to change a game's date,
time, opponent, or who has snack was to edit the source file and redeploy.
Fine for the initial load from the team's game-day email; not fine the
first time a game gets rescheduled, a bye week gets added, or the whole
back half of the season needs updating at once.

## The fix

**Edit Season Schedule** (next to the "This week's game" dropdown on
Pregame) opens a per-game editor: date, time, opponent, home/away, and
snack for each game, with Add Game and Remove on each row. Nothing takes
effect until **Save** — opening it to look around, or backing out with
**Close Without Saving**, never touches the real schedule.

**Download Current Schedule** exports the whole list as a JSON file;
**Load Schedule File** reads one back in — replacing the *editor's* draft,
not the live schedule directly, so a loaded file still goes through the
same "review it, then Save" step as a hand-typed edit. This is also how
the same schedule gets onto a second coach's phone: download it from one,
send the file over however's convenient, load it on the other.

That last point is deliberate: **the schedule lives in this phone's own
`localStorage`, not in the shared game state.** It was never a candidate
for the live-game sync machinery — unlike score or lineup, it doesn't
change mid-game, and unlike `selectedBench`/`selectedField`, there's no
"whoever acts first wins" conflict to worry about, since a coach editing
next month's schedule isn't racing anyone. It's the same treatment as the
existing per-coach skill ranking: edited locally, carried between games via
`localStorage`, not touched by `cloudPull()` at all.

Internally, each game's display label ("Sat Sep 19, 2:00 PM at Team 75
(Away)") is now *computed* from `{date, time, opponent, homeAway}`
(`formatScheduleLabel()`) rather than stored as a separate string that
editing could leave stale — editing the date can never again leave an old
label sitting next to a new one.

---

*Tests: ten new ones. Opening the editor shows one row per game,
pre-filled. Editing a field and saving updates the real schedule (checked
both in storage and by then actually applying that game from the
dropdown). Closing without saving discards the edit. Adding a row, filling
it in, and saving grows the list; removing one and saving shrinks it. A
row left with no date is silently dropped on save rather than kept as a
blank game. Downloading produces a named JSON file. Loading a schedule
file populates the draft for review, not the live schedule, until Save.
A schedule saved on a previous visit is still there - and a brand-new
`uploadFile()` test harness helper (constructing a real `File` and firing
a `change` event) made the file-loading tests possible without inventing
a parallel code path just for testing. Verified against the real
regression: gutting `saveScheduleEdits()` down to just closing the modal,
and confirming the edit/add/remove/blank-row tests all fail.*

## Still open

- No validation beyond "a row needs a date to be kept" — a malformed time,
  a typo'd opponent name, or a snack player not on the roster are all
  accepted as-is. Reasonable for now since Load Schedule File is the
  primary bulk-entry path and a coach reviewing the draft before Save is
  the actual safety net, but worth tightening if a bad paste ever causes
  real confusion.
