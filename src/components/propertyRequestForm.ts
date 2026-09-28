import { t, tRaw } from "../i18n";
import { propertyTypeOptions, conditionOptions, budgetOptions, floorOptions } from "../data/propertyRequestOptions";
import { turkeyProvinces } from "../data/turkeyLocations";
import { renderPhoneInput, getPhoneValue, isPhoneFilled, isPhoneValid, setPhoneInvalid } from "./phoneInput";
import { trackLead } from "../utils/tracking";
import { lookup } from "../i18n/dictionaries";
import { honeypotField, sendInquiry, setSending, showLimit, showMailtoSent, showSent } from "../utils/inquiry";

const CONTACT_EMAIL = "info@byhadara.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ID = "pr-phone";

function optionsHtml(values: string[], labels: Record<string, string>, placeholder: string): string {
  return `
    <option value="" disabled selected>${placeholder}</option>
    ${values.map((v) => `<option value="${v}">${labels[v] ?? v}</option>`).join("")}
  `;
}

function placeOptionsHtml(items: { value: string; label: string }[], placeholder: string): string {
  return `
    <option value="" disabled selected>${placeholder}</option>
    ${items.map((i) => `<option value="${i.value}">${i.label}</option>`).join("")}
  `;
}

export function renderPropertyRequestForm(): string {
  const propertyTypeLabels = tRaw<Record<string, string>>("propertyRequest.propertyTypes");
  const conditionLabels = tRaw<Record<string, string>>("propertyRequest.conditions");
  const budgetLabels = tRaw<Record<string, string>>("propertyRequest.budgets");
  const floorLabels = tRaw<Record<string, string>>("propertyRequest.floors");

  return `
    <form class="contact-form property-request-form" id="property-request-form" novalidate>
      <p class="contact-form__subtitle">${t("propertyRequest.formSubtitle")}</p>

      <div class="form-field">
        <label for="pr-name">${t("propertyRequest.nameLabel")}</label>
        <input type="text" id="pr-name" name="name" placeholder="${t("propertyRequest.namePlaceholder")}" autocomplete="name" />
        <p class="form-field__error" data-error-for="name"></p>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label for="pr-email">${t("propertyRequest.emailLabel")}</label>
          <input dir="ltr" type="email" id="pr-email" name="email" placeholder="${t("propertyRequest.emailPlaceholder")}" autocomplete="email" />
          <p class="form-field__error" data-error-for="email"></p>
        </div>
        <div class="form-field">
          <label for="${PHONE_ID}-number">${t("propertyRequest.phoneLabel")}</label>
          ${renderPhoneInput(PHONE_ID, "phone")}
          <p class="form-field__error" data-error-for="phone"></p>
        </div>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label for="pr-property-type">${t("propertyRequest.propertyTypeLabel")}</label>
          <select id="pr-property-type" name="propertyType">
            ${optionsHtml(propertyTypeOptions, propertyTypeLabels, t("propertyRequest.propertyTypePlaceholder"))}
          </select>
          <p class="form-field__error" data-error-for="propertyType"></p>
        </div>
        <div class="form-field">
          <label for="pr-condition">${t("propertyRequest.conditionLabel")}</label>
          <select id="pr-condition" name="condition">
            ${optionsHtml(conditionOptions, conditionLabels, t("propertyRequest.conditionPlaceholder"))}
          </select>
          <p class="form-field__error" data-error-for="condition"></p>
        </div>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label for="pr-city">${t("propertyRequest.cityLabel")}</label>
          <select id="pr-city" name="city">
            ${placeOptionsHtml(turkeyProvinces, t("propertyRequest.cityPlaceholder"))}
          </select>
          <p class="form-field__error" data-error-for="city"></p>
        </div>
        <div class="form-field">
          <label for="pr-district">${t("propertyRequest.districtLabel")}</label>
          <select id="pr-district" name="district" disabled>
            <option value="" disabled selected>${t("propertyRequest.districtPlaceholder")}</option>
          </select>
          <p class="form-field__error" data-error-for="district"></p>
        </div>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label for="pr-budget">${t("propertyRequest.budgetLabel")}</label>
          <select id="pr-budget" name="budget">
            ${optionsHtml(budgetOptions, budgetLabels, t("propertyRequest.budgetPlaceholder"))}
          </select>
          <p class="form-field__error" data-error-for="budget"></p>
        </div>
        <div class="form-field">
          <label for="pr-floor">${t("propertyRequest.floorLabel")}</label>
          <select id="pr-floor" name="floor">
            ${optionsHtml(floorOptions, floorLabels, t("propertyRequest.floorPlaceholder"))}
          </select>
          <p class="form-field__error" data-error-for="floor"></p>
        </div>
      </div>

      <div class="form-field">
        <label for="pr-notes">${t("propertyRequest.notesLabel")}</label>
        <textarea id="pr-notes" name="notes" rows="4" placeholder="${t("propertyRequest.notesPlaceholder")}"></textarea>
      </div>

      ${honeypotField()}
      <button type="submit" class="btn btn--primary" id="pr-submit">${t("propertyRequest.submitButton")}</button>

      <div class="contact-form__success" id="pr-success" role="status" hidden>
        <strong>${t("propertyRequest.successTitle")}</strong>
        <p>${t("propertyRequest.successText")}</p>
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

function requireValue(form: HTMLFormElement, field: string, errorKey: string): boolean {
  const value = (form.elements.namedItem(field) as HTMLInputElement | HTMLSelectElement | null)?.value.trim();
  if (!value) {
    setError(form, field, t(errorKey));
    return false;
  }
  setError(form, field, "");
  return true;
}

function validate(form: HTMLFormElement): boolean {
  const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
  const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();

  let valid = true;

  if (!name) {
    setError(form, "name", t("propertyRequest.errors.nameRequired"));
    valid = false;
  } else {
    setError(form, "name", "");
  }

  if (!email) {
    setError(form, "email", t("propertyRequest.errors.emailRequired"));
    valid = false;
  } else if (!EMAIL_RE.test(email)) {
    setError(form, "email", t("propertyRequest.errors.emailInvalid"));
    valid = false;
  } else {
    setError(form, "email", "");
  }

  if (!isPhoneFilled(form, PHONE_ID)) {
    setError(form, "phone", t("propertyRequest.errors.phoneRequired"));
    setPhoneInvalid(form, PHONE_ID, true);
    valid = false;
  } else if (!isPhoneValid(form, PHONE_ID)) {
    setError(form, "phone", t("propertyRequest.errors.phoneInvalid"));
    setPhoneInvalid(form, PHONE_ID, true);
    valid = false;
  } else {
    setError(form, "phone", "");
    setPhoneInvalid(form, PHONE_ID, false);
  }

  if (!requireValue(form, "propertyType", "propertyRequest.errors.propertyTypeRequired")) valid = false;
  if (!requireValue(form, "city", "propertyRequest.errors.cityRequired")) valid = false;
  if (!requireValue(form, "district", "propertyRequest.errors.districtRequired")) valid = false;
  if (!requireValue(form, "condition", "propertyRequest.errors.conditionRequired")) valid = false;
  if (!requireValue(form, "budget", "propertyRequest.errors.budgetRequired")) valid = false;
  if (!requireValue(form, "floor", "propertyRequest.errors.floorRequired")) valid = false;

  return valid;
}

export function initPropertyRequestForm(container: ParentNode): void {
  const form = container.querySelector<HTMLFormElement>("#property-request-form");
  if (!form) return;

  const citySelect = form.querySelector<HTMLSelectElement>("#pr-city")!;
  const districtSelect = form.querySelector<HTMLSelectElement>("#pr-district")!;

  citySelect.addEventListener("change", () => {
    const province = turkeyProvinces.find((p) => p.value === citySelect.value);
    setError(form, "district", "");
    if (!province) {
      districtSelect.innerHTML = `<option value="" disabled selected>${t("propertyRequest.districtPlaceholder")}</option>`;
      districtSelect.disabled = true;
      return;
    }
    districtSelect.disabled = false;
    districtSelect.innerHTML = placeOptionsHtml(province.districts, t("propertyRequest.districtSelectPlaceholder"));
  });

  const successBox = form.querySelector<HTMLElement>("#pr-success")!;

  const submitButton = form.querySelector<HTMLButtonElement>("#pr-submit");
  const openedAt = Date.now();
  let sending = false;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending || !validate(form)) return;

    const propertyTypeLabels = tRaw<Record<string, string>>("propertyRequest.propertyTypes");
    const conditionLabels = tRaw<Record<string, string>>("propertyRequest.conditions");
    const budgetLabels = tRaw<Record<string, string>>("propertyRequest.budgets");
    const floorLabels = tRaw<Record<string, string>>("propertyRequest.floors");

    const data = new FormData(form);
    const name = String(data.get("name") ?? "");
    const email = String(data.get("email") ?? "");
    const phone = getPhoneValue(form, PHONE_ID);
    const propertyType = propertyTypeLabels[String(data.get("propertyType") ?? "")] ?? "";
    const city = citySelect.selectedOptions[0]?.textContent ?? "";
    const district = districtSelect.selectedOptions[0]?.textContent ?? "";
    const condition = conditionLabels[String(data.get("condition") ?? "")] ?? "";
    const budget = budgetLabels[String(data.get("budget") ?? "")] ?? "";
    const floor = floorLabels[String(data.get("floor") ?? "")] ?? "";
    const notes = String(data.get("notes") ?? "").trim();

    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      `Property Type: ${propertyType}`,
      `City: ${city}`,
      `District: ${district}`,
      `Condition: ${condition}`,
      `Budget: ${budget}`,
      `Preferred Floor: ${floor}`,
      "",
      notes
    ].join("\n");

    // Option keys for the admin inbox, and the same answers in Arabic for the team's alert.
    const keys = {
      propertyType: String(data.get("propertyType") ?? ""),
      condition: String(data.get("condition") ?? ""),
      budget: String(data.get("budget") ?? ""),
      floor: String(data.get("floor") ?? "")
    };
    const ar = (key: string) => String(lookup("ar", key) ?? "").replace(/\s*\*$/, "");
    sending = true;
    successBox.hidden = true;
    setSending(submitButton, true);
    const result = await sendInquiry(
      form,
      {
        kind: "property_request",
        name,
        email,
        phone,
        message: notes,
        details: { ...keys, city, district },
        summaryAr: [
          [ar("propertyRequest.propertyTypeLabel"), ar(`propertyRequest.propertyTypes.${keys.propertyType}`)],
          [ar("propertyRequest.cityLabel"), city],
          [ar("propertyRequest.districtLabel"), district],
          [ar("propertyRequest.conditionLabel"), ar(`propertyRequest.conditions.${keys.condition}`)],
          [ar("propertyRequest.budgetLabel"), ar(`propertyRequest.budgets.${keys.budget}`)],
          [ar("propertyRequest.floorLabel"), ar(`propertyRequest.floors.${keys.floor}`)]
        ]
      },
      openedAt
    );
    sending = false;
    setSending(submitButton, false);
    if (result.status === "limit") return showLimit(successBox);

    trackLead("property-request", propertyType);
    if (result.status === "sent") {
      showSent(successBox, result.reference);
    } else {
      // The inbox couldn't take it: the visitor's email app, as before.
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Property Request")}&body=${encodeURIComponent(body)}`;
      showMailtoSent(successBox);
    }
    form.reset();
    districtSelect.innerHTML = `<option value="" disabled selected>${t("propertyRequest.districtPlaceholder")}</option>`;
    districtSelect.disabled = true;
  });
}
