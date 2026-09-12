export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/game/")) {
      if (!env.DB) return json({error:"D1 binding DB is not configured"}, 503);

      const code = url.pathname.split("/").pop().toUpperCase();
      if (!/^[A-Z0-9]{4,10}$/.test(code)) {
        return json({error:"Invalid game code"},400);
      }

      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS game_state (
        code TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      )`).run();

      if (request.method === "GET") {
        const db = typeof env.DB.withSession === "function"
          ? env.DB.withSession("first-primary")
          : env.DB;

        const row = await db.prepare(
          "SELECT state, version, updated_at FROM game_state WHERE code = ?"
        ).bind(code).first();

        if (!row) return json({error:"Game not found"},404);

        const state = JSON.parse(row.state);
        state.syncVersion = Number(row.version || 0);
        state.lastCloudUpdate = Number(row.updated_at || 0);

        return json(state,200,{"cache-control":"no-store"});
      }

      if (request.method === "PUT") {
        let body;
        try { body = await request.json(); }
        catch { return json({error:"Invalid JSON"},400); }

        const incoming = body?.state || body;
        const changed = Array.isArray(body?.changedDomains)
          ? body.changedDomains
          : ["all"];

        const raw = JSON.stringify(incoming);
        if (raw.length > 120000) {
          return json({error:"State too large"},413);
        }

        // Optimistic concurrency retry loop. This prevents two coaches making
        // near-simultaneous changes (for example, a goal and a substitution)
        // from silently overwriting each other.
        for (let attempt=0; attempt<5; attempt++) {
          const db = typeof env.DB.withSession === "function"
            ? env.DB.withSession("first-primary")
            : env.DB;

          const existing = await db.prepare(
            "SELECT state, version FROM game_state WHERE code = ?"
          ).bind(code).first();

          const now = Date.now();

          if (!existing) {
            const initial = structuredClone(incoming);
            initial.syncVersion = 1;
            initial.lastCloudUpdate = now;
            delete initial.shareRole;

            const ins = await env.DB.prepare(`
              INSERT OR IGNORE INTO game_state (code,state,version,updated_at)
              VALUES (?,?,?,?)
            `).bind(code,JSON.stringify(initial),1,now).run();

            if (Number(ins?.meta?.changes || 0) === 1) {
              return json({ok:true,syncVersion:1});
            }
            // Someone else created the row first. Retry and merge.
            continue;
          }

          const current = JSON.parse(existing.state);
          let merged;

          if (changed.includes("all")) {
            merged = structuredClone(incoming);
          } else {
            merged = {...current};

            const copyFields = (fields) => {
              for (const k of fields) {
                if (Object.prototype.hasOwnProperty.call(incoming,k)) {
                  merged[k] = structuredClone(incoming[k]);
                }
              }
            };

            if (changed.includes("setup")) {
              copyFields([
                "opponent","homeAway","present","availability",
                "gkPref","goaliePlan","planBuilt"
              ]);
            }

            if (changed.includes("lineup")) {
              copyFields([
                "lineup","selectedBench","suggestedSub",
                "nextSubAt","subDone"
              ]);
            }

            if (changed.includes("score")) {
              copyFields(["goals","ourScore","theirScore","goalLog"]);
            }

            if (changed.includes("clock")) {
              copyFields([
                "elapsed","quarter","running","ended",
                "timerOwnerId","clockStartedAt"
              ]);
            }

            if (changed.includes("stats")) {
              copyFields(["play","gk"]);
            }

            copyFields(["soundEnabled"]);
          }

          const oldVersion = Number(existing.version || 0);
          const nextVersion = oldVersion + 1;

          merged.syncVersion = nextVersion;
          merged.lastCloudUpdate = now;
          delete merged.shareRole;

          const upd = await env.DB.prepare(`
            UPDATE game_state
            SET state = ?, version = ?, updated_at = ?
            WHERE code = ? AND version = ?
          `).bind(
            JSON.stringify(merged),
            nextVersion,
            now,
            code,
            oldVersion
          ).run();

          if (Number(upd?.meta?.changes || 0) === 1) {
            return json({ok:true,syncVersion:nextVersion});
          }

          // Version changed between SELECT and UPDATE; loop and merge again.
        }

        return json({error:"Concurrent update conflict; please retry"},409);
      }

      return json({error:"Method not allowed"},405);
    }

    return env.ASSETS.fetch(request);
  }
};

function json(data,status=200,headers={}){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "content-type":"application/json; charset=utf-8",
      ...headers
    }
  });
}