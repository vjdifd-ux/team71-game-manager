/**
 * Team 71 Game Manager — Cloudflare Worker API
 * v22 STABLE
 *
 * Responsibilities
 *   /api/health            GET                 connectivity + D1 probe
 *   /api/active            GET DELETE          "which game is live right now"
 *   /api/active/<code>     DELETE              clear one specific active game
 *   /api/history           GET POST DELETE     season history (shared across phones)
 *   /api/history/<id>      DELETE              remove one saved game
 *   /api/audit/<code>      GET POST            live activity feed for a shared game
 *   /api/plan/<code>       PUT                 atomic pregame goalie + lineup commit
 *   /api/game/<code>       GET PUT DELETE      live shared game state
 *
 * Anything that is not /api/ is handed to the static asset binding.
 *
 * v22 CHANGES (see V22_FIXES.md)
 *   1. Schema creation runs ONCE per isolate, is wrapped in try/catch, and only
 *      for /api/ requests. Previously 4 CREATE TABLE statements ran ahead of
 *      every single request and an unguarded D1 error turned every API call
 *      into a Cloudflare 500 — including /api/health, which could therefore
 *      never report its own friendly 503.
 *   2. The active game is no longer deleted just because nobody touched it for
 *      15-30 minutes. A paused game (pregame setup, halftime, a phone with a
 *      locked screen) used to silently disappear, and nothing ever put it back,
 *      so the second coach lost the Join buttons for the rest of the game.
 *      Staleness is now REPORTED to the app, not acted on. Only an ended game
 *      or a genuinely dead one (12h) is removed.
 *   3. One D1 session object is now used for the read AND the write inside a
 *      single request, so the read-your-own-writes bookmark actually carries.
 *      Before, reads used a session and writes bypassed it via env.DB.
 *   4. Unmatched /api/ paths return JSON 404 instead of falling through to the
 *      SPA fallback, which used to hand the app an HTML page with status 200.
 *   5. Bulk history delete requires ?confirm=DELETE-ALL so a stray request
 *      cannot wipe the season.
 *   6. Audit housekeeping moved off the hot path onto audit writes only.
 */

const ACTIVE_TEAM = "team71";
const CODE_RE = /^[A-Z0-9]{4,10}$/;
const MAX_STATE_BYTES = 120000;
const DEAD_GAME_MS = 12 * 60 * 60 * 1000;   // hard cap: a game older than this is gone
const STALE_HINT_MS = 5 * 60 * 1000;        // reported to the UI, never acted on here
const AUDIT_KEEP_MS = 30 * 24 * 60 * 60 * 1000;

/** Domains the app can patch independently, so two phones don't clobber each other. */
const DOMAIN_FIELDS = {
  setup:  ["opponent", "homeAway", "present", "availability", "snackPlayer", "goaliePlan", "planBuilt", "skill"],
  lineup: ["lineup", "selectedBench", "suggestedSub", "nextSubAt", "subDone", "coverLocks", "lastSubDesc", "lastSubAt"],
  score:  ["goals", "ourScore", "theirScore", "goalLog"],
  clock:  ["elapsed", "quarter", "running", "ended", "timerOwnerId", "clockStartedAt",
           "clockAnchorElapsed", "awaitingQuarterTransition", "testSpeed"],
  stats:  ["play", "gk", "posPlay"]
};
/** Always carried, whatever changed. */
const ALWAYS_FIELDS = ["soundEnabled"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (!env.DB) {
      return json({ ok: false, error: "D1 binding 'DB' is missing from this Worker" }, 503, NO_STORE);
    }

    const ready = await ensureSchema(env);
    if (!ready) {
      return json({ ok: false, error: "D1 unavailable" }, 503, NO_STORE);
    }

    try {
      return await route(request, env, url);
    } catch (err) {
      return json({ error: "Server error", detail: String(err && err.message || err) }, 500, NO_STORE);
    }
  }
};

