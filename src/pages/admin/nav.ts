import { t, link } from "../../i18n";

/** The admin pages, in the order of the admin sub-navigation. */
export type AdminSection = "home" | "inquiries" | "bookings" | "customers" | "stats" | "listings";

const SECTIONS: [AdminSection, string][] = [
  ["home", "/admin"],
  ["inquiries", "/admin/inquiries"],
  ["bookings", "/admin/bookings"],
  ["customers", "/admin/customers"],
  ["stats", "/admin/stats"],
  ["listings", "/admin/listings"]
];

/** The row of links between the admin pages, the current one highlighted. */
export function adminNav(active: AdminSection): string {
  return `<nav class="admin-subnav" aria-label="${t("admin.heroEyebrow")}">
    ${SECTIONS.map(
      ([key, path]) => `<a href="${link(path)}"${key === active ? ' aria-current="page"' : ""}>${t(`adminNav.${key}`)}</a>`
    ).join("")}
  </nav>`;
}

/** The dark banner at the top of every admin page. */
export function adminHero(title: string, subtitle: string): string {
  return `
    <section class="page-hero page-hero--admin">
      <div class="container">
        <p class="eyebrow eyebrow--on-dark">${t("admin.heroEyebrow")}</p>
        <h1>${title}</h1>
        <p class="page-hero__subtitle">${subtitle}</p>
      </div>
    </section>`;
}

/** A search term passed in the page's address (?q=), e.g. from a customer's history. */
export function queryParam(name: string): string {
  return new URLSearchParams(window.location.search).get(name)?.trim() ?? "";
}
