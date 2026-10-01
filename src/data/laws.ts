// "Property Laws" page (/property-laws): the current rules in short + legal updates.
//
// Owner's rules (2026-09-29): every item comes ONLY from a Turkish government or official
// source (Resmî Gazete, mevzuat.gov.tr, ministries, TKGM, GİB, Göç İdaresi, NVİ, TBMM…),
// never from news sites, social media, agencies or blogs, and every item shows the link
// to that official source. The owner reviews and approves each item before it goes live.
//
// The texts live in the dictionaries: `lawsData.rules.<id>` ({title, text}) and
// `lawsData.updates.<id>` ({title, summary, before?, after, affects, help}).

/** The page (menu link, sitemap, prerendered pages) stays off until the owner approves it. */
export const LAWS_PAGE_LIVE = true;

export const LAW_TOPICS = ["citizenship", "residence", "ownership", "taxes", "rent"] as const;
export type LawTopic = (typeof LAW_TOPICS)[number];

/** Official publishers; their names are translated under `laws.sources.<key>`. */
export type LawSourceKey = "resmiGazete" | "mevzuat" | "tkgm" | "gib" | "goc" | "ticaret" | "tbmm" | "nvi";

export interface LawSource {
  key: LawSourceKey;
  url: string;
}

interface LawItem {
  id: string;
  topic: LawTopic;
  sources: LawSource[];
  /** When a person last checked the item against its official source (YYYY-MM-DD). */
  checked: string;
  /** Only approved items are shown on the live page (drafts appear with ?preview). */
  approved: boolean;
}

/** "The current rules in short". */
export type LawRule = LawItem;

/** A dated legal update (newest first on the page). */
export interface LawUpdate extends LawItem {
  /** Date of the decision / publication (YYYY-MM-DD). */
  decided: string;
  /** Date it applies from, when different (YYYY-MM-DD). */
  effective?: string;
  /** Official reference in Turkish, e.g. "7566 sayılı Kanun · Resmî Gazete 33112". */
  reference: string;
  /** A bill still in parliament: shown with a "not law yet" badge. */
  stage?: "proposal";
}

/** Only government / official hosts are ever linked (owner's rule). */
export function isOfficialUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && (hostname.endsWith(".gov.tr") || hostname === "gov.tr");
  } catch {
    return false;
  }
}

