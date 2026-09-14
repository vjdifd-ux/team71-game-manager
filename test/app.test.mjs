import { test } from "node:test";
import assert from "node:assert/strict";
import { openApp, makeBackend, roster, V21_HTML } from "./harness.mjs";
import { req } from "./d1-shim.mjs";
import worker from "../src/worker.js";

const api = async (backend, path) =>
  JSON.parse(await (await worker.fetch(req(path), backend)).text());
const apiStatus = async (backend, path) => (await worker.fetch(req(path), backend)).status;

const TICK = 250;

/** Pregame → built plan, sitting on the Game tab ready to start. */
async function readyGame(opts = {}) {
  const app = await openApp(opts);
  await app.setGoalie(0, "Olivia Carpenter");
  await app.setGoalie(1, "Serafina Sinagra");
  await app.setGoalie(2, "Norah Dineen");
  await app.setGoalie(3, "Luna Scrivano");
  await app.click("buildPlanBtn");
  return app;
}

/** Advance the virtual clock and let the 250ms tick process it. */
async function run(app, seconds) {
  app.advance(seconds);
  await app.pump(TICK);
}

/* ====================================================== plan and goalie truth */

test("build plan keeps the four manual goalie choices and starts Q1 with Q1's keeper", async () => {
  const app = await readyGame();
  const s = app.state();
  assert.deepEqual(s.goaliePlan,
    ["Olivia Carpenter", "Serafina Sinagra", "Norah Dineen", "Luna Scrivano"]);
  assert.equal(s.lineup.GK, "Olivia Carpenter");
  assert.equal(app.onField().filter(Boolean).length, 5);
  assert.deepEqual(app.goalieStrip(), ["Olivia C.", "Serafina S.", "Norah D.", "Luna S."]);
  app.close();
});

test("build plan only auto-fills the quarters left blank", async () => {
  const app = await openApp();
  await app.setGoalie(0, "Norah Dineen");
  await app.setGoalie(2, "Aria Stagnitta");
  await app.click("buildPlanBtn");
  const plan = app.state().goaliePlan;
  assert.equal(plan[0], "Norah Dineen");
  assert.equal(plan[2], "Aria Stagnitta");
  assert.ok(plan[1] && plan[3], "blank quarters should be filled");
  app.close();
});

test("the snack player takes the last quarter in goal by default", async () => {
  const app = await openApp();
  await app.setSnack("Aria Stagnitta");
  await app.click("buildPlanBtn");
  assert.equal(app.state().goaliePlan[3], "Aria Stagnitta");
  app.close();
});

test("a manual Q4 pick overrides the snack default", async () => {
  const app = await openApp();
  await app.setSnack("Aria Stagnitta");
  await app.setGoalie(3, "Luna Scrivano");
  await app.click("buildPlanBtn");
  assert.equal(app.state().goaliePlan[3], "Luna Scrivano");
  app.close();
});

test("if the snack player is unavailable, Q4 falls back to normal fairness", async () => {
  const app = await openApp();
  await app.setSnack("Aria Stagnitta");
  await app.setAvailPregame("Aria Stagnitta", "out");
  await app.click("buildPlanBtn");
  assert.notEqual(app.state().goaliePlan[3], "Aria Stagnitta");
  assert.ok(app.state().goaliePlan[3], "someone should still be assigned");
  app.close();
});

test("REGRESSION: the printable game plan is a fallback record of the pregame setup", async () => {
  const app = await openApp();
  await app.setSnack("Aria Stagnitta");
  await app.setAvailPregame("Luna Scrivano", "out");
  await app.setAvailPregame("Norah Dineen", "rest");
  await app.setGoalie(0, "Olivia Carpenter");

  assert.equal(app.$("planPrintModal").classList.contains("show"), false);
  await app.click("printPlanBtn");
  assert.equal(app.$("planPrintModal").classList.contains("show"), true);

  const sheet = app.$("planPrintSheet").textContent;
  const [scheduleTable, attendanceTable] = app.$("planPrintSheet").querySelectorAll("table");
  assert.match(sheet, /Team 71 vs Team 72/, "opponent shown");
  assert.match(sheet, /Aria Stagnitta.*plays goalie in Q4/s, "snack assignment shown");
  assert.match(scheduleTable.textContent, /Q1 • 00:00–06:00.*Olivia Carpenter/,
    "the manual Q1 pick shows up before Build Game Plan runs");
  assert.match(scheduleTable.textContent, /Q4 • 42:00–48:00/, "the projection covers the whole game, not just Q1");
  assert.ok(!scheduleTable.textContent.includes("Luna Scrivano"),
    "someone marked Out is excluded from the rotation entirely");
  assert.ok(!scheduleTable.textContent.includes("Norah Dineen"),
    "someone Resting is excluded from the rotation too, not just the field");
  assert.match(attendanceTable.textContent, /Luna Scrivano.*Out/s, "attendance status is listed for every player");
  assert.match(attendanceTable.textContent, /Norah Dineen.*Resting/s);

  await app.click("closePlanPrintBtn");
  assert.equal(app.$("planPrintModal").classList.contains("show"), false);
  app.close();
});

test("the printable game plan reflects the committed lineup once the plan is built", async () => {
  const app = await readyGame();
  await app.click("printPlanBtn");
  const sheet = app.$("planPrintSheet").textContent;
  assert.match(sheet, new RegExp("Q1 • 00:00–06:00.*" + app.state().lineup.GK));
  assert.match(sheet, /Q4 • 42:00–48:00/, "the full game is projected, not just Q1");
  app.close();
});

test("Download produces a standalone HTML file of the current game plan sheet", async () => {
  const app = await readyGame();
  let downloadedName = null;
  const originalClick = app.win.HTMLAnchorElement.prototype.click;
  app.win.HTMLAnchorElement.prototype.click = function () { downloadedName = this.download; };

  await app.click("printPlanBtn");
  await app.click("downloadPlanBtn");
  app.win.HTMLAnchorElement.prototype.click = originalClick;

  assert.match(downloadedName, /^team71-gameplan-\d{4}-\d{2}-\d{2}\.html$/);
  app.close();
});

test("Refresh re-renders the sheet from the current state without closing the modal", async () => {
  const app = await readyGame();
  await app.click("printPlanBtn");
  assert.ok(app.$("planPrintSheet").textContent.includes("Norah Dineen"), "sanity: she starts out listed");

  await app.setAvailPregame("Norah Dineen", "out");
  await app.click("refreshPlanBtn");

  assert.equal(app.$("planPrintModal").classList.contains("show"), true, "stays open");
  const [scheduleTable] = app.$("planPrintSheet").querySelectorAll("table");
  assert.ok(!scheduleTable.textContent.includes("Norah Dineen"),
    "the rotation reflects the change made while the sheet was open");
  app.close();
});

test("REGRESSION: the game plan modal is scrollable and closable even when the sheet is taller than the screen", async () => {
  const app = await readyGame();
  await app.click("printPlanBtn");

  const card = app.$("planPrintCard");
  const style = app.win.getComputedStyle(card);
  assert.equal(style.overflowY, "auto",
    "a tall sheet must scroll inside the card, not overflow the fixed modal with the buttons unreachable");
  assert.notEqual(style.maxHeight, "", "the card must be capped to fit the viewport, not left unbounded");

  // A close button reachable without scrolling to the bottom of a long sheet.
  await app.click("closePlanPrintXBtn");
  assert.equal(app.$("planPrintModal").classList.contains("show"), false);
  app.close();
});

