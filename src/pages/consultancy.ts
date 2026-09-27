import { t, tRaw, link, placeLine } from "../i18n";
import { CONSULTANCY_PAGES, consultancyPath, type ConsultancyPage } from "../seo/routes";
import {
  HERO_IMAGE,
  STUDIO_IMAGE,
  SERVICE_KEYS,
  PROJECT_TYPE_KEYS,
  consultancyWorks,
  CONSULTANCY_PAGE_IMAGES,
  projectTypeImage,
  srcset,
  fallbackSrc,
  type ResponsiveImage,
  type ConsultancyWork
} from "../data/consultancy";
import { openLightbox } from "../components/lightbox";
import { initScrollReveal } from "../components/scrollReveal";
import { renderConsultancyForm, initConsultancyForm, preselectService } from "../components/consultancyForm";
import { WHATSAPP_ICON, WHATSAPP_NUMBER } from "../components/floatingButtons";

interface ServiceItem {
  title: string;
  desc: string;
  items: string[];
}
interface TextItem {
  title: string;
  desc: string;
}
interface FaqItem {
  q: string;
  a: string;
}

const SITE_EMAIL = "info@byhadara.com";
const SITE_PHONE = "+90 531 930 92 14";
const SITE_PHONE_HREF = "+905319309214";
const FORM_ID = "consultation-form";

const icon = (paths: string, size = 26) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const SERVICE_ICONS: Record<(typeof SERVICE_KEYS)[number], string> = {
  architectural: icon('<rect x="4" y="3" width="10" height="18" rx="1"/><path d="M14 9h5a1 1 0 0 1 1 1v11"/><path d="M7.5 7h1M10.5 7h1M7.5 11h1M10.5 11h1M7.5 15h1M10.5 15h1"/><path d="M2 21h20"/>'),
  engineering: icon('<path d="M4 20V4l16 16z"/><path d="M8 16v-3.5l3.5 3.5z"/><path d="M4 8h2M4 12h2"/>'),
  interior: icon('<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M6 18v2M18 18v2"/>'),
  visualization: icon('<path d="M12 2.5 3.5 7v10l8.5 4.5 8.5-4.5V7z"/><path d="m3.5 7 8.5 4.5L20.5 7"/><path d="M12 11.5v10"/>'),
  development: icon('<path d="M3 20h18"/><path d="m6 16 4-5 3 3 5-7"/><path d="M15 7h3v3"/>'),
  renovation: icon('<rect x="3" y="3" width="14" height="6" rx="1"/><path d="M17 6h2.5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H12v3"/><rect x="10" y="14" width="4" height="7" rx="1"/>')
};

