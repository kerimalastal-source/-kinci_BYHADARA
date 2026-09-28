// POST /api/track — one anonymous page view from the site (src/utils/visitorTracker.ts).
//
// Stores a random per-tab session id, the path, the site language, the referring
// site's host name and the approximate country/city from Vercel's geolocation headers,
// in Supabase (public.visitor_events via record_visit_state(), supabase/migrations/0004).
// Never reads or stores the IP address. On Telegram, the first page view of a session
// sends the "new visitor" alert and every later page edits that same message (current
// page, page count, visit length — no new notification); the first opening of a
// request page (contact...) in a visit sends a separate 🔥 message as a reply to it.
// The response (204) goes out at once; the database write and the alerts finish in the
// background (waitUntil), so neither can slow down or break it.
import { waitUntil } from "@vercel/functions";
import { editTelegram, sendTelegram } from "./_lib/telegram.js";
import { rpc, RpcError } from "./_lib/supabase.js";
import {
  LOCALES,
  newVisitorMessage,
  requestPageMessage,
  visitUpdateMessage,
  type Geo,
  type Locale,
  type PageView,
  type VisitState
} from "./_lib/visitAlerts.js";

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The seller account and admin pages are never tracked (the browser skips them too). */
const INTERNAL_PATH = /^\/(?:(?:ar|fr|ru)\/)?(?:admin|account)(?:\/|$)/;
/** Crawlers and link previews aren't visitors. */
const BOT_AGENT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pingdom|uptime|monitor/i;

export async function POST(request: Request): Promise<Response> {
  const view = parsePageView(await request.json().catch(() => null));
  const userAgent = request.headers.get("user-agent") ?? "";

  if (view && !INTERNAL_PATH.test(view.path) && !BOT_AGENT.test(userAgent)) {
    const geo = readGeo(request.headers);
    const origin = new URL(request.url).origin;
    waitUntil(
      record(view, geo, origin).catch((error: unknown) => {
        console.error(`track: ${error instanceof Error ? error.message : "unknown error"}`);
      })
    );
    // ~1% of requests also clear visit events older than 30 days and tour bookings a
    // year past their date; a failure here is only logged.
    if (Math.random() < 0.01) {
      for (const fn of ["purge_old_visitor_events", "purge_old_tour_bookings"]) {
        waitUntil(
          rpc(fn, {}).catch((error: unknown) => {
            console.error(`track: ${fn} failed: ${error instanceof Error ? error.message : "unknown error"}`);
          })
        );
      }
    }
  }

  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export function GET(): Response {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parsePageView(body: unknown): PageView | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;

  const sessionId = text(data.sessionId, 36);
  if (!SESSION_ID.test(sessionId)) return null;

  // Path only: no query string or fragment (they can carry personal data).
  const path = text(data.path, 300).split(/[?#]/)[0];
  if (!path.startsWith("/")) return null;

  const localeValue = text(data.locale, 8);
  const locale = (LOCALES as readonly string[]).includes(localeValue) ? (localeValue as Locale) : null;

  // The browser sends only a host name or an internal path; anything else is dropped.
  const referrerValue = text(data.referrer, 300);
  const referrer = /^\/[^\s?#]*$/.test(referrerValue) || /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(referrerValue) ? referrerValue : "";

  return {
    sessionId,
    path,
    locale,
    referrer,
    title: text(data.title, 150),
    landingPath: text(data.landingPath, 300).split(/[?#]/)[0],
    landingTitle: text(data.landingTitle, 150)
  };
}

function readGeo(headers: Headers): Geo {
  const country = headers.get("x-vercel-ip-country");
  const rawCity = headers.get("x-vercel-ip-city");
  let city: string | null = null;
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity);
    } catch {
      city = rawCity;
    }
  }
  return { country: country && /^[A-Z]{2}$/.test(country) ? country : null, city: city ? city.slice(0, 100) : null };
}

async function record(view: PageView, geo: Geo, origin: string): Promise<void> {
  const args = {
    p_session_id: view.sessionId,
    p_path: view.path,
    p_locale: view.locale,
    p_referrer: view.referrer || null,
    p_country: geo.country,
    p_city: geo.city
  };

  let state: VisitState;
  try {
    state = (await rpc("record_visit_state", args)) as VisitState;
  } catch (error) {
    // 404: migration 0004 hasn't been run yet — keep the plain alert of record_visit().
    if (!(error instanceof RpcError && error.status === 404)) throw error;
    const isNewSession = await rpc("record_visit", args);
    if (isNewSession === true && !view.referrer.startsWith("/")) {
      await sendTelegram(newVisitorMessage(view, geo, origin));
    }
    return;
  }

  // A new tab opened from the site starts its own session (sessionStorage is per tab) but
  // its first referrer is one of our own pages: it isn't a new visitor, so it gets no
  // alert, no updates and no 🔥 message.
  const landingReferrer = state.is_new ? view.referrer : state.landing?.referrer ?? "";
  if ((landingReferrer ?? "").startsWith("/")) return;

  let messageId = state.message_id ? Number(state.message_id) : null;
  if (state.is_new) {
    messageId = await sendTelegram(newVisitorMessage(view, geo, origin));
    if (messageId) await rpc("save_visitor_alert", { p_session_id: view.sessionId, p_message_id: messageId });
  } else if (messageId) {
    // A message the team deleted can't be edited: that is logged (by editTelegram) and
    // never stops the 🔥 message below.
    await editTelegram(messageId, visitUpdateMessage(view, state, origin));
  }

  const request = requestPageMessage(view, geo, state);
  if (request) await sendTelegram(request, messageId);
}
