import { t, tRaw, link, getProjectContent, placeLine } from "../i18n";
import { getSortedProjects, getProjectBySlug, type Project } from "../data/projects";
import { partners } from "../data/partners";
import { renderProjectCard } from "../components/projectCard";
import { initStatCounters } from "../components/statCounter";
import { initScrollReveal } from "../components/scrollReveal";

const HERO_IMAGE = "/hero-istanbul.jpg";

/* The New Launch project promoted in its own section above the project grid.
   Change the slug to promote a different project. */
const SPOTLIGHT_SLUG = "diamond-marin";
const SPOTLIGHT_STATS = ["apartments", "layout", "grossArea", "delivery"];
const SPOTLIGHT_THUMBS = 3;
const WHATSAPP_NUMBER = "905319309214";

interface StatItem {
  value: string;
  label: string;
}
interface ServiceItem {
  title: string;
  desc: string;
}

export function renderHome(el: HTMLElement): void {
  const stats = tRaw<StatItem[]>("home.stats");
  const services = tRaw<ServiceItem[]>("home.services");
  const why = tRaw<ServiceItem[]>("home.why");
  const spotlight = getProjectBySlug(SPOTLIGHT_SLUG);
  // The spotlight project sits right above the grid, so the grid skips it.
  const featured = getSortedProjects()
    .filter((p) => p.slug !== spotlight?.slug)
    .slice(0, 3);

  el.innerHTML = `
    <section class="hero" style="background-image: linear-gradient(180deg, rgba(15,20,18,.55), rgba(15,20,18,.82)), url('${HERO_IMAGE}')">
      <div class="container hero__inner">
        <p class="eyebrow eyebrow--on-dark">${t("home.heroEyebrow")}</p>
        <h1 class="hero__title">${t("home.heroTitle")}</h1>
        <p class="hero__subtitle">${t("home.heroSubtitle")}</p>
        <div class="hero__actions">
          <a class="btn btn--primary" href="${link("/projects")}">${t("home.heroCtaPrimary")}</a>
          <a class="btn btn--ghost" href="${link("/contact")}">${t("home.heroCtaSecondary")}</a>
        </div>
      </div>
    </section>

    <section class="section stats-section">
      <div class="container">
        <h2 class="section-title section-title--center">${t("home.statsTitle")}</h2>
        <div class="stats-grid">
          ${stats
            .map(
              (s) => `
            <div class="stat-tile">
              <span class="stat-tile__value" data-stat-value="${s.value}">0</span>
              <span class="stat-tile__label">${s.label}</span>
            </div>`
            )
            .join("")}
        </div>
      </div>
    </section>

    <section class="section partners-section">
      <div class="container">
        <p class="eyebrow eyebrow--center">${t("home.partnersEyebrow")}</p>
        <h2 class="section-title section-title--center">${t("home.partnersTitle")}</h2>
        <p class="section-subtitle section-subtitle--center">${t("home.partnersSubtitle")}</p>
        <div class="partners-grid">
          ${partners
            .map(
              (p, i) => `
            <div class="partner-logo" data-reveal data-reveal-index="${i}">
              <img src="${p.logo}" alt="${p.name}" loading="lazy" />
            </div>`
            )
            .join("")}
        </div>
      </div>
    </section>

    <section class="section about-teaser">
      <div class="container about-teaser__grid">
        <div class="about-teaser__media">
          <img src="/images/projects/lotus-koru-2/landscaped-grounds.jpg" alt="HADARA residential development in Beylikdüzü" loading="lazy" />
        </div>
        <div class="about-teaser__content">
          <p class="eyebrow">${t("home.aboutEyebrow")}</p>
          <h2 class="section-title">${t("home.aboutTitle")}</h2>
          <p>${t("home.aboutText1")}</p>
          <p>${t("home.aboutText2")}</p>
          <a class="btn btn--outline" href="${link("/about")}">${t("home.aboutCta")}</a>
        </div>
      </div>
    </section>

    ${spotlight ? renderSpotlight(spotlight) : ""}

    <section class="section projects-section">
      <div class="container">
        <div class="section-head">
          <div>
            <p class="eyebrow">${t("home.projectsEyebrow")}</p>
            <h2 class="section-title">${t("home.projectsTitle")}</h2>
            <p class="section-subtitle">${t("home.projectsSubtitle")}</p>
          </div>
          <a class="btn btn--outline" href="${link("/projects")}">${t("common.viewAllProjects")}</a>
        </div>
        <div class="project-grid">
          ${featured.map((p) => renderProjectCard(p)).join("")}
        </div>
      </div>
    </section>

    <section class="section services-section">
      <div class="container">
        <p class="eyebrow eyebrow--center">${t("home.servicesEyebrow")}</p>
        <h2 class="section-title section-title--center">${t("home.servicesTitle")}</h2>
        <div class="services-grid">
          ${services
            .map(
              (s, i) => `
            <div class="service-card">
              <span class="service-card__index">0${i + 1}</span>
              <h3>${s.title}</h3>
              <p>${s.desc}</p>
            </div>`
            )
            .join("")}
        </div>
      </div>
    </section>

    <section class="section why-section">
      <div class="container">
        <p class="eyebrow eyebrow--center">${t("home.whyEyebrow")}</p>
        <h2 class="section-title section-title--center">${t("home.whyTitle")}</h2>
        <div class="why-grid">
          ${why
            .map(
              (w) => `
            <div class="why-card">
              <h3>${w.title}</h3>
              <p>${w.desc}</p>
            </div>`
            )
            .join("")}
        </div>
      </div>
    </section>

    <section class="section citizenship-teaser">
      <div class="container citizenship-teaser__inner">
        <div>
          <h2 class="section-title">${t("home.citizenshipTitle")}</h2>
          <p>${t("home.citizenshipText")}</p>
        </div>
        <a class="btn btn--primary" href="${link("/citizenship")}">${t("home.citizenshipCta")}</a>
      </div>
    </section>

    <section class="section final-cta">
      <div class="container final-cta__inner">
        <h2 class="section-title">${t("home.ctaTitle")}</h2>
        <p>${t("home.ctaText")}</p>
        <a class="btn btn--primary" href="${link("/contact")}">${t("home.ctaButton")}</a>
      </div>
    </section>
  `;

  initStatCounters(el);
  initSpotlightGallery(el);
  initScrollReveal(el);
}

