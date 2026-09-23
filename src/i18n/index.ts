import en from "./en.json";
import ar from "./ar.json";
import fr from "./fr.json";
import ru from "./ru.json";

export type Locale = "en" | "ar" | "fr" | "ru";

export const locales: Locale[] = ["en", "ar", "fr", "ru"];

export const rtlLocales: Locale[] = ["ar"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dict = any;

const dictionaries: Record<Locale, Dict> = { en, ar, fr, ru };

const STORAGE_KEY = "hadara-locale";
const listeners = new Set<(locale: Locale) => void>();

function detectInitialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (stored && locales.includes(stored)) return stored;
  const nav = navigator.language.slice(0, 2);
  if (locales.includes(nav as Locale)) return nav as Locale;
  return "en";
}

let currentLocale: Locale = detectInitialLocale();

export function getLocale(): Locale {
  return currentLocale;
}

export function isRtl(locale: Locale = currentLocale): boolean {
  return rtlLocales.includes(locale);
}

export function setLocale(locale: Locale): void {
  if (!locales.includes(locale)) return;
  currentLocale = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  applyDocumentAttributes(locale);
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

function resolve(dict: Dict, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, dict);
}

/** Translate a dot-path key, e.g. t("home.heroTitle"). Falls back to English, then the key itself. */
export function t(key: string, vars?: Record<string, string | number>): string {
  let value = resolve(dictionaries[currentLocale], key);
  if (value === undefined) value = resolve(dictionaries.en, key);
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
  let value = resolve(dictionaries[currentLocale], key);
  if (value === undefined) value = resolve(dictionaries.en, key);
  return value as T;
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
