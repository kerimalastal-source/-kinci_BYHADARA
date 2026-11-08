// The small form at the end of every project page (src/components/projectQuickForm.ts):
// a contact message with details.form = "project" and that one project. The team's email
// and Telegram alert name the project and the page; the visitor's email names the project.
// Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../.test-build/inquiry.js";
import { teamTelegram, teamEmail, visitorEmail } from "../.test-build/_lib/inquiryMessages.js";

process.env.VITE_SUPABASE_URL = "https://db.example.test";
process.env.VITE_SUPABASE_ANON_KEY = "anon";
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.RESEND_API_KEY;

const request = {
  kind: "contact",
  name: "Ahmad",
  email: "ahmad@example.com",
  phone: "+90 531 930 92 14",
  projects: [{ slug: "marmara-haven-villa", nameAr: "Marmara Haven Villa" }],
  details: { form: "project" },
  locale: "en",
  page: "/projects/marmara-haven-villa",
  website: "",
  elapsedMs: 20000
};

async function send(body) {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify({ reference: "HQ-PRJ001" }), { status: 200 });
  };
  try {
    const res = await POST(new Request("https://www.hadararealestate.com/api/inquiry", { method: "POST", body: JSON.stringify(body), headers: { "user-agent": "Mozilla/5.0" } }));
    return { res, calls };
  } finally {
    globalThis.fetch = realFetch;
  }
}

test("a project-page request is saved as a contact message with its project", async () => {
  const { res, calls } = await send(request);
  assert.equal(res.status, 200);
  const rpc = calls.find((c) => c.url.endsWith("/rpc/submit_inquiry"));
  assert.ok(rpc);
  assert.equal(rpc.body.p_kind, "contact");
  assert.deepEqual(rpc.body.p_projects, ["marmara-haven-villa"]);
  assert.deepEqual(rpc.body.p_details, { form: "project" });
  assert.equal(rpc.body.p_page, "/projects/marmara-haven-villa");
});

test("a project form needs exactly one known project on a contact message", async () => {
  assert.equal((await send({ ...request, projects: [] })).res.status, 400);
  assert.equal((await send({ ...request, projects: [{ slug: "no-such-project", nameAr: "x" }] })).res.status, 400);
  assert.equal((await send({ ...request, projects: [...request.projects, { slug: "diamond-marin", nameAr: "Diamond Marin" }] })).res.status, 400);
  assert.equal((await send({ ...request, kind: "property_request" })).res.status, 400);
});

const details = {
  reference: "HQ-PRJ001",
  kind: "contact",
  project: { name: "Marmara Haven Villa", nameAr: "فيلا مرمرة هيفن", page: "https://www.hadararealestate.com/ar/projects/marmara-haven-villa" },
  name: "Ahmad",
  email: "ahmad@example.com",
  phone: "+90 531 930 92 14",
  subject: "",
  message: "",
  projects: [{ nameAr: "فيلا مرمرة هيفن", url: "https://www.hadararealestate.com/projects/marmara-haven-villa" }],
  interestsAr: [],
  summaryAr: [],
  locale: "en",
  source: null,
  origin: "https://www.hadararealestate.com"
};

test("the team sees which project page the request came from", () => {
  const tg = teamTelegram(details);
  assert.match(tg, /طلب من صفحة مشروع فيلا مرمرة هيفن/);
  assert.match(tg, /\/ar\/projects\/marmara-haven-villa/);
  const email = teamEmail(details);
  assert.equal(email.subject, "طلب جديد لمشروع فيلا مرمرة هيفن: Ahmad (HQ-PRJ001)");
  assert.match(email.html, /صفحة المشروع التي أُرسل منها/);
  assert.match(email.text, /https:\/\/www\.hadararealestate\.com\/ar\/projects\/marmara-haven-villa/);
});

test("the visitor's email says the request about the project was received", () => {
  const en = visitorEmail(details);
  assert.equal(en.subject, "We received your request about Marmara Haven Villa — HADARA Real Estate (HQ-PRJ001)");
  assert.match(en.text, /Thank you for your interest in Marmara Haven Villa/);
  assert.match(en.text, /will contact you shortly/);
  const ar = visitorEmail({ ...details, locale: "ar", project: { ...details.project, name: "فيلا مرمرة هيفن" } });
  assert.match(ar.subject, /^تم استلام طلبك بخصوص فيلا مرمرة هيفن/);
  assert.match(ar.text, /سيتواصل معك أحد مستشارينا قريباً/);
});
