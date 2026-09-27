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

/**
 * Selected architectural / interior works shown in the portfolio section.
 * Empty until real HADARA work is supplied: the section then shows a "portfolio on request" note.
 * Add an entry per project, put its images under public/images/consultancy/works/<slug>-<width>.webp,
 * and its text under `consultancy.worksData.<slug>` ({ title, category, location }) in all four dictionaries.
 */
export interface ConsultancyWork {
  slug: string;
  image: ResponsiveImage;
}

export const consultancyWorks: ConsultancyWork[] = [];

export function srcset(img: ResponsiveImage): string {
  return img.widths.map((w) => `${img.base}-${w}.webp ${w}w`).join(", ");
}

/** A mid-size file as the plain `src` fallback. */
export function fallbackSrc(img: ResponsiveImage): string {
  return `${img.base}-${img.widths[Math.min(1, img.widths.length - 1)]}.webp`;
}
