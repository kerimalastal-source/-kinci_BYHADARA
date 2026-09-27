import { t, getProjectContent, getLocale, link, placeLine } from "../i18n";
import { getProjectBySlug, getSortedProjects, type Project, type Residence } from "../data/projects";
import { renderProjectCard, projectStatusLabel } from "../components/projectCard";
import { amenityIcon } from "../components/amenityIcons";
import { statIcon } from "../components/statIcons";
import { openLightbox } from "../components/lightbox";
import { initStatCounters } from "../components/statCounter";
import { initScrollReveal } from "../components/scrollReveal";
import { WHATSAPP_ICON, WHATSAPP_NUMBER } from "../components/floatingButtons";
import { favoriteButton } from "../components/favorites";
import { renderProjectMap, initProjectMap } from "../components/projectMap";
import { renderVideoTourInvite, videoTourHref, VIDEO_TOUR_ICON } from "../components/videoTourInvite";
import { renderNotFound } from "./notFound";
import { photoAttrs, photoSrcset, heroBackground } from "../utils/responsiveImage";

/** Scroll-reveal attributes; the stagger restarts every row so long grids don't lag. */
const reveal = (i: number, perRow = 4) => `data-reveal data-reveal-index="${i % perRow}"`;

/** Plain counts and areas ("78", "21,000 m²") count up; years and ranges stay as written. */
const countsUp = (value: string, labelKey: string) => labelKey !== "delivery" && /^\d[\d,.]*( m²)?$/.test(value);

/**
 * On desktop the cover takes a 2×2 block beside two images, then rows of three.
 * A last row with a single image stretches it into a panorama, so no photo sits alone.
 */
function galleryTail(total: number): string {
  return total > 3 && (total - 3) % 3 === 1 ? " gallery-grid__item--panorama" : "";
}

function residenceTitle(r: Residence): string {
  if (r.kind === "office") return t(r.layout === "open" ? "projectDetail.officeOpen" : "projectDetail.officeClosed");
  const layout = `<span dir="ltr">${r.layout}</span>`;
  return t(r.kind === "villa" ? "projectDetail.residenceVilla" : "projectDetail.residenceApartment", { layout });
}

