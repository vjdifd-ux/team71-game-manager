# v31 CLEAN — what changed and why

Baseline: the v30 BENCH package. Direct feedback after real multi-phone
testing: "the latest changes broke too much, clock does not sync, players
are now showing across all three views... you missed the mark with bench
coach." The ask was explicit — remove the Bench Coach role's ability to
propose or approve a sub entirely, and go back to one simple, clean,
read-only view.

---

## What was removed

Everything v30 added around the Bench Coach role and the propose/approve
workflow:

- The `"bench"` value for `shareRole` — the role selector and the Active
  Game card's join buttons are back to just Coach / Viewer.
- `state.pendingSubRequest` and the `request` sync domain in `src/worker.js`.
- `canPropose()` / `guardPropose()`, `proposeWholeBenchSub()`,
  `proposeManualSub()`, `approveSubRequest()`, `rejectSubRequest()`.
- The coach-only Approve/Decline card, the Propose This Sub button, and the
  bench-only status line.
- `canEdit()` goes back to its pre-v30 meaning ("not Viewer") now that there
  is no third role to distinguish from Viewer.

This was a genuine "smallest safe design" miss from v30: adding a third
role and a cross-device request/approval workflow was significantly more
machinery than "a super simple view" called for, and it's the kind of
change most likely to introduce exactly the sync/display problems reported.
Removing it is the fix, not patching around it.

## What stayed — because it was already the right ask

The field-view improvements from v30 were never the problem and are still
here:

- A small badge on each shirt for goals already scored.
- An **OUT next** tag on the field and an **IN next** tag on the bench
  wherever the current suggested swap points, so "who's subbing for who" is
  visible on the field itself.

Combined with what the Viewer page already had before v30 — score at the
top, the quarter/game clock, the field and bench, a **Last sub** banner,
the recent-activity audit feed, and a **Game Plan** button for the same
printable/downloadable sheet — this is the complete "super simple" view
that was asked for: score, time left, field, bench, goals per player, last
sub, next sub, and the print sheet, with nothing to edit and nothing
extra.

## On "clock does not sync"

No code-level cause was found on review — the clock-ownership and polling
logic wasn't touched by v30 at all. It's possible this was a side effect of
the same UI/state issues being reported together, or an artifact of testing
three devices against the preview build during a deploy. Since the
regression report and the fix (remove the bench workflow) point the same
direction, this release removes the most likely source rather than leaving
it in place to debug further. If a clock-sync problem is still visible
after this release, it is a separate, real bug and needs its own report —
please flag it specifically (which phone was the clock owner, what the two
screens showed) so it can be reproduced.

---

## Still open

- `V30_BENCH.md` remains in the repo as a historical record of what was
  tried, marked at the top as reverted. Not deleted, per this project's own
  convention of keeping every version's changelog.
- If a Bench-Coach-style role is wanted again later, the backlog's own
  P0.2/P0.3 write-up is the place to restart from — but only on explicit
  request, and with a much smaller first slice than "propose and approve"
  in one go.
