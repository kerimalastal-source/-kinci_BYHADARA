// Telegram alerts for Meta lead-form ads (api/_lib/metaLeads.ts). Run with `npm test`.
// No network: a fake fetch plays Meta's Graph API, an in-memory store plays Vercel Blob.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkLeads, leadMessage, leadTime } from "../.test-build/_lib/metaLeads.js";

const NOW = Date.parse("2026-10-14T09:00:00Z");
const FORM = {
  name: "Villa Marmara Haven · EN/AR",
  questions: [
    { key: "budget", label: "The villa is offered from US$1,550,000. Is this within your budget?", options: [{ key: "yes", value: "Yes, within my budget" }] },
    { key: "when", label: "When are you planning to buy?" }
  ]
};
const lead = (id, minutesAgo, extra = {}) => ({
  id,
  created_time: new Date(NOW - minutesAgo * 60_000).toISOString().replace(/\.\d+Z$/, "+0000"),
  field_data: [
    { name: "full_name", values: ["Ali <Test>"] },
    { name: "phone_number", values: ["+90 531 000 00 00"] },
    { name: "email", values: ["ali@example.com"] },
    { name: "budget", values: ["yes"] },
    { name: "when", values: ["1–6 months"] }
  ],
  ad_name: "Lead · Video · EN/AR form · cold",
  platform: "ig",
  ...extra
});

function setup({ leads = { F1: [lead("L1", 5)] }, failToken = false, telegramOk = true } = {}) {
  const files = new Set();
  const sent = [];
  const calls = [];
  const store = {
    async claim(path) {
      if (files.has(path)) return false;
      files.add(path);
      return true;
    },
    async remove(path) {
      files.delete(path);
    }
  };
  const fetch = async (url) => {
    const u = new URL(url);
    calls.push(u);
    const path = u.pathname.replace("/v21.0/", "");
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (path === "PAGE") return json({ access_token: "PAGE_TOKEN" });
    if (failToken) return json({ error: { code: 200, message: "Requires leads_retrieval permission" } }, 403);
    if (path.endsWith("/leads")) return json({ data: leads[path.split("/")[0]] ?? [] });
    return json(FORM);
  };
  const deps = {
    fetch,
    token: "SYSTEM_TOKEN",
    pageId: "PAGE",
    forms: Object.keys(leads),
    store,
    telegram: async (html) => {
      if (!telegramOk) return false;
      sent.push(html);
      return true;
    },
    now: () => NOW
  };
  return { deps, files, sent, calls };
}

test("leadTime reads Meta's +0000 offset", () => {
  assert.equal(leadTime("2026-10-14T01:30:00+0000"), Date.parse("2026-10-14T01:30:00Z"));
  assert.equal(leadTime("nonsense"), null);
});

test("a new lead is sent once, with escaped values and answer labels", async () => {
  const { deps, sent, calls } = setup();
  assert.equal(await checkLeads(deps), 1);
  assert.equal(await checkLeads(deps), 0);
  assert.equal(sent.length, 1);
  const html = sent[0];
  assert.match(html, /Ali &lt;Test&gt;/);
  assert.match(html, /wa\.me\/905310000000/);
  assert.match(html, /Yes, within my budget/);
  assert.match(html, /1–6 months/);
  assert.match(html, /إنستغرام/);
  assert.match(html, /leads_center\?asset_id=PAGE/);
  // Leads are read with the page token, and only from the last two days.
  const leadsCall = calls.find((u) => u.pathname.endsWith("/leads"));
  assert.equal(leadsCall.searchParams.get("access_token"), "PAGE_TOKEN");
  const filter = JSON.parse(leadsCall.searchParams.get("filtering"));
  assert.equal(filter[0].value, Math.floor(NOW / 1000) - 2 * 24 * 3600);
});

test("leads go out oldest first, across forms", async () => {
  const { deps, sent } = setup({ leads: { F1: [lead("L2", 1, { field_data: [{ name: "full_name", values: ["Second"] }] }), lead("L1", 30)], F2: [] } });
  assert.equal(await checkLeads(deps), 2);
  assert.match(sent[0], /Ali/);
  assert.match(sent[1], /Second/);
});

test("a failed Telegram message is released and retried next time", async () => {
  const s = setup({ telegramOk: false });
  assert.equal(await checkLeads(s.deps), 0);
  assert.equal(s.files.size, 0);
  s.deps.telegram = async (html) => (s.sent.push(html), true);
  assert.equal(await checkLeads(s.deps), 1);
});

test("a missing permission warns on Telegram once a day", async () => {
  const { deps, sent } = setup({ failToken: true });
  assert.equal(await checkLeads(deps), 0);
  assert.equal(await checkLeads(deps), 0);
  assert.equal(sent.length, 1);
  assert.match(sent[0], /leads_retrieval/);
  assert.doesNotMatch(sent[0], /SYSTEM_TOKEN|PAGE_TOKEN/);
});

test("leadMessage works without phone, answers or time", () => {
  const html = leadMessage({ id: "X", field_data: [{ name: "full_name", values: ["Only Name"] }] }, { name: "Form", questions: [] }, "PAGE");
  assert.match(html, /Only Name/);
  assert.doesNotMatch(html, /wa\.me/);
});
