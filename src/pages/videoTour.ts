import { t, tRaw, link } from "../i18n";
import { initScrollReveal } from "../components/scrollReveal";
import { renderVideoTourBooking, initVideoTourBooking } from "../components/videoTourBooking";
import { photoAttrs } from "../utils/responsiveImage";

interface TextItem {
  title: string;
  desc: string;
}

const svg = (body: string, size = 24) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const CHECK = svg('<path d="m5 12 5 5 9-10"/>', 16);
const CHEVRON = svg('<polyline points="6 9 12 15 18 9"></polyline>', 18);
const CLOCK = svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 18);
const GLOBE = svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>', 18);
const PERSON = svg('<circle cx="12" cy="9" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6"/>', 20);
const MIC = svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>', 18);
const CAMERA = svg('<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="m15.5 10.5 6-3.5v10l-6-3.5"/>', 18);
const HANG_UP = svg('<path d="M3.5 14.5c4.8-4.3 12.2-4.3 17 0l-1.9 2.4-3.4-1.3v-2.2a11 11 0 0 0-7 0v2.2l-3.4 1.3z"/>', 20);

/** Photos behind "What you will see", in the order of `videoTour.see`. */
const SEE_IMAGES = [
  { src: "/images/projects/diamond-marin/living-dining.jpg", width: 757, height: 517 },
  { src: "/images/projects/beylikduzu-living/site-plan.jpg", width: 1202, height: 864 },
  { src: "/images/projects/diamond-marin/facade.jpg", width: 1448, height: 1086 },
  { src: "/images/projects/beylikduzu-living/aerial-view.jpg", width: 1193, height: 671 }
];

const SEE_ICONS = [
  svg('<path d="M4 12V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M3 12a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3z"/><path d="M5 17v2M19 17v2"/>', 20),
  svg('<path d="M12 3 3 7.5l9 4.5 9-4.5z"/><path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5"/>', 20),
  svg('<path d="M3 21h18"/><path d="M5 21V9l5-3v15"/><path d="M10 21V4h9v17"/><path d="M13 8h3M13 12h3M13 16h3"/>', 20),
  svg('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', 20)
];

/** The frame of a live video call in the hero, showing a show-apartment living room. */
function heroVisual(): string {
  return `
      <div class="tour-hero__visual" aria-hidden="true">
        <div class="tour-phone">
          <div class="tour-phone__screen">
            <img ${photoAttrs({ src: "/images/projects/diamond-marin/living-room.jpg", width: 1297 }, "290px")} alt="" width="1297" height="924" fetchpriority="high" />
            <span class="tour-phone__live"><span class="tour-phone__rec"></span>${t("videoTour.mock.live")} <span dir="ltr">12:48</span></span>
            <span class="tour-phone__pip">${PERSON}<span>${t("videoTour.mock.advisor")}</span></span>
            <p class="tour-phone__caption">${t("videoTour.mock.caption")}</p>
            <span class="tour-phone__controls">
              <span class="tour-phone__control">${MIC}</span>
              <span class="tour-phone__control">${CAMERA}</span>
              <span class="tour-phone__control tour-phone__control--end">${HANG_UP}</span>
            </span>
          </div>
        </div>
        <span class="tour-float tour-float--time">${CLOCK}<span>${t("videoTour.mock.duration").replace(/(\d+–\d+)/, '<bdi dir="ltr">$1</bdi>')}</span></span>
        <span class="tour-float tour-float--lang">${GLOBE}<span dir="ltr">${t("videoTour.mock.languages")}</span></span>
      </div>`;
}

