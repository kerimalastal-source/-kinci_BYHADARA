// The work-system check on Telegram (api/_lib/opsReports.ts + supabase/migrations/0028).
// Run with `npm test`. claim_ops_reports() and release_ops_report() run on PGlite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { opsReportMessage } from "../.test-build/_lib/opsReports.js";

const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);
const SECRET = "s".repeat(40);

async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create table public.listings (id int); create function public.is_admin() returns boolean language sql as 'select true';`);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql") && f >= "0002").sort()) {
    await db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }
  // Running it twice changes nothing.
  await db.exec(readFileSync(new URL("0028_ops_reports.sql", MIGRATIONS), "utf8"));
  await db.query("insert into public.internal_secrets (name, value) values ('cron', $1) on conflict (name) do update set value = excluded.value", [SECRET]);
  return db;
}

const claim = async (db, secret, gap = 0) =>
  (await db.query("select public.claim_ops_reports($1, $2) as r", [secret, gap])).rows[0].r;

test("claim_ops_reports: secret, once per report, oldest first, a week at most", async () => {
  const db = await database();
  assert.deepEqual(await claim(db, "wrong"), { error: "forbidden" });
  assert.deepEqual(await claim(db, SECRET), []);

  await db.exec(`insert into public.ops_reports (body, created_at) values
    ('old', now() - interval '8 days'), ('first', now() - interval '2 hours'), ('second', now())`);
  const due = await claim(db, SECRET);
  assert.deepEqual(due.map((r) => r.body), ["first", "second"]);
  assert.deepEqual(await claim(db, SECRET), []);

  // A report Telegram refused comes back once; the wrong secret changes nothing.
  await db.query("select public.release_ops_report($1, $2)", ["wrong", due[0].id]);
  assert.deepEqual(await claim(db, SECRET), []);
  await db.query("select public.release_ops_report($1, $2)", [SECRET, due[0].id]);
  assert.deepEqual((await claim(db, SECRET)).map((r) => r.body), ["first"]);
});

test("claim_ops_reports: the gap keeps page views from checking more than every two minutes", async () => {
  const db = await database();
  await db.exec("insert into public.ops_reports (body) values ('one')");
  assert.equal((await claim(db, SECRET, 120)).length, 1);
  await db.exec("insert into public.ops_reports (body) values ('two')");
  assert.deepEqual(await claim(db, SECRET, 120), []);
  // The morning job asks without a gap.
  assert.equal((await claim(db, SECRET, 0)).length, 1);
});

test("ops_reports: only the database owner writes; empty or too long is refused", async () => {
  const db = await database();
  const grants = await db.query("select count(*)::int n from information_schema.role_table_grants where table_name = 'ops_reports' and grantee in ('anon', 'authenticated')");
  assert.equal(grants.rows[0].n, 0);
  await assert.rejects(db.query("insert into public.ops_reports (body) values ('')"));
  await assert.rejects(db.query("insert into public.ops_reports (body) values ($1)", ["x".repeat(3501)]));
});

test("opsReportMessage: header and escaped text", () => {
  const m = opsReportMessage("  ✅ منظومة العمل سليمة اليوم <b>  ");
  assert.equal(m, "<b>🩺 منظومة العمل — حضارة للعقار</b>\n✅ منظومة العمل سليمة اليوم &lt;b&gt;");
});
