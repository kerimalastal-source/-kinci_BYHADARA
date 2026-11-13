// Connecting a WhatsApp number through Embedded Signup (api/_lib/whatsappConnect.ts), and the
// webhook's number filter accepting several numbers (api/_lib/whatsapp.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { connectWhatsApp, connectedAlert, parseConnectInput, redirectCandidates } from "../.test-build/_lib/whatsappConnect.js";
import { parseWebhook } from "../.test-build/_lib/whatsapp.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** A fake Graph API: records the calls and answers by path. */
function fakeGraph(routes) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    calls.push({ path: u.pathname, method: init.method ?? "GET", params: Object.fromEntries(u.searchParams) });
    for (const [match, answer] of routes) if (u.pathname.endsWith(match)) return typeof answer === "function" ? answer(u, init) : answer;
    return json({ error: { code: 100, message: "unknown path" } }, 400);
  };
  return { fetch, calls };
}

test("parseConnectInput accepts the admin page's body and rejects anything else", () => {
  assert.deepEqual(parseConnectInput({ action: "whatsapp-connect", code: "AQB-x_1", wabaId: "2895927427455219", phoneNumberId: "" }), {
    code: "AQB-x_1",
    wabaId: "2895927427455219",
    phoneNumberId: ""
  });
  assert.equal(parseConnectInput({ action: "other", code: "x" }), null);
  assert.equal(parseConnectInput({ action: "whatsapp-connect", code: "" }), null);
  assert.equal(parseConnectInput({ action: "whatsapp-connect", code: "a b" }), null);
  assert.equal(parseConnectInput({ action: "whatsapp-connect", code: "x", wabaId: "12; drop" }), null);
  assert.equal(parseConnectInput(null), null);
});

test("connectWhatsApp trades the code, lists the numbers, subscribes the app and tells Telegram", async () => {
  const graph = fakeGraph([
    ["/oauth/access_token", json({ access_token: "BIZ-TOKEN" })],
    ["/111222333444/phone_numbers", json({ data: [{ id: "555666777888", display_phone_number: "+90 532 139 25 23", verified_name: "HADARA Real Estate" }] })],
    ["/111222333444/subscribed_apps", json({ success: true })]
  ]);
  const notes = [];
  const result = await connectWhatsApp(
    { code: "CODE", wabaId: "111222333444", phoneNumberId: "" },
    { fetch: graph.fetch, appId: "1839985177009532", appSecret: "SECRET", telegram: async (html) => notes.push(html) }
  );
  assert.equal(result.ok, true);
  assert.equal(result.subscribed, true);
  assert.deepEqual(result.numbers, [{ id: "555666777888", display: "+90 532 139 25 23", name: "HADARA Real Estate" }]);
  const exchange = graph.calls[0];
  assert.equal(exchange.params.client_id, "1839985177009532");
  assert.equal(exchange.params.client_secret, "SECRET");
  assert.equal(exchange.params.code, "CODE");
  assert.equal(graph.calls.at(-1).method, "POST");
  assert.equal(graph.calls.at(-1).params.access_token, "BIZ-TOKEN");
  assert.equal(graph.calls.some((c) => c.path.endsWith("/register")), false, "coexistence numbers are never registered");
  assert.equal(notes.length, 1);
  assert.match(notes[0], /555666777888/);
  assert.equal(JSON.stringify(result).includes("BIZ-TOKEN"), false, "the token never leaves the server");
});

test("connectWhatsApp finds the WABA from the phone number when the popup only sent the number", async () => {
  const graph = fakeGraph([
    ["/oauth/access_token", json({ access_token: "T" })],
    ["/555666777888", json({ whatsapp_business_account: { id: "111222333444" } })],
    ["/111222333444/phone_numbers", json({ data: [{ id: "555666777888", display_phone_number: "+90 532 139 25 23" }, { id: "999", display_phone_number: "+1 555" }] })],
    ["/111222333444/subscribed_apps", json({ success: true })]
  ]);
  const result = await connectWhatsApp({ code: "C", wabaId: "", phoneNumberId: "555666777888" }, { fetch: graph.fetch, appId: "1", appSecret: "S" });
  assert.equal(result.ok, true);
  assert.equal(result.wabaId, "111222333444");
  assert.deepEqual(result.numbers.map((n) => n.id), ["555666777888"]);
});

