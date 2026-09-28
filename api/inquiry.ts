// POST /api/inquiry — saves a message from the site's forms (contact, property request,
// engineering consultation) in the inquiries inbox (submit_inquiry(), migration 0007),
// then tells the team (Telegram + email, reply-to the visitor) and sends the visitor a
// "we received your message" email, in the background (waitUntil).
//
// The browser falls back to the old mailto: delivery when this answers 503 (for example
// before migration 0007 has been run), so a message is never lost.
//
// Answers: 200 {reference} · 429 {error:"limit"} · 400 {error:"invalid"} ·
// 503 {error:"unavailable"}.
import { waitUntil } from "@vercel/functions";
import { sendTelegram } from "./_lib/telegram.js";
import { sendEmail } from "./_lib/email.js";
import { hasSupabase, rpc, RpcError } from "./_lib/supabase.js";
import { TEAM_INBOX, type SiteLocale } from "./_lib/bookingMessages.js";
import { teamEmail, teamTelegram, visitorEmail, type InquiryDetails, type InquiryKind } from "./_lib/inquiryMessages.js";

const KINDS: readonly InquiryKind[] = ["contact", "property_request", "consultation"];
const INTERESTS = ["citizenship", "residence"];
const LOCALES: readonly SiteLocale[] = ["en", "ar", "fr", "ru"];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^\+?[0-9][0-9 ()-]{5,28}$/;
const SLUG = /^[a-z0-9-]{1,60}$/;
const DETAIL_KEY = /^[a-zA-Z]{1,30}$/;
const BOT_AGENT = /bot|crawl|spider|slurp|headless|lighthouse/i;
/** A person needs far longer than this to fill in a form. */
const MIN_FILL_MS = 3000;

