import { buildMeta, renderHeadTags, DEFAULT_SITE_URL } from "./meta";
import type { Route } from "./routes";
import type { Locale } from "../i18n/dictionaries";

const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") || DEFAULT_SITE_URL;

/** Replaces the page's SEO <head> tags (title, description, canonical, hreflang, Open Graph, JSON-LD). */
export function applyMeta(route: Route, locale: Locale): void {
  const meta = buildMeta(route, locale, SITE_URL);
  document.title = meta.title;
  document.head.querySelectorAll("[data-seo]").forEach((el) => el.remove());
  document.head.insertAdjacentHTML("beforeend", renderHeadTags(meta));
}
