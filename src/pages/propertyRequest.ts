import { t } from "../i18n";
import { renderPropertyRequestForm, initPropertyRequestForm } from "../components/propertyRequestForm";

export function renderPropertyRequest(el: HTMLElement): void {
  el.innerHTML = `
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow eyebrow--on-dark">${t("propertyRequest.heroEyebrow")}</p>
        <h1>${t("propertyRequest.heroTitle")}</h1>
        <p class="page-hero__subtitle">${t("propertyRequest.heroSubtitle")}</p>
      </div>
    </section>

    <section class="section">
      <div class="container narrow">
        <h2>${t("propertyRequest.formTitle")}</h2>
        ${renderPropertyRequestForm()}
      </div>
    </section>
  `;

  initPropertyRequestForm(el);
}
