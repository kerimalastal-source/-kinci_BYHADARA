import { t, tRaw, link } from "../i18n";

interface StepItem {
  title: string;
  desc: string;
}

export function renderCitizenship(el: HTMLElement): void {
  const steps = tRaw<StepItem[]>("citizenship.steps");
  const benefits = tRaw<string[]>("citizenship.benefits");

  el.innerHTML = `
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow eyebrow--on-dark">${t("citizenship.heroEyebrow")}</p>
        <h1>${t("citizenship.heroTitle")}</h1>
        <p class="page-hero__subtitle">${t("citizenship.heroSubtitle")}</p>
      </div>
    </section>

    <section class="section">
      <div class="container narrow">
        <h2 class="section-title">${t("citizenship.introTitle")}</h2>
        <p class="lead-text">${t("citizenship.introText")}</p>
      </div>
    </section>

    <section class="section steps-section">
      <div class="container">
        <h2 class="section-title section-title--center">${t("citizenship.stepsTitle")}</h2>
        <ol class="steps-list">
          ${steps
            .map(
              (s, i) => `
            <li class="steps-list__item">
              <span class="steps-list__number">${i + 1}</span>
              <div>
                <h3>${s.title}</h3>
                <p>${s.desc}</p>
              </div>
            </li>`
            )
            .join("")}
        </ol>
      </div>
    </section>

    <section class="section benefits-section">
      <div class="container">
        <h2 class="section-title section-title--center">${t("citizenship.benefitsTitle")}</h2>
        <ul class="benefits-list">
          ${benefits
            .map(
              (b) => `
            <li>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>${b}</span>
            </li>`
            )
            .join("")}
        </ul>
      </div>
    </section>

    <section class="section final-cta">
      <div class="container final-cta__inner">
        <h2 class="section-title">${t("citizenship.ctaTitle")}</h2>
        <p>${t("citizenship.ctaText")}</p>
        <a class="btn btn--primary" href="${link("/contact")}">${t("citizenship.ctaButton")}</a>
      </div>
    </section>
  `;
}
