import type { Route } from "../router";
import { t, tRaw, getLocale, setLocale, locales, type Locale } from "../i18n";
import { openSearch } from "./search";

const NAV_ITEMS: { route: string; key: string; match: Route["name"][] }[] = [
  { route: "#/", key: "nav.home", match: ["home"] },
  { route: "#/projects", key: "nav.projects", match: ["projects", "project"] },
  { route: "#/about", key: "nav.about", match: ["about"] },
  { route: "#/citizenship", key: "nav.citizenship", match: ["citizenship"] },
  { route: "#/contact", key: "nav.contact", match: ["contact"] }
];

export function renderHeader(el: HTMLElement, route: Route): void {
  const locale = getLocale();
  const langNames = tRaw<Record<Locale, string>>("lang");

  el.className = "site-header";
  el.innerHTML = `
    <div class="site-header__inner container">
      <a class="brand" href="#/" aria-label="${t("meta.siteNameFull")}">
        <span class="brand__mark">H</span>
        <span class="brand__text">
          <span class="brand__name">${t("meta.siteName")}</span>
          <span class="brand__tagline">${t("meta.tagline")}</span>
        </span>
      </a>

      <nav class="main-nav" id="main-nav" aria-label="Main navigation">
        <ul class="main-nav__list">
          ${NAV_ITEMS.map(
            (item) => `
            <li>
              <a class="main-nav__link${item.match.includes(route.name) ? " is-active" : ""}" href="${item.route}">
                ${t(item.key)}
              </a>
            </li>`
          ).join("")}
        </ul>
      </nav>

      <div class="header-actions">
        <button class="icon-btn" id="search-toggle" type="button" aria-label="${t("nav.search")}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>

        <div class="lang-switch">
          <button class="lang-switch__current" id="lang-toggle" type="button" aria-haspopup="listbox" aria-expanded="false">
            ${locale.toUpperCase()}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <ul class="lang-switch__menu" id="lang-menu" role="listbox" hidden>
            ${locales
              .map(
                (l) => `<li role="option" data-lang="${l}" aria-selected="${l === locale}" class="${l === locale ? "is-active" : ""}">${langNames[l]}</li>`
              )
              .join("")}
          </ul>
        </div>

        <a class="btn btn--primary btn--small header-cta" href="#/contact">${t("nav.getInTouch")}</a>

        <button class="icon-btn menu-toggle" id="menu-toggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="main-nav">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  `;

  const nav = el.querySelector<HTMLElement>("#main-nav")!;
  const menuToggle = el.querySelector<HTMLButtonElement>("#menu-toggle")!;
  menuToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });
  nav.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      nav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    })
  );

  const langToggle = el.querySelector<HTMLButtonElement>("#lang-toggle")!;
  const langMenu = el.querySelector<HTMLUListElement>("#lang-menu")!;
  langToggle.addEventListener("click", () => {
    const hidden = langMenu.hasAttribute("hidden");
    if (hidden) langMenu.removeAttribute("hidden");
    else langMenu.setAttribute("hidden", "");
    langToggle.setAttribute("aria-expanded", String(hidden));
  });
  langMenu.querySelectorAll<HTMLLIElement>("li").forEach((li) => {
    li.addEventListener("click", () => {
      setLocale(li.dataset.lang as Locale);
    });
  });
  document.addEventListener(
    "click",
    (e) => {
      if (!el.contains(e.target as Node)) return;
      if (!(e.target as HTMLElement).closest(".lang-switch")) {
        langMenu.setAttribute("hidden", "");
      }
    },
    { capture: true }
  );

  el.querySelector<HTMLButtonElement>("#search-toggle")!.addEventListener("click", () => openSearch());
}
