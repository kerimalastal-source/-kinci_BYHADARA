import { t, tRaw, link, listSep } from "../i18n";
import { renderPropertyRequestForm, initPropertyRequestForm } from "../components/propertyRequestForm";
import { initScrollReveal } from "../components/scrollReveal";
import { WHATSAPP_ICON, WHATSAPP_NUMBER } from "../components/floatingButtons";
import { heroBackground, photoAttrs } from "../utils/responsiveImage";

interface TextItem {
  title: string;
  text: string;
}

const HERO_PHOTO = { src: "/images/projects/lotus-yali/sunset-aerial.jpg", width: 1781 };
const CARD_PHOTO = { src: "/images/projects/beylikduzu-living/living-room-2.jpg", width: 1191 };

const svg = (body: string, size = 22) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const CHECK = svg('<path d="m5 12 5 5 9-10"/>', 16);
const SEARCH = svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', 16);
const ARROW = svg('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>', 16);
const TOUR_ICON = svg('<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>', 20);

/** Icons of the four "How it works" steps. */
const HOW_ICONS = [
  svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>'),
  svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  svg('<rect x="3" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/><rect x="3" y="13" width="8" height="7" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/>'),
  svg('<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l2 2M15 8l2 2"/>')
];

/** Icons of the three "Why HADARA" cards. */
const WHY_ICONS = [
  svg('<path d="M3 21h18"/><path d="M5 21V9l5-3v15"/><path d="M10 21V4h9v17"/><path d="M13 8h3M13 12h3M13 16h3"/>'),
  svg('<path d="M9 12l2 2 4-4"/><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/>'),
  svg('<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>')
];

/** Where the "Not sure yet?" links go. */
const UNSURE_LINKS: [key: string, href: () => string][] = [
  ["match", () => `${link("/")}#find-my-project`],
  ["guide", () => link("/buyers-guide")],
  ["tour", () => link("/video-tour")]
];

/** Keeps a price range in reading order inside Arabic or Persian text. */
function isolateRange(text: string): string {
  if (!/[\u0600-\u06FF]/.test(text)) return `<bdi dir="ltr">${text}</bdi>`;
  return text.replace(/\d[\d,.]*\s*[-–]\s*\d[\d,.]*/, (m) => `<bdi dir="ltr">${m}</bdi>`);
}

const plain = (key: string) => t(key).replace(/\s*\*$/, "");

/** A sample request card in the hero, built from the form's own labels and options. */
function heroVisual(): string {
  const rows: [string, string][] = [
    [plain("propertyRequest.propertyTypeLabel"), t("propertyRequest.propertyTypes.3-1")],
    [plain("propertyRequest.districtLabel"), `${t("places.beylikduzu")}${listSep()}${t("places.istanbul")}`],
    [plain("propertyRequest.budgetLabel"), isolateRange(t("propertyRequest.budgets.300-350"))],
    [plain("propertyRequest.floorLabel"), t("propertyRequest.floors.high")]
  ];
  return `
      <div class="req-hero__visual" aria-hidden="true">
        <div class="req-card">
          <div class="req-card__media">
            <img ${photoAttrs(CARD_PHOTO, "(max-width: 900px) 90vw, 420px")} alt="" width="1191" height="670" fetchpriority="high" />
          </div>
          <div class="req-card__body">
            <p class="req-card__title">${t("propertyRequest.mock.title")}</p>
            <dl class="req-card__rows">
              ${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}
            </dl>
            <span class="req-card__status"><span class="req-card__pulse"></span>${SEARCH}${t("propertyRequest.mock.status")}</span>
          </div>
        </div>
      </div>`;
}

