// Likely automated visits get no Telegram message (api/_lib/visitBots.ts, visitRecord.ts,
// supabase/migrations/0012_visit_burst.sql). Run with `npm test`: the api/ code is
// compiled to .test-build/, the SQL runs on a real Postgres (PGlite), and Telegram and
// the Supabase REST API are replaced by fakes that route the calls to that database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { botReason, isDataCenterTown } from "../.test-build/_lib/visitBots.js";
import { recordVisit } from "../.test-build/_lib/visitRecord.js";

const migration = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

async function database({ withBurst = true } = {}) {
  const db = new PGlite();
  await db.exec("create role anon; create role authenticated; create table public.listings (id int);");
  await db.exec(migration("0002_visitor_events.sql"));
  await db.exec(migration("0004_visitor_alerts.sql"));
  if (withBurst) await db.exec(migration("0012_visit_burst.sql"));
  return db;
}

/** Fake Supabase REST (rpc → the PGlite function, 404 when it doesn't exist) and Telegram. */
function fakeServices(db) {
  process.env.VITE_SUPABASE_URL = "https://supabase.test";
  process.env.VITE_SUPABASE_ANON_KEY = "anon";
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_CHAT_ID = "1";
  const telegram = [];
  let nextId = 100;
  globalThis.fetch = async (url, init) => {
    url = String(url);
    const body = init?.body ? JSON.parse(init.body) : {};
    if (url.startsWith("https://supabase.test/rest/v1/rpc/")) {
      const fn = url.split("/").pop();
      const found = (await db.query("select count(*)::int as n from pg_proc where proname = $1", [fn])).rows[0].n;
      if (!found) return new Response(JSON.stringify({ code: "PGRST202" }), { status: 404 });
      const keys = Object.keys(body);
      const sql = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`;
      const result = await db.query(sql, keys.map((k) => body[k]));
      return new Response(JSON.stringify(result.rows[0].r ?? null), { status: 200 });
    }
    if (url.startsWith("https://api.telegram.org/")) {
      const method = url.split("/").pop();
      telegram.push({ method, ...body });
      return new Response(JSON.stringify({ ok: true, result: method === "sendMessage" ? { message_id: nextId++ } : true }), { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  return telegram;
}

const view = (over = {}) => ({
  sessionId: randomUUID(),
  path: "/ar/projects/marmara-haven-villa",
  locale: "ar",
  referrer: "facebook.com",
  title: "",
  landingPath: "",
  landingTitle: "",
  trail: [],
  trailSkipped: 0,
  campaign: "",
  ...over
});
const DUBAI = { country: "AE", city: "Dubai" };
const ORIGIN = "https://www.hadararealestate.com";
const quiet = { settleMs: 0 };

const events = async (db, sessionId) =>
  (await db.query("select count(*)::int as n from visitor_events where session_id = $1", [sessionId])).rows[0].n;

test("botReason: data-center towns and same-page bursts", () => {
  assert.equal(botReason({ city: "Clonee", country: "IE" }, 0), "data-center town");
  assert.equal(botReason({ city: "Luleå", country: "SE" }, 0), "data-center town");
  assert.equal(botReason({ city: "  The Dalles ", country: "US" }, 0), "data-center town");
  assert.equal(botReason({ city: "St. Ghislain", country: "BE" }, 0), "data-center town");
  assert.equal(botReason({ city: "Dubai", country: "AE" }, 2), "same-page burst");
  // Real visitors, real cities that also have data centers, a town name in another country.
  assert.equal(botReason({ city: "Dubai", country: "AE" }, 0), null);
  for (const city of ["Fort Worth", "Henrico", "Council Bluffs", "Sterling"]) {
    assert.equal(botReason({ city, country: "US" }, 0), null, city);
  }
  assert.equal(botReason({ city: "Boardman", country: "GB" }, 0), null);
  assert.equal(isDataCenterTown({ city: null, country: "US" }), false);
});

test("visit_check counts other sessions on the same page within 10 seconds (Postgres)", async () => {
  const db = await database();
  const me = randomUUID();
  const at = (session, path, seconds) =>
    db.query("insert into visitor_events (session_id, path, created_at) values ($1, $2, timestamptz '2026-09-29 10:00:00+00' + make_interval(secs => $3))", [session, path, seconds]);
  await at(me, "/p", 0);
  await at(me, "/p", 1); // my own later event: never counted
  await at(randomUUID(), "/p", -9); // 9 s before: counted
  const twice = randomUUID();
  await at(twice, "/p", 4); // same other session twice: counted once
  await at(twice, "/p", 6);
  await at(randomUUID(), "/p", 11); // 11 s after: not counted
  await at(randomUUID(), "/other", 2); // another page: not counted
  const check = async (session, path) => (await db.query("select public.visit_check($1, $2) as r", [session, path])).rows[0].r;
  assert.deepEqual(await check(me, "/p"), { others: 2, message_id: null });
  await db.query("select public.save_visitor_alert($1, 555)", [me]);
  assert.deepEqual(await check(me, "/p"), { others: 2, message_id: 555 });
  // A session with no saved page yet is measured from now: nothing around.
  assert.equal((await check(randomUUID(), "/p")).others, 0);

  // Only anon may call it; nobody reads the tables directly.
  await db.exec("set role anon");
  assert.equal((await check(me, "/p")).others, 2);
  await assert.rejects(db.query("select * from visitor_events"), /permission denied/);
  await db.exec("reset role; set role authenticated");
  await assert.rejects(db.query("select public.visit_check(gen_random_uuid(), '/p')"), /permission denied/);
  await db.close();
});

test("a real visitor still gets the alert, the edit and the 🔥 reply", async () => {
  const db = await database();
  const telegram = fakeServices(db);
  const first = view();
  await recordVisit(first, DUBAI, ORIGIN, quiet);
  assert.deepEqual(telegram.map((m) => m.method), ["sendMessage"]);
  assert.match(telegram[0].text, /زائر جديد/);
  telegram.length = 0;
  await recordVisit({ ...first, path: "/ar/contact", referrer: first.path }, DUBAI, ORIGIN, quiet);
  assert.deepEqual(telegram.map((m) => m.method), ["editMessageText", "sendMessage"]);
  assert.equal(telegram[0].message_id, 100);
  assert.match(telegram[1].text, /🔥/);
  assert.deepEqual(telegram[1].reply_parameters, { message_id: 100, allow_sending_without_reply: true });
  await db.close();
});

test("a data-center town gets nothing on Telegram, and the visit is still saved", async () => {
  const db = await database();
  const telegram = fakeServices(db);
  const bot = view();
  const clonee = { country: "IE", city: "Clonee" };
  await recordVisit(bot, clonee, ORIGIN, quiet);
  await recordVisit({ ...bot, path: "/ar/contact", referrer: bot.path }, clonee, ORIGIN, quiet);
  assert.equal(telegram.length, 0);
  assert.equal(await events(db, bot.sessionId), 2);
  await db.close();
});

test("sessions opening the same page together get nothing, the first one included", async () => {
  const db = await database();
  const telegram = fakeServices(db);
  // Three link checks arrive in the same second (Fort Worth alone would be a real city).
  const checks = [
    [view(), { country: "US", city: "Fort Worth" }],
    [view(), { country: "US", city: "Dallas" }],
    [view(), { country: "DE", city: "Frankfurt am Main" }]
  ];
  await Promise.all(checks.map(([v, geo]) => recordVisit(v, geo, ORIGIN, { settleMs: 300 })));
  assert.equal(telegram.length, 0);
  for (const [v] of checks) assert.equal(await events(db, v.sessionId), 1);
  // A later page of one of them, even the contact page: no edit and no 🔥.
  const [v, geo] = checks[0];
  await recordVisit({ ...v, path: "/ar/contact", referrer: v.path }, geo, ORIGIN, quiet);
  assert.equal(telegram.length, 0);
  await db.close();
});

test("a lone visitor from a real city with a data center (Fort Worth) is not hidden", async () => {
  const db = await database();
  const telegram = fakeServices(db);
  await recordVisit(view(), { country: "US", city: "Fort Worth" }, ORIGIN, quiet);
  assert.deepEqual(telegram.map((m) => m.method), ["sendMessage"]);
  await db.close();
});

test("a page opened while the first page is still waiting edits the alert once it exists", async () => {
  const db = await database();
  const telegram = fakeServices(db);
  const v = view();
  const firstPage = recordVisit(v, DUBAI, ORIGIN, { settleMs: 400 });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const contact = recordVisit({ ...v, path: "/ar/contact", referrer: v.path }, DUBAI, ORIGIN, { settleMs: 400 });
  await Promise.all([firstPage, contact]);
  assert.deepEqual(telegram.map((m) => m.method), ["sendMessage", "editMessageText", "sendMessage"]);
  assert.equal(telegram[1].message_id, 100);
  assert.deepEqual(telegram[2].reply_parameters, { message_id: 100, allow_sending_without_reply: true });
  await db.close();
});

test("before migration 0012 runs, alerts keep working (the burst counts as 0)", async () => {
  const db = await database({ withBurst: false });
  const telegram = fakeServices(db);
  await recordVisit(view(), DUBAI, ORIGIN, quiet);
  assert.deepEqual(telegram.map((m) => m.method), ["sendMessage"]);
  telegram.length = 0;
  await recordVisit(view(), { country: "US", city: "Boardman" }, ORIGIN, quiet);
  assert.equal(telegram.length, 0);
  await db.close();
});
