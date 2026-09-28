import type { Route } from "../router";
import { t, tRaw, getLocale, setLocale, locales, type Locale, link } from "../i18n";
import { openSearch } from "./search";
import { isAuthenticated, isAdmin, getCurrentProfile, signOut } from "../auth/session";
import { escapeHtml } from "../utils/html";
import { renderBrand } from "./brand";
import { WHATSAPP_ICON, WHATSAPP_NUMBER } from "./floatingButtons";
import { renderFavoritesLink } from "./favorites";
import { CONSULTANCY_PAGES, consultancyPath, type ConsultancyPage } from "../seo/routes";

interface NavLink {
  route: string;
  key: string;
  active: (route: Route) => boolean;
}

interface NavGroup {
  id: string;
  key: string;
  /** Shorter label for the one-line desktop bar; the full `key` label shows in the mobile menu. */
  shortKey?: string;
  items: NavLink[];
}

type NavEntry = NavLink | NavGroup;

const is = (...names: Route["name"][]) => (route: Route) => names.includes(route.name);
const consultancyPage = (page: ConsultancyPage) => (route: Route) => route.name === "consultancy" && route.page === page;

/* Four entries on the desktop bar (Home is the logo, Contact the button beside it);
   everything else sits in a dropdown so the bar fits laptop screens in every language. */
const NAV: NavEntry[] = [
  { route: "/", key: "nav.home", active: is("home") },
  {
    id: "projects",
    key: "nav.projects",
    items: [
      { route: "/projects", key: "nav.allProjects", active: is("projects", "project") },
      { route: "/video-tour", key: "videoTour.nav", active: is("video-tour") },
      { route: "/resale", key: "nav.resale", active: is("resale", "resale-listing") },
      { route: "/property-request", key: "nav.propertyRequest", active: is("property-request") }
    ]
  },
  {
    id: "consultancy",
    key: "nav.consultancy",
    shortKey: "nav.consultancyShort",
    items: CONSULTANCY_PAGES.map((page) => ({ route: consultancyPath(page), key: `consultancy.nav.${page}`, active: consultancyPage(page) }))
  },
  { route: "/about", key: "nav.about", active: is("about") },
  {
    id: "resources",
    key: "nav.resources",
    items: [
      { route: "/citizenship", key: "nav.citizenship", active: is("citizenship") },
      { route: "/blog", key: "nav.blog", active: is("blog", "blog-post") },
      { route: "/faq", key: "nav.faq", active: is("faq") }
    ]
  },
  { route: "/contact", key: "nav.contact", active: is("contact") }
];

const CHEVRON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';

function renderNavEntry(entry: NavEntry, route: Route): string {
  if ("route" in entry) {
    const active = entry.active(route);
    const cls = entry.route === "/" ? "main-nav__item--home" : entry.route === "/contact" ? "main-nav__item--tail" : "";
    return `
            <li${cls ? ` class="${cls}"` : ""}>
              <a class="main-nav__link${active ? " is-active" : ""}" href="${link(entry.route)}"${active ? ' aria-current="page"' : ""}>${t(entry.key)}</a>
            </li>`;
  }
  const active = entry.items.some((item) => item.active(route));
  const label = entry.shortKey
    ? `<span class="main-nav__label--short">${t(entry.shortKey)}</span><span class="main-nav__label--full">${t(entry.key)}</span>`
    : t(entry.key);
  return `
          <li class="nav-group" data-nav-group>
            <button type="button" class="main-nav__link nav-group__toggle${active ? " is-active" : ""}" id="${entry.id}-toggle" aria-haspopup="true" aria-expanded="false" aria-controls="${entry.id}-menu">
              ${label}
              ${CHEVRON}
            </button>
            <ul class="nav-group__menu" id="${entry.id}-menu" hidden>
              ${entry.items
                .map((item) => {
                  const on = item.active(route);
                  return `<li><a class="nav-group__link${on ? " is-active" : ""}" href="${link(item.route)}"${on ? ' aria-current="page"' : ""}>${t(item.key)}</a></li>`;
                })
                .join("")}
            </ul>
          </li>`;
}

/* The one-line desktop bar only fits so many items (more so in French and Russian).
   Below 1180px, or whenever the bar would overflow, the header switches to the
   hamburger menu instead of letting links collide with the logo or the buttons. */
const COMPACT_QUERY = "(max-width: 1179px)";
let fittedHeader: HTMLElement | null = null;
let closeMenu: () => void = () => {};

