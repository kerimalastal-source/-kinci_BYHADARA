// The rest of the statistics page: admin_stats_details() (supabase/migrations/0025) on a real
// Postgres (PGlite): visitors per day for both periods, the visit journey, the audience,
// project views against requests, and the latest requests (tests left out).
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
  await db.exec(readFileSync(new URL("0025_stats_details.sql", MIGRATIONS), "utf8"));
  return db;
}

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const details = async (db, days = 7) => (await db.query("select public.admin_stats_details($1) as r", [days])).rows[0].r;
const plus = (iso, s) => new Date(Date.parse(iso) + s * 1000).toISOString();

async function noon(db, ago) {
  return (await db.query(`select (((now() at time zone 'Europe/Istanbul')::date - $1::int) + time '12:00') at time zone 'Europe/Istanbul' as t`, [ago])).rows[0].t.toISOString();
}

async function visit(db, n, path, at, { referrer = null, country = "TR", locale = "ar" } = {}) {
  await db.query(
    `insert into public.visitor_events (session_id, path, locale, referrer, country, city, created_at)
     values ($1, $2, $3, $4, $5, 'Istanbul', $6::timestamptz)`,
    [id(n), path, locale, referrer, country, at]
  );
}

test("the day series, the journey, the audience, projects and the latest requests", async () => {
  const db = await database();
  const day1 = await noon(db, 1);
  const prevDay = await noon(db, 8);

  // A Saudi visitor on the phone: home, a project, the contact page, then sends the form.
  await visit(db, 1, "/ar", day1, { referrer: "google.com", country: "SA" });
  await visit(db, 1, "/ar/projects/marmara-haven-villa", plus(day1, 40));
  await visit(db, 1, "/ar/contact", plus(day1, 90));
  await db.query("insert into public.visitor_devices (session_id, device) values ($1, 'mobile')", [id(1)]);
  await db.query("insert into public.visitor_actions (session_id, action, target, created_at) values ($1, 'form_sent', 'contact', $2)", [id(1), plus(day1, 120)]);
  // A Turkish visitor in English looks at two projects (the villa twice).
  await visit(db, 2, "/projects/marmara-haven-villa", plus(day1, 600), { referrer: "instagram.com", locale: "en" });
  await visit(db, 2, "/projects/diamond-marin", plus(day1, 640), { locale: "en" });
  await visit(db, 2, "/projects/marmara-haven-villa", plus(day1, 700), { locale: "en" });
  // Three link checks on the same project within seconds (automated).
  for (const n of [3, 4, 5]) await visit(db, n, "/projects/diamond-marin", plus(day1, 1200 + n), { country: "US" });
  // The previous period: one visitor exactly 7 days before day1.
  await visit(db, 9, "/", prevDay, { referrer: "google.com" });

  // Requests: one real for two projects, a booking, and a test from the owner.
  await db.query(
    `insert into public.inquiries (reference, kind, name, email, phone, projects, source, status, created_at)
     values ('HQ-AAAAA1', 'contact', 'Ahmad', 'a@example.com', '+90', '{marmara-haven-villa,casablu-vadi}', 'utm_source=facebook · utm_campaign=villa-leads', 'new', $1),
            ('HQ-TEST01', 'contact', 'Test', 't@example.com', '+90', '{diamond-marin}', null, 'new', $1)`,
    [plus(day1, 130)]
  );
  await db.query(
    `insert into public.tour_bookings (reference, slot_start, projects, app, tour_language, name, email, phone, contact_method, created_at)
     values ('HT-AAAAA1', now() + interval '2 days', '{casablu-vadi}', 'zoom', 'ar', 'Sara', 's@example.com', '+90', 'email', $1)`,
    [plus(day1, 900)]
  );

  const r = await details(db, 7);
  assert.equal(r.days, 7);
  assert.equal(r.daily.length, 7);
  const d1 = r.daily[5];
  assert.deepEqual(
    { real: d1.real, all: d1.all, pages_real: d1.pages_real, contacted: d1.contacted, prev_real: d1.prev_real, prev_all: d1.prev_all },
    { real: 2, all: 5, pages_real: 6, contacted: 1, prev_real: 1, prev_all: 1 }
  );

  assert.deepEqual(r.funnel.real, { visits: 2, project: 2, request_page: 1, sent: 1 });
  assert.deepEqual(r.funnel.all, { visits: 5, project: 5, request_page: 1, sent: 1 });

  const sa = r.countries.find((c) => c.country === "SA");
  assert.deepEqual({ real: sa.real, all: sa.all, contacted: sa.contacted }, { real: 1, all: 1, contacted: 1 });
  assert.equal(r.countries.find((c) => c.country === "US").real, 0);
  assert.equal(r.devices.find((d) => d.device === "mobile").real, 1);
  assert.deepEqual(r.locales.find((l) => l.locale === "en"), { locale: "en", real: 1, all: 1 });

  const villa = r.projects.find((p) => p.slug === "marmara-haven-villa");
  assert.deepEqual(
    { views: villa.views_real, visitors: villa.visitors_real, requests: villa.requests },
    { views: 3, visitors: 2, requests: 1 }
  );
  const diamond = r.projects.find((p) => p.slug === "diamond-marin");
  assert.deepEqual({ real: diamond.visitors_real, all: diamond.visitors_all, requests: diamond.requests }, { real: 1, all: 4, requests: 0 });
  // Requested without a single view: still listed, and requested projects come first.
  const casablu = r.projects.find((p) => p.slug === "casablu-vadi");
  assert.deepEqual({ views: casablu.views_all, requests: casablu.requests }, { views: 0, requests: 2 });
  assert.equal(r.projects[0].slug, "casablu-vadi");

  assert.deepEqual(r.recent.map((x) => x.reference), ["HT-AAAAA1", "HQ-AAAAA1"]);
  assert.deepEqual({ source: r.recent[1].source, campaign: r.recent[1].campaign }, { source: "facebook", campaign: "villa-leads" });
  assert.equal(r.recent[0].type, "booking");
});

test("an empty database gives zeros and empty lists", async () => {
  const db = await database();
  const r = await details(db, 30);
  assert.equal(r.daily.length, 30);
  assert.deepEqual(r.funnel.real, { visits: 0, project: 0, request_page: 0, sent: 0 });
  for (const key of ["countries", "devices", "locales", "projects", "recent"]) assert.deepEqual(r[key], [], key);
});

test("the period is capped and only admins get numbers", async () => {
  const db = await database();
  assert.equal((await details(db, 9999)).days, 366);
  const grants = (await db.query(
    `select has_function_privilege('anon', 'public.admin_stats_details(int)', 'execute') as anon,
            has_function_privilege('authenticated', 'public.admin_stats_details(int)', 'execute') as auth`
  )).rows[0];
  assert.deepEqual(grants, { anon: false, auth: true });
  await db.exec("create or replace function public.is_admin() returns boolean language sql as 'select false'");
  assert.deepEqual(await details(db, 7), { error: "forbidden" });
});

test("0025 is ASCII only", () => {
  assert.ok(/^[\x00-\x7f]*$/.test(readFileSync(new URL("0025_stats_details.sql", MIGRATIONS), "utf8")));
});
