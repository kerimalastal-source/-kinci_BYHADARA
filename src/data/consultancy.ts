// DOM-free data for the Engineering & Architectural Consultancy page (also read by the SEO build step).
// All text lives in the dictionaries under "consultancy.*"; this file holds keys and images only.

/** A self-hosted image published in several widths: `${base}-${width}.webp`. */
export interface ResponsiveImage {
  base: string;
  widths: number[];
  /** Intrinsic size of the largest file (sets the aspect ratio and prevents layout shift). */
  width: number;
  height: number;
}

const DIR = "/images/consultancy";

/** Social-share image (JPEG, 1200×630: WebP is not read by every link preview). */
export const CONSULTANCY_OG_IMAGE = `${DIR}/hero-og.jpg`;

export const HERO_IMAGE: ResponsiveImage = { base: `${DIR}/hero`, widths: [768, 1280, 1680], width: 1680, height: 944 };
export const STUDIO_IMAGE: ResponsiveImage = { base: `${DIR}/studio`, widths: [640, 1200], width: 1200, height: 800 };

/** Service keys, in display order. Each has `consultancy.services[i]` text and a form option. */
export const SERVICE_KEYS = ["architectural", "engineering", "interior", "visualization", "development", "renovation"] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];

export const PROJECT_TYPE_KEYS = [
  "villas",
  "residential",
  "apartments",
  "hospitality",
  "offices",
  "retail",
  "restaurants",
  "mixedUse"
] as const;
export type ProjectTypeKey = (typeof PROJECT_TYPE_KEYS)[number];

export const projectTypeImage = (key: ProjectTypeKey): ResponsiveImage => ({
  base: `${DIR}/types/${key}`,
  widths: [480, 800],
  width: 800,
  height: 600
});

/** Architecture office whose projects make up the portfolio (a HADARA company). */
export const WORKS_OFFICE = { name: "Kuba Mimarlık", url: "https://www.kubamimarlik.net/" };

export type WorkCategory = "residentialDevelopment" | "residentialComplex" | "commercialComplex" | "industrialCommercial";

/**
 * Selected works, designed by Kuba Mimarlık (figures and renders from kubamimarlik.net).
 * Images: public/images/consultancy/works/<slug>/<n>-<width>.webp, the first one is the cover.
 * The category label is `consultancy.workCategories.<category>`; the district needs a `places.*` key.
 * With an empty list the section falls back to a "portfolio on request" note.
 */
export interface ConsultancyWork {
  slug: string;
  /** Project name as marketed (not translated). */
  title: string;
  category: WorkCategory;
  district: string;
  city: string;
  year: string;
  area: string;
  images: ResponsiveImage[];
}

const work = (slug: string, sizes: [number, number][]): ResponsiveImage[] =>
  sizes.map(([width, height], i) => ({ base: `${DIR}/works/${slug}/${i + 1}`, widths: [640, 1600], width, height }));

export const consultancyWorks: ConsultancyWork[] = [
  {
    slug: "alya-konaklari",
    title: "Alya Konakları",
    category: "residentialDevelopment",
    district: "Zeytinburnu",
    city: "Istanbul",
    year: "2023",
    area: "85,000 m²",
    images: work("alya-konaklari", [[1600, 900], [1600, 900], [1600, 900], [1600, 900], [1600, 900]])
  },
  {
    slug: "memorial",
    title: "Memorial",
    category: "commercialComplex",
    district: "Esenyurt",
    city: "Istanbul",
    year: "2023",
    area: "45,000 m²",
    images: work("memorial", [[1600, 900], [1600, 900], [1600, 1600], [1600, 1600], [1600, 1229]])
  },
  {
    slug: "kirlangic-evleri",
    title: "Beylikdüzü Kırlangıç Evleri",
    category: "residentialDevelopment",
    district: "Beylikdüzü",
    city: "Istanbul",
    year: "2023",
    area: "65,000 m²",
    images: work("kirlangic-evleri", [[1600, 890], [1600, 1454], [1600, 1454], [1600, 900]])
  },
  {
    slug: "akca-grande",
    title: "Akça Grande",
    category: "residentialComplex",
    district: "Büyükçekmece",
    city: "Istanbul",
    year: "2022",
    area: "25,000 m²",
    images: work("akca-grande", [[1600, 1143], [1600, 1067], [1600, 1333], [1600, 2000]])
  },
  {
    slug: "aktim-3",
    title: "Aktim 3",
    category: "industrialCommercial",
    district: "Avcılar",
    city: "Istanbul",
    year: "2021",
    area: "65,000 m²",
    images: work("aktim-3", [[1600, 800], [1600, 900], [1600, 800], [1600, 800]])
  },
  {
    slug: "dora-park-7",
    title: "Dora Park 7",
    category: "residentialDevelopment",
    district: "Beylikdüzü",
    city: "Istanbul",
    year: "2021",
    area: "25,000 m²",
    images: work("dora-park-7", [[1600, 1135], [1600, 923], [1600, 800], [1600, 808]])
  }
];

export function srcset(img: ResponsiveImage): string {
  return img.widths.map((w) => `${img.base}-${w}.webp ${w}w`).join(", ");
}

/** A mid-size file as the plain `src` fallback. */
export function fallbackSrc(img: ResponsiveImage): string {
  return `${img.base}-${img.widths[Math.min(1, img.widths.length - 1)]}.webp`;
}
