// DOM-free translation core, shared by the browser app and the build-time SEO prerender.
// The dictionaries themselves are registered from outside: the browser loads only the languages
// it needs (i18n/load.ts), the build registers all five (i18n/all.ts).

export type Locale = "en" | "ar" | "fa" | "fr" | "ru" | "de";

export const locales: Locale[] = ["en", "ar", "fa", "fr", "ru", "de"];

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

// The browser gets a dictionary in parts (i18n/load.ts): the core first, then every project's long
// texts and each article's body only where they are shown. The build registers whole dictionaries,
// so for it these parts are always "already there".

/** Whether projectsData.<slug> carries its long texts (description, highlights, nearby places...). */
export function hasProjectDetails(locale: Locale): boolean {
  const data = dictionaries[locale]?.projectsData as Record<string, Record<string, unknown>> | undefined;
  if (!data) return false;
  const first = Object.values(data)[0];
  return !first || "longDescription" in first;
}

export function mergeProjectDetails(locale: Locale, details: Record<string, Record<string, unknown>>): void {
  const data = dictionaries[locale]?.projectsData as Record<string, Record<string, unknown>> | undefined;
  if (!data) return;
  for (const [slug, fields] of Object.entries(details)) {
    if (data[slug]) Object.assign(data[slug], fields);
  }
}

/** Whether blogData.<slug> carries its body; true for an unknown article (there is nothing to load). */
export function hasBlogBody(locale: Locale, slug: string): boolean {
  const dict = dictionaries[locale];
  if (!dict) return false;
  const article = dict.blogData?.[slug] as Record<string, unknown> | undefined;
  return !article || "body" in article;
}

export function mergeBlogBody(locale: Locale, slug: string, part: Record<string, unknown>): void {
  const article = dictionaries[locale]?.blogData?.[slug] as Record<string, unknown> | undefined;
  if (article) Object.assign(article, { body: [] }, part);
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
