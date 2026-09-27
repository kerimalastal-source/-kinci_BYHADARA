// DOM-free URL <-> route mapping. URLs look like "/projects/lotus-koru-2" (English)
// or "/ar/projects/lotus-koru-2" (other locales carry a prefix).
import { defaultLocale, isLocale, type Locale } from "../i18n/dictionaries";

/** URL segment of the Engineering & Architectural Consultancy section. */
export const CONSULTANCY_SEGMENT = "engineering-architecture";

/** Its pages: the overview at /engineering-architecture, the others one level below. */
export const CONSULTANCY_PAGES = ["overview", "services", "portfolio", "process", "consultation"] as const;
export type ConsultancyPage = (typeof CONSULTANCY_PAGES)[number];

const CONSULTANCY_SLUGS: Record<ConsultancyPage, string> = {
  overview: "",
  services: "services",
  portfolio: "portfolio",
  process: "how-we-work",
  consultation: "request-consultation"
};

/** Unprefixed path of a consultancy page: consultancyPath("services") -> "/engineering-architecture/services". */
export function consultancyPath(page: ConsultancyPage = "overview"): string {
  const slug = CONSULTANCY_SLUGS[page];
  return `/${CONSULTANCY_SEGMENT}${slug ? `/${slug}` : ""}`;
}

export type Route =
  | { name: "home" }
  | { name: "projects" }
  | { name: "project"; slug: string }
  | { name: "about" }
  | { name: "citizenship" }
  | { name: "consultancy"; page: ConsultancyPage }
  | { name: "faq" }
  | { name: "privacy" }
  | { name: "blog" }
  | { name: "blog-post"; slug: string }
  | { name: "property-request" }
  | { name: "video-tour" }
  | { name: "contact" }
  | { name: "login" }
  | { name: "register" }
  | { name: "account" }
  | { name: "account-new-listing" }
  | { name: "account-edit-listing"; id: string }
  | { name: "resale" }
  | { name: "resale-listing"; id: string }
  | { name: "admin" }
  | { name: "admin-listing"; id: string }
  | { name: "not-found" };

/** Splits "/ar/projects" into { locale: "ar", path: "/projects" }. */
export function splitLocale(pathname: string): { locale: Locale; path: string; prefixed: boolean } {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length && isLocale(parts[0]) && parts[0] !== defaultLocale) {
    return { locale: parts[0], path: "/" + parts.slice(1).join("/"), prefixed: true };
  }
  return { locale: defaultLocale, path: "/" + parts.join("/"), prefixed: false };
}

/** Adds the locale prefix to an unprefixed path: ("/projects", "ar") -> "/ar/projects". */
export function localizePath(path: string, locale: Locale): string {
  const clean = "/" + path.split("/").filter(Boolean).join("/");
  if (locale === defaultLocale) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

export function parseRoute(path: string): Route {
  const [segment, p1, p2, p3] = path.split("/").filter(Boolean);

  if (!segment) return { name: "home" };
  if (segment === "projects" && p1) return { name: "project", slug: p1 };
  if (segment === "projects") return { name: "projects" };
  if (segment === "about") return { name: "about" };
  if (segment === "citizenship") return { name: "citizenship" };
  if (segment === CONSULTANCY_SEGMENT) {
    const page = CONSULTANCY_PAGES.find((p) => CONSULTANCY_SLUGS[p] === (p1 ?? "") && !p2);
    return page ? { name: "consultancy", page } : { name: "not-found" };
  }
  if (segment === "faq") return { name: "faq" };
  if (segment === "privacy" && !p1) return { name: "privacy" };
  if (segment === "blog" && p1) return { name: "blog-post", slug: p1 };
  if (segment === "blog") return { name: "blog" };
  if (segment === "property-request") return { name: "property-request" };
  if (segment === "video-tour") return { name: "video-tour" };
  if (segment === "contact") return { name: "contact" };
  if (segment === "login") return { name: "login" };
  if (segment === "register") return { name: "register" };
  if (segment === "account") {
    if (p1 === "listings" && p2 === "new") return { name: "account-new-listing" };
    if (p1 === "listings" && p2 && p3 === "edit") return { name: "account-edit-listing", id: p2 };
    return { name: "account" };
  }
  if (segment === "resale" && p1) return { name: "resale-listing", id: p1 };
  if (segment === "resale") return { name: "resale" };
  if (segment === "admin") {
    if (p1 === "listings" && p2) return { name: "admin-listing", id: p2 };
    return { name: "admin" };
  }
  return { name: "not-found" };
}

/** Inverse of parseRoute: the unprefixed path for a route. */
export function routePath(route: Route): string {
  switch (route.name) {
    case "home":
      return "/";
    case "project":
      return `/projects/${route.slug}`;
    case "blog-post":
      return `/blog/${route.slug}`;
    case "account-new-listing":
      return "/account/listings/new";
    case "account-edit-listing":
      return `/account/listings/${route.id}/edit`;
    case "resale-listing":
      return `/resale/${route.id}`;
    case "admin-listing":
      return `/admin/listings/${route.id}`;
    case "consultancy":
      return consultancyPath(route.page);
    case "not-found":
      return "/404";
    default:
      return `/${route.name}`;
  }
}
