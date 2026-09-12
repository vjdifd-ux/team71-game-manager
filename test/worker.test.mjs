import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, req } from "./d1-shim.mjs";
import worker from "../src/worker.js";

const call = (env, path, init) => worker.fetch(req(path, init), env);
const jsonOf = async (r) => JSON.parse(await r.text());

const baseState = (over = {}) => ({
  opponent: "Team 72",
  quarter: 0,
  elapsed: 0,
  running: false,
  ended: false,
  ourScore: 0,
  theirScore: 0,
  lineup: { GK: "A", LB: "B", RB: "C", M: "D", F: "E" },
  goaliePlan: ["A", "B", "C", "D"],
  play: { A: 0, B: 0 },
  gk: { A: 0, B: 0 },
  soundEnabled: true,
  ...over
});

const seed = async (env, code = "T71AAAA", state = baseState(), activate = true) =>
  call(env, "/api/game/" + code, {
    method: "PUT",
    body: { state, changedDomains: ["all"], activate }
  });

/* ------------------------------------------------------------- routing basics */

test("non-API paths go to the asset binding and never touch D1", async () => {
  const env = makeEnv("INDEX");
  const r = await worker.fetch(req("/"), env);
  assert.equal(await r.text(), "INDEX");
  assert.equal(env.DB.queries, 0, "static asset request must not query D1");
});

test("unknown API paths return JSON 404, not the SPA HTML page", async () => {
  const env = makeEnv();
  const r = await call(env, "/api/nope");
  assert.equal(r.status, 404);
  assert.match(r.headers.get("content-type"), /application\/json/);
  assert.equal((await jsonOf(r)).error, "Unknown API endpoint");
});

test("health probe reports ok", async () => {
  const env = makeEnv();
  const r = await call(env, "/api/health");
  assert.equal(r.status, 200);
  assert.equal((await jsonOf(r)).ok, true);
});

test("a D1 outage yields a clean 503 instead of an unhandled 500", async () => {
  const env = makeEnv();
  env.DB.prepare = () => { throw new Error("D1 exploded"); };
  const r = await call(env, "/api/health");
  assert.equal(r.status, 503);
  assert.equal((await jsonOf(r)).error, "D1 unavailable");
});

test("a missing DB binding is reported, not thrown", async () => {
  const env = makeEnv();
  delete env.DB;
  const r = await call(env, "/api/health");
  assert.equal(r.status, 503);
  assert.match((await jsonOf(r)).error, /DB/);
});

test("schema is created once per isolate, not once per request", async () => {
  const env = makeEnv();
  await call(env, "/api/health");
  const afterFirst = env.DB.queries;
  await call(env, "/api/health");
  const perRequest = env.DB.queries - afterFirst;
  assert.equal(perRequest, 1, "second request should be a single SELECT, no DDL");
});

/* --------------------------------------------------------------- game state */

test("first PUT creates the game at version 1", async () => {
  const env = makeEnv();
  const r = await seed(env);
  assert.equal(r.status, 200);
  assert.equal((await jsonOf(r)).syncVersion, 1);
});

test("GET returns state with syncVersion and lastCloudUpdate stamped on", async () => {
  const env = makeEnv();
  await seed(env);
  const s = await jsonOf(await call(env, "/api/game/T71AAAA"));
  assert.equal(s.syncVersion, 1);
  assert.equal(s.opponent, "Team 72");
  assert.ok(s.lastCloudUpdate > 0);
});

test("invalid game codes are rejected", async () => {
  const env = makeEnv();
  for (const code of ["AB", "TOOLONGCODE12", "T71-AA"]) {
    assert.equal((await call(env, "/api/game/" + code)).status, 400, code);
  }
});

test("a missing game is a 404", async () => {
  const env = makeEnv();
  assert.equal((await call(env, "/api/game/T71ZZZZ")).status, 404);
});

