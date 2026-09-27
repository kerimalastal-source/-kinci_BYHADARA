import { t, getLocale } from "../i18n";
import { countries } from "../data/countries";
import { PROJECT_TYPE_KEYS } from "../data/consultancy";
import { renderPhoneInput, getPhoneValue, isPhoneFilled, isPhoneValid, setPhoneInvalid } from "./phoneInput";

/* Same delivery as the site's other forms: validated here, then handed to the visitor's
   email app (mailto:) addressed to the sales inbox. */
const CONTACT_EMAIL = "info@byhadara.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ID = "cf-phone";
/** English, like the site's other request emails, so the team inbox can filter on it. */
const EMAIL_SUBJECT = "Engineering & Architectural Consultancy Request";
/** Order of the "Required service" options. */
const SERVICE_OPTIONS = ["architectural", "interior", "engineering", "visualization", "development", "renovation", "other"];
/** Listed first in the country select: Türkiye and the region the page is aimed at. */
const PRIORITY_COUNTRIES = ["TR", "SA", "AE", "QA", "KW", "BH", "OM", "JO", "IQ", "EG", "LB"];

/** Country names in the page language (Intl), falling back to the English names in countries.ts. */
function countryOptions(): string {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([getLocale()], { type: "region" });
  } catch {
    names = null;
  }
  const label = (iso2: string, fallback: string) => names?.of(iso2) ?? fallback;
  const collator = new Intl.Collator(getLocale());
  const all = countries.map((c) => ({ value: c.iso2, label: label(c.iso2, c.name) }));
  const first = PRIORITY_COUNTRIES.map((iso) => all.find((c) => c.value === iso)).filter((c): c is { value: string; label: string } => Boolean(c));
  const rest = all.filter((c) => !PRIORITY_COUNTRIES.includes(c.value)).sort((a, b) => collator.compare(a.label, b.label));
  const option = (c: { value: string; label: string }) => `<option value="${c.value}">${c.label}</option>`;
  return `
    <option value="" selected>${t("consultancy.form.countryPlaceholder")}</option>
    <optgroup label="${t("consultancy.form.countryGroupRegion")}">${first.map(option).join("")}</optgroup>
    <optgroup label="${t("consultancy.form.countryGroupAll")}">${rest.map(option).join("")}</optgroup>
  `;
}

function keyedOptions(keys: readonly string[], group: string, placeholder: string, disabledPlaceholder: boolean): string {
  return `
    <option value=""${disabledPlaceholder ? " disabled" : ""} selected>${placeholder}</option>
    ${keys.map((k) => `<option value="${k}">${t(`consultancy.form.${group}.${k}`)}</option>`).join("")}
  `;
}

