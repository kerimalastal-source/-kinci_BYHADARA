// The browser loads a language's dictionary only when it is needed: the page language first,
// then English and Arabic for the few places that use them on any page (search keywords,
// the team's Arabic summary of a message), and all five for the chat and the admin pages.
import { hasDictionary, locales, registerDictionary, type Locale } from "./dictionaries";

const loaders: Record<Locale, () => Promise<{ default: unknown }>> = {
  en: () => import("./en.json"),
  ar: () => import("./ar.json"),
  fa: () => import("./fa.json"),
  fr: () => import("./fr.json"),
  ru: () => import("./ru.json")
};

const pending = new Map<Locale, Promise<void>>();

function loadOne(locale: Locale): Promise<void> {
  if (hasDictionary(locale)) return Promise.resolve();
  let promise = pending.get(locale);
  if (!promise) {
    promise = loaders[locale]()
      .then((mod) => registerDictionary(locale, mod.default))
      .finally(() => pending.delete(locale));
    pending.set(locale, promise);
  }
  return promise;
}

export function ensureLocales(list: Locale[]): Promise<void> {
  return Promise.all(list.map(loadOne)).then(() => undefined);
}

export function ensureAllLocales(): Promise<void> {
  return ensureLocales(locales);
}
