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
import { renderHeader } from "./components/header";
import { renderFooter } from "./components/footer";
import { renderFloatingButtons } from "./components/floatingButtons";
import { onLocaleChange } from "./i18n";
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
  | { name: "not-found" };

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [segment, param] = hash.split("/").filter(Boolean);

  if (!segment) return { name: "home" };
  if (segment === "projects" && param) return { name: "project", slug: param };
  if (segment === "projects") return { name: "projects" };
  if (segment === "about") return { name: "about" };
  if (segment === "citizenship") return { name: "citizenship" };
  if (segment === "faq") return { name: "faq" };
  if (segment === "blog" && param) return { name: "blog-post", slug: param };
  if (segment === "blog") return { name: "blog" };
  if (segment === "contact") return { name: "contact" };
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
  renderAll();
}
