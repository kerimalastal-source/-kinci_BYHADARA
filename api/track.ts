// POST /api/track — one anonymous page view from the site (src/utils/visitorTracker.ts).
//
// Stores a random per-tab session id, the path, the site language, the referring
// site's host name and the approximate country/city from Vercel's geolocation headers,
// in Supabase (public.visitor_events via record_visit_state(), supabase/migrations/0004).
// Never reads or stores the IP address. On Telegram, the first page view of a session
// sends the "new visitor" alert and every later page edits that same message (current
// page, page count, visit length — no new notification); the first opening of a
// request page (contact...) in a visit sends a separate 🔥 message as a reply to it.
// Likely automated visits (data-center towns, same-page bursts: api/_lib/visitBots.ts)
// get no Telegram message; the logic is in api/_lib/visitRecord.ts.
// It also takes { type: "action" } (a button press or form start) and { type: "consent" }
// bodies for the admin statistics; the visit's device (mobile/tablet/desktop) comes with
// its first page, together with the system and browser (read here from the user agent,
// which itself is never stored), time zone, screen size and navigator.webdriver.
// { type: "engagement" } reports how long a page was visible, how far it was scrolled and
// for how many seconds there was touch/mouse/keyboard input (never what was typed), sent
// after 15 and 45 seconds and when the page is hidden or left; each report re-reads the
// visit and updates its Telegram alert with a verdict (person / unsure / automated:
// api/_lib/visitInsights.ts, supabase/migrations/0018).
// The response (204) goes out at once; the database write and the alerts finish in the
// background (waitUntil), so neither can slow down or break it.
import { waitUntil } from "@vercel/functions";
import { rpc, RpcError } from "./_lib/supabase.js";
import { sendDueFollowUps } from "./_lib/followups.js";
import { recordVisit, refreshAlert } from "./_lib/visitRecord.js";
import { parseUserAgent, type Insight } from "./_lib/visitInsights.js";
import { teamChatId } from "./_lib/telegram.js";
import { LOCALES, type Geo, type Locale, type PageView, type TrailStep } from "./_lib/visitAlerts.js";

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The seller account and admin pages are never tracked (the browser skips them too). */
const INTERNAL_PATH = /^\/(?:(?:ar|fa|fr|ru)\/)?(?:admin|account)(?:\/|$)/;
/** Links in alerts point at the public site. */
const SITE = (process.env.VITE_SITE_URL || "https://www.hadararealestate.com").replace(/\/$/, "");
/** Crawlers and link previews aren't visitors. */
const BOT_AGENT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pingdom|uptime|monitor/i;

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const userAgent = request.headers.get("user-agent") ?? "";

  // What the visitor did with the cookie notice (src/components/cookieConsent.ts), for the
  // admin statistics. Until migration 0009 runs, the 404 is ignored.
  if (body && typeof body === "object" && (body as Record<string, unknown>).type === "consent") {
    const consent = parseConsent(body);
    if (consent && !BOT_AGENT.test(userAgent)) {
      waitUntil(
        rpc("save_visit_consent", { p_session: consent.sessionId, p_choice: consent.choice }).catch((error: unknown) => {
          if (!(error instanceof RpcError && error.status === 404)) console.error(`track: save_visit_consent failed: ${error instanceof Error ? error.message : "unknown"}`);
        })
      );
    }
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  // A button press or form start (src/utils/visitorTracker.ts reportAction), for the admin
  // "what visitors do" statistics. Until migration 0015 runs, the 404 is ignored.
  if (body && typeof body === "object" && (body as Record<string, unknown>).type === "action") {
    const action = parseAction(body);
    if (action && !BOT_AGENT.test(userAgent)) {
      waitUntil(
        rpc("record_visit_action", { p_session_id: action.sessionId, p_action: action.action, p_target: action.target, p_path: action.path }).catch((error: unknown) => {
          if (!(error instanceof RpcError && error.status === 404)) console.error(`track: record_visit_action failed: ${error instanceof Error ? error.message : "unknown"}`);
        })
      );
    }
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  // How long a page was looked at (src/utils/visitorTracker.ts). Until migration 0018 runs,
  // the 404 is ignored.
  if (body && typeof body === "object" && (body as Record<string, unknown>).type === "engagement") {
    const report = parseEngagement(body);
    if (report && !BOT_AGENT.test(userAgent)) {
      const view = parsePageView((body as Record<string, unknown>).view, userAgent);
      waitUntil(saveEngagement(report, view && view.sessionId === report.sessionId ? view : null));
    }
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  const view = parsePageView(body, userAgent);

  if (view && !INTERNAL_PATH.test(view.path) && !BOT_AGENT.test(userAgent)) {
    const geo = readGeo(request.headers);
    const origin = new URL(request.url).origin;
    waitUntil(
      recordVisit(view, geo, origin).catch((error: unknown) => {
        console.error(`track: ${error instanceof Error ? error.message : "unknown error"}`);
      })
    );
    // Sales follow-up reminders whose time has come (the database runs the check at most
    // every two minutes, so reminders go out within minutes whenever the site has visitors).
    if (Math.random() < 0.3) {
      waitUntil(
        sendDueFollowUps(SITE, 120).catch((error: unknown) => {
          console.error(`track: followups failed: ${error instanceof Error ? error.message : "unknown error"}`);
        })
      );
    }
    // ~1% of requests also clear visit records older than a year (30 days before migration 0015) and tour bookings a
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

function parsePageView(body: unknown, userAgent: string): PageView | null {
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
    landingTitle: text(data.landingTitle, 150),
    trail: parseTrail(data.trail),
    trailSkipped: Math.min(10_000, Math.max(0, Math.floor(Number(data.trailSkipped) || 0))),
    // "utm_source=facebook · utm_campaign=villa" from the ad link (src/utils/campaign.ts).
    campaign: text(data.campaign, 300).replace(/[\u0000-\u001f<>]/g, ""),
    device: DEVICES.find((value) => value === data.device) ?? "",
    viewId: VIEW_ID.test(text(data.viewId, 40)) ? text(data.viewId, 40) : "",
    tz: /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$|^UTC$/.test(text(data.tz, 60)) ? text(data.tz, 60) : "",
    screen: /^\d{2,5}x\d{2,5}$/.test(text(data.screen, 12)) ? text(data.screen, 12) : "",
    webdriver: typeof data.webdriver === "boolean" ? data.webdriver : null,
    ...parseUserAgent(userAgent)
  };
}

/** A page view's own random id (src/utils/visitorTracker.ts). */
const VIEW_ID = /^[a-z0-9-]{8,40}$/i;

interface Engagement {
  sessionId: string;
  viewId: string;
  path: string;
  active: number;
  scroll: number;
  interactions: number;
}

/** { type: "engagement", sessionId, viewId, path, active, scroll, interactions, view } — dropped when malformed. */
function parseEngagement(body: object): Engagement | null {
  const data = body as Record<string, unknown>;
  const sessionId = text(data.sessionId, 36);
  const viewId = text(data.viewId, 40);
  const path = text(data.path, 300).split(/[?#]/)[0];
  if (!SESSION_ID.test(sessionId) || !VIEW_ID.test(viewId) || !path.startsWith("/") || INTERNAL_PATH.test(path)) return null;
  const whole = (value: unknown, max: number) => Math.min(max, Math.max(0, Math.round(Number(value) || 0)));
  return { sessionId, viewId, path, active: whole(data.active, 86_400), scroll: whole(data.scroll, 100), interactions: whole(data.interactions, 86_400) };
}

/** Saves the report (the database keeps the larger values) and updates the visit's alert. */
async function saveEngagement(report: Engagement, view: PageView | null): Promise<void> {
  let insight: Insight | null = null;
  try {
    insight = (await rpc("record_visit_engagement", {
      p_session_id: report.sessionId,
      p_view_id: report.viewId,
      p_path: report.path,
      p_active: report.active,
      p_scroll: report.scroll,
      p_interactions: report.interactions
    })) as Insight | null;
  } catch (error) {
    if (!(error instanceof RpcError && error.status === 404)) console.error(`track: record_visit_engagement failed: ${error instanceof Error ? error.message : "unknown"}`);
    return;
  }
  console.info(`[track-engagement] ${insight ? "saved" : "no matching visit"} active=${report.active}s scroll=${report.scroll}% input=${report.interactions}s`);
  if (!insight || !view || !teamChatId()) return;
  await refreshAlert(view, insight, SITE).catch((error: unknown) => {
    console.error(`track: alert refresh failed: ${error instanceof Error ? error.message : "unknown"}`);
  });
}

const DEVICES = ["mobile", "tablet", "desktop"] as const;

/** The actions migration 0015 accepts (visitor_actions.action). */
const ACTIONS = ["whatsapp", "call", "email", "interested", "favorite", "video_play", "map_open", "chat_open", "tour_link", "form_start", "form_sent"] as const;

/** { type: "action", sessionId, action, target, path } — dropped when malformed or sent from an internal page. */
function parseAction(body: object): { sessionId: string; action: string; target: string; path: string } | null {
  const data = body as Record<string, unknown>;
  const sessionId = text(data.sessionId, 36);
  const action = ACTIONS.find((value) => value === data.action);
  const path = text(data.path, 300).split(/[?#]/)[0];
  // A project slug or a form name: lowercase letters, digits and dashes only.
  const target = text(data.target, 80);
  if (!SESSION_ID.test(sessionId) || !action || !path.startsWith("/") || INTERNAL_PATH.test(path)) return null;
  return { sessionId, action, target: /^[a-z0-9-]+$/.test(target) ? target : "", path };
}

const CONSENT_CHOICES = ["granted", "denied", "none"] as const;

/** { type: "consent", sessionId, choice, path } — dropped when malformed or sent from an internal page. */
function parseConsent(body: object): { sessionId: string; choice: (typeof CONSENT_CHOICES)[number] } | null {
  const data = body as Record<string, unknown>;
  const sessionId = text(data.sessionId, 36);
  const choice = CONSENT_CHOICES.find((value) => value === data.choice);
  const path = text(data.path, 300);
  if (!SESSION_ID.test(sessionId) || !choice || !path.startsWith("/") || INTERNAL_PATH.test(path)) return null;
  return { sessionId, choice };
}

/** The browser's list of this visit's pages; anything malformed or internal is dropped. */
function parseTrail(value: unknown): TrailStep[] {
  if (!Array.isArray(value)) return [];
  const steps: TrailStep[] = [];
  for (const item of value.slice(0, 60)) {
    if (!item || typeof item !== "object") continue;
    const step = item as Record<string, unknown>;
    const path = text(step.path, 300).split(/[?#]/)[0];
    const at = Number(step.at);
    if (!path.startsWith("/") || INTERNAL_PATH.test(path) || !Number.isFinite(at)) continue;
    steps.push({ path, title: text(step.title, 150), at: Math.min(Math.max(0, Math.round(at)), 7 * 86_400) });
  }
  return steps;
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
