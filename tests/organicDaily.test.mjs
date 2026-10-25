// "Real visitors without paid ads" on the statistics page: admin_organic_daily()
// (supabase/migrations/0034) on a real Postgres (PGlite): real visits per day by where they
// came from, paid-ad visits counted apart, automated visits left out.
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
  await db.exec(readFileSync(new URL("0034_organic_daily.sql", MIGRATIONS), "utf8"));
  return db;
}

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const organic = async (db, days = 7) => (await db.query("select public.admin_organic_daily($1) as r", [days])).rows[0].r;
const plus = (iso, s) => new Date(Date.parse(iso) + s * 1000).toISOString();

async function noon(db, ago) {
  return (await db.query(`select (((now() at time zone 'Europe/Istanbul')::date - $1::int) + time '12:00') at time zone 'Europe/Istanbul' as t`, [ago])).rows[0].t.toISOString();
}

async function visit(db, n, path, at, { referrer = null, campaign = null, country = "TR" } = {}) {
  await db.query(
    `insert into public.visitor_events (session_id, path, locale, referrer, country, city, created_at)
     values ($1, $2, 'ar', $3, $4, 'Istanbul', $5::timestamptz)`,
    [id(n), path, referrer, country, at]
  );
  if (campaign) await db.query("insert into public.visitor_campaigns (session_id, campaign) values ($1, $2) on conflict do nothing", [id(n), campaign]);
}

/** Three pages a minute apart: a person reading, not a link check. */
async function reader(db, n, at, opts) {
  await visit(db, n, "/ar", at, opts);
  await visit(db, n, "/ar/projects/marmara-haven-villa", plus(at, 60));
  await visit(db, n, "/ar/about", plus(at, 130));
}

test("real visits per day by source, paid ads apart, automated left out", async () => {
  const db = await database();
  const day1 = await noon(db, 1);

  await reader(db, 1, day1, { referrer: "google.com" });
  await db.query("insert into public.visitor_actions (session_id, action, target, created_at) values ($1, 'whatsapp', '', $2)", [id(1), plus(day1, 140)]);
  await reader(db, 2, plus(day1, 600), {});
  await reader(db, 3, plus(day1, 1200), { referrer: "instagram.com", campaign: "utm_source=facebook · utm_campaign=post-citizenship" });
  await reader(db, 4, plus(day1, 1800), { referrer: "l.instagram.com" });
  await reader(db, 5, plus(day1, 2400), { referrer: "emlakjet.com" });
  await reader(db, 6, plus(day1, 3000), { campaign: "utm_source=facebook · utm_medium=paid · utm_campaign=villa-marmara" });
  await reader(db, 7, plus(day1, 3600), { campaign: "gclid=abc" });
  // Three link checks on the same page within seconds (automated): not counted anywhere.
  for (const n of [8, 9, 10]) await visit(db, n, "/projects/diamond-marin", plus(day1, 5000 + n), { country: "US" });

  const r = await organic(db, 7);
  assert.equal(r.days, 7);
  assert.equal(r.daily.length, 7);
  const d1 = r.daily[5];
  const { day, ...counts } = d1;
  assert.ok(day);
  assert.deepEqual(counts, { search: 1, direct: 1, posts: 1, social: 1, referral: 1, contacted: 1, paid: 2 });
  for (const other of r.daily.filter((x) => x !== d1)) {
    assert.equal(other.search + other.direct + other.posts + other.social + other.referral + other.paid, 0);
  }
});

test("the period is capped and only admins get numbers", async () => {
  const db = await database();
  assert.equal((await organic(db, 9999)).days, 366);
  const grants = (await db.query(
    `select has_function_privilege('anon', 'public.admin_organic_daily(int)', 'execute') as anon,
            has_function_privilege('authenticated', 'public.admin_organic_daily(int)', 'execute') as auth`
  )).rows[0];
  assert.deepEqual(grants, { anon: false, auth: true });
  await db.exec("create or replace function public.is_admin() returns boolean language sql as 'select false'");
  assert.deepEqual(await organic(db, 7), { error: "forbidden" });
});

test("0034 is ASCII only", () => {
  assert.ok(/^[\x00-\x7f]*$/.test(readFileSync(new URL("0034_organic_daily.sql", MIGRATIONS), "utf8")));
});