function renderResidences(project: Project): string {
  if (!project.residences?.length) return "";
  return `
    <section class="detail-block">
      <h2>${t("projectDetail.residencesTitle")}</h2>
      <div class="residence-grid${project.residences.length === 1 ? " residence-grid--single" : ""}">
        ${project.residences
          .map((r, i) => {
            const meta: [string, string][] = [];
            if (r.saleable) meta.push([t("projectDetail.saleableAreaLabel"), r.saleable]);
            if (r.net) meta.push([t("projectDetail.netAreaLabel"), r.net]);
            if (r.garden) meta.push([t("projectDetail.gardenLabel"), r.garden]);
            if (r.floors) meta.push([t("projectDetail.floorsLabel"), String(r.floors)]);
            if (r.planTypes) meta.push([t("projectDetail.planTypesLabel"), String(r.planTypes)]);
            return `
          <article class="residence-card" ${reveal(i, 3)}>
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

function renderFloorPlan(project: Project, levels: ReturnType<typeof getProjectContent>["floorPlan"]): string {
  if (!project.floorPlan?.length || !levels?.length) return "";
  return `
    <section class="detail-block">
      <h2>${t("projectDetail.floorPlanTitle")}</h2>
      <div class="floor-grid">
        ${project.floorPlan
          .map((level, i) => {
            const text = levels[i];
            if (!text) return "";
            return `
          <article class="floor-card${level.image ? " floor-card--media" : ""}" ${reveal(i, 2)}>
            ${
              level.image
                ? `<button type="button" class="floor-card__media" data-floor-index="${i}" aria-label="${text.name}">
              <img ${photoAttrs(level.image, "(max-width: 640px) calc(100vw - 32px), 400px")} alt="${level.image.alt}" width="${level.image.width}" height="${level.image.height}" loading="lazy" />
              ${level.seaView ? `<span class="floor-card__tag">${t("projectDetail.amenities.seaView")}</span>` : ""}
            </button>`
                : ""
            }
            <header class="floor-card__head">
              <span class="floor-card__index" dir="ltr">${String(i + 1).padStart(2, "0")}</span>
              <h3>${text.name}</h3>
            </header>
            <dl class="floor-card__areas">
              <div><dt>${t("projectDetail.grossAreaLabel")}</dt><dd dir="ltr">${level.gross}</dd></div>
              <div><dt>${t("projectDetail.netAreaLabel")}</dt><dd dir="ltr">${level.net}</dd></div>
            </dl>
            <ul class="floor-card__features">
              ${text.features.map((f) => `<li>${f}</li>`).join("")}
            </ul>
          </article>`;
          })
          .join("")}
      </div>
    </section>`;
}

const PLAY_ICON =
  '<svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>';

/**
 * Video tour. Only the poster loads with the page; the YouTube player replaces it on
 * the first tap, which keeps the landing page fast on phones.
 */
function renderVideo(project: Project, content: ReturnType<typeof getProjectContent>, actions: string): string {
  const video = project.video;
  if (!video) return "";
  return `
    <section class="section project-video" aria-labelledby="project-video-title">
      <div class="container project-video__grid${video.vertical ? " project-video__grid--vertical" : ""}">
        <div class="project-video__head">
          <p class="eyebrow">${t("projectDetail.videoEyebrow")}</p>
          <h2 id="project-video-title">${content.videoTitle ?? content.name}</h2>
          ${content.videoText ? `<p class="project-video__text">${content.videoText}</p>` : ""}
        </div>
        <div class="project-video__frame">
          <button type="button" class="video-facade" data-youtube-id="${video.youtubeId}" aria-label="${t("projectDetail.videoPlay")}">
            <img ${photoAttrs(video.poster, "(max-width: 640px) calc(100vw - 32px), 420px")} alt="${video.poster.alt}" width="${video.poster.width}" height="${video.poster.height}" loading="lazy" />
            <span class="video-facade__play">${PLAY_ICON}</span>
            <span class="video-facade__label">${t("projectDetail.videoPlay")}</span>
          </button>
        </div>
        <div class="project-video__actions">${actions}</div>
      </div>
    </section>`;
}

function initVideo(el: HTMLElement, title: string): void {
  el.querySelectorAll<HTMLButtonElement>(".video-facade").forEach((btn) => {
    btn.addEventListener("click", () => {
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube-nocookie.com/embed/${btn.dataset.youtubeId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
      iframe.title = title;
      iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      iframe.allowFullscreen = true;
      btn.replaceWith(iframe);
    });
  });
}

/** Phones: the long description opens collapsed to a few lines, with a "Read more" toggle. */
const COLLAPSE_QUERY = window.matchMedia("(max-width: 640px)");

function initReadMore(el: HTMLElement): void {
  const text = el.querySelector<HTMLElement>(".project-detail__description");
  const button = el.querySelector<HTMLButtonElement>(".read-more");
  if (!text || !button) return;
  let expanded = false;

  const update = () => {
    text.classList.toggle("is-collapsed", !expanded);
    // Only offer the toggle when the collapsed text actually hides something.
    const clipped = text.scrollHeight > text.clientHeight + 2;
    button.hidden = !expanded && !clipped;
    if (button.hidden) text.classList.remove("is-collapsed");
    button.textContent = t(expanded ? "common.readLess" : "common.readMore");
    button.setAttribute("aria-expanded", String(expanded));
  };

  button.addEventListener("click", () => {
    expanded = !expanded;
    update();
    if (!expanded) text.scrollIntoView({ block: "nearest" });
  });
  COLLAPSE_QUERY.addEventListener("change", () => {
    if (text.isConnected) update();
  });
  update();
}

const SEAL_ICON =
  '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.8 4.5 5.6v5.6c0 4.6 3.1 8.6 7.5 10 4.4-1.4 7.5-5.4 7.5-10V5.6z"/><path d="m8.6 12 2.4 2.4 4.6-4.8"/></svg>';
const TICK_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
const DOC_ICON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>';

/** Keeps a Latin term in brackets, e.g. "(Müstakil Tapu)", in one piece and in reading order inside Arabic text. */
const isolateTerms = (text: string) => text.replace(/\(([^()]*[A-Za-z][^()]*)\)/g, '(<bdi dir="ltr" class="nowrap">$1</bdi>)');

/** "Verified Project Card": legal and technical facts the team confirmed, with the date they were last checked. */
function renderVerified(project: Project, name: string, values?: Record<string, string>): string {
  const verified = project.verified;
  if (!verified || !values) return "";
  const items = verified.items.filter((key) => values[key]);
  if (!items.length) return "";
  const [y, m, d] = verified.updated.split("-").map(Number);
  const date = new Intl.DateTimeFormat(`${getLocale()}-u-nu-latn`, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    Date.UTC(y, m - 1, d)
  );
  const documentsHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `${t("projectDetail.verified.documentsMessage", { name })}\n${window.location.origin}${link(`/projects/${project.slug}`)}`
  )}`;
  return `
          <section class="detail-block verified-card" aria-labelledby="verified-title">
            <header class="verified-card__head">
              <span class="verified-card__seal">${SEAL_ICON}</span>
              <div class="verified-card__heading">
                <h2 id="verified-title">${t("projectDetail.verified.title")}</h2>
                <p>${t("projectDetail.verified.subtitle")}</p>
              </div>
              <span class="verified-card__date">${t("projectDetail.verified.updated", { date })}</span>
            </header>
            <dl class="verified-card__list">
              ${items
                .map(
                  (key, i) => `
              <div class="verified-card__item" ${reveal(i, 2)}>
                <span class="verified-card__tick">${TICK_ICON}</span>
                <dt>${isolateTerms(t(`projectDetail.verified.labels.${key}`))}</dt>
                <dd>${isolateTerms(values[key])}</dd>
              </div>`
                )
                .join("")}
            </dl>
            ${
              verified.documents
                ? `<footer class="verified-card__foot">
              <p>${t("projectDetail.verified.note")}</p>
              <a class="btn btn--outline" href="${documentsHref}" target="_blank" rel="noopener">${DOC_ICON}${t("projectDetail.verified.documentsButton")}</a>
            </footer>`
                : ""
            }
          </section>`;
}

function renderAmenities(project: Project): string {
  if (!project.amenities?.length) return "";
  // Three columns when that fills every row (6, 9…) and four doesn't.
  const n = project.amenities.length;
  const cols = n % 3 === 0 && n % 4 !== 0 ? 3 : 4;
  return `
    <section class="detail-block">
      <h2>${t("projectDetail.amenitiesTitle")}</h2>
      <ul class="amenity-grid${cols === 3 ? " amenity-grid--3" : ""}">
        ${project.amenities
          .map(
            (a, i) => `
          <li class="amenity-grid__item" ${reveal(i, cols)}>
            <span class="amenity-grid__icon">${amenityIcon(a)}</span>
            <span>${t(`projectDetail.amenities.${a}`)}</span>
          </li>`
          )
          .join("")}
      </ul>
    </section>`;
}

function renderLocation(project: Project, name: string, nearby: ReturnType<typeof getProjectContent>["nearby"]): string {
  return `
    <section class="detail-block" id="project-location">
      <h2>${t("projectDetail.locationTitle")}</h2>
      ${renderProjectMap(project, name)}
      ${
        nearby?.length
          ? `<ul class="nearby-list">
        ${nearby
          .map(
            (n, i) => `
          <li ${reveal(i, 2)}>
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
  const price =
    project.price === "on-request"
      ? t("projectDetail.priceOnRequest")
      : project.price
        ? `<span dir="ltr">${project.price}</span>`
        : "";
  const inquiryHref = `${link("/contact")}?project=${project.slug}`;
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t("projectDetail.whatsappMessage", { name: content.name }))}`;
  const contactActions = `
          <a class="btn btn--primary" href="${inquiryHref}">${t("projectDetail.ctaButton")}</a>
          <a class="btn btn--whatsapp" href="${whatsappHref}" target="_blank" rel="noopener">${WHATSAPP_ICON}${t("projectDetail.whatsappButton")}</a>`;

  el.innerHTML = `
    <section class="project-hero" style="${heroBackground(project.coverImage, "linear-gradient(180deg, rgba(15,20,18,.35), rgba(15,20,18,.88))")}">
      <div class="container project-hero__inner">
        <a class="back-link" href="${link("/projects")}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          ${t("projectDetail.backLabel")}
        </a>
        <div class="project-hero__badges">
          <span class="badge badge--${project.status}">${projectStatusLabel(project.status)}</span>
          ${project.unitsAvailable ? `<span class="badge badge--available">${t("common.unitsAvailable")}</span>` : ""}
          ${project.soldOut ? `<span class="badge badge--sold-out">${t("common.soldOut")}</span>` : ""}
          ${project.soldOut ? "" : favoriteButton(project.slug, "hero")}
        </div>
        <h1>${content.name}</h1>
        <p class="project-hero__tagline">${content.tagline}</p>
        <p class="project-hero__location">${place}${project.timeline ? ` · <span dir="ltr">${project.timeline}</span>` : ""}</p>
        ${price ? `<p class="project-hero__price">${t("projectDetail.priceLabel")}: ${price}</p>` : ""}
        ${
          project.landing
            ? `<div class="project-hero__actions"><a class="btn btn--primary" href="${inquiryHref}">${t("projectDetail.ctaButton")}</a></div>`
            : ""
        }
      </div>
    </section>

    <section class="project-stats" aria-label="${t("projectDetail.keyFactsTitle")}">
      <div class="container">
        <dl class="project-stats__grid">
          ${project.stats
            .map(
              (s) => `
            <div class="project-stats__item${s.value.length > 12 ? " project-stats__item--long" : ""}">
              <dt><span class="project-stats__icon">${statIcon(s.labelKey)}</span>${t(`common.statLabels.${s.labelKey}`)}</dt>
              <dd dir="ltr"${countsUp(s.value, s.labelKey) ? ` data-stat-value="${s.value}"` : ""}>${s.value}</dd>
            </div>`
            )
            .join("")}
        </dl>
      </div>
    </section>

    ${renderVideo(project, content, contactActions)}

    <section class="section project-detail">
      <div class="container project-detail__grid">
        <div class="project-detail__main">
          <section class="detail-block">
            <h2>${t("projectDetail.overviewTitle")}</h2>
            <p class="project-detail__description" id="project-description">${content.longDescription}</p>
            <button type="button" class="read-more" aria-controls="project-description" aria-expanded="false" hidden>${t("common.readMore")}</button>
          </section>

          <section class="detail-block">
            <h2>${t("projectDetail.highlightsTitle")}</h2>
            <ul class="highlight-list">
              ${content.highlights.map((h, i) => `<li ${reveal(i, 8)}>${h}</li>`).join("")}
            </ul>
          </section>

          ${renderVerified(project, content.name, content.verified)}

          ${renderResidences(project)}
          ${renderFloorPlan(project, content.floorPlan)}
          ${renderAmenities(project)}
          ${renderLocation(project, content.name, content.nearby)}

          <section class="detail-block">
            <h2>${t("projectDetail.galleryTitle")}</h2>
            <div class="gallery-grid" id="project-gallery">
              ${gallery
                .map(
                  (img, i) => `
                <button type="button" class="gallery-grid__item${i === 0 ? " gallery-grid__item--wide" : ""}${i === gallery.length - 1 ? galleryTail(gallery.length) : ""}" data-index="${i}">
                  <img ${photoAttrs(img, i === 0 || (i === gallery.length - 1 && galleryTail(gallery.length)) ? "(max-width: 720px) 100vw, 800px" : "(max-width: 720px) 50vw, 280px")} alt="${img.alt}" width="${img.width}" height="${img.height}" loading="lazy" />
                </button>`
                )
                .join("")}
            </div>
          </section>

          ${project.soldOut ? "" : `<section class="detail-block">${renderVideoTourInvite({ slugs: [project.slug], name: content.name })}</section>`}
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
                project.unitsAvailable || project.soldOut
                  ? `<div>
                <dt>${t("projectDetail.availabilityLabel")}</dt>
                <dd>${t(project.soldOut ? "projectDetail.soldOutLong" : "projectDetail.unitsAvailableLong")}</dd>
              </div>`
                  : ""
              }
              ${
                price
                  ? `<div>
                <dt>${t("projectDetail.priceLabel")}</dt>
                <dd>${price}</dd>
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
            <div class="cta-card__actions">
              <a class="btn btn--primary btn--block" href="${inquiryHref}">${t("projectDetail.ctaButton")}</a>
              <a class="btn btn--whatsapp btn--block" href="${whatsappHref}" target="_blank" rel="noopener">
                ${WHATSAPP_ICON}
                ${t("projectDetail.whatsappButton")}
              </a>
              ${project.soldOut ? "" : `<a class="btn btn--tour btn--block" href="${videoTourHref([project.slug])}">${VIDEO_TOUR_ICON}${t("videoTour.cardButton")}</a>`}
            </div>
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

  initStatCounters(el);
  initScrollReveal(el);
  initProjectMap(el);
  initVideo(el, content.name);
  initReadMore(el);

  const floorImages = (project.floorPlan ?? []).flatMap((f) => (f.image ? [f.image] : []));
  el.querySelectorAll<HTMLButtonElement>(".floor-card__media").forEach((btn) => {
    btn.addEventListener("click", () => {
      const image = project.floorPlan![Number(btn.dataset.floorIndex)].image!;
      openLightbox(floorImages.map((g) => ({ src: g.src, alt: g.alt, srcset: photoSrcset(g) })), floorImages.indexOf(image));
    });
  });

  const galleryEl = el.querySelector<HTMLElement>("#project-gallery")!;
  galleryEl.querySelectorAll<HTMLButtonElement>(".gallery-grid__item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      openLightbox(gallery.map((g) => ({ src: g.src, alt: g.alt, srcset: photoSrcset(g) })), index);
    });
  });
}
