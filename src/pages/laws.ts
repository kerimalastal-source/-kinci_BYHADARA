import { t, tRaw, link, intlTag } from "../i18n";
import {
  LAW_TOPICS,
  lawRules,
  lawUpdates,
  sortedLawUpdates,
  visibleLawItems,
  type LawSource,
  type LawTopic,
  type LawUpdate
} from "../data/laws";
import { WHATSAPP_NUMBER, WHATSAPP_ICON } from "../components/floatingButtons";
import { initScrollReveal } from "../components/scrollReveal";

interface RuleText {
  title: string;
  text: string;
}
interface UpdateText {
  title: string;
  summary: string;
  before?: string;
  after: string;
  affects: string;
  help: string;
}

const EXTERNAL =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>';
const SHIELD =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>';

/** Turkish/Latin terms in parentheses keep their direction inside Arabic and Persian text. */
export const iso = (text: string) => text.replace(/\(([^()]*[A-Za-z][^()]*)\)/g, '(<bdi dir="ltr">$1</bdi>)');

/** Drafts are visible only with ?preview (for the owner's review). */
function isPreview(): boolean {
  return new URLSearchParams(location.search).has("preview");
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(intlTag(), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, d));
}

/** Official-source links: the publisher's translated name + the link. */
export function sourceLinks(sources: LawSource[]): string {
  return `
            <p class="law-sources">
              <span class="law-sources__label">${t("laws.officialSource")}</span>
              ${sources
                .map(
                  (s) =>
                    `<a class="law-source" href="${s.url}" target="_blank" rel="noopener noreferrer"><span>${iso(t(`laws.sources.${s.key}`))}</span>${EXTERNAL}</a>`
                )
                .join("")}
            </p>`;
}

export const topicBadge = (topic: LawTopic) => `<span class="law-topic law-topic--${topic}">${t(`laws.topics.${topic}`)}</span>`;
const draftBadge = (approved: boolean) => (approved ? "" : `<span class="law-draft">${t("laws.draft")}</span>`);

