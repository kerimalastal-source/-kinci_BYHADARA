import { t, getProjectContent, link } from "../i18n";
import { getProjectBySlug, getSortedProjects } from "../data/projects";
import { renderProjectCard, projectStatusLabel } from "../components/projectCard";
import { openLightbox } from "../components/lightbox";
import { renderNotFound } from "./notFound";

export function renderProjectDetail(el: HTMLElement, slug: string): void {
  const project = getProjectBySlug(slug);
  if (!project) {
    renderNotFound(el);
    return;
  }

  const content = getProjectContent(project.slug);
  const gallery = [project.coverImage, ...project.gallery];
  const others = getSortedProjects().filter((p) => p.slug !== project.slug).slice(0, 3);

  el.innerHTML = `
    <section class="project-hero" style="background-image: linear-gradient(180deg, rgba(15,20,18,.35), rgba(15,20,18,.88)), url('${project.coverImage.src}')">
      <div class="container project-hero__inner">
        <a class="back-link" href="${link("/projects")}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          ${t("projectDetail.backLabel")}
        </a>
        <span class="badge badge--${project.status}">${projectStatusLabel(project.status)}</span>
        <h1>${content.name}</h1>
        <p class="project-hero__tagline">${content.tagline}</p>
        <p class="project-hero__location">${project.district}, ${project.city}${project.timeline ? ` · <span dir="ltr">${project.timeline}</span>` : ""}</p>
      </div>
    </section>

    <section class="section project-detail">
      <div class="container project-detail__grid">
        <div class="project-detail__main">
          <h2>${t("projectDetail.overviewTitle")}</h2>
          <p class="project-detail__description">${content.longDescription}</p>

          <h2>${t("projectDetail.highlightsTitle")}</h2>
          <ul class="highlight-list">
            ${content.highlights.map((h) => `<li>${h}</li>`).join("")}
          </ul>

          <h2>${t("projectDetail.galleryTitle")}</h2>
          <div class="gallery-grid" id="project-gallery">
            ${gallery
              .map(
                (img, i) => `
              <button type="button" class="gallery-grid__item${i === 0 ? " gallery-grid__item--wide" : ""}" data-index="${i}">
                <img src="${img.src}" alt="${img.alt}" width="${img.width}" height="${img.height}" loading="lazy" />
              </button>`
              )
              .join("")}
          </div>
        </div>

        <aside class="project-detail__sidebar">
          <div class="fact-card">
            <h3>${t("projectDetail.keyFactsTitle")}</h3>
            <dl class="fact-list">
              <div>
                <dt>${t("projectDetail.locationLabel")}</dt>
                <dd>${project.district}, ${project.city}</dd>
              </div>
              ${
                project.timeline
                  ? `<div>
                <dt>${t("projectDetail.timelineLabel")}</dt>
                <dd dir="ltr">${project.timeline}</dd>
              </div>`
                  : ""
              }
              <div>
                <dt>${t("projectDetail.statusLabel")}</dt>
                <dd>${projectStatusLabel(project.status)}</dd>
              </div>
              ${project.stats
                .map(
                  (s) => `
                <div>
                  <dt>${t(`common.statLabels.${s.labelKey}`)}</dt>
                  <dd dir="ltr">${s.value}</dd>
                </div>`
                )
                .join("")}
            </dl>
          </div>

          <div class="cta-card">
            <h3>${t("projectDetail.ctaTitle")}</h3>
            <p>${t("projectDetail.ctaText")}</p>
            <a class="btn btn--primary btn--block" href="${link("/contact")}">${t("projectDetail.ctaButton")}</a>
          </div>
        </aside>
      </div>
    </section>

    ${
      others.length
        ? `
    <section class="section other-projects">
      <div class="container">
        <h2 class="section-title">${t("projectDetail.otherProjectsTitle")}</h2>
        <div class="project-grid">
          ${others.map((p) => renderProjectCard(p)).join("")}
        </div>
      </div>
    </section>`
        : ""
    }
  `;

  const galleryEl = el.querySelector<HTMLElement>("#project-gallery")!;
  galleryEl.querySelectorAll<HTMLButtonElement>(".gallery-grid__item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      openLightbox(gallery.map((g) => ({ src: g.src, alt: g.alt })), index);
    });
  });
}
