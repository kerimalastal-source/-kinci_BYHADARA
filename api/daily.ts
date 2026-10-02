// GET /api/daily — the daily job, run by Vercel Cron every morning (vercel.json: 06:00 UTC =
// 9:00 Istanbul; on the free plan it may run any time within that hour).
//
//   1. Emails tomorrow's video tour visitors a reminder in their language, once per booking
//      (mark_tour_reminded(); a booking moved to another day gets a new one).
//   2. Sends the team the morning summary on Telegram: today's tours, bookings waiting for
//      confirmation, inquiries without an answer for more than 24 hours, listings to review,
//      today's sales follow-ups, and yesterday's visitors.
//   3. Sends the visitor report of the last 24 hours right after it: how many visits were
//      people, unsure or automated, and for each likely person where they came from, what they
//      looked at and what they are probably after (visit_report(), migration 0018;
//      api/_lib/visitReport.ts). A failure there never affects the summary.
//
// Vercel calls it with "Authorization: Bearer <CRON_SECRET>". The same secret opens
// daily_digest() in the database (supabase/migrations/0008), so CRON_SECRET in Vercel must be
// the value of: select value from public.internal_secrets where name = 'cron';
import { sendTelegram } from "./_lib/telegram.js";
import { sendEmail } from "./_lib/email.js";
import { hasSupabase, rpc, RpcError } from "./_lib/supabase.js";
import { TEAM_INBOX, visitorEmail, type App, type BookingDetails, type ContactMethod, type SiteLocale, type TourLanguage } from "./_lib/bookingMessages.js";
import { PROJECT_NAMES } from "./_lib/projectNames.js";
import { dailySummary, type Digest } from "./_lib/dailyMessages.js";
import { followUpsToday, sendDueFollowUps } from "./_lib/followups.js";
import { readVisits, visitReportMessage, type ReportRow } from "./_lib/visitReport.js";

const LOCALES: readonly SiteLocale[] = ["en", "ar", "fa", "fr", "ru"];
/** Links in emails and alerts point at the public site, whatever URL the cron called. */
const SITE = (process.env.VITE_SITE_URL || "https://www.hadararealestate.com").replace(/\/$/, "");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

/** Grows with every change, so the visitor's calendar updates the event instead of adding one. */
const sequence = () => Math.floor(Date.now() / 1000) - 1_790_000_000;

function reminderDetails(r: Digest["reminders"][number]): BookingDetails {
  const locale = LOCALES.includes(r.site_locale as SiteLocale) ? (r.site_locale as SiteLocale) : "en";
  const prefix = locale === "en" ? "" : `/${locale}`;
  return {
    reference: r.reference,
    slot: new Date(r.slot_start),
    projects: r.projects.map((slug) => ({
      name: PROJECT_NAMES[slug]?.[locale] ?? slug,
      nameAr: PROJECT_NAMES[slug]?.ar ?? slug,
      url: `${SITE}${prefix}/projects/${slug}`
    })),
    focus: [],
    focusAr: [],
    app: r.app as App,
    tourLanguage: r.tour_language as TourLanguage,
    name: r.name,
    email: r.email,
    phone: r.phone,
    contact: r.contact_method as ContactMethod,
    locale,
    timeZone: r.visitor_timezone,
    source: r.source,
    origin: SITE
  };
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 32 || request.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "unauthorized" }, 401);
  if (!hasSupabase()) return json({ error: "unavailable" }, 503);

  let digest: Digest & { error?: string };
  try {
    digest = (await rpc("daily_digest", { p_secret: secret })) as Digest & { error?: string };
  } catch (error) {
    if (error instanceof RpcError && error.status === 404) console.error("daily: daily_digest is missing — run supabase/migrations/0008");
    else console.error(`daily: ${error instanceof Error ? error.message : "unknown error"}`);
    return json({ error: "unavailable" }, 503);
  }
  if (digest?.error) {
    console.error("daily: CRON_SECRET doesn't match internal_secrets 'cron' in the database");
    return json({ error: "forbidden" }, 403);
  }

  // 1. Reminders, one by one; only the ones sent are marked (a failure is named in the summary).
  const sent: string[] = [];
  const failed: string[] = [];
  for (const reminder of digest.reminders) {
    const details = reminderDetails(reminder);
    const email = visitorEmail(details, { kind: "reminder", sequence: sequence() });
    const ok = await sendEmail({
      to: [details.email],
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo: TEAM_INBOX,
      attachments: [email.attachment]
    });
    if (ok) sent.push(reminder.id);
    else failed.push(reminder.name);
  }
  if (sent.length) {
    await rpc("mark_tour_reminded", { p_secret: secret, p_ids: sent }).catch((error: unknown) => {
      console.error(`daily: mark_tour_reminded failed: ${error instanceof Error ? error.message : "unknown"}`);
    });
  }

  // 2. Sales follow-ups that are due (usually already sent from page views), then the morning summary.
  await sendDueFollowUps(SITE, 0);
  const messageId = await sendTelegram(dailySummary(digest, SITE, { sent: sent.length, failed }, await followUpsToday()));
  const report = await sendVisitReport(secret);
  return json({ reminders: sent.length, failed: failed.length, summary: messageId !== null, report });
}

/** The morning visitor report; false when it couldn't be sent (or migration 0018 hasn't run). */
async function sendVisitReport(secret: string): Promise<boolean> {
  try {
    const rows = await rpc("visit_report", { p_secret: secret, p_hours: 24 });
    if (!Array.isArray(rows)) return false;
    return (await sendTelegram(visitReportMessage(readVisits(rows as ReportRow[]), `${SITE}/ar/admin/stats`))) !== null;
  } catch (error) {
    if (!(error instanceof RpcError && error.status === 404)) console.error(`daily: visit report failed: ${error instanceof Error ? error.message : "unknown"}`);
    return false;
  }
}
