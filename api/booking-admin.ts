// POST /api/booking-admin — the team's actions on a video tour booking from the admin
// bookings page (src/pages/admin/bookings.ts) that email the visitor:
//
//   {action: "confirm", id}            status → confirmed, "your tour is confirmed" email
//   {action: "reschedule", id, slot}   new time (admin_reschedule_tour(), migration 0005),
//                                      "new time — does it suit you?" email with two links
//                                      to /api/tour-reply
//
// The request carries the admin's own Supabase access token (Authorization: Bearer …),
// and every database call is made with it, so row-level security and is_admin() decide —
// this endpoint can't do anything the signed-in person couldn't do in the browser.
// Cancelling and restoring stay in the browser: they never email the visitor.
//
// Answers: 200 {booking, emailSent} · 400 invalid · 401 not signed in · 403 not an admin ·
// 404 no such booking · 409 {error:"slot_taken"} · 503 database unreachable.
import { sendEmail } from "./_lib/email.js";
import { hasSupabase, restAs } from "./_lib/supabase.js";
import { TEAM_INBOX, visitorEmail, type BookingDetails, type SiteLocale } from "./_lib/bookingMessages.js";

const LOCALES: readonly SiteLocale[] = ["en", "ar", "fr", "ru"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9-]{1,60}$/;

/** A row of public.tour_bookings (migrations 0003 + 0005). */
interface BookingRow {
  id: string;
  reference: string;
  slot_start: string;
  projects: string[];
  app: BookingDetails["app"];
  tour_language: BookingDetails["tourLanguage"];
  name: string;
  email: string;
  phone: string;
  contact_method: BookingDetails["contact"];
  site_locale: string | null;
  visitor_timezone: string | null;
  source: string | null;
  status: string;
  reply_token?: string | null;
}

/** Project names as the admin page knows them: in the booking's site language and in Arabic. */
type Names = Record<string, { name: string; nameAr: string }>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseNames(value: unknown): Names {
  const names: Names = {};
  if (!value || typeof value !== "object") return names;
  for (const [slug, item] of Object.entries(value as Record<string, unknown>).slice(0, 20)) {
    const entry = (item ?? {}) as Record<string, unknown>;
    const name = text(entry.name, 100);
    const nameAr = text(entry.nameAr, 100);
    if (SLUG.test(slug) && name && nameAr) names[slug] = { name, nameAr };
  }
  return names;
}

function details(row: BookingRow, names: Names, origin: string): BookingDetails {
  const locale = LOCALES.includes(row.site_locale as SiteLocale) ? (row.site_locale as SiteLocale) : "en";
  const prefix = locale === "en" ? "" : `/${locale}`;
  return {
    reference: row.reference,
    slot: new Date(row.slot_start),
    projects: row.projects.map((slug) => ({
      name: names[slug]?.name ?? slug,
      nameAr: names[slug]?.nameAr ?? slug,
      url: `${origin}${prefix}/projects/${slug}`
    })),
    focus: [],
    focusAr: [],
    app: row.app,
    tourLanguage: row.tour_language,
    name: row.name,
    email: row.email,
    phone: row.phone,
    contact: row.contact_method,
    locale,
    timeZone: row.visitor_timezone,
    source: row.source,
    origin
  };
}

/** Grows with every change, so the visitor's calendar replaces the event instead of adding one. */
const sequence = () => Math.floor(Date.now() / 1000) - 1_790_000_000;

export async function POST(request: Request): Promise<Response> {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token || token.length > 4000) return json({ error: "unauthorized" }, 401);
  if (!hasSupabase()) return json({ error: "unavailable" }, 503);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = text(body?.action, 20);
  const id = text(body?.id, 36);
  if (!body || !UUID.test(id) || (action !== "confirm" && action !== "reschedule")) return json({ error: "invalid" }, 400);
  const names = parseNames(body.names);
  const origin = new URL(request.url).origin;

  let row: BookingRow;
  try {
    if (action === "confirm") {
      const res = await restAs(token, `tour_bookings?id=eq.${id}&status=neq.cancelled`, {
        method: "PATCH",
        body: { status: "confirmed" },
        prefer: "return=representation"
      });
      if (res.status === 401) return json({ error: "unauthorized" }, 401);
      if (res.status >= 400) return json({ error: "unavailable" }, 503);
      // Row-level security hides the booking from anyone who isn't an admin.
      const found = Array.isArray(res.data) ? (res.data[0] as BookingRow | undefined) : undefined;
      if (!found) return json({ error: "not_found" }, 404);
      row = found;
    } else {
      const slot = new Date(text(body.slot, 40));
      if (Number.isNaN(slot.getTime())) return json({ error: "invalid" }, 400);
      const res = await restAs(token, "rpc/admin_reschedule_tour", { method: "POST", body: { p_id: id, p_slot: slot.toISOString() } });
      if (res.status === 401) return json({ error: "unauthorized" }, 401);
      if (res.status >= 400) {
        console.error(`booking-admin: admin_reschedule_tour failed (${res.status})`);
        return json({ error: "unavailable" }, 503);
      }
      const result = res.data as (BookingRow & { error?: string }) | null;
      const error = result?.error;
      if (error) {
        const status = error === "forbidden" ? 403 : error === "not_found" ? 404 : error === "slot_taken" ? 409 : 400;
        return json({ error }, status);
      }
      if (!result?.id || !result.reply_token) return json({ error: "unavailable" }, 503);
      row = result;
    }
  } catch (error) {
    console.error(`booking-admin: ${error instanceof Error ? error.message : "unknown error"}`);
    return json({ error: "unavailable" }, 503);
  }

  const booking = details(row, names, origin);
  const reply = (answer: "accepted" | "declined") => `${origin}/api/tour-reply?t=${encodeURIComponent(row.reply_token ?? "")}&a=${answer}`;
  const email = visitorEmail(
    booking,
    action === "confirm"
      ? { kind: "confirmed", sequence: sequence() }
      : { kind: "rescheduled", sequence: sequence(), acceptUrl: reply("accepted"), declineUrl: reply("declined") }
  );
  const emailSent = await sendEmail({
    to: [booking.email],
    subject: email.subject,
    html: email.html,
    text: email.text,
    replyTo: TEAM_INBOX,
    attachments: [email.attachment]
  });

  // The reply token only ever travels in the visitor's email.
  const { reply_token: _token, ...safe } = row;
  void _token;
  return json({ booking: safe, emailSent });
}

export function GET(): Response {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}