test("domain merge: a lineup push does not disturb the other phone's clock", async () => {
  const env = makeEnv();
  await seed(env, "T71AAAA", baseState({ elapsed: 300, running: true, timerOwnerId: "phoneA" }));

  // Coach B knows nothing about the live clock and pushes only the lineup.
  await call(env, "/api/game/T71AAAA", {
    method: "PUT",
    body: {
      state: baseState({ elapsed: 0, running: false, lineup: { GK: "A", LB: "Z", RB: "C", M: "D", F: "E" } }),
      changedDomains: ["lineup"]
    }
  });

  const s = await jsonOf(await call(env, "/api/game/T71AAAA"));
  assert.equal(s.lineup.LB, "Z", "lineup change should land");
  assert.equal(s.elapsed, 300, "clock must be untouched");
  assert.equal(s.running, true);
  assert.equal(s.timerOwnerId, "phoneA");
});

test("domain merge: score and clock pushes from two phones both survive", async () => {
  const env = makeEnv();
  await seed(env);
  await call(env, "/api/game/T71AAAA", {
    method: "PUT",
    body: { state: baseState({ ourScore: 3 }), changedDomains: ["score"] }
  });
  await call(env, "/api/game/T71AAAA", {
    method: "PUT",
    body: { state: baseState({ elapsed: 420, quarter: 1 }), changedDomains: ["clock"] }
  });
  const s = await jsonOf(await call(env, "/api/game/T71AAAA"));
  assert.equal(s.ourScore, 3);
  assert.equal(s.elapsed, 420);
  assert.equal(s.quarter, 1);
});

test("unknown domain names are ignored rather than wiping the row", async () => {
  const env = makeEnv();
  await seed(env);
  await call(env, "/api/game/T71AAAA", {
    method: "PUT",
    body: { state: baseState({ ourScore: 9 }), changedDomains: ["bogus"] }
  });
  const s = await jsonOf(await call(env, "/api/game/T71AAAA"));
  assert.equal(s.ourScore, 0, "no recognised domain means no field changes");
  assert.equal(s.opponent, "Team 72");
});

test("version increments once per accepted write", async () => {
  const env = makeEnv();
  await seed(env);
  for (let i = 2; i <= 4; i++) {
    const r = await call(env, "/api/game/T71AAAA", {
      method: "PUT",
      body: { state: baseState({ ourScore: i }), changedDomains: ["score"] }
    });
    assert.equal((await jsonOf(r)).syncVersion, i);
  }
});

test("oversized state is refused with 413", async () => {
  const env = makeEnv();
  const r = await seed(env, "T71AAAA", baseState({ junk: "x".repeat(130000) }));
  assert.equal(r.status, 413);
});

test("malformed JSON is a 400", async () => {
  const env = makeEnv();
  const r = await call(env, "/api/game/T71AAAA", { method: "PUT", body: "{not json" });
  assert.equal(r.status, 400);
});

test("read and write inside one PUT share a single D1 session", async () => {
  const env = makeEnv();
  await seed(env);
  env.DB.sessions = 0;
  await call(env, "/api/game/T71AAAA", {
    method: "PUT",
    body: { state: baseState({ ourScore: 1 }), changedDomains: ["score"] }
  });
  assert.equal(env.DB.sessions, 1, "one session per attempt, reused for the write");
});

/* -------------------------------------------------------------- active game */

test("no active game is a 404", async () => {
  const env = makeEnv();
  assert.equal((await call(env, "/api/active")).status, 404);
});

test("activate:true publishes the game for the second coach to find", async () => {
  const env = makeEnv();
  await seed(env);
  const a = await jsonOf(await call(env, "/api/active"));
  assert.equal(a.code, "T71AAAA");
  assert.equal(a.opponent, "Team 72");
  assert.equal(a.stale, false);
});

test("a long-paused game stays discoverable and is only flagged stale", async () => {
  const env = makeEnv();
  await seed(env);
  // 45 minutes of pregame setup with nobody tapping anything.
  const old = Date.now() - 45 * 60 * 1000;
  env.DB.db.prepare("UPDATE game_state SET updated_at=?").run(old);

  const r = await call(env, "/api/active");
  assert.equal(r.status, 200, "v21 deleted this row after 30 min; v22 must not");
  const a = await jsonOf(r);
  assert.equal(a.stale, true);
  assert.ok(a.ageSec > 2000);
});

test("a running game whose phone slept for 20 minutes stays discoverable", async () => {
  const env = makeEnv();
  await seed(env, "T71AAAA", baseState({ running: true, clockStartedAt: Date.now() }));
  env.DB.db.prepare("UPDATE game_state SET updated_at=?").run(Date.now() - 20 * 60 * 1000);
  assert.equal((await call(env, "/api/active")).status, 200);
});