export function renderVideoTour(el: HTMLElement): void {
  const trust = tRaw<string[]>("videoTour.trust");
  const steps = tRaw<TextItem[]>("videoTour.steps");
  const see = tRaw<TextItem[]>("videoTour.see");
  const ask = tRaw<string[]>("videoTour.ask");
  const faq = tRaw<{ q: string; a: string }[]>("videoTour.faq");
  const project = new URLSearchParams(window.location.search).get("project");

  el.innerHTML = `
    <section class="page-hero tour-hero">
      <div class="container tour-hero__inner">
        <div class="tour-hero__text">
          <p class="eyebrow eyebrow--on-dark">${t("videoTour.eyebrow")}</p>
          <h1>${t("videoTour.heroTitle")}</h1>
          <p class="page-hero__subtitle">${t("videoTour.heroSubtitle")}</p>
          <div class="tour-hero__actions">
            <a class="btn btn--primary" href="#book">${t("videoTour.heroCta")}</a>
            <a class="btn btn--ghost" href="#how">${t("videoTour.heroSecondary")}</a>
          </div>
          <ul class="tour-trust">
            ${trust.map((item) => `<li>${CHECK}<span>${item}</span></li>`).join("")}
          </ul>
        </div>
        ${heroVisual()}
      </div>
    </section>

    <section class="section tour-how" id="how">
      <div class="container">
        <h2 class="section-title section-title--center">${t("videoTour.howTitle")}</h2>
        <p class="section-subtitle section-subtitle--center">${t("videoTour.howSubtitle")}</p>
        <ol class="tour-how__list">
          ${steps
            .map(
              (step, i) => `
          <li class="tour-how__item" data-reveal data-reveal-index="${i}">
            <span class="tour-how__num" dir="ltr">${i + 1}</span>
            <h3>${step.title}</h3>
            <p>${step.desc}</p>
          </li>`
            )
            .join("")}
        </ol>
      </div>
    </section>

    <section class="section tour-see">
      <div class="container">
        <h2 class="section-title section-title--center">${t("videoTour.seeTitle")}</h2>
        <p class="section-subtitle section-subtitle--center">${t("videoTour.seeSubtitle")}</p>
        <ul class="tour-see__grid">
          ${see
            .map((item, i) => {
              const img = SEE_IMAGES[i];
              return `
          <li class="tour-see__card" data-reveal data-reveal-index="${i % 4}">
            <div class="tour-see__media">
              <img ${photoAttrs(img, "(max-width: 640px) calc(100vw - 32px), (max-width: 1100px) 50vw, 300px")} alt="" width="${img.width}" height="${img.height}" loading="lazy" />
              <span class="tour-see__icon">${SEE_ICONS[i]}</span>
            </div>
            <div class="tour-see__body">
              <h3>${item.title}</h3>
              <p>${item.desc}</p>
            </div>
          </li>`;
            })
            .join("")}
        </ul>
      </div>
    </section>

    <section class="section tour-ask">
      <div class="container tour-ask__inner">
        <div class="tour-ask__questions">
          <h2 class="section-title">${t("videoTour.askTitle")}</h2>
          <p class="section-subtitle">${t("videoTour.askSubtitle")}</p>
          <ul class="tour-ask__list">
            ${ask.map((item) => `<li>${CHECK}<span>${item}</span></li>`).join("")}
          </ul>
        </div>
        <div class="tour-visit">
          <h3>${t("videoTour.visitTitle")}</h3>
          <p>${t("videoTour.visitText")}</p>
          <a class="btn btn--outline" href="${link(`/contact${project ? `?project=${encodeURIComponent(project)}` : ""}`)}">${t("videoTour.visitCta")}</a>
        </div>
      </div>
    </section>

    <section class="section tour-book" id="book" aria-labelledby="tour-book-title">
      <div class="container">
        <div class="tour-book__card">
          <div class="tour-book__head">
            <p class="eyebrow eyebrow--center">${t("videoTour.eyebrow")}</p>
            <h2 class="section-title section-title--center" id="tour-book-title">${t("videoTour.bookTitle")}</h2>
            <p class="section-subtitle section-subtitle--center">${t("videoTour.bookSubtitle")}</p>
          </div>
          ${renderVideoTourBooking()}
        </div>
      </div>
    </section>

    <section class="section tour-faq">
      <div class="container narrow">
        <h2 class="section-title section-title--center">${t("videoTour.faqTitle")}</h2>
        <div class="faq-list">
          ${faq
            .map(
              (item) => `
          <details class="faq-item">
            <summary class="faq-item__question"><span>${item.q}</span>${CHEVRON}</summary>
            <p class="faq-item__answer">${item.a}</p>
          </details>`
            )
            .join("")}
        </div>
      </div>
    </section>

    <section class="section final-cta">
      <div class="container final-cta__inner">
        <div class="cz-cta__text">
          <h2 class="section-title">${t("videoTour.finalTitle")}</h2>
          <p>${t("videoTour.finalText")}</p>
        </div>
        <div class="cz-cta__actions">
          <a class="btn btn--primary" href="#book">${t("videoTour.finalCta")}</a>
        </div>
      </div>
    </section>
  `;

  initScrollReveal(el);
  initVideoTourBooking(el);
}