test("the Game tab has its own Game Plan button, not just Pregame and the viewer bar", async () => {
  const app = await readyGame();
  assert.equal(app.$("planPrintModal").classList.contains("show"), false);
  await app.click("gameTabPlanBtn");
  assert.equal(app.$("planPrintModal").classList.contains("show"), true);
  app.close();
});

test("a finished rotation window is crossed off on the printable game plan", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 361); // just past the first 6-minute window

  await app.click("printPlanBtn");
  const rows = [...app.doc.querySelectorAll("#planPrintSheet .schedule tbody tr")];
  assert.ok(rows[0].classList.contains("win-done"), "the window that already ended is crossed off");
  assert.match(rows[0].textContent, /^✓/, "a visible check mark for a finished window");
  assert.ok(!rows[1].classList.contains("win-done"), "the window still ahead is not crossed off");
  app.close();
});

test("a manual change during the current window is highlighted on the printable game plan, a later one is not", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 30); // still well inside the first window

  await app.click("printPlanBtn");
  assert.equal(app.$("planPrintSheet").querySelectorAll(".diff-cell").length, 0,
    "sanity: nothing manual has happened yet");
  await app.click("closePlanPrintBtn");

  const plannedF = app.state().lineup.F;
  const onField = app.onField();
  const incoming = roster.find((p) => !onField.includes(p));
  await app.manualSub(incoming, "F");
  assert.notEqual(app.state().lineup.F, plannedF, "sanity: the manual sub actually changed the field");

  await app.click("printPlanBtn");
  const rows = [...app.doc.querySelectorAll("#planPrintSheet .schedule tbody tr")];
  assert.match(rows[0].textContent, /manual change/i);
  assert.ok(rows[0].querySelector(".diff-cell").textContent.includes(app.state().lineup.F),
    "the highlighted cell shows who is actually there now");
  assert.equal(rows[1].querySelectorAll(".diff-cell").length, 0,
    "a window that has not been reached yet is never flagged as manually changed");
  app.close();
});

/* ============================================================ the clock itself */

test("the clock only moves when it is running", async () => {
  const app = await readyGame();
  await run(app, 30);
  assert.equal(app.state().elapsed, 0, "paused clock must not drift");
  assert.equal(app.text("timer"), "00:00");
  app.close();
});

test("running the clock credits every player on the field, and GK time to the keeper", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 60);

  const s = app.state();
  assert.equal(Math.round(s.elapsed), 60);
  assert.equal(app.text("timer"), "01:00");
  for (const p of app.onField()) assert.equal(Math.round(s.play[p]), 60, p);
  assert.equal(Math.round(s.gk["Olivia Carpenter"]), 60);
  assert.equal(Math.round(s.play["Aria Stagnitta"] ?? 0), 0, "bench players earn nothing");
  app.close();
});

test("pause banks the exact elapsed time and stops accruing", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 45);
  await app.click("startPauseBtn");           // pause
  const paused = app.state();
  await run(app, 120);                        // 2 minutes of standing around
  const after = app.state();
  assert.equal(Math.round(paused.elapsed), 45);
  assert.equal(Math.round(after.elapsed), 45);
  assert.equal(after.running, false);
  assert.equal(Math.round(after.play["Olivia Carpenter"]), 45);
  app.close();
});

test("the quarter clock restarts at 0:00 each quarter while total game time keeps climbing", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 720);                        // end of Q1
  assert.equal(app.state().quarter, 1);
  assert.equal(app.text("timer"), "00:00");
  assert.match(app.text("totalTimer"), /Game 12:00/);
  app.close();
});

/* ================================================= substitutions and the clock */

test("a manual substitution never moves the game clock", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 100);
  const before = app.state();
  const outgoing = before.lineup.F;

  await app.manualSub("Aria Stagnitta", "F");
  const after = app.state();

  assert.equal(Math.round(after.elapsed), 100, "clock must be continuous across a sub");
  assert.equal(after.running, true);
  assert.equal(after.lineup.F, "Aria Stagnitta");
  assert.equal(Math.round(after.play[outgoing]), 100, "outgoing player's minutes are banked");

  await run(app, 50);
  const later = app.state();
  assert.equal(Math.round(later.play[outgoing]), 100, "and stop growing once she is off");
  assert.equal(Math.round(later.play["Aria Stagnitta"]), 50);
  assert.equal(Math.round(later.elapsed), 150);
  app.close();
});

test("REGRESSION: a substitution leaves a persistent \"last sub\" banner, so a name change is never a silent surprise", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 100);
  const outgoing = app.state().lineup.F;

  assert.equal(app.$("lastSubBanner").classList.contains("show"), false, "nothing shown before any sub");

  await app.manualSub("Aria Stagnitta", "F");
  let s = app.state();
  assert.match(s.lastSubDesc, /Aria Stagnitta IN for /);
  assert.ok(s.lastSubDesc.includes(outgoing));
  assert.equal(Math.round(s.lastSubAt), 100);
  assert.equal(app.$("lastSubBanner").classList.contains("show"), true);
  assert.match(app.$("lastSubBanner").textContent, /Aria Stagnitta IN for /);

  // A later sub replaces it, not appends to it — it's "what just happened," not a log.
  await run(app, 20);
  await app.manualSub(outgoing, "F");
  s = app.state();
  assert.match(s.lastSubDesc, new RegExp(outgoing + " IN for Aria Stagnitta"));
  app.close();
});

test("a mid-quarter goalie change moves GK minutes across without touching the clock", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 200);
  await app.manualSub("Aria Stagnitta", "GK");
  await run(app, 100);

  const s = app.state();
  assert.equal(s.lineup.GK, "Aria Stagnitta");
  assert.equal(Math.round(s.gk["Olivia Carpenter"]), 200);
  assert.equal(Math.round(s.gk["Aria Stagnitta"]), 100);
  assert.equal(Math.round(s.elapsed), 300);
  assert.equal(s.goaliePlan[0], "Aria Stagnitta", "this quarter's label follows the change");
  assert.equal(s.goaliePlan[1], "Serafina Sinagra", "future quarters are left alone");
  app.close();
});

test("REGRESSION: the suggested swap brings the whole bench on at once", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 400);                        // past the 6:00 mark
  const s = app.state();
  assert.equal(s.running, true, "the reminder must never stop the clock");
  assert.ok(s.suggestedSub, "a swap should be suggested");
  assert.equal(s.suggestedSub.incoming.length, 3, "v20's one-for-one is gone: the whole bench comes in");
  app.close();
});

test("the shipped v21 build only suggested one swap at a time", async () => {
  const app = await readyGame({ html: V21_HTML });
  await app.click("startPauseBtn");
  await run(app, 400);
  assert.equal(app.state().suggestedSub.incoming.length, 1, "documents the old behaviour");
  app.close();
});

test("the suggested swap pairs fewest-minutes bench with most-minutes field, one for one", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 400);
  const s = app.state();
  const bench = ["Shalom Amaya", "Olivia Carpenter", "Norah Dineen", "Kennedy Kozlosky",
                 "Juliette Maglio", "Luna Scrivano", "Serafina Sinagra", "Aria Stagnitta"]
    .filter((p) => !app.onField().includes(p));
  for (const p of s.suggestedSub.incoming) assert.ok(bench.includes(p));
  for (const p of s.suggestedSub.outgoingPlayers) assert.ok(app.onField().includes(p));
  assert.equal(new Set(s.suggestedSub.incoming).size, s.suggestedSub.incoming.length, "no repeats");
  app.close();
});

