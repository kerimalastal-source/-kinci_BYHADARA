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

// Visits from the link in our social profiles' bio. Instagram tags that link by itself with
// "utm_source=ig · utm_medium=social · utm_content=link_in_bio" (owner saw it 2026-11-22 as
// "📣 الإعلان"). Free, not an ad.

const BIO_PLATFORMS: Record<string, string> = {
  ig: "إنستغرام",
  instagram: "إنستغرام",
  fb: "فيسبوك",
  facebook: "فيسبوك",
  threads: "ثريدز",
};

/** "رابط البايو في إنستغرام" when the visit came from a profile bio link, else "". */
export function bioLink(campaign: string | null | undefined): string {
  if (!campaign || param(campaign, "utm_medium").toLowerCase() === "paid") return "";
  if (param(campaign, "utm_content").toLowerCase() !== "link_in_bio") return "";
  const platform = BIO_PLATFORMS[param(campaign, "utm_source").toLowerCase()];
  return platform ? `رابط البايو في ${platform}` : "رابط البايو في حساباتنا";
}

// Visits from the owner's personal Instagram bio. His link carries
// "utm_source=owner · utm_medium=social · utm_campaign=personal-bio" (owner 2026-11-22).
// Checked before bioLink(), because Instagram may add its own link_in_bio tag to it.

export const OWNER_PERSONAL_NAME = "حساب المالك الشخصي على إنستغرام";

/** True when the visit came from the owner's personal account link. */
export function fromOwnerPersonal(campaign: string | null | undefined): boolean {
  if (!campaign || param(campaign, "utm_medium").toLowerCase() === "paid") return false;
  return param(campaign, "utm_source").toLowerCase() === "owner";
}

// Visits from the link in the company's own Instagram bio (@hadararealestate). Its link carries
// "utm_source=hadara_ig · utm_medium=social · utm_campaign=company-bio" (owner 2026-11-23).
// Checked before bioLink(), because Instagram may add its own link_in_bio tag to it.

export const COMPANY_INSTAGRAM_NAME = "حساب الشركة على إنستغرام (hadararealestate)";

/** True when the visit came from the company's own Instagram bio link. */
export function fromCompanyInstagram(campaign: string | null | undefined): boolean {
  if (!campaign || param(campaign, "utm_medium").toLowerCase() === "paid") return false;
  return param(campaign, "utm_source").toLowerCase() === "hadara_ig";
}

// Visits from a link or QR code inside our PDF catalogues (scripts/catalog): the projects
// catalogue tags its links "utm_source=catalog · utm_medium=print · utm_campaign=catalog-<year>",
// the villa brochure "utm_campaign=villa-brochure-<year>". The owner saw the first one on
// 2026-11-24 as "📣 الإعلان" and asked for its own name. Free, not an ad.

/** "كتالوج مشاريع حضارة (PDF)" or "كتالوج الفيلا (PDF)" when the visit came from a catalogue, else "". */
export function catalogLink(campaign: string | null | undefined): string {
  if (!campaign || param(campaign, "utm_medium").toLowerCase() === "paid") return "";
  if (param(campaign, "utm_source").toLowerCase() !== "catalog") return "";
  return param(campaign, "utm_campaign").toLowerCase().startsWith("villa")
    ? "كتالوج فيلا مرمرة هيفن (PDF)"
    : "كتالوج مشاريع حضارة (PDF)";
}
