// Telegram texts of the anonymous visitor alerts (api/track.ts), in Arabic, parse_mode
// HTML: every value that comes from the request is escaped.
import { escapeHtml } from "./telegram.js";

export const LOCALES = ["en", "ar", "fa", "fr", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

/** One page of the visit, as the browser remembers it: seconds since the visit's first page. */
export interface TrailStep {
  path: string;
  title: string;
  at: number;
}

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
  /** The visit's pages in order, ending with this one (empty from an older cached page). */
  trail: TrailStep[];
  /** Pages the browser dropped from the middle of a very long trail. */
  trailSkipped: number;
  /** The ad campaign the visit came from ("utm_source=facebook · utm_campaign=villa"), or "". */
  campaign: string;
  /** "mobile", "tablet" or "desktop" (from the browser), or "" when unknown. Saved with the first page. */
  device?: string;
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

const LOCALE_NAMES: Record<Locale, string> = { en: "الإنجليزية", ar: "العربية", fa: "الفارسية", fr: "الفرنسية", ru: "الروسية" };

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

/** Arabic names of the site's fixed pages (path without the language prefix). */
const PAGE_NAMES: Record<string, string> = {
  "/": "الرئيسية",
  "/projects": "المشاريع",
  "/video-tour": "الجولة عبر الفيديو",
  "/about": "من نحن",
  "/citizenship": "الجنسية التركية",
  "/blog": "المدونة",
  "/faq": "الأسئلة الشائعة",
  "/resale": "إعادة البيع",
  "/privacy": "سياسة الخصوصية",
  "/property-laws": "قوانين العقار",
  "/login": "تسجيل الدخول",
  "/register": "حساب جديد",
  "/engineering-architecture": "الاستشارات الهندسية",
  "/engineering-architecture/services": "خدمات التصميم",
  "/engineering-architecture/portfolio": "معرض الأعمال",
  "/engineering-architecture/how-we-work": "منهجية العمل",
  ...REQUEST_PAGES
};

/** Path without the language prefix or a trailing slash: "/ar/contact/" -> "/contact". */
function basePath(path: string): string {
  return path.replace(/^\/(?:ar|fa|fr|ru)(?=\/|$)/, "").replace(/\/$/, "") || "/";
}

/** A page's name for the visit trail: the project/listing/article title, else the page's Arabic name. */
function pageName(path: string, title: string): string | null {
  const name = title.split(" | ")[0].trim();
  if (name && pageSubject(path)) return name.slice(0, 70);
  return PAGE_NAMES[basePath(path)] ?? null;
}

/** Longest trail shown in full; a longer one keeps its start and its most recent pages. */
const TRAIL_SHOWN = 25;

/**
 * The visit's pages in order, each with its name and how long the visitor stayed on it;
 * the last one is where the visitor is now, or where the visit ended.
 */
function trailLines(trail: TrailStep[], skipped: number): string[] {
  const rows = trail.map((step, i) => {
    const name = pageName(step.path, step.title);
    const label = `${shownPath(step.path)}${name ? ` — ${escapeHtml(name)}` : ""}`;
    // The first page's stay is unknown when the pages after it were dropped by the browser.
    const stay = i === trail.length - 1 ? "👈 آخر صفحة" : i === 0 && skipped > 0 ? "" : visitLength(trail[i + 1].at - step.at);
    return `${i === 0 ? 1 : i + 1 + skipped}. ${label}${stay ? ` · ${stay}` : ""}`;
  });
  // Pages not shown sit between the first page and the rest.
  let hidden = skipped;
  let shown = rows;
  if (rows.length > TRAIL_SHOWN) {
    hidden += rows.length - TRAIL_SHOWN;
    shown = [rows[0], ...rows.slice(rows.length - (TRAIL_SHOWN - 1))];
  }
  const lines = ["🗺️ <b>مسار الزيارة:</b>", shown[0]];
  if (hidden > 0) lines.push(`… (${otherPages(hidden)})`);
  return [...lines, ...shown.slice(1)];
}

function otherPages(count: number): string {
  if (count === 1) return "صفحة أخرى";
  if (count === 2) return "صفحتان أخريان";
  return count <= 10 ? `${count} صفحات أخرى` : `${count} صفحة أخرى`;
}

/** What the visitor opened when it's a specific project, resale listing or article. */
function pageSubject(path: string): string | null {
  const match = path.match(/^\/(?:(?:ar|fa|fr|ru)\/)?(projects|resale|blog)\/[^/]+\/?$/);
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
  const lines = visitorLines(landing, view.title, origin, "الصفحة");
  if (view.campaign) lines.push(`📣 الإعلان: ${escapeHtml(view.campaign)}`);
  return lines.join("\n");
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
  // The trail is shown when the browser sent one that ends on this page (an older cached
  // page sends none): otherwise only the current page, as before.
  const trail = view.trail.length > 1 && view.trail[view.trail.length - 1].path === view.path ? view.trail : null;
  return [
    // The browser's title is used only for the same first page (not for a visit that
    // began before the browser remembered it).
    ...visitorLines(state.landing, view.landingPath === state.landing.path ? view.landingTitle : "", origin, "أول صفحة"),
    ...(trail ? trailLines(trail, view.trailSkipped) : [`👣 الآن: ${shownPath(view.path)}`]),
    `🔢 عدد الصفحات: ${state.pages_before + 1} · مدة الزيارة: ${visitLength(state.seconds)}`
  ].join("\n");
}

/** The separate message when a request page is opened for the first time in the visit, or null. */
export function requestPageMessage(view: PageView, geo: Geo, state: VisitState): string | null {
  const page = REQUEST_PAGES[basePath(view.path)];
  if (!page || state.seen_before) return null;
  return [`🔥 الزائر فتح صفحة ${page}`, `📍 ${escapeHtml(placeOf(geo.city, geo.country))} · 📄 ${shownPath(view.path)}`].join("\n");
}