test("accepting the suggested swap keeps the clock running, completes the rotation, and re-suggests", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 400);
  const incoming = [...app.state().suggestedSub.incoming];

  await app.click("acceptSubBtn");
  const s = app.state();
  for (const p of incoming) assert.ok(app.onField().includes(p));
  assert.equal(s.running, true);
  assert.equal(Math.round(s.elapsed), 400, "an early sub must not move the clock");
  assert.equal(s.subDone[0], true, "a whole-bench swap completes the quarter's rotation");
  assert.ok(s.suggestedSub, "a fresh suggestion should be ready for the next stoppage");
  app.close();
});

test("the reminder starts flashing once 6:00 passes and stops once the sub is made", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 100);
  assert.equal(app.$("nextSubBox").classList.contains("due"), false, "not due yet");

  await run(app, 300);                        // past the 6:00 mark
  assert.equal(app.$("nextSubBox").classList.contains("due"), true);
  assert.equal(app.$("subCountdown").classList.contains("due"), true);

  await app.click("acceptSubBtn");
  assert.equal(app.$("nextSubBox").classList.contains("due"), false, "clears once the rotation is done");
  app.close();
});

test("REGRESSION: pressing Sub In Whole Bench again after the rotation is done asks first instead of silently re-swapping", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 400);                     // past 6:00

  await app.click("acceptSubBtn");
  assert.equal(app.state().subDone[0], true);
  const afterFirst = app.state().lineup;
  assert.match(app.text("acceptSubBtn"), /Swap Again/, "the button flags a repeat is unusual");

  // A full-strength bench exactly mirrors the field, so an unconfirmed
  // repeat press used to silently swap everyone right back — declining the
  // confirmation must leave the lineup untouched instead.
  // (Each press is a beat apart, same as a real confirm dialog taking a
  // moment to interact with — P0.1's rapid-repeat guard should only ever
  // catch a genuine same-instant double-fire, not deliberate, spaced-out
  // presses.)
  app.win.confirm = () => false;
  await run(app, 1);
  await app.click("acceptSubBtn");
  assert.deepEqual(app.state().lineup, afterFirst, "declining leaves the lineup alone");

  // An explicit confirm still lets the coach deliberately swap again.
  app.win.confirm = () => true;
  await run(app, 1);
  await app.click("acceptSubBtn");
  assert.notDeepEqual(app.state().lineup, afterFirst, "confirming still allows a deliberate second swap");
  app.close();
});

test("REGRESSION: the countdown keeps counting to the buzzer after the 6:00 mark", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 400);
  assert.equal(app.text("subCountdown"), "05:20", "720 - 400 = 5:20 until the quarter ends");
  assert.match(app.text("nextEventLabel"), /Quarter end/);
  assert.match(app.$("subSuggestion").textContent, /Suggested swap/,
    "and the swap panel stays usable");
  assert.equal(app.$("acceptSubBtn").disabled, false);
  app.close();
});

test("the shipped v21 build pinned that countdown at 00:00", async () => {
  const app = await readyGame({ html: V21_HTML });
  await app.click("startPauseBtn");
  await run(app, 400);
  assert.equal(app.text("subCountdown"), "00:00", "documents the old behaviour");
  app.close();
});

/* ============================================== marking a player unavailable */

test("REGRESSION: marking a field player Out from the Pregame tab pulls her off the field", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 120);

  const victim = app.state().lineup.F;
  await app.setAvailPregame(victim, "out");

  const s = app.state();
  assert.ok(!app.onField().includes(victim), victim + " should be off the field");
  assert.equal(Math.round(s.play[victim]), 120, "her minutes are banked at the moment she left");

  // v23: the spot is not auto-filled — the coach is asked who's coming in.
  assert.ok(app.replaceModalOpen(), "a replacement picker should open");
  assert.equal(app.onField().filter(Boolean).length, 4, "the slot stays empty until the coach picks");
  await app.confirmReplacement(app.replaceOptions()[0]);
  assert.equal(app.onField().filter(Boolean).length, 5, "a bench player is now on the field");
  assert.ok(!app.replaceModalOpen());

  await run(app, 120);
  assert.equal(Math.round(app.state().play[victim]), 120, "and stop growing");
  app.close();
});

test("REGRESSION: marking a field player Out mid-game opens a picker instead of auto-filling", async () => {
  const app = await readyGame({ html: V21_HTML });
  await app.click("startPauseBtn");
  await run(app, 120);
  const victim = app.state().lineup.F;
  await app.setAvailPregame(victim, "out");
  assert.equal(app.onField().filter(Boolean).length, 5,
    "documents the old behaviour: the v21 build auto-picked a replacement with no prompt");
  app.close();
});

test("the replacement picker offers the bench sorted by fewest minutes, and a manual sub always still works", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 100);
  await app.manualSub("Aria Stagnitta", "M");   // give Aria some minutes on the bench-to-be
  await run(app, 50);
  await app.manualSub("Serafina Sinagra", "M"); // Aria is benched again, now with 50s on her

  const victim = app.state().lineup.F;
  await app.setAvailPregame(victim, "out");
  const s = app.state();
  const expected = ["Shalom Amaya", "Olivia Carpenter", "Norah Dineen", "Kennedy Kozlosky",
                     "Juliette Maglio", "Luna Scrivano", "Serafina Sinagra", "Aria Stagnitta"]
    .filter((p) => !app.onField().includes(p) && p !== victim)
    .sort((a, b) => s.play[a] - s.play[b]);
  assert.deepEqual(app.replaceOptions(), expected, "picker order matches the old auto-pick's fairness order");

  await app.dismissReplacement();
  assert.ok(!app.replaceModalOpen());
  assert.equal(app.onField().filter(Boolean).length, 4, "left empty, as asked");

  // The coach can still fill it by hand at any time.
  await app.manualSub(expected[0], "F");
  assert.equal(app.onField().filter(Boolean).length, 5);
  app.close();
});

test("a player covering an emergency sub is protected from the fairness engine for the rest of this 6-minute window plus the next", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 100);                                  // window [0,360)

  const victim = app.state().lineup.F;                 // e.g. Luna goes down injured
  await app.setAvailPregame(victim, "rest");
  const [cover] = app.replaceOptions();
  await app.confirmReplacement(cover);
  assert.equal(app.state().lineup.F, cover);
  assert.equal(app.state().coverLocks[cover].for, victim);
  assert.equal(app.state().coverLocks[cover].unlockAtElapsed, 720,
    "unlocks at the start of the window after next, not tied to any button press");

  await run(app, 300);                                  // elapsed ~400, past the 6:00 mark, still locked
  assert.ok(!app.state().suggestedSub.outgoingPlayers.includes(cover),
    "the covering player should not be suggested to come back out yet");

  await app.setAvailPregame(victim, "available");       // coach clears her to play again
  await app.click("changeSubBtn");                       // force a fresh suggestion
  await run(app, 10);                                    // elapsed ~410, still locked
  assert.ok(!app.state().suggestedSub.incoming.includes(victim),
    "she should not be auto-suggested back in while the lock holds");

  await run(app, 300);                                   // elapsed ~710, still inside the locked window
  await app.click("changeSubBtn");
  assert.ok(!app.state().suggestedSub.incoming.includes(victim),
    "still excluded right up to the boundary");
  // The unlock instant (720) lands exactly on this quarter's own buzzer here
  // (an emergency in the first half of any quarter always unlocks no earlier
  // than that quarter's end — see coverLockUnlockElapsed), so the "it lifts"
  // half of the contract is covered by the unlockAtElapsed value asserted
  // above rather than by riding the clock through the quarter transition.
  app.close();
});

