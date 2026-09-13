// Minimal D1 stand-in backed by node:sqlite, so src/worker.js can be exercised
// unmodified. Supports prepare/bind/first/all/run, batch, and withSession.
import { DatabaseSync } from "node:sqlite";

class Stmt {
  constructor(db, sql, args = []) {
    this.db = db;
    this.sql = sql;
    this.args = args;
  }
  bind(...args) {
    return new Stmt(this.db, this.sql, args);
  }
  #norm(v) {
    if (v === undefined || v === null) return null;
    if (typeof v === "boolean") return v ? 1 : 0;
    return v;
  }
  #prep() {
    return this.db.prepare(this.sql);
  }
  async first() {
    const rows = this.#prep().all(...this.args.map((a) => this.#norm(a)));
    return rows.length ? rows[0] : null;
  }
  async all() {
    return { results: this.#prep().all(...this.args.map((a) => this.#norm(a))) };
  }
  async run() {
    const r = this.#prep().run(...this.args.map((a) => this.#norm(a)));
    return { meta: { changes: Number(r.changes || 0) }, success: true };
  }
}

export class FakeD1 {
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.sessions = 0;
    this.queries = 0;
  }
  prepare(sql) {
    this.queries++;
    return new Stmt(this.db, sql);
  }
  async batch(stmts) {
    const out = [];
    for (const s of stmts) out.push(await s.run());
    return out;
  }
  withSession() {
    this.sessions++;
    return this;
  }
  close() {
    this.db.close();
  }
}

export function makeEnv(assetBody = "<html>app</html>") {
  const DB = new FakeD1();
  return {
    DB,
    ASSETS: {
      fetch: async () =>
        new Response(assetBody, { status: 200, headers: { "content-type": "text/html" } })
    }
  };
}

export const req = (path, init = {}) => {
  const { body, ...rest } = init;
  return new Request("https://team71.test" + path, {
    ...rest,
    ...(body === undefined
      ? {}
      : { body: typeof body === "string" ? body : JSON.stringify(body) })
  });
};
