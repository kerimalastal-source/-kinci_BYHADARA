import { t, getProjectContent } from "../i18n";
import { getSortedProjects } from "../data/projects";
import { navigate } from "../router";

interface SearchResult {
  title: string;
  snippet: string;
  route: string;
}

let overlay: HTMLDivElement | null = null;

function buildIndex(): SearchResult[] {
  const results: SearchResult[] = [];

  for (const project of getSortedProjects()) {
    const content = getProjectContent(project.slug);
    results.push({
      title: content.name,
      snippet: content.tagline,
      route: `#/projects/${project.slug}`
    });
  }

  results.push({ title: t("nav.home"), snippet: t("home.heroSubtitle"), route: "#/" });
  results.push({ title: t("nav.projects"), snippet: t("projects.heroSubtitle"), route: "#/projects" });
  results.push({ title: t("nav.about"), snippet: t("about.heroSubtitle"), route: "#/about" });
  results.push({ title: t("nav.citizenship"), snippet: t("citizenship.heroSubtitle"), route: "#/citizenship" });
  results.push({ title: t("nav.faq"), snippet: t("faq.heroSubtitle"), route: "#/faq" });
  results.push({ title: t("nav.contact"), snippet: t("contact.heroSubtitle"), route: "#/contact" });

  return results;
}

function runSearch(query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return buildIndex().filter(
    (r) => r.title.toLowerCase().includes(q) || r.snippet.toLowerCase().includes(q)
  );
}

export function openSearch(): void {
  if (overlay) return;

  overlay = document.createElement("div");
  overlay.className = "search-overlay";
  overlay.innerHTML = `
    <div class="search-overlay__panel" role="dialog" aria-modal="true" aria-label="${t("nav.search")}">
      <div class="search-overlay__bar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" id="search-input" placeholder="${t("common.searchPlaceholder")}" autocomplete="off" />
        <button type="button" id="search-close" class="icon-btn" aria-label="${t("common.close")}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="search-overlay__results" id="search-results"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  const input = overlay.querySelector<HTMLInputElement>("#search-input")!;
  const resultsEl = overlay.querySelector<HTMLElement>("#search-results")!;

  function renderResults(query: string): void {
    if (!query.trim()) {
      resultsEl.innerHTML = "";
      return;
    }
    const results = runSearch(query);
    if (results.length === 0) {
      resultsEl.innerHTML = `<p class="search-overlay__empty">${t("common.searchNoResults")}</p>`;
      return;
    }
    resultsEl.innerHTML = results
      .map(
        (r) => `
        <button type="button" class="search-result" data-route="${r.route}">
          <span class="search-result__title">${r.title}</span>
          <span class="search-result__snippet">${r.snippet}</span>
        </button>`
      )
      .join("");
    resultsEl.querySelectorAll<HTMLButtonElement>(".search-result").forEach((btn) => {
      btn.addEventListener("click", () => {
        navigate(btn.dataset.route!.replace(/^#/, ""));
        closeSearch();
      });
    });
  }

  input.addEventListener("input", () => renderResults(input.value));
  input.focus();

  overlay.querySelector<HTMLButtonElement>("#search-close")!.addEventListener("click", closeSearch);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeSearch();
  });
  document.addEventListener("keydown", onKeydown);
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape") closeSearch();
}

export function closeSearch(): void {
  if (!overlay) return;
  overlay.remove();
  overlay = null;
  document.body.style.overflow = "";
  document.removeEventListener("keydown", onKeydown);
}
