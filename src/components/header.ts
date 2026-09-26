import type { Route } from "../router";
import { t, tRaw, getLocale, setLocale, locales, type Locale, link } from "../i18n";
import { openSearch } from "./search";
import { isAuthenticated, isAdmin, getCurrentProfile, signOut } from "../auth/session";
import { escapeHtml } from "../utils/html";
import { renderBrand } from "./brand";
import { WHATSAPP_ICON, WHATSAPP_NUMBER } from "./floatingButtons";

interface NavLink {
  route: string;
  key: string;
  match: Route["name"][];
}

const NAV_LINKS: NavLink[] = [
  { route: "/", key: "nav.home", match: ["home"] },
  { route: "/projects", key: "nav.projects", match: ["projects", "project"] },
  { route: "/resale", key: "nav.resale", match: ["resale", "resale-listing"] },
  { route: "/about", key: "nav.about", match: ["about"] }
];

const NAV_RESOURCES: NavLink[] = [
  { route: "/citizenship", key: "nav.citizenship", match: ["citizenship"] },
  { route: "/property-request", key: "nav.propertyRequest", match: ["property-request"] },
  { route: "/blog", key: "nav.blog", match: ["blog", "blog-post"] },
  { route: "/faq", key: "nav.faq", match: ["faq"] }
];

const NAV_TAIL: NavLink[] = [{ route: "/contact", key: "nav.contact", match: ["contact"] }];

