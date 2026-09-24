import { renderHome } from "./pages/home";
import { renderProjects } from "./pages/projects";
import { renderProjectDetail } from "./pages/projectDetail";
import { renderAbout } from "./pages/about";
import { renderCitizenship } from "./pages/citizenship";
import { renderFaq } from "./pages/faq";
import { renderBlog } from "./pages/blog";
import { renderBlogDetail } from "./pages/blogDetail";
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
import { onLocaleChange } from "./i18n";
import { onAuthChange } from "./auth/session";
import { closeSearch } from "./components/search";

export type Route =
  | { name: "home" }
  | { name: "projects" }
  | { name: "project"; slug: string }
  | { name: "about" }
  | { name: "citizenship" }
  | { name: "faq" }
  | { name: "blog" }
  | { name: "blog-post"; slug: string }
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

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const parts = hash.split("/").filter(Boolean);
  const [segment, p1, p2, p3] = parts;

  if (!segment) return { name: "home" };
  if (segment === "projects" && p1) return { name: "project", slug: p1 };
  if (segment === "projects") return { name: "projects" };
  if (segment === "about") return { name: "about" };
  if (segment === "citizenship") return { name: "citizenship" };
  if (segment === "faq") return { name: "faq" };
  if (segment === "blog" && p1) return { name: "blog-post", slug: p1 };
  if (segment === "blog") return { name: "blog" };
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

export function navigate(path: string): void {
  window.location.hash = path;
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
    const route = parseHash();
    renderHeader(header, route);
    renderRoute(route, main);
    renderFooter(footer);
    renderFloatingButtons(floatingActions);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }

  window.addEventListener("hashchange", renderAll);
  onLocaleChange(renderAll);
  onAuthChange(renderAll);
  renderAll();
}
