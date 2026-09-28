// POST /api/book — books a private video tour (src/components/videoTourBooking.ts).
//
// The slot is taken in the database right away (book_tour(), supabase/migrations/0003 and
// 0005: one tour per half-hour slot, no lunch-break slots, validation, max 3 upcoming
// bookings per email/phone), then the visitor gets a confirmation email and the team an
// email + Telegram alert, in the background (waitUntil) so they never delay or break the
// answer.
//
// Answers: 200 {reference} · 409 {error:"slot_taken"} · 429 {error:"limit"} ·
// 400 {error:"invalid"} · 503 {error:"unavailable"} (database not reachable).
import { waitUntil } from "@vercel/functions";
import { sendTelegram } from "./_lib/telegram.js";
import { sendEmail } from "./_lib/email.js";
import { hasSupabase, rpc } from "./_lib/supabase.js";
import {
  TEAM_INBOX,
  teamEmail,
  teamTelegram,
  visitorEmail,
  type App,
  type BookingDetails,
  type ContactMethod,
  type SiteLocale,
  type TourLanguage
} from "./_lib/bookingMessages.js";

const APPS: readonly App[] = ["whatsapp", "facetime", "zoom", "meet"];
const TOUR_LANGUAGES: readonly TourLanguage[] = ["ar", "en", "tr"];
const CONTACTS: readonly ContactMethod[] = ["email", "phone", "whatsapp", "telegram", "viber"];
const LOCALES: readonly SiteLocale[] = ["en", "ar", "fa", "fr", "ru"];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^\+?[0-9][0-9 ()-]{5,28}$/;
const SLUG = /^[a-z0-9-]{1,60}$/;
const BOT_AGENT = /bot|crawl|spider|slurp|headless|lighthouse/i;
/** A person needs far longer than this to go through the three steps. */
const MIN_FILL_MS = 3000;

type Parsed = Omit<BookingDetails, "reference" | "origin" | "projects"> & {
  projects: { slug: string; name: string; nameAr: string }[];
  focusKeys: string[];
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function textList(value: unknown, max: number, itemMax: number): string[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  const items = value.map((v) => text(v, itemMax));
  return items.every(Boolean) ? items : null;
}

function validTimeZone(zone: string): string | null {
  if (!zone || zone.length > 64) return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return zone;
  } catch {
    return null;
  }
}

function parseBooking(body: unknown): Parsed | null {
  if (!body || typeof body !== "object") return null;
  const d = body as Record<string, unknown>;

  // Honeypot (a hidden field people never see) and fill time: bots fail one or both.
  if (text(d.website, 200) || typeof d.elapsedMs !== "number" || d.elapsedMs < MIN_FILL_MS) return null;

  const slot = new Date(text(d.slot, 40));
  // Tours start on the hour or the half hour (Istanbul is a whole number of hours from UTC).
  if (Number.isNaN(slot.getTime()) || slot.getUTCMinutes() % 30 !== 0 || slot.getUTCSeconds() !== 0) return null;

  if (!Array.isArray(d.projects) || !d.projects.length || d.projects.length > 20) return null;
  const projects = d.projects.map((p) => {
    const item = (p ?? {}) as Record<string, unknown>;
    return { slug: text(item.slug, 60), name: text(item.name, 100), nameAr: text(item.nameAr, 100) };
  });
  if (projects.some((p) => !SLUG.test(p.slug) || !p.name || !p.nameAr)) return null;

  const focusKeys = textList(d.focus, 8, 30);
  const focus = textList(d.focusLabels, 8, 80);
  const focusAr = textList(d.focusLabelsAr, 8, 80);
  if (!focusKeys || !focus || !focusAr || focus.length !== focusKeys.length || focusAr.length !== focusKeys.length) return null;

  const app = text(d.app, 20) as App;
  const tourLanguage = text(d.tourLanguage, 4) as TourLanguage;
  const contact = text(d.contact, 20) as ContactMethod;
  const locale = text(d.locale, 4) as SiteLocale;
  const name = text(d.name, 100);
  const email = text(d.email, 254);
  const phone = text(d.phone, 30);
  if (!APPS.includes(app) || !TOUR_LANGUAGES.includes(tourLanguage) || !CONTACTS.includes(contact) || !LOCALES.includes(locale)) return null;
  if (!name || !EMAIL.test(email) || !PHONE.test(phone)) return null;

  return {
    slot,
    projects,
    focusKeys,
    focus,
    focusAr,
    app,
    tourLanguage,
    name,
    email,
    phone,
    contact,
    locale,
    timeZone: validTimeZone(text(d.timeZone, 64)),
    source: text(d.source, 300) || null
  };
}

export async function POST(request: Request): Promise<Response> {
  const booking = parseBooking(await request.json().catch(() => null));
  if (!booking || BOT_AGENT.test(request.headers.get("user-agent") ?? "")) return json({ error: "invalid" }, 400);
  if (!hasSupabase()) {
    console.error("book: Supabase URL / anon key are not set");
    return json({ error: "unavailable" }, 503);
  }

  let result: { reference?: string; error?: string };
  try {
    result = (await rpc("book_tour", {
      p_slot: booking.slot.toISOString(),
      p_projects: booking.projects.map((p) => p.slug),
      p_focus: booking.focusKeys,
      p_app: booking.app,
      p_language: booking.tourLanguage,
      p_name: booking.name,
      p_email: booking.email,
      p_phone: booking.phone,
      p_contact: booking.contact,
      p_locale: booking.locale,
      p_timezone: booking.timeZone,
      p_source: booking.source
    })) as { reference?: string; error?: string };
  } catch (error) {
    console.error(`book: ${error instanceof Error ? error.message : "unknown error"}`);
    return json({ error: "unavailable" }, 503);
  }

  if (result?.error || !result?.reference) {
    const error = result?.error ?? "unavailable";
    return json({ error }, error === "slot_taken" ? 409 : error === "limit" ? 429 : error === "invalid" ? 400 : 503);
  }

  const origin = new URL(request.url).origin;
  const prefix = booking.locale === "en" ? "" : `/${booking.locale}`;
  const details: BookingDetails = {
    ...booking,
    reference: result.reference,
    origin,
    projects: booking.projects.map((p) => ({ name: p.name, nameAr: p.nameAr, url: `${origin}${prefix}/projects/${p.slug}` }))
  };
  waitUntil(notify(details));
  return json({ reference: result.reference });
}

export function GET(): Response {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}

async function notify(details: BookingDetails): Promise<void> {
  const visitor = visitorEmail(details);
  const team = teamEmail(details);
  const results = await Promise.allSettled([
    sendTelegram(teamTelegram(details)),
    sendEmail({
      to: [details.email],
      subject: visitor.subject,
      html: visitor.html,
      text: visitor.text,
      replyTo: TEAM_INBOX,
      attachments: [visitor.attachment]
    }),
    sendEmail({
      to: [process.env.BOOKING_NOTIFY_EMAIL || TEAM_INBOX],
      subject: team.subject,
      html: team.html,
      text: team.text,
      replyTo: details.email
    })
  ]);
  for (const r of results) {
    if (r.status === "rejected") console.error(`book: notify failed: ${r.reason instanceof Error ? r.reason.message : "unknown"}`);
  }
}
