import { defaultLocale, isLocale, lookup, locales, rtlLocales, type Locale } from "./dictionaries";
import { localizePath, splitLocale } from "../seo/routes";

export { locales, rtlLocales, type Locale };

const STORAGE_KEY = "hadara-locale";
const listeners = new Set<(locale: Locale) => void>();

// The URL is the source of truth for the locale; the router keeps this in sync.
let currentLocale: Locale = splitLocale(window.location.pathname).locale;

export function getLocale(): Locale {
  return currentLocale;
}

export function isRtl(locale: Locale = currentLocale): boolean {
  return rtlLocales.includes(locale);
}

/** The locale a returning visitor picked earlier, or their browser language. */
export function getPreferredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // storage unavailable
  }
  const nav = navigator.language.slice(0, 2);
  return isLocale(nav) ? nav : defaultLocale;
}

/** Called by the router on every navigation: adopts the locale encoded in the URL. */
export function syncLocale(locale: Locale): void {
  currentLocale = locale;
  applyDocumentAttributes(locale);
}

/** Language switcher: moves to the same page in another locale. */
export function setLocale(locale: Locale): void {
  if (!isLocale(locale)) return;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // storage unavailable
  }
  const { path } = splitLocale(window.location.pathname);
  history.pushState(null, "", localizePath(path, locale) + window.location.search);
  syncLocale(locale);
  listeners.forEach((fn) => fn(locale));
}

export function onLocaleChange(fn: (locale: Locale) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function applyDocumentAttributes(locale: Locale): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = isRtl(locale) ? "rtl" : "ltr";
}

applyDocumentAttributes(currentLocale);

/** Localized href for an internal path, e.g. link("/projects") -> "/ar/projects". */
export function link(path: string): string {
  return localizePath(path, currentLocale);
}

/** Translate a dot-path key, e.g. t("home.heroTitle"). Falls back to English, then the key itself. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const value = lookup(currentLocale, key);
  if (value === undefined) return key;
  let str = String(value);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
}

/** Returns a raw (non-string) translation value, e.g. an array of objects. */
export function tRaw<T = unknown>(key: string): T {
  return lookup(currentLocale, key) as T;
}

export function getProjectContent(slug: string) {
  return tRaw<{
    name: string;
    tagline: string;
    shortDescription: string;
    longDescription: string;
    highlights: string[];
  }>(`projectsData.${slug}`);
}
