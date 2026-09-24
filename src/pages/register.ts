import { t } from "../i18n";
import { isAuthenticated, signUp } from "../auth/session";
import { navigate } from "../router";
import { renderPhoneInput, getPhoneValue, isPhoneFilled, isPhoneValid, setPhoneInvalid } from "../components/phoneInput";
import { countries } from "../data/countries";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ID = "rf-phone";

function setError(form: HTMLFormElement, field: string, message: string): void {
  const errorEl = form.querySelector<HTMLElement>(`[data-error-for="${field}"]`);
  const input = form.querySelector<HTMLElement>(`[name="${field}"]`);
  if (errorEl) errorEl.textContent = message;
  if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
}

function validate(form: HTMLFormElement): boolean {
  const fullName = (form.elements.namedItem("fullName") as HTMLInputElement).value.trim();
  const country = (form.elements.namedItem("country") as HTMLSelectElement).value.trim();
  const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
  const password = (form.elements.namedItem("password") as HTMLInputElement).value;
  const confirmPassword = (form.elements.namedItem("confirmPassword") as HTMLInputElement).value;

  let valid = true;

  if (!fullName) {
    setError(form, "fullName", t("auth.errors.fullNameRequired"));
    valid = false;
  } else {
    setError(form, "fullName", "");
  }

  if (!isPhoneFilled(form, PHONE_ID)) {
    setError(form, "phone", t("auth.errors.phoneRequired"));
    setPhoneInvalid(form, PHONE_ID, true);
    valid = false;
  } else if (!isPhoneValid(form, PHONE_ID)) {
    setError(form, "phone", t("auth.errors.phoneRequired"));
    setPhoneInvalid(form, PHONE_ID, true);
    valid = false;
  } else {
    setError(form, "phone", "");
    setPhoneInvalid(form, PHONE_ID, false);
  }

  if (!country) {
    setError(form, "country", t("auth.errors.countryRequired"));
    valid = false;
  } else {
    setError(form, "country", "");
  }

  if (!email) {
    setError(form, "email", t("auth.errors.emailRequired"));
    valid = false;
  } else if (!EMAIL_RE.test(email)) {
    setError(form, "email", t("auth.errors.emailInvalid"));
    valid = false;
  } else {
    setError(form, "email", "");
  }

  if (!password) {
    setError(form, "password", t("auth.errors.passwordRequired"));
    valid = false;
  } else if (password.length < 8) {
    setError(form, "password", t("auth.errors.passwordTooShort"));
    valid = false;
  } else {
    setError(form, "password", "");
  }

  if (!confirmPassword) {
    setError(form, "confirmPassword", t("auth.errors.confirmPasswordRequired"));
    valid = false;
  } else if (confirmPassword !== password) {
    setError(form, "confirmPassword", t("auth.errors.passwordMismatch"));
    valid = false;
  } else {
    setError(form, "confirmPassword", "");
  }

  return valid;
}

export function renderRegister(el: HTMLElement): void {
  if (isAuthenticated()) {
    navigate("#/account");
    return;
  }

  el.innerHTML = `
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow eyebrow--on-dark">${t("auth.registerHeroEyebrow")}</p>
        <h1>${t("auth.registerHeroTitle")}</h1>
        <p class="page-hero__subtitle">${t("auth.registerHeroSubtitle")}</p>
      </div>
    </section>

    <section class="section auth-section">
      <div class="container auth-section__inner">
        <form class="auth-form" id="register-form" novalidate>
          <h2>${t("auth.registerFormTitle")}</h2>

          <p class="form-field__error auth-form__general-error" data-error-for="general"></p>

          <div class="form-field">
            <label for="rf-fullName">${t("auth.fullNameLabel")}</label>
            <input type="text" id="rf-fullName" name="fullName" placeholder="${t("auth.fullNamePlaceholder")}" autocomplete="name" />
            <p class="form-field__error" data-error-for="fullName"></p>
          </div>

          <div class="form-field">
            <label for="${PHONE_ID}-number">${t("auth.phoneLabel")}</label>
            ${renderPhoneInput(PHONE_ID, "phone")}
            <p class="form-field__error" data-error-for="phone"></p>
          </div>

          <div class="form-field">
            <label for="rf-country">${t("auth.countryLabel")}</label>
            <select id="rf-country" name="country" autocomplete="country-name">
              <option value="" disabled selected>${t("auth.countryPlaceholder")}</option>
              ${countries.map((c) => `<option value="${c.name}">${c.name}</option>`).join("")}
            </select>
            <p class="form-field__error" data-error-for="country"></p>
          </div>

          <div class="form-field">
            <label for="rf-email">${t("auth.emailLabel")}</label>
            <input dir="ltr" type="email" id="rf-email" name="email" placeholder="${t("auth.emailPlaceholder")}" autocomplete="email" />
            <p class="form-field__error" data-error-for="email"></p>
          </div>

          <div class="form-row">
            <div class="form-field">
              <label for="rf-password">${t("auth.passwordLabel")}</label>
              <input dir="ltr" type="password" id="rf-password" name="password" placeholder="${t("auth.passwordPlaceholder")}" autocomplete="new-password" />
              <p class="form-field__error" data-error-for="password"></p>
            </div>

            <div class="form-field">
              <label for="rf-confirmPassword">${t("auth.confirmPasswordLabel")}</label>
              <input dir="ltr" type="password" id="rf-confirmPassword" name="confirmPassword" placeholder="${t("auth.confirmPasswordPlaceholder")}" autocomplete="new-password" />
              <p class="form-field__error" data-error-for="confirmPassword"></p>
            </div>
          </div>

          <button type="submit" class="btn btn--primary btn--block" id="rf-submit">${t("auth.registerButton")}</button>

          <p class="auth-form__switch">${t("auth.haveAccountText")} <a href="#/login">${t("auth.loginLink")}</a></p>
        </form>

        <div class="contact-form__success" id="rf-success" hidden>
          <strong>${t("auth.registerSuccessTitle")}</strong>
          <p>${t("auth.registerSuccessText")}</p>
        </div>
      </div>
    </section>
  `;

  const form = el.querySelector<HTMLFormElement>("#register-form")!;
  const submitBtn = el.querySelector<HTMLButtonElement>("#rf-submit")!;
  const successBox = el.querySelector<HTMLElement>("#rf-success")!;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validate(form)) return;

    const data = new FormData(form);
    const fullName = String(data.get("fullName") ?? "").trim();
    const phone = getPhoneValue(form, PHONE_ID);
    const country = String(data.get("country") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    submitBtn.disabled = true;
    submitBtn.textContent = t("auth.registering");
    setError(form, "general", "");

    signUp({ email, password, fullName, phone, country }).then(({ error }) => {
      submitBtn.disabled = false;
      submitBtn.textContent = t("auth.registerButton");
      if (error) {
        setError(form, "general", t("auth.errors.generic"));
        return;
      }
      form.hidden = true;
      successBox.hidden = false;
    });
  });
}
