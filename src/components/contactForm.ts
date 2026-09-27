import { t, link, getLocale, getProjectContent, placeLine } from "../i18n";
import { lookup } from "../i18n/dictionaries";
import { getProjectBySlug, getSortedProjects } from "../data/projects";
import { campaignSource } from "../utils/campaign";
import { getFavorites, setFavorites } from "./favorites";
import { renderPhoneInput, getPhoneValue, isPhoneFilled, isPhoneValid, setPhoneInvalid } from "./phoneInput";

const CONTACT_EMAIL = "info@byhadara.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ID = "cf-phone";

const CHECK_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';
const PLUS_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const CLOSE_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

/** Non-project subjects a visitor can pick next to (or instead of) projects; `?interest=a,b` preselects them. */
export const INTEREST_TOPICS = ["citizenship", "residence"] as const;
type Topic = (typeof INTEREST_TOPICS)[number];

const TOPIC_ICONS: Record<Topic, string> = {
  citizenship:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="2.5" width="15" height="19" rx="2"/><circle cx="12" cy="10" r="3.3"/><path d="M8.7 10h6.6M12 6.7c-1 .9-1.5 2-1.5 3.3s.5 2.4 1.5 3.3c1-.9 1.5-2 1.5-3.3s-.5-2.4-1.5-3.3zM8.5 17.5h7"/></svg>',
  residence:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 8.5V21h13V8.5"/><circle cx="10.5" cy="14" r="2.2"/><path d="M12.4 15.2 16 17.5M14.7 16.7l.9-1.4"/></svg>'
};

/** Topics from ?interest=a,b — unknown ones are dropped. */
function parseTopics(value: string): Topic[] {
  return INTEREST_TOPICS.filter((topic) => value.split(",").map((v) => v.trim()).includes(topic));
}

const projectName = (slug: string) => getProjectContent(slug).name;

/** "A, B and C" in the page language (Intl.ListFormat where available). */
function joinNames(names: string[]): string {
  const ListFormat = (Intl as unknown as { ListFormat?: new (locale: string, options: object) => { format(list: string[]): string } })
    .ListFormat;
  return ListFormat ? new ListFormat(getLocale(), { type: "conjunction" }).format(names) : names.join(", ");
}

/** Slugs from ?project=a,b — unknown ones are dropped, duplicates removed. */
function parseSlugs(value: string): string[] {
  return [...new Set(value.split(",").map((v) => v.trim()))].filter((slug) => getProjectBySlug(slug));
}

/** The project(s) the visitor is enquiring about, shown above the form. */
function renderProjectCard(slugs: string[]): string {
  if (!slugs.length) return "";
  const projects = slugs.map((slug) => getProjectBySlug(slug)!);
  const single = projects.length === 1;
  const place = single ? placeLine(projects[0].district, projects[0].city) : t("contact.projectCount", { count: projects.length });
  return `
    <div class="inquiry-project__thumbs${single ? "" : " inquiry-project__thumbs--stack"}">
      ${projects
        .slice(0, 3)
        .map((p) => `<img src="${p.coverImage.src}" alt="" width="${p.coverImage.width}" height="${p.coverImage.height}" />`)
        .join("")}
    </div>
    <div class="inquiry-project__body">
      <span class="inquiry-project__eyebrow">${t("contact.projectEyebrow")}</span>
      <strong class="inquiry-project__name">${joinNames(slugs.map(projectName))}</strong>
      <span class="inquiry-project__place">${place}</span>
    </div>
    ${single ? `<a class="inquiry-project__link" href="${link(`/projects/${slugs[0]}`)}">${t("contact.projectView")}</a>` : ""}`;
}

/** The suggested message for the chosen projects and topics ("" when nothing is chosen). */
function projectMessage(slugs: string[], topics: Topic[] = []): string {
  const lines: string[] = [];
  if (slugs.length === 1) lines.push(t("contact.projectMessage", { name: projectName(slugs[0]) }));
  else if (slugs.length) lines.push(t("contact.projectMessageMany", { names: joinNames(slugs.map(projectName)) }));
  if (topics.length) {
    const about = joinNames(topics.map((topic) => t(`contact.topics.${topic}.phrase`)));
    lines.push(t(slugs.length ? "contact.topicMessageAlso" : "contact.topicMessage", { topics: about }));
  }
  return lines.join("\n");
}

function renderTopics(topics: Topic[]): string {
  return `
        <div class="interest-topics" role="group" aria-labelledby="cf-projects-label">
          ${INTEREST_TOPICS.map(
            (topic) => `
          <button type="button" class="interest-topic" data-topic="${topic}" aria-pressed="${topics.includes(topic)}">
            <span class="interest-topic__icon">${TOPIC_ICONS[topic]}</span>
            <span class="interest-topic__label">${t(`contact.topics.${topic}.label`)}</span>
            <span class="interest-topic__check">${CHECK_ICON}</span>
          </button>`
          ).join("")}
        </div>`;
}

