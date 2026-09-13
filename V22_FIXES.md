# v22 STABLE — what changed and why

Baseline: the v21 TEST CLOCK package. Note that the Worker was still serving the
**v19** front end at the time of review, so some of these bugs had never been
live and others had been live for weeks. `DEPLOY.md` covers why the deploy was
not landing.

Every item below has at least one test in `test/`. The three marked **PROVEN**
have a paired test that loads the old build from
`test/fixtures/v21-shipped-index.html` and asserts the broken behaviour, so the
fix is demonstrated rather than asserted.

---

## Game-day bugs

### 1. Marking a player Out from the Pregame tab left her on the field — **PROVEN**

The in-game Player Status buttons ran a full repair: clear her position, pull in
the lowest-minutes bench player, and reassign any future quarter where she was
the planned goalie. The Pregame roster controls did none of that — they set the
flag and stopped.

So if a girl got hurt and you marked her Out on the Pregame screen, she stayed
on the visual field and kept collecting minutes for the rest of the game, and the
Goalie Rotation strip kept showing her for a quarter she would never play. This
is the same pregame-versus-live mismatch the v16–v19 goalie work kept chasing,
through a route that was never closed.

Both screens now call one `setAvailability()`. It also banks her minutes to the
exact instant she came off, rather than to whenever the next sync happened.

*Tests: "marking a field player Out from the Pregame tab pulls her off the
field", "the shipped v21 build left her on the field collecting minutes",
"unchecking attendance in Pregame behaves the same as marking Out".*

### 2. The active shared game deleted itself, and never came back

The Worker dropped the active-game row if the game had been running and untouched
for 15 minutes, or paused and untouched for 30. `updated_at` only moves on a
write, and a paused game writes nothing — so a long pregame setup, a long
halftime, or a phone with a locked screen was enough to make the game vanish.
Nothing ever re-published it, because `activate: true` was only sent by Create
Shared Game. The second coach lost the Join buttons for the rest of the match.

Staleness is now *reported* to the app instead of acted on: the active row
survives until the game is explicitly ended or is genuinely dead (12 hours).
Pressing Start also re-publishes the game, so the Join buttons come back even if
the active game was cleared by hand.

*Tests: "a long-paused game stays discoverable and is only flagged stale", "a
running game whose phone slept for 20 minutes stays discoverable", "a shared game
left paused for 45 minutes is still joinable", "starting the clock re-publishes
the game after Clear Active Game".*

### 3. Undo could yank the clock backwards on the other phone — **PROVEN**

Undo snapshotted the entire state and pushed it with `changedDomains: ["all"]`,
which overwrote everything the other coach had done since the snapshot. Worse, it
restored the clock: tapping Undo to remove a goal also rewound elapsed time and
every player's accumulated minutes. It also restored the old `syncVersion`, so
the next poll saw the server as newer and instantly cancelled the undo.

Undo now covers roster, lineup, goalie plan and score. It never touches the
clock, the minutes, or the shared-session identity, and it pushes only the
domains it actually changed. The status line says so when you use it.

The trade-off worth knowing: Undo will no longer reverse a quarter change. Use
**End Period** deliberately; there is no going back from it.

*Tests: "Undo reverts the score but leaves the clock and minutes alone", "the
shipped v21 build rolled the clock back on Undo", "Undo restores a lineup
change".*

### 4. The countdown froze at 00:00 for the last six minutes of every quarter — **PROVEN**

Past the 6:00 mark the "next event" calculation returned *now* as the target, so
the countdown pill sat at 00:00 and there was no run-up to the buzzer. The panel
also replaced the suggested swap with a "Reminder Complete" message, hiding the
swap you might still want to make.

The countdown and the swap suggestion are now independent. The countdown always
targets a real boundary — 6:00, then the end of the quarter — and the suggested
swap stays available for the whole quarter.

*Tests: "the countdown keeps counting to the buzzer after the 6:00 mark", "the
shipped v21 build pinned that countdown at 00:00".*

### 5. The goalie strip could disagree with who was actually in goal

When a planned goalie became unavailable, the quarter transition quietly picked
somebody else but left the plan untouched, so the Goalie Rotation strip showed a
keeper who never played. The resolved goalie is now written back into the plan at
every transition point.

The automatic fallback also ignored "Prefer not GK" and could put a reluctant
keeper in goal ahead of a willing one. Willing players now come first, then
fewest goalie minutes.

*Tests: "the goalie strip records who actually played, not who was planned", "a
planned goalie who becomes unavailable is replaced in the future plan only".*

### 6. Reopening the app fast-forwarded the game clock

A phone closed with the clock running kept `clockStartedAt` on disk. On reopen the
app credited however much wall time had passed — capped at the quarter boundary,
but still enough to hand everyone on the field several minutes they had not
played. If the device clock had shifted, it could go backwards instead.

A running clock older than 30 minutes is now parked on load with elapsed time
preserved exactly, and the coach presses Resume. Under 30 minutes it still
resumes automatically, which is the normal case for a screen lock.

*Tests: "reopening with a long-stale running clock parks it instead of
fast-forwarding", "reopening moments after a reload keeps the clock running".*

### 7. End Game could leave the other phone stuck in a finished game

The final state push was fire-and-forget, so it could land *after* the delete that
followed it and re-create the game row. The other phone then never got the 404
that tells it the game is over. The push is now awaited before the teardown.

*Tests: "End Game marks the game finished and closes the shared session", "End
Game writes the game to the shared season history exactly once".*

---

## Data safety

