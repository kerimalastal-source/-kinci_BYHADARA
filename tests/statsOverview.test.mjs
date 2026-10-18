// The top of the statistics page: admin_stats_overview() (supabase/migrations/0024) on a real
// Postgres (PGlite): this period against the one before it, real against all visits, test
// requests left out, the source x campaign table and the inquiries waiting for a reply.
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
  await db.exec(readFileSync(new URL("0024_stats_overview.sql", MIGRATIONS), "utf8"));
  return db;
}

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const overview = async (db, days = 7) => (await db.query("select public.admin_stats_overview($1) as r", [days])).rows[0].r;

/** Noon, Istanbul time, `ago` days back. */
async function noon(db, ago) {
  return (await db.query(`select (((now() at time zone 'Europe/Istanbul')::date - $1::int) + time '12:00') at time zone 'Europe/Istanbul' as t`, [ago])).rows[0].t.toISOString();
}
const plus = (iso, s) => new Date(Date.parse(iso) + s * 1000).toISOString();

async function visit(db, n, path, at, { referrer = null } = {}) {
  await db.query(
    `insert into public.visitor_events (session_id, path, locale, referrer, country, city, created_at)
     values ($1, $2, 'ar', $3, 'TR', 'Istanbul', $4::timestamptz)`,
    [id(n), path, referrer, at]
  );
}

async function inquiry(db, ref, { name = "Ahmad", email = "a@example.com", source = null, at, status = "new", company = null }) {
  await db.query(
    `insert into public.inquiries (reference, kind, name, email, phone, source, status, details, created_at)
     values ($1, 'contact', $2, $3, '+905000000000', $4, $5, $6::jsonb, $7::timestamptz)`,
    [ref, name, email, source, status, JSON.stringify(company ? { company } : {}), at]
  );
}

