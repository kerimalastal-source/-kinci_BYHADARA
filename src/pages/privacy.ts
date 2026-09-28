import { t, tRaw, intlTag } from "../i18n";

interface PolicySection {
  title: string;
  paragraphs: string[];
  items: string[];
  /** Closing paragraphs after the list. */
  after?: string | string[];
}

/** When the policy text last changed; shown at the top of the page. */
const LAST_UPDATED = "2026-09-28";

const SITE_EMAIL = "info@byhadara.com";
const SITE_PHONE = "+90 531 930 92 14";
const SITE_PHONE_HREF = "+905319309214";

const CHECK =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';

/** The contact email inside policy text becomes a link. */
const linkEmail = (text: string) => text.replace(SITE_EMAIL, `<a href="mailto:${SITE_EMAIL}" dir="ltr">${SITE_EMAIL}</a>`);

export function renderPrivacy(el: HTMLElement): void {
  const sections = tRaw<PolicySection[]>("privacy.sections");
  const [y, m, d] = LAST_UPDATED.split("-").map(Number);
  const date = new Intl.DateTimeFormat(intlTag(), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    Date.UTC(y, m - 1, d)
  );

  el.innerHTML = `
    <section class="page-hero policy-hero">
      <div class="container">
        <p class="eyebrow eyebrow--on-dark">${t("privacy.heroEyebrow")}</p>
        <h1>${t("privacy.heroTitle")}</h1>
        <p class="page-hero__subtitle">${t("privacy.heroSubtitle")}</p>
        <p class="policy-updated">${t("privacy.updated", { date })}</p>
      </div>
    </section>

    <section class="section policy">
      <div class="container policy__layout">
        <nav class="policy__toc" aria-label="${t("privacy.tocTitle")}">
          <p class="policy__toc-title">${t("privacy.tocTitle")}</p>
          <ol>
            ${sections.map((s, i) => `<li><a href="#policy-${i + 1}">${s.title}</a></li>`).join("")}
          </ol>
        </nav>

        <div class="policy__body">
          ${sections
            .map(
              (s, i) => `
          <section class="policy__section" id="policy-${i + 1}">
            <h2><span class="policy__num" dir="ltr">${i + 1}</span>${s.title}</h2>
            ${s.paragraphs.map((p) => `<p>${linkEmail(p)}</p>`).join("")}
            ${s.items.length ? `<ul class="policy__list">${s.items.map((item) => `<li>${CHECK}<span>${item}</span></li>`).join("")}</ul>` : ""}
            ${[s.after ?? []].flat().map((p) => `<p>${linkEmail(p)}</p>`).join("")}
          </section>`
            )
            .join("")}

          <aside class="policy__contact">
            <h2>${t("privacy.contactTitle")}</h2>
            <p>${t("privacy.contactText")}</p>
            <ul>
              <li><a href="mailto:${SITE_EMAIL}" dir="ltr">${SITE_EMAIL}</a></li>
              <li><a href="tel:${SITE_PHONE_HREF}" dir="ltr">${SITE_PHONE}</a></li>
              <li>${t("contact.address")}</li>
            </ul>
          </aside>
        </div>
      </div>
    </section>
  `;
}