test("an ended game is never advertised as active", async () => {
  const env = makeEnv();
  await seed(env);
  await call(env, "/api/game/T71AAAA", {
    method: "PUT",
    body: { state: baseState({ ended: true }), changedDomains: ["clock"] }
  });
  assert.equal((await call(env, "/api/active")).status, 404);
});

test("a twelve-hour-old game is cleared away", async () => {
  const env = makeEnv();
  await seed(env);
  env.DB.db.prepare("UPDATE game_state SET updated_at=?").run(Date.now() - 13 * 3600 * 1000);
  assert.equal((await call(env, "/api/active")).status, 404);
  assert.equal((await call(env, "/api/active")).status, 404, "and the row is gone");
});

test("active elapsed is projected forward while the clock runs", async () => {
  const env = makeEnv();
  await seed(env, "T71AAAA", baseState({
    running: true,
    clockAnchorElapsed: 100,
    clockStartedAt: Date.now() - 10000,
    testSpeed: 1
  }));
  const a = await jsonOf(await call(env, "/api/active"));
  assert.ok(a.elapsed >= 109 && a.elapsed <= 112, "expected ~110, got " + a.elapsed);
});

test("test speed multiplies the projected clock", async () => {
  const env = makeEnv();
  await seed(env, "T71AAAA", baseState({
    running: true,
    clockAnchorElapsed: 0,
    clockStartedAt: Date.now() - 2000,
    testSpeed: 60
  }));
  const a = await jsonOf(await call(env, "/api/active"));
  assert.ok(a.elapsed >= 118 && a.elapsed <= 125, "expected ~120, got " + a.elapsed);
});

test("clearing the active game leaves the game state intact", async () => {
  const env = makeEnv();
  await seed(env);
  await call(env, "/api/active", { method: "DELETE" });
  assert.equal((await call(env, "/api/active")).status, 404);
  assert.equal((await call(env, "/api/game/T71AAAA")).status, 200);
});

test("deleting the game removes both the state and the active row", async () => {
  const env = makeEnv();
  await seed(env);
  await call(env, "/api/game/T71AAAA", { method: "DELETE" });
  assert.equal((await call(env, "/api/game/T71AAAA")).status, 404);
  assert.equal((await call(env, "/api/active")).status, 404);
});

/* ------------------------------------------------------------- plan commit */

test("plan commit forces the field goalie to match the Q1 plan", async () => {
  const env = makeEnv();
  await seed(env);
  const r = await call(env, "/api/plan/T71AAAA", {
    method: "PUT",
    body: {
      goaliePlan: ["Olivia", "Serafina", "Norah", "Luna"],
      lineup: { GK: "Shalom", LB: "B", RB: "C", M: "D", F: "E" },
      planBuilt: true
    }
  });
  const s = await jsonOf(r);
  assert.equal(s.lineup.GK, "Olivia", "worker must enforce lineup.GK === goaliePlan[0]");
  assert.deepEqual(s.goaliePlan, ["Olivia", "Serafina", "Norah", "Luna"]);
  assert.equal(s.planBuilt, true);
});

test("plan commit preserves live clock and score fields it was not given", async () => {
  const env = makeEnv();
  await seed(env, "T71AAAA", baseState({ elapsed: 500, ourScore: 2, quarter: 1 }));
  const s = await jsonOf(await call(env, "/api/plan/T71AAAA", {
    method: "PUT",
    body: { goaliePlan: ["A", "B", "C", "D"], lineup: baseState().lineup }
  }));
  assert.equal(s.elapsed, 500);
  assert.equal(s.ourScore, 2);
  assert.equal(s.quarter, 1);
});

test("plan commit on a missing game is a 404", async () => {
  const env = makeEnv();
  const r = await call(env, "/api/plan/T71ZZZZ", { method: "PUT", body: { goaliePlan: [] } });
  assert.equal(r.status, 404);
});

/* ----------------------------------------------------------------- history */