function renderChips(slugs: string[], topics: Topic[] = []): string {
  if (!slugs.length) return topics.length ? "" : `<li class="project-chip project-chip--empty">${t("contact.projectGeneral")}</li>`;
  return slugs
    .map((slug) => {
      const p = getProjectBySlug(slug)!;
      const name = projectName(slug);
      return `
      <li class="project-chip">
        <img src="${p.coverImage.src}" alt="" width="${p.coverImage.width}" height="${p.coverImage.height}" />
        <span>${name}</span>
        <button type="button" class="project-chip__remove" data-remove="${slug}" aria-label="${t("contact.projectRemove", { name })}">${CLOSE_ICON}</button>
      </li>`;
    })
    .join("");
}

/**
 * Projects of interest: the project the visitor came from is preselected, and any
 * number of others can be added from a panel of project cards (sold-out ones are
 * left out unless already chosen).
 */
function renderProjectPicker(selected: string[], topics: Topic[]): string {
  const options = getSortedProjects().filter((p) => !p.soldOut || selected.includes(p.slug));
  return `
      <div class="form-field project-picker" id="cf-projects" data-selected="${selected.join(",")}" data-topics="${topics.join(",")}">
        <p class="project-picker__label" id="cf-projects-label">${t("contact.projectLabel")}</p>
        <p class="project-picker__hint">${t("contact.projectHint")}</p>
        ${renderTopics(topics)}
        <ul class="project-picker__chips" aria-labelledby="cf-projects-label">${renderChips(selected, topics)}</ul>
        <button type="button" class="project-picker__add" aria-expanded="false" aria-controls="cf-projects-panel">
          ${PLUS_ICON}<span>${t(selected.length ? "contact.projectAdd" : "contact.projectChoose")}</span>
        </button>
        <div class="project-picker__panel" id="cf-projects-panel" hidden>
          <div class="project-picker__options" role="group" aria-labelledby="cf-projects-label">
            ${options
              .map(
                (p) => `
            <button type="button" class="project-option" data-slug="${p.slug}" aria-pressed="${selected.includes(p.slug)}">
              <img src="${p.coverImage.src}" alt="" width="${p.coverImage.width}" height="${p.coverImage.height}" loading="lazy" />
              <span class="project-option__text">
                <strong>${projectName(p.slug)}</strong>
                <span>${placeLine(p.district, p.city)}</span>
              </span>
              <span class="project-option__check">${CHECK_ICON}</span>
            </button>`
              )
              .join("")}
          </div>
          <button type="button" class="btn btn--primary project-picker__done">${t("contact.projectDone")}</button>
        </div>
      </div>`;
}

/**
 * `projectSlugs` preselects the projects of interest (from /contact?project=<slug>[,<slug>…]),
 * `interests` the other topics (from /contact?interest=citizenship,residence).
 */