async function route(request, env, url) {
  const path = request.method + " " + url.pathname;
  const method = request.method;

  // ---------------------------------------------------------------- health
  if (path === "GET /api/health") {
    const row = await env.DB.prepare("SELECT 1 AS ok").first();
    return json({ ok: !!row, ts: Date.now() }, 200, NO_STORE);
  }

  // ----------------------------------------------------------- active game
  if (path === "GET /api/active") return getActiveGame(env);

  if (path === "DELETE /api/active") {
    await env.DB.prepare("DELETE FROM active_game WHERE team=?").bind(ACTIVE_TEAM).run();
    return json({ ok: true });
  }

  if (method === "DELETE" && url.pathname.startsWith("/api/active/")) {
    const code = tailSegment(url.pathname);
    if (!CODE_RE.test(code)) return json({ error: "Invalid game code" }, 400);
    await env.DB.prepare("DELETE FROM active_game WHERE team=? AND code=?")
      .bind(ACTIVE_TEAM, code).run();
    return json({ ok: true });
  }

  // --------------------------------------------------------- season history
  if (path === "GET /api/history") {
    const rows = await env.DB.prepare(
      "SELECT game_json FROM game_history ORDER BY played_at ASC"
    ).all();
    const games = [];
    for (const r of rows.results || []) {
      try { games.push(JSON.parse(r.game_json)); } catch { /* skip one bad row, keep the rest */ }
    }
    return json({ games }, 200, NO_STORE);
  }

  if (path === "POST /api/history") {
    const game = await readJson(request);
    if (!game) return json({ error: "Invalid JSON" }, 400);
    if (!game.id || typeof game.id !== "string" || game.id.length > 120) {
      return json({ error: "Missing or invalid game id" }, 400);
    }
    const body = JSON.stringify(game);
    if (body.length > MAX_STATE_BYTES) return json({ error: "Game record too large" }, 413);

    await env.DB.prepare(`
      INSERT INTO game_history (id, played_at, game_json) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        played_at = excluded.played_at,
        game_json = excluded.game_json
    `).bind(game.id, Date.parse(game.date) || Date.now(), body).run();

    return json({ ok: true });
  }

  if (path === "DELETE /api/history") {
    // Guard rail: the season is the one thing here that cannot be rebuilt.
    if (url.searchParams.get("confirm") !== "DELETE-ALL") {
      return json({ error: "Refusing to wipe history without ?confirm=DELETE-ALL" }, 400);
    }
    await env.DB.prepare("DELETE FROM game_history").run();
    return json({ ok: true });
  }

  if (method === "DELETE" && url.pathname.startsWith("/api/history/")) {
    const id = decodeURIComponent(tailSegment(url.pathname, false));
    if (!id) return json({ error: "Missing game id" }, 400);
    await env.DB.prepare("DELETE FROM game_history WHERE id=?").bind(id).run();
    return json({ ok: true });
  }

  // ------------------------------------------------------------- audit feed
  if (url.pathname.startsWith("/api/audit/")) {
    const code = tailSegment(url.pathname);
    if (!CODE_RE.test(code)) return json({ error: "Invalid game code" }, 400);

    if (method === "GET") {
      const rows = await env.DB.prepare(`
        SELECT action, detail, quarter, elapsed, client_id, created_at
        FROM game_audit WHERE code=?
        ORDER BY created_at DESC, id DESC
        LIMIT 150
      `).bind(code).all();
      return json({ entries: rows.results || [] }, 200, NO_STORE);
    }

    if (method === "POST") {
      const body = await readJson(request);
      if (!body) return json({ error: "Invalid JSON" }, 400);

      await env.DB.prepare(`
        INSERT INTO game_audit (code, action, detail, quarter, elapsed, client_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        code,
        String(body.action || "Activity").slice(0, 80),
        String(body.detail || "").slice(0, 300),
        Number(body.quarter) || 1,
        Number(body.elapsed) || 0,
        String(body.clientId || "").slice(0, 80),
        Date.now()
      ).run();

      // Housekeeping rides along with audit writes only — never on reads.
      if (Math.random() < 0.05) {
        try {
          await env.DB.prepare("DELETE FROM game_audit WHERE created_at < ?")
            .bind(Date.now() - AUDIT_KEEP_MS).run();
        } catch { /* best effort */ }
      }
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  }

  // -------------------------------------------------- authoritative plan commit
  // The pregame goalie plan and the starting lineup are written in ONE update so
  // no poll or merge can land between them and split the two apart.
  if (method === "PUT" && url.pathname.startsWith("/api/plan/")) {
    const code = tailSegment(url.pathname);
    if (!CODE_RE.test(code)) return json({ error: "Invalid game code" }, 400);

    const body = await readJson(request);
    if (!body) return json({ error: "Invalid JSON" }, 400);

    const db = session(env);
    const existing = await db.prepare("SELECT state, version FROM game_state WHERE code=?")
      .bind(code).first();
    if (!existing) return json({ error: "Game not found" }, 404);

    const current = JSON.parse(existing.state);
    const merged = {
      ...current,
      opponent:     pick(body.opponent, current.opponent),
      homeAway:     pick(body.homeAway, current.homeAway),
      present:      pick(body.present, current.present),
      availability: pick(body.availability, current.availability),
      snackPlayer:  pick(body.snackPlayer, current.snackPlayer),
      goaliePlan:   Array.isArray(body.goaliePlan) ? body.goaliePlan : current.goaliePlan,
      lineup:       pick(body.lineup, current.lineup),
      planBuilt:    body.planBuilt ?? true,
      nextSubAt:    pick(body.nextSubAt, current.nextSubAt),
      subDone:      Array.isArray(body.subDone) ? body.subDone : current.subDone
    };

    // The invariant the whole goalie saga was about: Q1's planned goalie IS the
    // goalie on the field. Enforced here as well as in the app.
    if (merged.goaliePlan?.[0] && merged.lineup) merged.lineup.GK = merged.goaliePlan[0];

    const version = Number(existing.version || 0) + 1;
    const now = Date.now();
    merged.syncVersion = version;
    merged.lastCloudUpdate = now;
    delete merged.shareRole;

    await db.prepare("UPDATE game_state SET state=?, version=?, updated_at=? WHERE code=?")
      .bind(JSON.stringify(merged), version, now, code).run();

    return json(merged, 200, NO_STORE);
  }

  // ------------------------------------------------------------- live game
  if (url.pathname.startsWith("/api/game/")) {
    const code = tailSegment(url.pathname);
    if (!CODE_RE.test(code)) return json({ error: "Invalid game code" }, 400);

    if (method === "DELETE") {
      await env.DB.prepare("DELETE FROM active_game WHERE team=? AND code=?")
        .bind(ACTIVE_TEAM, code).run();
      await env.DB.prepare("DELETE FROM game_state WHERE code=?").bind(code).run();
      return json({ ok: true });
    }

    if (method === "GET") {
      const row = await session(env)
        .prepare("SELECT state, version, updated_at FROM game_state WHERE code=?")
        .bind(code).first();
      if (!row) return json({ error: "Game not found" }, 404);

      const state = JSON.parse(row.state);
      state.syncVersion = Number(row.version || 0);
      state.lastCloudUpdate = Number(row.updated_at || 0);
      return json(state, 200, NO_STORE);
    }

    if (method === "PUT") return putGameState(request, env, code);

    return json({ error: "Method not allowed" }, 405);
  }

  return json({ error: "Unknown API endpoint", path: url.pathname }, 404, NO_STORE);
}

/* ------------------------------------------------------------------ handlers */

async function getActiveGame(env) {
  const row = await env.DB.prepare(`
    SELECT a.code, g.state, g.version, g.updated_at
    FROM active_game a
    JOIN game_state g ON g.code = a.code
    WHERE a.team = ?
    LIMIT 1
  `).bind(ACTIVE_TEAM).first();

  if (!row) return json({ error: "No active game" }, 404, NO_STORE);

  const s = JSON.parse(row.state);
  const ageMs = Math.max(0, Date.now() - Number(row.updated_at || 0));

  // Only two reasons to drop the active row. "Nobody has tapped anything for a
  // while" is NOT one of them: a paused game is a completely normal state
  // during setup, halftime, or whenever a phone's screen locks.
  if (s.ended === true || ageMs > DEAD_GAME_MS) {
    await env.DB.prepare("DELETE FROM active_game WHERE team=? AND code=?")
      .bind(ACTIVE_TEAM, row.code).run();
    return json({ error: "No active game" }, 404, NO_STORE);
  }

  return json({
    code: row.code,
    opponent: s.opponent,
    quarter: s.quarter,
    elapsed: effectiveElapsed(s),
    running: s.running,
    ended: s.ended,
    ourScore: s.ourScore,
    theirScore: s.theirScore,
    updated_at: row.updated_at,
    ageSec: Math.floor(ageMs / 1000),
    stale: ageMs > STALE_HINT_MS
  }, 200, NO_STORE);
}

async function putGameState(request, env, code) {
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const incoming = body.state || body;
  const changed = Array.isArray(body.changedDomains) ? body.changedDomains : ["all"];
  const activate = body.activate === true;

  if (JSON.stringify(incoming).length > MAX_STATE_BYTES) {
    return json({ error: "State too large" }, 413);
  }

  // Compare-and-swap on the row version. Five attempts is plenty for two phones.
  for (let attempt = 0; attempt < 5; attempt++) {
    const db = session(env);   // same session for the read and the write below
    const existing = await db.prepare("SELECT state, version FROM game_state WHERE code=?")
      .bind(code).first();
    const now = Date.now();

    if (!existing) {
      const initial = structuredClone(incoming);
      initial.syncVersion = 1;
      initial.lastCloudUpdate = now;
      delete initial.shareRole;

      const ins = await db.prepare(`
        INSERT OR IGNORE INTO game_state (code, state, version, updated_at) VALUES (?,?,?,?)
      `).bind(code, JSON.stringify(initial), 1, now).run();

      if (Number(ins?.meta?.changes || 0) === 1) {
        if (activate && !initial.ended) await setActiveGame(env, code);
        return json({ ok: true, syncVersion: 1 }, 200, NO_STORE);
      }
      continue;   // somebody else inserted first — re-read and merge
    }

    const merged = mergeState(JSON.parse(existing.state), incoming, changed);
    const oldVersion = Number(existing.version || 0);
    const version = oldVersion + 1;
    merged.syncVersion = version;
    merged.lastCloudUpdate = now;
    delete merged.shareRole;

    const upd = await db.prepare(`
      UPDATE game_state SET state=?, version=?, updated_at=? WHERE code=? AND version=?
    `).bind(JSON.stringify(merged), version, now, code, oldVersion).run();

    if (Number(upd?.meta?.changes || 0) === 1) {
      if (activate && !merged.ended) await setActiveGame(env, code);
      return json({ ok: true, syncVersion: version }, 200, NO_STORE);
    }
  }

  return json({ error: "Concurrent update conflict; please retry" }, 409, NO_STORE);
}

/* ------------------------------------------------------------------- helpers */

/**
 * Apply only the domains the calling phone actually changed. This is what stops
 * coach B's substitution from overwriting coach A's official clock.
 */
function mergeState(current, incoming, changed) {
  if (changed.includes("all")) return structuredClone(incoming);

  const merged = { ...current };
  const copy = (fields) => {
    for (const k of fields) {
      if (Object.prototype.hasOwnProperty.call(incoming, k)) {
        merged[k] = structuredClone(incoming[k]);
      }
    }
  };
  for (const domain of changed) {
    if (DOMAIN_FIELDS[domain]) copy(DOMAIN_FIELDS[domain]);
  }
  copy(ALWAYS_FIELDS);
  return merged;
}

/**
 * A D1 session gives read-your-own-writes across the read/write pair in one
 * request. It only helps if the SAME object is used for both, which is why this
 * is handed around instead of reaching for env.DB.
 */
function session(env) {
  return typeof env.DB.withSession === "function"
    ? env.DB.withSession("first-primary")
    : env.DB;
}

async function setActiveGame(env, code) {
  await env.DB.prepare(`
    INSERT INTO active_game (team, code, updated_at) VALUES (?,?,?)
    ON CONFLICT(team) DO UPDATE SET code=excluded.code, updated_at=excluded.updated_at
  `).bind(ACTIVE_TEAM, code, Date.now()).run();
}

/** What the clock would read right now, for a phone that is only observing. */
function effectiveElapsed(s) {
  if (s?.running && s?.clockStartedAt) {
    const rate = Math.max(1, Number(s.testSpeed) || 1);
    const run = Math.max(0, (Date.now() - Number(s.clockStartedAt)) / 1000) * rate;
    return Math.min(2880, Number(s.clockAnchorElapsed ?? s.elapsed ?? 0) + run);
  }
  return Number(s?.elapsed) || 0;
}

function tailSegment(pathname, upper = true) {
  const seg = pathname.split("/").filter(Boolean).pop() || "";
  return upper ? seg.toUpperCase() : seg;
}

function pick(value, fallback) {
  return value ?? fallback;
}

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

const NO_STORE = { "cache-control": "no-store" };

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers }
  });
}

/* -------------------------------------------------------------------- schema */

/**
 * Created once per database per isolate, not once per request. Returns false
 * (rather than throwing) so a D1 outage produces a clean 503 the app can
 * display instead of a Cloudflare error page on every endpoint.
 *
 * Keyed off the binding itself rather than a module-level flag: correct if a
 * Worker ever sees more than one database, and it keeps the local test suite
 * honest instead of letting one run's schema satisfy the next.
 */
const schemaInFlight = new WeakMap();

function ensureSchema(env) {
  let p = schemaInFlight.get(env.DB);
  if (!p) {
    p = createSchema(env).catch(() => {
      schemaInFlight.delete(env.DB);   // allow a later request to retry
      return false;
    });
    schemaInFlight.set(env.DB, p);
  }
  return p;
}

async function createSchema(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS game_state (
      code TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS active_game (
      team TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS game_history (
      id TEXT PRIMARY KEY,
      played_at INTEGER NOT NULL,
      game_json TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS game_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      quarter INTEGER NOT NULL DEFAULT 1,
      elapsed REAL NOT NULL DEFAULT 0,
      client_id TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_audit_code_time
      ON game_audit (code, created_at DESC)`)
  ]);
  return true;
}
