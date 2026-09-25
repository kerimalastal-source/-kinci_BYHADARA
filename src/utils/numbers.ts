const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_ARABIC_INDIC_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Converts Arabic-Indic and Extended Arabic-Indic (Persian) digits to Western digits. */
export function toWesternDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (ch) => {
    const arabicIndex = ARABIC_INDIC_DIGITS.indexOf(ch);
    if (arabicIndex !== -1) return String(arabicIndex);
    return String(EXTENDED_ARABIC_INDIC_DIGITS.indexOf(ch));
  });
}