function fitHeader(): void {
  const el = fittedHeader;
  if (!el?.isConnected) return;
  const wasCompact = el.classList.contains("site-header--compact");
  let compact = window.matchMedia(COMPACT_QUERY).matches;
  if (!compact) {
    el.classList.remove("site-header--compact");
    const nav = el.querySelector<HTMLElement>(".main-nav");
    const list = el.querySelector<HTMLElement>(".main-nav__list");
    compact = Boolean(nav && list && list.scrollWidth > nav.clientWidth + 1);
  }
  el.classList.toggle("site-header--compact", compact);
  if (wasCompact && !compact) closeMenu();
}

let fitListenersAdded = false;
function watchHeaderFit(el: HTMLElement): void {
  fittedHeader = el;
  fitHeader();
  if (fitListenersAdded) return;
  fitListenersAdded = true;
  window.addEventListener("resize", fitHeader);
  // Label widths change once the web fonts arrive.
  void document.fonts?.ready.then(fitHeader);
}

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
          ${NAV.map((entry) => renderNavEntry(entry, route)).join("")}
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
        ${renderFavoritesLink()}
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
              ${isAdmin() ? `<li><a href="${link("/admin")}" class="${route.name === "admin" || route.name === "admin-stats" || route.name === "admin-customers" || route.name === "admin-listings" || route.name === "admin-listing" ? "is-active" : ""}">${t("nav.admin")}</a></li>
              <li><a href="${link("/admin/inquiries")}" class="${route.name === "admin-inquiries" ? "is-active" : ""}">${t("nav.inquiries")}</a></li>
              <li><a href="${link("/admin/bookings")}" class="${route.name === "admin-bookings" ? "is-active" : ""}">${t("nav.bookings")}</a></li>` : ""}
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
  closeMenu = () => setMenuOpen(false);
  watchHeaderFit(el);
  menuToggle.addEventListener("click", () => setMenuOpen(!nav.classList.contains("is-open")));
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenuOpen(false)));
  // On the inner wrapper (rebuilt each render) so listeners don't pile up on `el`.
  el.querySelector<HTMLElement>(".site-header__inner")!.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && groups.some((g) => g.querySelector('[aria-expanded="true"]'))) {
      const open = groups.find((g) => g.querySelector('[aria-expanded="true"]'))!;
      closeGroups();
      open.querySelector<HTMLButtonElement>(".nav-group__toggle")!.focus();
      return;
    }
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

  const groups = [...el.querySelectorAll<HTMLElement>("[data-nav-group]")];
  const setGroupOpen = (group: HTMLElement, open: boolean) => {
    group.querySelector<HTMLUListElement>(".nav-group__menu")!.hidden = !open;
    group.querySelector<HTMLButtonElement>(".nav-group__toggle")!.setAttribute("aria-expanded", String(open));
  };
  const closeGroups = (except?: HTMLElement) => groups.forEach((g) => g !== except && setGroupOpen(g, false));
  groups.forEach((group) => {
    const toggle = group.querySelector<HTMLButtonElement>(".nav-group__toggle")!;
    // Desktop bar: open on hover too (touch and the mobile menu keep tap-to-open).
    const hoverable = () => !el.classList.contains("site-header--compact") && window.matchMedia("(hover: hover)").matches;
    // A menu hover just opened stays open when the same pointer then clicks its button.
    let openedByHover = false;
    toggle.addEventListener("click", () => {
      const open = openedByHover || toggle.getAttribute("aria-expanded") !== "true";
      openedByHover = false;
      closeGroups(group);
      setGroupOpen(group, open);
    });
    group.addEventListener("mouseenter", () => {
      if (!hoverable()) return;
      closeGroups(group);
      setGroupOpen(group, true);
      openedByHover = true;
    });
    group.addEventListener("mouseleave", () => {
      openedByHover = false;
      if (hoverable()) setGroupOpen(group, false);
    });
  });

  document.addEventListener(
    "click",
    (e) => {
      if (!el.contains(e.target as Node)) return;
      if (!(e.target as HTMLElement).closest(".nav-group")) closeGroups();
      if (!(e.target as HTMLElement).closest(".account-switch") && accountMenu) {
        accountMenu.setAttribute("hidden", "");
        accountToggle?.setAttribute("aria-expanded", "false");
      }
    },
    { capture: true }
  );

  el.querySelector<HTMLButtonElement>("#search-toggle")!.addEventListener("click", () => openSearch());
}
