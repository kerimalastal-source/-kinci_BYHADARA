// Is it a person? Device, engagement and the morning visitor report (api/_lib/visitInsights.ts,
// visitReport.ts, visitRecord.ts refreshAlert, api/track.ts { type: "engagement" },
// supabase/migrations/0018_visit_insights.sql). Run with `npm test`: the SQL runs on a real
// Postgres (PGlite); Telegram and the Supabase REST API are fakes routed to that database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { classifyVisit, parseUserAgent, timeZoneMismatch, visitIntent } from "../.test-build/_lib/visitInsights.js";
import { readVisits, visitReportMessage } from "../.test-build/_lib/visitReport.js";
import { recordVisit } from "../.test-build/_lib/visitRecord.js";
import { POST } from "../.test-build/track.js";

const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);
const SECRET = "x".repeat(40);

/** Every migration from 0002 on, the way they've been run in production (0018 twice: it must be re-runnable). */
async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create table public.listings (id int); create function public.is_admin() returns boolean language sql as 'select true';`);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql") && f >= "0002").sort()) {
    await db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }
  await db.exec(readFileSync(new URL("0018_visit_insights.sql", MIGRATIONS), "utf8"));
  await db.query("insert into public.internal_secrets (name, value) values ('cron', $1) on conflict (name) do update set value = excluded.value", [SECRET]);
  return db;
}

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
  referrer: "google.com",
  title: "",
  landingPath: "",
  landingTitle: "",
  trail: [],
  trailSkipped: 0,
  campaign: "",
  device: "mobile",
  viewId: "view-0001",
  tz: "Asia/Riyadh",
  screen: "390x844",
  webdriver: false,
  os: "iOS",
  browser: "Safari",
  ...over
});
const RIYADH = { country: "SA", city: "Riyadh" };
const ORIGIN = "https://www.hadararealestate.com";
const quiet = { settleMs: 0 };
const q = async (db, sql, params = []) => (await db.query(sql, params)).rows;
const until = async (check, ms = 2000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

test("parseUserAgent, time zones", () => {
  assert.deepEqual(parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"), { os: "iOS", browser: "Safari" });
  assert.equal(parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 340.0").browser, "Instagram");
  assert.equal(parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36").os, "Windows");
  assert.equal(timeZoneMismatch("Asia/Riyadh", "SA"), false);
  assert.equal(timeZoneMismatch("America/New_York", "SA"), true);
});

test("classifyVisit: contact always real, automation bot, one silent page pending", () => {
  const base = { pages: [{ path: "/ar/projects/diamond-marin", at: 0 }], country: "SA", tz: "Asia/Riyadh" };
  assert.equal(classifyVisit({ ...base, webdriver: true, actions: [{ action: "whatsapp", target: null }] }).verdict, "real");
  assert.equal(classifyVisit({ ...base, webdriver: true }).verdict, "bot");
  assert.equal(classifyVisit(base).verdict, "pending");
  assert.equal(classifyVisit({ ...base, engagement: [{ path: "/", active: 40, scroll: 80, interactions: 6 }] }).verdict, "real");
  const fast = { ...base, pages: [0, 1, 1, 2].map((at, i) => ({ path: `/p${i}`, at })), tz: "UTC", engagement: [{ path: "/", active: 1, scroll: 0, interactions: 0 }] };
  assert.equal(classifyVisit(fast).verdict, "bot");
  const intent = visitIntent({ ...base, pages: [{ path: "/ar/projects/diamond-marin", at: 0 }, { path: "/ar/contact", at: 60 }] }, "real");
  assert.equal(intent.level, "high");
});

test("migration 0018: profile, engagement keeps the larger values, insight and report", async () => {
  const db = await database();
  const s = randomUUID();
  await q(db, "select public.record_visit_state($1, '/ar/projects/diamond-marin', 'ar', 'google.com', 'SA', 'Riyadh')", [s]);
  await q(db, "select public.save_visit_profile($1, 'iOS', 'Safari', 'Asia/Riyadh', '390x844', false)", [s]);
  // No profile for a session that has no page view.
  await q(db, "select public.save_visit_profile(gen_random_uuid(), 'iOS', 'Safari', 'Asia/Riyadh', '390x844', false)");
  assert.equal((await q(db, "select count(*)::int as n from public.visitor_profiles"))[0].n, 1);

  const insight = (await q(db, "select public.record_visit_engagement($1, 'v1', '/ar/projects/diamond-marin', 40, 80, 12) as r", [s]))[0].r;
  assert.equal(insight.profile.os, "iOS");
  assert.equal(insight.pages.length, 1);
  await q(db, "select public.record_visit_engagement($1, 'v1', '/ar/projects/diamond-marin', 5, 10, 1)", [s]);
  assert.deepEqual(await q(db, "select active_seconds, scroll_pct, interactions from public.visitor_engagement"), [{ active_seconds: 40, scroll_pct: 80, interactions: 12 }]);
  assert.equal((await q(db, "select public.record_visit_engagement(gen_random_uuid(), 'v1', '/', 1, 1, 1) as r"))[0].r, null);

  assert.deepEqual((await q(db, "select public.visit_report('nope', 24) as r"))[0].r, { error: "forbidden" });
  const report = (await q(db, "select public.visit_report($1, 24) as r", [SECRET]))[0].r;
  assert.equal(report.length, 1);
  assert.equal(report[0].session_id, s);
  assert.equal(report[0].engagement[0].scroll, 80);

  // Nobody reads the tables directly; anon may only call the functions.
  await db.exec("set role anon");
  await assert.rejects(db.query("select * from public.visitor_engagement"), /permission denied/);
  await db.query("select public.visit_insight($1)", [s]);
  await db.exec("reset role");
  await q(db, "select public.purge_old_visitor_events()");
  await db.close();
});

test("visit report: people, unsure and automated, within Telegram's limit", () => {
  const row = (over) => ({
    session_id: randomUUID(),
    started: 1_790_000_000,
    campaign: null,
    device: "mobile",
    profile: { os: "iOS", browser: "Safari", tz: "Asia/Riyadh", screen: "390x844", webdriver: false },
    pages: [{ path: "/ar/projects/diamond-marin", at: 0 }, { path: "/ar/contact", at: 90 }],
    engagement: [{ path: "/ar/projects/diamond-marin", active: 60, scroll: 90, interactions: 8 }],
    actions: [],
    landing: { path: "/ar/projects/diamond-marin", locale: "ar", referrer: "google.com", country: "SA", city: "Riyadh" },
    seconds: 90,
    ...over
  });
  const rows = [
    row({ actions: [{ action: "whatsapp", target: "diamond-marin" }] }),
    row({ started: 1_790_001_000, landing: { path: "/en", locale: "en", referrer: null, country: "IE", city: "Clonee" }, engagement: [], pages: [{ path: "/en", at: 0 }] }),
    row({ started: 1_790_002_000, engagement: [], pages: [{ path: "/fr", at: 0 }], landing: { path: "/fr", locale: "fr", referrer: null, country: "FR", city: "Paris" } }),
    // A new tab opened from the site isn't a visitor.
    row({ started: 1_790_003_000, landing: { path: "/ar/contact", locale: "ar", referrer: "/ar/projects", country: "SA", city: "Riyadh" } })
  ];
  const read = readVisits(rows);
  assert.deepEqual(read.map((r) => r.verdict), ["real", "bot", "unsure"]);
  const text = visitReportMessage(read, "https://www.hadararealestate.com/ar/admin/stats");
  assert.match(text, /حضارة للعقار — تحليل زوار آخر 24 ساعة/);
  assert.match(text, /🟢 حقيقية 1 · 🟡 غير مؤكدة 1 · 🔴 آلية 1/);
  assert.match(text, /الرياض|Riyadh/);
  const many = readVisits(Array.from({ length: 300 }, (_, i) => row({ started: 1_790_000_000 + i * 60, pages: Array.from({ length: 30 }, (_, j) => ({ path: `/ar/projects/p-${j}`, at: j * 30 })) })));
  assert.ok(visitReportMessage(many, "https://x.test/ar/admin/stats").length <= 4000);
});

test("the alert gets the device and verdict, and an engagement report updates it", async () => {
  const db = await database();
  const telegram = fakeServices(db);
  const v = view();
  await recordVisit(v, RIYADH, ORIGIN, quiet);
  assert.deepEqual(telegram.map((m) => m.method), ["sendMessage"]);
  assert.match(telegram[0].text, /🖥️ الجهاز: .*iOS · Safari/);
  assert.match(telegram[0].text, /⏳/);

  telegram.length = 0;
  const response = await POST(
    new Request(`${ORIGIN}/api/track`, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0 (iPhone)" },
      body: JSON.stringify({ type: "engagement", sessionId: v.sessionId, viewId: "view-0001", path: v.path, active: 35, scroll: 75, interactions: 7, view: v })
    })
  );
  assert.equal(response.status, 204);
  await until(() => telegram.length > 0);
  assert.equal(telegram[0].method, "editMessageText");
  assert.equal(telegram[0].message_id, 100);
  assert.match(telegram[0].text, /🟢 حقيقي على الأرجح/);
  assert.deepEqual(await q(db, "select active_seconds, scroll_pct, interactions from public.visitor_engagement"), [{ active_seconds: 35, scroll_pct: 75, interactions: 7 }]);
  await db.close();
});

test("a browser that reports automation (navigator.webdriver) gets no alert, the visit is still saved", async () => {
  const db = await database();
  const telegram = fakeServices(db);
  const v = view({ webdriver: true, os: "Linux", browser: "Chrome", device: "desktop" });
  await recordVisit(v, RIYADH, ORIGIN, quiet);
  assert.equal(telegram.length, 0);
  assert.equal((await q(db, "select count(*)::int as n from visitor_events where session_id = $1", [v.sessionId]))[0].n, 1);
  assert.deepEqual(await q(db, "select os, webdriver from visitor_profiles where session_id = $1", [v.sessionId]), [{ os: "Linux", webdriver: true }]);
  await db.close();
});
