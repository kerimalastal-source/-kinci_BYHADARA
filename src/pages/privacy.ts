import { t, tRaw } from "../i18n";

interface PrivacySection {
  title: string;
  paragraphs: string[];
  items?: string[];
  after?: string[];
}

export function renderPrivacy(el: HTMLElement): void {
  const sections = tRaw<PrivacySection[]>("privacy.sections");
  const paragraphs = (list: string[] = []) => list.map((p) => `<p>${p}</p>`).join("");

  el.innerHTML = `
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow eyebrow--on-dark">${t("privacy.heroEyebrow")}</p>
        <h1>${t("privacy.heroTitle")}</h1>
        <p class="page-hero__subtitle">${t("privacy.heroSubtitle")}</p>
      </div>
    </section>

    <section class="section legal">
      <div class="container narrow">
        <p class="legal__updated">${t("privacy.updated")}</p>
        ${sections
          .map(
            (section) => `
          <div class="legal__section">
            <h2>${section.title}</h2>
            ${paragraphs(section.paragraphs)}
            ${section.items ? `<ul class="legal__list">${section.items.map((item) => `<li>${item}</li>`).join("")}</ul>` : ""}
            ${paragraphs(section.after)}
          </div>`
          )
          .join("")}
      </div>
    </section>
  `;
}