test("connectWhatsApp reports which step failed, with Meta's message", async () => {
  const badCode = fakeGraph([["/oauth/access_token", json({ error: { code: 100, message: "This authorization code has expired." } }, 400)]]);
  const r1 = await connectWhatsApp({ code: "OLD", wabaId: "111222333444", phoneNumberId: "" }, { fetch: badCode.fetch, appId: "1", appSecret: "S" });
  assert.equal(r1.ok, false);
  assert.equal(r1.error, "token");
  assert.match(r1.detail, /expired/);

  const noSub = fakeGraph([
    ["/oauth/access_token", json({ access_token: "T" })],
    ["/111222333444/phone_numbers", json({ data: [{ id: "555666777888" }] })],
    ["/111222333444/subscribed_apps", json({ error: { code: 200, message: "Permissions error" } }, 403)]
  ]);
  const notes = [];
  const r2 = await connectWhatsApp(
    { code: "C", wabaId: "111222333444", phoneNumberId: "" },
    { fetch: noSub.fetch, appId: "1", appSecret: "S", telegram: async (h) => notes.push(h) }
  );
  assert.equal(r2.ok, false);
  assert.equal(r2.error, "subscribe");
  assert.match(r2.detail, /Permissions/);
  assert.match(notes[0], /لم يتم/);
});

test("connectedAlert escapes what Meta sends back", () => {
  const html = connectedAlert({ ok: true, wabaId: "1", subscribed: true, numbers: [{ id: "2", display: "+90", name: "<b>x</b>" }] });
  assert.equal(html.includes("<b>x</b>"), false);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
});

test("the webhook's number filter accepts a comma-separated list", () => {
  const body = (pn) => ({
    object: "whatsapp_business_account",
    entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: pn }, messages: [{ id: `wamid.${pn}`, from: "905321112233", timestamp: "1762934400", type: "text", text: { body: "hi" } }] } }] }]
  });
  assert.equal(parseWebhook(body("NEW"), "OLD, NEW").length, 1);
  assert.equal(parseWebhook(body("OLD"), "OLD,NEW").length, 1);
  assert.equal(parseWebhook(body("OTHER"), "OLD,NEW").length, 0);
  assert.equal(parseWebhook(body("ANY"), "").length, 1);
  assert.equal(parseWebhook(body("ANY")).length, 1);
});

test("a redirect_uri mismatch retries with the page, the site root and Facebook's login page", async () => {
  const tried = [];
  const graph = fakeGraph([
    [
      "/oauth/access_token",
      (u) => {
        tried.push(u.searchParams.get("redirect_uri"));
        return u.searchParams.get("redirect_uri") === "https://www.hadararealestate.com/ar/admin"
          ? json({ access_token: "T" })
          : json({ error: { code: 100, message: "Error validating verification code. Please make sure your redirect_uri is identical to the one you used in the OAuth dialog request" } }, 400);
      }
    ],
    ["/111222333444/phone_numbers", json({ data: [{ id: "555666777888" }] })],
    ["/111222333444/subscribed_apps", json({ success: true })]
  ]);
  const input = parseConnectInput({ action: "whatsapp-connect", code: "C", wabaId: "111222333444", phoneNumberId: "", page: "https://www.hadararealestate.com/ar/admin" });
  const result = await connectWhatsApp(input, { fetch: graph.fetch, appId: "1", appSecret: "S" });
  assert.equal(result.ok, true);
  assert.deepEqual(tried, [null, "https://www.hadararealestate.com/ar/admin"]);
});

test("redirectCandidates never sends another site's address, and an expired code is not retried", async () => {
  assert.deepEqual(redirectCandidates("https://evil.example/x"), [null, "https://www.hadararealestate.com/", "https://www.facebook.com/connect/login_success.html"]);
  const tried = [];
  const graph = fakeGraph([["/oauth/access_token", (u) => (tried.push(u.searchParams.get("redirect_uri")), json({ error: { code: 100, message: "This authorization code has expired." } }, 400))]]);
  const r = await connectWhatsApp({ code: "C", wabaId: "111222333444", phoneNumberId: "", page: "https://www.hadararealestate.com/ar/admin" }, { fetch: graph.fetch, appId: "1", appSecret: "S" });
  assert.equal(r.error, "token");
  assert.equal(tried.length, 1);
});
