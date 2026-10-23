import { t, link, getProjectContent, placeLine } from "../i18n";
import { getSortedProjects, hasVillas, type Project, type ProjectStatus, type Residence } from "../data/projects";
import { renderProjectCard, projectStatusLabel } from "../components/projectCard";
import { renderProjectsAtlas, initProjectsAtlas } from "../components/projectsAtlas";
import { openLightbox } from "../components/lightbox";
import { photoAttrs, photoSrcset } from "../utils/responsiveImage";
import { priceHtml } from "../utils/price";

type FilterKey = "all" | "available" | "villas" | ProjectStatus;

/** Stats shown as the options of a single private villa, which has no residence types. */
const SINGLE_VILLA_STATS = ["landArea", "grossArea", "bedrooms", "bathrooms", "floors"];

function villaCountLine(project: Project): string {
  const count = project.stats.find((s) => s.labelKey === "villas")?.value;
  if (!count) return t("projects.villaPrivate");
  const mixed = project.stats.some((s) => s.labelKey === "apartments") || project.residences?.some((r) => r.kind === "apartment");
  return t(mixed ? "projects.villaCountMixed" : "projects.villaCount", { count: `<bdi dir="ltr">${count}</bdi>` });
}

function villaOption(title: string, rows: [string, string][]): string {
  return `
            <div class="villa-option">
              <h4 class="villa-option__title">${title}</h4>
              <dl class="villa-option__facts">
                ${rows.map(([k, v]) => `<div><dt>${k}</dt><dd dir="ltr">${v}</dd></div>`).join("")}
              </dl>
            </div>`;
}

function villaOptions(project: Project): string {
  const villas = (project.residences ?? []).filter((r): r is Residence => r.kind === "villa");
  if (villas.length) {
    return villas
      .map((r) => {
        const title = [
          t("projectDetail.residenceVilla", { layout: `<span dir="ltr">${r.layout}</span>` }),
          r.variant ? t("projectDetail.residenceVariant", { variant: r.variant }) : ""
        ]
          .filter(Boolean)
          .join(" · ");
        const rows: [string, string][] = r.gross ? [[t("projectDetail.grossAreaLabel"), r.gross]] : [];
        if (r.net) rows.push([t("projectDetail.netAreaLabel"), r.net]);
        if (r.garden) rows.push([t("projectDetail.gardenLabel"), r.garden]);
        if (r.floors) rows.push([t("projectDetail.floorsLabel"), String(r.floors)]);
        return villaOption(title, rows);
      })
      .join("");
  }
  const rows = SINGLE_VILLA_STATS.flatMap((key) => {
    const stat = project.stats.find((s) => s.labelKey === key);
    return stat ? [[t(`common.statLabels.${key}`), stat.value] as [string, string]] : [];
  });
  return villaOption(t("projects.villaSpecs"), rows);
}

function renderVillaShowcase(project: Project, index: number): string {
  const content = getProjectContent(project.slug);
  const photos = project.villaPhotos?.length ? project.villaPhotos : [project.coverImage];
  const [main, ...thumbs] = photos;
  const price =
    project.price && project.price !== "on-request"
      ? `<strong>${priceHtml(project.price, project.priceFrom)}</strong>`
      : `<strong>${t("projectDetail.priceOnRequest")}</strong>`;
  const single = !project.stats.some((s) => s.labelKey === "villas");

  return `
      <article class="villa-item" data-villa="${index}">
        <div class="villa-item__gallery${thumbs.length ? "" : " villa-item__gallery--single"}">
          <button type="button" class="villa-item__photo villa-item__photo--main" data-photo="0" aria-label="${main.alt}"${
            // Panoramic renders keep their own shape instead of being cropped and enlarged.
            main.width / main.height > 2 ? ` style="aspect-ratio: ${main.width} / ${main.height}"` : ""
          }>
            <img ${photoAttrs(main, "(max-width: 900px) calc(100vw - 32px), 640px")} alt="${main.alt}" width="${main.width}" height="${main.height}" loading="lazy" />
          </button>
          ${thumbs
            .slice(0, 4)
            .map(
              (photo, i) => `
          <button type="button" class="villa-item__photo${photo.src.includes("-plan") ? " villa-item__photo--plan" : ""}" data-photo="${i + 1}" aria-label="${photo.alt}">
            <img ${photoAttrs(photo, "(max-width: 900px) 25vw, 160px")} alt="${photo.alt}" width="${photo.width}" height="${photo.height}" loading="lazy" />
          </button>`
            )
            .join("")}
          <button type="button" class="villa-item__all" data-photo="0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            ${t("projects.villaPhotos", { count: String(photos.length) })}
          </button>
        </div>
        <div class="villa-item__body">
          <p class="project-card__location">${placeLine(project.district, project.city)}</p>
          <h3 class="villa-item__title"><a href="${link(`/projects/${project.slug}`)}">${content.name}</a></h3>
          <div class="villa-item__badges">
            <span class="badge badge--${project.status}">${projectStatusLabel(project.status)}</span>
            ${project.unitsAvailable ? `<span class="badge badge--available">${t("common.unitsAvailable")}</span>` : ""}
          </div>
          <p class="villa-item__count">${villaCountLine(project)}</p>
          <div class="villa-item__options">${villaOptions(project)}</div>
          <p class="villa-item__price"><span>${t("projectDetail.priceLabel")}</span> ${price}</p>
          <div class="villa-item__actions">
            <a class="btn btn--primary" href="${link(`/contact?project=${project.slug}`)}">${t(single ? "projects.villaAskOne" : "projects.villaAsk")}</a>
            <a class="btn btn--outline" href="${link(`/projects/${project.slug}`)}">${t("projects.villaView")}</a>
          </div>
        </div>
      </article>`;
}

