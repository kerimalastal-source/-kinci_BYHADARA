// Remembers which ad or campaign brought the visitor (utm_* / gclid / fbclid), so
// inquiries can tell the team where the lead came from.
const KEY = "hadara-campaign";
const PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"];

export function captureCampaign(): void {
  const query = new URLSearchParams(window.location.search);
  const found = PARAMS.filter((p) => query.get(p)).map((p) => `${p}=${query.get(p)}`);
  if (!found.length) return;
  try {
    sessionStorage.setItem(KEY, found.join(" · "));
  } catch {
    // Storage can be blocked (private mode); the inquiry simply goes without a source.
  }
}

/** "utm_source=facebook · utm_campaign=villa" for the landing visit, or "" when there was none. */
export function campaignSource(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