interface Parsed {
  kind: InquiryKind;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  projects: { slug: string; nameAr: string }[];
  interests: string[];
  interestsAr: string[];
  details: Record<string, string>;
  summaryAr: [string, string][];
  locale: SiteLocale;
  source: string | null;
  page: string | null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parse(body: unknown): Parsed | null {
  if (!body || typeof body !== "object") return null;
  const d = body as Record<string, unknown>;

  // Honeypot (a hidden field people never see) and fill time: bots fail one or both.
  if (text(d.website, 200) || typeof d.elapsedMs !== "number" || d.elapsedMs < MIN_FILL_MS) return null;

  const kind = text(d.kind, 20) as InquiryKind;
  const locale = text(d.locale, 4) as SiteLocale;
  const name = text(d.name, 100);
  const email = text(d.email, 254);
  const phone = text(d.phone, 30);
  if (!KINDS.includes(kind) || !LOCALES.includes(locale) || !name || !EMAIL.test(email) || !PHONE.test(phone)) return null;

  const rawProjects = d.projects ?? [];
  if (!Array.isArray(rawProjects) || rawProjects.length > 20) return null;
  const projects = rawProjects.map((p) => {
    const item = (p ?? {}) as Record<string, unknown>;
    return { slug: text(item.slug, 60), nameAr: text(item.nameAr, 100) };
  });
  if (projects.some((p) => !SLUG.test(p.slug) || !p.nameAr)) return null;

  const rawInterests = d.interests ?? [];
  const rawInterestsAr = d.interestsAr ?? [];
  if (!Array.isArray(rawInterests) || !Array.isArray(rawInterestsAr) || rawInterests.length !== rawInterestsAr.length) return null;
  const interests = rawInterests.map((i) => text(i, 30));
  const interestsAr = rawInterestsAr.map((i) => text(i, 100));
  if (interests.some((i) => !INTERESTS.includes(i)) || interestsAr.some((i) => !i)) return null;

  const details: Record<string, string> = {};
  const rawDetails = d.details ?? {};
  if (typeof rawDetails !== "object" || Array.isArray(rawDetails)) return null;
  const detailEntries = Object.entries(rawDetails as Record<string, unknown>);
  if (detailEntries.length > 12) return null;
  for (const [key, value] of detailEntries) {
    const v = text(value, 200);
    if (!DETAIL_KEY.test(key)) return null;
    if (v) details[key] = v;
  }

  const rawSummary = d.summaryAr ?? [];
  if (!Array.isArray(rawSummary) || rawSummary.length > 12) return null;
  const summaryAr: [string, string][] = [];
  for (const row of rawSummary) {
    if (!Array.isArray(row) || row.length !== 2) return null;
    const label = text(row[0], 60);
    const value = text(row[1], 200);
    if (label && value) summaryAr.push([label, value]);
  }

  const page = text(d.page, 200);
  return {
    kind,
    name,
    email,
    phone,
    subject: text(d.subject, 200),
    message: text(d.message, 5000),
    projects,
    interests,
    interestsAr,
    details,
    summaryAr,
    locale,
    source: text(d.source, 300) || null,
    page: page.startsWith("/") ? page : null
  };
}

export async function POST(request: Request): Promise<Response> {
  const inquiry = parse(await request.json().catch(() => null));
  if (!inquiry || BOT_AGENT.test(request.headers.get("user-agent") ?? "")) return json({ error: "invalid" }, 400);
  if (!hasSupabase()) {
    console.error("inquiry: Supabase URL / anon key are not set");
    return json({ error: "unavailable" }, 503);
  }

  let result: { reference?: string; error?: string };
  try {
    result = (await rpc("submit_inquiry", {
      p_kind: inquiry.kind,
      p_name: inquiry.name,
      p_email: inquiry.email,
      p_phone: inquiry.phone,
      p_subject: inquiry.subject || null,
      p_message: inquiry.message || null,
      p_projects: inquiry.projects.map((p) => p.slug),
      p_interests: inquiry.interests,
      p_details: inquiry.details,
      p_locale: inquiry.locale,
      p_source: inquiry.source,
      p_page: inquiry.page
    })) as { reference?: string; error?: string };
  } catch (error) {
    // 404: migration 0007 hasn't been run — the browser sends the message by email instead.
    if (error instanceof RpcError && error.status === 404) console.error("inquiry: submit_inquiry is missing — run supabase/migrations/0007");
    else console.error(`inquiry: ${error instanceof Error ? error.message : "unknown error"}`);
    return json({ error: "unavailable" }, 503);
  }

  if (result?.error || !result?.reference) {
    const error = result?.error ?? "unavailable";
    return json({ error }, error === "limit" ? 429 : error === "invalid" ? 400 : 503);
  }

  const origin = new URL(request.url).origin;
  const prefix = inquiry.locale === "en" ? "" : `/${inquiry.locale}`;
  const details: InquiryDetails = {
    reference: result.reference,
    kind: inquiry.kind,
    name: inquiry.name,
    email: inquiry.email,
    phone: inquiry.phone,
    subject: inquiry.subject,
    message: inquiry.message,
    projects: inquiry.projects.map((p) => ({ nameAr: p.nameAr, url: `${origin}${prefix}/projects/${p.slug}` })),
    interestsAr: inquiry.interestsAr,
    summaryAr: inquiry.summaryAr,
    locale: inquiry.locale,
    source: inquiry.source,
    origin
  };
  waitUntil(notify(details));
  return json({ reference: result.reference });
}

export function GET(): Response {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}

async function notify(details: InquiryDetails): Promise<void> {
  const team = teamEmail(details);
  const visitor = visitorEmail(details);
  const results = await Promise.allSettled([
    sendTelegram(teamTelegram(details)),
    sendEmail({
      to: [process.env.BOOKING_NOTIFY_EMAIL || TEAM_INBOX],
      subject: team.subject,
      html: team.html,
      text: team.text,
      replyTo: details.email
    }),
    sendEmail({ to: [details.email], subject: visitor.subject, html: visitor.html, text: visitor.text, replyTo: TEAM_INBOX })
  ]);
  for (const r of results) {
    if (r.status === "rejected") console.error(`inquiry: notify failed: ${r.reason instanceof Error ? r.reason.message : "unknown"}`);
  }
}
