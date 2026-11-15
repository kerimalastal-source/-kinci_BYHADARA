// "Send me the catalogue" on a project page: a WhatsApp number saved as a customer
// (migration 0041, save_catalog_request()) through POST /api/inquiry with kind "catalog".
// Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { POST } from "../.test-build/inquiry.js";
import { catalogAlert, catalogKey, parseCatalogRequest, CATALOGS } from "../.test-build/_lib/catalogRequest.js";

const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);

async function database() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
    create table public.listings (id int);
    create function public.is_admin() returns boolean language sql as
      $$ select coalesce(current_setting('test.admin', true), 'true') = 'true' $$;`);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql") && f.slice(0, 4) >= "0002" && f.slice(0, 4) <= "0041").sort()) {
    await db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }
  const secret = (await db.query("select value from public.internal_secrets where name = 'cron'")).rows[0].value;
  return { db, secret };
}

const save = async (db, secret, o = {}) => {
  const a = {
    name: "Abu Fahd",
    phone: "+965 9988 7766",
    project: "casablu-vadi",
    catalog: "catalogue-ar",
    message: "catalogue request",
    locale: "ar",
    source: "utm_source=facebook · utm_campaign=gulf-villa-ar",
    page: "/ar/projects/casablu-vadi",
    ...o
  };
  return (
    await db.query("select public.save_catalog_request($1,$2,$3,$4,$5,$6,$7,$8,$9) as r", [
      o.secret ?? secret, a.name, a.phone, a.project, a.catalog, a.message, a.locale, a.source, a.page
    ])
  ).rows[0].r;
};

test("0041 is plain ASCII", () => {
  assert.doesNotMatch(readFileSync(new URL("0041_catalog_requests.sql", MIGRATIONS), "utf8"), /[^\x00-\x7F]/);
});

test("a catalogue request becomes a new customer with its project, source and a pipeline row", async () => {
  const { db, secret } = await database();
  const r = await save(db, secret);
  assert.match(r.reference, /^HC-[0-9A-F]{6}$/);
  assert.equal(r.created, true);
  const row = (await db.query("select * from public.inquiries where reference = $1", [r.reference])).rows[0];
  assert.equal(row.kind, "manual");
  assert.equal(row.status, "new");
  assert.equal(row.name, "Abu Fahd");
  assert.equal(row.email, "");
  assert.equal(row.phone, "+965 9988 7766");
  assert.deepEqual(row.projects, ["casablu-vadi"]);
  assert.deepEqual(row.details, { form: "catalog", catalog: "catalogue-ar" });
  assert.equal(row.site_locale, "ar");
  assert.equal(row.source, "utm_source=facebook · utm_campaign=gulf-villa-ar");
  assert.equal(row.page, "/ar/projects/casablu-vadi");
  const lead = (await db.query("select * from public.crm_leads")).rows;
  assert.equal(lead.length, 1);
  assert.equal(lead[0].stage, "new");
  assert.equal(lead[0].project, "casablu-vadi");
  assert.deepEqual(lead[0].keys, ["p:599887766"]);
});

test("no name: the number stands in for it", async () => {
  const { db, secret } = await database();
  const r = await save(db, secret, { name: "" });
  const row = (await db.query("select name from public.inquiries where reference = $1", [r.reference])).rows[0];
  assert.equal(row.name, "+965 9988 7766");
});

test("the same number asking again for the same project today is not saved twice", async () => {
  const { db, secret } = await database();
  const first = await save(db, secret);
  const again = await save(db, secret, { phone: "+96599887766" });
  assert.equal(again.reference, first.reference);
  assert.equal(again.created, false);
  const other = await save(db, secret, { project: "diamond-marin" });
  assert.equal(other.created, true);
  assert.notEqual(other.reference, first.reference);
  assert.equal((await db.query("select count(*)::int as n from public.inquiries")).rows[0].n, 2);
  assert.equal((await db.query("select count(*)::int as n from public.crm_leads")).rows[0].n, 1, "one pipeline row per person");
});

test("wrong secret, bad input and the daily limit", async () => {
  const { db, secret } = await database();
  assert.deepEqual(await save(db, secret, { secret: "nope" }), { error: "forbidden" });
  assert.deepEqual(await save(db, secret, { phone: "12" }), { error: "invalid" });
  assert.deepEqual(await save(db, secret, { phone: "call me" }), { error: "invalid" });
  assert.deepEqual(await save(db, secret, { project: "Bad Slug" }), { error: "invalid" });
  assert.deepEqual(await save(db, secret, { locale: "arabic" }), { error: "invalid" });
  for (const project of ["a", "b", "c", "d", "e"]) assert.equal((await save(db, secret, { project })).created, true);
  assert.deepEqual(await save(db, secret, { project: "f" }), { error: "limit" });
});

test("only the server's role may call it, and nobody reads the table through it", async () => {
  const { db } = await database();
  const can = async (role) =>
    (await db.query("select has_function_privilege($1, 'public.save_catalog_request(text,text,text,text,text,text,text,text,text)', 'execute') as ok", [role])).rows[0].ok;
  assert.equal(await can("anon"), true);
  assert.equal(await can("authenticated"), false);
});

// ---------- the endpoint ----------

process.env.VITE_SUPABASE_URL = "https://db.example.test";
process.env.VITE_SUPABASE_ANON_KEY = "anon";
delete process.env.TELEGRAM_BOT_TOKEN;

const request = {
  kind: "catalog",
  name: "Abu Fahd",
  phone: "+965 9988 7766",
  project: "casablu-vadi",
  locale: "ar",
  source: "utm_source=facebook",
  page: "/ar/projects/casablu-vadi",
  website: "",
  elapsedMs: 9000
};

async function send(body, { reply = { reference: "HC-ABC123", created: true }, status = 200, secret = "s3cret" } = {}) {
  const calls = [];
  const realFetch = globalThis.fetch;
  if (secret) process.env.CRON_SECRET = secret;
  else delete process.env.CRON_SECRET;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify(reply), { status });
  };
  try {
    const res = await POST(
      new Request("https://www.hadararealestate.com/api/inquiry", { method: "POST", body: JSON.stringify(body), headers: { "user-agent": "Mozilla/5.0 (iPhone)" } })
    );
    return { res, data: await res.json(), calls };
  } finally {
    globalThis.fetch = realFetch;
  }
}

test("the endpoint saves the request with the secret and answers with the catalogue's address", async () => {
  const { res, data, calls } = await send(request);
  assert.equal(res.status, 200);
  assert.deepEqual(data, { reference: "HC-ABC123", url: "/catalogs/hadara-catalogue-ar.pdf" });
  const rpc = calls.find((c) => c.url.endsWith("/rpc/save_catalog_request"));
  assert.ok(rpc, "save_catalog_request was called");
  assert.equal(rpc.body.p_secret, "s3cret");
  assert.equal(rpc.body.p_phone, "+965 9988 7766");
  assert.equal(rpc.body.p_project, "casablu-vadi");
  assert.equal(rpc.body.p_catalog, "catalogue-ar");
  assert.equal(rpc.body.p_locale, "ar");
  assert.equal(calls.some((c) => c.url.endsWith("/rpc/submit_inquiry")), false, "the ordinary inquiry path is not used");
});

test("the villa gets its own brochure; other languages get the English file", async () => {
  assert.equal((await send({ ...request, project: "marmara-haven-villa", locale: "ru" })).data.url, "/catalogs/marmara-haven-villa-en.pdf");
  assert.equal(catalogKey("marmara-haven-villa", "ar"), "villa-ar");
  assert.equal(catalogKey("dragos", "fa"), "catalogue-en");
});

test("every catalogue the server names is a real file in public/catalogs", () => {
  for (const { path } of Object.values(CATALOGS)) {
    assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)), path);
  }
});

test("bots, bad numbers and unknown projects are refused", async () => {
  assert.equal((await send({ ...request, website: "http://spam" })).res.status, 400);
  assert.equal((await send({ ...request, elapsedMs: 300 })).res.status, 400);
  assert.equal((await send({ ...request, phone: "123" })).res.status, 400);
  assert.equal((await send({ ...request, project: "no-such-project" })).res.status, 400);
  assert.equal((await send({ ...request, locale: "tr" })).res.status, 400);
  assert.equal(parseCatalogRequest({ ...request, name: "" })?.name, "", "a name is optional");
});

test("before 0041, without the secret, or over the limit", async () => {
  assert.equal((await send(request, { status: 404, reply: { message: "not found" } })).res.status, 503);
  assert.equal((await send(request, { secret: "" })).res.status, 503);
  assert.equal((await send(request, { reply: { error: "limit" } })).res.status, 429);
  assert.equal((await send(request, { reply: { error: "forbidden" } })).res.status, 503);
});

test("the team's alert carries a WhatsApp message ready to send, in the visitor's language", () => {
  const r = parseCatalogRequest({ ...request, locale: "en", page: "/projects/casablu-vadi" });
  const alert = catalogAlert(r, "HC-ABC123", "catalogue-en");
  assert.match(alert, /طلب كتالوج/);
  assert.match(alert, /Abu Fahd/);
  assert.match(alert, /https:\/\/wa\.me\/96599887766\?text=/);
  const link = alert.match(/https:\/\/wa\.me\/96599887766\?text=([^"]+)"/)[1];
  const text = decodeURIComponent(link.replace(/&amp;/g, "&"));
  assert.match(text, /^Hello Abu, this is the HADARA Real Estate team\./);
  assert.match(text, /https:\/\/www\.hadararealestate\.com\/catalogs\/hadara-catalogue-en\.pdf/);
  assert.match(text, /CasaBlu Vadi/);
  assert.match(alert, /admin\/customers\?q=HC-ABC123/);
  assert.match(alert, /كازا بلو وادي/);
  // No name given: the greeting has no stray space, and the alert says so.
  const anon = catalogAlert(parseCatalogRequest({ ...request, name: "" }), "HC-ABC124", "catalogue-ar");
  assert.match(anon, /لم يكتب اسمه/);
  assert.match(decodeURIComponent(anon.match(/\?text=([^"]+)"/)[1]), /^مرحباً، معك فريق حضارة العقارية/);
});
