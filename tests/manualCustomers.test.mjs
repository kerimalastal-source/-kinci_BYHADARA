// Customers added by hand on /admin/pipeline (migration 0019): admins only, email optional,
// saved as a 'manual' inquiry with its ad source, and a won deal counts for that ad in the report.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);

/** Every migration from 0002 to 0019; is_admin() follows the test.admin setting. */
async function database() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
    create table public.listings (id int);
    create function public.is_admin() returns boolean language sql as
      $$ select coalesce(current_setting('test.admin', true), 'true') = 'true' $$;`);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql") && f.slice(0, 4) >= "0002" && f.slice(0, 4) <= "0019").sort()) {
    await db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }
  return db;
}

const add = async (db, overrides = {}) => {
  const a = {
    name: "Abu Fahd",
    phone: "+966 50 123 4567",
    email: "",
    country: "SA",
    channel: "whatsapp",
    source: "utm_source=facebook · utm_campaign=gulf-whatsapp",
    projects: ["diamond-marin"],
    note: "Budget 450k, wants citizenship",
    ...overrides
  };
  return (
    await db.query("select public.admin_add_customer($1, $2, $3, $4, $5, $6, $7, $8) as r", [
      a.name, a.phone, a.email, a.country, a.channel, a.source, a.projects, a.note
    ])
  ).rows[0].r;
};

test("an admin adds a WhatsApp customer without an email", async () => {
  const db = await database();
  const r = await add(db);
  assert.match(r.reference, /^HM-[0-9A-F]{6}$/);
  const row = (await db.query("select * from public.inquiries where reference = $1", [r.reference])).rows[0];
  assert.equal(row.kind, "manual");
  assert.equal(row.status, "contacted");
  assert.equal(row.email, "");
  assert.equal(row.phone, "+966 50 123 4567");
  assert.deepEqual(row.details, { form: "manual", channel: "whatsapp", country: "SA" });
  assert.equal(row.message, "Budget 450k, wants citizenship");
  assert.deepEqual(row.projects, ["diamond-marin"]);
  // An email, when given, is stored lower-case; no country is left out of the details.
  const r2 = await add(db, { email: "Someone@Example.com", country: "", phone: "+90 532 000 00 00" });
  const row2 = (await db.query("select email, details from public.inquiries where reference = $1", [r2.reference])).rows[0];
  assert.equal(row2.email, "someone@example.com");
  assert.deepEqual(row2.details, { form: "manual", channel: "whatsapp" });
  await db.close();
});

test("bad input is refused, and only admins may add", async () => {
  const db = await database();
  assert.deepEqual(await add(db, { name: " " }), { error: "invalid" });
  assert.deepEqual(await add(db, { phone: "12" }), { error: "invalid" });
  assert.deepEqual(await add(db, { email: "not-an-email" }), { error: "invalid" });
  assert.deepEqual(await add(db, { channel: "fax" }), { error: "invalid" });
  assert.deepEqual(await add(db, { country: "Saudi" }), { error: "invalid" });
  await db.exec("set test.admin = 'false'");
  assert.deepEqual(await add(db), { error: "forbidden" });
  await db.close();
});

test("the site's forms still can't send a 'manual' inquiry", async () => {
  const db = await database();
  const r = (
    await db.query(
      "select public.submit_inquiry('manual', 'X', 'x@example.com', '+90 555 555 55 55', null, null, '{}', '{}', '{}', 'en', null, null) as r"
    )
  ).rows[0].r;
  assert.deepEqual(r, { error: "invalid" });
  await db.close();
});

test("a won deal from a hand-added customer counts for its ad in the report", async () => {
  const db = await database();
  await add(db);
  await db.query(
    "insert into public.crm_leads (keys, name, phone, stage, deal_value, currency) values ('{p:501234567}', 'Abu Fahd', '+966 50 123 4567', 'won', 450000, 'USD')"
  );
  const report = (await db.query("select public.admin_ad_report(current_date - 1, current_date + 1) as r")).rows[0].r;
  assert.deepEqual(report.won, [{ source: "facebook", campaign: "gulf-whatsapp", value: 450000, currency: "USD" }]);
  assert.deepEqual(report.leads, [{ source: "facebook", campaign: "gulf-whatsapp", inquiries: 1, bookings: 0 }]);
  await db.close();
});

test("0032 adds the 'no reply' stage and the budget range, and rejects anything else", async () => {
  const db = await database();
  const insert = (stage, budget) =>
    db.query("insert into public.crm_leads (keys, name, stage, budget) values ($1, 'Test', $2, $3)", [["p:501234567"], stage, budget]);
  await assert.rejects(db.query("select budget from public.crm_leads"), /budget/);
  await db.exec(readFileSync(new URL("0032_crm_budget_noreply.sql", MIGRATIONS), "utf8"));
  // Twice, as when someone runs it again.
  await db.exec(readFileSync(new URL("0032_crm_budget_noreply.sql", MIGRATIONS), "utf8"));
  await insert("no_reply", "400-500");
  await insert("contacted", null);
  await assert.rejects(insert("ghosted", null), /crm_leads_stage_check/);
  await assert.rejects(insert("new", "650plus"), /crm_leads_budget_check/);
  const rows = (await db.query("select stage, budget from public.crm_leads order by stage desc")).rows;
  assert.deepEqual(rows, [{ stage: "no_reply", budget: "400-500" }, { stage: "contacted", budget: null }]);
});

test("0033 edits a customer on all their records and keeps their pipeline row linked", async () => {
  const db = await database();
  for (const f of ["0032_crm_budget_noreply.sql", "0033_edit_customer.sql"]) await db.exec(readFileSync(new URL(f, MIGRATIONS), "utf8"));
  const r = await add(db);
  const manual = (await db.query("select id from public.inquiries where reference = $1", [r.reference])).rows[0].id;
  // A second message from the same phone, and a second phone of theirs that must stay.
  const other = (
    await db.query(
      "insert into public.inquiries (reference, kind, name, email, phone) values ('HQ-AAAAAA', 'contact', 'Abu Fahd', 'old@example.com', '00966501234567') returning id"
    )
  ).rows[0].id;
  const second = (
    await db.query("insert into public.inquiries (reference, kind, name, email, phone) values ('HQ-BBBBBB', 'contact', 'A F', '', '+974 3333 4444') returning id")
  ).rows[0].id;
  const lead = (
    await db.query("insert into public.crm_leads (keys, name, phone, stage) values ('{p:501234567}', 'Abu Fahd', '+966 50 123 4567', 'contacted') returning id")
  ).rows[0].id;
  const edit = (o = {}) => {
    const a = {
      inquiries: [manual, other, second], bookings: [], lead, oldPhone: "+966 50 123 4567", oldEmail: "old@example.com",
      name: "Fahd Al-Otaibi", phone: "+966 55 999 8888", email: "Fahd@Example.com", manual,
      country: "QA", channel: "call", source: "utm_source=facebook · utm_campaign=gulf-kw-plan", ...o
    };
    return db
      .query("select public.admin_update_customer($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) as r", [
        a.inquiries, a.bookings, a.lead, a.oldPhone, a.oldEmail, a.name, a.phone, a.email, a.manual, a.country, a.channel, a.source
      ])
      .then((x) => x.rows[0].r);
  };
  assert.deepEqual(await edit({ email: "bad" }), { error: "invalid" });
  assert.deepEqual(await edit(), { ok: true });
  const rows = (await db.query("select reference, name, phone, email, details, source from public.inquiries order by reference")).rows;
  const by = Object.fromEntries(rows.map((x) => [x.reference.slice(0, 2) === "HM" ? "manual" : x.reference, x]));
  assert.equal(by.manual.name, "Fahd Al-Otaibi");
  assert.equal(by.manual.phone, "+966 55 999 8888");
  assert.equal(by.manual.email, ""); // its email was not the old main one
  assert.deepEqual(by.manual.details, { form: "manual", channel: "call", country: "QA" });
  assert.equal(by.manual.source, "utm_source=facebook · utm_campaign=gulf-kw-plan");
  assert.equal(by["HQ-AAAAAA"].phone, "+966 55 999 8888"); // same old phone, written differently
  assert.equal(by["HQ-AAAAAA"].email, "fahd@example.com");
  assert.equal(by["HQ-BBBBBB"].phone, "+974 3333 4444"); // their other phone stays
  assert.equal(by["HQ-BBBBBB"].name, "Fahd Al-Otaibi");
  const row = (await db.query("select keys, name, phone, email from public.crm_leads where id = $1", [lead])).rows[0];
  assert.deepEqual([...row.keys].sort(), ["e:fahd@example.com", "p:501234567", "p:559998888"]);
  assert.equal(row.phone, "+966 55 999 8888");
  assert.equal(row.email, "fahd@example.com");
  await db.exec("set test.admin = 'false'");
  assert.deepEqual(await edit(), { error: "forbidden" });
  await db.close();
});