test("a scheduled goalie change is never blocked by an active cover lock", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 400);                                   // window [360,720); unlock lands in Q2

  const victim = app.state().lineup.F;
  await app.setAvailPregame(victim, "rest");
  await app.confirmReplacement("Serafina Sinagra");       // Q2's planned keeper covers from the bench
  assert.equal(app.state().lineup.F, "Serafina Sinagra");
  assert.ok(app.state().coverLocks["Serafina Sinagra"].unlockAtElapsed > 720,
    "the lock is still active going into Q2");

  await run(app, 320);                                    // ride out the rest of Q1 to the buzzer (720)

  const s = app.state();
  assert.equal(s.quarter, 1);
  assert.equal(s.lineup.GK, "Serafina Sinagra",
    "the scheduled goalie change happens regardless of the still-active cover lock");
  assert.ok(s.coverLocks["Serafina Sinagra"], "confirming the lock really was still active at this point");
  app.close();
});

test("a manual sub always overrides an active cover lock", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 100);

  const victim = app.state().lineup.F;
  await app.setAvailPregame(victim, "rest");
  const [cover] = app.replaceOptions();
  await app.confirmReplacement(cover);
  await app.setAvailPregame(victim, "available");

  // Even with an active lock, the coach can hand-pick her straight back in.
  await app.manualSub(victim, "F");
  assert.equal(app.state().lineup.F, victim);
  app.close();
});

test("REGRESSION: confirming a replacement doesn't leave a stale suggestion that duplicates her onto a second slot", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 400);                          // past 6:00, so a suggestion already exists

  const victim = app.state().lineup.F;
  await app.setAvailPregame(victim, "rest");     // recomputes a suggestion while F sits empty
  const [cover] = app.replaceOptions();
  await app.confirmReplacement(cover);           // cover now sits at F
  assert.equal(app.state().lineup.F, cover);

  await app.click("acceptSubBtn");               // must not replay a stale pairing that used `cover`

  const onField = app.onField().filter(Boolean);
  assert.equal(new Set(onField).size, onField.length,
    "no player should end up on the field in two slots at once");
  assert.equal(app.state().lineup.F, cover, "the covering player must stay put, not get moved too");
  app.close();
});

test("the shipped v21 build left her on the field collecting minutes", async () => {
  const app = await readyGame({ html: V21_HTML });
  await app.click("startPauseBtn");
  await run(app, 120);
  const victim = app.state().lineup.F;
  await app.setAvailPregame(victim, "out");
  await run(app, 120);

  const s = app.state();
  assert.equal(s.lineup.F, victim, "documents the old behaviour: still on the field");
  assert.equal(Math.round(s.play[victim]), 240, "still accruing minutes while marked Out");
  app.close();
});

test("unchecking attendance in Pregame behaves the same as marking Out", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 60);
  const victim = app.state().lineup.M;
  await app.setPresent(victim, false);

  const s = app.state();
  assert.equal(s.present[victim], false);
  assert.equal(s.availability[victim], "out");
  assert.ok(!app.onField().includes(victim));
  assert.ok(app.replaceModalOpen());
  await app.confirmReplacement(app.replaceOptions()[0]);
  assert.equal(app.onField().filter(Boolean).length, 5);
  app.close();
});

test("the in-game Player Status buttons still work and agree with Pregame", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 60);
  const victim = app.state().lineup.LB;
  await app.setAvailInGame(victim, "Out");
  assert.ok(!app.onField().includes(victim));
  assert.equal(app.state().availability[victim], "out");
  assert.ok(app.replaceModalOpen(), "the in-game buttons open the same picker as Pregame");
  app.close();
});

test("a planned goalie who becomes unavailable is replaced in the future plan only", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 60);

  await app.setAvailPregame("Luna Scrivano", "out");     // the planned Q4 keeper
  const s = app.state();
  assert.notEqual(s.goaliePlan[3], "Luna Scrivano");
  assert.ok(s.goaliePlan[3], "a replacement should be chosen");
  assert.equal(s.goaliePlan[0], "Olivia Carpenter", "Q1 is in the past, leave it recorded");
  app.close();
});

test("REGRESSION: resting the Q4 goalie mid-game doesn't strand her future assignment on a tie-break default", async () => {
  const app = await readyGame();
  await app.setSnack("Luna Scrivano");                   // she's Q4's keeper via the snack rule
  await app.click("buildPlanBtn");
  assert.equal(app.state().goaliePlan[3], "Luna Scrivano");

  await app.click("startPauseBtn");
  await run(app, 60);
  await app.setAvailPregame("Luna Scrivano", "rest");     // a quick breather, not gone for the day
  assert.equal(app.state().goaliePlan[3], "Luna Scrivano",
    "Rest is temporary — a future quarter's goalie plan should not change because of it");

  await app.setAvailPregame("Luna Scrivano", "available");
  assert.equal(app.state().goaliePlan[3], "Luna Scrivano", "and she's still Q4's keeper once she's back");
  app.close();
});

test("marking the Q4 goalie fully Out still reassigns her future quarter right away", async () => {
  const app = await readyGame();
  await app.setSnack("Luna Scrivano");
  await app.click("buildPlanBtn");

  await app.click("startPauseBtn");
  await run(app, 60);
  await app.setAvailPregame("Luna Scrivano", "out");      // gone for the game
  assert.notEqual(app.state().goaliePlan[3], "Luna Scrivano");
  assert.ok(app.state().goaliePlan[3], "a replacement should be chosen immediately");
  app.close();
});

test("marking a player Rest frees her slot too", async () => {
  const app = await readyGame();
  const victim = app.state().lineup.RB;
  await app.setAvailPregame(victim, "rest");
  assert.ok(!app.onField().includes(victim));
  app.close();
});

test("returning a player to Available makes her present again", async () => {
  const app = await readyGame();
  await app.setAvailPregame("Aria Stagnitta", "out");
  await app.setAvailPregame("Aria Stagnitta", "available");
  const s = app.state();
  assert.equal(s.present["Aria Stagnitta"], true);
  assert.equal(s.availability["Aria Stagnitta"], "available");
  app.close();
});

/* ================================================== quarter transitions */

test("the buzzer ends the quarter, applies the next lineup, and waits for Start", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 720);

  const s = app.state();
  assert.equal(s.quarter, 1);
  assert.equal(s.running, false, "the clock must stop at the buzzer");
  assert.equal(s.elapsed, 720, "and sit exactly on the quarter boundary");
  assert.equal(s.lineup.GK, "Serafina Sinagra", "Q2's planned keeper takes over");
  assert.equal(app.onField().filter(Boolean).length, 5);
  assert.equal(app.text("startPauseBtn"), "Resume");
  app.close();
});

test("the quarter clock and total clock agree across all four quarters", async () => {
  const app = await readyGame();
  for (let q = 0; q < 4; q++) {
    await app.click("startPauseBtn");
    await run(app, 720);
    const s = app.state();
    if (q < 3) {
      assert.equal(s.quarter, q + 1, "should be in Q" + (q + 2));
      assert.equal(s.elapsed, 720 * (q + 1));
    } else {
      assert.equal(s.elapsed, 2880, "full game is 48 minutes");
      assert.equal(s.quarter, 3);
    }
  }
  const s = app.state();
  const total = Object.values(s.play).reduce((a, b) => a + b, 0);
  assert.equal(Math.round(total), 2880 * 5, "5 players on the field for 2880 seconds");
  app.close();
});

test("goalie minutes come out at one quarter each for four different keepers", async () => {
  const app = await readyGame();
  for (let q = 0; q < 4; q++) {
    await app.click("startPauseBtn");
    await run(app, 720);
  }
  const gk = app.state().gk;
  for (const p of ["Olivia Carpenter", "Serafina Sinagra", "Norah Dineen", "Luna Scrivano"]) {
    assert.equal(Math.round(gk[p]), 720, p + " should have one full quarter in goal");
  }
  app.close();
});

