// Visits sent by the group's parent website, BYHADARA Group (byhadara.com). Its articles and
// home page link here. Its links carry "utm_source=byhadara" (they used rel="noreferrer", which
// hides the referrer), and a referrer of byhadara.com is counted too. These visits are free,
// not an ad, so the alerts and the morning report name them instead of "📣 الإعلان".

export const GROUP_NAME = "موقع حضارة الأم (BYHADARA Group)";

function isGroupHost(value: string | null | undefined): boolean {
  if (!value) return false;
  let host = value.trim().toLowerCase();
  try {
    if (/^https?:\/\//.test(host)) host = new URL(host).hostname;
  } catch {
    // Not a URL: use the text as a host name.
  }
  host = host.split("/")[0].replace(/^www\./, "");
  return host === "byhadara" || host === "byhadara.com" || host.endsWith(".byhadara.com");
}

function param(campaign: string, key: string): string {
  const part = campaign.split(" · ").find((p) => p.startsWith(`${key}=`));
  return part ? part.slice(key.length + 1) : "";
}

/** True when the visit came from the group's website (by its campaign tag or its referrer). */
export function fromGroupSite(campaign: string | null | undefined, referrer: string | null | undefined): boolean {
  if (campaign && param(campaign, "utm_medium").toLowerCase() !== "paid" && isGroupHost(param(campaign, "utm_source"))) return true;
  return isGroupHost(referrer);
}

/** The group page that sent the visit (utm_campaign, e.g. "home" or an article slug), or "". */
export function groupPlacement(campaign: string | null | undefined): string {
  return campaign ? param(campaign, "utm_campaign").slice(0, 80) : "";
}

// Visits from the company's Google Business Profile (the listing on Google Maps and in Google
// search). Its website link carries "utm_source=google_business · utm_medium=organic ·
// utm_campaign=gbp" (owner 2026-11-22). Free, not an ad.

export const GOOGLE_BUSINESS_NAME = "ملف جوجل التجاري (خرائط جوجل)";

/** True when the visit came from the Google Business Profile link. */
export function fromGoogleBusiness(campaign: string | null | undefined): boolean {
  if (!campaign || param(campaign, "utm_medium").toLowerCase() === "paid") return false;
  const source = param(campaign, "utm_source").toLowerCase();
  return source === "google_business" || source === "gbp";
}
