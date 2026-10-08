import { t, tRaw, link } from "../i18n";
import { statIcon } from "../components/statIcons";
import { initScrollReveal } from "../components/scrollReveal";
import { LAWS_PAGE_LIVE, lawUpdates, sortedLawUpdates, visibleLawItems, type LawTopic } from "../data/laws";
import { formatDate, iso, sourceLinks, topicBadge } from "./laws";

interface TextItem {
  title: string;
  desc: string;
}
interface FigureItem {
  value: string;
  label: string;
}
interface RouteItem extends TextItem {
  value: string;
}
interface FaqCategory {
  title: string;
  items: { q: string; a: string }[];
}

/** Icons, in the order of `citizenship.facts` / `citizenship.requirements` / `citizenship.costs` / `citizenship.residence`. */
const FACT_ICONS = ["money", "holding", "family", "globe"];
const REQUIREMENT_ICONS = ["money", "report", "bank", "holding", "certificate", "constructionArea"];
const COST_ICONS = ["certificate", "report", "timeline", "bank", "family"];
const RESIDENCE_ICONS = ["money", "timeline", "family", "districts"];
/** `faq.categories` index of the Turkish citizenship questions (shared with the FAQ page). */
const CITIZENSHIP_FAQ = 2;

const CHECK =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';
const CHEVRON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';

const reveal = (i: number, perRow = 3) => `data-reveal data-reveal-index="${i % perRow}"`;

function head(title: string, subtitle?: string): string {
  return `
        <h2 class="section-title section-title--center">${title}</h2>
        ${subtitle ? `<p class="section-subtitle section-subtitle--center">${subtitle}</p>` : ""}`;
}

/** Icon + title + text cards (requirements, costs, residence). */
function infoCards(items: TextItem[], icons: string[], modifier = ""): string {
  return `
        <ul class="cz-cards${modifier ? ` cz-cards--${modifier}` : ""}">
          ${items
            .map(
              (item, i) => `
          <li class="cz-card" ${reveal(i)}>
            <span class="cz-card__icon">${statIcon(icons[i] ?? "")}</span>
            <h3>${item.title}</h3>
            <p>${item.desc}</p>
          </li>`
            )
            .join("")}
        </ul>`;
}

/** Topics from the Property Laws page that matter to a citizenship / residence buyer. */
const LAW_BOX_TOPICS: LawTopic[] = ["citizenship", "residence", "ownership"];

/** "Latest legal updates": the 3 newest approved updates on those topics, each with its official source. */
function latestLaws(): string {
  if (!LAWS_PAGE_LIVE) return "";
  const updates = sortedLawUpdates(visibleLawItems(lawUpdates, false))
    .filter((u) => LAW_BOX_TOPICS.includes(u.topic))
    .slice(0, 3);
  if (!updates.length) return "";
  return `
    <section class="section cz-laws">
      <div class="container">
        <p class="eyebrow eyebrow--center">${t("citizenship.lawsEyebrow")}</p>
        ${head(t("citizenship.lawsTitle"), t("citizenship.lawsSubtitle"))}
        <ul class="cz-laws__list">
          ${updates
            .map((u, i) => {
              const text = tRaw<{ title: string; summary: string }>(`lawsData.updates.${u.id}`);
              return `
          <li class="cz-law" ${reveal(i)}>
            <div class="cz-law__top">
              <time datetime="${u.decided}">${formatDate(u.decided)}</time>
              ${topicBadge(u.topic)}
            </div>
            <h3>${iso(text.title)}</h3>
            <p class="cz-law__summary">${iso(text.summary)}</p>
            ${sourceLinks(u.sources)}
            <p class="law-checked">${t("laws.checked", { date: formatDate(u.checked) })}</p>
          </li>`;
            })
            .join("")}
        </ul>
        <div class="cz-laws__foot">
          <p>${t("laws.disclaimer")}</p>
          <a class="btn btn--outline" href="${link("/property-laws")}">${t("citizenship.lawsMore")}</a>
        </div>
      </div>
    </section>`;
}

