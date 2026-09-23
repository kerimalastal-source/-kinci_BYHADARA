import { t, tRaw } from "../i18n";

interface FaqItem {
  q: string;
  a: string;
}
interface FaqCategory {
  title: string;
  items: FaqItem[];
}

export function renderFaq(el: HTMLElement): void {
  const categories = tRaw<FaqCategory[]>("faq.categories");

  el.innerHTML = `
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow eyebrow--on-dark">${t("faq.heroEyebrow")}</p>
        <h1>${t("faq.heroTitle")}</h1>
        <p class="page-hero__subtitle">${t("faq.heroSubtitle")}</p>
      </div>
    </section>

    <section class="section faq-section">
      <div class="container narrow">
        ${categories
          .map(
            (category) => `
          <div class="faq-category">
            <h2 class="faq-category__title">${category.title}</h2>
            <div class="faq-list">
              ${category.items
                .map(
                  (item) => `
                <details class="faq-item">
                  <summary class="faq-item__question">
                    <span>${item.q}</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </summary>
                  <p class="faq-item__answer">${item.a}</p>
                </details>`
                )
                .join("")}
            </div>
          </div>`
          )
          .join("")}
      </div>
    </section>
  `;
}
