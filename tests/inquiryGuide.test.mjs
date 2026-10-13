// Buyer's Guide questions in the inquiries inbox (api/inquiry.ts, api/_lib/inquiryMessages.ts):
// a contact message with details.form = "guide" and a stage. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../.test-build/inquiry.js";
import { teamTelegram, teamEmail, visitorEmail } from "../.test-build/_lib/inquiryMessages.js";

process.env.VITE_SUPABASE_URL = "https://db.example.test";
process.env.VITE_SUPABASE_ANON_KEY = "anon";
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.RESEND_API_KEY;

const question = {
  kind: "contact",
  name: "Ahmad",
  email: "ahmad@example.com",
  phone: "+90 531 930 92 14",
  message: "How do I open the electricity subscription?",
  details: { form: "guide", stage: "after" },
  locale: "ar",
  page: "/ar/buyers-guide",
  website: "",
  elapsedMs: 20000
};

async function send(body) {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify({ reference: "HQ-ABC123" }), { status: 200 });
  };
  try {
    const res = await POST(new Request("https://www.hadararealestate.com/api/inquiry", { method: "POST", body: JSON.stringify(body), headers: { "user-agent": "Mozilla/5.0" } }));
    return { res, calls };
  } finally {
    globalThis.fetch = realFetch;
  }
}

test("a Buyer's Guide question is saved as a contact message with its stage", async () => {
  const { res, calls } = await send(question);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { reference: "HQ-ABC123" });
  const rpc = calls.find((c) => c.url.endsWith("/rpc/submit_inquiry"));
  assert.ok(rpc);
  assert.equal(rpc.body.p_kind, "contact");
  assert.deepEqual(rpc.body.p_details, { form: "guide", stage: "after" });
});

test("an unknown stage, or a guide form on another kind, is refused", async () => {
  assert.equal((await send({ ...question, details: { form: "guide", stage: "anything" } })).res.status, 400);
  assert.equal((await send({ ...question, details: { form: "other", stage: "after" } })).res.status, 400);
  assert.equal((await send({ ...question, kind: "property_request" })).res.status, 400);
  assert.equal((await send({ ...question, details: {} })).res.status, 200, "a plain contact message still works");
});

const details = {
  reference: "HQ-ABC123",
  kind: "contact",
  guideStage: "after",
  name: "Ahmad",
  email: "ahmad@example.com",
  phone: "+90 531 930 92 14",
  subject: "",
  message: "How do I open the electricity subscription?",
  projects: [],
  interestsAr: [],
  summaryAr: [],
  locale: "ar",
  source: null,
  origin: "https://www.hadararealestate.com"
};

test("the team sees it as a Buyer's Guide question with the stage", () => {
  const tg = teamTelegram(details);
  assert.match(tg, /سؤال من دليل المشتري/);
  assert.match(tg, /المرحلة: بعد استلام المفتاح/);
  assert.match(teamEmail(details).subject, /^سؤال من دليل المشتري: Ahmad \(HQ-ABC123\)$/);
});

test("the visitor gets the 'request received, the relevant team will reply' email in their language", () => {
  const ar = visitorEmail(details);
  assert.match(ar.subject, /تم استلام طلبك/);
  assert.match(ar.text, /الفريق المختص/);
  assert.match(visitorEmail({ ...details, locale: "ru" }).subject, /Мы получили ваш запрос/);
  const plain = visitorEmail({ ...details, guideStage: undefined });
  assert.match(plain.subject, /وصلتنا رسالتك/, "other forms keep their usual email");
});
