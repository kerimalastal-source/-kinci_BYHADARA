import { t } from "../i18n";

/** A price as written, kept left-to-right inside Arabic or Persian text; a starting price reads "From $380,000". */
export function priceHtml(price: string, from?: boolean): string {
  const value = `<bdi dir="ltr">${price}</bdi>`;
  return from ? t("projectDetail.priceFrom", { price: value }) : value;
}
