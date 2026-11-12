// WhatsApp Business webhook (api/_lib/whatsapp.ts) and save_whatsapp_message() (migration 0039).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { handleMessages, messageSource, newCustomerAlert, parseWebhook, validSignature } from "../.test-build/_lib/whatsapp.js";

const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);

const webhook = (messages, { phoneNumberId = "PN1", contacts = [{ wa_id: "96599887766", profile: { name: "Abu Fahd" } }] } = {}) => ({
  object: "whatsapp_business_account",
  entry: [{ id: "WABA", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: phoneNumberId }, contacts, messages } }] }]
});

const textMessage = (id, ts, body, extra = {}) => ({ id, from: "96599887766", timestamp: String(ts), type: "text", text: { body }, ...extra });

test("parseWebhook reads texts, media labels and the ad referral, and skips other numbers and statuses", () => {
  const body = webhook([
    textMessage("wamid.A", 1762934400, "Hello! Can I get more info on this?", {
      referral: { source_type: "ad", source_id: "52510281419679", headline: "Sea-view villa in Istanbul" }
    }),
    { id: "wamid.B", from: "96599887766", timestamp: "1762934460", type: "image", image: { caption: "this one?" } },
    { id: "wamid.C", from: "96599887766", timestamp: "1762934470", type: "audio" }
  ]);
  const out = parseWebhook(body, "PN1");
  assert.equal(out.length, 3);
  assert.equal(out[0].name, "Abu Fahd");
  assert.equal(out[0].at, 1762934400000);
  assert.deepEqual(out[0].ad, { id: "52510281419679", headline: "Sea-view villa in Istanbul" });
  assert.equal(out[1].text, "[صورة] this one?");
  assert.equal(out[2].text, "[رسالة صوتية]");
  assert.equal(parseWebhook(body, "OTHER").length, 0);
  assert.equal(parseWebhook({ object: "page", entry: [] }).length, 0);
  const statuses = { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { statuses: [{ id: "x" }] } }] }] };
  assert.equal(parseWebhook(statuses).length, 0);
});

test("validSignature accepts only Meta's HMAC of the exact body", () => {
  const raw = JSON.stringify(webhook([textMessage("wamid.A", 1, "hi")]));
  const sig = "sha256=" + createHmac("sha256", "APPSECRET").update(raw).digest("hex");
  assert.equal(validSignature(raw, sig, "APPSECRET"), true);
  assert.equal(validSignature(raw + " ", sig, "APPSECRET"), false);
  assert.equal(validSignature(raw, sig, "OTHER"), false);
  assert.equal(validSignature(raw, null, "APPSECRET"), false);
  assert.equal(validSignature(raw, "sha256=abc", "APPSECRET"), false);
});

test("the ad source names the campaign, or ctwa-<id> for an unknown ad", () => {
  assert.equal(messageSource({ id: "52510281442079", headline: "" }), "utm_source=facebook · utm_campaign=gulf-villa-ar");
  assert.equal(messageSource({ id: "999", headline: "" }), "utm_source=facebook · utm_campaign=ctwa-999");
  assert.equal(messageSource(null), "utm_source=whatsapp");
});

test("handleMessages saves oldest first and alerts only a new customer", async () => {
  const saved = [];
  const alerts = [];
  const msgs = parseWebhook(
    webhook([textMessage("wamid.2", 200, "second"), textMessage("wamid.1", 100, "<first>", { referral: { source_type: "ad", source_id: "52510281419679", headline: "Villa" } })])
  );
  const n = await handleMessages(msgs, {
    secret: "S",
    save: async (args) => {
      saved.push(args);
      return args.p_message_id === "wamid.1" ? { reference: "HW-AAAAAA", created: true } : { reference: "HW-AAAAAA", created: false };
    },
    telegram: async (html) => {
      alerts.push(html);
      return true;
    }
  });
  assert.equal(n, 2);
  assert.deepEqual(saved.map((a) => a.p_message_id), ["wamid.1", "wamid.2"]);
  assert.equal(saved[0].p_source, "utm_source=facebook · utm_campaign=gulf-villa-en");
  assert.equal(saved[0].p_activity, "رسالة من الزبون: <first>");
  assert.equal(alerts.length, 1);
  assert.match(alerts[0], /&lt;first&gt;/);
  assert.match(alerts[0], /HW-AAAAAA/);
  assert.match(alerts[0], /gulf-villa-en/);
  assert.match(newCustomerAlert({ ...msgs[0], ad: null }, "HW-X"), /بدون إعلان/);
});

