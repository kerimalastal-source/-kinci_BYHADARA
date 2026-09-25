// DOM-free page metadata (title, description, canonical, hreflang, Open Graph, JSON-LD).
// Used by the browser on every navigation and by the build step that prerenders each page's <head>.
import { lookup, locales, defaultLocale, rtlLocales, type Locale } from "../i18n/dictionaries";
import { localizePath, routePath, type Route } from "./routes";
import { projects } from "../data/projects";
import { blogPosts } from "../data/blog";

export const DEFAULT_SITE_URL = "https://hadararealestate.com";

const OG_LOCALES: Record<Locale, string> = { en: "en_US", ar: "ar_AR", fr: "fr_FR", ru: "ru_RU" };

const CONTACT = {
  telephone: "+90 531 930 92 14",
  email: "info@byhadara.com",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Adnan Kahveci Mah.",
    addressLocality: "Beylikdüzü",
    addressRegion: "Istanbul",
    postalCode: "34000",
    addressCountry: "TR"
  }
};

export interface PageMeta {
  locale: Locale;
  title: string;
  description: string;
  canonical: string;
  alternates: { hreflang: string; href: string }[];
  image: string;
  imageAlt: string;
  ogType: "website" | "article";
  noindex: boolean;
  jsonLd: Record<string, unknown>[];
}

type JsonLd = Record<string, unknown>;

/** Static page keys under "seo.*" in the dictionaries. */
const PAGE_KEYS: Partial<Record<Route["name"], string>> = {
  home: "home",
  projects: "projects",
  about: "about",
  citizenship: "citizenship",
  faq: "faq",
  blog: "blog",
  "property-request": "propertyRequest",
  contact: "contact",
  resale: "resale",
  "resale-listing": "resale",
  login: "login",
  register: "register",
  account: "account",
  "account-new-listing": "account",
  "account-edit-listing": "account",
  admin: "admin",
  "admin-listing": "admin",
  "not-found": "notFound"
};

const NOINDEX: Route["name"][] = [
  "login",
  "register",
  "account",
  "account-new-listing",
  "account-edit-listing",
  "admin",
  "admin-listing",
  "not-found"
];

/** Routes that are prerendered and listed in the sitemap, per locale. */
export function indexableRoutes(): Route[] {
  return [
    { name: "home" },
    { name: "projects" },
    ...projects.map((p) => ({ name: "project", slug: p.slug }) as Route),
    { name: "about" },
    { name: "citizenship" },
    { name: "faq" },
    { name: "blog" },
    ...blogPosts.map((p) => ({ name: "blog-post", slug: p.slug }) as Route),
    { name: "property-request" },
    { name: "contact" },
    { name: "resale" }
  ];
}

function clip(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\-–—،]+$/, "") + "…";
}

/** "Beylikdüzü" -> "beylikduzu", the key used in the district dictionaries. */
function placeKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .toLowerCase();
}

