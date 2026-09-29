// The Persian site (/fa) is treated like the other languages by the visitor tracking:
// admin pages aren't tracked, /fa/contact is the contact page (🔥), a /fa project page
// gets its 🏠 line, and in the database (0013, 0014) /fa pages count as the same page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { newVisitorMessage, requestPageMessage } from "../.test-build/_lib/visitAlerts.js";
import { POST } from "../.test-build/track.js";

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
  (await db.query("select public.record_visit_state($1, $2, 'fa', null, 'IR', 'Tehran') as s", [session, path])).rows[0].s
    .seen_before;

const state = { is_new: false, pages_before: 1, seconds: 30, seen_before: false, landing: null, message_id: 1 };
const view = (path, title = "") => ({ sessionId: randomUUID(), path, locale: "fa", referrer: "", title, landingPath: path, landingTitle: title, trail: [], trailSkipped: 0, campaign: "" });
const TEHRAN = { country: "IR", city: "Tehran" };

test("/fa/contact is the contact page (🔥), and a /fa project page gets its 🏠 line", () => {
  assert.match(requestPageMessage(view("/fa/contact"), TEHRAN, state), /🔥 الزائر فتح صفحة التواصل/);
  assert.match(requestPageMessage(view("/fa/property-request"), TEHRAN, state), /طلب عقار مخصص/);
  assert.equal(requestPageMessage(view("/fashion"), TEHRAN, state), null);
  const alert = newVisitorMessage(view("/fa/projects/marmara-haven-villa", "ویلا مرمرا هیون | HADARA"), TEHRAN, "https://www.hadararealestate.com");
  assert.match(alert, /🏠 المشروع: <a href="https:\/\/www\.hadararealestate\.com\/fa\/projects\/marmara-haven-villa">ویلا مرمرا هیون<\/a>/);
  assert.match(alert, /🌐 اللغة: الفارسية/);
});

test("/fa admin and account pages are not tracked", async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response("null", { status: 200 });
  };
  process.env.VITE_SUPABASE_URL = "https://supabase.test";
  process.env.VITE_SUPABASE_ANON_KEY = "anon";
  for (const path of ["/fa/admin", "/fa/admin/bookings", "/fa/account"]) {
    const response = await POST(
      new Request("https://www.hadararealestate.com/api/track", {
        method: "POST",
        headers: { "user-agent": "Mozilla/5.0" },
        body: JSON.stringify({ sessionId: randomUUID(), path, locale: "fa", referrer: "" })
      })
    );
    assert.equal(response.status, 204);
  }
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(calls.filter((url) => url.includes("record_visit")).length, 0);
});

test("record_visit_state: /fa/contact after /contact is the same page (0013)", async () => {
  // Before 0013: the /fa prefix isn't stripped, so it counted as a new page (a second 🔥).
  const before = await database("0012");
  const s1 = randomUUID();
  await seen(before, s1, "/contact");
  assert.equal(await seen(before, s1, "/fa/contact"), false);
  await before.close();

  const db = await database("0013");
  const s2 = randomUUID();
  assert.equal(await seen(db, s2, "/contact"), false);
  assert.equal(await seen(db, s2, "/fa/contact"), true);
  assert.equal(await seen(db, s2, "/fa/about"), false);
  assert.equal(await seen(db, s2, "/fashion"), false); // not a language prefix
  const s3 = randomUUID();
  await seen(db, s3, "/fa");
  assert.equal(await seen(db, s3, "/"), true); // the Persian home page is the home page
  await db.close();
});

test("admin_visit_stats groups /fa pages with the other languages (0014)", async () => {
  const db = await database("0014");
  for (const path of ["/fa/projects/diamond-marin", "/projects/diamond-marin", "/ar/projects/diamond-marin"]) {
    await db.query("insert into visitor_events (session_id, path, locale) values ($1, $2, 'fa')", [randomUUID(), path]);
  }
  const stats = (await db.query("select public.admin_visit_stats(7) as s")).rows[0].s;
  assert.deepEqual(stats.landings, [{ page: "/projects/diamond-marin", visitors: 3 }]);
  await db.close();
});
