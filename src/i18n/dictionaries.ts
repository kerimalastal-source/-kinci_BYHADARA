// DOM-free translation core, shared by the browser app and the build-time SEO prerender.
// The dictionaries themselves are registered from outside: the browser loads only the languages
// it needs (i18n/load.ts), the build registers all five (i18n/all.ts).

export type Locale = "en" | "ar" | "fa" | "fr" | "ru";

export const locales: Locale[] = ["en", "ar", "fa", "fr", "ru"];

export const defaultLocale: Locale = "en";

export const rtlLocales: Locale[] = ["ar", "fa"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dict = any;

const dictionaries: Partial<Record<Locale, Dict>> = {};

export function registerDictionary(locale: Locale, dict: Dict): void {
  dictionaries[locale] = dict;
}

export function hasDictionary(locale: Locale): boolean {
  return dictionaries[locale] !== undefined;
}

/**
 * The Intl locale for dates and numbers: Latin digits everywhere, and the Gregorian
 * calendar for Persian too (Intl would otherwise use the Solar Hijri calendar, while
 * tour times, deadlines and the team all work with Gregorian dates).
 */
export function intlTag(locale: Locale): string {
  return locale === "fa" ? "fa-u-ca-gregory-nu-latn" : `${locale}-u-nu-latn`;
}

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

/** Looks up a key for a given locale, falling back to English when it is loaded (all five share the same keys). */
export function lookup(locale: Locale, key: string): unknown {
  const value = resolve(dictionaries[locale], key);
  return value === undefined ? resolve(dictionaries.en, key) : value;
}
