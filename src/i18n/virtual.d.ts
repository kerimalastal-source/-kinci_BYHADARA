// Dictionary parts served by scripts/i18n-split-plugin.mjs.
declare module "virtual:i18n/loaders" {
  type Locale = "en" | "ar" | "fa" | "fr" | "ru" | "de";
  type Loader = () => Promise<{ default: unknown }>;
  /** Everything except project long texts and article bodies. */
  export const core: Record<Locale, Loader>;
  /** Every project's long texts for one language. */
  export const projects: Record<Locale, Loader>;
  /** One article's body. */
  export const blog: Record<Locale, Record<string, Loader>>;
}