export function renderProjects(el: HTMLElement): void {
  const allProjects = getSortedProjects();

  const allFilters: { key: FilterKey; labelKey: string }[] = [
    { key: "all", labelKey: "projects.filterAll" },
    { key: "new-launch", labelKey: "projects.filterNewLaunch" },
    { key: "ongoing", labelKey: "projects.filterOngoing" },
    { key: "delivered", labelKey: "projects.filterDelivered" },
    { key: "available", labelKey: "projects.filterAvailable" },
    { key: "villas", labelKey: "projects.filterVillas" }
  ];
  const matches = (p: Project, key: FilterKey) => {
    if (key === "all") return true;
    if (key === "available") return Boolean(p.unitsAvailable);
    // Sold-out projects have no villas left to show.
    if (key === "villas") return hasVillas(p) && !p.soldOut;
    return p.status === key;
  };
  // Hide filters that no project currently matches.
  const filters = allFilters.filter((f) => allProjects.some((p) => matches(p, f.key)));

  el.innerHTML = `
    <section class="page-hero page-hero--atlas">
      <div class="container page-hero__split">
        <div class="page-hero__text">
          <p class="eyebrow eyebrow--on-dark">${t("projects.heroEyebrow")}</p>
          <h1>${t("projects.heroTitle")}</h1>
          <p class="page-hero__subtitle">${t("projects.heroSubtitle")}</p>
        </div>
      </div>
      ${renderProjectsAtlas(allProjects)}
    </section>

    <section class="section project-list" id="project-list">
      <div class="container">
        <div class="filter-bar" id="filter-bar">
          ${filters
            .map(
              (f) => `<button type="button" class="filter-chip${f.key === "all" ? " is-active" : ""}${f.key === "villas" ? " filter-chip--villas" : ""}" data-filter="${f.key}">${t(f.labelKey)}</button>`
            )
            .join("")}
        </div>
        <div class="project-grid" id="project-grid">
          ${allProjects.map((p) => renderProjectCard(p)).join("")}
        </div>
        <div class="villa-showcase" id="villa-showcase" hidden></div>
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

  initProjectsAtlas(el, allProjects);
  const filterBar = el.querySelector<HTMLElement>("#filter-bar")!;
  const grid = el.querySelector<HTMLElement>("#project-grid")!;
  const showcase = el.querySelector<HTMLElement>("#villa-showcase")!;
  const empty = el.querySelector<HTMLElement>("#project-empty")!;
  let villaProjects: Project[] = [];

  showcase.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-photo]");
    const item = btn?.closest<HTMLElement>("[data-villa]");
    if (!btn || !item) return;
    const project = villaProjects[Number(item.dataset.villa)];
    const photos = project.villaPhotos?.length ? project.villaPhotos : [project.coverImage];
    openLightbox(photos.map((g) => ({ src: g.src, alt: g.alt, srcset: photoSrcset(g) })), Number(btn.dataset.photo));
  });

  filterBar.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".filter-chip");
    if (!btn) return;
    const key = btn.dataset.filter as FilterKey;

    filterBar.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("is-active"));
    btn.classList.add("is-active");

    let filtered = allProjects.filter((p) => matches(p, key));
    // Ad landing projects (the HADARA villa) lead the villa view.
    if (key === "villas") filtered = [...filtered.filter((p) => p.landing), ...filtered.filter((p) => !p.landing)];
    const villas = key === "villas";
    grid.hidden = villas;
    showcase.hidden = !villas;
    if (villas) {
      villaProjects = filtered;
      showcase.innerHTML = `
        <p class="villa-showcase__intro">${t("projects.villasIntro")}</p>
        ${filtered.map((p, i) => renderVillaShowcase(p, i)).join("")}`;
      grid.innerHTML = "";
    } else {
      showcase.innerHTML = "";
      grid.innerHTML = filtered.map((p) => renderProjectCard(p)).join("");
    }
    empty.hidden = filtered.length > 0;
  });

  // A shared link can open a filter directly, e.g. /projects?filter=villas.
  const requested = new URLSearchParams(window.location.search).get("filter");
  filterBar.querySelector<HTMLButtonElement>(`.filter-chip[data-filter="${CSS.escape(requested ?? "")}"]`)?.click();
}
