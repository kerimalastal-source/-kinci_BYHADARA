import { t, tRaw, link, getLocale, getProjectContent, placeLine } from "../i18n";
import { lookup } from "../i18n/dictionaries";
import { getProjectBySlug, getSortedProjects } from "../data/projects";
import { campaignSource } from "../utils/campaign";
import { trackSchedule } from "../utils/tracking";
import { renderPhoneInput, getPhoneValue, isPhoneFilled, isPhoneValid, setPhoneInvalid } from "./phoneInput";
import { WHATSAPP_ICON, WHATSAPP_NUMBER } from "./floatingButtons";
import { photoAttrs } from "../utils/responsiveImage";
import { supabase } from "../lib/supabase";

/**
 * Private video tour booking: project(s) -> day and time (shown in Istanbul time and the
 * visitor's own) -> app, language and contact details. "Book" sends it to /api/book
 * (api/book.ts): the slot is taken in the database right away (one tour per half-hour
 * slot, so booked times and the lunch break show greyed out as booked), the visitor gets
 * a confirmation email and the team an
 * email + Telegram alert. Booking through WhatsApp stays available as an alternative.
 */

const APPS = ["whatsapp", "facetime", "zoom", "meet"] as const;
const LANGUAGES = ["ar", "en", "tr"] as const;
const FOCUS = ["apartment", "model", "prices", "citizenship"] as const;
const CONTACTS = ["email", "phone", "whatsapp", "telegram", "viber"] as const;
type App = (typeof APPS)[number];
type Contact = (typeof CONTACTS)[number];
type Language = (typeof LANGUAGES)[number];

/** Türkiye keeps UTC+3 all year. */
const ISTANBUL_OFFSET_MIN = 180;
const ISTANBUL_TZ = "Europe/Istanbul";
/**
 * Tours start every half hour from 9:00 to 18:30 (the team works 9:00–19:00, every day).
 * Times are hours as numbers: 9.5 is 9:30.
 */
const FIRST_HOUR = 9;
const LAST_HOUR = 18.5;
const STEP_HOURS = 0.5;
/** The team's lunch break: shown as booked, never bookable (the database refuses them too). */
const LUNCH_HOURS: readonly number[] = [12, 12.5, 13];
/** The earliest bookable slot is at least this far away, so the team can confirm it. */
const LEAD_MINUTES = 60;
const DAYS_AHEAD = 14;
const TOUR_MINUTES = 45;
const PHONE_ID = "tour-phone";
const STORE_KEY = "hadara-tour";

interface TourState {
  step: 0 | 1 | 2 | 3;
  projects: string[];
  focus: string[];
  /** "2026-10-05", an Istanbul calendar day. */
  date?: string;
  hour?: number;
  app: App;
  lang: Language;
  name?: string;
  /** Country code and national number as typed, kept while the visitor moves between steps. */
  dial?: string;
  number?: string;
  /** "+90 5xx…", fixed when the request is sent. */
  phone?: string;
  email?: string;
  /** How the visitor prefers to be contacted if the team needs to reach them. */
  contact: Contact;
  /** Set once the booking is saved ("HT-XXXXXX"). */
  reference?: string;
}

const svg = (body: string, size = 22) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const CHECK = svg('<path d="m5 12 5 5 9-10"/>', 14);
const VIDEO = svg('<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="m15.5 10.5 6-3.5v10l-6-3.5"/>');
const APP_ICONS: Record<App, string> = {
  whatsapp: WHATSAPP_ICON,
  facetime: VIDEO,
  zoom: svg('<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="m10 8.5 4 2-4 2z"/>'),
  meet: svg('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9.5" r="2.4"/><path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.3c.6-.2 1.3-.3 2-.3 2.5 0 4.5 2 4.5 4.5"/>')
};
const CALENDAR = svg('<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M12 13v3.5M10.25 14.75h3.5"/>', 18);
const PARTY = svg('<path d="m5 12 5 5 9-10"/>', 34);

/* ---------- State ---------- */

const defaultLanguage = (): Language => (getLocale() === "ar" ? "ar" : "en");
const fresh = (projects: string[] = []): TourState => ({
  step: 0,
  projects,
  focus: [],
  app: "whatsapp",
  lang: defaultLanguage(),
  contact: "email"
});

function loadState(): TourState | null {
  try {
    return JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "null") as TourState | null;
  } catch {
    return null;
  }
}

function saveState(state: TourState): void {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable: the booking just won't survive a reload
  }
}

const bookable = (slug: string) => {
  const p = getProjectBySlug(slug);
  return !!p && !p.soldOut;
};

