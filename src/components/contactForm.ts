import { t, link, getLocale, getProjectContent, placeLine } from "../i18n";
import { lookup } from "../i18n/dictionaries";
import { getProjectBySlug, getSortedProjects } from "../data/projects";
import { renderPhoneInput, getPhoneValue, isPhoneFilled, isPhoneValid, setPhoneInvalid } from "./phoneInput";

const CONTACT_EMAIL = "info@byhadara.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ID = "cf-phone";

/** The project a visitor came from ("I'm interested" on a project page), shown above the form. */
function renderProjectCard(slug: string): string {
  const project = getProjectBySlug(slug);
  if (!project) return "";
  const content = getProjectContent(slug);
  return `
    <img src="${project.coverImage.src}" alt="" width="${project.coverImage.width}" height="${project.coverImage.height}" />
    <div class="inquiry-project__body">
      <span class="inquiry-project__eyebrow">${t("contact.projectEyebrow")}</span>
      <strong class="inquiry-project__name">${content.name}</strong>
      <span class="inquiry-project__place">${placeLine(project.district, project.city)}</span>
    </div>
    <a class="inquiry-project__link" href="${link(`/projects/${slug}`)}">${t("contact.projectView")}</a>`;
}

const projectMessage = (slug: string) =>
  getProjectBySlug(slug) ? t("contact.projectMessage", { name: getProjectContent(slug).name }) : "";

/** `projectSlug` preselects the project of interest (from /contact?project=<slug>). */
export function renderContactForm(projectSlug = ""): string {
  const selected = getProjectBySlug(projectSlug) ? projectSlug : "";
  return `
    <form class="contact-form" id="contact-form" novalidate>
      <div class="inquiry-project" id="cf-project-card"${selected ? "" : " hidden"}>${selected ? renderProjectCard(selected) : ""}</div>

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
          <label for="${PHONE_ID}-number">${t("contact.phoneLabel")}</label>
          ${renderPhoneInput(PHONE_ID, "phone")}
          <p class="form-field__error" data-error-for="phone"></p>
        </div>
      </div>

      <div class="form-field">
        <label for="cf-project">${t("contact.projectLabel")}</label>
        <select id="cf-project" name="project">
          <option value="">${t("contact.projectGeneral")}</option>
          ${getSortedProjects()
            .map((p) => `<option value="${p.slug}"${p.slug === selected ? " selected" : ""}>${getProjectContent(p.slug).name}</option>`)
            .join("")}
        </select>
      </div>

      <div class="form-field">
        <label for="cf-subject">${t("contact.subjectLabel")}</label>
        <input type="text" id="cf-subject" name="subject" placeholder="${t("contact.subjectPlaceholder")}" />
      </div>

      <div class="form-field">
        <label for="cf-message">${t("contact.messageLabel")}</label>
        <textarea id="cf-message" name="message" rows="5" placeholder="${t("contact.messagePlaceholder")}">${projectMessage(selected)}</textarea>
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

  if (!isPhoneFilled(form, PHONE_ID)) {
    setError(form, "phone", t("contact.errors.phoneRequired"));
    setPhoneInvalid(form, PHONE_ID, true);
    valid = false;
  } else if (!isPhoneValid(form, PHONE_ID)) {
    setError(form, "phone", t("contact.errors.phoneInvalid"));
    setPhoneInvalid(form, PHONE_ID, true);
    valid = false;
  } else {
    setError(form, "phone", "");
    setPhoneInvalid(form, PHONE_ID, false);
  }

  return valid;
}

export function initContactForm(container: ParentNode): void {
  const form = container.querySelector<HTMLFormElement>("#contact-form");
  if (!form) return;

  const successBox = form.querySelector<HTMLElement>("#cf-success")!;
  const projectSelect = form.querySelector<HTMLSelectElement>("#cf-project")!;
  const projectCard = form.querySelector<HTMLElement>("#cf-project-card")!;
  const messageEl = form.querySelector<HTMLTextAreaElement>("#cf-message")!;
  let currentProject = projectSelect.value;

  const syncProject = () => {
    const slug = projectSelect.value;
    projectCard.innerHTML = slug ? renderProjectCard(slug) : "";
    projectCard.hidden = !slug;
    // Swap the suggested message only while the visitor hasn't written their own.
    if (messageEl.value.trim() === "" || messageEl.value === projectMessage(currentProject)) {
      messageEl.value = projectMessage(slug);
    }
    currentProject = slug;
  };
  projectSelect.addEventListener("change", syncProject);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validate(form)) return;

    const data = new FormData(form);
    const name = String(data.get("name") ?? "");
    const email = String(data.get("email") ?? "");
    const phone = getPhoneValue(form, PHONE_ID);
    const projectSlug = String(data.get("project") ?? "");
    // The team reads these emails, so the project is named in English whatever the page language.
    const projectName = projectSlug ? String(lookup("en", `projectsData.${projectSlug}.name`) ?? projectSlug) : "";
    const subject =
      String(data.get("subject") ?? "").trim() || (projectName ? `Project Inquiry: ${projectName}` : "Website Inquiry");
    const message = String(data.get("message") ?? "");

    const body = [
      ...(projectName
        ? [`Project: ${projectName}`, `Project page: ${window.location.origin}/projects/${projectSlug}`, ""]
        : []),
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      `Language: ${getLocale().toUpperCase()}`,
      "",
      message
    ].join("\n");

    const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;

    successBox.hidden = false;
    form.reset();
    syncProject();
  });
}
