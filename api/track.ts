// POST /api/track — one anonymous page view from the site (src/utils/visitorTracker.ts).
//
// Stores a random per-tab session id, the path, the site language, the referring
// site's host name and the approximate country/city from Vercel's geolocation headers,
// in Supabase (public.visitor_events via record_visit(), supabase/migrations/0002).
// Never reads or stores the IP address. The first page view of a session sends a
// Telegram alert. The response (204) goes out at once; the database write and the
// alert finish in the background (waitUntil), so neither can slow down or break it.
import { waitUntil } from "@vercel/functions";
import { escapeHtml, sendTelegram } from "./_lib/telegram.js";
import { rpc } from "./_lib/supabase.js";

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCALES = ["en", "ar", "fr", "ru"] as const;
type Locale = (typeof LOCALES)[number];

/** The seller account and admin pages are never tracked (the browser skips them too). */
const INTERNAL_PATH = /^\/(?:(?:ar|fr|ru)\/)?(?:admin|account)(?:\/|$)/;
/** Crawlers and link previews aren't visitors. */
const BOT_AGENT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pingdom|uptime|monitor/i;

interface PageView {
  sessionId: string;
  path: string;
  locale: Locale | null;
  /** Referring site's host name ("google.com"), an internal path ("/projects"), or "" for direct. */
  referrer: string;
  /** Page title, sent only for a project, resale listing or blog article. */
  title: string;
}

interface Geo {
  country: string | null;
  city: string | null;
}

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

  return { sessionId, path, locale, referrer, title: text(data.title, 150) };
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
  const isNewSession = await rpc("record_visit", {
    p_session_id: view.sessionId,
    p_path: view.path,
    p_locale: view.locale,
    p_referrer: view.referrer || null,
    p_country: geo.country,
    p_city: geo.city
  });

  // Alert only for a brand-new session. A new tab opened from the site starts its own
  // session (sessionStorage is per tab) but its referrer is one of our own pages, so it
  // isn't a new visitor and gets no alert.
  if (isNewSession === true && !view.referrer.startsWith("/")) {
    await sendTelegram(newVisitorMessage(view, geo, origin));
  }
}

const LOCALE_NAMES: Record<Locale, string> = { en: "الإنجليزية", ar: "العربية", fr: "الفرنسية", ru: "الروسية" };

function countryName(code: string | null): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["ar"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** What the visitor opened when it's a specific project, resale listing or article. */
function pageSubject(path: string): string | null {
  const match = path.match(/^\/(?:(?:ar|fr|ru)\/)?(projects|resale|blog)\/[^/]+\/?$/);
  if (!match) return null;
  return { projects: "المشروع", resale: "العقار", blog: "المقال" }[match[1] as "projects" | "resale" | "blog"];
}

function newVisitorMessage(view: PageView, geo: Geo, origin: string): string {
  const place = [geo.city, countryName(geo.country)].filter(Boolean).join("، ") || "غير معروف";
  const lines = [
    "<b>🏢 حضارة للعقار — زائر جديد</b>",
    `📍 من وين: ${escapeHtml(place)}`,
    `📄 الصفحة: ${escapeHtml(view.path)}`
  ];

  const subject = pageSubject(view.path);
  if (subject) {
    const name = view.title.split(" | ")[0].trim() || view.path;
    lines.push(`🏠 ${subject}: <a href="${escapeHtml(origin + view.path)}">${escapeHtml(name)}</a>`);
  }

  lines.push(`🌐 اللغة: ${view.locale ? LOCALE_NAMES[view.locale] : "غير معروفة"}`);
  lines.push(`🔗 المصدر: ${view.referrer ? escapeHtml(view.referrer) : "مباشر"}`);
  return lines.join("\n");
}
