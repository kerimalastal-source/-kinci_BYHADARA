// Visitor behavior (0015-0017): devices, actions, a year of history, and the admin
// "What visitors do" numbers, on a real PostgreSQL (PGlite).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);

async function database(last) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
    create table public.listings (id int);
    create function public.is_admin() returns boolean language sql as 'select true';`);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql") && f.slice(0, 4) >= "0002" && f.slice(0, 4) <= last).sort()) {
    await db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }
  return db;
}

const visit = (db, session, path, referrer = null) =>
  db.query("select public.record_visit_state($1, $2, 'ar', $3, 'SA', 'Riyadh')", [session, path, referrer]);
const act = (db, session, action, target = null, path = "/ar/projects/marmara-haven-villa") =>
  db.query("select public.record_visit_action($1, $2, $3, $4)", [session, action, target, path]);
const stats = async (db, days = 7) => (await db.query("select public.admin_behavior_stats($1) as s", [days])).rows[0].s;

test("0015-0017 run twice without errors", async () => {
  const db = await database("0017");
  for (const f of ["0015_visitor_behavior.sql", "0016_behavior_stats.sql", "0017_longer_stats.sql"]) {
    await db.exec(readFileSync(new URL(f, MIGRATIONS), "utf8"));
  }
});

test("devices, actions, contacted visits, projects and forms", async () => {
  const db = await database("0017");
  const a = randomUUID(), b = randomUUID(), tab = randomUUID();
  await visit(db, a, "/ar/projects/marmara-haven-villa", "facebook.com");
  await visit(db, b, "/", null);
  await visit(db, tab, "/ar/contact", "/ar/projects/marmara-haven-villa"); // new tab from the site
  await db.query("select public.save_visit_device($1, 'mobile')", [a]);
  await db.query("select public.save_visit_device($1, 'desktop')", [b]);
  await db.query("select public.save_visit_device($1, 'desktop')", [a]); // first one stays
  await db.query("select public.save_visit_device($1, 'phone')", [b]); // unknown value: ignored
  await act(db, a, "video_play", "marmara-haven-villa");
  await act(db, a, "whatsapp", "marmara-haven-villa");
  await act(db, a, "whatsapp", "marmara-haven-villa");
  await act(db, b, "form_start", "contact", "/contact");
  await act(db, b, "not_an_action", "x"); // ignored
  await act(db, tab, "whatsapp", "marmara-haven-villa"); // not a visit
  const s = await stats(db);
  assert.equal(s.visits, 2);
  assert.equal(s.contacted, 1);
  const mobile = s.devices.find((d) => d.device === "mobile");
  assert.deepEqual(mobile, { device: "mobile", visits: 1, contacted: 1 });
  assert.equal(s.devices.find((d) => d.device === "desktop").contacted, 0);
  const wa = s.actions.find((x) => x.action === "whatsapp");
  assert.deepEqual(wa, { action: "whatsapp", count: 2, sessions: 1 });
  assert.ok(s.projects.some((p) => p.slug === "marmara-haven-villa" && p.action === "video_play" && p.sessions === 1));
  assert.deepEqual(s.forms, [{ form: "contact", started: 1, sent: 0 }]);
  const count = (await db.query("select count(*)::int as n from public.visitor_actions")).rows[0].n;
  assert.equal(count, 5);
});

test("at most 40 actions per session in 10 minutes", async () => {
  const db = await database("0017");
  const s = randomUUID();
  for (let i = 0; i < 45; i++) await act(db, s, "map_open", "diamond-marin");
  assert.equal((await db.query("select count(*)::int as n from public.visitor_actions")).rows[0].n, 40);
});

test("visits are kept a year; Telegram ids 30 days", async () => {
  const db = await database("0017");
  const s = randomUUID(), old = randomUUID();
  await visit(db, s, "/");
  await visit(db, old, "/");
  await db.query("select public.save_visitor_alert($1, 5)", [s]);
  await act(db, old, "call");
  await db.exec(`update public.visitor_events set created_at = now() - interval '400 days' where session_id = '${old}';
    update public.visitor_actions set created_at = now() - interval '400 days';
    update public.visitor_events set created_at = now() - interval '100 days' where session_id = '${s}';
    update public.visitor_alerts set created_at = now() - interval '100 days';`);
  await db.query("select public.purge_old_visitor_events()");
  const n = async (table) => (await db.query(`select count(*)::int as n from public.${table}`)).rows[0].n;
  assert.equal(await n("visitor_events"), 1);
  assert.equal(await n("visitor_actions"), 0);
  assert.equal(await n("visitor_alerts"), 0);
  // 0017: a 90-day period now reaches it
  const v = (await db.query("select public.admin_visit_stats(120) as s")).rows[0].s;
  assert.equal(v.days, 120);
  assert.equal(v.totals.visitors, 1);
});