export function renderContactForm(projectSlugs = "", interests = ""): string {
  // The project the visitor came from, plus everything they saved with the heart button.
  const saved = getFavorites().filter((slug) => !getProjectBySlug(slug)!.soldOut);
  const selected = [...new Set([...parseSlugs(projectSlugs), ...saved])];
  const topics = parseTopics(interests);
  return `
    <form class="contact-form" id="contact-form" novalidate>
      <div class="inquiry-project" id="cf-project-card"${selected.length ? "" : " hidden"}>${renderProjectCard(selected)}</div>

      <p class="contact-form__subtitle">${t("contact.formSubtitle")}</p>

      <div class="form-field">
        <label for="cf-name">${t("contact.nameLabel")}</label>
        <input type="text" id="cf-name" name="name" placeholder="${t("contact.namePlaceholder")}" autocomplete="name" />
        <p class="form-field__error" data-error-for="name"></p>
      </div>

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

${renderProjectPicker(selected, topics)}

      <div class="form-field">
        <label for="cf-subject">${t("contact.subjectLabel")}</label>
        <input type="text" id="cf-subject" name="subject" placeholder="${t("contact.subjectPlaceholder")}" />
      </div>

      <div class="form-field">
        <label for="cf-message">${t("contact.messageLabel")}</label>
        <textarea id="cf-message" name="message" rows="5" placeholder="${t("contact.messagePlaceholder")}">${projectMessage(selected, topics)}</textarea>
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
  const picker = form.querySelector<HTMLElement>("#cf-projects")!;
  const chips = picker.querySelector<HTMLElement>(".project-picker__chips")!;
  const addButton = picker.querySelector<HTMLButtonElement>(".project-picker__add")!;
  const panel = picker.querySelector<HTMLElement>(".project-picker__panel")!;
  const projectCard = form.querySelector<HTMLElement>("#cf-project-card")!;
  const messageEl = form.querySelector<HTMLTextAreaElement>("#cf-message")!;
  const initial = parseSlugs(picker.dataset.selected ?? "");
  const initialTopics = parseTopics(picker.dataset.topics ?? "");
  let selected = [...initial];
  let topics = [...initialTopics];
  let suggested = projectMessage(selected, topics);

  const render = () => {
    chips.innerHTML = renderChips(selected, topics);
    picker.querySelectorAll<HTMLButtonElement>(".interest-topic").forEach((button) => {
      button.setAttribute("aria-pressed", String(topics.includes(button.dataset.topic as Topic)));
    });
    projectCard.innerHTML = renderProjectCard(selected);
    projectCard.hidden = !selected.length;
    addButton.querySelector("span")!.textContent = t(selected.length ? "contact.projectAdd" : "contact.projectChoose");
    panel.querySelectorAll<HTMLButtonElement>(".project-option").forEach((option) => {
      option.setAttribute("aria-pressed", String(selected.includes(option.dataset.slug!)));
    });
    // Swap the suggested message only while the visitor hasn't written their own.
    if (messageEl.value.trim() === "" || messageEl.value === suggested) {
      suggested = projectMessage(selected, topics);
      messageEl.value = suggested;
    }
  };

  const setPanel = (open: boolean) => {
    panel.hidden = !open;
    addButton.setAttribute("aria-expanded", String(open));
    addButton.hidden = open;
    if (open) panel.querySelector<HTMLButtonElement>(".project-option")?.focus({ preventScroll: true });
  };

  picker.querySelector(".interest-topics")!.addEventListener("click", (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>("[data-topic]");
    if (!button) return;
    const topic = button.dataset.topic as Topic;
    // Kept in the fixed INTEREST_TOPICS order, whatever order they were picked in.
    topics = INTEREST_TOPICS.filter((k) => (k === topic ? !topics.includes(k) : topics.includes(k)));
    render();
  });

  addButton.addEventListener("click", () => setPanel(true));
  picker.querySelector(".project-picker__done")!.addEventListener("click", () => {
    setPanel(false);
    addButton.focus();
  });
  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      setPanel(false);
      addButton.focus();
    }
  });
  panel.addEventListener("click", (e) => {
    const option = (e.target as Element).closest<HTMLButtonElement>(".project-option");
    if (!option) return;
    const slug = option.dataset.slug!;
    selected = selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug];
    render();
    setFavorites(selected);
  });
  chips.addEventListener("click", (e) => {
    const remove = (e.target as Element).closest<HTMLButtonElement>("[data-remove]");
    if (!remove) return;
    selected = selected.filter((s) => s !== remove.dataset.remove);
    render();
    setFavorites(selected);
    addButton.focus();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validate(form)) return;

    const data = new FormData(form);
    const name = String(data.get("name") ?? "");
    const email = String(data.get("email") ?? "");
    const phone = getPhoneValue(form, PHONE_ID);
    // The team reads these emails, so projects are named in English whatever the page language.
    const englishNames = selected.map((slug) => String(lookup("en", `projectsData.${slug}.name`) ?? slug));
    const englishTopics = topics.map((topic) => String(lookup("en", `contact.topics.${topic}.label`) ?? topic));
    const subject =
      String(data.get("subject") ?? "").trim() ||
      (englishNames.length
        ? `Project Inquiry: ${englishNames.join(", ")}${englishTopics.length ? ` + ${englishTopics.join(", ")}` : ""}`
        : englishTopics.length
          ? englishTopics.join(" + ")
          : "Website Inquiry");
    const message = String(data.get("message") ?? "");

    const body = [
      ...(englishNames.length
        ? [
            `${englishNames.length > 1 ? "Projects" : "Project"}: ${englishNames.join(", ")}`,
            ...selected.map((slug, i) => `${englishNames[i]}: ${window.location.origin}/projects/${slug}`),
            ""
          ]
        : []),
      ...(englishTopics.length ? [`Interests: ${englishTopics.join(", ")}`, ""] : []),
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      `Language: ${getLocale().toUpperCase()}`,
      ...(campaignSource() ? [`Source: ${campaignSource()}`] : []),
      "",
      message
    ].join("\n");

    const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;

    successBox.hidden = false;
    form.reset();
    selected = [...initial];
    topics = [...initialTopics];
    suggested = projectMessage(initial, initialTopics);
    render();
  });
}