export function renderHeader(el: HTMLElement, route: Route): void {
  const locale = getLocale();
  const langNames = tRaw<Record<Locale, string>>("lang");

  const langLinks = locales
    .map(
      (l) => `<button type="button" class="lang-switch__link${l === locale ? " is-active" : ""}" data-lang="${l}" aria-current="${l === locale ? "true" : "false"}" title="${langNames[l]}">${l.toUpperCase()}</button>`
    )
    .join("");

  el.className = "site-header";
  el.innerHTML = `
    <div class="site-header__inner container">
      ${renderBrand("header")}

      <nav class="main-nav" id="main-nav" aria-label="Main navigation">
        <ul class="main-nav__list">
          ${NAV_LINKS.map(
            (item) => `
            <li>
              <a class="main-nav__link${item.match.includes(route.name) ? " is-active" : ""}" href="${link(item.route)}">
                ${t(item.key)}
              </a>
            </li>`
          ).join("")}
          <li class="nav-group">
            <button
              type="button"
              class="main-nav__link nav-group__toggle${NAV_RESOURCES.some((item) => item.match.includes(route.name)) ? " is-active" : ""}"
              id="resources-toggle"
              aria-haspopup="true"
              aria-expanded="false"
            >
              ${t("nav.resources")}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <ul class="nav-group__menu" id="resources-menu" hidden>
              ${NAV_RESOURCES.map(
                (item) => `
                <li>
                  <a class="nav-group__link${item.match.includes(route.name) ? " is-active" : ""}" href="${link(item.route)}">${t(item.key)}</a>
                </li>`
              ).join("")}
            </ul>
          </li>
          ${NAV_TAIL.map(
            (item) => `
            <li class="main-nav__item--tail">
              <a class="main-nav__link${item.match.includes(route.name) ? " is-active" : ""}" href="${link(item.route)}">
                ${t(item.key)}
              </a>
            </li>`
          ).join("")}
          <li class="main-nav__lang">
            <div class="lang-switch" role="group" aria-label="${t("nav.language")}">${langLinks}</div>
          </li>
          <li class="main-nav__actions">
            <a class="btn btn--primary btn--block" href="${link("/contact")}">${t("nav.getInTouch")}</a>
            <a class="btn btn--whatsapp btn--block" href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" rel="noopener">
              ${WHATSAPP_ICON}
              ${t("floatingActions.whatsapp")}
            </a>
          </li>
        </ul>
      </nav>

      <div class="header-actions">
        <button class="icon-btn" id="search-toggle" type="button" aria-label="${t("nav.search")}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>

        <div class="lang-switch" role="group" aria-label="${t("nav.language")}">${langLinks}</div>

        <div class="account-switch">
          ${
            isAuthenticated()
              ? `
            <button class="account-switch__current" id="account-toggle" type="button" aria-haspopup="true" aria-expanded="false">
              ${escapeHtml(getCurrentProfile()?.full_name?.split(" ")[0]) || t("nav.account")}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <ul class="account-switch__menu" id="account-menu" hidden>
              <li><a href="${link("/account")}" class="${route.name === "account" || route.name === "account-new-listing" || route.name === "account-edit-listing" ? "is-active" : ""}">${t("nav.account")}</a></li>
              ${isAdmin() ? `<li><a href="${link("/admin")}" class="${route.name === "admin" || route.name === "admin-listing" ? "is-active" : ""}">${t("nav.admin")}</a></li>` : ""}
              <li><button type="button" id="logout-btn">${t("nav.logout")}</button></li>
            </ul>`
              : `<a class="account-switch__login" href="${link("/login")}" aria-label="${t("nav.login")}">
            <svg class="account-switch__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>
            <span class="account-switch__text">${t("nav.login")}</span>
          </a>`
          }
        </div>

        <a class="btn btn--primary btn--small header-cta" href="${link("/contact")}">${t("nav.getInTouch")}</a>

        <button class="icon-btn menu-toggle" id="menu-toggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="main-nav">
          <svg class="menu-toggle__open" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
          <svg class="menu-toggle__close" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="6" y1="6" x2="18" y2="18"></line>
            <line x1="18" y1="6" x2="6" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  `;

  const nav = el.querySelector<HTMLElement>("#main-nav")!;
  const menuToggle = el.querySelector<HTMLButtonElement>("#menu-toggle")!;
  const setMenuOpen = (open: boolean) => {
    nav.classList.toggle("is-open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    // The page behind the full-height mobile menu doesn't scroll.
    document.body.classList.toggle("nav-open", open);
  };
  // The header re-renders on every navigation; never leave the page locked.
  setMenuOpen(false);
  menuToggle.addEventListener("click", () => setMenuOpen(!nav.classList.contains("is-open")));
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenuOpen(false)));
  // On the inner wrapper (rebuilt each render) so listeners don't pile up on `el`.
  el.querySelector<HTMLElement>(".site-header__inner")!.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("is-open")) {
      setMenuOpen(false);
      menuToggle.focus();
    }
  });

  el.querySelectorAll<HTMLButtonElement>(".lang-switch__link").forEach((btn) => {
    btn.addEventListener("click", () => {
      setLocale(btn.dataset.lang as Locale);
    });
  });

  const accountToggle = el.querySelector<HTMLButtonElement>("#account-toggle");
  const accountMenu = el.querySelector<HTMLUListElement>("#account-menu");
  accountToggle?.addEventListener("click", () => {
    const hidden = accountMenu!.hasAttribute("hidden");
    if (hidden) accountMenu!.removeAttribute("hidden");
    else accountMenu!.setAttribute("hidden", "");
    accountToggle.setAttribute("aria-expanded", String(hidden));
  });
  el.querySelector<HTMLButtonElement>("#logout-btn")?.addEventListener("click", () => {
    void signOut();
  });

  const resourcesToggle = el.querySelector<HTMLButtonElement>("#resources-toggle")!;
  const resourcesMenu = el.querySelector<HTMLUListElement>("#resources-menu")!;
  resourcesToggle.addEventListener("click", () => {
    const hidden = resourcesMenu.hasAttribute("hidden");
    if (hidden) resourcesMenu.removeAttribute("hidden");
    else resourcesMenu.setAttribute("hidden", "");
    resourcesToggle.setAttribute("aria-expanded", String(hidden));
  });

  document.addEventListener(
    "click",
    (e) => {
      if (!el.contains(e.target as Node)) return;
      if (!(e.target as HTMLElement).closest(".nav-group")) {
        resourcesMenu.setAttribute("hidden", "");
        resourcesToggle.setAttribute("aria-expanded", "false");
      }
      if (!(e.target as HTMLElement).closest(".account-switch") && accountMenu) {
        accountMenu.setAttribute("hidden", "");
        accountToggle?.setAttribute("aria-expanded", "false");
      }
    },
    { capture: true }
  );

  el.querySelector<HTMLButtonElement>("#search-toggle")!.addEventListener("click", () => openSearch());
}