test("REGRESSION: the goalie strip records who actually played, not who was planned", async () => {
  const app = await readyGame();
  // The planned Q2 keeper is unavailable before Q2 starts.
  await app.setAvailPregame("Serafina Sinagra", "out");
  await app.click("startPauseBtn");
  await run(app, 720);

  const s = app.state();
  assert.equal(s.goaliePlan[1], s.lineup.GK,
    "strip and field must agree on who is in goal");
  assert.notEqual(s.lineup.GK, "Serafina Sinagra");
  app.close();
});

test("End Period advances the quarter, pauses, and shows the new lineup", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 300);                        // stop the period early
  await app.click("nextQuarterBtn");

  const s = app.state();
  assert.equal(s.quarter, 1);
  assert.equal(s.elapsed, 720, "the clock moves to the quarter boundary");
  assert.equal(s.running, false);
  assert.equal(s.lineup.GK, "Serafina Sinagra");
  assert.equal(Math.round(s.play["Olivia Carpenter"]), 300, "minutes actually played are kept");
  app.close();
});

test("End Period is refused in Q4", async () => {
  const app = await readyGame();
  for (let q = 0; q < 3; q++) {
    await app.click("startPauseBtn");
    await run(app, 720);
  }
  await app.click("nextQuarterBtn");
  assert.equal(app.state().quarter, 3);
  assert.match(app.text("status"), /Already in Quarter 4/);
  app.close();
});

test("the clock will not start without five available players", async () => {
  const app = await readyGame();
  for (const p of ["Aria Stagnitta", "Luna Scrivano", "Juliette Maglio", "Kennedy Kozlosky"]) {
    await app.setAvailPregame(p, "out");
  }
  await app.click("startPauseBtn");
  assert.equal(app.state().running, false);
  assert.match(app.text("status"), /5 active players/);
  app.close();
});

/* ================================================================ scoring */

test("goals land on the scorer, the team score, and the goal log", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 100);
  const scorer = app.state().lineup.F;
  await app.scoreGoal(scorer);
  await app.click("oppGoalBtn");

  const s = app.state();
  assert.equal(s.ourScore, 1);
  assert.equal(s.theirScore, 1);
  assert.equal(s.goals[scorer], 1);
  assert.equal(s.goalLog.length, 2);
  assert.equal(s.goalLog[0].player, scorer);
  assert.equal(s.goalLog[0].q, 1);
  app.close();
});

test("P0.1: a sync/network failure never blocks local game actions", async () => {
  const app = await readyGame({ backend: makeBackend() });
  await app.click("createShareBtn");
  await app.click("startPauseBtn");
  await run(app, 60);

  app.win.fetch = () => Promise.reject(new Error("network down"));

  const scorer = app.state().lineup.F;
  await app.scoreGoal(scorer);

  assert.equal(app.state().ourScore, 1, "the goal is recorded locally even though every sync attempt is failing");
  assert.equal(app.text("ourScore"), "1", "the screen updates immediately, not just localStorage");

  await app.manualSub("Aria Stagnitta", "F");
  assert.equal(app.state().lineup.F, "Aria Stagnitta", "further local actions keep working too");
  app.close();
});

test("P0.1 REGRESSION: a same-instant duplicate tap (ghost click) never double-counts a goal", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 100);
  const scorer = app.state().lineup.F;

  // Two clicks with no time between them simulate a duplicate/ghost click
  // event for the one tap a coach actually made, not two deliberate taps.
  await app.scoreGoal(scorer);
  await app.scoreGoal(scorer);
  assert.equal(app.state().ourScore, 1, "the second, same-instant tap must be ignored");
  assert.equal(app.state().goals[scorer], 1);
  assert.equal(app.state().goalLog.length, 1);

  await app.click("oppGoalBtn");
  await app.click("oppGoalBtn");
  assert.equal(app.state().theirScore, 1, "opponent goal button is guarded the same way");

  // A real second tap, a beat later, must still count normally — the guard
  // is against duplicate events, not against scoring twice in one game.
  await run(app, 1);
  await app.scoreGoal(scorer);
  assert.equal(app.state().ourScore, 2, "a genuine later goal is never blocked");
  app.close();
});

test("P0.1: a rapid duplicate tap on the emergency-replacement picker only records one action", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 100);

  const victim = app.state().lineup.F;
  await app.setAvailPregame(victim, "rest");
  const [cover] = app.replaceOptions();

  await app.confirmReplacement(cover);
  await app.confirmReplacement(cover);
  assert.equal(app.state().lineup.F, cover);

  // If the duplicate event had pushed a second undo entry, one Undo would
  // silently no-op (undoing the second, identical assignment back onto
  // itself) and the coach would have to press it twice to get her back.
  await app.click("undoBtn");
  assert.equal(app.state().lineup.F, null, "a single Undo fully reverses the one real action");
  app.close();
});

test("Undo Last Goal removes only the most recent goal", async () => {
  const app = await readyGame();
  const scorer = app.state().lineup.F;
  await app.scoreGoal(scorer);
  await app.click("oppGoalBtn");
  await app.click("undoGoalBtn");

  const s = app.state();
  assert.equal(s.ourScore, 1);
  assert.equal(s.theirScore, 0);
  assert.equal(s.goalLog.length, 1);
  app.close();
});

/* ==================================================================== undo */

test("REGRESSION: Undo reverts the score but leaves the clock and minutes alone", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 100);
  const scorer = app.state().lineup.F;
  await app.scoreGoal(scorer);
  await run(app, 80);

  const before = app.state();
  assert.equal(before.ourScore, 1);
  assert.equal(Math.round(before.elapsed), 180);

  await app.click("undoBtn");
  const after = app.state();

  assert.equal(after.ourScore, 0, "the goal is undone");
  assert.equal(after.goals[scorer], 0);
  assert.equal(Math.round(after.elapsed), 180, "the clock must not jump backwards");
  assert.equal(after.running, true, "and must not stop");
  assert.equal(Math.round(after.play[scorer]), 180, "minutes played are not rolled back");
  app.close();
});

test("the shipped v21 build rolled the clock back on Undo", async () => {
  const app = await readyGame({ html: V21_HTML });
  await app.click("startPauseBtn");
  await run(app, 100);
  await app.scoreGoal(app.state().lineup.F);
  await run(app, 80);
  await app.click("undoBtn");
  assert.equal(Math.round(app.state().elapsed), 100,
    "documents the old behaviour: clock snapped back to the snapshot");
  app.close();
});

test("Undo restores a lineup change", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 60);
  const original = app.state().lineup.F;
  await app.manualSub("Aria Stagnitta", "F");
  assert.equal(app.state().lineup.F, "Aria Stagnitta");
  await app.click("undoBtn");
  assert.equal(app.state().lineup.F, original);
  app.close();
});

test("Undo with an empty stack says so instead of throwing", async () => {
  const app = await openApp();
  await app.click("undoBtn");
  assert.match(app.text("status"), /Nothing to undo/);
  app.close();
});

/* ============================================================== test clock */

test("test speed cycles 1x, 10x, 60x and back while paused", async () => {
  const app = await readyGame();
  const seen = [];
  for (let i = 0; i < 4; i++) {
    seen.push(app.state().testSpeed);
    await app.click("testSpeedBtn");
  }
  assert.deepEqual(seen, [1, 10, 60, 1]);
  app.close();
});

test("test speed is locked while the clock runs", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  assert.equal(app.$("testSpeedBtn").disabled, true, "the control is locked out while running");
  await app.click("testSpeedBtn");
  assert.equal(app.state().testSpeed, 1, "and the speed cannot change mid-run");
  app.close();
});

