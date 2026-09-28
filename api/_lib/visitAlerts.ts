// Telegram texts of the anonymous visitor alerts (api/track.ts), in Arabic, parse_mode
// HTML: every value that comes from the request is escaped.
import { escapeHtml } from "./telegram.js";

export const LOCALES = ["en", "ar", "fr", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

export interface PageView {
  sessionId: string;
  path: string;
  locale: Locale | null;
  /** Referring site's host name ("google.com"), an internal path ("/projects"), or "" for direct. */
  referrer: string;
  /** Page title, sent only for a project, resale listing or blog article. */
  title: string;
  /** The session's first page and its title, as the browser remembers them (for the updated alert). */
  landingPath: string;
  landingTitle: string;
}

/** A session's first page view, as record_visit_state() returns it. */
export interface Landing {
  path: string;
  locale: string | null;
  referrer: string | null;
  country: string | null;
  city: string | null;
}

/** The session before this page view (record_visit_state(), supabase/migrations/0004). */
export interface VisitState {
  is_new: boolean;
  pages_before: number;
  seconds: number;
  seen_before: boolean;
  landing: Landing;
  message_id: number | null;
}

export interface Geo {
  country: string | null;
  city: string | null;
}

const LOCALE_NAMES: Record<Locale, string> = { en: "الإنجليزية", ar: "العربية", fr: "الفرنسية", ru: "الروسية" };

/**
 * Pages with a request form whose first opening in a visit sends a separate 🔥 message
 * (language prefix removed): the page's Arabic name.
 */
export const REQUEST_PAGES: Record<string, string> = {
  "/contact": "التواصل",
  "/engineering-architecture/request-consultation": "طلب استشارة التصميم الهندسي",
  "/property-request": "طلب عقار مخصص"
};

/** Left-to-right mark first, so a path like "/ar/contact" never reads "contact/ar/" in Arabic text. */
function shownPath(path: string): string {
  return `\u200E${escapeHtml(path)}`;
}

function countryName(code: string | null): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["ar"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function placeOf(city: string | null, country: string | null): string {
  return [city, countryName(country)].filter(Boolean).join("، ") || "غير معروف";
}

function localeName(locale: string | null): string {
  return locale && locale in LOCALE_NAMES ? LOCALE_NAMES[locale as Locale] : "غير معروفة";
}

/** What the visitor opened when it's a specific project, resale listing or article. */
function pageSubject(path: string): string | null {
  const match = path.match(/^\/(?:(?:ar|fr|ru)\/)?(projects|resale|blog)\/[^/]+\/?$/);
  if (!match) return null;
  return { projects: "المشروع", resale: "العقار", blog: "المقال" }[match[1] as "projects" | "resale" | "blog"];
}

/** The 🏠 line for a project, resale listing or article page, or null. */
function subjectLine(path: string, title: string, origin: string): string | null {
  const subject = pageSubject(path);
  if (!subject) return null;
  const name = title.split(" | ")[0].trim() || path;
  return `🏠 ${subject}: <a href="${escapeHtml(origin + path)}">${escapeHtml(name)}</a>`;
}

/** The alert's lines about the session's first page: place, page, subject, language, source. */
function visitorLines(landing: Landing, title: string, origin: string, pageLabel: string): string[] {
  const lines = [
    "<b>🏢 حضارة للعقار — زائر جديد</b>",
    `📍 من وين: ${escapeHtml(placeOf(landing.city, landing.country))}`,
    `📄 ${pageLabel}: ${shownPath(landing.path)}`
  ];
  const subject = subjectLine(landing.path, title, origin);
  if (subject) lines.push(subject);
  lines.push(`🌐 اللغة: ${localeName(landing.locale)}`);
  lines.push(`🔗 المصدر: ${landing.referrer ? escapeHtml(landing.referrer) : "مباشر"}`);
  return lines;
}

export function newVisitorMessage(view: PageView, geo: Geo, origin: string): string {
  const landing: Landing = { path: view.path, locale: view.locale, referrer: view.referrer, country: geo.country, city: geo.city };
  return visitorLines(landing, view.title, origin, "الصفحة").join("\n");
}

/** Visit length in Arabic, in whole minutes. */
export function visitLength(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  if (minutes < 1) return "أقل من دقيقة";
  if (minutes === 1) return "دقيقة";
  if (minutes === 2) return "دقيقتان";
  if (minutes <= 10) return `${minutes} دقائق`;
  if (minutes < 60) return `${minutes} دقيقة`;
  return "أكثر من ساعة";
}

/** The same alert once the visitor has moved on: first page, where they are now, and for how long. */
export function visitUpdateMessage(view: PageView, state: VisitState, origin: string): string {
  return [
    // The browser's title is used only for the same first page (not for a visit that
    // began before the browser remembered it).
    ...visitorLines(state.landing, view.landingPath === state.landing.path ? view.landingTitle : "", origin, "أول صفحة"),
    `👣 الآن: ${shownPath(view.path)}`,
    `🔢 عدد الصفحات: ${state.pages_before + 1} · مدة الزيارة: ${visitLength(state.seconds)}`
  ].join("\n");
}

/** The separate message when a request page is opened for the first time in the visit, or null. */
export function requestPageMessage(view: PageView, geo: Geo, state: VisitState): string | null {
  const page = REQUEST_PAGES[view.path.replace(/^\/(?:ar|fr|ru)(?=\/|$)/, "").replace(/\/$/, "") || "/"];
  if (!page || state.seen_before) return null;
  return [`🔥 الزائر فتح صفحة ${page}`, `📍 ${escapeHtml(placeOf(geo.city, geo.country))} · 📄 ${shownPath(view.path)}`].join("\n");
}
