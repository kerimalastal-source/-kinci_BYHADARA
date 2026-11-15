// The browser downloads a language's dictionary in parts, and only when they are needed:
//  - the core of the page language before the first render (plus English and Arabic on the form
//    pages, for the team's copy of a message, and all five for the chat and the admin pages);
//  - every project's long texts on a project page and when the chat opens;
//  - one article's body on that article's page.
// The parts come from scripts/i18n-split-plugin.mjs; src/i18n/<locale>.json stays one file on disk.
import { core, projects, blog } from "virtual:i18n/loaders";
import {
  hasBlogBody,
  hasDictionary,
  hasProjectDetails,
  locales,
  mergeBlogBody,
  mergeProjectDetails,
  registerDictionary,
  type Locale
} from "./dictionaries";
import type { Route } from "../seo/routes";

const pending = new Map<string, Promise<void>>();

/** One download per part, however many callers ask for it at once. */
function once(key: string, start: () => Promise<void>): Promise<void> {
  let promise = pending.get(key);
  if (!promise) {
    promise = start().finally(() => pending.delete(key));
    pending.set(key, promise);
  }
  return promise;
}

function loadOne(locale: Locale): Promise<void> {
  if (hasDictionary(locale)) return Promise.resolve();
  return once(`core:${locale}`, () => core[locale]().then((mod) => registerDictionary(locale, mod.default)));
}

export function ensureLocales(list: Locale[]): Promise<void> {
  return Promise.all(list.map(loadOne)).then(() => undefined);
}

export function ensureAllLocales(): Promise<void> {
  return ensureLocales(locales);
}

/** Long texts of every project (description, highlights, nearby places, floor plan, verified facts). */
export function ensureProjectDetails(locale: Locale): Promise<void> {
  if (hasProjectDetails(locale)) return Promise.resolve();
  return once(`projects:${locale}`, () => {
    // Started together with the core, merged once both are here.
    const details = projects[locale]();
    return loadOne(locale)
      .then(() => details)
      .then((mod) => mergeProjectDetails(locale, mod.default as Record<string, Record<string, unknown>>));
  });
}

export function ensureBlogBody(locale: Locale, slug: string): Promise<void> {
  if (hasBlogBody(locale, slug)) return Promise.resolve();
  const load = blog[locale]?.[slug];
  return once(`blog:${locale}:${slug}`, () => {
    const body = load ? load() : Promise.resolve({ default: {} });
    return loadOne(locale)
      .then(() => body)
      .then((mod) => mergeBlogBody(locale, slug, mod.default as Record<string, unknown>));
  });
}

/** Pages with a form whose message also goes to the team in English and Arabic. */
const FORM_ROUTES = new Set<Route["name"]>(["contact", "property-request", "video-tour", "consultancy"]);

/** The languages a page needs before it can render. */
function routeLocales(route: Route, locale: Locale): Locale[] {
  // Admin pages show customers' messages in their own languages, so they need every dictionary;
  // the form pages also write the team's copy in English and Arabic.
  if (route.name.startsWith("admin")) return locales;
  if (FORM_ROUTES.has(route.name)) return [...new Set<Locale>([locale, "en", "ar"])];
  return [locale];
}

/** Whether everything a page reads from the dictionaries is already here. */
export function routeReady(route: Route, locale: Locale): boolean {
  if (routeLocales(route, locale).some((l) => !hasDictionary(l))) return false;
  if (route.name === "project") return hasProjectDetails(locale);
  if (route.name === "blog-post") return hasBlogBody(locale, route.slug);
  return true;
}

/** Downloads what a page needs, all parts at once. */
export function ensureRoute(route: Route, locale: Locale): Promise<void> {
  const jobs: Promise<void>[] = [ensureLocales(routeLocales(route, locale))];
  if (route.name === "project") jobs.push(ensureProjectDetails(locale));
  if (route.name === "blog-post") jobs.push(ensureBlogBody(locale, route.slug));
  return Promise.all(jobs).then(() => undefined);
}
