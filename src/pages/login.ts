import { t } from "../i18n";
import { isAuthenticated, signIn } from "../auth/session";
import { navigate } from "../router";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setError(form: HTMLFormElement, field: string, message: string): void {
  const errorEl = form.querySelector<HTMLElement>(`[data-error-for="${field}"]`);
  const input = form.querySelector<HTMLElement>(`[name="${field}"]`);
  if (errorEl) errorEl.textContent = message;
  if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
}

function validate(form: HTMLFormElement): boolean {
  const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
  const password = (form.elements.namedItem("password") as HTMLInputElement).value;

  let valid = true;

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
  } else {
    setError(form, "password", "");
  }

  return valid;
}

export function renderLogin(el: HTMLElement): void {
  if (isAuthenticated()) {
    navigate("#/account");
    return;
  }

  el.innerHTML = `
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow eyebrow--on-dark">${t("auth.loginHeroEyebrow")}</p>
        <h1>${t("auth.loginHeroTitle")}</h1>
        <p class="page-hero__subtitle">${t("auth.loginHeroSubtitle")}</p>
      </div>
    </section>

    <section class="section auth-section">
      <div class="container auth-section__inner">
        <form class="auth-form" id="login-form" novalidate>
          <h2>${t("auth.loginFormTitle")}</h2>

          <p class="form-field__error auth-form__general-error" data-error-for="general"></p>

          <div class="form-field">
            <label for="lf-email">${t("auth.emailLabel")}</label>
            <input dir="ltr" type="email" id="lf-email" name="email" placeholder="${t("auth.emailPlaceholder")}" autocomplete="email" />
            <p class="form-field__error" data-error-for="email"></p>
          </div>

          <div class="form-field">
            <label for="lf-password">${t("auth.passwordLabel")}</label>
            <input dir="ltr" type="password" id="lf-password" name="password" placeholder="${t("auth.passwordPlaceholder")}" autocomplete="current-password" />
            <p class="form-field__error" data-error-for="password"></p>
          </div>

          <button type="submit" class="btn btn--primary btn--block" id="lf-submit">${t("auth.loginButton")}</button>

          <p class="auth-form__switch">${t("auth.noAccountText")} <a href="#/register">${t("auth.registerLink")}</a></p>
        </form>
      </div>
    </section>
  `;

  const form = el.querySelector<HTMLFormElement>("#login-form")!;
  const submitBtn = el.querySelector<HTMLButtonElement>("#lf-submit")!;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validate(form)) return;

    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    submitBtn.disabled = true;
    submitBtn.textContent = t("auth.loggingIn");
    setError(form, "general", "");

    signIn(email, password).then(({ error }) => {
      if (error) {
        setError(form, "general", t("auth.errors.invalidCredentials"));
        submitBtn.disabled = false;
        submitBtn.textContent = t("auth.loginButton");
        return;
      }
      navigate("#/account");
    });
  });
}