test("this period against the previous one, real against all, tests left out", async () => {
  const db = await database();
  const now = await noon(db, 1);
  const before = await noon(db, 9);

  // This week: a person from a Facebook ad who presses WhatsApp, a person from Google,
  // and three link checks opening the same page within seconds (automated).
  await visit(db, 1, "/ar/projects/x", now);
  await db.query("insert into public.visitor_campaigns (session_id, campaign) values ($1, 'utm_source=facebook · utm_campaign=gulf-whatsapp')", [id(1)]);
  await db.query("insert into public.visitor_actions (session_id, action, target, created_at) values ($1, 'whatsapp', 'x', $2), ($1, 'call', 'x', $2)", [id(1), plus(now, 30)]);
  await visit(db, 2, "/", plus(now, 600), { referrer: "google.com" });
  await visit(db, 2, "/projects", plus(now, 640));
  for (const n of [3, 4, 5]) await visit(db, n, "/projects/y", plus(now, 1200 + n));
  // A press from an earlier session (no visit in the period) still counts as a press.
  await db.query("insert into public.visitor_actions (session_id, action, target, created_at) values ($1, 'call', 'y', $2)", [id(99), plus(now, 1210)]);
  // A new tab opened from the site is not a visit.
  await visit(db, 6, "/about", plus(now, 2000), { referrer: "/ar" });

  // Last week: one person.
  await visit(db, 7, "/", before, { referrer: "google.com" });

  // Requests: a real one from the ad, a booking, and three tests (owner email, name, company).
  await inquiry(db, "HQ-AAAAA1", { source: "utm_source=facebook · utm_campaign=gulf-whatsapp", at: plus(now, 60) });
  await db.query(
    `insert into public.tour_bookings (reference, slot_start, projects, app, tour_language, name, email, phone, contact_method, created_at)
     values ('HT-AAAAA1', now() + interval '2 days', '{x}', 'zoom', 'ar', 'Sara', 's@example.com', '+90', 'email', $1)`,
    [plus(now, 90)]
  );
  await inquiry(db, "HQ-TEST01", { email: " Abemiroglu@Gmail.com ", at: plus(now, 100) });
  await inquiry(db, "HQ-TEST02", { name: "Test Kerim", at: plus(now, 110) });
  await inquiry(db, "HQ-TEST03", { company: "TestCo", at: plus(now, 120) });
  await inquiry(db, "HQ-AAAAA0", { at: plus(before, 60), status: "contacted" });
  // Waiting since long before the period: still listed, first.
  await inquiry(db, "HQ-OLD001", { name: "Old", at: await noon(db, 40) });

  const r = await overview(db, 7);
  assert.equal(r.days, 7);
  assert.equal(r.automated, 3);
  assert.equal(r.tests, 3);
  assert.deepEqual(r.current, { real: { visitors: 2, clicks: 3 }, all: { visitors: 5, clicks: 3 }, inquiries: 1, bookings: 1 });
  assert.deepEqual(r.previous, { real: { visitors: 1, clicks: 0 }, all: { visitors: 1, clicks: 0 }, inquiries: 1, bookings: 0 });
  assert.ok(r.started.visits && r.started.actions && r.started.leads);
  assert.ok(Date.parse(r.prev_since) < Date.parse(r.since));

  const fb = r.sources.find((s) => s.source === "facebook");
  assert.deepEqual(
    { ...fb },
    { source: "facebook", campaign: "gulf-whatsapp", real_visits: 1, all_visits: 1, leads: 1, real_clicks: 2, all_clicks: 2 }
  );
  const google = r.sources.find((s) => s.source === "google.com");
  assert.equal(google.real_visits, 1);
  const direct = r.sources.find((s) => s.source === "direct");
  assert.deepEqual({ real: direct.real_visits, all: direct.all_visits, clicks: direct.all_clicks }, { real: 0, all: 3, clicks: 0 });
  // The booking came without an ad.
  assert.equal(r.sources.find((s) => s.source === "none").leads, 1);
  // The sorted table starts with the rows that brought requests.
  assert.ok(r.sources[0].leads >= 1);

  assert.equal(r.waiting_total, 2);
  assert.deepEqual(r.waiting.map((w) => w.reference), ["HQ-OLD001", "HQ-AAAAA1"]);
  assert.deepEqual(Object.keys(r.waiting[0]).sort(), ["created_at", "form", "id", "kind", "name", "projects", "reference"]);
});

test("an empty database gives zeros and empty lists", async () => {
  const db = await database();
  const r = await overview(db, 30);
  assert.deepEqual(r.current, { real: { visitors: 0, clicks: 0 }, all: { visitors: 0, clicks: 0 }, inquiries: 0, bookings: 0 });
  assert.deepEqual(r.sources, []);
  assert.deepEqual(r.waiting, []);
  assert.equal(r.started.visits, null);
});

test("the period is capped, only admins get numbers, and the helpers stay private", async () => {
  const db = await database();
  assert.equal((await overview(db, 9999)).days, 366);
  assert.equal((await overview(db, 0)).days, 1);
  const grants = (await db.query(
    `select has_function_privilege('anon', 'public.admin_stats_overview(int)', 'execute') as anon,
            has_function_privilege('authenticated', 'public.admin_stats_overview(int)', 'execute') as auth,
            has_function_privilege('authenticated', 'public.stats_is_test(text, text, text)', 'execute') as test`
  )).rows[0];
  assert.deepEqual(grants, { anon: false, auth: true, test: false });
  await db.exec("create or replace function public.is_admin() returns boolean language sql as 'select false'");
  assert.deepEqual(await overview(db, 7), { error: "forbidden" });
});

test("0024 is ASCII only and keeps no plain email", () => {
  const sql = readFileSync(new URL("0024_stats_overview.sql", MIGRATIONS), "utf8");
  assert.ok(/^[\x00-\x7f]*$/.test(sql));
  assert.ok(!/@/.test(sql));
});