const WHY_ICONS = [
  icon('<path d="M12 2 2 7l10 5 10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>'),
  icon('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  icon('<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>'),
  icon('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/><path d="M11 8v6M8 11h6"/>'),
  icon('<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20"/><path d="m12 21-4-12 4-6 4 6z"/>'),
  icon('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/>')
];

const ARROW = icon('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>', 16);
const CHECK = icon('<polyline points="20 6 9 17 4 12"/>', 18);
const MAIL_ICON = icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>', 20);
const PHONE_ICON = icon('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>', 20);

/** Scroll-reveal attributes; the stagger restarts every row. */
const reveal = (i: number, perRow = 3) => `data-reveal data-reveal-index="${i % perRow}"`;

function picture(img: ResponsiveImage, alt: string, sizes: string, extra = 'loading="lazy" decoding="async"'): string {
  return `<img src="${fallbackSrc(img)}" srcset="${srcset(img)}" sizes="${sizes}" width="${img.width}" height="${img.height}" alt="${alt}" ${extra} />`;
}

/** Istanbul as the hub, linked to the markets the studio works with. Pure SVG: no map tiles to load. */
function renderNetwork(): string {
  const nodes = [
    { x: 330, y: 70, label: t("consultancy.regions.turkiye") },
    { x: 370, y: 250, label: t("consultancy.regions.middleEast") },
    { x: 90, y: 240, label: t("consultancy.regions.international") }
  ];
  const hub = { x: 210, y: 150 };
  return `
    <svg class="consult-network" viewBox="0 0 460 320" role="img" aria-label="${t("consultancy.globalVisualLabel")}">
      <defs>
        <pattern id="consult-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0v20" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.18"/>
        </pattern>
      </defs>
      <rect width="460" height="320" fill="url(#consult-grid)" class="consult-network__grid"/>
      ${nodes
        .map((n) => {
          const cx = (hub.x + n.x) / 2;
          const cy = Math.min(hub.y, n.y) - 50;
          return `<path class="consult-network__arc" d="M${hub.x} ${hub.y} Q${cx} ${cy} ${n.x} ${n.y}" pathLength="1"/>`;
        })
        .join("")}
      ${nodes
        .map(
          (n) => `
        <g class="consult-network__node">
          <circle cx="${n.x}" cy="${n.y}" r="6"/>
          <text x="${n.x}" y="${n.y + 24}" text-anchor="middle">${n.label}</text>
        </g>`
        )
        .join("")}
      <g class="consult-network__hub">
        <circle class="consult-network__pulse" cx="${hub.x}" cy="${hub.y}" r="10"/>
        <circle cx="${hub.x}" cy="${hub.y}" r="9"/>
        <text x="${hub.x}" y="${hub.y + 30}" text-anchor="middle">${t("consultancy.regions.istanbul")}</text>
      </g>
    </svg>`;
}

const GALLERY_ICON = icon('<rect x="3" y="5" width="15" height="13" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v10"/><path d="m3 15 4-4 3 3 3-3 5 5"/>', 16);

const workImageAlt = (work: ConsultancyWork, n: number) =>
  t("consultancy.worksImageAlt", { name: work.title, n, total: work.images.length });

function renderWorks(limit = consultancyWorks.length): string {
  if (!consultancyWorks.length) {
    return `
      <div class="consult-works__empty" data-reveal>
        <span class="consult-works__empty-icon">${icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="15.5" cy="8.5" r="1.5"/>', 28)}</span>
        <div>
          <h3>${t("consultancy.worksEmptyTitle")}</h3>
          <p>${t("consultancy.worksEmptyText")}</p>
        </div>
        <a class="btn btn--outline" href="${link(consultancyPath("consultation"))}">${t("consultancy.worksCta")}</a>
      </div>`;
  }
  return `
    <ul class="consult-works__grid">
      ${consultancyWorks
        .slice(0, limit)
        .map(
          (w, i) => `
        <li class="consult-work" ${reveal(i)}>
          <button type="button" class="consult-work__media" data-work="${i}" aria-label="${t("consultancy.worksOpenGallery", { name: w.title })}">
            ${picture(w.images[0], workImageAlt(w, 1), "(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 400px")}
            <span class="consult-work__count" dir="ltr">${GALLERY_ICON}${w.images.length}</span>
          </button>
          <div class="consult-work__body">
            <p class="consult-work__category">${t(`consultancy.workCategories.${w.category}`)}</p>
            <h3 class="consult-work__title" translate="no">${w.title}</h3>
            <p class="consult-work__place">${placeLine(w.district, w.city)}</p>
            <p class="consult-work__meta"><span dir="ltr">${w.year}</span><span aria-hidden="true">·</span><span dir="ltr">${w.area}</span></p>
          </div>
        </li>`
        )
        .join("")}
    </ul>`;
}

/** Each work's cover opens its full image set in the site's lightbox. */
function initWorksGallery(root: HTMLElement): void {
  root.querySelectorAll<HTMLButtonElement>("[data-work]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const work = consultancyWorks[Number(btn.dataset.work)];
      if (!work) return;
      openLightbox(
        work.images.map((img, i) => ({ src: `${img.base}-${img.widths[img.widths.length - 1]}.webp`, alt: workImageAlt(work, i + 1) })),
        0
      );
    });
  });
}

type Page = ConsultancyPage;

const href = (page: Page) => link(consultancyPath(page));

function sectionHead(prefix: string, center = true): string {
  const c = center ? " eyebrow--center" : "";
  const tc = center ? " section-title--center" : "";
  const sc = center ? " section-subtitle--center" : "";
  return `
        <p class="eyebrow${c}">${t(`consultancy.${prefix}Eyebrow`)}</p>
        <h2 class="section-title${tc}">${t(`consultancy.${prefix}Title`)}</h2>
        <p class="section-subtitle${sc}">${t(`consultancy.${prefix}Subtitle`)}</p>`;
}

/* ---------- Page headers ---------- */

