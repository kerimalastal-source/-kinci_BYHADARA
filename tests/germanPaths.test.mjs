// The German site (/de) is treated like the other languages by the visitor tracking:
// admin pages aren't tracked, /de/contact is the contact page (🔥), a /de project page
// gets its 🏠 line, and in the database (0042) /de pages count as the same page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { newVisitorMessage, requestPageMessage } from "../.test-build/_lib/visitAlerts.js";
import { PROJECT_NAMES } from "../.test-build/_lib/projectNames.js";

const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);

/** A database with every migration from 0002 up to `last` (auth and is_admin() stubbed). */
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

const seen = async (db, session, path) =>
  (await db.query("select public.record_visit_state($1, $2, 'de', null, 'DE', 'Berlin') as s", [session, path])).rows[0].s.seen_before;

const state = { is_new: false, pages_before: 1, seconds: 30, seen_before: false, landing: null, message_id: 1 };
const view = (path, title = "") => ({ sessionId: randomUUID(), path, locale: "de", referrer: "", title, landingPath: path, landingTitle: title, trail: [], trailSkipped: 0, campaign: "" });
const BERLIN = { country: "DE", city: "Berlin" };

test("/de/contact is the contact page (🔥), and a /de project page gets its 🏠 line", () => {
  assert.match(requestPageMessage(view("/de/contact"), BERLIN, state), /🔥 الزائر فتح صفحة التواصل/);
  assert.equal(requestPageMessage(view("/delivery"), BERLIN, state), null);
  const alert = newVisitorMessage(view("/de/projects/marmara-haven-villa", "Marmara Haven | HADARA"), BERLIN, "https://www.hadararealestate.com");
  assert.match(alert, /🏠 المشروع: <a href="https:\/\/www\.hadararealestate\.com\/de\/projects\/marmara-haven-villa">Marmara Haven<\/a>/);
  assert.match(alert, /🌐 اللغة: الألمانية/);
});

test("every project has a German name for server emails", () => {
  for (const [slug, names] of Object.entries(PROJECT_NAMES)) assert.ok(names.de, slug);
});

test("record_visit_state and the statistics count /de pages as the same page (0042)", async () => {
  const before = await database("0041");
  const s1 = randomUUID();
  await seen(before, s1, "/contact");
  assert.equal(await seen(before, s1, "/de/contact"), false);
  await before.close();

  const db = await database("0042");
  const s2 = randomUUID();
  assert.equal(await seen(db, s2, "/contact"), false);
  assert.equal(await seen(db, s2, "/de/contact"), true);
  assert.equal(await seen(db, s2, "/delivery"), false); // not a language prefix
  await db.exec(`insert into public.visitor_events (session_id, path, locale, country, created_at) values
    ('${randomUUID()}', '/de/projects/dragos', 'de', 'DE', now() - interval '1 hour'),
    ('${randomUUID()}', '/projects/dragos', 'en', 'DE', now() - interval '1 hour')`);
  const stats = (await db.query("select public.admin_visit_stats(7) as s")).rows[0].s;
  const pages = JSON.stringify(stats);
  assert.ok(!pages.includes("/de/projects"), "German pages are counted under the plain path");
  await db.close();
});
