// Ad and analytics tags (Meta Pixel, Google Analytics 4, Google Ads).
// Each tag is off until its ID is filled in below (or set as a Vercel env var),
// so the site ships nothing to Meta/Google until the IDs exist.
// Nothing loads until the visitor accepts the cookie notice (components/cookieConsent.ts);
// the choice is kept in localStorage ("hadara-consent") for a year.
//
// Events sent:
//   - a page view on every route change (the site is a single-page app);
//   - ViewContent on a project page (for retargeting that project's visitors);
//   - Lead / generate_lead (+ the Google Ads lead conversion) when an inquiry form is sent;
//   - Schedule (+ generate_lead and the lead conversion) when a private video tour is requested;
//   - Contact / contact (+ the optional Google Ads contact conversion) on WhatsApp, call and email links.
// Meta's ViewContent, Lead, Schedule and Contact also go to our server (/api/meta-event), which
// forwards them to Meta's Conversions API with the same event ID, so Meta counts each one once
// even when the browser blocks the Pixel. Only after consent, like the Pixel itself.
import type { Route } from "../seo/routes";
import { SKIPPED_ROUTES, reportAction } from "./visitorTracker";
import { campaignSource } from "./campaign";

const TAGS = {
  /** Meta Events Manager → Datasets → "HADARA Real Estate" (business portfolio "Hadara Real Estate"). Public, not a secret. */
  metaPixelId: import.meta.env.VITE_META_PIXEL_ID || "983229534799823",
  /** Google Analytics → Admin → Data streams → Measurement ID (property "hadararealestate.com"). Public, not a secret. */
  gaId: import.meta.env.VITE_GA_ID || "G-LJHKMV096Q",
  /** Google Ads → Goals → Conversions → tag setup: the "AW-..." ID and each conversion's label. */
  adsId: import.meta.env.VITE_GOOGLE_ADS_ID || "",
  adsLeadLabel: import.meta.env.VITE_GOOGLE_ADS_LEAD_LABEL || "",
  adsContactLabel: import.meta.env.VITE_GOOGLE_ADS_CONTACT_LABEL || ""
};

type Params = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; callMethod?: (...args: unknown[]) => void };
    _fbq?: unknown;
  }
}

const googleId = TAGS.gaId || TAGS.adsId;

function loadScript(src: string): void {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

/** After the page has loaded and gone idle, so the tags never slow the first paint (ads land on these pages). */
function whenIdle(task: () => void): void {
  const run = () => ("requestIdleCallback" in window ? window.requestIdleCallback(task, { timeout: 3000 }) : setTimeout(task, 1500));
  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
}

export type Consent = "granted" | "denied";

const CONSENT_KEY = "hadara-consent";
const CONSENT_MS = 365 * 86_400_000;

/** True when at least one tag has an ID, i.e. there is something to ask consent for. */
export function trackingConfigured(): boolean {
  return Boolean(TAGS.metaPixelId || googleId);
}

/** The visitor's choice from the cookie notice, or null if they haven't chosen (or it is over a year old). */
export function storedConsent(): Consent | null {
  try {
    const saved = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? "null") as { v?: string; at?: string } | null;
    if ((saved?.v === "granted" || saved?.v === "denied") && Date.now() - Date.parse(saved.at ?? "") < CONSENT_MS) return saved.v;
  } catch {
    /* storage blocked or corrupt: ask again */
  }
  return null;
}

/** Saves the choice; accepting loads the tags now (and counts the current page), declining stops them. */
export function setConsent(choice: Consent): void {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ v: choice, at: new Date().toISOString() }));
  } catch {
    /* still applies for this page view */
  }
  if (choice === "granted") startTags();
  else stopTags();
}

let started = false;
let active = false;
let lastPage: { route: Route; locale: string } | null = null;

/** Wires the contact-link listener and starts the tags if the visitor already accepted. */
export function initTracking(): void {
  if (!trackingConfigured()) return;
  document.addEventListener("click", trackContactClick, true);
  if (storedConsent() === "granted") startTags();
}