export function renderCitizenship(el: HTMLElement): void {
  const facts = tRaw<FigureItem[]>("citizenship.facts");
  const requirements = tRaw<TextItem[]>("citizenship.requirements");
  const steps = tRaw<TextItem[]>("citizenship.steps");
  const documents = tRaw<string[]>("citizenship.documents");
  const costs = tRaw<TextItem[]>("citizenship.costs");
  const routes = tRaw<RouteItem[]>("citizenship.routes");
  const residence = tRaw<TextItem[]>("citizenship.residence");
  const benefits = tRaw<string[]>("citizenship.benefits");
  const faq = tRaw<FaqCategory[]>("faq.categories")[CITIZENSHIP_FAQ]?.items ?? [];

  el.innerHTML = `
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow eyebrow--on-dark">${t("citizenship.heroEyebrow")}</p>
        <h1>${t("citizenship.heroTitle")}</h1>
        <p class="page-hero__subtitle">${t("citizenship.heroSubtitle")}</p>
      </div>
    </section>

    <section class="cz-facts" aria-label="${t("citizenship.factsLabel")}">
      <div class="container">
        <dl class="cz-facts__grid">
          ${facts
            .map(
              (f, i) => `
          <div class="cz-fact" ${reveal(i, 4)}>
            <span class="cz-fact__icon">${statIcon(FACT_ICONS[i] ?? "")}</span>
            <dt>${f.label}</dt>
            <dd>${f.value}</dd>
          </div>`
            )
            .join("")}
        </dl>
      </div>
    </section>

    <section class="section">
      <div class="container narrow">
        <h2 class="section-title">${t("citizenship.introTitle")}</h2>
        <p class="lead-text">${t("citizenship.introText")}</p>
        <p>${t("citizenship.introText2")}</p>
      </div>
    </section>

    <section class="section cz-section--alt">
      <div class="container">
        ${head(t("citizenship.requirementsTitle"), t("citizenship.requirementsSubtitle"))}
        ${infoCards(requirements, REQUIREMENT_ICONS)}
        <p class="cz-note">${t("citizenship.rulesNote")}</p>
      </div>
    </section>

    <section class="section steps-section">
      <div class="container">
        ${head(t("citizenship.stepsTitle"), t("citizenship.stepsSubtitle"))}
        <ol class="steps-list steps-list--timeline">
          ${steps
            .map(
              (s, i) => `
            <li class="steps-list__item" ${reveal(i, 4)}>
              <span class="steps-list__number">${i + 1}</span>
              <div>
                <h3>${s.title}</h3>
                <p>${s.desc}</p>
              </div>
            </li>`
            )
            .join("")}
        </ol>
        <p class="cz-note">${t("citizenship.stepsNote")}</p>
      </div>
    </section>

    <section class="section cz-section--alt">
      <div class="container cz-split">
        <div class="cz-split__col">
          <h2 class="section-title">${t("citizenship.documentsTitle")}</h2>
          <p class="section-subtitle">${t("citizenship.documentsSubtitle")}</p>
          <ul class="cz-checklist">
            ${documents.map((d) => `<li>${CHECK}<span>${d}</span></li>`).join("")}
          </ul>
          <p class="cz-note cz-note--start">${t("citizenship.documentsNote")}</p>
        </div>
        <div class="cz-split__col">
          <h2 class="section-title">${t("citizenship.costsTitle")}</h2>
          <p class="section-subtitle">${t("citizenship.costsSubtitle")}</p>
          <ul class="cz-costs">
            ${costs
              .map(
                (c, i) => `
            <li>
              <span class="cz-card__icon">${statIcon(COST_ICONS[i] ?? "")}</span>
              <div>
                <h3>${c.title}</h3>
                <p>${c.desc}</p>
              </div>
            </li>`
              )
              .join("")}
          </ul>
        </div>
      </div>
    </section>

    <section class="section cz-residence-section">
      <div class="container">
        <div class="cz-residence">
          <div class="cz-residence__intro">
            <p class="eyebrow">${t("citizenship.residenceEyebrow")}</p>
            <h2 class="section-title">${t("citizenship.residenceTitle")}</h2>
            <p>${t("citizenship.residenceText")}</p>
            <a class="btn btn--primary" href="${link("/contact?interest=residence")}">${t("citizenship.residenceCta")}</a>
          </div>
          ${infoCards(residence, RESIDENCE_ICONS, "compact")}
        </div>
      </div>
    </section>

    <section class="section cz-section--alt">
      <div class="container">
        ${head(t("citizenship.routesTitle"), t("citizenship.routesSubtitle"))}
        <ul class="cz-routes">
          ${routes
            .map(
              (r, i) => `
          <li class="cz-route" ${reveal(i, 5)}>
            <strong class="cz-route__value">${r.value}</strong>
            <h3>${r.title}</h3>
            <p>${r.desc}</p>
          </li>`
            )
            .join("")}
        </ul>
        <p class="cz-note">${t("citizenship.routesNote")}</p>
      </div>
    </section>

    <section class="section benefits-section">
      <div class="container">
        ${head(t("citizenship.benefitsTitle"))}
        <ul class="benefits-list">
          ${benefits.map((b) => `<li>${CHECK}<span>${b}</span></li>`).join("")}
        </ul>
      </div>
    </section>

    ${
      faq.length
        ? `<section class="section cz-section--alt">
      <div class="container narrow">
        ${head(t("citizenship.faqTitle"))}
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
        <p class="cz-more"><a href="${link("/faq")}">${t("citizenship.faqMore")}</a></p>
      </div>
    </section>`
        : ""
    }

    ${latestLaws()}

    <section class="section final-cta">
      <div class="container final-cta__inner">
        <div class="cz-cta__text">
          <h2 class="section-title">${t("citizenship.ctaTitle")}</h2>
          <p>${t("citizenship.ctaText")}</p>
        </div>
        <div class="cz-cta__actions">
          <a class="btn btn--primary" href="${link("/contact?interest=citizenship")}">${t("citizenship.ctaButton")}</a>
          <a class="btn btn--ghost" href="${link("/projects")}">${t("citizenship.ctaSecondary")}</a>
        </div>
      </div>
    </section>
  `;

  initScrollReveal(el);
}