export function renderPropertyRequest(el: HTMLElement): void {
  const trust = tRaw<string[]>("propertyRequest.trust");
  const how = tRaw<TextItem[]>("propertyRequest.how");
  const why = tRaw<TextItem[]>("propertyRequest.why");
  const aside = tRaw<string[]>("propertyRequest.aside");
  const whatsapp = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t("propertyRequest.whatsappMessage"))}`;

  el.innerHTML = `
    <section class="page-hero req-hero" style="${heroBackground(HERO_PHOTO, "linear-gradient(180deg, rgba(10,30,23,.7), rgba(10,30,23,.9))")}">
      <div class="container req-hero__inner">
        <div class="req-hero__text">
          <p class="eyebrow eyebrow--on-dark">${t("propertyRequest.heroEyebrow")}</p>
          <h1>${t("propertyRequest.heroTitle")}</h1>
          <p class="page-hero__subtitle">${t("propertyRequest.heroSubtitle")}</p>
          <div class="req-hero__actions">
            <a class="btn btn--primary" href="#request">${t("propertyRequest.heroCta")}</a>
            <a class="btn btn--ghost" href="${whatsapp}" target="_blank" rel="noopener">${WHATSAPP_ICON}${t("propertyRequest.heroWhatsapp")}</a>
          </div>
          <ul class="req-trust">
            ${trust.map((item) => `<li>${CHECK}<span>${item}</span></li>`).join("")}
          </ul>
        </div>
        ${heroVisual()}
      </div>
    </section>

    <section class="section req-how">
      <div class="container">
        <p class="eyebrow">${t("propertyRequest.howEyebrow")}</p>
        <h2 class="section-title">${t("propertyRequest.howTitle")}</h2>
        <ol class="req-how__list">
          ${how
            .map(
              (s, i) => `
          <li class="req-how__item" data-reveal data-reveal-index="${i}">
            <span class="req-how__icon">${HOW_ICONS[i] ?? ""}</span>
            <span class="req-how__num">0${i + 1}</span>
            <h3>${s.title}</h3>
            <p>${s.text}</p>
          </li>`
            )
            .join("")}
        </ol>
      </div>
    </section>

    <section class="section req-form-section" id="request">
      <div class="container req-layout">
        <div class="req-form-card">
          <h2 class="section-title">${t("propertyRequest.formTitle")}</h2>
          ${renderPropertyRequestForm()}
        </div>

        <aside class="req-aside">
          <div class="req-aside__card">
            <h3>${t("propertyRequest.asideTitle")}</h3>
            <ol class="req-aside__steps">
              ${aside.map((item, i) => `<li><span dir="ltr">${i + 1}</span><p>${item}</p></li>`).join("")}
            </ol>
          </div>
          <div class="req-aside__card req-aside__card--whatsapp">
            <h3>${t("propertyRequest.asideWhatsappTitle")}</h3>
            <a class="btn btn--whatsapp" href="${whatsapp}" target="_blank" rel="noopener">${WHATSAPP_ICON}${t("propertyRequest.asideWhatsapp")}</a>
          </div>
          <div class="req-aside__card">
            <h3>${t("propertyRequest.unsureTitle")}</h3>
            <ul class="req-aside__links">
              ${UNSURE_LINKS.map(([key, href]) => `<li><a href="${href()}"><span>${t(`propertyRequest.unsure.${key}`)}</span>${ARROW}</a></li>`).join("")}
            </ul>
          </div>
        </aside>
      </div>
    </section>

    <section class="section req-why">
      <div class="container">
        <p class="eyebrow">${t("propertyRequest.whyEyebrow")}</p>
        <h2 class="section-title">${t("propertyRequest.whyTitle")}</h2>
        <div class="req-why__grid">
          ${why
            .map(
              (w, i) => `
          <div class="req-why__card" data-reveal data-reveal-index="${i}">
            <span class="req-why__icon">${WHY_ICONS[i] ?? ""}</span>
            <h3>${w.title}</h3>
            <p>${w.text}</p>
          </div>`
            )
            .join("")}
        </div>
      </div>
    </section>

    <section class="section final-cta">
      <div class="container final-cta__inner">
        <div class="cz-cta__text">
          <h2 class="section-title">${t("propertyRequest.ctaTitle")}</h2>
          <p>${t("propertyRequest.ctaText")}</p>
        </div>
        <div class="cz-cta__actions req-cta__actions">
          <a class="btn btn--primary" href="${whatsapp}" target="_blank" rel="noopener">${WHATSAPP_ICON}${t("propertyRequest.ctaWhatsapp")}</a>
          <a class="btn btn--ghost" href="${link("/video-tour")}">${TOUR_ICON}${t("propertyRequest.ctaTour")}</a>
        </div>
      </div>
    </section>
  `;

  initPropertyRequestForm(el);
  initScrollReveal(el);
}