/** The saved booking, or a fresh one for the projects in ?project= when the visitor arrives from another project. */
function initialState(fromUrl: string[]): TourState {
  const saved = loadState();
  const state: TourState = saved ?? fresh();
  const sameProjects = fromUrl.every((slug) => state.projects.includes(slug));
  if (fromUrl.length && (!sameProjects || state.step === 3)) return fresh(fromUrl);
  state.projects = state.projects.filter(bookable);
  if (state.date && (state.hour === undefined || isLunch(state.hour) || slotUtc(state.date, state.hour) < earliestAllowed())) {
    delete state.date;
    delete state.hour;
  }
  if (state.step > 0 && !state.projects.length) state.step = 0;
  if (state.step > 1 && !state.date) state.step = 1;
  if (!CONTACTS.includes(state.contact)) state.contact = "email";
  // A confirmation screen without a booking number is from the old WhatsApp-only flow.
  if (state.step === 3 && (!state.name || !state.reference)) state.step = 2;
  return state;
}

/* ---------- Time ---------- */

const pad = (n: number) => String(n).padStart(2, "0");
const localeTag = () => `${getLocale()}-u-nu-latn`;
const earliestAllowed = () => Date.now() + LEAD_MINUTES * 60_000;

/** UTC instant of an Istanbul day + time (9.5 = 9:30). */
function slotUtc(date: string, hour: number): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 0, Math.round(hour * 60)) - ISTANBUL_OFFSET_MIN * 60_000;
}

function istanbulDay(ms: number): string {
  const x = new Date(ms + ISTANBUL_OFFSET_MIN * 60_000);
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}

interface Day {
  date: string;
  hours: number[];
}

/* ---------- Booked times (one tour per half-hour slot) ---------- */

/** UTC start times someone else already holds. */
let taken = new Set<number>();
/** Shown above the calendar once, e.g. after the chosen hour was just taken. */
let notice = "";

const isTaken = (date: string, hour: number) => taken.has(slotUtc(date, hour));
function isLunch(hour: number): boolean {
  return LUNCH_HOURS.includes(hour);
}
/** Booked by someone else, or the lunch break: both show as "Booked". */
const isBlocked = (date: string, hour: number) => isLunch(hour) || isTaken(date, hour);

async function loadTaken(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("tour_taken_slots");
    if (error || !Array.isArray(data)) return false;
    taken = new Set((data as string[]).map((iso) => Date.parse(iso)));
    return true;
  } catch {
    return false;
  }
}

/** First free slot in the calendar, if any. */
function firstFree(days: Day[]): { date: string; hour: number } | null {
  for (const d of days) {
    const hour = d.hours.find((h) => !isBlocked(d.date, h));
    if (hour !== undefined) return { date: d.date, hour };
  }
  return null;
}

/** The next two weeks of Istanbul days that still have bookable hours. */
function availableDays(): Day[] {
  const min = earliestAllowed();
  const today = Date.parse(`${istanbulDay(Date.now())}T00:00:00Z`);
  const days: Day[] = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const date = new Date(today + i * 86_400_000).toISOString().slice(0, 10);
    const hours: number[] = [];
    for (let h = FIRST_HOUR; h <= LAST_HOUR; h += STEP_HOURS) if (slotUtc(date, h) >= min) hours.push(h);
    if (hours.some((h) => !isLunch(h))) days.push({ date, hours });
  }
  return days;
}

let visitorZone: string | undefined;
try {
  visitorZone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
} catch {
  visitorZone = undefined;
}

/** Visitor's UTC offset (minutes) at an instant. */
const visitorOffset = (ms: number) => -new Date(ms).getTimezoneOffset();