function stopTags(): void {
  if (!active) return;
  active = false;
  window.fbq?.("consent", "revoke");
  window.gtag?.("consent", "update", { ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
}

/** Sets up the queues right away (events fired early are kept) and loads the vendor scripts once idle. */
function startTags(): void {
  if (active) return;
  active = true;
  if (started) {
    window.fbq?.("consent", "grant");
    window.gtag?.("consent", "update", { ad_storage: "granted", analytics_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" });
    return;
  }
  started = true;
  if (TAGS.metaPixelId) {
    // Meta's standard stub: calls queue up until fbevents.js takes over.
    const fbq = function (this: unknown) {
      // eslint-disable-next-line prefer-rest-params
      if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments as unknown as unknown[]);
      // eslint-disable-next-line prefer-rest-params
      else fbq.queue!.push(arguments);
    } as NonNullable<Window["fbq"]>;
    Object.assign(fbq, { push: fbq, loaded: true, version: "2.0", queue: [] });
    window.fbq = fbq;
    window._fbq = fbq;
    fbq("init", TAGS.metaPixelId);
    whenIdle(() => loadScript("https://connect.facebook.net/en_US/fbevents.js"));
  }

  if (googleId) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // gtag.js expects the arguments object itself, not an array.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag("js", new Date());
    // Page views are sent by hand on each route change (see trackPageView).
    if (TAGS.gaId) window.gtag("config", TAGS.gaId, { send_page_view: false });
    if (TAGS.adsId) window.gtag("config", TAGS.adsId, { send_page_view: false });
    whenIdle(() => loadScript(`https://www.googletagmanager.com/gtag/js?id=${googleId}`));
  }

  // The page the visitor accepted on hasn't been counted yet.
  if (lastPage) trackPageView(lastPage.route, lastPage.locale);
}

/** Contact details for Meta's matching on a sent form (the server hashes them; never stored). */
export type LeadUser = { email?: string; phone?: string; name?: string };

/** Events also sent server-side through the Conversions API (see api/meta-event.ts). */
const SERVER_EVENTS = new Set(["ViewContent", "Lead", "Schedule", "Contact"]);

function newEventId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

function cookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

/** Meta's click ID: the _fbc cookie, or built from the fbclid of the ad link (kept by campaign.ts). */
function clickId(): string {
  const fbc = cookie("_fbc");
  if (fbc) return fbc;
  const fbclid = new URLSearchParams(window.location.search).get("fbclid") ?? campaignSource().match(/fbclid=([^\s·]+)/)?.[1];
  return fbclid ? `fb.1.${Date.now()}.${fbclid}` : "";
}

function sendServerEvent(event: string, eventId: string, params: Params | undefined, user: LeadUser | undefined): void {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") return;
  const body = JSON.stringify({
    event,
    eventId,
    url: window.location.href,
    fbp: cookie("_fbp"),
    fbc: clickId(),
    params: params ?? {},
    user: user ?? {}
  });
  fetch("/api/meta-event", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
}

function meta(event: string, params?: Params, user?: LeadUser): void {
  if (!active || !TAGS.metaPixelId) return;
  const eventId = newEventId();
  window.fbq?.("track", event, params ?? {}, { eventID: eventId });
  if (SERVER_EVENTS.has(event)) sendServerEvent(event, eventId, params, user);
}

function google(event: string, params?: Params): void {
  if (!active) return;
  window.gtag?.("event", event, params);
}

function adsConversion(label: string, params?: Params): void {
  if (TAGS.adsId && label) google("conversion", { send_to: `${TAGS.adsId}/${label}`, ...params });
}

/** Called by the router after each render that changed the URL (title and locale are already set). */
export function trackPageView(route: Route, locale: string): void {
  // Seller account and admin pages are ours, not ad traffic.
  if (SKIPPED_ROUTES.has(route.name)) return;
  lastPage = { route, locale };
  if (!active) return;
  meta("PageView");
  if (TAGS.gaId) {
    google("page_view", {
      send_to: TAGS.gaId,
      page_location: window.location.href,
      page_path: window.location.pathname + window.location.search,
      page_title: document.title,
      language: locale
    });
  }
  if (route.name === "project") {
    meta("ViewContent", { content_type: "product", content_ids: [route.slug], content_name: route.slug });
  }
}

/** An inquiry was sent: form is "contact", "property-request" or "consultancy"; detail names the projects/service. */
export function trackLead(form: string, detail = "", user?: LeadUser): void {
  reportAction("form_sent", form);
  meta("Lead", { content_category: form, ...(detail ? { content_name: detail } : {}) }, user);
  google("generate_lead", { form_name: form, ...(detail ? { item_name: detail } : {}) });
  adsConversion(TAGS.adsLeadLabel);
}

/** A private video tour was requested: Meta's Schedule event, counted as a lead in Analytics and Google Ads. */
export function trackSchedule(projects: string, user?: LeadUser): void {
  reportAction("form_sent", "video-tour");
  meta("Schedule", { content_category: "video-tour", content_name: projects }, user);
  google("generate_lead", { form_name: "video-tour", item_name: projects });
  adsConversion(TAGS.adsLeadLabel);
}

const CONTACT_METHODS: [prefix: string, method: string][] = [
  ["https://wa.me/", "whatsapp"],
  ["tel:", "phone"],
  ["mailto:", "email"]
];

/** WhatsApp, call and email links anywhere on the site (header, floating buttons, chat, project pages...). */
function trackContactClick(event: MouseEvent): void {
  const anchor = (event.target as Element | null)?.closest?.("a[href]");
  const href = anchor?.getAttribute("href") ?? "";
  const method = CONTACT_METHODS.find(([prefix]) => href.startsWith(prefix))?.[1];
  if (!method) return;
  const page = window.location.pathname;
  meta("Contact", { content_category: method, content_name: page });
  google("contact", { method, page_path: page });
  adsConversion(TAGS.adsContactLabel);
}
