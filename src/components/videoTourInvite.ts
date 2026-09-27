import { t, link } from "../i18n";

/** Links and call-to-action bands that lead to the private video tour page. */

export const VIDEO_TOUR_ICON =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="m15.5 10.5 6-3.5v10l-6-3.5"/></svg>';

/** The booking section of /video-tour, with the given projects preselected. */
export function videoTourHref(slugs: string[] = []): string {
  return `${link("/video-tour")}${slugs.length ? `?project=${slugs.join(",")}` : ""}#book`;
}

/** A band inviting the visitor to book a tour: on a project page (`name` set) or on the home page. */
export function renderVideoTourInvite(options: { slugs?: string[]; name?: string }): string {
  const onProject = Boolean(options.name);
  const title = onProject ? t("videoTour.invite.title") : t("videoTour.home.title");
  const text = onProject ? t("videoTour.invite.text", { name: options.name! }) : t("videoTour.home.text");
  const button = onProject ? t("videoTour.invite.button") : t("videoTour.home.button");
  return `
    <div class="tour-invite${onProject ? " tour-invite--project" : ""}">
      <span class="tour-invite__icon">${VIDEO_TOUR_ICON}<span class="tour-invite__pulse" aria-hidden="true"></span></span>
      <div class="tour-invite__text">
        <p class="tour-invite__eyebrow">${t("videoTour.invite.eyebrow")}</p>
        <h2 class="tour-invite__title">${title}</h2>
        <p>${text}</p>
      </div>
      <div class="tour-invite__actions">
        <a class="btn btn--primary" href="${videoTourHref(options.slugs)}">${button}</a>
        ${onProject ? "" : `<a class="tour-invite__more" href="${link("/video-tour")}">${t("videoTour.home.more")}</a>`}
      </div>
    </div>`;
}