test("at 60x a 12-minute quarter takes about 12 real seconds and minutes scale with it", async () => {
  const app = await readyGame();
  await app.click("testSpeedBtn");
  await app.click("testSpeedBtn");             // 60x
  assert.equal(app.state().testSpeed, 60);

  await app.click("startPauseBtn");
  await run(app, 6);                           // 6 real seconds -> 6:00 game time
  let s = app.state();
  assert.equal(Math.round(s.elapsed), 360);
  assert.equal(Math.round(s.play["Olivia Carpenter"]), 360, "minutes accelerate too");

  await run(app, 6);                           // 12 real seconds -> end of Q1
  s = app.state();
  assert.equal(s.quarter, 1);
  assert.equal(s.running, false);
  app.close();
});

test("New Game resets the clock, the plan and the test speed", async () => {
  const app = await readyGame();
  await app.click("testSpeedBtn");
  await app.click("startPauseBtn");
  await run(app, 300);
  await app.scoreGoal(app.state().lineup.F);
  await app.click("newGameBtn");

  const s = app.state();
  assert.equal(s.testSpeed, 1);
  assert.equal(s.elapsed, 0);
  assert.equal(s.quarter, 0);
  assert.equal(s.ourScore, 0);
  assert.equal(s.running, false);
  assert.equal(s.planBuilt, false);
  assert.deepEqual(s.goaliePlan, ["", "", "", ""]);
  app.close();
});

/* ====================================================== reopening the app */

test("REGRESSION: reopening with a long-stale running clock parks it instead of fast-forwarding", async () => {
  const seedState = {
    gameId: "g_test", opponent: "Team 72", homeAway: "home",
    present: {}, availability: {}, gkPref: {},
    goaliePlan: ["", "", "", ""], lineup: { GK: null, LB: null, RB: null, M: null, F: null },
    elapsed: 300, quarter: 0, running: true, ended: false,
    play: {}, gk: {}, goals: {}, ourScore: 0, theirScore: 0, goalLog: [],
    clockStartedAt: 1780000000000 - 2 * 60 * 60 * 1000,   // two hours ago
    clockAnchorElapsed: 300, testSpeed: 1, timerOwnerId: "whoever"
  };
  const app = await openApp({ seedState });
  const s = app.state();
  assert.equal(s.running, false, "a two-hour-old running clock is not trustworthy");
  assert.equal(s.elapsed, 300, "elapsed time is preserved exactly");
  assert.equal(s.timerOwnerId, "");
  app.close();
});

test("reopening moments after a reload keeps the clock running", async () => {
  const seedState = {
    gameId: "g_test", opponent: "Team 72", homeAway: "home",
    present: {}, availability: {}, gkPref: {},
    goaliePlan: ["", "", "", ""], lineup: { GK: null, LB: null, RB: null, M: null, F: null },
    elapsed: 300, quarter: 0, running: true, ended: false,
    play: {}, gk: {}, goals: {}, ourScore: 0, theirScore: 0, goalLog: [],
    clockStartedAt: 1780000000000 - 5000, clockAnchorElapsed: 300, testSpeed: 1,
    timerOwnerId: "whoever"
  };
  const app = await openApp({ seedState });
  assert.equal(app.state().running, true);
  app.close();
});

/* ============================================================ two phones */

test("two phones: the second coach discovers and joins the live game", async () => {
  const backend = makeBackend();
  const a = await readyGame({ backend });
  await a.click("createShareBtn");
  const code = a.state().shareCode;
  assert.match(code, /^T71[A-Z0-9]{4}$/);

  const b = await openApp({ backend });
  assert.equal(b.$("joinActiveCoachBtn").disabled, false, "Join should light up");
  assert.match(b.$("activeGameInfo").textContent, /Team 72/);

  await b.click("joinActiveCoachBtn");
  assert.equal(b.state().shareCode, code);
  assert.equal(b.state().lineup.GK, "Olivia Carpenter", "phone B sees phone A's plan");
  a.close(); b.close();
});

test("two phones: a goal on one appears on the other", async () => {
  const backend = makeBackend();
  const a = await readyGame({ backend });
  await a.click("createShareBtn");
  const b = await openApp({ backend });
  await b.click("joinActiveCoachBtn");

  await a.scoreGoal(a.state().lineup.F);
  await b.pump(2000);                          // phone B's state poll
  assert.equal(b.state().ourScore, 1);
  a.close(); b.close();
});

test("two phones: coach B's substitution does not disturb coach A's running clock", async () => {
  const backend = makeBackend();
  const a = await readyGame({ backend });
  await a.click("createShareBtn");
  const b = await openApp({ backend });
  await b.click("joinActiveCoachBtn");

  await a.click("startPauseBtn");
  await run(a, 200);
  const elapsedBefore = a.state().elapsed;

  await b.manualSub("Aria Stagnitta", "F");    // B knows nothing about the clock
  await a.pump(2000);                          // A pulls the merged state

  const s = a.state();
  assert.equal(s.lineup.F, "Aria Stagnitta", "A receives the lineup change");
  assert.ok(Math.abs(s.elapsed - elapsedBefore) < 2, "A's clock is untouched");
  assert.equal(s.running, true);
  a.close(); b.close();
});

test("two phones: the second coach cannot hijack a clock the first phone owns", async () => {
  const backend = makeBackend();
  const a = await readyGame({ backend });
  await a.click("createShareBtn");
  const b = await openApp({ backend });
  await b.click("joinActiveCoachBtn");

  await a.click("startPauseBtn");
  await run(a, 60);
  await b.pump(2000);

  await b.click("startPauseBtn");
  assert.match(b.text("status"), /other coach's phone/);
  assert.equal(a.state().running, true);
  a.close(); b.close();
});

test("a viewer phone follows along but cannot change anything", async () => {
  const backend = makeBackend();
  const a = await readyGame({ backend });
  await a.click("createShareBtn");
  const b = await openApp({ backend });
  await b.click("joinActiveViewerBtn");

  assert.equal(b.state().shareRole, "viewer");
  assert.equal(b.onField().filter(Boolean).length, 5, "a viewer still sees the live lineup");
  for (const id of ["startPauseBtn", "endGameBtn", "nextQuarterBtn", "undoBtn",
                    "oppGoalBtn", "buildPlanBtn", "newGameBtn"]) {
    assert.equal(b.$(id).disabled, true, id + " must be locked for a viewer");
  }

  // REGRESSION: a viewer gets one simplified page instead of the coach's
  // full tab set — no separate Pregame/History/Backup to navigate, and no
  // controls that only a coach could use anyway.
  assert.ok(b.doc.body.classList.contains("viewer-mode"));
  assert.equal(b.$("game").classList.contains("active"), true, "lands on the live game, not Pregame");
  for (const id of ["setup", "history", "backup"]) {
    assert.equal(b.win.getComputedStyle(b.$(id)).display, "none", "#" + id + " is hidden for a viewer");
  }
  assert.equal(b.win.getComputedStyle(b.doc.querySelector(".tabs")).display, "none");
  assert.notEqual(b.win.getComputedStyle(b.$("audit")).display, "none",
    "recent activity stays on the one page instead of behind a tab");
  a.close(); b.close();
});

test("REGRESSION: a viewer can always get back out of viewer mode", async () => {
  const backend = makeBackend();
  const a = await readyGame({ backend });
  await a.click("createShareBtn");
  const b = await openApp({ backend });
  await b.click("joinActiveViewerBtn");
  assert.ok(b.doc.body.classList.contains("viewer-mode"));

  // The escape hatch lives on the one page a viewer can see — not behind
  // the Pregame tab, which is exactly what was hidden out from under it.
  assert.notEqual(b.win.getComputedStyle(b.$("viewerBar")).display, "none");
  await b.click("viewerLeaveBtn");

  assert.equal(b.state().shareRole, "coach");
  assert.equal(b.doc.body.classList.contains("viewer-mode"), false);
  assert.notEqual(b.win.getComputedStyle(b.doc.querySelector(".tabs")).display, "none",
    "the tab bar — and Pregame with it — is reachable again");
  a.close(); b.close();
});

test("a viewer can open the game plan sheet without leaving viewer mode", async () => {
  const backend = makeBackend();
  const a = await readyGame({ backend });
  await a.click("createShareBtn");
  const b = await openApp({ backend });
  await b.click("joinActiveViewerBtn");

  await b.click("viewerPlanBtn");
  assert.equal(b.$("planPrintModal").classList.contains("show"), true);
  assert.match(b.$("planPrintSheet").textContent, /Team 71 vs Team 72/);
  a.close(); b.close();
});

/* ============================================ shared field view enhancements */

test("a goal shows as a badge on top of the scorer's shirt", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 30);
  const scorer = app.state().lineup.F;
  assert.equal(app.doc.querySelector("#posF .goal-badge"), null, "no badge before any goal");
  await app.scoreGoal(scorer);
  const badge = app.doc.querySelector("#posF .goal-badge");
  assert.ok(badge, "a badge appears on the scorer's shirt");
  assert.equal(badge.textContent, "1");
  app.close();
});

