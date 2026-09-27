import type { Project } from "../data/projects";
import { t, getProjectContent, link, placeLine } from "../i18n";
import { favoriteButton } from "./favorites";
import { statIcon } from "./statIcons";
import { photoAttrs } from "../utils/responsiveImage";

export function projectStatusLabel(status: Project["status"]): string {
  switch (status) {
    case "new-launch":
      return t("common.statusNewLaunch");
    case "delivered":
      return t("common.statusDelivered");
    default:
      return t("common.statusOngoing");
  }
}

function cardStat(value: string, label: string, icon: string): string {
  return `
          <div class="project-card__stat">
            <span class="project-card__stat-icon">${statIcon(icon)}</span>
            <span class="project-card__stat-text">
              <strong dir="ltr">${value}</strong>
              <span>${label}</span>
            </span>
          </div>`;
}

export function renderProjectCard(project: Project): string {
  const content = getProjectContent(project.slug);
  const primaryStat = project.stats[0];
  // Projects without published dates show their next key figure in place of the timeline.
  const secondary = project.timeline
    ? { value: project.timeline, label: t("common.timeline"), icon: "timeline" }
    : project.stats[1]
      ? { value: project.stats[1].value, label: t(`common.statLabels.${project.stats[1].labelKey}`), icon: project.stats[1].labelKey }
      : undefined;

  return `
    <article class="project-card">
      <a class="project-card__media" href="${link(`/projects/${project.slug}`)}" aria-label="${content.name}">
        <img
          ${photoAttrs(project.coverImage, "(max-width: 640px) calc(100vw - 32px), (max-width: 1100px) 50vw, 400px")}
          alt="${project.coverImage.alt}"
          width="${project.coverImage.width}"
          height="${project.coverImage.height}"
          loading="lazy"
        />
        <span class="project-card__status">
          <span class="badge badge--${project.status}">${projectStatusLabel(project.status)}</span>
          ${project.unitsAvailable ? `<span class="badge badge--available">${t("common.unitsAvailable")}</span>` : ""}
          ${project.soldOut ? `<span class="badge badge--sold-out">${t("common.soldOut")}</span>` : ""}
        </span>
      </a>
      ${favoriteButton(project.slug, "card")}
      <div class="project-card__body">
        <p class="project-card__location">${placeLine(project.district, project.city)}</p>
        <h3 class="project-card__title">${content.name}</h3>
        <p class="project-card__tagline">${content.tagline}</p>
        <div class="project-card__meta">
          ${cardStat(primaryStat.value, t(`common.statLabels.${primaryStat.labelKey}`), primaryStat.labelKey)}
          ${secondary ? cardStat(secondary.value, secondary.label, secondary.icon) : ""}
        </div>
        <a class="btn btn--outline btn--small" href="${link(`/projects/${project.slug}`)}">
          ${t("common.discoverMore")}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </a>
      </div>
    </article>
  `;
}
