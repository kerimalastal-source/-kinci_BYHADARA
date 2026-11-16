// "Send me the catalogue" on a project page: the visitor leaves a WhatsApp number (a name is
// optional) and gets the PDF right away. The number goes to the customers' records through
// POST /api/inquiry (kind "catalog", migration 0041) with the project and the visit's ad source,
// and the team is told on Telegram, so they can follow up on WhatsApp.
// If the records can't take it (offline, or before 0041 has been run) the visitor still gets the
// catalogue, with a WhatsApp button to reach the team instead.
// Once a visitor has asked, later project pages offer the download straight away.
import { t, link, getLocale } from "../i18n";
import { renderPhoneInput, getPhoneValue, isPhoneFilled, isPhoneValid, setPhoneInvalid } from "./phoneInput";
import { honeypotField, setSending } from "../utils/inquiry";
import { campaignSource } from "../utils/campaign";
import { trackLead } from "../utils/tracking";
import { escapeHtml } from "../utils/html";
import { WHATSAPP_ICON, WHATSAPP_NUMBER } from "./floatingButtons";
import { catalogFor } from "../data/catalogs";
import type { Project } from "../data/projects";

const ENDPOINT = "/api/inquiry";
const TIMEOUT_MS = 12_000;
const PHONE_ID = "cat-phone";
const UNLOCKED_KEY = "hadara-catalog";
const K = "projectDetail.catalog";

const PDF_ICON = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 11v6"/><path d="m9.5 14.5 2.5 2.5 2.5-2.5"/></svg>`;

function unlocked(): boolean {
  try {
    return localStorage.getItem(UNLOCKED_KEY) === "1";
  } catch {
    return false;
  }
}

function remember(): void {
  try {
    localStorage.setItem(UNLOCKED_KEY, "1");
  } catch {
    // Private mode: the form simply shows again on the next page.
  }
}

function doneHtml(project: Project, name: string, saved: boolean): string {
  const catalog = catalogFor(project.slug, getLocale());
  const whatsapp = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t(`${K}.whatsappMessage`, { name }))}`;
  return `
      <strong class="catalog-offer__done-title">${t(`${K}.doneTitle`)}</strong>
      <p>${t(saved ? `${K}.doneText` : `${K}.fallbackText`)}</p>
      <div class="catalog-offer__done-actions">
        <a class="btn btn--primary" href="${catalog.path}" target="_blank" rel="noopener" data-catalog-download><span>${t(`${K}.download`, { size: `<bdi dir="ltr">${catalog.sizeMb}</bdi>` })}</span></a>
        ${saved ? "" : `<a class="btn btn--whatsapp" href="${whatsapp}" target="_blank" rel="noopener">${WHATSAPP_ICON}${t(`${K}.fallbackButton`)}</a>`}
      </div>`;
}

export function renderCatalogOffer(project: Project, name: string): string {
  if (project.soldOut) return "";
  const catalog = catalogFor(project.slug, getLocale());
  const safeName = escapeHtml(name);
  const langNote = t(`${K}.langNote`);
  const open = unlocked();
  return `
          <section class="detail-block catalog-offer" id="project-catalog" aria-labelledby="catalog-offer-title">
            <div class="catalog-offer__card">
              <div class="catalog-offer__intro">
                <span class="catalog-offer__icon">${PDF_ICON}</span>
                <h2 class="catalog-offer__title" id="catalog-offer-title">${t(catalog.villa ? `${K}.titleVilla` : `${K}.titleAll`, { name: safeName })}</h2>
                <p class="catalog-offer__text">${t(catalog.villa ? `${K}.textVilla` : `${K}.textAll`, { name: safeName })}${langNote ? ` ${langNote}` : ""}</p>
              </div>
              <form class="contact-form catalog-offer__form" id="catalog-form" novalidate${open ? " hidden" : ""}>
                <div class="form-field">
                  <label for="${PHONE_ID}-number">${t(`${K}.phoneLabel`)}</label>
                  ${renderPhoneInput(PHONE_ID, "phone")}
                  <p class="form-field__error" data-error-for="phone"></p>
                </div>
                <div class="form-field">
                  <label for="cat-name">${t(`${K}.nameLabel`)}</label>
                  <input type="text" id="cat-name" name="name" maxlength="100" placeholder="${t(`${K}.namePlaceholder`)}" autocomplete="name" />
                </div>
                ${honeypotField()}
                <button type="submit" class="btn btn--primary catalog-offer__submit" id="catalog-submit">${t(`${K}.submit`)}</button>
                <p class="catalog-offer__note">${t(`${K}.privacy`, { href: link("/privacy") })}</p>
              </form>
              <div class="catalog-offer__done" id="catalog-done" role="status"${open ? "" : " hidden"}>${open ? doneHtml(project, safeName, true) : ""}</div>
            </div>
          </section>`;
}

export function initCatalogOffer(el: HTMLElement, project: Project, name: string): void {
  const form = el.querySelector<HTMLFormElement>("#catalog-form");
  const done = el.querySelector<HTMLElement>("#catalog-done");
  if (!form || !done) return;
  const submit = form.querySelector<HTMLButtonElement>("#catalog-submit");
  const error = form.querySelector<HTMLElement>('[data-error-for="phone"]')!;
  const openedAt = Date.now();
  let sending = false;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return;
    const message = !isPhoneFilled(form, PHONE_ID) ? t("contact.errors.phoneRequired") : isPhoneValid(form, PHONE_ID) ? "" : t("contact.errors.phoneInvalid");
    error.textContent = message;
    setPhoneInvalid(form, PHONE_ID, !!message);
    if (message) {
      form.querySelector<HTMLInputElement>(`#${PHONE_ID}-number`)?.focus();
      return;
    }

    const phone = getPhoneValue(form, PHONE_ID);
    const visitor = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    sending = true;
    setSending(submit, true);
    let saved = false;
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "catalog",
          name: visitor,
          phone,
          project: project.slug,
          locale: getLocale(),
          source: campaignSource() || null,
          page: window.location.pathname,
          website: form.querySelector<HTMLInputElement>("[data-inquiry-hp]")?.value ?? "",
          elapsedMs: Date.now() - openedAt
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      // 429: this number already asked several times today; it is in the records, so the catalogue is theirs.
      saved = res.status === 200 || res.status === 429;
    } catch {
      // Offline, blocked or too slow: the catalogue and a WhatsApp button below.
    }
    sending = false;
    setSending(submit, false);

    if (saved) remember();
    trackLead("catalog", project.slug, { phone, name: visitor });
    form.hidden = true;
    done.innerHTML = doneHtml(project, escapeHtml(name), saved);
    done.hidden = false;
    done.querySelector<HTMLElement>("[data-catalog-download]")?.focus();
  });
}
