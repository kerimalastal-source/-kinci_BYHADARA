// DOM-free translation core, shared by the browser app and the build-time SEO prerender.
import en from "./en.json";
import ar from "./ar.json";
import fr from "./fr.json";
import ru from "./ru.json";

export type Locale = "en" | "ar" | "fr" | "ru";

export const locales: Locale[] = ["en", "ar", "fr", "ru"];

export const defaultLocale: Locale = "en";

export const rtlLocales: Locale[] = ["ar"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dict = any;

export const dictionaries: Record<Locale, Dict> = { en, ar, fr, ru };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as string[]).includes(value);
}

function resolve(dict: Dict, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, dict);
}

/** Looks up a key for a given locale, falling back to English. */
export function lookup(locale: Locale, key: string): unknown {
  const value = resolve(dictionaries[locale], key);
  return value === undefined ? resolve(dictionaries.en, key) : value;
}
