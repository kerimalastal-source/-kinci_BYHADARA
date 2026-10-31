import { t, getLocale, getProjectContent, placeLine, listSep } from "../i18n";
import { getProjectBySlug, getSortedProjects } from "../data/projects";
import { escapeHtml } from "../utils/html";
import { renderPhoneInput, getPhoneValue, isPhoneFilled, isPhoneValid, setPhoneInvalid, setPhoneValue } from "./phoneInput";
import {
  APPS,
  LANGUAGES,
  appIcon,
  CHECK,
  CALENDAR,
  EMAIL,
  ISTANBUL_TZ,
  availableDays,
  firstFree,
  formatDay,
  formatTime,
  googleCalendarUrl,
  isBlocked,
  loadTaken,
  localTime,
  periodOf,
  relativeDay,
  sendBooking,
  slotLabel,
  slotUtc,
  weekday,
  zoneLabel,
  type App,
  type Language,
  type TourState
} from "./videoTourBooking";

/**
 * Booking a private video tour inside the chat assistant: project(s) -> day and time -> app,
 * language and contact details, then the same /api/book as the video-tour page (same free
 * slots, emails and team alerts). One booking is in progress at a time; its state lives in
 * sessionStorage so it survives a page change or a language switch.
 */

const STORE_KEY = "hadara-chat-tour";
const PHONE_ID = "chat-tour-phone";

interface ChatBooking {
  /** The chat entry that shows this booking. */
  id: number;
  state: TourState;
  /** When the booking started: one sent seconds later is a bot (api/book.ts checks it). */
  openedAt: number;
  /** A message under the current step (validation, a slot just taken, a failed send). */
  error?: string;
  /** Which field the error is about, so the field is marked and focused. */
  errorField?: "name" | "email" | "phone";
}

let booking: ChatBooking | null = load();
let sending = false;
let repaint: (scroll?: boolean) => void = () => {};
/** Focus the field with the error once, after the repaint that shows it. */
let focusError = false;

function load(): ChatBooking | null {
  try {
    return JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "null") as ChatBooking | null;
  } catch {
    return null;
  }
}

function save(): void {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(booking));
  } catch {
    // storage unavailable: the booking just won't survive a reload
  }
}

const bookable = (slug: string) => {
  const p = getProjectBySlug(slug);
  return !!p && !p.soldOut;
};

/** Called by the chat to repaint the booking after availability loads or a step changes. */
export function onBookingChange(fn: (scroll?: boolean) => void): void {
  repaint = fn;
}

/** The chat started over: drop the booking in progress. */
export function cancelBooking(): void {
  booking = null;
  save();
}

/** Starts a booking shown by chat entry `id`, with the projects already chosen (if any). */
export function startBooking(id: number, slugs: string[]): void {
  const projects = slugs.filter(bookable);
  booking = {
    id,
    openedAt: Date.now(),
    state: {
      step: projects.length ? 1 : 0,
      projects,
      focus: [],
      app: "whatsapp",
      lang: getLocale() === "ar" ? "ar" : "en",
      contact: "whatsapp"
    }
  };
  save();
  refreshTaken();
}

/** Continues an unfinished booking under a new chat entry. */
export function resumeBooking(id: number): void {
  if (!booking) return;
  booking.id = id;
  save();
  refreshTaken();
}

export const activeBookingId = () => booking?.id ?? -1;

function refreshTaken(): void {
  void loadTaken().then(() => {
    const s = booking?.state;
    // Someone else took the chosen time meanwhile: choose again.
    if (s?.date && s.hour !== undefined && isBlocked(s.date, s.hour)) {
      delete s.hour;
      if (s.step > 1) s.step = 1;
      save();
    }
    repaint();
  });
}

/* ---------- Rendering ---------- */

const projectName = (slug: string) => getProjectContent(slug).name;
const ltr = (text: string) => `<bdi dir="ltr">${text}</bdi>`;

