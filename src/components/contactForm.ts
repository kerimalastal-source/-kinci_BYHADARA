import { t } from "../i18n";

const CONTACT_EMAIL = "info@byhadara.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\d\s-]{7,20}$/;

export function renderContactForm(): string {
  return `
    <form class="contact-form" id="contact-form" novalidate>
      <p class="contact-form__subtitle">${t("contact.formSubtitle")}</p>

      <div class="form-field">
        <label for="cf-name">${t("contact.nameLabel")}</label>
        <input type="text" id="cf-name" name="name" placeholder="${t("contact.namePlaceholder")}" autocomplete="name" />
        <p class="form-field__error" data-error-for="name"></p>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label for="cf-email">${t("contact.emailLabel")}</label>
          <input dir="ltr" type="email" id="cf-email" name="email" placeholder="${t("contact.emailPlaceholder")}" autocomplete="email" />
          <p class="form-field__error" data-error-for="email"></p>
        </div>

        <div class="form-field">
          <label for="cf-phone">${t("contact.phoneLabel")}</label>
          <input dir="ltr" type="tel" id="cf-phone" name="phone" placeholder="${t("contact.phonePlaceholder")}" autocomplete="tel" />
          <p class="form-field__error" data-error-for="phone"></p>
        </div>
      </div>

      <div class="form-field">
        <label for="cf-subject">${t("contact.subjectLabel")}</label>
        <input type="text" id="cf-subject" name="subject" placeholder="${t("contact.subjectPlaceholder")}" />
      </div>

      <div class="form-field">
        <label for="cf-message">${t("contact.messageLabel")}</label>
        <textarea id="cf-message" name="message" rows="5" placeholder="${t("contact.messagePlaceholder")}"></textarea>
      </div>

      <button type="submit" class="btn btn--primary" id="cf-submit">${t("contact.submitButton")}</button>

      <div class="contact-form__success" id="cf-success" hidden>
        <strong>${t("contact.successTitle")}</strong>
        <p>${t("contact.successText")}</p>
      </div>
    </form>
  `;
}

function setError(form: HTMLFormElement, field: string, message: string): void {
  const errorEl = form.querySelector<HTMLElement>(`[data-error-for="${field}"]`);
  const input = form.querySelector<HTMLElement>(`[name="${field}"]`);
  if (errorEl) errorEl.textContent = message;
  if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
}

function validate(form: HTMLFormElement): boolean {
  const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
  const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
  const phone = (form.elements.namedItem("phone") as HTMLInputElement).value.trim();

  let valid = true;

  if (!name) {
    setError(form, "name", t("contact.errors.nameRequired"));
    valid = false;
  } else {
    setError(form, "name", "");
  }

  if (!email) {
    setError(form, "email", t("contact.errors.emailRequired"));
    valid = false;
  } else if (!EMAIL_RE.test(email)) {
    setError(form, "email", t("contact.errors.emailInvalid"));
    valid = false;
  } else {
    setError(form, "email", "");
  }

  if (!phone) {
    setError(form, "phone", t("contact.errors.phoneRequired"));
    valid = false;
  } else if (!PHONE_RE.test(phone)) {
    setError(form, "phone", t("contact.errors.phoneInvalid"));
    valid = false;
  } else {
    setError(form, "phone", "");
  }

  return valid;
}

export function initContactForm(container: ParentNode): void {
  const form = container.querySelector<HTMLFormElement>("#contact-form");
  if (!form) return;

  const successBox = form.querySelector<HTMLElement>("#cf-success")!;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validate(form)) return;

    const data = new FormData(form);
    const name = String(data.get("name") ?? "");
    const email = String(data.get("email") ?? "");
    const phone = String(data.get("phone") ?? "");
    const subject = String(data.get("subject") ?? "").trim() || "Website Inquiry";
    const message = String(data.get("message") ?? "");

    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      "",
      message
    ].join("\n");

    const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;

    successBox.hidden = false;
    form.reset();
  });
}
