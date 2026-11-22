// Click-to-WhatsApp ads → the campaign name the customers page and the ad report use (the same
// names as SOURCES in src/pages/admin/addCustomer.ts and the spend entered on /admin/ads).
// Meta sends the ad's id with the first message from an ad; an ad that is not listed here is
// recorded as "ctwa-<ad id>". A new click-to-WhatsApp ad → add its id here.
const AD_CAMPAIGNS: Record<string, string> = {
  // Villa at the new price $1.45M (campaign 52513850360879, from 2026-11)
  "52513850404679": "villa145-ar",
  "52513850414879": "villa145-ar",
  "52513850416079": "villa145-ar",
  "52513850425679": "villa145-en",
  "52513850425879": "villa145-en",
  "52513850426079": "villa145-en",
  "52513851810679": "villa145-ar",
  "52513851812479": "villa145-en",
  "52513851046679": "villa145-iq",
  "52513851054679": "villa145-iq",
  "52513850416279": "villa145-warm",
  "52513850427079": "villa145-warm",
  // Gulf villa, AR / EN split (from 2026-11-07)
  "52510281419679": "gulf-villa-en",
  "52510281442079": "gulf-villa-ar",
  "52510283539479": "gulf-villa-broad",
  // Istanbul villa (from 2026-11-03)
  "52509211515079": "ist-villa-ar",
  "52509211524679": "ist-villa-en",
  "52509211548279": "ist-villa-ru",
  // Arab towns (2026-11-03 – 11-10)
  "52509211571679": "towns-villa",
  "52509205693079": "towns-citizenship",
  // Gulf + Kuwait (2026-10-23 – 11-06)
  "52509199142079": "gulf-kw-villa",
  "52506844023679": "gulf-kw-villa",
  "52506844941479": "gulf-kw-citizenship",
  "52506845366479": "gulf-kw-plan"
};

export function adCampaign(adId: string): string {
  return AD_CAMPAIGNS[adId] ?? `ctwa-${adId.replace(/[^0-9]/g, "").slice(0, 30)}`;
}