function stepLine(step: number): string {
  return `<p class="cb-step">${t("videoTour.wizard.progress", { current: step + 1, total: 3 })}</p>`;
}

function errorLine(b: ChatBooking): string {
  return `<p class="cb-error" role="alert">${b.error ?? ""}</p>`;
}

function renderProjects(b: ChatBooking): string {
  const projects = getSortedProjects().filter((p) => !p.soldOut);
  return `
    ${stepLine(0)}
    <p class="cb-q">${t("videoTour.wizard.projectQuestion")}</p>
    <p class="cb-hint">${t("videoTour.wizard.projectHint")}</p>
    <div class="cb-projects">
      ${projects
        .map(
          (p) => `
        <button type="button" class="cb-project" data-cb-project="${p.slug}" aria-pressed="${b.state.projects.includes(p.slug)}">
          <span class="cb-project__check">${CHECK}</span>
          <span class="cb-project__text"><span class="cb-project__name">${projectName(p.slug)}</span><span class="cb-project__place">${placeLine(p.district, p.city)}</span></span>
        </button>`
        )
        .join("")}
    </div>
    ${errorLine(b)}
    <div class="cb-nav"><button type="button" class="chat-action chat-action--tour" data-cb-next>${t("videoTour.wizard.next")}</button></div>`;
}

function renderTime(b: ChatBooking): string {
  const s = b.state;
  const days = availableDays();
  const day = days.find((d) => d.date === s.date) ?? days[0];
  if (!day) return `<p>${t("videoTour.wizard.chooseTime")}</p>`;
  const first = firstFree(days);
  const showsLocal = days.some((d) => d.hours.some((h) => localTime(slotUtc(d.date, h)) !== null));
  const groups = (["morning", "afternoon", "evening"] as const)
    .map((period) => ({ period, hours: day.hours.filter((h) => periodOf(h) === period) }))
    .filter((g) => g.hours.length);
  return `
    ${stepLine(1)}
    <p class="cb-picked">${s.projects.map(projectName).join(listSep())} <button type="button" class="cb-link" data-cb-step="0">${t("chat.book.change")}</button></p>
    <p class="cb-q">${t("videoTour.wizard.timeQuestion")}</p>
    <p class="cb-hint">${showsLocal ? t("videoTour.wizard.timeNote", { zone: ltr(zoneLabel()) }) : t("videoTour.wizard.sameZone")}</p>
    ${
      first
        ? `<button type="button" class="cb-earliest" data-cb-slot="${first.date}|${first.hour}"><span class="cb-earliest__dot" aria-hidden="true"></span><span>${t(
            "videoTour.wizard.earliest",
            { when: `<strong>${slotLabel(first.date, first.hour)}</strong>` }
          )}</span></button>`
        : ""
    }
    <div class="cb-days" role="group" aria-label="${t("videoTour.wizard.timeQuestion")}">
      ${days
        .map(
          (d) => `
        <button type="button" class="cb-day" data-cb-day="${d.date}" aria-pressed="${d.date === day.date}">
          <span class="cb-day__week">${relativeDay(d.date) ?? weekday(d.date)}</span>
          <span class="cb-day__date">${formatDay(d.date, "chip")}</span>
        </button>`
        )
        .join("")}
    </div>
    ${groups
      .map(
        (g) => `
      <p class="cb-period">${t(`videoTour.wizard.periods.${g.period}`)}</p>
      <div class="cb-slots">
        ${g.hours
          .map((h) => {
            const ms = slotUtc(day.date, h);
            if (isBlocked(day.date, h)) {
              return `<button type="button" class="cb-slot is-taken" disabled><span class="cb-slot__time">${formatTime(ms, ISTANBUL_TZ)}</span><span class="cb-slot__local">${t("videoTour.wizard.taken")}</span></button>`;
            }
            const local = localTime(ms);
            const on = s.date === day.date && s.hour === h;
            return `<button type="button" class="cb-slot" data-cb-slot="${day.date}|${h}" aria-pressed="${on}"><span class="cb-slot__time">${formatTime(ms, ISTANBUL_TZ)}</span>${
              local ? `<span class="cb-slot__local">${local}</span>` : ""
            }</button>`;
          })
          .join("")}
      </div>`
      )
      .join("")}
    ${errorLine(b)}
    <div class="cb-nav"><button type="button" class="cb-link" data-cb-step="0">${t("videoTour.wizard.back")}</button></div>`;
}

