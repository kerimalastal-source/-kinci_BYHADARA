// DOM-free URL <-> route mapping. URLs look like "/projects/lotus-koru-2" (English)
// or "/ar/projects/lotus-koru-2" (other locales carry a prefix).
import { defaultLocale, isLocale, type Locale } from "../i18n/dictionaries";

export type Route =
  | { name: "home" }
  | { name: "projects" }
  | { name: "project"; slug: string }
  | { name: "about" }
  | { name: "citizenship" }
  | { name: "faq" }
  | { name: "blog" }
  | { name: "blog-post"; slug: string }
  | { name: "property-request" }
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
  if (segment === "faq") return { name: "faq" };
  if (segment === "blog" && p1) return { name: "blog-post", slug: p1 };
  if (segment === "blog") return { name: "blog" };
  if (segment === "property-request") return { name: "property-request" };
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
    case "not-found":
      return "/404";
    default:
      return `/${route.name}`;
  }
}
