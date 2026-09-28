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
  "admin-customers"
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

/** Called by the router after each render that changed the URL (title and locale are already set). */
export function trackVisit(route: Route, locale: string): void {
  const path = window.location.pathname;
  const from = referrer();
  previousPath = path;

  if (SKIPPED_ROUTES.has(route.name)) return;
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) return;

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
    campaign: campaignSource()
  });

  // keepalive lets the request finish even if the visitor leaves right away.
  fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {
    // Counting visits must never affect the page.
  });
}