/** "Tuesday 4 November · 11:00 Istanbul time (12:00 your time)" */
function whenLine(s: TourState): string {
  const ms = slotUtc(s.date!, s.hour!);
  const local = localTime(ms);
  return `${formatDay(s.date!, "long")} · <bdi>${formatTime(ms, ISTANBUL_TZ)}</bdi> ${t("videoTour.wizard.istanbulTime")}${
    local ? `<span class="cb-local"><bdi>${local}</bdi> ${t("videoTour.wizard.yourTime")}</span>` : ""
  }`;
}

function renderDetails(b: ChatBooking): string {
  const s = b.state;
  const invalid = (field: string) => (b.errorField === field ? ' aria-invalid="true"' : "");
  return `
    ${stepLine(2)}
    <div class="cb-summary">
      <p><span>${t("videoTour.wizard.summary.projects")}</span>${s.projects.map(projectName).join(listSep())}</p>
      <p><span>${t("videoTour.wizard.summary.when")}</span>${whenLine(s)} <button type="button" class="cb-link" data-cb-step="1">${t("chat.book.change")}</button></p>
    </div>
    <form class="cb-form" data-cb-form novalidate>
      <p class="cb-label">${t("videoTour.wizard.appLabel")}</p>
      <div class="cb-chips">
        ${APPS.map(
          (app) =>
            `<button type="button" class="cb-chip" data-cb-app="${app}" aria-pressed="${s.app === app}">${appIcon(app)}<span>${t(`videoTour.wizard.apps.${app}`)}</span></button>`
        ).join("")}
      </div>
      <p class="cb-label">${t("videoTour.wizard.languageLabel")}</p>
      <div class="cb-chips">
        ${LANGUAGES.map(
          (lang) =>
            `<button type="button" class="cb-chip" data-cb-lang="${lang}" aria-pressed="${s.lang === lang}" lang="${lang}">${CHECK}<span>${t(`videoTour.languages.${lang}`)}</span></button>`
        ).join("")}
      </div>
      <label class="cb-label" for="cb-name">${t("videoTour.wizard.nameLabel")}</label>
      <input class="cb-input" type="text" id="cb-name" name="name" maxlength="120" autocomplete="name" placeholder="${t("videoTour.wizard.namePlaceholder")}" value="${escapeHtml(s.name ?? "")}"${invalid("name")} />
      <label class="cb-label" for="cb-email">${t("videoTour.wizard.emailLabel")}</label>
      <input class="cb-input" type="email" id="cb-email" name="email" maxlength="160" autocomplete="email" inputmode="email" dir="ltr" placeholder="${t("videoTour.wizard.emailPlaceholder")}" value="${escapeHtml(s.email ?? "")}"${invalid("email")} />
      <label class="cb-label" for="${PHONE_ID}-number">${t("videoTour.wizard.phoneLabel")}</label>
      ${renderPhoneInput(PHONE_ID, "phone")}
      <div class="tour-hp" aria-hidden="true"><label>${t("videoTour.wizard.honeypot")} <input type="text" name="website" tabindex="-1" autocomplete="off" data-cb-hp /></label></div>
      ${errorLine(b)}
      <button type="submit" class="chat-action chat-action--tour cb-submit"${sending ? ' disabled aria-busy="true"' : ""}>${CALENDAR}<span>${t(
        sending ? "videoTour.wizard.booking" : "videoTour.wizard.confirm"
      )}</span></button>
      <p class="cb-note">${t("videoTour.wizard.confirmNote")}</p>
    </form>
    <div class="cb-nav"><button type="button" class="cb-link" data-cb-step="1">${t("videoTour.wizard.back")}</button></div>`;
}

