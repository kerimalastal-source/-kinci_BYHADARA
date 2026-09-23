import { t } from "../i18n";
import { renderContactForm, initContactForm } from "../components/contactForm";

const SITE_PHONE = "+90 531 930 92 14";
const SITE_PHONE_HREF = "+905319309214";
const SITE_EMAIL = "info@byhadara.com";
const MAP_EMBED_SRC =
  "https://www.openstreetmap.org/export/embed.html?bbox=28.6033%2C40.9633%2C28.6633%2C41.0033&layer=mapnik&marker=40.9833%2C28.6333";

export function renderContact(el: HTMLElement): void {
  el.innerHTML = `
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow eyebrow--on-dark">${t("contact.heroEyebrow")}</p>
        <h1>${t("contact.heroTitle")}</h1>
        <p class="page-hero__subtitle">${t("contact.heroSubtitle")}</p>
      </div>
    </section>

    <section class="section contact-section">
      <div class="container contact-section__grid">
        <div class="contact-section__form-col">
          <h2>${t("contact.formTitle")}</h2>
          ${renderContactForm()}
        </div>

        <div class="contact-section__info-col">
          <h2>${t("contact.infoTitle")}</h2>
          <ul class="info-list">
            <li>
              <span class="info-list__label">${t("contact.addressTitle")}</span>
              <span>${t("contact.address")}</span>
            </li>
            <li>
              <span class="info-list__label">${t("contact.phoneTitle")}</span>
              <a dir="ltr" href="tel:${SITE_PHONE_HREF}">${SITE_PHONE}</a>
            </li>
            <li>
              <span class="info-list__label">${t("contact.emailTitle")}</span>
              <a dir="ltr" href="mailto:${SITE_EMAIL}">${SITE_EMAIL}</a>
            </li>
            <li>
              <span class="info-list__label">${t("contact.hoursTitle")}</span>
              <span>${t("contact.hoursText")}</span>
            </li>
          </ul>

          <h3>${t("contact.mapTitle")}</h3>
          <div class="map-embed">
            <iframe
              src="${MAP_EMBED_SRC}"
              title="${t("contact.mapTitle")}"
              loading="lazy"
              referrerpolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        </div>
      </div>
    </section>
  `;

  initContactForm(el);
}
