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
  for (const file of ["0021_automated_visits.sql", "0022_clean_visit_stats.sql", "0023_clean_behavior_consent.sql", "0030_datacenter_contacts.sql", "0031_server_screen.sql"]) {
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