function updateCard(u: LawUpdate, i: number): string {
  const text = tRaw<UpdateText>(`lawsData.updates.${u.id}`);
  const rows: [string, string][] = [];
  if (text.before) rows.push([t("laws.before"), text.before]);
  rows.push([text.before ? t("laws.after") : t("laws.whatChanged"), text.after]);

  return `
        <li class="law-update" data-topic="${u.topic}" data-reveal data-reveal-index="${i % 3}">
          <div class="law-update__date">
            <time datetime="${u.decided}">${formatDate(u.decided)}</time>
          </div>
          <article class="law-update__card">
            <div class="law-update__badges">
              ${topicBadge(u.topic)}
              ${u.stage === "proposal" ? `<span class="law-stage">${t("laws.proposal")}</span>` : ""}
              ${draftBadge(u.approved)}
            </div>
            <h3>${iso(text.title)}</h3>
            <p class="law-update__summary">${iso(text.summary)}</p>
            <dl class="law-compare${rows.length > 1 ? " law-compare--two" : ""}">
              ${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${iso(value)}</dd></div>`).join("")}
            </dl>
            <dl class="law-facts">
              <div><dt>${t("laws.affects")}</dt><dd>${text.affects}</dd></div>
              ${u.effective ? `<div><dt>${t("laws.effective")}</dt><dd>${formatDate(u.effective)}</dd></div>` : ""}
              <div><dt>${t("laws.reference")}</dt><dd><bdi lang="tr" dir="ltr">${u.reference}</bdi></dd></div>
            </dl>
            <p class="law-help"><strong>${t("laws.howWeHelp")}</strong> ${iso(text.help)}</p>
            ${sourceLinks(u.sources)}
            <p class="law-checked">${t("laws.checked", { date: formatDate(u.checked) })}</p>
          </article>
        </li>`;
}

export function renderLaws(el: HTMLElement): void {
  const preview = isPreview();
  const rules = visibleLawItems(lawRules, preview);
  const updates = sortedLawUpdates(visibleLawItems(lawUpdates, preview));
  const topics = LAW_TOPICS.filter((topic) => updates.some((u) => u.topic === topic));
  const latest = [...rules, ...updates].map((i) => i.checked).sort().pop();
  const whatsapp = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t("laws.whatsappMessage"))}`;

  el.innerHTML = `
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow eyebrow--on-dark">${t("laws.heroEyebrow")}</p>
        <h1>${t("laws.heroTitle")}</h1>
        <p class="page-hero__subtitle">${t("laws.heroSubtitle")}</p>
      </div>
    </section>

    <section class="section laws-intro">
      <div class="container">
        ${preview ? `<p class="law-preview-note">${t("laws.previewNote")}</p>` : ""}
        <div class="law-promise">
          <span class="law-promise__icon">${SHIELD}</span>
          <div>
            <p><strong>${t("laws.promiseTitle")}</strong> ${t("laws.promiseText")}</p>
            <p class="law-promise__disclaimer">${t("laws.disclaimer")}</p>
            ${latest ? `<p class="law-promise__updated">${t("laws.updated", { date: formatDate(latest) })}</p>` : ""}
          </div>
        </div>
      </div>
    </section>

    ${
      rules.length
        ? `
    <section class="section laws-rules">
      <div class="container">
        <h2 class="section-title section-title--center">${t("laws.rulesTitle")}</h2>
        <p class="section-subtitle section-subtitle--center">${t("laws.rulesSubtitle")}</p>
        <ul class="law-rules">
          ${rules
            .map((r, i) => {
              const text = tRaw<RuleText>(`lawsData.rules.${r.id}`);
              return `
          <li class="law-rule" data-reveal data-reveal-index="${i % 3}">
            <div class="law-update__badges">${topicBadge(r.topic)}${draftBadge(r.approved)}</div>
            <h3>${iso(text.title)}</h3>
            <p>${iso(text.text)}</p>
            ${sourceLinks(r.sources)}
            <p class="law-checked">${t("laws.checked", { date: formatDate(r.checked) })}</p>
          </li>`;
            })
            .join("")}
        </ul>
      </div>
    </section>`
        : ""
    }

    <section class="section laws-updates">
      <div class="container">
        <h2 class="section-title section-title--center">${t("laws.updatesTitle")}</h2>
        <p class="section-subtitle section-subtitle--center">${t("laws.updatesSubtitle")}</p>
        ${
          updates.length
            ? `
        <div class="filter-bar law-filter" id="law-filter" role="group" aria-label="${t("laws.filterLabel")}">
          <button type="button" class="filter-chip is-active" data-topic="all" aria-pressed="true">${t("laws.filterAll")}</button>
          ${topics
            .map((topic) => `<button type="button" class="filter-chip" data-topic="${topic}" aria-pressed="false">${t(`laws.topics.${topic}`)}</button>`)
            .join("")}
        </div>
        <ol class="law-timeline" id="law-timeline">
          ${updates.map(updateCard).join("")}
        </ol>`
            : `<p class="law-empty">${t("laws.empty")}</p>`
        }
      </div>
    </section>

    <section class="section final-cta">
      <div class="container final-cta__inner">
        <div class="cz-cta__text">
          <h2 class="section-title">${t("laws.ctaTitle")}</h2>
          <p>${t("laws.ctaText")}</p>
        </div>
        <div class="cz-cta__actions">
          <a class="btn btn--primary" href="${link("/contact")}">${t("laws.ctaButton")}</a>
          <a class="btn btn--ghost" href="${whatsapp}" target="_blank" rel="noopener noreferrer">${WHATSAPP_ICON} ${t("laws.ctaWhatsapp")}</a>
        </div>
      </div>
    </section>
  `;

  const filter = el.querySelector<HTMLElement>("#law-filter");
  filter?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".filter-chip");
    if (!btn) return;
    const topic = btn.dataset.topic;
    filter.querySelectorAll<HTMLButtonElement>(".filter-chip").forEach((c) => {
      c.classList.toggle("is-active", c === btn);
      c.setAttribute("aria-pressed", String(c === btn));
    });
    el.querySelectorAll<HTMLElement>(".law-update").forEach((item) => {
      item.hidden = topic !== "all" && item.dataset.topic !== topic;
    });
  });

  initScrollReveal(el);
}
