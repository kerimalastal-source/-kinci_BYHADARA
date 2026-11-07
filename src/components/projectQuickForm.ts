// The small "Interested? Get in touch" form at the very end of every project page:
// name, email and phone. It goes to the inquiries inbox (POST /api/inquiry) as a contact
// message with details.form = "project" and the page's project, so the team's email and
// Telegram alert say which project page it came from, and the visitor gets a
// "we received your request" email. If the inbox can't take it, the visitor's email app
// opens with the same details (as on the other forms). The project's name is sent in the
// page's language; the server puts the Arabic one in the team's alert (api/_lib/projectNames.ts).
import { t, link } from "../i18n";
import { renderPhoneInput, getPhoneValue, isPhoneFilled, isPhoneValid, setPhoneInvalid } from "./phoneInput";
import { honeypotField, sendInquiry, setSending, showLimit, showMailtoSent } from "../utils/inquiry";
import { trackLead } from "../utils/tracking";
import { escapeHtml } from "../utils/html";
import type { Project } from "../data/projects";

const CONTACT_EMAIL = "info@byhadara.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ID = "pq-phone";

export function renderProjectQuickForm(name: string): string {
  return `
    <section class="section project-quick" id="project-inquiry" aria-labelledby="project-quick-title">
      <div class="container">
        <div class="project-quick__card">
          <div class="project-quick__intro">
            <p class="eyebrow">${t("projectDetail.quickForm.eyebrow")}</p>
            <h2 class="project-quick__title" id="project-quick-title">${t("projectDetail.quickForm.title", { name: escapeHtml(name) })}</h2>
            <p class="project-quick__text">${t("projectDetail.quickForm.text")}</p>
          </div>
          <form class="contact-form project-quick__form" id="project-quick-form" novalidate>
            <div class="form-field">
              <label for="pq-name">${t("contact.nameLabel")}</label>
              <input type="text" id="pq-name" name="name" placeholder="${t("contact.namePlaceholder")}" autocomplete="name" />
              <p class="form-field__error" data-error-for="name"></p>
            </div>
            <div class="form-field">
              <label for="pq-email">${t("contact.emailLabel")}</label>
              <input dir="ltr" type="email" id="pq-email" name="email" placeholder="${t("contact.emailPlaceholder")}" autocomplete="email" />
              <p class="form-field__error" data-error-for="email"></p>
            </div>
            <div class="form-field">
              <label for="${PHONE_ID}-number">${t("contact.phoneLabel")}</label>
              ${renderPhoneInput(PHONE_ID, "phone")}
              <p class="form-field__error" data-error-for="phone"></p>
            </div>
            ${honeypotField()}
            <button type="submit" class="btn btn--primary project-quick__submit" id="pq-submit">${t("projectDetail.quickForm.submit")}</button>
            <p class="project-quick__note">${t("projectDetail.quickForm.privacy", { href: link("/privacy") })}</p>
            <div class="contact-form__success project-quick__success" id="pq-success" role="status" hidden>
              <strong>${t("contact.successTitle")}</strong>
              <p>${t("contact.successText")}</p>
            </div>
          </form>
        </div>
      </div>
    </section>`;
}

function setError(form: HTMLFormElement, field: string, message: string): void {
  const errorEl = form.querySelector<HTMLElement>(`[data-error-for="${field}"]`);
  const input = form.querySelector<HTMLElement>(`[name="${field}"]`);
  if (errorEl) errorEl.textContent = message;
  if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
}

function validate(form: HTMLFormElement): boolean {
  const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value.trim();
  setError(form, "name", value("name") ? "" : t("contact.errors.nameRequired"));
  setError(form, "email", !value("email") ? t("contact.errors.emailRequired") : EMAIL_RE.test(value("email")) ? "" : t("contact.errors.emailInvalid"));
  const phoneError = !isPhoneFilled(form, PHONE_ID) ? t("contact.errors.phoneRequired") : isPhoneValid(form, PHONE_ID) ? "" : t("contact.errors.phoneInvalid");
  setError(form, "phone", phoneError);
  setPhoneInvalid(form, PHONE_ID, !!phoneError);
  const firstInvalid = form.querySelector<HTMLElement>('[aria-invalid="true"]');
  firstInvalid?.focus();
  return !firstInvalid && !phoneError;
}

export function initProjectQuickForm(el: HTMLElement, project: Project, name: string): void {
  const form = el.querySelector<HTMLFormElement>("#project-quick-form");
  if (!form) return;
  const successBox = form.querySelector<HTMLElement>("#pq-success")!;
  const submitButton = form.querySelector<HTMLButtonElement>("#pq-submit");
  const openedAt = Date.now();
  let sending = false;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending || !validate(form)) return;
    const data = new FormData(form);
    const visitor = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const phone = getPhoneValue(form, PHONE_ID);

    sending = true;
    successBox.hidden = true;
    setSending(submitButton, true);
    const result = await sendInquiry(
      form,
      { kind: "contact", name: visitor, email, phone, projects: [{ slug: project.slug, nameAr: name }], details: { form: "project" } },
      openedAt
    );
    sending = false;
    setSending(submitButton, false);
    if (result.status === "limit") return showLimit(successBox);

    trackLead("project-form", project.slug, { email, phone, name: visitor });
    if (result.status === "sent") {
      successBox.innerHTML = `<strong>${t("projectDetail.quickForm.sentTitle")}</strong>
        <p>${t("projectDetail.quickForm.sentText", { name: escapeHtml(name) })}</p>
        <p class="contact-form__reference">${t("inquiry.reference", { ref: `<bdi dir="ltr">${escapeHtml(result.reference)}</bdi>` })}</p>`;
      successBox.classList.remove("contact-form__success--warn");
      successBox.hidden = false;
      successBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      // The inbox couldn't take it: the visitor's email app, as on the contact form.
      const subject = `Project Inquiry: ${name}`;
      const body = [`Project page form: ${window.location.origin}${window.location.pathname}`, "", `Name: ${visitor}`, `Email: ${email}`, `Phone: ${phone}`].join("\n");
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      showMailtoSent(successBox);
    }
    form.reset();
  });
}