/** The confirmation kept in the conversation after a booking is saved. */
export function renderBookingDone(s: TourState): string {
  return `
    <div class="cb-done">
      <p class="cb-done__title"><span class="cb-done__icon">${CHECK}</span>${t("videoTour.wizard.doneTitle", { name: escapeHtml(s.name ?? "") })}</p>
      <p>${s.projects.map(projectName).join(listSep())}</p>
      <p>${whenLine(s)}</p>
      <p>${t("videoTour.wizard.referenceLabel")}: <strong dir="ltr">${escapeHtml(s.reference ?? "")}</strong></p>
      <p>${t("videoTour.wizard.doneText", { email: ltr(escapeHtml(s.email ?? "")), app: t(`videoTour.wizard.apps.${s.app}`) })}</p>
      <div class="chat-actions">
        <a class="chat-action" href="${googleCalendarUrl(s)}" target="_blank" rel="noopener">${CALENDAR}${t("videoTour.wizard.calendarGoogle")}</a>
      </div>
    </div>`;
}

/** The booking shown by chat entry `id`: the live steps, or a way back to it when the chat moved on. */
export function renderBooking(id: number, isLast: boolean): string {
  const b = booking;
  if (!b || b.id !== id) return `<p>${t("chat.book.closed")}</p>`;
  if (!isLast) {
    return `<p>${t("chat.book.paused")}</p><div class="chat-actions"><button type="button" class="chat-action chat-action--tour" data-chat-book-resume>${t("chat.book.resume")}</button></div>`;
  }
  const intro = b.state.step === 0 || (b.state.step === 1 && !b.state.date) ? `<p class="cb-intro">${t("chat.book.intro")}</p>` : "";
  const step = b.state.step === 0 ? renderProjects(b) : b.state.step === 1 ? renderTime(b) : renderDetails(b);
  return `<div class="cb" data-cb>${intro}${step}</div>`;
}

/** Restores the typed phone after a repaint (the phone field rebuilds its country picker). */
export function afterBookingRender(root: ParentNode): void {
  const phone = booking?.state.phone;
  if (phone && root.querySelector(`#${PHONE_ID}-number`)) setPhoneValue(root, PHONE_ID, phone);
  if (booking?.errorField === "phone") setPhoneInvalid(root, PHONE_ID, true);
  if (booking?.errorField && focusError) {
    focusError = false;
    root.querySelector<HTMLElement>(booking.errorField === "phone" ? `#${PHONE_ID}-number` : `#cb-${booking.errorField}`)?.focus();
  }
}

/* ---------- Behaviour ---------- */

/** Keeps what the visitor typed, so a repaint (choosing an app, say) doesn't clear it. */
export function syncBookingFields(root: ParentNode): void {
  const s = booking?.state;
  const form = root.querySelector<HTMLFormElement>("[data-cb-form]");
  if (!s || !form) return;
  s.name = form.querySelector<HTMLInputElement>("#cb-name")?.value.trim() ?? s.name;
  s.email = form.querySelector<HTMLInputElement>("#cb-email")?.value.trim() ?? s.email;
  if (isPhoneFilled(form, PHONE_ID)) s.phone = getPhoneValue(form, PHONE_ID);
  // The field the message was about is filled now: drop the message (submit checks again).
  const b = booking!;
  if (b.errorField && (b.errorField === "phone" ? isPhoneFilled(form, PHONE_ID) : s[b.errorField])) b.error = b.errorField = undefined;
  save();
}

function setStep(step: 0 | 1 | 2): void {
  if (!booking) return;
  booking.state.step = step;
  booking.error = undefined;
  booking.errorField = undefined;
  save();
  repaint(true);
}

