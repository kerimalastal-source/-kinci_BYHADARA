// Meta Conversions API (api/_lib/metaCapi.ts, api/meta-event.ts). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parseMetaEvent, hashedUser, capiPayload, sendToMeta } from "../.test-build/_lib/metaCapi.js";

const sha = (v) => createHash("sha256").update(v).digest("hex");
const good = {
  event: "Lead",
  eventId: "0b0f5c2e-1111-4a4a-9c9c-123456789abc",
  url: "https://www.hadararealestate.com/ar/contact?project=marmara-haven-villa",
  fbp: "fb.1.1728400000000.123456789",
  fbc: "fb.1.1728400000000.IwAR0abc_DEF-1",
  params: { content_category: "contact", content_name: "Marmara Haven Villa", evil: "<x>" },
  user: { email: " Ahmad@Example.COM ", phone: "+90 531 930 92 14", name: "Ahmad Al Hasan" }
};

test("only our site's events with a valid ID are accepted", () => {
  assert.ok(parseMetaEvent(good));
  assert.equal(parseMetaEvent({ ...good, event: "Purchase" }), null);
  assert.equal(parseMetaEvent({ ...good, eventId: "x" }), null);
  assert.equal(parseMetaEvent({ ...good, url: "https://evil.example/" }), null);
  assert.equal(parseMetaEvent(null), null);
  const parsed = parseMetaEvent(good);
  assert.equal(parsed.params.evil, undefined, "unknown parameters are dropped");
  assert.equal(parseMetaEvent({ ...good, fbp: "not-a-cookie" }).fbp, "");
});

test("contact details are normalised and hashed, never sent in clear", () => {
  const h = hashedUser(parseMetaEvent(good).user);
  assert.deepEqual(h.em, [sha("ahmad@example.com")]);
  assert.deepEqual(h.ph, [sha("905319309214")]);
  assert.deepEqual(h.fn, [sha("ahmad")]);
  assert.deepEqual(h.ln, [sha("hasan")]);
  const body = JSON.stringify(capiPayload(parseMetaEvent(good), { ip: "1.2.3.4", userAgent: "UA" }));
  assert.ok(!/ahmad|example\.com|5319309214/i.test(body));
  assert.deepEqual(hashedUser({ email: "", phone: "", name: "" }), {});
});

test("the payload carries the browser's event ID (deduplication), cookies, IP and user agent", () => {
  const p = capiPayload(parseMetaEvent(good), { ip: "1.2.3.4", userAgent: "UA" }, new Date("2026-10-09T10:00:00Z"));
  assert.equal(p.event_name, "Lead");
  assert.equal(p.event_id, good.eventId);
  assert.equal(p.event_time, 1791540000);
  assert.equal(p.action_source, "website");
  assert.equal(p.user_data.client_ip_address, "1.2.3.4");
  assert.equal(p.user_data.fbp, good.fbp);
  assert.equal(p.user_data.fbc, good.fbc);
});

test("sends to the dataset's /events with the token; does nothing without a token", async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, body: Object.fromEntries(init.body) });
    return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
  };
  const input = parseMetaEvent(good);
  const skipped = await sendToMeta(input, { ip: "", userAgent: "UA" }, { fetch: fakeFetch });
  assert.equal(skipped.status, "skipped");
  assert.equal(calls.length, 0);
  const sent = await sendToMeta(input, { ip: "", userAgent: "UA" }, { fetch: fakeFetch, token: "tkn", testCode: "TEST123" });
  assert.equal(sent.ok, true);
  assert.equal(calls[0].url, "https://graph.facebook.com/v21.0/983229534799823/events");
  assert.equal(calls[0].body.access_token, "tkn");
  assert.equal(calls[0].body.test_event_code, "TEST123");
  assert.equal(JSON.parse(calls[0].body.data)[0].event_id, good.eventId);
});

test("POST /api/meta-event: 400 for junk, 204 for a valid event, bots ignored", async () => {
  const { POST } = await import("../.test-build/meta-event.js");
  const req = (body, ua = "Mozilla/5.0 (iPhone)") =>
    new Request("https://www.hadararealestate.com/api/meta-event", { method: "POST", headers: { "content-type": "application/json", "user-agent": ua }, body: JSON.stringify(body) });
  delete process.env.META_CAPI_TOKEN;
  assert.equal((await POST(req({ event: "Nope" }))).status, 400);
  assert.equal((await POST(req(good))).status, 204);
  assert.equal((await POST(req(good, "facebookexternalhit/1.1"))).status, 204);
});
