import { t, getProjectContent, link, placeLine } from "../i18n";
import { getProjectBySlug, getSortedProjects, type Project, type Residence } from "../data/projects";
import { renderProjectCard, projectStatusLabel } from "../components/projectCard";
import { amenityIcon } from "../components/amenityIcons";
import { openLightbox } from "../components/lightbox";
import { renderNotFound } from "./notFound";

const PIN_ICON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"></path><circle cx="12" cy="9.5" r="2.5"></circle></svg>';

function residenceTitle(r: Residence): string {
  const layout = `<span dir="ltr">${r.layout}</span>`;
  return t(r.kind === "villa" ? "projectDetail.residenceVilla" : "projectDetail.residenceApartment", { layout });
}

function renderResidences(project: Project): string {
  if (!project.residences?.length) return "";
  return `
    <section class="detail-block">
      <h2>${t("projectDetail.residencesTitle")}</h2>
      <div class="residence-grid">
        ${project.residences
          .map((r) => {
            const meta: [string, string][] = [];
            if (r.net) meta.push([t("projectDetail.netAreaLabel"), r.net]);
            if (r.garden) meta.push([t("projectDetail.gardenLabel"), r.garden]);
            if (r.floors) meta.push([t("projectDetail.floorsLabel"), String(r.floors)]);
            if (r.planTypes) meta.push([t("projectDetail.planTypesLabel"), String(r.planTypes)]);
            return `
          <article class="residence-card">
            ${r.variant ? `<p class="residence-card__eyebrow">${t("projectDetail.residenceVariant", { variant: r.variant })}</p>` : ""}
            <h3 class="residence-card__title">${residenceTitle(r)}</h3>
            <p class="residence-card__area">
              <strong dir="ltr">${r.gross}</strong>
              <span>${t("projectDetail.grossAreaLabel")}</span>
            </p>
            ${
              meta.length
                ? `<dl class="residence-card__meta">
              ${meta.map(([k, v]) => `<div><dt>${k}</dt><dd dir="ltr">${v}</dd></div>`).join("")}
            </dl>`
                : ""
            }
          </article>`;
          })
          .join("")}
      </div>
    </section>`;
}

function renderAmenities(project: Project): string {
  if (!project.amenities?.length) return "";
  return `
    <section class="detail-block">
      <h2>${t("projectDetail.amenitiesTitle")}</h2>
      <ul class="amenity-grid">
        ${project.amenities
          .map(
            (a) => `
          <li class="amenity-grid__item">
            <span class="amenity-grid__icon">${amenityIcon(a)}</span>
            <span>${t(`projectDetail.amenities.${a}`)}</span>
          </li>`
          )
          .join("")}
      </ul>
    </section>`;
}

function renderLocation(project: Project, nearby: ReturnType<typeof getProjectContent>["nearby"]): string {
  if (!nearby?.length && !project.address) return "";
  return `
    <section class="detail-block">
      <h2>${t("projectDetail.locationTitle")}</h2>
      ${project.address ? `<p class="detail-address">${PIN_ICON}<span dir="ltr">${project.address}</span></p>` : ""}
      ${
        nearby?.length
          ? `<ul class="nearby-list">
        ${nearby
          .map(
            (n) => `
          <li>
            <span class="nearby-list__place">${n.place}</span>
            ${n.time ? `<span class="nearby-list__time">${n.time}</span>` : ""}
          </li>`
          )
          .join("")}
      </ul>`
          : ""
      }
    </section>`;
}

export function renderProjectDetail(el: HTMLElement, slug: string): void {
  const project = getProjectBySlug(slug);
  if (!project) {
    renderNotFound(el);
    return;
  }

  const content = getProjectContent(project.slug);
  const gallery = [project.coverImage, ...project.gallery];
  const others = getSortedProjects().filter((p) => p.slug !== project.slug).slice(0, 3);
  const place = placeLine(project.district, project.city);

  el.innerHTML = `
    <section class="project-hero" style="background-image: linear-gradient(180deg, rgba(15,20,18,.35), rgba(15,20,18,.88)), url('${project.coverImage.src}')">
      <div class="container project-hero__inner">
        <a class="back-link" href="${link("/projects")}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          ${t("projectDetail.backLabel")}
        </a>
        <div class="project-hero__badges">
          <span class="badge badge--${project.status}">${projectStatusLabel(project.status)}</span>
          ${project.unitsAvailable ? `<span class="badge badge--available">${t("common.unitsAvailable")}</span>` : ""}
        </div>
        <h1>${content.name}</h1>
        <p class="project-hero__tagline">${content.tagline}</p>
        <p class="project-hero__location">${place}${project.timeline ? ` · <span dir="ltr">${project.timeline}</span>` : ""}</p>
      </div>
    </section>

    <section class="project-stats" aria-label="${t("projectDetail.keyFactsTitle")}">
      <div class="container">
        <dl class="project-stats__grid">
          ${project.stats
            .map(
              (s) => `
            <div class="project-stats__item">
              <dt>${t(`common.statLabels.${s.labelKey}`)}</dt>
              <dd dir="ltr">${s.value}</dd>
            </div>`
            )
            .join("")}
        </dl>
      </div>
    </section>

    <section class="section project-detail">
      <div class="container project-detail__grid">
        <div class="project-detail__main">
          <section class="detail-block">
            <h2>${t("projectDetail.overviewTitle")}</h2>
            <p class="project-detail__description">${content.longDescription}</p>
          </section>

          <section class="detail-block">
            <h2>${t("projectDetail.highlightsTitle")}</h2>
            <ul class="highlight-list">
              ${content.highlights.map((h) => `<li>${h}</li>`).join("")}
            </ul>
          </section>

          ${renderResidences(project)}
          ${renderAmenities(project)}
          ${renderLocation(project, content.nearby)}

          <section class="detail-block">
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
          </section>
        </div>

        <aside class="project-detail__sidebar">
          <div class="fact-card">
            <h3>${t("projectDetail.keyFactsTitle")}</h3>
            <dl class="fact-list">
              <div>
                <dt>${t("projectDetail.locationLabel")}</dt>
                <dd>${place}</dd>
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
              ${
                project.unitsAvailable
                  ? `<div>
                <dt>${t("projectDetail.availabilityLabel")}</dt>
                <dd>${t("projectDetail.unitsAvailableLong")}</dd>
              </div>`
                  : ""
              }
              ${
                project.developer
                  ? `<div>
                <dt>${t("projectDetail.developerLabel")}</dt>
                <dd dir="ltr">${project.developer}</dd>
              </div>`
                  : ""
              }
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