test("the field and bench show who is rotating out and in next", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 30);
  const s = app.state().suggestedSub;
  assert.ok(s && s.outgoingSlots.length, "sanity: there is a suggestion to show");

  const posIds = { GK: "posGK", LB: "posLB", RB: "posRB", M: "posM", F: "posF" };
  s.outgoingSlots.forEach((slot) => {
    assert.ok(app.doc.querySelector("#" + posIds[slot] + " .rotate-tag.out"), slot + " should show OUT next");
  });

  const benchBtns = [...app.doc.querySelectorAll("#benchSide .bench-btn")];
  s.incoming.forEach((p) => {
    const btn = benchBtns.find((b) => b.textContent.includes(p));
    assert.ok(btn.querySelector(".next-in"), p + " should be tagged IN next");
  });
  app.close();
});

test("REGRESSION: a shared game left paused for 45 minutes is still joinable", async () => {
  const backend = makeBackend();
  const a = await readyGame({ backend });
  await a.click("createShareBtn");

  a.advance(45 * 60);                          // long pregame, nobody taps anything

  const b = await openApp({ backend, now: a.now() });
  assert.equal(b.$("joinActiveCoachBtn").disabled, false,
    "v21 deleted the active game after 30 paused minutes");
  assert.match(b.$("activeGameInfo").textContent, /Team 72/);
  // The Worker's own staleness flag is covered in worker.test.mjs; it runs on
  // the host clock rather than this test's virtual one, so it is not asserted here.
  a.close(); b.close();
});

test("starting the clock re-publishes the game after Clear Active Game", async () => {
  const backend = makeBackend();
  const a = await readyGame({ backend });
  await a.click("createShareBtn");
  await a.click("clearActiveBtn");

  // Rejoin the same code and start play.
  a.$("joinCode").value = a.state().lastAuditCode || "";
  await a.click("createShareBtn");
  await a.click("startPauseBtn");
  await a.flush();

  const b = await openApp({ backend, now: a.now() });
  assert.equal(b.$("joinActiveCoachBtn").disabled, false);
  a.close(); b.close();
});

/* ============================================================ end of game */

test("End Game marks the game finished and closes the shared session", async () => {
  const backend = makeBackend();
  const a = await readyGame({ backend });
  await a.click("createShareBtn");
  await a.click("startPauseBtn");
  await run(a, 720);
  await a.scoreGoal(a.state().lineup.F);
  await a.click("endGameBtn");
  await a.flush(20);

  const s = a.state();
  assert.equal(s.ended, true);
  assert.equal(s.shareCode, "", "the shared session is closed");
  assert.equal(a.$("endGameBtn").disabled, true, "and cannot be ended twice");
  a.close();
});

test("End Game writes the game to the shared season history exactly once", async () => {
  const backend = makeBackend();
  const a = await readyGame({ backend });
  await a.click("createShareBtn");
  await a.click("startPauseBtn");
  await run(a, 720);
  await a.click("endGameBtn");
  await a.flush(20);

  const hist = await api(backend, "/api/history");
  assert.equal(hist.games.length, 1);
  assert.equal(hist.games[0].opponent, "Team 72");
  assert.ok(hist.games[0].play["Olivia Carpenter"] > 0);

  // The active game must be gone and the live row deleted.
  assert.equal(await apiStatus(backend, "/api/active"), 404);
  a.close();
});

test("history survives a reload and season totals are rendered", async () => {
  const backend = makeBackend();
  const a = await readyGame({ backend });
  await a.click("createShareBtn");
  await a.click("startPauseBtn");
  await run(a, 720);
  await a.click("endGameBtn");
  await a.flush(20);

  const b = await openApp({ backend, now: a.now() });
  assert.equal(b.history().length, 1);
  assert.match(b.$("seasonTotals").textContent, /Olivia Carpenter/);
  a.close(); b.close();
});

/* ========================================================= history safety */

test("REGRESSION: an empty cloud history does not wipe this phone's season", async () => {
  const seedHistory = [{
    id: "old_game_1", date: "2026-05-01T12:00:00Z", opponent: "Team 40",
    ourScore: 3, theirScore: 1, play: { "Norah Dineen": 1440 }, gkQuarters: {}, goals: {}
  }];
  const app = await openApp({ seedHistory });
  await app.flush(20);
  assert.equal(app.history().length, 1, "the local season must still be there");
  assert.equal(app.history()[0].id, "old_game_1");
  app.close();
});

test("a local-only season is re-uploaded to the cloud on load", async () => {
  const backend = makeBackend();
  const seedHistory = [{
    id: "old_game_1", date: "2026-05-01T12:00:00Z", opponent: "Team 40",
    ourScore: 3, theirScore: 1, play: {}, gkQuarters: {}, goals: {}
  }];
  const app = await openApp({ backend, seedHistory });
  await app.flush(30);
  const hist = await api(backend, "/api/history");
  assert.equal(hist.games.length, 1, "the phone should have pushed its season up");
  app.close();
});

test("Delete All History sends the confirm token and empties both copies", async () => {
  const backend = makeBackend();
  const app = await openApp({
    backend,
    seedHistory: [{ id: "g1", date: "2026-05-01", opponent: "X", play: {}, gkQuarters: {}, goals: {} }]
  });
  await app.flush(20);
  await app.click("deleteAllHistoryBtn");
  await app.flush(20);

  assert.ok(app.requests.some((r) => r.includes("confirm=DELETE-ALL")),
    "the Worker refuses a bulk wipe without it");
  assert.equal(app.history().length, 0);
  const hist = await api(backend, "/api/history");
  assert.equal(hist.games.length, 0);
  app.close();
});

/* ============================================================== polling */

test("REGRESSION: nothing polls while the app is in the background", async () => {
  const backend = makeBackend();
  const a = await readyGame({ backend });
  await a.click("createShareBtn");
  const pollDelays = () => a.intervals.map((i) => i.delay).filter((d) => d >= 2000);
  assert.ok(pollDelays().length >= 2, "polls are running in the foreground");

  await a.setHidden(true);
  assert.deepEqual(pollDelays(), [], "backgrounded phone stops calling the Worker");

  await a.setHidden(false);
  assert.ok(pollDelays().length >= 2, "and picks straight back up");
  a.close();
});

