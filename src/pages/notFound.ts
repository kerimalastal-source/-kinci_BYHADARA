import { t } from "../i18n";

export function renderNotFound(el: HTMLElement): void {
  el.innerHTML = `
    <section class="section not-found">
      <div class="container not-found__inner">
        <h1>404</h1>
        <h2>${t("notFound.title")}</h2>
        <p>${t("notFound.text")}</p>
        <a class="btn btn--primary" href="#/">${t("notFound.button")}</a>
      </div>
    </section>
  `;
}
