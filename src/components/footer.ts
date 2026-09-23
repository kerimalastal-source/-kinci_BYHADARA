import { t } from "../i18n";

const SITE_PHONE = "+90 531 930 92 14";
const SITE_PHONE_HREF = "+905319309214";
const SITE_EMAIL = "info@byhadara.com";

export function renderFooter(el: HTMLElement): void {
  el.className = "site-footer";
  el.innerHTML = `
    <div class="container site-footer__inner">
      <div class="site-footer__brand">
        <a class="brand" href="#/" aria-label="${t("meta.siteNameFull")}">
          <img class="brand__logo brand__logo--footer" src="/logo-light.png" alt="${t("meta.siteNameFull")}" />
          <span class="brand__text">
            <span class="brand__name">${t("meta.siteName")}</span>
            <span class="brand__tagline">${t("meta.tagline")}</span>
          </span>
        </a>
        <p class="site-footer__desc">${t("footer.description")}</p>
        <div class="social-links" aria-label="${t("footer.followUs")}">
          <a href="https://www.instagram.com" target="_blank" rel="noopener" aria-label="Instagram">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1"></circle></svg>
          </a>
          <a href="https://www.facebook.com" target="_blank" rel="noopener" aria-label="Facebook">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
          </a>
          <a href="https://www.linkedin.com" target="_blank" rel="noopener" aria-label="LinkedIn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
          </a>
        </div>
      </div>

      <div class="site-footer__col">
        <h3>${t("footer.quickLinks")}</h3>
        <ul>
          <li><a href="#/">${t("nav.home")}</a></li>
          <li><a href="#/projects">${t("nav.projects")}</a></li>
          <li><a href="#/about">${t("nav.about")}</a></li>
          <li><a href="#/citizenship">${t("nav.citizenship")}</a></li>
          <li><a href="#/contact">${t("nav.contact")}</a></li>
        </ul>
      </div>

      <div class="site-footer__col">
        <h3>${t("footer.getInTouch")}</h3>
        <ul class="footer-contact">
          <li>${t("contact.address")}</li>
          <li><a dir="ltr" href="tel:${SITE_PHONE_HREF}">${SITE_PHONE}</a></li>
          <li><a dir="ltr" href="mailto:${SITE_EMAIL}">${SITE_EMAIL}</a></li>
        </ul>
      </div>
    </div>
    <div class="site-footer__bottom container">
      <p>&copy; ${new Date().getFullYear()} ${t("meta.siteNameFull")}. ${t("footer.rights")}</p>
    </div>
  `;
}
