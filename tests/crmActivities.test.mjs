// The customer activity log (migration 0037): admins only, every stage change logged by
// the database, existing customers start with their stage, and a deleted customer takes
// their log with them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);

/** Every migration from 0002 up to `last`; is_admin() follows the test.admin setting. */
async function database(last = "0037") {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
    create table public.listings (id int);
    create function public.is_admin() returns boolean language sql as
      $$ select coalesce(current_setting('test.admin', true), 'true') = 'true' $$;`);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql") && f.slice(0, 4) >= "0002" && f.slice(0, 4) <= last).sort()) {
    await db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }
  return db;
}

const newLead = async (db, stage = "new") =>
  (await db.query("insert into public.crm_leads (keys, name, stage) values (array['p:501234567'], 'Abu Fahd', $1) returning id", [stage])).rows[0].id;
const log = async (db, id) =>
  (await db.query("select kind, body from public.crm_activities where lead_id = $1 order by created_at, kind", [id])).rows;

test("migration 0037 is plain ASCII", () => {
  const sql = readFileSync(new URL("0037_crm_activities.sql", MIGRATIONS), "utf8");
  assert.ok(/^[\x00-\x7F]*$/.test(sql));
});

test("a new customer and each stage change are logged; other edits are not", async () => {
  const db = await database();
  const id = await newLead(db, "contacted");
  await db.query("update public.crm_leads set follow_up_note = 'call Sunday' where id = $1", [id]);
  await db.query("update public.crm_leads set stage = 'no_reply' where id = $1", [id]);
  await db.query("update public.crm_leads set stage = 'no_reply', deal_value = 10 where id = $1", [id]);
  const rows = await log(db, id);
  assert.deepEqual(
    rows.map((r) => r.body),
    [">contacted", "contacted>no_reply"]
  );
  assert.ok(rows.every((r) => r.kind === "stage"));
  await db.close();
});

test("the team's own entries are kept with their time, and refused for bad kinds", async () => {
  const db = await database();
  const id = await newLead(db);
  await db.query(
    "insert into public.crm_activities (lead_id, kind, body, happened_at) values ($1, 'call', 'Sent villa prices', '2026-11-10T09:00:00Z')",
    [id]
  );
  const row = (await db.query("select body, happened_at from public.crm_activities where kind = 'call'")).rows[0];
  assert.equal(row.body, "Sent villa prices");
  assert.equal(new Date(row.happened_at).toISOString(), "2026-11-10T09:00:00.000Z");
  await assert.rejects(db.query("insert into public.crm_activities (lead_id, kind) values ($1, 'fax')", [id]));
  await assert.rejects(db.query("insert into public.crm_activities (lead_id, kind, body) values ($1, 'note', repeat('x', 2001))", [id]));
  // Deleting the customer's pipeline row removes their log.
  await db.query("delete from public.crm_leads where id = $1", [id]);
  assert.equal((await db.query("select count(*)::int as n from public.crm_activities")).rows[0].n, 0);
  await db.close();
});

test("customers already in the pipeline start their log with their current stage", async () => {
  const db = await database("0036");
  const id = await newLead(db, "negotiation");
  await db.exec(readFileSync(new URL("0037_crm_activities.sql", MIGRATIONS), "utf8"));
  assert.deepEqual(await log(db, id), [{ kind: "stage", body: ">negotiation" }]);
  // Running it again adds nothing.
  await db.exec(readFileSync(new URL("0037_crm_activities.sql", MIGRATIONS), "utf8"));
  assert.equal((await log(db, id)).length, 1);
  await db.close();
});

test("only admins see the log; anon has no access", async () => {
  const db = await database();
  const id = await newLead(db);
  await db.exec("grant usage on schema public to authenticated, anon");
  await db.exec("set role authenticated; set test.admin = 'false'");
  assert.equal((await db.query("select count(*)::int as n from public.crm_activities")).rows[0].n, 0);
  await assert.rejects(db.query("insert into public.crm_activities (lead_id, kind, body) values ($1, 'note', 'x')", [id]));
  await db.exec("reset role; set role anon");
  await assert.rejects(db.query("select * from public.crm_activities"));
  await db.exec("reset role; set test.admin = 'true'; set role authenticated");
  assert.equal((await db.query("select count(*)::int as n from public.crm_activities")).rows[0].n, 1);
  await db.close();
});