### 8. An empty cloud history silently wiped the season on a phone

`loadCloudHistory()` treated the cloud as authoritative and wrote the result over
local storage unconditionally. If D1's `game_history` was ever empty — recreated
database, a bulk delete from the other phone — the next app load replaced the
local season and all season totals with nothing.

The local copy now wins when the cloud comes back empty, and gets re-uploaded.
Deliberate deletes are unaffected, because those clear the local copy first.

*Tests: "an empty cloud history does not wipe this phone's season", "a local-only
season is re-uploaded to the cloud on load".*

### 9. Anyone could wipe the season with one request

`DELETE /api/history` had no protection at all. It now requires
`?confirm=DELETE-ALL`, which the app sends and a stray or replayed request will
not. This is a guard rail, not authentication — see "Still open" below.

*Tests: "bulk history delete refuses without the confirm token", "Delete All
History sends the confirm token and empties both copies".*

### 10. One corrupt history row no longer breaks the whole season

A single unparseable `game_json` used to throw and take out the entire history
response. Bad rows are now skipped and the rest is returned.

*Test: "one corrupt history row does not poison the whole season".*

---

## Cost, latency and reliability

### 11. Four `CREATE TABLE` statements ran ahead of every single request

`ensureSchema()` was the first thing in `fetch()`, unguarded, before any route
matching. Two consequences:

- Every API call paid four serialised D1 round trips before doing any work, which
  added latency and made version conflicts between two phones more likely.
- Any D1 error — quota, transient failure, a rebound database — threw and turned
  **every** endpoint into a Cloudflare 500, including `/api/health`, which could
  therefore never return the friendly 503 it was written to return.

The schema is now created once per database per isolate, inside a `try`, only for
`/api/` paths, and as a single `batch()`. A D1 outage produces a clean 503 the app
can display. An index on `game_audit (code, created_at)` was added while we were
there.

*Tests: "schema is created once per isolate, not once per request", "a D1 outage
yields a clean 503 instead of an unhandled 500", "non-API paths go to the asset
binding and never touch D1".*

### 12. Polling ran flat out, awake or asleep — **PROVEN**

State polled every 1s, audit every 3s, active-game discovery every 5s, per phone,
whether or not anybody was looking. A single forgotten open tab was roughly
86,000 Worker requests a day; the free plan allows 100,000. Leave the app open
overnight and the next morning's game starts with the daily allowance already
spent.

Cadence is now 2s / 5s / 10s, and **nothing polls at all while the app is in the
background**. Coming back to the foreground restarts polling and settles the clock
immediately rather than waiting for the next tick. A typical hour-long game with
two phones is now a few thousand requests.

*Tests: "nothing polls while the app is in the background", "returning to the
foreground settles the clock straight away", "the idle poll cadence is 10s, not
5s".*

### 13. The D1 session bookmark was being thrown away

Reads used `env.DB.withSession("first-primary")`, then the `INSERT`/`UPDATE` that
followed went through `env.DB` directly — so the read-your-own-writes guarantee
the session API exists to provide was never actually obtained. If read
replication is ever enabled on this database, that is the exact pattern that
produces "the two phones disagree" bugs. One session object is now used for the
read and the write within a request.

*Test: "read and write inside one PUT share a single D1 session".*

### 14. Unmatched `/api/` paths returned an HTML page with status 200

They fell through to the SPA fallback, so a typo or an old client got the whole
app back with `r.ok === true` and then failed on `.json()`. They now return a JSON
404. `wrangler.json` also sets `run_worker_first: ["/api/*"]` so API routing is
explicit rather than inferred from the `Sec-Fetch-Mode` header.

*Test: "unknown API paths return JSON 404, not the SPA HTML page".*

---

## Tidying

- **Stale on-screen copy removed.** The Substitution Help panel still described
  "swaps all 3 bench players together" and the swap button's static label still
  read "Make 3-Player Sub" — both left over from before the v20 one-at-a-time
  rewrite. The button label was only corrected by JavaScript after the first
  render, so the old wording flashed up on load.
- **`state.lastTick` deleted.** Written in six places, read in none, and
  serialised into every cloud push. A leftover from an older clock design.
- **`settleClock()` extracted.** The "bank minutes, then re-anchor at the same
  elapsed time" dance was copy-pasted into three places and missing from a
  fourth. One function now, used by every lineup change.
- **`undoLastGoal()` rewritten.** It computed a list index via
  `[...state.goalLog].map((_, i) => i).pop()` to ask whether the array was empty.
- **Domain field lists hoisted** to a single table at the top of `worker.js`, so
  adding a field to a sync domain is a one-line change.
- **Observability enabled** in `wrangler.json`, so `npm run tail` shows live logs.
- **Historical QA notes** moved to `docs/history/`.

---

## Still open — deliberately not changed

- **No authentication.** Any endpoint is reachable by anyone who knows the URL,
  and game codes are `T71` plus four characters from a 32-character alphabet
  (about a million combinations). For a youth soccer team this is a judgement
  call, not an oversight. If you want it closed, the cheapest fix is a shared
  secret in a request header, checked by the Worker and stored in the app — say
  the word and it is a small change.
- **The D1 database ID is in the repository.** Harmless on its own (it is not a
  credential), but worth knowing if the repo is public.
- **No rules changes.** 4 × 12-minute quarters, 6-minute rotation reminders,
  goalie-per-quarter, the roster, the positions, the Coach/Viewer split, and the
  season-history data model are all untouched.
- **Undo no longer reverses a quarter change** — see item 3.