function gmtLabel(offset: number): string {
  const sign = offset < 0 ? "−" : "+";
  const abs = Math.abs(offset);
  return `GMT${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${pad(abs % 60)}` : ""}`;
}

/** "Dubai · GMT+4" */
function zoneLabel(): string {
  const city = visitorZone?.split("/").pop()?.replace(/_/g, " ");
  const gmt = gmtLabel(visitorOffset(Date.now()));
  return city && !/^(UTC|GMT|Etc)/i.test(city) ? `${city} · ${gmt}` : gmt;
}

function formatTime(ms: number, timeZone?: string): string {
  return new Intl.DateTimeFormat(localeTag(), { hour: "numeric", minute: "2-digit", ...(timeZone ? { timeZone } : {}) }).format(ms);
}

function formatDay(date: string, style: "chip" | "long", tag = localeTag()): string {
  const [y, m, d] = date.split("-").map(Number);
  const noon = Date.UTC(y, m - 1, d, 12);
  const options: Intl.DateTimeFormatOptions =
    style === "long"
      ? { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }
      : { day: "numeric", month: "short", timeZone: "UTC" };
  return new Intl.DateTimeFormat(tag, options).format(noon);
}

function weekday(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(localeTag(), { weekday: "short", timeZone: "UTC" }).format(Date.UTC(y, m - 1, d, 12));
}

function relativeDay(date: string): string | null {
  const today = istanbulDay(Date.now());
  if (date === today) return t("videoTour.wizard.today");
  if (date === istanbulDay(Date.now() + 86_400_000)) return t("videoTour.wizard.tomorrow");
  return null;
}

/** The visitor's local time for a slot, with "+1"/"−1" when it falls on another calendar day. Null when they share Istanbul's offset. */
function localTime(ms: number): string | null {
  if (visitorOffset(ms) === ISTANBUL_OFFSET_MIN) return null;
  const localDay = new Date(ms + visitorOffset(ms) * 60_000).toISOString().slice(0, 10);
  const shift = Math.round((Date.parse(localDay) - Date.parse(istanbulDay(ms))) / 86_400_000);
  return `${formatTime(ms)}${shift ? ` (${shift > 0 ? "+" : "−"}${Math.abs(shift)})` : ""}`;
}

const periodOf = (hour: number) => (hour < 12 ? "morning" : hour < 16 ? "afternoon" : "evening");

/** "Today, 4:00 PM" / "Tue, 7 Oct, 10:00 AM" */
function slotLabel(date: string, hour: number): string {
  const day = relativeDay(date) ?? `${weekday(date)} ${formatDay(date, "chip")}`;
  return `${day}${getLocale() === "ar" ? "، " : ", "}${formatTime(slotUtc(date, hour), ISTANBUL_TZ)}`;
}

/* ---------- Rendering ---------- */

const projectName = (slug: string) => getProjectContent(slug).name;
const ltr = (text: string) => `<bdi dir="ltr">${text}</bdi>`;

function renderSteps(step: number): string {
  const names = tRaw<string[]>("videoTour.wizard.stepNames");
  return `
    <ol class="tour-steps" aria-label="${t("videoTour.wizard.progress", { current: step + 1, total: 3 })}">
      ${names
        .map(
          (name, i) => `
        <li class="tour-steps__item${i < step ? " is-done" : ""}${i === step ? " is-current" : ""}"${i === step ? ' aria-current="step"' : ""}>
          <span class="tour-steps__dot">${i < step ? CHECK : i + 1}</span>
          <span class="tour-steps__name">${name}</span>
        </li>`
        )
        .join("")}
    </ol>`;
}

function renderProjectStep(state: TourState): string {
  const projects = getSortedProjects().filter((p) => !p.soldOut);
  return `
    <fieldset class="tour-field">
      <legend class="tour-question">${t("videoTour.wizard.projectQuestion")}</legend>
      <p class="tour-hint">${t("videoTour.wizard.projectHint")}</p>
      <div class="tour-projects">
        ${projects
          .map((p) => {
            const on = state.projects.includes(p.slug);
            return `
          <button type="button" class="tour-project" data-tour-project="${p.slug}" aria-pressed="${on}">
            <img ${photoAttrs(p.coverImage, "64px")} alt="" width="${p.coverImage.width}" height="${p.coverImage.height}" loading="lazy" />
            <span class="tour-project__text">
              <span class="tour-project__name">${projectName(p.slug)}</span>
              <span class="tour-project__place">${placeLine(p.district, p.city)}</span>
            </span>
            <span class="tour-project__check">${CHECK}</span>
          </button>`;
          })
          .join("")}
      </div>
    </fieldset>
    <fieldset class="tour-field">
      <legend class="tour-label">${t("videoTour.wizard.focusQuestion")}</legend>
      <div class="tour-chips">
        ${FOCUS.map(
          (f) =>
            `<button type="button" class="tour-chip" data-tour-focus="${f}" aria-pressed="${state.focus.includes(f)}">${CHECK}<span>${t(`videoTour.wizard.focus.${f}`)}</span></button>`
        ).join("")}
      </div>
    </fieldset>
    <p class="tour-error" data-tour-error role="alert"></p>
    <div class="tour-nav">
      <button type="button" class="btn btn--primary" data-tour-next>${t("videoTour.wizard.next")}</button>
    </div>`;
}

function renderTimeStep(state: TourState): string {
  const days = availableDays();
  const day = days.find((d) => d.date === state.date) ?? days[0];
  const first = firstFree(days);
  const showsLocal = days.some((d) => d.hours.some((h) => localTime(slotUtc(d.date, h)) !== null));
  const groups = (["morning", "afternoon", "evening"] as const)
    .map((period) => ({ period, hours: day.hours.filter((h) => periodOf(h) === period) }))
    .filter((g) => g.hours.length);
  return `
    <fieldset class="tour-field">
      <legend class="tour-question">${t("videoTour.wizard.timeQuestion")}</legend>
      <p class="tour-hint tour-hint--zone">${showsLocal ? t("videoTour.wizard.timeNote", { zone: ltr(zoneLabel()) }) : t("videoTour.wizard.sameZone")}</p>
      ${
        first
          ? `<button type="button" class="tour-earliest" data-tour-slot="${first.date}|${first.hour}">
        <span class="tour-earliest__dot" aria-hidden="true"></span>
        <span>${t("videoTour.wizard.earliest", { when: `<strong>${slotLabel(first.date, first.hour)}</strong>` })}</span>
      </button>`
          : ""
      }
      <div class="tour-days" role="group" aria-label="${t("videoTour.wizard.timeQuestion")}">
        ${days
          .map((d) => {
            const on = d.date === day.date;
            return `
          <button type="button" class="tour-day" data-tour-day="${d.date}" aria-pressed="${on}">
            <span class="tour-day__week">${relativeDay(d.date) ?? weekday(d.date)}</span>
            <span class="tour-day__date">${formatDay(d.date, "chip")}</span>
          </button>`;
          })
          .join("")}
      </div>
      <div class="tour-slots">
        ${groups
          .map(
            (g) => `
          <div class="tour-slots__group">
            <p class="tour-slots__period">${t(`videoTour.wizard.periods.${g.period}`)}</p>
            <div class="tour-slots__grid">
              ${g.hours
                .map((h) => {
                  const ms = slotUtc(day.date, h);
                  const local = localTime(ms);
                  if (isBlocked(day.date, h)) {
                    return `
              <button type="button" class="tour-slot is-taken" disabled>
                <span class="tour-slot__time">${formatTime(ms, ISTANBUL_TZ)}</span>
                <span class="tour-slot__local">${t("videoTour.wizard.taken")}</span>
              </button>`;
                  }
                  const on = state.date === day.date && state.hour === h;
                  return `
              <button type="button" class="tour-slot" data-tour-slot="${day.date}|${h}" aria-pressed="${on}">
                <span class="tour-slot__time">${formatTime(ms, ISTANBUL_TZ)}</span>
                ${local ? `<span class="tour-slot__local">${local}</span>` : ""}
              </button>`;
                })
                .join("")}
            </div>
          </div>`
          )
          .join("")}
      </div>
    </fieldset>
    <p class="tour-error" data-tour-error role="alert">${notice}</p>
    <div class="tour-nav">
      <button type="button" class="tour-back" data-tour-back>${t("videoTour.wizard.back")}</button>
      <button type="button" class="btn btn--primary" data-tour-next>${t("videoTour.wizard.next")}</button>
    </div>`;
}

function summaryRows(state: TourState): string {
  const ms = slotUtc(state.date!, state.hour!);
  const local = localTime(ms);
  const when = `${formatDay(state.date!, "long")}<br />${formatTime(ms, ISTANBUL_TZ)} ${t("videoTour.wizard.istanbulTime")}${
    local ? `<span class="tour-summary__local">${local} ${t("videoTour.wizard.yourTime")}</span>` : ""
  }`;
  return `
    <div><dt>${t("videoTour.wizard.summary.projects")}</dt><dd>${state.projects.map(projectName).join(getLocale() === "ar" ? "، " : ", ")}</dd></div>
    <div><dt>${t("videoTour.wizard.summary.when")}</dt><dd>${when}</dd></div>
    <div><dt>${t("videoTour.wizard.summary.app")}</dt><dd data-tour-summary-app>${t(`videoTour.wizard.apps.${state.app}`)}</dd></div>
    <div><dt>${t("videoTour.wizard.summary.language")}</dt><dd data-tour-summary-lang>${t(`videoTour.languages.${state.lang}`)}</dd></div>`;
}

function renderDetailsStep(state: TourState): string {
  return `
    <div class="tour-details">
      <div class="tour-details__form">
        <p class="tour-question">${t("videoTour.wizard.detailsQuestion")}</p>
        <fieldset class="tour-field">
          <legend class="tour-label">${t("videoTour.wizard.appLabel")}</legend>
          <div class="tour-apps">
            ${APPS.map(
              (app) => `
            <button type="button" class="tour-app tour-app--${app}" data-tour-app="${app}" aria-pressed="${state.app === app}">
              <span class="tour-app__icon">${APP_ICONS[app]}</span>
              <span class="tour-app__name">${t(`videoTour.wizard.apps.${app}`)}</span>
              <span class="tour-app__hint">${t(`videoTour.wizard.appHints.${app}`)}</span>
            </button>`
            ).join("")}
          </div>
        </fieldset>
        <fieldset class="tour-field">
          <legend class="tour-label">${t("videoTour.wizard.languageLabel")}</legend>
          <div class="tour-chips">
            ${LANGUAGES.map(
              (lang) =>
                `<button type="button" class="tour-chip" data-tour-lang="${lang}" aria-pressed="${state.lang === lang}" lang="${lang}">${CHECK}<span>${t(`videoTour.languages.${lang}`)}</span></button>`
            ).join("")}
          </div>
        </fieldset>
        <div class="form-field">
          <label for="tour-name">${t("videoTour.wizard.nameLabel")}</label>
          <input type="text" id="tour-name" name="name" placeholder="${t("videoTour.wizard.namePlaceholder")}" autocomplete="name" value="${(state.name ?? "").replace(/"/g, "&quot;")}" />
          <p class="form-field__error" data-error-for="name"></p>
        </div>
        <div class="form-field">
          <label for="tour-email">${t("videoTour.wizard.emailLabel")}</label>
          <input type="email" id="tour-email" name="email" placeholder="${t("videoTour.wizard.emailPlaceholder")}" autocomplete="email" inputmode="email" dir="ltr" value="${escapeText(state.email ?? "")}" />
          <p class="form-field__error" data-error-for="email"></p>
        </div>
        <div class="form-field">
          <label for="${PHONE_ID}-number">${t("videoTour.wizard.phoneLabel")}</label>
          ${renderPhoneInput(PHONE_ID, "phone")}
          <p class="form-field__error" data-error-for="phone"></p>
        </div>
        <fieldset class="tour-field tour-field--contact">
          <legend class="tour-label">${t("videoTour.wizard.contactLabel")}</legend>
          <div class="tour-chips">
            ${CONTACTS.map(
              (c) =>
                `<button type="button" class="tour-chip" data-tour-contact="${c}" aria-pressed="${state.contact === c}">${CHECK}<span>${t(`videoTour.wizard.contacts.${c}`)}</span></button>`
            ).join("")}
          </div>
        </fieldset>
        <div class="tour-hp" aria-hidden="true">
          <label>${t("videoTour.wizard.honeypot")} <input type="text" name="website" tabindex="-1" autocomplete="off" data-tour-hp /></label>
        </div>
      </div>
      <aside class="tour-summary">
        <p class="tour-summary__title">${t("videoTour.wizard.summaryTitle")}</p>
        <dl class="tour-summary__list">${summaryRows(state)}</dl>
        <p class="tour-error tour-error--submit" data-tour-submit-error role="alert"></p>
        <button type="button" class="btn btn--primary btn--block" data-tour-confirm>${CALENDAR}<span data-tour-confirm-label>${t("videoTour.wizard.confirm")}</span></button>
        <p class="tour-summary__note">${t("videoTour.wizard.confirmNote")}</p>
        <a class="tour-summary__alt" href="${whatsappUrl(state)}" target="_blank" rel="noopener" data-tour-wa>${WHATSAPP_ICON}<span>${t("videoTour.wizard.orWhatsapp")}</span></a>
      </aside>
    </div>
    <div class="tour-nav tour-nav--start">
      <button type="button" class="tour-back" data-tour-back>${t("videoTour.wizard.back")}</button>
    </div>`;
}

/* ---------- Hand-off: WhatsApp message and calendar ---------- */

/** The request in Arabic on the Arabic site, otherwise in English (the team reads Arabic, English and Turkish). */
function whatsappUrl(state: TourState): string {
  const wl = getLocale() === "ar" ? "ar" : "en";
  const w = (key: string) => String(lookup(wl, `videoTour.${key}`) ?? key);
  const tag = `${wl}-u-nu-latn`;
  const ms = slotUtc(state.date!, state.hour!);
  const istanbul = new Intl.DateTimeFormat(tag, { hour: "numeric", minute: "2-digit", timeZone: ISTANBUL_TZ }).format(ms);
  const local =
    visitorOffset(ms) === ISTANBUL_OFFSET_MIN
      ? ""
      : ` (${new Intl.DateTimeFormat(tag, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(ms)} ${w("wa.local")}, ${zoneLabel()})`;
  const names = state.projects.map((slug) => String((lookup(wl, `projectsData.${slug}`) as { name: string }).name));
  const comma = wl === "ar" ? "، " : ", ";
  const lines = [
    w("wa.intro"),
    "",
    `${w("wa.projects")}: ${names.join(comma)}`,
    ...state.projects.map((slug) => `${window.location.origin}${link(`/projects/${slug}`)}`),
    ...(state.focus.length ? [`${w("wa.focus")}: ${state.focus.map((f) => w(`wizard.focus.${f}`)).join(comma)}`] : []),
    `${w("wa.date")}: ${formatDay(state.date!, "long", tag)}`,
    `${w("wa.time")}: ${istanbul} ${w("wa.istanbul")}${local}`,
    `${w("wa.app")}: ${w(`wizard.apps.${state.app}`)}`,
    `${w("wa.language")}: ${w(`languages.${state.lang}`)}`,
    ...(state.name ? [`${w("wa.name")}: ${state.name}`] : []),
    ...(state.phone ? [`${w("wa.phone")}: ${state.phone}`] : []),
    ...(campaignSource() ? [`${w("wa.source")}: ${campaignSource()}`] : []),
    "",
    w("wa.outro")
  ];
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
}

const icsStamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function eventText(state: TourState) {
  return {
    title: t("videoTour.wizard.event", { projects: state.projects.map(projectName).join(" · ") }),
    details: t("videoTour.wizard.eventDetails", { app: t(`videoTour.wizard.apps.${state.app}`), ref: state.reference ?? "" }),
    start: slotUtc(state.date!, state.hour!),
    end: slotUtc(state.date!, state.hour!) + TOUR_MINUTES * 60_000
  };
}

function googleCalendarUrl(state: TourState): string {
  const e = eventText(state);
  const params = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${icsStamp(e.start)}/${icsStamp(e.end)}`, details: e.details });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function downloadIcs(state: TourState): void {
  const e = eventText(state);
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HADARA Real Estate//Video Tour//EN",
    "BEGIN:VEVENT",
    `UID:${state.reference ?? `${e.start}-${state.projects.join("-")}`}@hadararealestate.com`,
    `DTSTAMP:${icsStamp(Date.now())}`,
    `DTSTART:${icsStamp(e.start)}`,
    `DTEND:${icsStamp(e.end)}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(e.details)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(e.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "hadara-video-tour.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderDone(state: TourState): string {
  const prepare = tRaw<string[]>("videoTour.wizard.prepare");
  const ms = slotUtc(state.date!, state.hour!);
  return `
    <div class="tour-done">
      <span class="tour-done__icon">${PARTY}</span>
      <h3 class="tour-done__title">${t("videoTour.wizard.doneTitle", { name: escapeText(state.name ?? "") })}</h3>
      <p class="tour-done__when">${formatDay(state.date!, "long")} · ${formatTime(ms, ISTANBUL_TZ)} ${t("videoTour.wizard.istanbulTime")}</p>
      <p class="tour-done__ref">${t("videoTour.wizard.referenceLabel")}: <strong dir="ltr">${escapeText(state.reference ?? "")}</strong></p>
      <p class="tour-done__text">${t("videoTour.wizard.doneText", {
        email: `<bdi dir="ltr">${escapeText(state.email ?? "")}</bdi>`,
        app: t(`videoTour.wizard.apps.${state.app}`)
      })}</p>
      <a class="tour-done__reopen" href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
        t("videoTour.wa.aboutBooking", { ref: state.reference ?? "" })
      )}" target="_blank" rel="noopener">${WHATSAPP_ICON} ${t("videoTour.wizard.doneReopen")}</a>
      <div class="tour-done__grid">
        <div class="tour-done__card">
          <p class="tour-done__card-title">${t("videoTour.wizard.calendarTitle")}</p>
          <div class="tour-done__calendar">
            <a class="btn btn--outline" href="${googleCalendarUrl(state)}" target="_blank" rel="noopener">${CALENDAR}${t("videoTour.wizard.calendarGoogle")}</a>
            <button type="button" class="btn btn--outline" data-tour-ics>${CALENDAR}${t("videoTour.wizard.calendarIcs")}</button>
          </div>
        </div>
        <div class="tour-done__card">
          <p class="tour-done__card-title">${t("videoTour.wizard.prepareTitle")}</p>
          <ul class="tour-done__list">${prepare.map((item) => `<li>${CHECK}<span>${item}</span></li>`).join("")}</ul>
        </div>
      </div>
      <button type="button" class="tour-back tour-back--again" data-tour-again>${t("videoTour.wizard.again")}</button>
    </div>`;
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ---------- Sending the booking ---------- */

const BOOK_ENDPOINT = "/api/book";
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const englishNames = (slugs: string[]) =>
  slugs.map((slug) => String((lookup("en", `projectsData.${slug}`) as { name: string }).name)).join(", ");

/** What api/book.ts expects: names in the page language and in Arabic (for the team). */
function bookingPayload(state: TourState, openedAt: number, honeypot: string) {
  const arName = (slug: string) => String((lookup("ar", `projectsData.${slug}`) as { name: string }).name);
  return {
    slot: new Date(slotUtc(state.date!, state.hour!)).toISOString(),
    projects: state.projects.map((slug) => ({ slug, name: projectName(slug), nameAr: arName(slug) })),
    focus: state.focus,
    focusLabels: state.focus.map((f) => t(`videoTour.wizard.focus.${f}`)),
    focusLabelsAr: state.focus.map((f) => String(lookup("ar", `videoTour.wizard.focus.${f}`) ?? f)),
    app: state.app,
    tourLanguage: state.lang,
    name: state.name,
    email: state.email,
    phone: state.phone,
    contact: state.contact,
    locale: getLocale(),
    timeZone: visitorZone ?? "",
    source: campaignSource() ?? "",
    elapsedMs: Date.now() - openedAt,
    website: honeypot
  };
}

function renderBody(state: TourState): string {
  if (state.step === 3) return renderDone(state);
  const body = state.step === 0 ? renderProjectStep(state) : state.step === 1 ? renderTimeStep(state) : renderDetailsStep(state);
  return `${renderSteps(state.step)}<div class="tour-panel">${body}</div>`;
}

/** Projects preselected from ?project=a,b (unknown and sold-out ones dropped). */
function urlProjects(): string[] {
  const value = new URLSearchParams(window.location.search).get("project") ?? "";
  return [...new Set(value.split(",").map((v) => v.trim()))].filter(bookable);
}

export function renderVideoTourBooking(): string {
  return `<div class="tour-booking" data-tour-body aria-live="polite">${renderBody(initialState(urlProjects()))}</div>`;
}

export function initVideoTourBooking(root: HTMLElement): void {
  const body = root.querySelector<HTMLElement>("[data-tour-body]");
  if (!body) return;
  let state = initialState(urlProjects());
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  /** When the wizard opened: a booking sent seconds later is a bot (api/book.ts checks it). */
  const openedAt = Date.now();
  let sending = false;

  /** Refreshes the booked hours; drops the visitor's choice if someone else took it meanwhile. */
  const refreshTaken = () =>
    loadTaken().then((ok) => {
      if (!ok) return;
      if (state.date && state.hour !== undefined && isTaken(state.date, state.hour)) {
        state = { ...state, hour: undefined };
        saveState(state);
      }
      if (state.step === 1) update(state, false);
    });
  void refreshTaken();

  const showError = (message: string) => {
    const el = body.querySelector<HTMLElement>("[data-tour-error]");
    if (el) el.textContent = message;
  };

  const update = (next: TourState, scroll = true) => {
    state = next;
    saveState(state);
    body.innerHTML = renderBody(state);
    body.classList.remove("is-changing");
    void body.offsetWidth;
    body.classList.add("is-changing");
    restorePhone();
    if (!scroll) return;
    const top = body.getBoundingClientRect().top;
    const headerH = document.querySelector(".site-header")?.getBoundingClientRect().height ?? 80;
    if (top < headerH || top > window.innerHeight * 0.5) {
      window.scrollTo({ top: window.scrollY + top - headerH - 16, behavior: reduced ? "auto" : "smooth" });
    }
  };

  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  body.addEventListener("click", (e) => {
    const target = e.target as Element;
    const pressed = (el: Element, on: boolean) => el.setAttribute("aria-pressed", String(on));

    const project = target.closest<HTMLElement>("[data-tour-project]");
    if (project) {
      state = { ...state, projects: toggle(state.projects, project.dataset.tourProject!) };
      pressed(project, state.projects.includes(project.dataset.tourProject!));
      if (state.projects.length) showError("");
      return saveState(state);
    }
    const focus = target.closest<HTMLElement>("[data-tour-focus]");
    if (focus) {
      state = { ...state, focus: toggle(state.focus, focus.dataset.tourFocus!) };
      pressed(focus, state.focus.includes(focus.dataset.tourFocus!));
      return saveState(state);
    }
    const day = target.closest<HTMLElement>("[data-tour-day]");
    if (day) {
      const date = day.dataset.tourDay!;
      return update({ ...state, date, hour: state.date === date ? state.hour : undefined }, false);
    }
    const slot = target.closest<HTMLElement>("[data-tour-slot]");
    if (slot) {
      const [date, hour] = slot.dataset.tourSlot!.split("|");
      return update({ ...state, date, hour: Number(hour) }, false);
    }
    const app = target.closest<HTMLElement>("[data-tour-app]");
    if (app) {
      state = { ...state, app: app.dataset.tourApp as App };
      body.querySelectorAll("[data-tour-app]").forEach((b) => pressed(b, b === app));
      const cell = body.querySelector("[data-tour-summary-app]");
      if (cell) cell.textContent = t(`videoTour.wizard.apps.${state.app}`);
      return saveState(state);
    }
    const contact = target.closest<HTMLElement>("[data-tour-contact]");
    if (contact) {
      state = { ...state, contact: contact.dataset.tourContact as Contact };
      body.querySelectorAll("[data-tour-contact]").forEach((b) => pressed(b, b === contact));
      return saveState(state);
    }
    const wa = target.closest<HTMLAnchorElement>("[data-tour-wa]");
    if (wa) {
      // Carry over what the visitor has typed so far.
      readDetails();
      wa.href = whatsappUrl(state);
      trackSchedule(englishNames(state.projects));
      return;
    }
    const lang = target.closest<HTMLElement>("[data-tour-lang]");
    if (lang) {
      state = { ...state, lang: lang.dataset.tourLang as Language };
      body.querySelectorAll("[data-tour-lang]").forEach((b) => pressed(b, b === lang));
      const cell = body.querySelector("[data-tour-summary-lang]");
      if (cell) cell.textContent = t(`videoTour.languages.${state.lang}`);
      return saveState(state);
    }
    if (target.closest("[data-tour-next]")) {
      notice = "";
      if (state.step === 0 && !state.projects.length) return showError(t("videoTour.wizard.chooseProject"));
      if (state.step === 1 && (!state.date || state.hour === undefined)) return showError(t("videoTour.wizard.chooseTime"));
      return update({ ...state, step: (state.step + 1) as TourState["step"] });
    }
    if (target.closest("[data-tour-back]") && !target.closest("[data-tour-again]")) {
      notice = "";
      return update({ ...state, step: Math.max(0, state.step - 1) as TourState["step"] });
    }
    if (target.closest("[data-tour-confirm]")) return void confirm();
    if (target.closest("[data-tour-ics]")) return downloadIcs(state);
    if (target.closest("[data-tour-again]")) return update(fresh());
  });

  function restorePhone(): void {
    const select = body!.querySelector<HTMLSelectElement>(`#${PHONE_ID}-country`);
    const number = body!.querySelector<HTMLInputElement>(`#${PHONE_ID}-number`);
    if (select && state.dial && [...select.options].some((o) => o.value === state.dial)) select.value = state.dial;
    if (number && state.number) number.value = state.number;
  }
  restorePhone();

  // Keep what the visitor typed across language switches and step changes.
  const remember = (e: Event) => {
    const input = e.target as HTMLInputElement | HTMLSelectElement;
    if (input.id === "tour-name") state = { ...state, name: input.value };
    else if (input.id === "tour-email") state = { ...state, email: input.value };
    else if (input.id === `${PHONE_ID}-number`) state = { ...state, number: input.value };
    else if (input.id === `${PHONE_ID}-country`) state = { ...state, dial: input.value };
    else return;
    saveState(state);
  };
  body.addEventListener("input", remember);
  body.addEventListener("change", remember);
  // A field's error goes away as soon as the visitor starts fixing it.
  body.addEventListener("input", (e) => {
    const id = (e.target as HTMLElement).id;
    const field = id === "tour-name" ? "name" : id === "tour-email" ? "email" : id === `${PHONE_ID}-number` ? "phone" : "";
    if (field && body.querySelector(`[data-error-for="${field}"]`)?.textContent) fieldError(field, "");
  });

  /** Name, email and phone as currently typed. */
  function readDetails(): void {
    const name = body!.querySelector<HTMLInputElement>("#tour-name")?.value.trim() ?? "";
    const email = body!.querySelector<HTMLInputElement>("#tour-email")?.value.trim() ?? "";
    const phone = isPhoneFilled(body!, PHONE_ID) ? getPhoneValue(body!, PHONE_ID) : undefined;
    state = { ...state, name, email, phone };
  }

  function fieldError(field: string, message: string): void {
    const el = body!.querySelector<HTMLElement>(`[data-error-for="${field}"]`);
    if (el) el.textContent = message;
    const input = field === "phone" ? null : body!.querySelector(`#tour-${field}`);
    input?.setAttribute("aria-invalid", String(Boolean(message)));
    if (field === "phone") setPhoneInvalid(body!, PHONE_ID, Boolean(message));
  }

  function validate(): boolean {
    const { name = "", email = "" } = state;
    fieldError("name", name ? "" : t("videoTour.wizard.errors.name"));
    fieldError(
      "email",
      !email ? t("videoTour.wizard.errors.email") : EMAIL.test(email) ? "" : t("videoTour.wizard.errors.emailInvalid")
    );
    const phoneOk = isPhoneFilled(body!, PHONE_ID) && isPhoneValid(body!, PHONE_ID);
    fieldError(
      "phone",
      phoneOk ? "" : t(isPhoneFilled(body!, PHONE_ID) ? "videoTour.wizard.errors.phoneInvalid" : "videoTour.wizard.errors.phone")
    );
    const valid = Boolean(name) && EMAIL.test(email) && phoneOk;
    if (!valid) body!.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    return valid;
  }

  function setSending(on: boolean): void {
    sending = on;
    const button = body!.querySelector<HTMLButtonElement>("[data-tour-confirm]");
    const label = body!.querySelector<HTMLElement>("[data-tour-confirm-label]");
    if (button) {
      button.disabled = on;
      button.setAttribute("aria-busy", String(on));
    }
    if (label) label.textContent = t(on ? "videoTour.wizard.booking" : "videoTour.wizard.confirm");
  }

  async function confirm(): Promise<void> {
    if (sending) return;
    readDetails();
    const submitError = body!.querySelector<HTMLElement>("[data-tour-submit-error]");
    if (submitError) submitError.textContent = "";
    if (!validate()) return;

    setSending(true);
    let status = 0;
    let result: { reference?: string; error?: string } = {};
    try {
      const res = await fetch(BOOK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingPayload(state, openedAt, body!.querySelector<HTMLInputElement>("[data-tour-hp]")?.value ?? ""))
      });
      status = res.status;
      result = (await res.json().catch(() => ({}))) as typeof result;
    } catch {
      status = 0;
    }
    setSending(false);

    if (status === 200 && result.reference) {
      trackSchedule(englishNames(state.projects));
      taken.add(slotUtc(state.date!, state.hour!));
      return update({ ...state, reference: result.reference, step: 3 });
    }
    if (status === 409) {
      // Someone else took the hour a moment ago: back to the calendar with fresh availability.
      taken.add(slotUtc(state.date!, state.hour!));
      notice = t("videoTour.wizard.slotTakenNotice");
      update({ ...state, hour: undefined, step: 1 });
      void refreshTaken();
      return;
    }
    const message =
      status === 429 ? "videoTour.wizard.errors.limit" : status === 400 ? "videoTour.wizard.errors.invalid" : "videoTour.wizard.errors.failed";
    if (submitError) submitError.textContent = t(message);
  }
}