function heroFull(): string {
  return `
    <section class="consult-hero">
      ${picture(HERO_IMAGE, t("consultancy.heroImageAlt"), "100vw", 'class="consult-hero__media" fetchpriority="high" decoding="async"')}
      <div class="container consult-hero__inner">
        <h1 class="consult-hero__heading">
          <span class="eyebrow eyebrow--on-dark consult-hero__label">${t("consultancy.heroEyebrow")}</span>
          <span class="consult-hero__title">${t("consultancy.heroTitle")}</span>
        </h1>
        <p class="hero__subtitle consult-hero__subtitle">${t("consultancy.heroSubtitle")}</p>
        <div class="hero__actions">
          <a class="btn btn--primary" href="${href("consultation")}">${t("consultancy.heroCtaPrimary")}</a>
          <a class="btn btn--ghost" href="${href("services")}">${t("consultancy.heroCtaSecondary")}</a>
        </div>
        <p class="consult-hero__markets">${t("consultancy.markets")}</p>
      </div>
    </section>`;
}

/** Shorter banner for the inner pages, with the section name linking back to the overview. */
function heroPage(page: Exclude<Page, "overview">): string {
  const image = CONSULTANCY_PAGE_IMAGES[page];
  return `
    <section class="consult-hero consult-hero--page">
      ${picture(image.banner, t(image.altKey), "100vw", 'class="consult-hero__media" fetchpriority="high" decoding="async"')}
      <div class="container consult-hero__inner">
        <h1 class="consult-hero__heading">
          <a class="eyebrow eyebrow--on-dark consult-hero__label consult-hero__crumb" href="${href("overview")}">${t("consultancy.heroEyebrow")}</a>
          <span class="consult-hero__title">${t(`consultancy.pages.${page}.title`)}</span>
        </h1>
        <p class="hero__subtitle consult-hero__subtitle">${t(`consultancy.pages.${page}.subtitle`)}</p>
      </div>
    </section>`;
}

/** Tabs linking the section's pages; scrolls sideways on small screens. */
function subnav(page: Page): string {
  return `
    <nav class="consult-jump" aria-label="${t("consultancy.subnavLabel")}">
      <div class="container consult-jump__inner">
        ${CONSULTANCY_PAGES.map(
          (p) =>
            `<a class="${p === "consultation" ? "consult-jump__cta" : ""}${p === page ? " is-active" : ""}" href="${href(p)}"${p === page ? ' aria-current="page"' : ""}>${t(`consultancy.nav.${p}`)}</a>`
        ).join("")}
      </div>
    </nav>`;
}

/* ---------- Sections ---------- */

function intro(): string {
  const clients = tRaw<string[]>("consultancy.clients");
  return `
    <section class="section consult-intro">
      <div class="container consult-intro__grid">
        <div class="consult-intro__media" data-reveal>
          ${picture(STUDIO_IMAGE, t("consultancy.introImageAlt"), "(max-width: 900px) 100vw, 560px")}
        </div>
        <div class="consult-intro__content">
          <p class="eyebrow">${t("consultancy.introEyebrow")}</p>
          <h2 class="section-title">${t("consultancy.introTitle")}</h2>
          <p class="lead-text">${t("consultancy.introText1")}</p>
          <p>${t("consultancy.introText2")}</p>
          <h3 class="consult-intro__subhead">${t("consultancy.clientsTitle")}</h3>
          <ul class="consult-clients">
            ${clients.map((c) => `<li>${c}</li>`).join("")}
          </ul>
        </div>
      </div>
    </section>`;
}

/** Overview: the six services at a glance, each linking to its full card on the services page. */
function servicesGlance(): string {
  const services = tRaw<ServiceItem[]>("consultancy.services");
  return `
    <section class="section consult-services">
      <div class="container">
        ${sectionHead("services")}
        <div class="consult-glance">
          ${SERVICE_KEYS.map(
            (key, i) => `
          <a class="consult-glance__item" href="${href("services")}#${key}" ${reveal(i)}>
            <span class="consult-service__icon">${SERVICE_ICONS[key]}</span>
            <span class="consult-glance__text">
              <strong>${services[i].title}</strong>
              <span>${services[i].desc}</span>
            </span>
            <span class="consult-glance__arrow">${ARROW}</span>
          </a>`
          ).join("")}
        </div>
        <div class="consult-more"><a class="btn btn--outline" href="${href("services")}">${t("consultancy.allServices")}</a></div>
      </div>
    </section>`;
}