/** Handles a click inside the booking; true when it was one. */
export function bookingClick(target: Element, root: ParentNode): boolean {
  const b = booking;
  if (!b || !target.closest("[data-cb]")) return false;
  const s = b.state;
  syncBookingFields(root);
  const project = target.closest<HTMLElement>("[data-cb-project]")?.dataset.cbProject;
  if (project) {
    s.projects = s.projects.includes(project) ? s.projects.filter((p) => p !== project) : [...s.projects, project];
    b.error = undefined;
    save();
    repaint();
    return true;
  }
  if (target.closest("[data-cb-next]")) {
    if (!s.projects.length) {
      b.error = t("videoTour.wizard.chooseProject");
      save();
      repaint();
    } else setStep(1);
    return true;
  }
  const step = target.closest<HTMLElement>("[data-cb-step]")?.dataset.cbStep;
  if (step) {
    setStep(Number(step) as 0 | 1 | 2);
    return true;
  }
  const day = target.closest<HTMLElement>("[data-cb-day]")?.dataset.cbDay;
  if (day) {
    s.date = day;
    delete s.hour;
    save();
    repaint();
    return true;
  }
  const slot = target.closest<HTMLElement>("[data-cb-slot]")?.dataset.cbSlot;
  if (slot) {
    const [date, hour] = slot.split("|");
    s.date = date;
    s.hour = Number(hour);
    setStep(2);
    return true;
  }
  const app = target.closest<HTMLElement>("[data-cb-app]")?.dataset.cbApp as App | undefined;
  if (app) {
    s.app = app;
    save();
    repaint();
    return true;
  }
  const lang = target.closest<HTMLElement>("[data-cb-lang]")?.dataset.cbLang as Language | undefined;
  if (lang) {
    s.lang = lang;
    save();
    repaint();
    return true;
  }
  return false;
}

/**
 * Sends the booking. Resolves to the saved booking (for the chat to keep as a confirmation),
 * or null when it stays open with a message (missing details, a taken slot, a failed send).
 */
export async function submitBooking(form: HTMLFormElement): Promise<TourState | null> {
  const b = booking;
  if (!b || sending) return null;
  syncBookingFields(form);
  const s = b.state;
  b.error = undefined;
  b.errorField = undefined;
  if (!s.name) [b.error, b.errorField] = [t("videoTour.wizard.errors.name"), "name"];
  else if (!s.email) [b.error, b.errorField] = [t("videoTour.wizard.errors.email"), "email"];
  else if (!EMAIL.test(s.email)) [b.error, b.errorField] = [t("videoTour.wizard.errors.emailInvalid"), "email"];
  else if (!isPhoneFilled(form, PHONE_ID)) [b.error, b.errorField] = [t("videoTour.wizard.errors.phone"), "phone"];
  else if (!isPhoneValid(form, PHONE_ID)) [b.error, b.errorField] = [t("videoTour.wizard.errors.phoneInvalid"), "phone"];
  if (b.error) {
    focusError = true;
    save();
    repaint();
    return null;
  }
  s.phone = getPhoneValue(form, PHONE_ID);
  sending = true;
  repaint();
  const { status, reference } = await sendBooking(s, b.openedAt, form.querySelector<HTMLInputElement>("[data-cb-hp]")?.value ?? "");
  sending = false;
  if (reference) {
    const done: TourState = { ...s, reference, step: 3 };
    booking = null;
    save();
    return done;
  }
  if (status === 409) {
    // Someone else took this time a moment ago: back to the times, with fresh availability.
    delete s.hour;
    s.step = 1;
    b.error = t("videoTour.wizard.slotTakenNotice");
    save();
    repaint(true);
    refreshTaken();
    return null;
  }
  b.error = t(status === 429 ? "videoTour.wizard.errors.limit" : status === 400 ? "videoTour.wizard.errors.invalid" : "videoTour.wizard.errors.failed");
  save();
  repaint();
  return null;
}
