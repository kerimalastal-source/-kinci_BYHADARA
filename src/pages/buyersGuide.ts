import { t, tRaw, link } from "../i18n";
import { initScrollReveal } from "../components/scrollReveal";
import { WHATSAPP_ICON, WHATSAPP_NUMBER } from "../components/floatingButtons";
import { heroBackground } from "../utils/responsiveImage";
import { blogPosts } from "../data/blog";
import { renderPhoneInput, getPhoneValue, isPhoneFilled, isPhoneValid, setPhoneInvalid } from "../components/phoneInput";
import { honeypotField, sendInquiry, setSending, showLimit, showMailtoSent } from "../utils/inquiry";
import { trackLead } from "../utils/tracking";
import { escapeHtml } from "../utils/html";

interface Step {
  title: string;
  text: string;
}
interface Stage {
  label: string;
  title: string;
  intro: string;
  steps: Step[];
}

/** Where each step's "learn more" link goes, in the order of `guide.stages[].steps` (null = no link). */
const STEP_LINKS: (string | null)[][] = [
  ["/blog/real-estate-in-turkey", "/blog/apartment-or-villa", "/blog/gross-vs-net-area", "/blog/off-plan-or-ready", "/video-tour", "/blog/buying-property-and-tapu"],
  [null, null, null, "/blog/real-estate-valuation", "/citizenship", "/blog/taxes-and-tapu-fees"],
  [null, null, null, null, "/citizenship", "/blog/life-in-turkey"]
];

/** Anchor ids of the three stages (also the targets of the stage bar). */
const STAGE_IDS = ["before", "purchase", "after"];

const HERO_PHOTO = { src: "/images/projects/marmara-haven-villa/sunset.jpg", width: 1500 };

const ARROW =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';
const TOUR_ICON =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2"></rect></svg>';
const TIP_ICON =
  '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M12 2a7 7 0 0 0-4 12.74V16h8v-1.26A7 7 0 0 0 12 2z"></path></svg>';

/** The question box's stage choices (keys of `guide.ask.stages`, also saved in the inbox). */
const ASK_STAGES = ["before", "purchase", "after", "other"];
const PHONE_ID = "gq-phone";
const CONTACT_EMAIL = "info@byhadara.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHECK =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';

const pad = (n: number) => String(n).padStart(2, "0");

/** Name of a link target: the article's title, or the page's menu name. */
function targetName(path: string): string {
  if (path.startsWith("/blog/")) {
    const slug = path.slice(6);
    return blogPosts.some((p) => p.slug === slug) ? t(`blogData.${slug}.title`) : "";
  }
  if (path === "/video-tour") return t("videoTour.nav");
  if (path === "/citizenship") return t("nav.citizenship");
  return "";
}

function stepCard(step: Step, stage: number, index: number): string {
  const target = STEP_LINKS[stage]?.[index] ?? null;
  const name = target ? targetName(target) : "";
  return `
          <li class="guide-step" data-reveal data-reveal-index="${index % 2}">
            <span class="guide-step__num" dir="ltr">${pad(index + 1)}</span>
            <div class="guide-step__body">
              <h3>${step.title}</h3>
              <p>${step.text}</p>
              ${
                target && name
                  ? `<a class="guide-step__more" href="${link(target)}"><span class="guide-step__more-label">${t("guide.more")}</span><span class="guide-step__more-title">${name}${ARROW}</span></a>`
                  : ""
              }
            </div>
          </li>`;
}

function stageSection(stage: Stage, i: number): string {
  return `
    <section class="section guide-stage${i % 2 ? " guide-stage--alt" : ""}" id="${STAGE_IDS[i]}" aria-labelledby="${STAGE_IDS[i]}-title">
      <div class="container guide-stage__inner">
        <header class="guide-stage__head">
          <span class="guide-stage__num" dir="ltr" aria-hidden="true">${pad(i + 1)}</span>
          <p class="eyebrow">${stage.label}</p>
          <h2 class="section-title" id="${STAGE_IDS[i]}-title">${stage.title}</h2>
          <p class="guide-stage__intro">${stage.intro}</p>
        </header>
        <ol class="guide-steps">
          ${stage.steps.map((s, j) => stepCard(s, i, j)).join("")}
        </ol>
      </div>
    </section>`;
}

