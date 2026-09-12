export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    await ensureSchema(env);

    // ACTIVE GAME DISCOVERY
    if (url.pathname === "/api/active" && request.method === "GET") {
      const row = await env.DB.prepare(`
        SELECT a.code, g.state, g.version, g.updated_at
        FROM active_game a
        JOIN game_state g ON g.code = a.code
        WHERE a.team = 'team71'
        LIMIT 1
      `).first();

      if (!row) return json({error:"No active game"},404);

      const s=JSON.parse(row.state);
      return json({
        code:row.code,
        opponent:s.opponent,
        quarter:s.quarter,
        elapsed:effectiveElapsed(s),
        running:s.running,
        ourScore:s.ourScore,
        theirScore:s.theirScore,
        updated_at:row.updated_at
      },200,{"cache-control":"no-store"});
    }

    if (url.pathname.startsWith("/api/active/") && request.method === "DELETE") {
      const code=url.pathname.split("/").pop().toUpperCase();
      await env.DB.prepare("DELETE FROM active_game WHERE team='team71' AND code=?").bind(code).run();
      return json({ok:true});
    }

    // SHARED HISTORY
    if (url.pathname === "/api/history" && request.method === "GET") {
      const rows=await env.DB.prepare(`
        SELECT id, game_json
        FROM game_history
        ORDER BY played_at ASC
      `).all();

      return json({
        games:(rows.results||[]).map(r=>JSON.parse(r.game_json))
      },200,{"cache-control":"no-store"});
    }

    if (url.pathname === "/api/history" && request.method === "POST") {
      let game;
      try{game=await request.json()}catch{return json({error:"Invalid JSON"},400)}
      if(!game?.id) return json({error:"Missing game id"},400);

      const playedAt=Date.parse(game.date)||Date.now();
      await env.DB.prepare(`
        INSERT INTO game_history (id, played_at, game_json)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          played_at=excluded.played_at,
          game_json=excluded.game_json
      `).bind(game.id,playedAt,JSON.stringify(game)).run();

      return json({ok:true});
    }

    if (url.pathname === "/api/history" && request.method === "DELETE") {
      await env.DB.prepare("DELETE FROM game_history").run();
      return json({ok:true});
    }

    if (url.pathname.startsWith("/api/history/") && request.method === "DELETE") {
      const id=decodeURIComponent(url.pathname.split("/").pop());
      await env.DB.prepare("DELETE FROM game_history WHERE id=?").bind(id).run();
      return json({ok:true});
    }

    // LIVE GAME
    if (url.pathname.startsWith("/api/game/")) {
      const code = url.pathname.split("/").pop().toUpperCase();
      if (!/^[A-Z0-9]{4,10}$/.test(code)) {
        return json({error:"Invalid game code"},400);
      }

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
        try { body=await request.json(); }
        catch { return json({error:"Invalid JSON"},400); }

        const incoming = body?.state || body;
        const changed = Array.isArray(body?.changedDomains)
          ? body.changedDomains
          : ["all"];

        const raw = JSON.stringify(incoming);
        if (raw.length > 120000) return json({error:"State too large"},413);

        for (let attempt=0; attempt<5; attempt++) {
          const db = typeof env.DB.withSession === "function"
            ? env.DB.withSession("first-primary")
            : env.DB;

          const existing = await db.prepare(
            "SELECT state, version FROM game_state WHERE code = ?"
          ).bind(code).first();

          const now = Date.now();

          if (!existing) {
            const initial=structuredClone(incoming);
            initial.syncVersion=1;
            initial.lastCloudUpdate=now;
            delete initial.shareRole;

            const ins=await env.DB.prepare(`
              INSERT OR IGNORE INTO game_state (code,state,version,updated_at)
              VALUES (?,?,?,?)
            `).bind(code,JSON.stringify(initial),1,now).run();

            if(Number(ins?.meta?.changes||0)===1){
              await setActiveGame(env,code);
              return json({ok:true,syncVersion:1});
            }
            continue;
          }

          const current=JSON.parse(existing.state);
          let merged;

          if(changed.includes("all")){
            merged=structuredClone(incoming);
          }else{
            merged={...current};

            const copyFields=(fields)=>{
              for(const k of fields){
                if(Object.prototype.hasOwnProperty.call(incoming,k)){
                  merged[k]=structuredClone(incoming[k]);
                }
              }
            };

            if(changed.includes("setup")){
              copyFields(["opponent","homeAway","present","availability","gkPref","goaliePlan","planBuilt"]);
            }
            if(changed.includes("lineup")){
              copyFields(["lineup","selectedBench","suggestedSub","nextSubAt","subDone"]);
            }
            if(changed.includes("score")){
              copyFields(["goals","ourScore","theirScore","goalLog"]);
            }
            if(changed.includes("clock")){
              copyFields(["elapsed","quarter","running","ended","timerOwnerId","clockStartedAt"]);
            }
            if(changed.includes("stats")){
              copyFields(["play","gk"]);
            }
            copyFields(["soundEnabled"]);
          }

          const oldVersion=Number(existing.version||0);
          const nextVersion=oldVersion+1;
          merged.syncVersion=nextVersion;
          merged.lastCloudUpdate=now;
          delete merged.shareRole;

          const upd=await env.DB.prepare(`
            UPDATE game_state
            SET state=?, version=?, updated_at=?
            WHERE code=? AND version=?
          `).bind(JSON.stringify(merged),nextVersion,now,code,oldVersion).run();

          if(Number(upd?.meta?.changes||0)===1){
            if(!merged.ended) await setActiveGame(env,code);
            return json({ok:true,syncVersion:nextVersion});
          }
        }

        return json({error:"Concurrent update conflict; please retry"},409);
      }

      return json({error:"Method not allowed"},405);
    }

    return env.ASSETS.fetch(request);
  }
};

async function ensureSchema(env){
  if(!env.DB) return;

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS game_state (
    code TEXT PRIMARY KEY,
    state TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS active_game (
    team TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS game_history (
    id TEXT PRIMARY KEY,
    played_at INTEGER NOT NULL,
    game_json TEXT NOT NULL
  )`).run();
}

async function setActiveGame(env,code){
  await env.DB.prepare(`
    INSERT INTO active_game (team,code,updated_at)
    VALUES ('team71',?,?)
    ON CONFLICT(team) DO UPDATE SET
      code=excluded.code,
      updated_at=excluded.updated_at
  `).bind(code,Date.now()).run();
}

function effectiveElapsed(s){
  if(s?.running && s?.clockStartedAt){
    return Math.min(2880,Number(s.elapsed||0)+Math.max(0,(Date.now()-Number(s.clockStartedAt))/1000));
  }
  return Number(s?.elapsed||0);
}

function json(data,status=200,headers={}){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "content-type":"application/json; charset=utf-8",
      ...headers
    }
  });
}