test("history round-trips and upserts by id without duplicating", async () => {
  const env = makeEnv();
  const game = { id: "g1", date: "2026-09-12T10:00:00Z", opponent: "Team 72", ourScore: 1 };
  await call(env, "/api/history", { method: "POST", body: game });
  await call(env, "/api/history", { method: "POST", body: { ...game, ourScore: 4 } });
  const { games } = await jsonOf(await call(env, "/api/history"));
  assert.equal(games.length, 1);
  assert.equal(games[0].ourScore, 4);
});

test("history is returned oldest first", async () => {
  const env = makeEnv();
  await call(env, "/api/history", { method: "POST", body: { id: "b", date: "2026-05-02" } });
  await call(env, "/api/history", { method: "POST", body: { id: "a", date: "2026-05-01" } });
  const { games } = await jsonOf(await call(env, "/api/history"));
  assert.deepEqual(games.map((g) => g.id), ["a", "b"]);
});

test("history rejects records with no id", async () => {
  const env = makeEnv();
  assert.equal((await call(env, "/api/history", { method: "POST", body: { opponent: "x" } })).status, 400);
});

test("one game can be deleted by id", async () => {
  const env = makeEnv();
  await call(env, "/api/history", { method: "POST", body: { id: "g1", date: "2026-05-01" } });
  await call(env, "/api/history", { method: "POST", body: { id: "g2", date: "2026-05-02" } });
  await call(env, "/api/history/g1", { method: "DELETE" });
  const { games } = await jsonOf(await call(env, "/api/history"));
  assert.deepEqual(games.map((g) => g.id), ["g2"]);
});

test("bulk history delete refuses without the confirm token", async () => {
  const env = makeEnv();
  await call(env, "/api/history", { method: "POST", body: { id: "g1", date: "2026-05-01" } });
  const r = await call(env, "/api/history", { method: "DELETE" });
  assert.equal(r.status, 400);
  const { games } = await jsonOf(await call(env, "/api/history"));
  assert.equal(games.length, 1, "season history must still be there");
});

test("bulk history delete works with the confirm token", async () => {
  const env = makeEnv();
  await call(env, "/api/history", { method: "POST", body: { id: "g1", date: "2026-05-01" } });
  assert.equal((await call(env, "/api/history?confirm=DELETE-ALL", { method: "DELETE" })).status, 200);
  const { games } = await jsonOf(await call(env, "/api/history"));
  assert.equal(games.length, 0);
});

test("one corrupt history row does not poison the whole season", async () => {
  const env = makeEnv();
  await call(env, "/api/history", { method: "POST", body: { id: "good", date: "2026-05-02" } });
  env.DB.db.prepare("INSERT INTO game_history (id,played_at,game_json) VALUES (?,?,?)")
    .run("bad", 1, "{broken");
  const { games } = await jsonOf(await call(env, "/api/history"));
  assert.deepEqual(games.map((g) => g.id), ["good"]);
});

/* ------------------------------------------------------------------- audit */

test("audit entries are written and returned newest first", async () => {
  const env = makeEnv();
  await call(env, "/api/audit/T71AAAA", {
    method: "POST",
    body: { action: "Clock started", detail: "", quarter: 1, elapsed: 0, clientId: "a" }
  });
  await call(env, "/api/audit/T71AAAA", {
    method: "POST",
    body: { action: "Team 71 goal", detail: "Norah", quarter: 1, elapsed: 65, clientId: "b" }
  });
  const { entries } = await jsonOf(await call(env, "/api/audit/T71AAAA"));
  assert.equal(entries.length, 2);
  assert.equal(entries[0].action, "Team 71 goal");
  assert.equal(entries[0].detail, "Norah");
});

test("audit fields are clamped to their column budgets", async () => {
  const env = makeEnv();
  await call(env, "/api/audit/T71AAAA", {
    method: "POST",
    body: { action: "x".repeat(200), detail: "y".repeat(500) }
  });
  const { entries } = await jsonOf(await call(env, "/api/audit/T71AAAA"));
  assert.equal(entries[0].action.length, 80);
  assert.equal(entries[0].detail.length, 300);
});

test("audit rejects a bad code and a bad method", async () => {
  const env = makeEnv();
  assert.equal((await call(env, "/api/audit/xx")).status, 400);
  assert.equal((await call(env, "/api/audit/T71AAAA", { method: "PATCH" })).status, 405);
});
