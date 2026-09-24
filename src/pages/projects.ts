import { t, link } from "../i18n";
import { getSortedProjects, type ProjectStatus } from "../data/projects";
import { renderProjectCard } from "../components/projectCard";

type FilterKey = "all" | ProjectStatus;

export function renderProjects(el: HTMLElement): void {
  const allProjects = getSortedProjects();

  const filters: { key: FilterKey; labelKey: string }[] = [
    { key: "all", labelKey: "projects.filterAll" },
    { key: "new-launch", labelKey: "projects.filterNewLaunch" },
    { key: "ongoing", labelKey: "projects.filterOngoing" },
    { key: "delivered", labelKey: "projects.filterDelivered" }
  ];

  el.innerHTML = `
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow eyebrow--on-dark">${t("projects.heroEyebrow")}</p>
        <h1>${t("projects.heroTitle")}</h1>
        <p class="page-hero__subtitle">${t("projects.heroSubtitle")}</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="filter-bar" id="filter-bar">
          ${filters
            .map(
              (f) => `<button type="button" class="filter-chip${f.key === "all" ? " is-active" : ""}" data-filter="${f.key}">${t(f.labelKey)}</button>`
            )
            .join("")}
        </div>
        <div class="project-grid" id="project-grid">
          ${allProjects.map((p) => renderProjectCard(p)).join("")}
        </div>
        <p class="project-grid__empty" id="project-empty" hidden>${t("projects.noResults")}</p>
      </div>
    </section>

    <section class="section final-cta">
      <div class="container final-cta__inner">
        <div>
          <h2 class="section-title">${t("projects.notFoundCtaTitle")}</h2>
          <p>${t("projects.notFoundCtaText")}</p>
        </div>
        <a class="btn btn--primary" href="${link("/property-request")}">${t("projects.notFoundCtaButton")}</a>
      </div>
    </section>
  `;

  const filterBar = el.querySelector<HTMLElement>("#filter-bar")!;
  const grid = el.querySelector<HTMLElement>("#project-grid")!;
  const empty = el.querySelector<HTMLElement>("#project-empty")!;

  filterBar.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".filter-chip");
    if (!btn) return;
    const key = btn.dataset.filter as FilterKey;

    filterBar.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("is-active"));
    btn.classList.add("is-active");

    const filtered = key === "all" ? allProjects : allProjects.filter((p) => p.status === key);
    grid.innerHTML = filtered.map((p) => renderProjectCard(p)).join("");
    empty.hidden = filtered.length > 0;
  });
}
