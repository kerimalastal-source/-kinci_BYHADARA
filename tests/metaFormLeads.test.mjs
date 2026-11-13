// Meta lead-form leads saved as customers (migration 0038, save_meta_lead()).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);

async function database() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
    create table public.listings (id int);
    create function public.is_admin() returns boolean language sql as
      $$ select coalesce(current_setting('test.admin', true), 'true') = 'true' $$;`);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql") && f.slice(0, 4) >= "0002" && f.slice(0, 4) <= "0038").sort()) {
    await db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }
  const secret = (await db.query("select value from public.internal_secrets where name = 'cron'")).rows[0].value;
  return { db, secret };
}

const save = async (db, secret, o = {}) => {
  const a = {
    id: "1234567890",
    name: "Abu Fahd",
    phone: "+965 9988 7766",
    email: "",
    form: "Villa Marmara Haven · EN/AR · v2",
    ad: "Lead · Video",
    platform: "facebook",
    message: "When are you planning to buy?: Within 3 months",
    project: "marmara-haven-villa",
    source: "utm_source=facebook · utm_campaign=villa-leads",
    created: "2026-11-12T08:00:00Z",
    ...o
  };
  return (
    await db.query("select public.save_meta_lead($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) as r", [
      o.secret ?? secret, a.id, a.name, a.phone, a.email, a.form, a.ad, a.platform, a.message, a.project, a.source, a.created
    ])
  ).rows[0].r;
};

test("migration 0038 is plain ASCII", () => {
  assert.ok(/^[\x00-\x7F]*$/.test(readFileSync(new URL("0038_meta_form_leads.sql", MIGRATIONS), "utf8")));
});

test("a lead becomes a new inquiry and a pipeline row, once", async () => {
  const { db, secret } = await database();
  const r = await save(db, secret);
  assert.match(r.reference, /^HF-[0-9A-F]{6}$/);
  assert.equal(r.created, true);
  const row = (await db.query("select * from public.inquiries where reference = $1", [r.reference])).rows[0];
  assert.equal(row.kind, "manual");
  assert.equal(row.status, "new");
  assert.equal(row.email, "");
  assert.deepEqual(row.projects, ["marmara-haven-villa"]);
  assert.equal(row.details.form, "meta_lead");
  assert.equal(row.details.meta_lead_id, "1234567890");
  assert.equal(new Date(row.created_at).toISOString(), "2026-11-12T08:00:00.000Z");
  const lead = (await db.query("select * from public.crm_leads")).rows;
  assert.equal(lead.length, 1);
  assert.deepEqual(lead[0].keys, ["p:599887766"]);
  assert.equal(lead[0].stage, "new");
  // The same Meta lead again: same reference, nothing new.
  const again = await save(db, secret, { name: "Other" });
  assert.deepEqual(again, { reference: r.reference, created: false });
  assert.equal((await db.query("select count(*)::int as n from public.inquiries")).rows[0].n, 1);
  // A second lead from someone already in the pipeline does not open another row.
  await save(db, secret, { id: "222222222", phone: "+965 9988 7766" });
  assert.equal((await db.query("select count(*)::int as n from public.crm_leads")).rows[0].n, 1);
  await db.close();
});

test("the cron secret is required and bad input is refused", async () => {
  const { db, secret } = await database();
  assert.deepEqual(await save(db, secret, { secret: "wrong" }), { error: "forbidden" });
  assert.deepEqual(await save(db, secret, { id: "abc" }), { error: "invalid" });
  assert.deepEqual(await save(db, secret, { phone: "12", email: "" }), { error: "invalid" });
  assert.deepEqual(await save(db, secret, { platform: "Face Book" }), { error: "invalid" });
  // Email only is fine.
  const r = await save(db, secret, { id: "333333333", phone: "", email: "Someone@Example.com" });
  assert.equal(r.created, true);
  const row = (await db.query("select email from public.inquiries where reference = $1", [r.reference])).rows[0];
  assert.equal(row.email, "someone@example.com");
  await db.close();
});
