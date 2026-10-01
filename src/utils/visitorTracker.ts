// Anonymous visit counter for the Telegram "new visitor" alerts (api/track.ts).
// No cookie and nothing personal: a random session id kept in sessionStorage (it ends
// when the tab closes), plus the page path, the site language and where the visit
// came from (the referring site's host name only, never its full URL).
import type { Route } from "../seo/routes";
import { campaignSource } from "./campaign";

const SESSION_KEY = "hadara-visit-session";
/** Path and title of the session's first page, so the updated alert keeps its 🏠 project line. */
const LANDING_TITLE_KEY = "hadara-visit-landing-title";
/** The pages of this visit in order ({p: path, n: title, t: time opened}), for the alert's visit trail. */
const TRAIL_KEY = "hadara-visit-trail";
/** Pages kept in the trail; past that, the oldest after the first page are dropped (and counted). */
const TRAIL_MAX = 40;
const ENDPOINT = "/api/track";

/** Seller account and admin pages are internal; they are never reported. */
export const SKIPPED_ROUTES: ReadonlySet<Route["name"]> = new Set([
  "account",
  "account-new-listing",
  "account-edit-listing",
  "admin",
  "admin-listing",
  "admin-bookings",
  "admin-inquiries",
  "admin-listings",
  "admin-stats",
  "admin-customers",
  "admin-pipeline",
  "admin-ads",
  "admin-chats"
]);

/** Pages whose title names a specific project, resale listing or article (shown in the alert). */
const TITLED_ROUTES: ReadonlySet<Route["name"]> = new Set(["project", "resale-listing", "blog-post"]);

let previousPath = "";

/** crypto.randomUUID needs a secure (https) page and a recent browser; same random v4 UUID otherwise. */
function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sessionId(): string | null {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = randomId();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // Storage blocked (some private modes): skip rather than track without a session.
    return null;
  }
}

/** The session's first page ({path, title}), remembered on its first tracked page. */
function landingPage(path: string, title: string): { path: string; title: string } {
  const page = { path, title };
  try {
    const saved = JSON.parse(sessionStorage.getItem(LANDING_TITLE_KEY) ?? "null") as { path?: unknown; title?: unknown } | null;
    if (saved && typeof saved.path === "string" && typeof saved.title === "string") return { path: saved.path, title: saved.title };
    sessionStorage.setItem(LANDING_TITLE_KEY, JSON.stringify(page));
  } catch {
    // Storage blocked or unreadable: the updated alert shows the path instead of the name.
  }
  return page;
}

interface TrailStep {
  p: string;
  n: string;
  t: number;
}

interface Trail {
  steps: TrailStep[];
  /** Pages dropped from the middle once the trail reached TRAIL_MAX. */
  skipped: number;
}

/** Adds this page to the visit's trail (unless it's the page already at its end) and returns it. */
function visitTrail(path: string, title: string): Trail {
  let trail: Trail = { steps: [], skipped: 0 };
  try {
    const saved = JSON.parse(sessionStorage.getItem(TRAIL_KEY) ?? "null") as Trail | null;
    if (saved && Array.isArray(saved.steps)) trail = { steps: saved.steps, skipped: Number(saved.skipped) || 0 };
  } catch {
    // Unreadable: start again from this page.
  }
  if (trail.steps[trail.steps.length - 1]?.p !== path) {
    trail.steps.push({ p: path, n: title, t: Date.now() });
    if (trail.steps.length > TRAIL_MAX) {
      trail.steps.splice(1, 1);
      trail.skipped += 1;
    }
    try {
      sessionStorage.setItem(TRAIL_KEY, JSON.stringify(trail));
    } catch {
      // Storage full or blocked: the alert keeps showing the current page only.
    }
  }
  return trail;
}

/** First page of this page load: the other site's host name, or our own path. Later: the previous page. */
function referrer(): string {
  if (previousPath) return previousPath;
  if (!document.referrer) return "";
  try {
    const url = new URL(document.referrer);
    return url.host === window.location.host ? url.pathname : url.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Phone, tablet or computer, from the browser's own description (iPads call themselves Macs). */
function deviceType(): "mobile" | "tablet" | "desktop" {
  const ua = navigator.userAgent;
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "tablet";
  if (/Mobi|iPhone|iPod|Android|IEMobile|Opera Mini/i.test(ua)) return "mobile";
  return "desktop";
}

const isLocal = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

/** Called by the router after each render that changed the URL (title and locale are already set). */
export function trackVisit(route: Route, locale: string): void {
  const path = window.location.pathname;
  const from = referrer();
  previousPath = path;

  if (SKIPPED_ROUTES.has(route.name)) return;
  if (isLocal()) return;

  const id = sessionId();
  if (!id) return;

  const title = TITLED_ROUTES.has(route.name) ? document.title : "";
  const landing = landingPage(path, title);
  const trail = visitTrail(path, title);
  const start = trail.steps[0]?.t ?? Date.now();
  const body = JSON.stringify({
    sessionId: id,
    path,
    locale,
    referrer: from,
    title,
    landingPath: landing.path,
    landingTitle: landing.title,
    // Each page with the seconds since the visit's first page.
    trail: trail.steps.map((step) => ({ path: step.p, title: step.n, at: Math.max(0, Math.round((step.t - start) / 1000)) })),
    trailSkipped: trail.skipped,
    campaign: campaignSource(),
    device: deviceType()
  });

  // keepalive lets the request finish even if the visitor leaves right away.
  fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {
    // Counting visits must never affect the page.
  });
}

/**
 * What the visitor did with the cookie notice in this visit: "none" when it is shown, then
 * "granted" or "denied" when they choose. Only counted (anonymously) in the admin statistics.
 */
export function reportConsent(choice: "granted" | "denied" | "none"): void {
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) return;
  const id = sessionId();
  if (!id) return;
  const body = JSON.stringify({ type: "consent", sessionId: id, choice, path: window.location.pathname });
  fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {
    // Never affects the page.
  });
}