async function database() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
    create table public.listings (id int);
    create function public.is_admin() returns boolean language sql as
      $$ select coalesce(current_setting('test.admin', true), 'true') = 'true' $$;`);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql") && f.slice(0, 4) >= "0002" && f.slice(0, 4) <= "0039").sort()) {
    await db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }
  const secret = (await db.query("select value from public.internal_secrets where name = 'cron'")).rows[0].value;
  return { db, secret };
}

const save = async (db, secret, o = {}) => {
  const a = { id: "wamid.HBgM1", wa: "96599887766", name: "Abu Fahd", first: "Hello", activity: "msg: Hello", ad: "52510281419679", headline: "Villa", source: "utm_source=facebook · utm_campaign=gulf-villa-en", at: "2026-11-12T08:00:00Z", ...o };
  return (
    await db.query("select public.save_whatsapp_message($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as r", [o.secret ?? secret, a.id, a.wa, a.name, a.first, a.activity, a.ad, a.headline, a.source, a.at])
  ).rows[0].r;
};

test("migration 0039 is plain ASCII", () => {
  assert.ok(/^[\x00-\x7F]*$/.test(readFileSync(new URL("0039_whatsapp_messages.sql", MIGRATIONS), "utf8")));
});

test("a first message opens a customer; later messages only add to the activity log", async () => {
  const { db, secret } = await database();
  const r = await save(db, secret);
  assert.match(r.reference, /^HW-[0-9A-F]{6}$/);
  assert.equal(r.created, true);
  const row = (await db.query("select * from public.inquiries where reference = $1", [r.reference])).rows[0];
  assert.equal(row.kind, "manual");
  assert.equal(row.status, "new");
  assert.equal(row.phone, "+96599887766");
  assert.equal(row.details.form, "whatsapp");
  assert.equal(row.details.ad_id, "52510281419679");
  assert.equal(row.source, "utm_source=facebook · utm_campaign=gulf-villa-en");
  // The same WhatsApp message again: nothing new.
  assert.deepEqual(await save(db, secret), { duplicate: true });
  const r2 = await save(db, secret, { id: "wamid.HBgM2", activity: "msg: second" });
  assert.equal(r2.created, false);
  assert.equal(r2.reference, r.reference);
  assert.equal((await db.query("select count(*)::int as n from public.inquiries")).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int as n from public.crm_leads")).rows[0].n, 1);
  const acts = (await db.query("select kind, body from public.crm_activities order by created_at, kind")).rows;
  assert.deepEqual(acts.filter((a) => a.kind === "whatsapp").map((a) => a.body), ["msg: Hello", "msg: second"]);
  await db.close();
});

test("a number already in the records (added by hand) is not opened again", async () => {
  const { db, secret } = await database();
  const added = (await db.query("select public.admin_add_customer('Ali', '+965 9988 7766', '', 'KW', 'whatsapp', '', '{}', '') as r")).rows[0].r;
  const r = await save(db, secret);
  assert.equal(r.created, false);
  assert.equal(r.reference, added.reference);
  await db.close();
});

test("the cron secret is required and bad input is refused", async () => {
  const { db, secret } = await database();
  assert.deepEqual(await save(db, secret, { secret: "x" }), { error: "forbidden" });
  assert.deepEqual(await save(db, secret, { wa: "+965" }), { error: "invalid" });
  assert.deepEqual(await save(db, secret, { id: "has space" }), { error: "invalid" });
  assert.deepEqual(await save(db, secret, { ad: "abc" }), { error: "invalid" });
  await db.close();
});

test("the webhook endpoint: subscription check and signed calls only", async () => {
  process.env.WHATSAPP_VERIFY_TOKEN = "VERIFY-123";
  process.env.WHATSAPP_APP_SECRET = "APPSECRET";
  const { GET, POST } = await import("../.test-build/meta-event.js");
  const ok = await GET(new Request("https://x/api/whatsapp?hub.mode=subscribe&hub.verify_token=VERIFY-123&hub.challenge=42"));
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "42");
  assert.equal((await GET(new Request("https://x/api/whatsapp?hub.mode=subscribe&hub.verify_token=no&hub.challenge=42"))).status, 403);
  const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  const sig = "sha256=" + createHmac("sha256", "APPSECRET").update(raw).digest("hex");
  const signed = await POST(new Request("https://x/api/whatsapp", { method: "POST", body: raw, headers: { "x-hub-signature-256": sig } }));
  assert.equal(signed.status, 200);
  const forged = await POST(new Request("https://x/api/whatsapp", { method: "POST", body: raw, headers: { "x-hub-signature-256": "sha256=00" } }));
  assert.equal(forged.status, 401);
});