/** "Ask our team": a question about a step, saved in the inquiries inbox (kind contact, details.form = guide). */
function askSection(): string {
  const points = tRaw<string[]>("guide.ask.points");
  return `
    <section class="section guide-ask" id="ask" aria-labelledby="ask-title">
      <div class="container guide-ask__inner">
        <div class="guide-ask__intro">
          <p class="eyebrow">${t("guide.ask.eyebrow")}</p>
          <h2 class="section-title" id="ask-title">${t("guide.ask.title")}</h2>
          <p class="guide-ask__text">${t("guide.ask.text")}</p>
          <ul class="guide-ask__points">
            ${points.map((point) => `<li>${CHECK}<span>${point}</span></li>`).join("")}
          </ul>
        </div>
        <form class="contact-form guide-ask__form" id="guide-question-form" novalidate>
          <div class="form-row">
            <div class="form-field">
              <label for="gq-name">${t("contact.nameLabel")}</label>
              <input type="text" id="gq-name" name="name" placeholder="${t("contact.namePlaceholder")}" autocomplete="name" />
              <p class="form-field__error" data-error-for="name"></p>
            </div>
            <div class="form-field">
              <label for="gq-email">${t("contact.emailLabel")}</label>
              <input dir="ltr" type="email" id="gq-email" name="email" placeholder="${t("contact.emailPlaceholder")}" autocomplete="email" />
              <p class="form-field__error" data-error-for="email"></p>
            </div>
          </div>
          <div class="form-field">
            <label for="${PHONE_ID}-number">${t("contact.phoneLabel")}</label>
            ${renderPhoneInput(PHONE_ID, "phone")}
            <p class="form-field__error" data-error-for="phone"></p>
          </div>
          <div class="form-field">
            <label for="gq-stage">${t("guide.ask.stageLabel")}</label>
            <select id="gq-stage" name="stage">
              ${ASK_STAGES.map((key) => `<option value="${key}">${t(`guide.ask.stages.${key}`)}</option>`).join("")}
            </select>
          </div>
          <div class="form-field">
            <label for="gq-message">${t("guide.ask.messageLabel")}</label>
            <textarea id="gq-message" name="message" rows="5" placeholder="${t("guide.ask.messagePlaceholder")}"></textarea>
            <p class="form-field__error" data-error-for="message"></p>
          </div>
          ${honeypotField()}
          <button type="submit" class="btn btn--primary guide-ask__submit" id="gq-submit">${t("guide.ask.submit")}</button>
          <p class="guide-ask__note">${t("guide.ask.note")}</p>
          <div class="contact-form__success" id="gq-success" role="status" hidden>
            <strong>${t("contact.successTitle")}</strong>
            <p>${t("contact.successText")}</p>
          </div>
        </form>
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
  const checks: [string, string][] = [
    ["name", value("name") ? "" : t("contact.errors.nameRequired")],
    ["email", !value("email") ? t("contact.errors.emailRequired") : EMAIL_RE.test(value("email")) ? "" : t("contact.errors.emailInvalid")],
    ["message", value("message").length >= 10 ? "" : t("guide.ask.messageRequired")]
  ];
  for (const [field, error] of checks) setError(form, field, error);
  const phoneError = !isPhoneFilled(form, PHONE_ID) ? t("contact.errors.phoneRequired") : isPhoneValid(form, PHONE_ID) ? "" : t("contact.errors.phoneInvalid");
  setError(form, "phone", phoneError);
  setPhoneInvalid(form, PHONE_ID, !!phoneError);
  const firstInvalid = form.querySelector<HTMLElement>('[aria-invalid="true"]');
  firstInvalid?.focus();
  return !firstInvalid && !phoneError;
}

function initAskForm(el: HTMLElement): void {
  const form = el.querySelector<HTMLFormElement>("#guide-question-form");
  if (!form) return;
  const successBox = form.querySelector<HTMLElement>("#gq-success")!;
  const submitButton = form.querySelector<HTMLButtonElement>("#gq-submit");
  const openedAt = Date.now();
  let sending = false;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending || !validate(form)) return;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const phone = getPhoneValue(form, PHONE_ID);
    const stage = ASK_STAGES.includes(String(data.get("stage"))) ? String(data.get("stage")) : "other";
    const message = String(data.get("message") ?? "").trim();

    sending = true;
    successBox.hidden = true;
    setSending(submitButton, true);
    const result = await sendInquiry(form, { kind: "contact", name, email, phone, message, details: { form: "guide", stage } }, openedAt);
    sending = false;
    setSending(submitButton, false);
    if (result.status === "limit") return showLimit(successBox);

    trackLead("guide-question", stage, { email, phone, name });
    if (result.status === "sent") {
      successBox.innerHTML = `<strong>${t("guide.ask.sentTitle")}</strong>
        <p>${t("guide.ask.sentText")}</p>
        <p class="contact-form__reference">${t("inquiry.reference", { ref: `<bdi dir="ltr">${escapeHtml(result.reference)}</bdi>` })}</p>`;
      successBox.classList.remove("contact-form__success--warn");
      successBox.hidden = false;
      successBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      // The inbox couldn't take it: the visitor's email app, as on the contact form.
      const body = [`Buyer's Guide question (${stage})`, "", `Name: ${name}`, `Email: ${email}`, `Phone: ${phone}`, "", message].join("\n");
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Buyer's Guide question")}&body=${encodeURIComponent(body)}`;
      showMailtoSent(successBox);
    }
    form.reset();
  });
}

