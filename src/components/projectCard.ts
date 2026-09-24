import type { Project } from "../data/projects";
import { t, getProjectContent, link } from "../i18n";

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

export function renderProjectCard(project: Project): string {
  const content = getProjectContent(project.slug);
  const primaryStat = project.stats[0];

  return `
    <article class="project-card">
      <a class="project-card__media" href="${link(`/projects/${project.slug}`)}" aria-label="${content.name}">
        <img
          src="${project.coverImage.src}"
          alt="${project.coverImage.alt}"
          width="${project.coverImage.width}"
          height="${project.coverImage.height}"
          loading="lazy"
        />
        <span class="project-card__status badge badge--${project.status}">${projectStatusLabel(project.status)}</span>
      </a>
      <div class="project-card__body">
        <p class="project-card__location">${project.district}, ${project.city}</p>
        <h3 class="project-card__title">${content.name}</h3>
        <p class="project-card__tagline">${content.tagline}</p>
        <div class="project-card__meta">
          <div class="project-card__stat">
            <strong dir="ltr">${primaryStat.value}</strong>
            <span>${t(`common.statLabels.${primaryStat.labelKey}`)}</span>
          </div>
          <div class="project-card__stat">
            <strong dir="ltr">${project.timeline}</strong>
            <span>${t("common.timeline")}</span>
          </div>
        </div>
        <a class="btn btn--outline btn--small" href="${link(`/projects/${project.slug}`)}">
          ${t("common.discoverMore")}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </a>
      </div>
    </article>
  `;
}
