// Anonymous visit counter for the Telegram "new visitor" alerts (api/track.ts).
// No cookie and nothing personal: a random session id kept in sessionStorage (it ends
// when the tab closes), plus the page path, the site language and where the visit
// came from (the referring site's host name only, never its full URL).
import type { Route } from "../seo/routes";

const SESSION_KEY = "hadara-visit-session";
const ENDPOINT = "/api/track";

/** Seller account and admin pages are internal; they are never reported. */
const SKIPPED_ROUTES: ReadonlySet<Route["name"]> = new Set([
  "account",
  "account-new-listing",
  "account-edit-listing",
  "admin",
  "admin-listing"
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

  const body = JSON.stringify({
    sessionId: id,
    path,
    locale,
    referrer: from,
    title: TITLED_ROUTES.has(route.name) ? document.title : ""
  });

  // keepalive lets the request finish even if the visitor leaves right away.
  fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {
    // Counting visits must never affect the page.
  });
}
