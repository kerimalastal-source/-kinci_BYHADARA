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