test("returning to the foreground settles the clock straight away", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await app.setHidden(true);
  app.advance(200);                            // pocket time; no timers fire
  await app.setHidden(false);
  assert.equal(Math.round(app.state().elapsed), 200, "caught up on return");
  app.close();
});

test("the idle poll cadence is 10s, not 5s", async () => {
  const app = await openApp();
  assert.ok(app.intervals.some((i) => i.delay === 10000));
  assert.ok(!app.intervals.some((i) => i.delay === 5000 && i.delay < 10000));
  app.close();
});

/* ============================================================= rendering */

test("the field shows five positions with names and minutes", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 300);
  for (const id of ["posGK", "posLB", "posRB", "posM", "posF"]) {
    const txt = app.$(id).textContent;
    assert.ok(!txt.includes("Empty"), id + " should hold a player");
    assert.match(txt, /\d/, id + " should show minutes");
  }
  app.close();
});

test("the live minutes table lists every present player", async () => {
  const app = await readyGame();
  await app.click("startPauseBtn");
  await run(app, 120);
  const rows = app.$("liveMinutes").querySelectorAll("tr");
  assert.equal(rows.length, 8);
  app.close();
});

test("the audit log records the plan, the clock and the goals", async () => {
  const backend = makeBackend();
  const a = await readyGame({ backend });
  await a.click("createShareBtn");
  await a.click("buildPlanBtn");
  await a.click("startPauseBtn");
  await a.scoreGoal(a.state().lineup.F);
  await a.flush(20);
  await a.click("refreshAuditBtn");
  await a.flush(20);

  const txt = a.$("auditList").textContent;
  assert.match(txt, /Game plan built/);
  assert.match(txt, /Clock started/);
  assert.match(txt, /Team 71 goal/);
  a.close();
});

test("the stale v20-era 3-player-batch wording is gone from the page", async () => {
  const app = await openApp();
  const body = app.doc.body.textContent;
  assert.ok(!/swaps all 3 bench players/.test(body));
  assert.equal(app.text("acceptSubBtn"), "Sub In Whole Bench");
  app.close();
});

/* ============================================== skill ratings and starting lineup */

test("P2.1: a skill rating updates state and survives New Game / Reset", async () => {
  const app = await openApp();
  await app.setSkill("Kennedy Kozlosky", 5);
  assert.equal(app.state().skill["Kennedy Kozlosky"], 5);

  await app.click("newGameBtn");
  assert.equal(app.state().skill["Kennedy Kozlosky"], 5,
    "a coach's skill assessment is not per-game data — it must not reset with the rest of the game");
  app.close();
});

test("P2.1/P2.2 REGRESSION: a tie in season minutes no longer falls back to plain roster order", async () => {
  // Every player is tied at 0 season minutes here — exactly the situation a
  // brand-new player is always in. The old code's tie-break was "whoever
  // sorts first in the roster array", so the starting five was really just
  // "the first four names alphabetically" by accident, not by any fairness
  // or ability signal.
  const app = await openApp();
  await app.setGoalie(0, "Shalom Amaya");
  const withoutRating = (await app.click("buildPlanBtn"), app.onField().filter(Boolean));
  assert.ok(!withoutRating.includes("Luna Scrivano"),
    "sanity check: on a plain tie, roster order leaves Luna on the bench");

  await app.click("newGameBtn");
  await app.setSkill("Luna Scrivano", 5);
  await app.setGoalie(0, "Shalom Amaya");
  await app.click("buildPlanBtn");
  const withRating = app.onField().filter(Boolean);
  assert.ok(withRating.includes("Luna Scrivano"),
    "a higher-rated player on an otherwise pure tie is preferred for the starting five");
  app.close();
});

test("P2.2: the coach can manually adjust a starting-lineup slot before Build Game Plan", async () => {
  const app = await openApp();
  await app.setGoalie(0, "Shalom Amaya");
  await app.setLineupSlot("F", "Aria Stagnitta");
  await app.click("buildPlanBtn");
  assert.equal(app.state().lineup.F, "Aria Stagnitta",
    "a manual Adjust before commit is kept, not silently overridden by the suggestion");
  app.close();
});

test("P2.2: Regenerate Suggestion discards a manual adjustment and recomputes", async () => {
  const app = await openApp();
  await app.setGoalie(0, "Shalom Amaya");
  const suggested = app.lineupPlanner().F;
  await app.setLineupSlot("F", suggested === "Aria Stagnitta" ? "Kennedy Kozlosky" : "Aria Stagnitta");
  assert.notEqual(app.lineupPlanner().F, suggested);

  await app.click("regenerateLineupBtn");
  assert.equal(app.lineupPlanner().F, suggested, "Regenerate recomputes the same algorithm's pick");
  app.close();
});

test("P1.4 REGRESSION: a rotation swap avoids putting a player back in the position she's already played the most", async () => {
  const seedState = {
    planBuilt: true,
    goaliePlan: ["Olivia Carpenter", "Olivia Carpenter", "Olivia Carpenter", "Olivia Carpenter"],
    lineup: { GK: "Olivia Carpenter", LB: "Shalom Amaya", RB: "Norah Dineen", M: "Kennedy Kozlosky", F: "Juliette Maglio" },
    play: {
      "Olivia Carpenter": 400, "Shalom Amaya": 400, "Norah Dineen": 400, "Kennedy Kozlosky": 400,
      "Juliette Maglio": 400, "Luna Scrivano": 0, "Serafina Sinagra": 0, "Aria Stagnitta": 0
    },
    // Luna already logged heavy time at LB earlier this game (before she was
    // benched) — everyone else here is a blank slate.
    posPlay: {
      "Olivia Carpenter": { GK: 400, LB: 0, RB: 0, M: 0, F: 0 },
      "Shalom Amaya": { GK: 0, LB: 400, RB: 0, M: 0, F: 0 },
      "Norah Dineen": { GK: 0, LB: 0, RB: 400, M: 0, F: 0 },
      "Kennedy Kozlosky": { GK: 0, LB: 0, RB: 0, M: 400, F: 0 },
      "Juliette Maglio": { GK: 0, LB: 0, RB: 0, M: 0, F: 400 },
      "Luna Scrivano": { GK: 0, LB: 1000, RB: 0, M: 0, F: 0 },
      "Serafina Sinagra": { GK: 0, LB: 0, RB: 0, M: 0, F: 0 },
      "Aria Stagnitta": { GK: 0, LB: 0, RB: 0, M: 0, F: 0 }
    },
    gk: {
      "Olivia Carpenter": 400, "Shalom Amaya": 0, "Norah Dineen": 0, "Kennedy Kozlosky": 0,
      "Juliette Maglio": 0, "Luna Scrivano": 0, "Serafina Sinagra": 0, "Aria Stagnitta": 0
    },
    subDone: [false, false, false, false], nextSubAt: 360, elapsed: 400, quarter: 0, running: false
  };
  const app = await openApp({ seedState });
  await app.click("acceptSubBtn");
  const s = app.state();
  assert.equal(s.lineup.RB, "Luna Scrivano", "Luna is routed away from LB, her heaviest position, into RB instead");
  assert.equal(s.lineup.LB, "Serafina Sinagra", "a position-blank teammate takes the vacated LB slot instead");
  assert.equal(s.lineup.M, "Aria Stagnitta");
  assert.equal(s.lineup.F, "Juliette Maglio", "untouched — she wasn't due to be swapped out this round");
  app.close();
});

test("the version banner says v31 so the deployed build is identifiable", async () => {
  const app = await openApp();
  assert.match(app.doc.querySelector(".top .muted.small").textContent, /v31 CLEAN/);
  app.close();
});
