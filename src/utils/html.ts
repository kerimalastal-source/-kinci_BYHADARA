/** Escapes user-submitted text before interpolating it into an innerHTML template. */
export function escapeHtml(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Keeps phone numbers (and other spaced digit runs) left-to-right inside Arabic / Persian
 * text. Takes text that is already escaped with escapeHtml().
 */
export function isolateNumbers(escaped: string): string {
  return escaped.replace(/\+?\d[\d \u00a0()-]{5,}\d/g, '<span dir="ltr">$&</span>');
}