function servicesDetail(): string {
  const services = tRaw<ServiceItem[]>("consultancy.services");
  return `
    <section class="section consult-services">
      <div class="container">
        <div class="consult-services__grid">
          ${SERVICE_KEYS.map((key, i) => {
            const s = services[i];
            return `
          <article class="consult-service" id="${key}" ${reveal(i)}>
            <div class="consult-service__head">
              <span class="consult-service__icon">${SERVICE_ICONS[key]}</span>
              <span class="consult-service__index" dir="ltr">${String(i + 1).padStart(2, "0")}</span>
            </div>
            <h2 class="consult-service__title">${s.title}</h2>
            <p>${s.desc}</p>
            <ul class="consult-service__items">
              ${s.items.map((item) => `<li>${item}</li>`).join("")}
            </ul>
            <a class="consult-service__link" href="${href("consultation")}?service=${key}">
              ${t("consultancy.serviceCta")} ${ARROW}
            </a>
          </article>`;
          }).join("")}
        </div>
      </div>
    </section>`;
}

function why(): string {
  const items = tRaw<TextItem[]>("consultancy.why");
  return `
    <section class="section consult-why">
      <div class="container">
        ${sectionHead("why")}
        <div class="consult-why__grid">
          ${items
            .map(
              (w, i) => `
          <div class="consult-why__item" ${reveal(i)}>
            <span class="consult-why__icon">${WHY_ICONS[i] ?? WHY_ICONS[0]}</span>
            <div>
              <h3>${w.title}</h3>
              <p>${w.desc}</p>
            </div>
          </div>`
            )
            .join("")}
        </div>
      </div>
    </section>`;
}

function types(): string {
  return `
    <section class="section consult-types">
      <div class="container">
        <div class="section-head">
          <div>${sectionHead("types", false)}</div>
        </div>
        <ul class="consult-types__grid">
          ${PROJECT_TYPE_KEYS.map(
            (key, i) => `
          <li class="consult-type" ${reveal(i, 4)}>
            ${picture(projectTypeImage(key), t(`consultancy.types.${key}.alt`), "(max-width: 700px) 50vw, (max-width: 1100px) 33vw, 300px")}
            <span class="consult-type__label">${t(`consultancy.types.${key}.label`)}</span>
          </li>`
          ).join("")}
        </ul>
        <p class="consult-types__note">${t("consultancy.typesNote")}</p>
      </div>
    </section>`;
}

/** `limit` shows only the first works (overview teaser) with a link to the full portfolio. */
function works(limit?: number): string {
  const teaser = limit !== undefined && consultancyWorks.length > limit;
  return `
    <section class="section consult-works">
      <div class="container">
        <div class="section-head">
          <div>
            <p class="eyebrow">${t("consultancy.worksEyebrow")}</p>
            <h2 class="section-title">${t("consultancy.worksTitle")}</h2>
            ${consultancyWorks.length ? `<p class="section-subtitle">${t("consultancy.worksSubtitle")}</p>` : ""}
          </div>
          ${teaser ? `<a class="btn btn--outline" href="${href("portfolio")}">${t("consultancy.worksTeaserCta")}</a>` : ""}
        </div>
        ${renderWorks(limit)}
      </div>
    </section>`;
}

function processSteps(): string {
  const steps = tRaw<TextItem[]>("consultancy.process");
  return `
    <section class="section consult-process">
      <div class="container">
        ${sectionHead("process")}
        <ol class="consult-process__list">
          ${steps
            .map(
              (step, i) => `
          <li class="consult-step" ${reveal(i)}>
            <span class="consult-step__number" dir="ltr">${String(i + 1).padStart(2, "0")}</span>
            <h3>${step.title}</h3>
            <p>${step.desc}</p>
          </li>`
            )
            .join("")}
        </ol>
      </div>
    </section>`;
}

/** Overview: the six stages as one compact row, linking to the process page. */
function processStrip(): string {
  const steps = tRaw<TextItem[]>("consultancy.process");
  return `
    <section class="section consult-process consult-process--strip">
      <div class="container">
        <p class="eyebrow eyebrow--center">${t("consultancy.processEyebrow")}</p>
        <h2 class="section-title section-title--center">${t("consultancy.processTitle")}</h2>
        <ol class="consult-strip">
          ${steps
            .map(
              (step, i) => `
          <li class="consult-strip__step" ${reveal(i, 6)}>
            <span class="consult-strip__number" dir="ltr">${String(i + 1).padStart(2, "0")}</span>
            <span class="consult-strip__title">${step.title}</span>
          </li>`
            )
            .join("")}
        </ol>
        <div class="consult-more"><a class="btn btn--outline" href="${href("process")}">${t("consultancy.processTeaserCta")}</a></div>
      </div>
    </section>`;
}

