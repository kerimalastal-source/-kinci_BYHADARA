import { renderHome } from "./pages/home";
import { renderProjects } from "./pages/projects";
import { renderProjectDetail } from "./pages/projectDetail";
import { renderAbout } from "./pages/about";
import { renderCitizenship } from "./pages/citizenship";
import { renderConsultancy } from "./pages/consultancy";
import { renderFaq } from "./pages/faq";
import { renderPrivacy } from "./pages/privacy";
import { renderLaws } from "./pages/laws";
import { LAWS_PAGE_LIVE } from "./data/laws";
import { renderBlog } from "./pages/blog";
import { renderBlogDetail } from "./pages/blogDetail";
import { renderPropertyRequest } from "./pages/propertyRequest";
import { renderVideoTour } from "./pages/videoTour";
import { renderContact } from "./pages/contact";
import { renderNotFound } from "./pages/notFound";
import { renderResaleList } from "./pages/resale/list";
import { renderResaleDetail } from "./pages/resale/detail";
import { renderHeader } from "./components/header";
import { renderFooter } from "./components/footer";
import { renderFloatingButtons } from "./components/floatingButtons";
import { onLocaleChange, syncLocale, getPreferredLocale, link, locales, type Locale } from "./i18n";
import { hasDictionary } from "./i18n/dictionaries";
import { ensureLocales } from "./i18n/load";
import { parseRoute, splitLocale, localizePath, type Route } from "./seo/routes";
import { applyMeta } from "./seo/head";
import { onAuthChange } from "./auth/session";
import { closeSearch } from "./components/search";
import { trackPageView } from "./utils/tracking";
import { trackVisit } from "./utils/visitorTracker";

export type { Route };

/** Pages with a form whose message also goes to the team in English and Arabic. */
const FORM_ROUTES = new Set<Route["name"]>(["contact", "property-request", "video-tour", "consultancy"]);

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

let renderToken = 0;

/**
 * Login, account and admin pages are downloaded only when opened, so visitors never load their code.
 * The token drops a page that arrives after the visitor has already moved on.
 */
function lazyPage<M>(load: () => Promise<M>, render: (page: M) => void): void {
  const token = renderToken;
  void load().then((page) => {
    if (token === renderToken) render(page);
  });
}

function renderRoute(route: Route, main: HTMLElement): void {
  renderToken++;
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
    case "consultancy":
      renderConsultancy(main, route.page);
      break;
    case "faq":
      renderFaq(main);
      break;
    case "privacy":
      renderPrivacy(main);
      break;
    case "laws":
      // Hidden until the owner approves the page; ?preview shows it for review.
      if (LAWS_PAGE_LIVE || new URLSearchParams(location.search).has("preview")) renderLaws(main);
      else renderNotFound(main);
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
    case "video-tour":
      renderVideoTour(main);
      break;
    case "contact":
      renderContact(main);
      break;
    case "login":
      lazyPage(() => import("./pages/login"), (page) => page.renderLogin(main));
      break;
    case "register":
      lazyPage(() => import("./pages/register"), (page) => page.renderRegister(main));
      break;
    case "account":
      lazyPage(() => import("./pages/account/dashboard"), (page) => page.renderAccountDashboard(main));
      break;
    case "account-new-listing":
      lazyPage(() => import("./pages/account/submitListing"), (page) => page.renderSubmitListing(main));
      break;
    case "account-edit-listing":
      lazyPage(() => import("./pages/account/submitListing"), (page) => page.renderSubmitListing(main, route.id));
      break;
    case "resale":
      renderResaleList(main);
      break;
    case "resale-listing":
      renderResaleDetail(main, route.id);
      break;
    case "admin":
      lazyPage(() => import("./pages/admin/overview"), (page) => page.renderAdminOverview(main));
      break;
    case "admin-listings":
      lazyPage(() => import("./pages/admin/dashboard"), (page) => page.renderAdminDashboard(main));
      break;
    case "admin-listing":
      lazyPage(() => import("./pages/admin/reviewListing"), (page) => page.renderAdminReviewListing(main, route.id));
      break;
    case "admin-bookings":
      lazyPage(() => import("./pages/admin/bookings"), (page) => page.renderAdminBookings(main));
      break;
    case "admin-inquiries":
      lazyPage(() => import("./pages/admin/inquiries"), (page) => page.renderAdminInquiries(main));
      break;
    case "admin-stats":
      lazyPage(() => import("./pages/admin/stats"), (page) => page.renderAdminStats(main));
      break;
    case "admin-customers":
      lazyPage(() => import("./pages/admin/customers"), (page) => page.renderAdminCustomers(main));
      break;
    case "admin-pipeline":
      lazyPage(() => import("./pages/admin/pipeline"), (page) => page.renderAdminPipeline(main));
      break;
    case "admin-ads":
      lazyPage(() => import("./pages/admin/ads"), (page) => page.renderAdminAds(main));
      break;
    case "admin-chats":
      lazyPage(() => import("./pages/admin/chats"), (page) => page.renderAdminChats(main));
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
    // Admin pages show customers' messages in their own languages, so they need every dictionary;
    // the form pages also write the team's copy in English and Arabic.
    const needed = route.name.startsWith("admin")
      ? locales
      : FORM_ROUTES.has(route.name)
        ? [...new Set<Locale>([locale, "en", "ar"])]
        : [locale];
    if (needed.some((l) => !hasDictionary(l))) {
      void ensureLocales(needed).then(renderAll);
      return;
    }
    syncLocale(locale);
    renderHeader(header, route);
    renderRoute(route, main);
    renderFooter(footer);
    renderFloatingButtons(floatingActions);
    applyMeta(route, locale);
    const path = window.location.pathname + window.location.search;
    if (path !== renderedPath) {
      const target = window.location.hash ? document.getElementById(decodeURIComponent(window.location.hash.slice(1))) : null;
      if (target) target.scrollIntoView({ behavior: "instant" as ScrollBehavior });
      else window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      trackPageView(route, locale);
      trackVisit(route, locale);
    }
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
