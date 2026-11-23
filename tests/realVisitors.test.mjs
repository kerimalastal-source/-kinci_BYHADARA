// Automated visits left out of the admin statistics: visit_verdicts() and
// admin_real_visitor_stats() (supabase/migrations/0020, 0021), admin_visit_stats() (0022),
// admin_behavior_stats() and admin_consent_stats() (0023), on a real Postgres (PGlite).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);

async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create table public.listings (id int); create function public.is_admin() returns boolean language sql as 'select true';`);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql") && f >= "0002").sort()) {
    await db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }
  // Re-runnable.
  for (const file of ["0021_automated_visits.sql", "0022_clean_visit_stats.sql", "0023_clean_behavior_consent.sql", "0030_datacenter_contacts.sql", "0031_server_screen.sql", "0035_strict_us_cn.sql", "0036_tall_desktop.sql", "0044_server_desktop.sql"]) {
    await db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }
  return db;
}

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

async function visit(db, n, path, at, { referrer = null, city = "Istanbul", country = "TR" } = {}) {
  await db.query(
    `insert into public.visitor_events (session_id, path, locale, referrer, country, city, created_at)
     values ($1, $2, 'ar', $3, $4, $5, $6::timestamptz)`,
    [id(n), path, referrer, country, city, at]
  );
}

const stats = async (db, days = 7) => (await db.query("select public.admin_real_visitor_stats($1) as r", [days])).rows[0].r;

test("each kind of visit is counted where it belongs", async () => {
  const db = await database();
  // Noon, Istanbul time, one and two days ago.
  const day = async (ago) =>
    (await db.query(`select (((now() at time zone 'Europe/Istanbul')::date - $1::int) + time '12:00') at time zone 'Europe/Istanbul' as t`, [ago])).rows[0].t.toISOString();
  const twoAgo = await day(2);
  const oneAgo = await day(1);
  const plus = (iso, s) => new Date(Date.parse(iso) + s * 1000).toISOString();

  // A person from Google who scrolls and touches the screen, with a natural pause.
  await visit(db, 1, "/ar", twoAgo, { referrer: "google.com" });
  await visit(db, 1, "/ar/projects", plus(twoAgo, 30));
  await db.query(`insert into public.visitor_engagement (session_id, view_id, path, active_seconds, scroll_pct, interactions) values ($1, 'v1', '/ar', 40, 80, 6)`, [id(1)]);
  // A link check from a data-center town (with an accent, as Telegram cities come).
  await visit(db, 2, "/projects/x", plus(twoAgo, 3600), { city: "Luleå", country: "SE" });
  // Three sessions opening the same page within seconds.
  for (const n of [3, 4, 5]) await visit(db, n, "/projects/y", plus(oneAgo, n));
  // A driven browser.
  await visit(db, 6, "/", plus(oneAgo, 600));
  await db.query("insert into public.visitor_profiles (session_id, webdriver) values ($1, true)", [id(6)]);
  // From a data-center town and pressed WhatsApp: an ad review system, still automated (0030).
  await visit(db, 7, "/", plus(oneAgo, 1200), { city: "Ashburn", country: "US" });
  await db.query("insert into public.visitor_actions (session_id, action, target) values ($1, 'whatsapp', 'contact')", [id(7)]);
  // Fort Worth (a real city, off the town list) with Meta's 2000x2000 screen, reading and touching: automated (0031).
  await visit(db, 11, "/", plus(oneAgo, 1250), { city: "Fort Worth", country: "US" });
  await db.query("insert into public.visitor_profiles (session_id, screen) values ($1, '2000x2000')", [id(11)]);
  await db.query(`insert into public.visitor_engagement (session_id, view_id, path, active_seconds, scroll_pct, interactions) values ($1, 'v11', '/', 40, 80, 6)`, [id(11)]);
  await db.query("insert into public.visitor_actions (session_id, action, target) values ($1, 'whatsapp', 'contact')", [id(11)]);
  // A person in Riyadh who pressed WhatsApp.
  await visit(db, 10, "/", plus(oneAgo, 1300), { city: "Riyadh", country: "SA" });
  await db.query("insert into public.visitor_actions (session_id, action, target) values ($1, 'whatsapp', 'contact')", [id(10)]);
  // A new tab opened from the site is not a visit.
  await visit(db, 8, "/about", plus(oneAgo, 1800), { referrer: "/ar" });
  // Older than the period.
  await visit(db, 9, "/", await day(10));

  // The cookie notice: the person and a link check both saw it.
  await db.query("insert into public.visitor_consent (session_id, choice) values ($1, 'granted'), ($2, 'none')", [id(1), id(3)]);

  const r = await stats(db, 7);
  assert.equal(r.days, 7);
  assert.equal(r.daily.length, 7);
  assert.equal(r.automated, 7);
  const [d2, d1, d0] = r.daily.slice(-3);
  assert.deepEqual(d2, { day: d2.day, visitors: 1, pages: 2, contacted: 0 });
  assert.deepEqual(d1, { day: d1.day, visitors: 1, pages: 1, contacted: 1 });
  assert.deepEqual(d0, { day: d0.day, visitors: 0, pages: 0, contacted: 0 });

  // Every number on the statistics page counts the two people only.
  const visits = (await db.query("select public.admin_visit_stats(7) as r")).rows[0].r;
  assert.equal(visits.totals.visitors, 2);
  assert.equal(visits.totals.pages, 3);
  assert.deepEqual(visits.countries.map((c) => c.country).sort(), ["SA", "TR"]);
  assert.ok(!visits.landings.some((l) => l.page.startsWith("/projects/")));
  const behavior = (await db.query("select public.admin_behavior_stats(7) as r")).rows[0].r;
  assert.equal(behavior.visits, 2);
  assert.equal(behavior.contacted, 1);
  const consent = (await db.query("select public.admin_consent_stats(7) as r")).rows[0].r;
  assert.deepEqual(consent, { shown: 1, granted: 1, denied: 0, ignored: 0 });
});

test("only the statistics functions can read the verdicts", async () => {
  const db = await database();
  const grants = (await db.query(
    "select has_function_privilege('anon', 'public.visit_verdicts(timestamptz)', 'execute') as anon, has_function_privilege('authenticated', 'public.visit_verdicts(timestamptz)', 'execute') as auth"
  )).rows[0];
  assert.deepEqual(grants, { anon: false, auth: false });
});

test("the period is capped and only admins get numbers", async () => {
  const db = await database();
  assert.equal((await stats(db, 9999)).days, 366);
  assert.equal((await stats(db, 0)).days, 1);
  await db.exec("create or replace function public.is_admin() returns boolean language sql as 'select false'");
  assert.deepEqual(await stats(db, 7), { error: "forbidden" });
});

test("the migrations are ASCII only (the Supabase SQL editor cuts other characters)", () => {
  for (const file of ["0020_real_visitors.sql", "0021_automated_visits.sql", "0022_clean_visit_stats.sql", "0023_clean_behavior_consent.sql"]) {
    assert.ok(/^[\x00-\x7f]*$/.test(readFileSync(new URL(file, MIGRATIONS), "utf8")), file);
  }
});

test("visits from the US and China need steady human use to count (0035)", async () => {
  const db = await database();
  const at = new Date(Date.now() - 3600 * 1000).toISOString();
  const plus = (s) => new Date(Date.parse(at) + s * 1000).toISOString();
  const eng = (n, inter, active) =>
    db.query(`insert into public.visitor_engagement (session_id, view_id, path, active_seconds, scroll_pct, interactions) values ($1, $2, '/', $3, 20, $4)`, [id(n), `v${n}`, active, inter]);
  // A crawler in Santa Clara: one page, nothing reported.
  await visit(db, 21, "/about", plus(0), { city: "Santa Clara", country: "US" });
  // Meta's ad check from Fort Worth: touched a form once, nothing else.
  await visit(db, 22, "/property-request", plus(100), { city: "Fort Worth", country: "US", referrer: "m.facebook.com" });
  await eng(22, 1, 0);
  await db.query("insert into public.visitor_actions (session_id, action, target) values ($1, 'form_start', 'property-request')", [id(22)]);
  // A person in Dallas who read and touched the page.
  await visit(db, 23, "/ru/projects/x", plus(200), { city: "Dallas", country: "US", referrer: "facebook.com" });
  await eng(23, 2, 42);
  // A person in Beijing who pressed WhatsApp.
  await visit(db, 24, "/", plus(300), { city: "Beijing", country: "CN" });
  await db.query("insert into public.visitor_actions (session_id, action, target) values ($1, 'whatsapp', 'contact')", [id(24)]);
  // Singapore on the China time zone, nothing reported.
  await visit(db, 25, "/faq", plus(400), { city: "Singapore", country: "SG" });
  await db.query("insert into public.visitor_profiles (session_id, tz) values ($1, 'Asia/Shanghai')", [id(25)]);
  // Istanbul, one silent page: still not judged automated.
  await visit(db, 26, "/", plus(500));

  const rows = (await db.query("select session_id, contacted, automated from public.visit_verdicts(now() - interval '1 day')")).rows;
  const of = (n) => rows.find((r) => r.session_id === id(n));
  assert.equal(of(21).automated, true);
  assert.equal(of(22).automated, true);
  assert.equal(of(23).automated, false);
  assert.equal(of(24).automated, false);
  assert.equal(of(24).contacted, true);
  assert.equal(of(25).automated, true);
  assert.equal(of(26).automated, false);
});

test("a tall desktop window needs steady human use to count (0036)", async () => {
  const db = await database();
  const at = new Date(Date.now() - 3600 * 1000).toISOString();
  const plus = (s) => new Date(Date.parse(at) + s * 1000).toISOString();
  const screen = (n, sc, os = "macOS") => db.query("insert into public.visitor_profiles (session_id, screen, os) values ($1, $2, $3)", [id(n), sc, os]);
  // The crawler: Hong Kong, Singapore, Mexico City, one page, nothing reported.
  await visit(db, 31, "/contact", plus(0), { city: "Hong Kong", country: "HK" });
  await screen(31, "1292x1188");
  await visit(db, 32, "/blog/x", plus(100), { city: "Singapore", country: "SG" });
  await screen(32, "1372x1286", "Windows");
  await visit(db, 33, "/projects/y", plus(200), { city: "Mexico City", country: "MX" });
  await screen(33, "1301x1223");
  // The same screen pressing WhatsApp still counts.
  await visit(db, 34, "/", plus(300), { city: "Hong Kong", country: "HK" });
  await screen(34, "1347x1180", "Windows");
  await db.query("insert into public.visitor_actions (session_id, action, target) values ($1, 'whatsapp', 'contact')", [id(34)]);
  // Ordinary screens in Istanbul: a laptop, an iPad in landscape, a phone.
  await visit(db, 35, "/", plus(400));
  await screen(35, "1440x900");
  await visit(db, 36, "/", plus(500));
  await screen(36, "1366x1024");
  await visit(db, 37, "/", plus(600));
  await screen(37, "390x844", "iOS");
  // A text-like screen value does not break the query.
  await visit(db, 38, "/", plus(700));
  await screen(38, "unknown");

  const rows = (await db.query("select session_id, contacted, automated from public.visit_verdicts(now() - interval '1 day')")).rows;
  const of = (n) => rows.find((r) => r.session_id === id(n));
  assert.equal(of(31).automated, true);
  assert.equal(of(32).automated, true);
  assert.equal(of(33).automated, true);
  assert.equal(of(34).automated, false);
  assert.equal(of(34).contacted, true);
  for (const n of [35, 36, 37, 38]) assert.equal(of(n).automated, false, `visit ${n}`);
});

test("0036 is ASCII only", () => {
  assert.ok(/^[\x00-\x7f]*$/.test(readFileSync(new URL("0036_tall_desktop.sql", MIGRATIONS), "utf8")));
});

test("a server-like desktop needs steady human use to count (0044)", async () => {
  const db = await database();
  const at = new Date(Date.now() - 3600 * 1000).toISOString();
  const plus = (s) => new Date(Date.parse(at) + s * 1000).toISOString();
  const profile = (n, screen, os, tz, device = "desktop") =>
    Promise.all([
      db.query("insert into public.visitor_profiles (session_id, screen, os, tz) values ($1, $2, $3, $4)", [id(n), screen, os, tz]),
      db.query("insert into public.visitor_devices (session_id, device) values ($1, $2)", [id(n), device])
    ]);
  const looked = (n, inter, active) =>
    db.query(`insert into public.visitor_engagement (session_id, view_id, path, active_seconds, scroll_pct, interactions) values ($1, 'v', '/', $2, 14, $3)`, [id(n), active, inter]);
  // The crawlers of 16/11-22/11: one page, 15 seconds, nothing touched.
  await visit(db, 41, "/", plus(0), { city: "London", country: "GB" });
  await profile(41, "1920x1080", "Windows", "America/New_York");
  await looked(41, 0, 15);
  await visit(db, 42, "/", plus(60), { city: "Frankfurt am Main", country: "DE" });
  await profile(42, "1600x1200", "Linux", "Europe/Berlin");
  await looked(42, 1, 6);
  await visit(db, 43, "/", plus(120), { city: "Amsterdam", country: "NL" });
  await profile(43, "800x600", "Windows", "Europe/Moscow");
  await looked(43, 0, 15);
  await visit(db, 44, "/", plus(180), { city: "Amsterdam", country: "NL" });
  await profile(44, "1366x768", "Windows", "UTC");
  await looked(44, 0, 15);
  // The same setup with steady use, or a contact, still counts.
  await visit(db, 45, "/", plus(240), { city: "London", country: "GB" });
  await profile(45, "1920x1080", "Windows", "UTC");
  await looked(45, 4, 26);
  await visit(db, 46, "/", plus(300), { city: "Dublin", country: "IE" });
  await profile(46, "1920x1080", "Windows", "America/New_York");
  await db.query("insert into public.visitor_actions (session_id, action, target) values ($1, 'whatsapp', 'contact')", [id(46)]);
  // Real visitors: a Canadian on an American time zone, a phone on UTC, an Istanbul laptop.
  await visit(db, 47, "/", plus(360), { city: "Toronto", country: "CA" });
  await profile(47, "1920x1080", "Windows", "America/Toronto");
  await looked(47, 1, 8);
  await visit(db, 48, "/", plus(420), { city: "Doha", country: "QA" });
  await profile(48, "390x844", "iOS", "UTC", "mobile");
  await looked(48, 1, 8);
  await visit(db, 49, "/", plus(480));
  await profile(49, "1440x900", "macOS", "Europe/Istanbul");
  await looked(49, 1, 8);

  const rows = (await db.query("select session_id, contacted, automated from public.visit_verdicts(now() - interval '1 day')")).rows;
  const of = (n) => rows.find((r) => r.session_id === id(n));
  for (const n of [41, 42, 43, 44]) assert.equal(of(n).automated, true, `visit ${n}`);
  for (const n of [45, 46, 47, 48, 49]) assert.equal(of(n).automated, false, `visit ${n}`);
  assert.equal(of(46).contacted, true);
});

test("0044 is ASCII only", () => {
  assert.ok(/^[\x00-\x7f]*$/.test(readFileSync(new URL("0044_server_desktop.sql", MIGRATIONS), "utf8")));
});