function global(): string {
  const points = tRaw<string[]>("consultancy.globalPoints");
  return `
    <section class="section consult-global">
      <div class="container consult-global__grid">
        <div class="consult-global__content">
          <p class="eyebrow">${t("consultancy.globalEyebrow")}</p>
          <h2 class="section-title">${t("consultancy.globalTitle")}</h2>
          <p>${t("consultancy.globalText")}</p>
          <ul class="consult-global__points">
            ${points.map((p) => `<li>${CHECK}<span>${p}</span></li>`).join("")}
          </ul>
        </div>
        <div class="consult-global__visual" data-reveal>${renderNetwork()}</div>
      </div>
    </section>`;
}

function faq(): string {
  const items = tRaw<FaqItem[]>("consultancy.faq");
  return `
    <section class="section consult-faq">
      <div class="container narrow">
        <p class="eyebrow eyebrow--center">${t("consultancy.faqEyebrow")}</p>
        <h2 class="section-title section-title--center">${t("consultancy.faqTitle")}</h2>
        <div class="faq-list">
          ${items
            .map(
              (item) => `
          <details class="faq-item">
            <summary class="faq-item__question">
              <span>${item.q}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </summary>
            <p class="faq-item__answer">${item.a}</p>
          </details>`
            )
            .join("")}
        </div>
        <p class="consult-faq__more">${t("consultancy.faqMore")} <a href="${link("/faq")}">${t("nav.faq")}</a></p>
      </div>
    </section>`;
}

/** Closing band on every page but the request page: the site's dark final CTA. */
function ctaBand(): string {
  return `
    <section class="section final-cta">
      <div class="container final-cta__inner">
        <div>
          <h2 class="section-title">${t("consultancy.ctaTitle")}</h2>
          <p>${t("consultancy.ctaText")}</p>
        </div>
        <div class="consult-band__actions">
          <a class="btn btn--primary" href="${href("consultation")}">${t("consultancy.heroCtaPrimary")}</a>
          <a class="btn btn--whatsapp" href="${whatsappHref()}" target="_blank" rel="noopener">${WHATSAPP_ICON} ${t("consultancy.ctaWhatsapp")}</a>
        </div>
      </div>
    </section>`;
}

function consultationForm(): string {
  return `
    <section class="section consult-cta" id="${FORM_ID}" aria-labelledby="consult-cta-title">
      <div class="container consult-cta__grid">
        <div class="consult-cta__content">
          <p class="eyebrow eyebrow--on-dark">${t("consultancy.ctaEyebrow")}</p>
          <h2 class="section-title" id="consult-cta-title">${t("consultancy.ctaTitle")}</h2>
          <p>${t("consultancy.ctaText")}</p>
          <ul class="consult-cta__contacts">
            <li>
              <a class="btn btn--whatsapp" href="${whatsappHref()}" target="_blank" rel="noopener">${WHATSAPP_ICON} ${t("consultancy.ctaWhatsapp")}</a>
            </li>
            <li><a href="mailto:${SITE_EMAIL}">${MAIL_ICON}<span dir="ltr">${SITE_EMAIL}</span></a></li>
            <li><a href="tel:${SITE_PHONE_HREF}">${PHONE_ICON}<span dir="ltr">${SITE_PHONE}</span></a></li>
          </ul>
        </div>
        <div class="consult-cta__card">
          <h2 class="consult-cta__form-title">${t("consultancy.form.title")}</h2>
          ${renderConsultancyForm()}
        </div>
      </div>
    </section>`;
}

const whatsappHref = () => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t("consultancy.whatsappMessage"))}`;

/* ---------- Pages ---------- */

const PAGES: Record<Page, () => string> = {
  overview: () => heroFull() + subnav("overview") + intro() + servicesGlance() + works(3) + processStrip() + ctaBand(),
  services: () => heroPage("services") + subnav("services") + servicesDetail() + why() + ctaBand(),
  portfolio: () => heroPage("portfolio") + subnav("portfolio") + works() + types() + ctaBand(),
  process: () => heroPage("process") + subnav("process") + processSteps() + global() + faq() + ctaBand(),
  consultation: () => heroPage("consultation") + subnav("consultation") + consultationForm()
};

export function renderConsultancy(el: HTMLElement, page: Page = "overview"): void {
  el.innerHTML = PAGES[page]();

  if (page === "consultation") {
    initConsultancyForm(el);
    // "Request this service" links arrive with ?service=<key>.
    const service = new URLSearchParams(window.location.search).get("service");
    if (service) preselectService(el, service);
  }
  initWorksGallery(el);
  initScrollReveal(el);
}