export const lawRules: LawRule[] = [
  {
    id: "citizenship-property",
    topic: "citizenship",
    sources: [
      { key: "mevzuat", url: "https://www.mevzuat.gov.tr/MevzuatMetin/21.5.2010139.pdf" },
      { key: "tkgm", url: "https://www.tkgm.gov.tr/yabancii-db/vatandaslik-icin-tasinmaz-edinimi-hakkinda-mevzuat" }
    ],
    checked: "2026-10-01",
    approved: true
  },
  {
    id: "residence-property",
    topic: "residence",
    sources: [{ key: "goc", url: "https://e-ikamet.goc.gov.tr/Ikamet/BasvuruIstenenBelgeler/BasvuruFormuIstenenBelgeler?tur=0" }],
    checked: "2026-10-01",
    approved: true
  },
  {
    id: "residence-closed-areas",
    topic: "residence",
    sources: [
      { key: "goc", url: "https://www.goc.gov.tr/mahalle-kapatma-duyurusu-hk" }
    ],
    checked: "2026-10-01",
    approved: true
  },
  {
    id: "valuation-report",
    topic: "ownership",
    sources: [{ key: "tkgm", url: "https://tkgm.gov.tr/tr/icerik/yabanciya-konut-satisinda-degerleme-zorunlulugu" }],
    checked: "2026-10-01",
    approved: true
  },
  {
    id: "currency-certificate",
    topic: "ownership",
    sources: [
      { key: "tkgm", url: "https://www.tkgm.gov.tr/yabancilarin-gayrimenkul-aliminda-doviz-bozdurma-zorunlulugu-ile-ilgili-sikca-sorulan-sorular" }
    ],
    checked: "2026-10-01",
    approved: true
  },
  {
    id: "title-deed-fee",
    topic: "taxes",
    sources: [{ key: "mevzuat", url: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.492.pdf" }],
    checked: "2026-10-01",
    approved: true
  },
  {
    id: "property-tax",
    topic: "taxes",
    sources: [
      { key: "gib", url: "https://www.gib.gov.tr/vergi-konulari/1_bireysel/6_emlak_vergisi/6" },
      { key: "mevzuat", url: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.1319.pdf" }
    ],
    checked: "2026-10-01",
    approved: true
  },
  {
    id: "rent-increase",
    topic: "rent",
    sources: [{ key: "mevzuat", url: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6098.pdf" }],
    checked: "2026-10-01",
    approved: true
  }
];

export const lawUpdates: LawUpdate[] = [
  {
    id: "rent-regulation-board-bill",
    topic: "rent",
    decided: "2026-07-01",
    reference: "Toplu Konut Kanunu ile Türk Borçlar Kanununda Değişiklik Yapılmasına İlişkin Kanun Teklifi",
    stage: "proposal",
    sources: [{ key: "tbmm", url: "https://www.tbmm.gov.tr/Yasama/KanunTeklifi/9bf8033d-8af3-4dc7-ac99-019f1debe16f" }],
    checked: "2026-10-01",
    approved: true
  },
  {
    id: "secure-payment-system",
    topic: "ownership",
    decided: "2026-04-29",
    effective: "2026-12-01",
    reference: "Taşınmaz Ticareti Hakkında Yönetmelikte Değişiklik · Resmî Gazete 33238",
    sources: [
      { key: "resmiGazete", url: "https://www.resmigazete.gov.tr/eskiler/2026/04/20260429-4.htm" },
      {
        key: "ticaret",
        url: "https://ticaret.gov.tr/haberler/tasinmaz-satislarinda-guvenli-odeme-sistemi-ile-ilgili-yonetmelik-degisikligi-hakkinda-basin-aciklamasi"
      }
    ],
    checked: "2026-10-01",
    approved: true
  },
  {
    id: "savings-finance-foreigners",
    topic: "ownership",
    decided: "2026-01-22",
    reference: "TKGM Yabancı İşler Dairesi duyurusu",
    sources: [{ key: "tkgm", url: "https://www.tkgm.gov.tr/en/yabanci-isler-duyuru?page=1" }],
    checked: "2026-10-01",
    approved: true
  },
  {
    id: "valuable-housing-tax-2026",
    topic: "taxes",
    decided: "2025-12-31",
    effective: "2026-01-01",
    reference: "GİB · 2026 Değerli Konut Vergisi Rehberi",
    sources: [
      {
        key: "gib",
        url: "https://cdn.gib.gov.tr/api/gibportal-file/file/getFileResources?objectKey=arsiv%2Ffileadmin%2Fbeyannamerehberi%2F2026%2F2026_Degerli_Konut_Vergisi_Rehberi.pdf"
      }
    ],
    checked: "2026-10-01",
    approved: true
  },
  {
    id: "property-tax-cap-2026",
    topic: "taxes",
    decided: "2025-12-19",
    effective: "2026-01-01",
    reference: "7566 sayılı Kanun · Resmî Gazete 33112",
    sources: [{ key: "resmiGazete", url: "https://www.resmigazete.gov.tr/eskiler/2025/12/20251219-1.htm" }],
    checked: "2026-10-01",
    approved: true
  },
  {
    id: "title-deed-declared-price",
    topic: "taxes",
    decided: "2025-12-19",
    reference: "7566 sayılı Kanun · Resmî Gazete 33112",
    sources: [{ key: "resmiGazete", url: "https://www.resmigazete.gov.tr/eskiler/2025/12/20251219-1.htm" }],
    checked: "2026-10-01",
    approved: true
  },
  {
    id: "citizenship-amount-certificate",
    topic: "citizenship",
    decided: "2024-12-09",
    reference: "TKGM 2024/4 sayılı Genelge (değişik)",
    sources: [
      { key: "tkgm", url: "https://www.tkgm.gov.tr/yabancii-db/turk-vatandasligi-kanunu-uygulama-yonetmeligi-hk-20244-sayili-genelge" }
    ],
    checked: "2026-10-01",
    approved: true
  }
];

/** Items visible on the page: approved ones, or every draft in preview mode. */
export function visibleLawItems<T extends LawItem>(items: T[], preview: boolean): T[] {
  return items
    .filter((item) => preview || item.approved)
    .map((item) => ({ ...item, sources: item.sources.filter((s) => isOfficialUrl(s.url)) }))
    .filter((item) => item.sources.length > 0);
}

/** Updates sorted newest first. */
export function sortedLawUpdates(items: LawUpdate[]): LawUpdate[] {
  return [...items].sort((a, b) => b.decided.localeCompare(a.decided));
}