function renderSpotlight(project: Project): string {
  const content = getProjectContent(project.slug);
  const detailHref = link(`/projects/${project.slug}`);
  const whatsappText = t("home.spotlightWhatsappMessage", { name: content.name });
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappText)}`;
  const stats = SPOTLIGHT_STATS.map((key) => project.stats.find((s) => s.labelKey === key)).filter(
    (s): s is Project["stats"][number] => Boolean(s)
  );
  const images = [project.coverImage, ...project.gallery.slice(0, SPOTLIGHT_THUMBS)];

  return `
    <section class="section spotlight-section" aria-labelledby="spotlight-title">
      <div class="container">
        <div class="spotlight">
          <div class="spotlight__media">
            <a class="spotlight__main" href="${detailHref}" tabindex="-1" aria-hidden="true">
              <img
                src="${project.coverImage.src}"
                alt="${project.coverImage.alt}"
                width="${project.coverImage.width}"
                height="${project.coverImage.height}"
                loading="lazy"
                data-spotlight-main
              />
              <span class="badge badge--new-launch spotlight__badge">${t("common.statusNewLaunch")}</span>
            </a>
            <div class="spotlight__thumbs">
              ${images
                .map(
                  (img, i) => `
                <button type="button" class="spotlight__thumb${i === 0 ? " is-active" : ""}" data-spotlight-thumb="${img.src}" data-alt="${img.alt}" aria-label="${img.alt}">
                  <img src="${img.src}" alt="" loading="lazy" />
                </button>`
                )
                .join("")}
            </div>
          </div>

          <div class="spotlight__content">
            <p class="eyebrow">${t("home.spotlightEyebrow")} · ${placeLine(project.district, project.city)}</p>
            <h2 class="section-title spotlight__title" id="spotlight-title">${content.name}</h2>
            ${project.developer ? `<p class="spotlight__developer" dir="ltr" translate="no">${project.developer}</p>` : ""}
            <p class="spotlight__text">${content.shortDescription}</p>

            <dl class="spotlight__stats">
              ${stats
                .map(
                  (s) => `
                <div class="spotlight__stat">
                  <dt>${t(`common.statLabels.${s.labelKey}`)}</dt>
                  <dd dir="ltr">${s.value}</dd>
                </div>`
                )
                .join("")}
            </dl>

            <p class="spotlight__limited">
              <span class="spotlight__limited-dot" aria-hidden="true"></span>
              ${t("home.spotlightLimited")}
            </p>

            <div class="spotlight__actions">
              <a class="btn btn--whatsapp" href="${whatsappHref}" target="_blank" rel="noopener">
                <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M16.004 3C9.377 3 4 8.373 4 15c0 2.34.664 4.523 1.815 6.377L4 29l7.828-1.767A11.94 11.94 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3Zm6.98 16.86c-.29.815-1.688 1.56-2.320 1.653-.593.088-1.33.124-2.148-.135-.495-.157-1.13-.367-1.945-.72-3.425-1.48-5.66-4.916-5.83-5.146-.17-.23-1.4-1.86-1.4-3.550 0-1.688.885-2.518 1.2-2.862.315-.345.687-.43.916-.43.23 0 .458.002.658.012.21.01.492-.08.77.586.29.7.984 2.42 1.070 2.595.086.174.144.38.028.61-.115.23-.174.373-.345.575-.172.202-.36.45-.516.606-.172.172-.35.36-.15.71.2.35.887 1.463 1.905 2.37 1.31 1.166 2.416 1.527 2.774 1.7.358.172.567.144.777-.086.21-.23.898-1.044 1.14-1.402.24-.358.483-.298.813-.18.33.115 2.09.985 2.448 1.165.358.18.596.27.685.42.086.15.086.87-.204 1.687Z"/></svg>
                ${t("home.spotlightWhatsapp")}
              </a>
              <a class="btn btn--outline" href="${detailHref}">
                ${t("home.spotlightMore")}
                <svg class="spotlight__arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>`;
}

/** Thumbnails swap the large spotlight image. */
function initSpotlightGallery(root: HTMLElement): void {
  const main = root.querySelector<HTMLImageElement>("[data-spotlight-main]");
  const thumbs = root.querySelectorAll<HTMLButtonElement>("[data-spotlight-thumb]");
  if (!main) return;
  thumbs.forEach((thumb) => {
    thumb.addEventListener("click", () => {
      main.src = thumb.dataset.spotlightThumb ?? main.src;
      main.alt = thumb.dataset.alt ?? main.alt;
      thumbs.forEach((b) => b.classList.toggle("is-active", b === thumb));
    });
  });
}
