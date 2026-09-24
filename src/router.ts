import { renderHome } from "./pages/home";
import { renderProjects } from "./pages/projects";
import { renderProjectDetail } from "./pages/projectDetail";
import { renderAbout } from "./pages/about";
import { renderCitizenship } from "./pages/citizenship";
import { renderFaq } from "./pages/faq";
import { renderBlog } from "./pages/blog";
import { renderBlogDetail } from "./pages/blogDetail";
import { renderPropertyRequest } from "./pages/propertyRequest";
import { renderContact } from "./pages/contact";
import { renderNotFound } from "./pages/notFound";
import { renderLogin } from "./pages/login";
import { renderRegister } from "./pages/register";
import { renderAccountDashboard } from "./pages/account/dashboard";
import { renderSubmitListing } from "./pages/account/submitListing";
import { renderResaleList } from "./pages/resale/list";
import { renderResaleDetail } from "./pages/resale/detail";
import { renderAdminDashboard } from "./pages/admin/dashboard";
import { renderAdminReviewListing } from "./pages/admin/reviewListing";
import { renderHeader } from "./components/header";
import { renderFooter } from "./components/footer";
import { renderFloatingButtons } from "./components/floatingButtons";
import { onLocaleChange, syncLocale, getPreferredLocale, link, type Locale } from "./i18n";
import { parseRoute, splitLocale, localizePath, type Route } from "./seo/routes";
import { applyMeta } from "./seo/head";
import { onAuthChange } from "./auth/session";
import { closeSearch } from "./components/search";

export type { Route };

let rerender: () => void = () => {};
let renderedPath = "";

/** Navigates to an internal, unprefixed path ("/projects") in the current locale. */
export function navigate(path: string, options: { replace?: boolean } = {}): void {
  const url = link(path);
  if (url !== window.location.pathname) {
    history[options.replace ? "replaceState" : "pushState"](null, "", url);
  }
  // Deferred so a redirect issued mid-render (e.g. an auth guard) doesn't nest inside that render.
  queueMicrotask(rerender);
}

function currentRoute(): { locale: Locale; route: Route } {
  const { locale, path } = splitLocale(window.location.pathname);
  return { locale, route: parseRoute(path) };
}

/** Moves legacy "#/projects" links to "/projects", and sends returning visitors to their language. */
function normalizeInitialUrl(): void {
  const { hash, pathname, search } = window.location;
  const { prefixed, path } = splitLocale(pathname);
  if (hash.startsWith("#/")) {
    history.replaceState(null, "", localizePath(hash.slice(1), getPreferredLocale()) + search);
    return;
  }
  if (!prefixed) {
    const preferred = getPreferredLocale();
    if (preferred !== "en") history.replaceState(null, "", localizePath(path, preferred) + search + hash);
  }
}

/** Handles clicks on internal links without a full page load. */
function interceptLinks(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as Element | null)?.closest?.("a");
  if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
  const href = anchor.getAttribute("href");
  if (!href || !href.startsWith("/") || href.startsWith("//")) return;
  event.preventDefault();
  if (href !== window.location.pathname + window.location.search) history.pushState(null, "", href);
  rerender();
}

function renderRoute(route: Route, main: HTMLElement): void {
  switch (route.name) {
    case "home":
      renderHome(main);
      break;
    case "projects":
      renderProjects(main);
      break;
    case "project":
      renderProjectDetail(main, route.slug);
      break;
    case "about":
      renderAbout(main);
      break;
    case "citizenship":
      renderCitizenship(main);
      break;
    case "faq":
      renderFaq(main);
      break;
    case "blog":
      renderBlog(main);
      break;
    case "blog-post":
      renderBlogDetail(main, route.slug);
      break;
    case "property-request":
      renderPropertyRequest(main);
      break;
    case "contact":
      renderContact(main);
      break;
    case "login":
      renderLogin(main);
      break;
    case "register":
      renderRegister(main);
      break;
    case "account":
      renderAccountDashboard(main);
      break;
    case "account-new-listing":
      renderSubmitListing(main);
      break;
    case "account-edit-listing":
      renderSubmitListing(main, route.id);
      break;
    case "resale":
      renderResaleList(main);
      break;
    case "resale-listing":
      renderResaleDetail(main, route.id);
      break;
    case "admin":
      renderAdminDashboard(main);
      break;
    case "admin-listing":
      renderAdminReviewListing(main, route.id);
      break;
    default:
      renderNotFound(main);
  }
}

export function startRouter(root: HTMLElement): void {
  root.innerHTML = `
    <div class="site-shell">
      <a class="skip-link" href="#main-content">Skip to content</a>
      <header id="site-header"></header>
      <main id="main-content"></main>
      <footer id="site-footer"></footer>
      <div id="floating-actions"></div>
    </div>
  `;

  const header = root.querySelector<HTMLElement>("#site-header")!;
  const main = root.querySelector<HTMLElement>("#main-content")!;
  const footer = root.querySelector<HTMLElement>("#site-footer")!;
  const floatingActions = root.querySelector<HTMLElement>("#floating-actions")!;

  function renderAll(): void {
    closeSearch();
    const { locale, route } = currentRoute();
    syncLocale(locale);
    renderHeader(header, route);
    renderRoute(route, main);
    renderFooter(footer);
    renderFloatingButtons(floatingActions);
    applyMeta(route, locale);
    const path = window.location.pathname + window.location.search;
    if (path !== renderedPath) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    renderedPath = path;
  }

  rerender = renderAll;
  normalizeInitialUrl();
  document.addEventListener("click", interceptLinks);
  window.addEventListener("popstate", () => {
    // In-page anchors (e.g. the skip link) also fire popstate; only re-render real page changes.
    if (window.location.pathname + window.location.search !== renderedPath) renderAll();
  });
  onLocaleChange(renderAll);
  onAuthChange(renderAll);
  renderAll();
}
