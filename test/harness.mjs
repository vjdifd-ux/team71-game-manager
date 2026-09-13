// Loads public/index.html in jsdom, wires window.fetch to the real Worker code
// (over the node:sqlite D1 shim), and hands back a controllable virtual clock.
// Tests drive the app the way a coach does: clicking buttons and changing
// selects, then reading the DOM and localStorage back.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../src/worker.js";
import { makeEnv } from "./d1-shim.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_HTML = path.join(HERE, "../public/index.html");

/**
 * The build that was actually live on the Worker, kept as a fixture so the
 * regression tests can demonstrate the old behaviour and the fix in the same
 * run. Do not edit it.
 */
export const V21_HTML = path.join(HERE, "fixtures/v21-shipped-index.html");
const ROSTER = [
  "Shalom Amaya", "Olivia Carpenter", "Norah Dineen", "Kennedy Kozlosky",
  "Juliette Maglio", "Luna Scrivano", "Serafina Sinagra", "Aria Stagnitta"
];
const STATE_KEY = "team71-v5-current";

export const roster = ROSTER;

/** Shared backend: pass the same one to two phones to test a shared game. */
export function makeBackend() {
  return makeEnv();
}

export async function openApp({
  backend = makeBackend(),
  now = 1780000000000,
  seedState = null,
  seedHistory = null,
  html = APP_HTML
} = {}) {
  const HTML = fs.readFileSync(html, "utf8");
  let virtualNow = now;
  const intervals = [];
  const requests = [];

  const dom = new JSDOM(HTML, {
    url: "https://team71.test/",
    runScripts: "dangerously",
    pretendToBeVisual: false,
    beforeParse(win) {
      // ---- controllable clock -------------------------------------------
      const RealDate = win.Date;
      win.Date = class extends RealDate {
        constructor(...args) {
          super(...(args.length ? args : [virtualNow]));
        }
        static now() { return virtualNow; }
      };

      // ---- timers we drive by hand --------------------------------------
      win.setInterval = (fn, delay) => {
        const id = intervals.length + 1;
        intervals.push({ id, fn, delay });
        return id;
      };
      win.clearInterval = (id) => {
        const i = intervals.findIndex((x) => x.id === id);
        if (i >= 0) intervals.splice(i, 1);
      };

      // ---- fetch straight into the Worker -------------------------------
      win.fetch = async (url, init = {}) => {
        const full = String(url).startsWith("http") ? String(url) : "https://team71.test" + url;
        requests.push((init.method || "GET") + " " + full.replace("https://team71.test", ""));
        const req = new Request(full, {
          method: init.method || "GET",
          headers: init.headers,
          body: init.body
        });
        return worker.fetch(req, backend);
      };

      // ---- browser bits jsdom lacks -------------------------------------
      win.confirm = () => true;
      win.alert = () => {};
      win.URL.createObjectURL = () => "blob:mock-url";
      win.URL.revokeObjectURL = () => {};
      let hidden = false;
      Object.defineProperty(win.document, "hidden", { get: () => hidden, configurable: true });
      win.__setHidden = (v) => {
        hidden = v;
        win.document.dispatchEvent(new win.Event("visibilitychange"));
      };

      if (seedState) win.localStorage.setItem(STATE_KEY, JSON.stringify(seedState));
      if (seedHistory) win.localStorage.setItem("team71-v5-history", JSON.stringify(seedHistory));
    }
  });

  const win = dom.window;
  const doc = win.document;
  const $ = (id) => doc.getElementById(id);

  const flush = async (turns = 6) => {
    for (let i = 0; i < turns; i++) await new Promise((r) => setTimeout(r, 0));
  };

  /** Run the recorded interval callbacks (optionally only those at one delay). */
  const pump = async (delay = null) => {
    for (const t of [...intervals]) {
      if (delay === null || t.delay === delay) {
        try { t.fn(); } catch (e) { /* surfaced by the assertions instead */ }
      }
    }
    await flush();
  };

  const fire = (el, type = "change") => {
    el.dispatchEvent(new win.Event(type, { bubbles: true }));
  };

  const rows = () => [...doc.querySelectorAll("#setupPlayers .player-row")];

  const api = {
    dom, win, doc, $, backend, flush, pump, requests, intervals,

    /**
     * The app's live state. It only writes to localStorage on an action, so
     * nudge the sound toggle first — its handler calls save() and sets the value
     * it already had, which is harmless. Without this, reads on a seeded run
     * would return the seed rather than what the app actually did with it.
     */
    state: () => {
      $("soundToggle").dispatchEvent(new win.Event("change", { bubbles: true }));
      return JSON.parse(win.localStorage.getItem(STATE_KEY));
    },

    /** What is actually on disk right now, with no nudge. */
    persisted: () => JSON.parse(win.localStorage.getItem(STATE_KEY) || "null"),

    advance(seconds) { virtualNow += seconds * 1000; },
    now: () => virtualNow,

    text: (id) => ($(id) ? $(id).textContent.trim() : null),

    async click(id) { $(id).click(); await flush(); },

    async setHidden(v) { win.__setHidden(v); await flush(); },

    /** Pregame: choose the goalie for a quarter (0-indexed). */
    async setGoalie(q, name) {
      const sel = doc.querySelectorAll("#goaliePlanner .goalie-q select")[q];
      sel.value = name;
      fire(sel);
      await flush();
    },

    /** Pregame roster: attendance checkbox. */
    async setPresent(name, present) {
      const box = rows()[ROSTER.indexOf(name)].querySelector("input[type=checkbox]");
      box.checked = present;
      fire(box);
      await flush();
    },

    /** Pregame roster: availability dropdown ("available"|"rest"|"out"). */
    async setAvailPregame(name, value) {
      const sel = rows()[ROSTER.indexOf(name)].querySelectorAll("select")[0];
      sel.value = value;
      fire(sel);
      await flush();
    },

    /** Pregame: who has snack today (defaults to the Q4 goalie). */
    async setSnack(name) {
      const sel = $("snackPlayer");
      sel.value = name;
      fire(sel);
      await flush();
    },

    /** In-game Player Status buttons. */
    async setAvailInGame(name, label) {
      const row = [...doc.querySelectorAll("#statusPlayers .row")]
        .find((r) => r.textContent.includes(name));
      const btn = [...row.querySelectorAll("button")].find((b) => b.textContent === label);
      btn.click();
      await flush();
    },

    /** Names currently offered in the "who's going in?" replacement picker, in order. */
    replaceOptions() {
      return [...doc.querySelectorAll("#replaceOptions .replace-btn")]
        .map((b) => b.dataset.name);
    },

    replaceModalOpen() {
      return $("replaceModal").classList.contains("show");
    },

    /** Tap a candidate's button in the "who's going in?" replacement picker. */
    async confirmReplacement(name) {
      const btn = [...doc.querySelectorAll("#replaceOptions .replace-btn")]
        .find((b) => b.dataset.name === name);
      btn.click();
      await flush();
    },

    async dismissReplacement() {
      $("replaceLaterBtn").click();
      await flush();
    },

    /** Tap a bench player, then a field position, to make a manual sub. */
    async manualSub(incoming, slot) {
      const btn = [...doc.querySelectorAll("#benchSide .bench-btn")]
        .find((b) => b.textContent.includes(incoming));
      btn.click();
      await flush();
      $({ GK: "posGK", LB: "posLB", RB: "posRB", M: "posM", F: "posF" }[slot]).click();
      await flush();
    },

    async scoreGoal(name) {
      const short = name.split(" ")[0];
      const btn = [...doc.querySelectorAll("#goalScorers button")]
        .find((b) => b.textContent.includes(short));
      btn.click();
      await flush();
    },

    onField() {
      const s = api.state();
      return ["GK", "LB", "RB", "M", "F"].map((k) => s.lineup[k]);
    },

    goalieStrip() {
      return [...doc.querySelectorAll("#gameGoalieStrip .gname")].map((d) => d.textContent.trim());
    },

    history: () => JSON.parse(win.localStorage.getItem("team71-v5-history") || "[]"),

    close() { dom.window.close(); }
  };

  await flush(10);
  return api;
}
