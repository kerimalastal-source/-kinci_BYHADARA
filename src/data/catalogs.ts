// The PDF catalogues the site hands out (public/catalogs/, the web edition of scripts/catalog).
// The villa has its own brochure; every other project gets the catalogue of all projects.
// One file per site language (ar, en, fa, fr, ru, de).
// Keep in step with api/_lib/catalogRequest.ts (the server picks the same file for the team's alert).
import type { Locale } from "../i18n/dictionaries";

export interface Catalog {
  /** Server-relative URL of the PDF. */
  path: string;
  /** File size, rounded, for the download button. */
  sizeMb: number;
  /** The villa's own brochure, as opposed to the catalogue of all projects. */
  villa: boolean;
}

const FILES: Record<string, Catalog> = {
  "catalogue-ar": { path: "/catalogs/hadara-catalogue-ar.pdf", sizeMb: 7, villa: false },
  "catalogue-en": { path: "/catalogs/hadara-catalogue-en.pdf", sizeMb: 8, villa: false },
  "catalogue-fa": { path: "/catalogs/hadara-catalogue-fa.pdf", sizeMb: 7, villa: false },
  "catalogue-fr": { path: "/catalogs/hadara-catalogue-fr.pdf", sizeMb: 8, villa: false },
  "catalogue-ru": { path: "/catalogs/hadara-catalogue-ru.pdf", sizeMb: 8, villa: false },
  "catalogue-de": { path: "/catalogs/hadara-catalogue-de.pdf", sizeMb: 8, villa: false },
  "villa-ar": { path: "/catalogs/marmara-haven-villa-ar.pdf", sizeMb: 3, villa: true },
  "villa-en": { path: "/catalogs/marmara-haven-villa-en.pdf", sizeMb: 3, villa: true },
  "villa-fa": { path: "/catalogs/marmara-haven-villa-fa.pdf", sizeMb: 3, villa: true },
  "villa-fr": { path: "/catalogs/marmara-haven-villa-fr.pdf", sizeMb: 3, villa: true },
  "villa-ru": { path: "/catalogs/marmara-haven-villa-ru.pdf", sizeMb: 3, villa: true },
  "villa-de": { path: "/catalogs/marmara-haven-villa-de.pdf", sizeMb: 3, villa: true }
};

export function catalogFor(slug: string, locale: Locale): Catalog {
  return FILES[`${slug === "marmara-haven-villa" ? "villa" : "catalogue"}-${locale}`];
}