export function buildMeta(route: Route, locale: Locale, siteUrl = DEFAULT_SITE_URL): PageMeta {
  const tr = (key: string): string => String(lookup(locale, key) ?? key);
  const brand = tr("meta.siteNameFull");
  const abs = (path: string) => siteUrl + (path === "/" ? "/" : path);
  const url = (path: string, l: Locale = locale) => abs(localizePath(path, l));
  // Images self-hosted under /public are site-relative; crawlers need absolute URLs.
  const img = (src: string) => (src.startsWith("/") ? siteUrl + src : src);

  let pageRoute = route;
  let title = "";
  let description = "";
  let image = img(projects[0].coverImage.src);
  let imageAlt = brand;
  let ogType: PageMeta["ogType"] = "website";
  const jsonLd: JsonLd[] = [];
  const crumbs: { name: string; path: string }[] = [{ name: tr("nav.home"), path: "/" }];

  const project = route.name === "project" ? projects.find((p) => p.slug === route.slug) : undefined;
  const post = route.name === "blog-post" ? blogPosts.find((p) => p.slug === route.slug) : undefined;
  if ((route.name === "project" && !project) || (route.name === "blog-post" && !post)) {
    pageRoute = { name: "not-found" };
  }

  if (project) {
    const content = lookup(locale, `projectsData.${project.slug}`) as { name: string; tagline: string; shortDescription: string; longDescription: string };
    const district = tr(`propertyRequest.districts.${placeKey(project.district)}`);
    const city = tr(`propertyRequest.cities.${placeKey(project.city)}`);
    title = tr("seo.projectTitle").replace("{name}", content.name).replace("{district}", district).replace("{city}", city);
    description = clip(content.shortDescription);
    image = img(project.coverImage.src);
    imageAlt = content.name;
    crumbs.push({ name: tr("nav.projects"), path: "/projects" }, { name: content.name, path: routePath(route) });
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": project.slug.includes("villa") ? "SingleFamilyResidence" : "ApartmentComplex",
      name: content.name,
      description: content.longDescription,
      url: url(routePath(route)),
      image: [project.coverImage, ...project.gallery.slice(0, 5)].map((g) => img(g.src)),
      address: { "@type": "PostalAddress", addressLocality: project.district, addressRegion: project.city, addressCountry: "TR" },
      containedInPlace: { "@type": "City", name: project.city }
    });
  } else if (post) {
    const content = lookup(locale, `blogData.${post.slug}`) as { category: string; title: string; excerpt: string };
    title = content.title;
    description = clip(content.excerpt);
    image = post.coverImage.src;
    imageAlt = content.title;
    ogType = "article";
    crumbs.push({ name: tr("nav.blog"), path: "/blog" }, { name: content.title, path: routePath(route) });
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: content.title,
      description: content.excerpt,
      articleSection: content.category,
      image: post.coverImage.src,
      inLanguage: locale,
      url: url(routePath(route)),
      mainEntityOfPage: url(routePath(route)),
      author: { "@id": `${siteUrl}/#organization` },
      publisher: { "@id": `${siteUrl}/#organization` }
    });
  } else {
    const key = PAGE_KEYS[pageRoute.name] ?? "notFound";
    title = tr(`seo.${key}.title`);
    description = tr(`seo.${key}.description`);
    if (pageRoute.name !== "home" && pageRoute.name !== "not-found") {
      crumbs.push({ name: title, path: routePath(pageRoute) });
    }
  }

  if (pageRoute.name === "home") {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: brand,
      url: url("/"),
      inLanguage: locale,
      publisher: { "@id": `${siteUrl}/#organization` }
    });
  }

  if (pageRoute.name === "projects") {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: projects.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: url(`/projects/${p.slug}`),
        name: (lookup(locale, `projectsData.${p.slug}`) as { name: string }).name
      }))
    });
  }

  if (pageRoute.name === "faq") {
    const categories = lookup(locale, "faq.categories") as { items: { q: string; a: string }[] }[];
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: categories.flatMap((c) =>
        c.items.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a }
        }))
      )
    });
  }

  jsonLd.push({
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": `${siteUrl}/#organization`,
    name: brand,
    alternateName: ["HADARA", "HADARA Real Estate", "حضارة للتطوير العقاري"],
    url: url("/"),
    logo: `${siteUrl}/favicon-512.png`,
    image: img(projects[0].coverImage.src),
    foundingDate: "2014",
    areaServed: "Istanbul, Türkiye",
    openingHours: "Mo-Sa 09:00-18:00",
    ...CONTACT
  });

  if (crumbs.length > 1) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: url(c.path) }))
    });
  }

  const path = routePath(pageRoute.name === "not-found" ? route : pageRoute);
  const noindex = NOINDEX.includes(pageRoute.name);

  return {
    locale,
    title: pageRoute.name === "home" ? title : `${title} | ${brand}`,
    description,
    canonical: url(path),
    alternates: noindex
      ? []
      : [
          ...locales.map((l) => ({ hreflang: l, href: url(path, l) })),
          { hreflang: "x-default", href: url(path, defaultLocale) }
        ],
    image,
    imageAlt,
    ogType,
    noindex,
    jsonLd
  };
}

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The <head> tags for a page (everything except <title>), each marked data-seo so they can be swapped on navigation. */
export function renderHeadTags(meta: PageMeta): string {
  const tag = (html: string) => html.replace(/^<(\w+)/, "<$1 data-seo");
  const metaName = (name: string, content: string) => tag(`<meta name="${name}" content="${esc(content)}">`);
  const metaProp = (property: string, content: string) => tag(`<meta property="${property}" content="${esc(content)}">`);

  return [
    metaName("description", meta.description),
    metaName("robots", meta.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"),
    ...(meta.noindex ? [] : [tag(`<link rel="canonical" href="${esc(meta.canonical)}">`)]),
    ...meta.alternates.map((a) => tag(`<link rel="alternate" hreflang="${a.hreflang}" href="${esc(a.href)}">`)),
    metaProp("og:type", meta.ogType),
    metaProp("og:site_name", String(lookup(meta.locale, "meta.siteNameFull"))),
    metaProp("og:title", meta.title),
    metaProp("og:description", meta.description),
    metaProp("og:url", meta.canonical),
    metaProp("og:image", meta.image),
    metaProp("og:image:alt", meta.imageAlt),
    metaProp("og:locale", OG_LOCALES[meta.locale]),
    ...locales.filter((l) => l !== meta.locale).map((l) => metaProp("og:locale:alternate", OG_LOCALES[l])),
    metaName("twitter:card", "summary_large_image"),
    metaName("twitter:title", meta.title),
    metaName("twitter:description", meta.description),
    metaName("twitter:image", meta.image),
    ...meta.jsonLd.map((data) => tag(`<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`))
  ].join("\n    ");
}

export function isRtlLocale(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}