/** What the admin statistics count (visitor_actions, supabase/migrations/0015). */
export type VisitAction =
  | "whatsapp"
  | "call"
  | "email"
  | "interested"
  | "favorite"
  | "video_play"
  | "map_open"
  | "chat_open"
  | "tour_link"
  | "form_start"
  | "form_sent";

/** Seller account and admin pages are never reported (same rule as page views). */
const INTERNAL_PATH = /^\/(?:(?:ar|fa|fr|ru)\/)?(?:admin|account|login|register)(?:\/|$)/;

/** The project whose page this is, or "". */
function pageProject(): string {
  return window.location.pathname.match(/^\/(?:(?:ar|fa|fr|ru)\/)?projects\/([a-z0-9-]+)/)?.[1] ?? "";
}

/** Actions counted once per page (opening the map twice is still one look at the map). */
const reportedOnPage = new Set<string>();

/**
 * One button press or form start, anonymous like the page views (the same per-tab session
 * id, no cookie): target is a project slug or a form name ("contact"...), "" when none.
 */
export function reportAction(action: VisitAction, target = pageProject(), oncePerPage = false): void {
  const path = window.location.pathname;
  if (isLocal() || INTERNAL_PATH.test(path)) return;
  if (oncePerPage) {
    const key = `${action}:${target}:${path}`;
    if (reportedOnPage.has(key)) return;
    reportedOnPage.add(key);
  }
  const id = sessionId();
  if (!id) return;
  const body = JSON.stringify({ type: "action", sessionId: id, action, target, path });
  fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {
    // Never affects the page.
  });
}

/** Forms whose start is counted (sending them is reported by trackLead / trackSchedule). */
const FORMS: [selector: string, name: string][] = [
  ["#contact-form", "contact"],
  ["#property-request-form", "property-request"],
  ["#consultancy-form", "consultancy"],
  [".tour-booking", "video-tour"]
];

function formStart(event: Event): void {
  const target = event.target as Element | null;
  if (!target?.closest) return;
  for (const [selector, name] of FORMS) {
    if (target.closest(selector)) {
      reportAction("form_start", name, true);
      return;
    }
  }
}

/** The first slug of a "?project=a,b" link, or the page's project. */
function linkProject(href: string): string {
  try {
    const slug = new URL(href, window.location.origin).searchParams.get("project")?.split(",")[0] ?? "";
    return /^[a-z0-9-]+$/.test(slug) ? slug : pageProject();
  } catch {
    return pageProject();
  }
}

function actionClick(event: MouseEvent): void {
  const target = event.target as Element | null;
  if (!target?.closest) return;

  const anchor = target.closest("a[href]");
  if (anchor) {
    const href = anchor.getAttribute("href") ?? "";
    if (href.startsWith("https://wa.me/")) return reportAction("whatsapp");
    if (href.startsWith("tel:")) return reportAction("call");
    if (href.startsWith("mailto:")) return reportAction("email");
    if (/\/video-tour(?:[/?#]|$)/.test(href)) return reportAction("tour_link", linkProject(href));
    if (/\/contact\?/.test(href) && /[?&]project=/.test(href)) return reportAction("interested", linkProject(href));
    return;
  }

  // Captured before the button reacts: aria-pressed / aria-expanded still show the old state.
  const fav = target.closest<HTMLElement>("[data-fav]");
  if (fav) {
    if (fav.getAttribute("aria-pressed") !== "true" && /^[a-z0-9-]+$/.test(fav.dataset.fav ?? "")) reportAction("favorite", fav.dataset.fav);
    return;
  }
  if (target.closest(".video-facade")) return reportAction("video_play", pageProject(), true);
  if (target.closest(".project-map__expand, .project-map__canvas")) return reportAction("map_open", pageProject(), true);
  const chat = target.closest("[data-chat-toggle]");
  if (chat && chat.getAttribute("aria-expanded") !== "true") reportAction("chat_open", pageProject(), true);
}

/** One listener each for the whole site (capture phase, so it runs before the page's own handlers). */
export function initVisitActions(): void {
  document.addEventListener("click", actionClick, true);
  document.addEventListener("focusin", formStart, true);
  document.addEventListener("click", formStart, true);
  // A new page is a new place to open the map or start a form again.
  window.addEventListener("popstate", () => reportedOnPage.clear());
}
