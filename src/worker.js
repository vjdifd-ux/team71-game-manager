export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/game/")) {
      if (!env.DB) return json({error:"D1 binding DB is not configured"}, 503);
      const code = url.pathname.split("/").pop().toUpperCase();
      if (!/^[A-Z0-9]{4,10}$/.test(code)) return json({error:"Invalid game code"},400);
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS game_state (code TEXT PRIMARY KEY, state TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)`).run();
      if (request.method === "GET") {
        const db = typeof env.DB.withSession === "function" ? env.DB.withSession("first-primary") : env.DB;
        const row = await db.prepare("SELECT state, version, updated_at FROM game_state WHERE code = ?").bind(code).first();
        if (!row) return json({error:"Game not found"},404);
        const state = JSON.parse(row.state); state.syncVersion=Number(row.version||0); state.lastCloudUpdate=Number(row.updated_at||0);
        return json(state,200,{"cache-control":"no-store"});
      }
      if (request.method === "PUT") {
        let body; try { body=await request.json(); } catch { return json({error:"Invalid JSON"},400); }
        const raw=JSON.stringify(body); if(raw.length>100000) return json({error:"State too large"},413);
        const db = typeof env.DB.withSession === "function" ? env.DB.withSession("first-primary") : env.DB;
        const existing=await db.prepare("SELECT version FROM game_state WHERE code = ?").bind(code).first();
        const nextVersion=Math.max(Number(body.syncVersion||0),Number(existing?.version||0)+1); const now=Date.now();
        body.syncVersion=nextVersion; body.lastCloudUpdate=now;
        await db.prepare(`INSERT INTO game_state (code,state,version,updated_at) VALUES (?,?,?,?) ON CONFLICT(code) DO UPDATE SET state=excluded.state, version=excluded.version, updated_at=excluded.updated_at`).bind(code,JSON.stringify(body),nextVersion,now).run();
        return json({ok:true,syncVersion:nextVersion});
      }
      return json({error:"Method not allowed"},405);
    }
    return env.ASSETS.fetch(request);
  }
};
function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8",...headers}})}
