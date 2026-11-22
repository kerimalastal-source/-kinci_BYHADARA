// Coexistence: the team's replies from the WhatsApp Business app (smb_message_echoes,
// api/_lib/whatsapp.ts + migration 0043) and the contacts/history sync started right after
// the number is connected (api/_lib/whatsappConnect.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { handleEchoes, parseEchoes, parseWebhook } from "../.test-build/_lib/whatsapp.js";
import { connectWhatsApp, connectedAlert } from "../.test-build/_lib/whatsappConnect.js";

const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);

const echoHook = (echoes, phoneNumberId = "PN1") => ({
  object: "whatsapp_business_account",
  entry: [{ id: "WABA", changes: [{ field: "smb_message_echoes", value: { messaging_product: "whatsapp", metadata: { phone_number_id: phoneNumberId }, message_echoes: echoes } }] }]
});
const echo = (id, ts, body, to = "96599887766") => ({ from: "905321392523", to, id, timestamp: String(ts), type: "text", text: { body } });

test("parseEchoes reads the team's replies; parseWebhook ignores them", () => {
  const body = echoHook([echo("wamid.E1", 1763800000, "Here is the villa catalogue"), { ...echo("wamid.E2", 1763800010, "x"), to: undefined, to_user_id: "BSUID" }]);
  const out = parseEchoes(body, "PN1");
  assert.deepEqual(out, [{ id: "wamid.E1", waId: "96599887766", at: 1763800000000, text: "Here is the villa catalogue" }]);
  assert.equal(parseEchoes(body, "OTHER").length, 0);
  assert.equal(parseWebhook(body).length, 0, "an echo is never taken for a customer's message");
  const msgs = { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { messages: [{ id: "wamid.M", from: "96599887766", timestamp: "1", type: "text", text: { body: "hi" } }] } }] }] };
  assert.equal(parseEchoes(msgs).length, 0);
});

test("handleEchoes saves oldest first with the team label and counts only the saved ones", async () => {
  const calls = [];
  const n = await handleEchoes(parseEchoes(echoHook([echo("wamid.B", 200, "second"), echo("wamid.A", 100, "first")])), {
    secret: "S",
    save: async (args) => {
      calls.push(args);
      return args.p_message_id === "wamid.A" ? { saved: true } : { skipped: true };
    }
  });
  assert.equal(n, 1);
  assert.deepEqual(calls.map((c) => c.p_message_id), ["wamid.A", "wamid.B"]);
  assert.equal(calls[0].p_activity, "رسالة من الفريق: first");
});