export function renderConsultancyForm(): string {
  return `
    <form class="contact-form consult-form" id="consultancy-form" novalidate>
      <p class="contact-form__subtitle">${t("consultancy.form.requiredNote")}</p>

      <div class="form-row">
        <div class="form-field">
          <label for="cf-name">${t("consultancy.form.nameLabel")} <span aria-hidden="true">*</span></label>
          <input type="text" id="cf-name" name="name" placeholder="${t("consultancy.form.namePlaceholder")}" autocomplete="name" required />
          <p class="form-field__error" data-error-for="name"></p>
        </div>
        <div class="form-field">
          <label for="cf-company">${t("consultancy.form.companyLabel")}</label>
          <input type="text" id="cf-company" name="company" placeholder="${t("consultancy.form.companyPlaceholder")}" autocomplete="organization" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label for="cf-email">${t("consultancy.form.emailLabel")} <span aria-hidden="true">*</span></label>
          <input dir="ltr" type="email" id="cf-email" name="email" placeholder="name@example.com" autocomplete="email" inputmode="email" required />
          <p class="form-field__error" data-error-for="email"></p>
        </div>
        <div class="form-field">
          <label for="cf-country">${t("consultancy.form.countryLabel")}</label>
          <select id="cf-country" name="country" autocomplete="country">${countryOptions()}</select>
        </div>
      </div>

      <div class="form-field">
        <label for="${PHONE_ID}-number">${t("consultancy.form.phoneLabel")} <span aria-hidden="true">*</span></label>
        ${renderPhoneInput(PHONE_ID, "phone")}
        <p class="form-field__error" data-error-for="phone"></p>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label for="cf-location">${t("consultancy.form.locationLabel")}</label>
          <input type="text" id="cf-location" name="location" placeholder="${t("consultancy.form.locationPlaceholder")}" />
        </div>
        <div class="form-field">
          <label for="cf-type">${t("consultancy.form.projectTypeLabel")}</label>
          <select id="cf-type" name="projectType">
            ${keyedOptions([...PROJECT_TYPE_KEYS, "other"], "projectTypes", t("consultancy.form.projectTypePlaceholder"), false)}
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label for="cf-area">${t("consultancy.form.areaLabel")}</label>
          <input type="text" id="cf-area" name="area" placeholder="${t("consultancy.form.areaPlaceholder")}" />
        </div>
        <div class="form-field">
          <label for="cf-service">${t("consultancy.form.serviceLabel")} <span aria-hidden="true">*</span></label>
          <select id="cf-service" name="service" required>
            ${keyedOptions(SERVICE_OPTIONS, "services", t("consultancy.form.servicePlaceholder"), true)}
          </select>
          <p class="form-field__error" data-error-for="service"></p>
        </div>
      </div>

      <div class="form-field">
        <label for="cf-description">${t("consultancy.form.descriptionLabel")}</label>
        <textarea id="cf-description" name="description" rows="4" placeholder="${t("consultancy.form.descriptionPlaceholder")}"></textarea>
      </div>

      <button type="submit" class="btn btn--primary">${t("consultancy.form.submit")}</button>

      <div class="contact-form__success" id="cf-success" role="status" hidden>
        <strong>${t("consultancy.form.successTitle")}</strong>
        <p>${t("consultancy.form.successText")}</p>
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

function value(form: HTMLFormElement, name: string): string {
  return ((form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null)?.value ?? "").trim();
}

/** Validates the required fields; returns the first invalid field so it can take focus. */
function validate(form: HTMLFormElement): HTMLElement | null {
  const invalid: HTMLElement[] = [];
  const check = (field: string, message: string) => {
    setError(form, field, message);
    if (message) invalid.push(form.querySelector<HTMLElement>(`[name="${field}"]`)!);
  };

  check("name", value(form, "name") ? "" : t("consultancy.form.errors.nameRequired"));

  const email = value(form, "email");
  check("email", !email ? t("consultancy.form.errors.emailRequired") : EMAIL_RE.test(email) ? "" : t("consultancy.form.errors.emailInvalid"));

  const phoneError = !isPhoneFilled(form, PHONE_ID)
    ? t("consultancy.form.errors.phoneRequired")
    : isPhoneValid(form, PHONE_ID)
      ? ""
      : t("consultancy.form.errors.phoneInvalid");
  check("phone", phoneError);
  setPhoneInvalid(form, PHONE_ID, Boolean(phoneError));

  check("service", value(form, "service") ? "" : t("consultancy.form.errors.serviceRequired"));

  return invalid[0] ?? null;
}

/** Selected option text (the visitor's language) for the email body. */
function selectedText(form: HTMLFormElement, name: string): string {
  const select = form.elements.namedItem(name) as HTMLSelectElement | null;
  return select?.value ? (select.selectedOptions[0]?.textContent?.trim() ?? "") : "";
}

/** Preselects a service (used by the service cards' "Request this service" links). */
export function preselectService(root: ParentNode, key: string): void {
  const select = root.querySelector<HTMLSelectElement>("#cf-service");
  if (select && [...select.options].some((o) => o.value === key)) {
    select.value = key;
    select.setAttribute("aria-invalid", "false");
    const error = root.querySelector<HTMLElement>('[data-error-for="service"]');
    if (error) error.textContent = "";
  }
}

export function initConsultancyForm(container: ParentNode): void {
  const form = container.querySelector<HTMLFormElement>("#consultancy-form");
  if (!form) return;
  const successBox = form.querySelector<HTMLElement>("#cf-success")!;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    successBox.hidden = true;
    const firstInvalid = validate(form);
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    // Only the fields the visitor filled in, then their description.
    const fields: [string, string][] = [
      ["Name", value(form, "name")],
      ["Company / Investor", value(form, "company")],
      ["Email", value(form, "email")],
      ["Phone / WhatsApp", getPhoneValue(form, PHONE_ID)],
      ["Country", selectedText(form, "country")],
      ["Project location", value(form, "location")],
      ["Project type", selectedText(form, "projectType")],
      ["Approximate area", value(form, "area")],
      ["Required service", selectedText(form, "service")]
    ];
    const body = [...fields.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`), "", value(form, "description")].join("\n").trim();

    const subject = `${EMAIL_SUBJECT} — ${selectedText(form, "service")}`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    successBox.hidden = false;
    form.reset();
  });
}
