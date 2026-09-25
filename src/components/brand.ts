import { link } from "../i18n";

/* The brand is never translated: the name and tagline are the same literal
   English words in every locale, and the block stays left-to-right (mark,
   name, tagline) even on RTL pages. lang/translate keep screen readers and
   browser auto-translation from treating it as page-language text. */
export const BRAND_NAME = "HADARA";
export const BRAND_TAGLINE = "Real Estate";
export const BRAND_FULL = `${BRAND_NAME} ${BRAND_TAGLINE}`;

export function renderBrand(variant: "header" | "footer"): string {
  const logo = variant === "footer" ? "/logo-light.png" : "/logo-dark.png";
  const logoClass = variant === "footer" ? "brand__logo brand__logo--footer" : "brand__logo";
  return `
    <a class="brand" href="${link("/")}" aria-label="${BRAND_FULL}" lang="en" dir="ltr" translate="no">
      <img class="${logoClass}" src="${logo}" alt="${BRAND_FULL}" />
      <span class="brand__text">
        <span class="brand__name">${BRAND_NAME}</span>
        <span class="brand__tagline">${BRAND_TAGLINE}</span>
      </span>
    </a>`;
}