async function database() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
    create table public.listings (id int);
    create function public.is_admin() returns boolean language sql as
      $$ select coalesce(current_setting('test.admin', true), 'true') = 'true' $$;`);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql") && f.slice(0, 4) >= "0002" && f.slice(0, 4) <= "0043").sort()) {
    await db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }
  const secret = (await db.query("select value from public.internal_secrets where name = 'cron'")).rows[0].value;
  return { db, secret };
}
const saveMsg = (db, secret, id, at) =>
  db.query("select public.save_whatsapp_message($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as r", [secret, id, "96599887766", "Abu Fahd", "Hello", "msg", "", "", "utm_source=whatsapp", at]).then((r) => r.rows[0].r);
const saveEcho = (db, secret, id, at, wa = "96599887766") =>
  db.query("select public.save_whatsapp_echo($1,$2,$3,$4,$5) as r", [secret, id, wa, "team: reply", at]).then((r) => r.rows[0].r);

test("migration 0043 is plain ASCII", () => {
  assert.ok(/^[\x00-\x7F]*$/.test(readFileSync(new URL("0043_whatsapp_echoes.sql", MIGRATIONS), "utf8")));
});

test("a reply to a customer goes to their log; a reply to anyone else is not saved", async () => {
  const { db, secret } = await database();
  assert.deepEqual(await saveEcho(db, secret, "wamid.X", "2026-11-22T08:00:00Z", "905550001122"), { skipped: true });
  assert.equal((await db.query("select count(*)::int as n from public.inquiries")).rows[0].n, 0, "no customer opened by the team");
  const first = await saveMsg(db, secret, "wamid.M1", "2026-11-22T08:00:00Z");
  const r = await saveEcho(db, secret, "wamid.E1", "2026-11-22T08:05:00Z");
  assert.equal(r.saved, true);
  assert.equal(r.reference, first.reference);
  assert.deepEqual(await saveEcho(db, secret, "wamid.E1", "2026-11-22T08:05:00Z"), { duplicate: true });
  const acts = (await db.query("select body, from_team from public.crm_activities where kind = 'whatsapp' order by happened_at")).rows;
  assert.deepEqual(acts, [{ body: "msg", from_team: false }, { body: "team: reply", from_team: true }]);
  await db.close();
});

test("the team's replies do not count as the customer's last message", async () => {
  const { db, secret } = await database();
  await saveMsg(db, secret, "wamid.M1", "2026-11-20T08:00:00Z");
  await saveEcho(db, secret, "wamid.E1", "2026-11-21T08:00:00Z");
  const r = await saveMsg(db, secret, "wamid.M2", "2026-11-22T08:00:00Z");
  assert.equal(r.returning, true);
  assert.equal(new Date(r.last_at).toISOString(), "2026-11-20T08:00:00.000Z");
  await db.close();
});

test("the cron secret is required and bad input is refused", async () => {
  const { db, secret } = await database();
  assert.deepEqual(await saveEcho(db, "wrong", "wamid.E1", "2026-11-22T08:00:00Z"), { error: "forbidden" });
  assert.deepEqual(await saveEcho(db, secret, "bad id", "2026-11-22T08:00:00Z"), { error: "invalid" });
  const anon = await db.query("select has_function_privilege('anon', 'public.save_whatsapp_echo(text, text, text, text, timestamptz)', 'execute') as a, has_function_privilege('authenticated', 'public.save_whatsapp_echo(text, text, text, text, timestamptz)', 'execute') as b");
  assert.deepEqual(anon.rows[0], { a: true, b: false });
  await db.close();
});

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("after subscribing, the contacts and history sync are started for each number", async () => {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    calls.push({ path: u.pathname, method: init.method ?? "GET", body: init.body ? JSON.parse(init.body) : null });
    if (u.pathname.endsWith("/oauth/access_token")) return json({ access_token: "T" });
    if (u.pathname.endsWith("/phone_numbers")) return json({ data: [{ id: "555666777888", display_phone_number: "+90 532 139 25 23" }] });
    if (u.pathname.endsWith("/subscribed_apps")) return json({ success: true });
    if (u.pathname.endsWith("/555666777888/smb_app_data")) return json({ messaging_product: "whatsapp", request_id: "R" });
    return json({ error: { message: "unknown" } }, 400);
  };
  const notes = [];
  const result = await connectWhatsApp({ code: "C", wabaId: "111222333444", phoneNumberId: "" }, { fetch, appId: "1", appSecret: "S", telegram: async (h) => notes.push(h) });
  const syncs = calls.filter((c) => c.path.endsWith("/smb_app_data"));
  assert.deepEqual(syncs.map((c) => [c.method, c.body.sync_type]), [["POST", "smb_app_state_sync"], ["POST", "history"]]);
  assert.deepEqual(result.sync, [{ id: "555666777888", contacts: true, history: true }]);
  assert.match(notes[0], /بدأت مزامنة/);
  assert.equal(calls.some((c) => c.path.endsWith("/register")), false);
});

test("a failed sync is reported with the 24-hour warning", () => {
  const html = connectedAlert({ ok: true, wabaId: "1", numbers: [], subscribed: true, sync: [{ id: "5", contacts: true, history: false, detail: "100 <bad>" }] });
  assert.match(html, /24 ساعة/);
  assert.match(html, /100 &lt;bad&gt;/);
});