/** Highlights the stage the reader is in on the sticky stage bar. */
function initStageBar(el: HTMLElement): void {
  const links = [...el.querySelectorAll<HTMLAnchorElement>(".guide-bar__link")];
  // The question box is watched too: once the reader reaches it, no stage is highlighted.
  const sections = [...STAGE_IDS, "ask"].map((id) => el.querySelector<HTMLElement>(`#${id}`)).filter((s): s is HTMLElement => !!s);
  if (!links.length || !sections.length || !("IntersectionObserver" in window)) return;
  const setActive = (id: string) =>
    links.forEach((a) => {
      const on = a.dataset.stage === id;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "step");
      else a.removeAttribute("aria-current");
    });
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive((visible[0].target as HTMLElement).id);
    },
    { rootMargin: "-35% 0px -55% 0px" }
  );
  sections.forEach((s) => observer.observe(s));
  links.forEach((a) =>
    a.addEventListener("click", (e) => {
      const target = el.querySelector<HTMLElement>(`#${a.dataset.stage}`);
      if (!target) return;
      e.preventDefault();
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      setActive(a.dataset.stage ?? "");
    })
  );
}

export function renderBuyersGuide(el: HTMLElement): void {
  const stages = tRaw<Stage[]>("guide.stages");
  const whatsapp = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t("guide.whatsappMessage"))}`;

  el.innerHTML = `
    <section class="page-hero guide-hero" style="${heroBackground(HERO_PHOTO, "linear-gradient(180deg, rgba(15,43,33,.4), rgba(15,43,33,.82))")}">
      <div class="container">
        <p class="eyebrow eyebrow--on-dark">${t("guide.heroEyebrow")}</p>
        <h1>${t("guide.heroTitle")}</h1>
        <p class="page-hero__subtitle">${t("guide.heroSubtitle")}</p>
        <ol class="guide-hero__stages">
          ${stages
            .map(
              (s, i) => `
          <li><a href="#${STAGE_IDS[i]}" class="guide-hero__stage"><span dir="ltr">${pad(i + 1)}</span>${s.label}<small>${t("guide.stepsCount", { count: s.steps.length })}</small></a></li>`
            )
            .join("")}
        </ol>
      </div>
    </section>

    <nav class="guide-bar" aria-label="${t("guide.stagesLabel")}">
      <div class="container guide-bar__inner">
        ${stages
          .map(
            (s, i) =>
              `<a class="guide-bar__link${i === 0 ? " is-active" : ""}" href="#${STAGE_IDS[i]}" data-stage="${STAGE_IDS[i]}"><span dir="ltr">${pad(i + 1)}</span>${s.label}</a>`
          )
          .join("")}
      </div>
    </nav>

    ${stages.map(stageSection).join("")}

    <section class="section guide-tip-section">
      <div class="container narrow">
        <aside class="guide-tip" data-reveal>
          <span class="guide-tip__icon">${TIP_ICON}</span>
          <div>
            <h2>${t("guide.tipTitle")}</h2>
            <p>${t("guide.tipText")}</p>
          </div>
        </aside>
        <p class="guide-note">${t("guide.note")}</p>
      </div>
    </section>

    ${askSection()}

    <section class="section final-cta">
      <div class="container final-cta__inner">
        <div class="cz-cta__text">
          <h2 class="section-title">${t("guide.ctaTitle")}</h2>
          <p>${t("guide.ctaText")}</p>
        </div>
        <div class="cz-cta__actions guide-cta__actions">
          <a class="btn btn--primary" href="${whatsapp}" target="_blank" rel="noopener">${WHATSAPP_ICON}${t("guide.ctaWhatsapp")}</a>
          <a class="btn btn--ghost" href="${link("/video-tour")}">${TOUR_ICON}${t("guide.ctaTour")}</a>
        </div>
      </div>
    </section>
  `;

  initScrollReveal(el);
  initStageBar(el);
  initAskForm(el);
}
