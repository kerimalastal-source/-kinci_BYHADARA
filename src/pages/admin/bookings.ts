import { t, link, getLocale, getProjectContent } from "../../i18n";
import { requireAdmin } from "../../auth/session";
import { escapeHtml } from "../../utils/html";
import { getProjectBySlug } from "../../data/projects";
import { bookingAdminAction, fetchTourBookings, setTourBookingStatus, type TourBooking } from "../../data/tourBookings";

/**
 * Admin page for private video tour bookings (/admin/bookings): upcoming, past and
 * cancelled tabs.
 *   - "Confirm" marks the booking as confirmed and emails the visitor (api/booking-admin.ts).
 *   - "Change time" moves it to another half hour and emails the visitor the new time with
 *     two answer buttons; their answer shows on the card (and reaches the team on Telegram).
 *   - "Cancel" frees the slot (after a prompt) and does NOT notify the visitor — the team
 *     contacts them itself; a cancelled booking can be restored while its slot is still free.
 */

type Tab = "upcoming" | "past" | "cancelled";
const TABS: Tab[] = ["upcoming", "past", "cancelled"];
const ISTANBUL = "Europe/Istanbul";
/** Türkiye keeps UTC+3 all year. */
const ISTANBUL_OFFSET_MIN = 180;
/** A tour counts as past once it has ended (45 minutes). */
const TOUR_MS = 45 * 60_000;
/** Times the team can move a tour to: every half hour 9:00–18:30 (minutes after midnight). */
const SLOT_MINUTES = Array.from({ length: 20 }, (_, i) => 9 * 60 + i * 30);
/** The lunch break visitors can't book; the team may still use it for a tour it moves. */
const LUNCH_MINUTES = [12 * 60, 12 * 60 + 30, 13 * 60];
/** How far ahead the team can move a tour. */
const EDIT_DAYS = 30;

let activeTab: Tab = "upcoming";
/** The card whose "Change time" panel is open. */
let editingId: string | null = null;
/** A message on a card after an action (e.g. "email sent"), until the next action. */
const notices = new Map<string, { text: string; ok: boolean }>();

const tag = () => `${getLocale()}-u-nu-latn`;
const sep = () => (getLocale() === "ar" ? "، " : ", ");

function formatWhen(iso: string, timeZone = ISTANBUL): { day: string; time: string } {
  const ms = Date.parse(iso);
  return {
    day: new Intl.DateTimeFormat(tag(), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone }).format(ms),
    // 24-hour times: no AM/PM marker to reorder inside Arabic text, and the team works in 24h.
    time: new Intl.DateTimeFormat(tag(), { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(ms)
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-05" and minutes after midnight, in Istanbul time. */
function istanbulParts(ms: number): { date: string; minutes: number } {
  const x = new Date(ms + ISTANBUL_OFFSET_MIN * 60_000);
  return { date: `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`, minutes: x.getUTCHours() * 60 + x.getUTCMinutes() };
}

function slotMs(date: string, minutes: number): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 0, minutes) - ISTANBUL_OFFSET_MIN * 60_000;
}

const clock = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/** Istanbul days the team can move a tour to, today first. */
function editDays(): string[] {
  const today = Date.parse(`${istanbulParts(Date.now()).date}T00:00:00Z`);
  return Array.from({ length: EDIT_DAYS + 1 }, (_, i) => new Date(today + i * 86_400_000).toISOString().slice(0, 10));
}

function dayLabel(date: string): string {
  return new Intl.DateTimeFormat(tag(), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(Date.parse(`${date}T12:00:00Z`));
}

/** Time options for a day: past times and times another booking holds are disabled. */
function timeOptions(booking: TourBooking, all: TourBooking[], date: string, selected: number | null): string {
  const now = Date.now();
  const held = new Set(all.filter((b) => b.id !== booking.id && b.status !== "cancelled").map((b) => Date.parse(b.slot_start)));
  return SLOT_MINUTES.map((minutes) => {
    const ms = slotMs(date, minutes);
    const taken = held.has(ms);
    const note = taken ? t("adminBookings.edit.taken") : LUNCH_MINUTES.includes(minutes) ? t("adminBookings.edit.lunch") : "";
    const disabled = taken || ms < now;
    return `<option value="${minutes}"${disabled ? " disabled" : ""}${minutes === selected && !disabled ? " selected" : ""}>${clock(minutes)}${note ? ` — ${note}` : ""}</option>`;
  }).join("");
}

function editPanel(booking: TourBooking, all: TourBooking[]): string {
  const current = istanbulParts(Date.parse(booking.slot_start));
  const days = editDays();
  const date = days.includes(current.date) ? current.date : days[0];
  return `
      <div class="booking-edit" data-booking-edit>
        <p class="booking-edit__title">${t("adminBookings.edit.title")}</p>
        <div class="booking-edit__fields">
          <label class="booking-edit__field">
            <span>${t("adminBookings.edit.date")}</span>
            <select data-edit-date>${days.map((d) => `<option value="${d}"${d === date ? " selected" : ""}>${escapeHtml(dayLabel(d))}</option>`).join("")}</select>
          </label>
          <label class="booking-edit__field">
            <span>${t("adminBookings.edit.time")}</span>
            <select data-edit-time dir="ltr">${timeOptions(booking, all, date, date === current.date ? current.minutes : null)}</select>
          </label>
        </div>
        <p class="booking-edit__hint">${t("adminBookings.edit.hint")}</p>
        <div class="booking-edit__actions">
          <button type="button" class="btn btn--primary btn--small" data-booking-action="save-time">${t("adminBookings.actions.saveTime")}</button>
          <button type="button" class="btn btn--outline btn--small" data-booking-action="close-edit">${t("adminBookings.actions.closeEdit")}</button>
        </div>
      </div>`;
}

/** The visitor's answer to a time the team changed. */
function replyLine(booking: TourBooking): string {
  if (!booking.rescheduled_at || booking.status === "cancelled") return "";
  const reply = booking.customer_reply ?? "waiting";
  // "proposed": the visitor picked this time on the answer page (migration 0006).
  const state = reply === "proposed" && booking.status === "confirmed" ? "proposedConfirmed" : reply;
  return `<p class="booking-card__reply booking-card__reply--${reply === "proposed" ? "proposed" : state}">${t(`adminBookings.reply.${state}`)}</p>`;
}

function tabOf(booking: TourBooking, now: number): Tab {
  if (booking.status === "cancelled") return "cancelled";
  return Date.parse(booking.slot_start) + TOUR_MS < now ? "past" : "upcoming";
}

/** Known keys get their label; anything unexpected is shown as-is, escaped. */
function label(key: string, value: string | null): string {
  if (!value) return "";
  const text = t(`${key}.${value}`);
  return escapeHtml(text === `${key}.${value}` ? value : text);
}

function projectLinks(slugs: string[]): string {
  return slugs
    .map((slug) =>
      getProjectBySlug(slug)
        ? `<a href="${link(`/projects/${slug}`)}">${escapeHtml(getProjectContent(slug).name)}</a>`
        : escapeHtml(slug)
    )
    .join(sep());
}

function visitorTime(booking: TourBooking): string {
  const zone = booking.visitor_timezone;
  if (!zone) return "";
  try {
    const own = formatWhen(booking.slot_start, zone);
    const istanbul = formatWhen(booking.slot_start);
    if (own.day === istanbul.day && own.time === istanbul.time) return "";
    return `<span dir="ltr">${escapeHtml(own.time)}</span> · ${escapeHtml(own.day)} <span class="booking-card__muted" dir="ltr">(${escapeHtml(zone.replace(/_/g, " "))})</span>`;
  } catch {
    return "";
  }
}

function row(name: string, value: string): string {
  return value ? `<div><dt>${t(`adminBookings.labels.${name}`)}</dt><dd>${value}</dd></div>` : "";
}

function renderCard(booking: TourBooking, tab: Tab, all: TourBooking[]): string {
  const when = formatWhen(booking.slot_start);
  const phoneDigits = booking.phone.replace(/[^\d]/g, "");
  const editing = editingId === booking.id && tab === "upcoming";
  const notice = notices.get(booking.id);
  const actions =
    booking.status === "cancelled"
      ? `<button type="button" class="btn btn--outline btn--small" data-booking-action="restore">${t("adminBookings.actions.restore")}</button>`
      : `${
          booking.status === "booked" && tab === "upcoming"
            ? `<button type="button" class="btn btn--primary btn--small" data-booking-action="confirm">${t("adminBookings.actions.confirm")}</button>`
            : ""
        }${
          tab === "upcoming" && !editing
            ? `<button type="button" class="btn btn--outline btn--small" data-booking-action="edit">${t("adminBookings.actions.edit")}</button>`
            : ""
        }<button type="button" class="btn btn--outline btn--small booking-card__cancel" data-booking-action="cancel">${t("adminBookings.actions.cancel")}</button>`;

  return `
    <article class="booking-card booking-card--${booking.status}" data-booking-id="${escapeHtml(booking.id)}">
      <header class="booking-card__head">
        <div class="booking-card__when">
          <p class="booking-card__day">${escapeHtml(when.day)}</p>
          <p class="booking-card__time"><span dir="ltr">${escapeHtml(when.time)}</span> <small>${t("adminBookings.istanbulTime")}</small></p>
        </div>
        <div class="booking-card__meta">
          <span class="booking-status booking-status--${booking.status}">${t(`adminBookings.status.${booking.status}`)}</span>
          <span class="booking-card__ref" dir="ltr">${escapeHtml(booking.reference)}</span>
        </div>
      </header>
      <p class="booking-card__name">${escapeHtml(booking.name)}</p>
      ${replyLine(booking)}
      <dl class="booking-card__details">
        ${row(
          "phone",
          `<a href="tel:+${phoneDigits}" dir="ltr">${escapeHtml(booking.phone)}</a> · <a href="https://wa.me/${phoneDigits}" target="_blank" rel="noopener">${t("adminBookings.whatsapp")}</a>`
        )}
        ${row("email", `<a href="mailto:${escapeHtml(booking.email)}" dir="ltr">${escapeHtml(booking.email)}</a>`)}
        ${row("contact", label("videoTour.wizard.contacts", booking.contact_method))}
        ${row("projects", projectLinks(booking.projects))}
        ${row("focus", booking.focus.map((f) => label("videoTour.wizard.focus", f)).join(sep()))}
        ${row("app", label("videoTour.wizard.apps", booking.app))}
        ${row("language", label("videoTour.languages", booking.tour_language))}
        ${row("visitorTime", visitorTime(booking))}
        ${row("siteLanguage", label("lang", booking.site_locale))}
        ${row("source", booking.source ? `<span dir="ltr">${escapeHtml(booking.source)}</span>` : "")}
        ${row("bookedAt", `${escapeHtml(formatWhen(booking.created_at).day)} · <span dir="ltr">${escapeHtml(formatWhen(booking.created_at).time)}</span>`)}
      </dl>
      ${editing ? editPanel(booking, all) : ""}
      <p class="booking-card__error${notice?.ok ? " booking-card__error--ok" : ""}" role="alert" data-booking-error>${notice ? escapeHtml(notice.text) : ""}</p>
      <div class="booking-card__actions">${actions}</div>
    </article>`;
}

export function renderAdminBookings(main: HTMLElement): void {
  if (!requireAdmin(main)) return;

  main.innerHTML = `
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow eyebrow--on-dark">${t("admin.heroEyebrow")}</p>
        <h1>${t("adminBookings.heroTitle")}</h1>
        <p class="page-hero__subtitle">${t("adminBookings.heroSubtitle")}</p>
      </div>
    </section>
    <section class="section admin-bookings">
      <div class="container">
        <nav class="admin-subnav" aria-label="${t("admin.heroEyebrow")}">
          <a href="${link("/admin")}">${t("adminBookings.nav.listings")}</a>
          <a href="${link("/admin/bookings")}" aria-current="page">${t("adminBookings.nav.bookings")}</a>
        </nav>
        <div class="admin-bookings__tabs" role="tablist"></div>
        <p class="admin-bookings__note">${t("adminBookings.cancelNote")}</p>
        <div class="admin-bookings__list" aria-live="polite"><p>${t("common.loading")}</p></div>
      </div>
    </section>
  `;

  const requestId = crypto.randomUUID();
  main.dataset.requestId = requestId;
  const tabsEl = main.querySelector<HTMLElement>(".admin-bookings__tabs")!;
  const listEl = main.querySelector<HTMLElement>(".admin-bookings__list")!;
  let bookings: TourBooking[] = [];

  const paint = () => {
    const now = Date.now();
    const groups: Record<Tab, TourBooking[]> = { upcoming: [], past: [], cancelled: [] };
    for (const b of bookings) groups[tabOf(b, now)].push(b);
    // Upcoming soonest first; past and cancelled most recent first.
    groups.past.reverse();
    groups.cancelled.reverse();

    tabsEl.innerHTML = TABS.map(
      (tab) => `
      <button type="button" role="tab" class="admin-bookings__tab" data-booking-tab="${tab}" aria-selected="${tab === activeTab}">
        ${t(`adminBookings.tabs.${tab}`)} <span class="admin-bookings__count">${groups[tab].length}</span>
      </button>`
    ).join("");
    const items = groups[activeTab];
    listEl.innerHTML = items.length
      ? items.map((b) => renderCard(b, activeTab, bookings)).join("")
      : `<p class="admin-bookings__empty">${t(`adminBookings.empty.${activeTab}`)}</p>`;
  };

  const load = () =>
    fetchTourBookings()
      .then((data) => {
        if (main.dataset.requestId !== requestId) return;
        bookings = data;
        paint();
      })
      .catch((err) => {
        console.error(err);
        if (main.dataset.requestId === requestId) listEl.innerHTML = `<p class="admin-bookings__empty">${t("adminBookings.loadError")}</p>`;
      });

  tabsEl.addEventListener("click", (e) => {
    const tab = (e.target as Element).closest<HTMLElement>("[data-booking-tab]");
    if (!tab) return;
    activeTab = tab.dataset.bookingTab as Tab;
    paint();
    // On a narrow phone (long Russian labels) the tab row scrolls; keep the chosen tab in view.
    tabsEl.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });

  // Picking another day refreshes that day's free times.
  listEl.addEventListener("change", (e) => {
    const select = (e.target as Element).closest<HTMLSelectElement>("[data-edit-date]");
    const card = select?.closest<HTMLElement>("[data-booking-id]");
    const booking = bookings.find((b) => b.id === card?.dataset.bookingId);
    const time = card?.querySelector<HTMLSelectElement>("[data-edit-time]");
    if (!select || !booking || !time) return;
    const current = istanbulParts(Date.parse(booking.slot_start));
    time.innerHTML = timeOptions(booking, bookings, select.value, select.value === current.date ? current.minutes : null);
  });

  listEl.addEventListener("click", async (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>("[data-booking-action]");
    const card = button?.closest<HTMLElement>("[data-booking-id]");
    const booking = bookings.find((b) => b.id === card?.dataset.bookingId);
    if (!button || !card || !booking) return;
    const action = button.dataset.bookingAction as "confirm" | "cancel" | "restore" | "edit" | "close-edit" | "save-time";
    const when = formatWhen(booking.slot_start);
    const error = card.querySelector<HTMLElement>("[data-booking-error]");
    const fail = (key: string) => {
      card.querySelectorAll("button, select").forEach((b) => ((b as HTMLButtonElement).disabled = false));
      if (error) {
        error.classList.remove("booking-card__error--ok");
        error.textContent = t(key);
      }
    };

    if (action === "edit" || action === "close-edit") {
      editingId = action === "edit" ? booking.id : null;
      notices.delete(booking.id);
      paint();
      if (action === "edit") listEl.querySelector<HTMLSelectElement>(`[data-booking-id="${booking.id}"] [data-edit-date]`)?.focus();
      return;
    }

    if (action === "save-time") {
      const date = card.querySelector<HTMLSelectElement>("[data-edit-date]")?.value ?? "";
      const timeSelect = card.querySelector<HTMLSelectElement>("[data-edit-time]");
      const option = timeSelect?.selectedOptions[0];
      // A day whose times are all past or booked leaves nothing to pick.
      if (!date || !option || option.disabled) return fail("adminBookings.slotTaken");
      const minutes = Number(option.value);
      const slot = new Date(slotMs(date, minutes)).toISOString();
      if (Date.parse(slot) === Date.parse(booking.slot_start)) return fail("adminBookings.edit.same");
      const next = formatWhen(slot);
      if (!window.confirm(t("adminBookings.reschedulePrompt", { name: booking.name, when: `${next.day} ${next.time}` }))) return;
      card.querySelectorAll("button, select").forEach((b) => ((b as HTMLButtonElement).disabled = true));
      const result = await bookingAdminAction(booking, "reschedule", slot);
      if (!result.ok) return fail(result.error === "slot_taken" ? "adminBookings.slotTaken" : "adminBookings.saveError");
      Object.assign(booking, result.booking);
      editingId = null;
      notices.set(booking.id, { text: t(result.emailSent ? "adminBookings.sent.reschedule" : "adminBookings.notSent"), ok: result.emailSent });
      bookings.sort((a, b) => Date.parse(a.slot_start) - Date.parse(b.slot_start));
      paint();
      return;
    }

    if (action === "confirm") {
      if (!window.confirm(t("adminBookings.confirmPrompt", { name: booking.name, when: `${when.day} ${when.time}` }))) return;
      card.querySelectorAll("button, select").forEach((b) => ((b as HTMLButtonElement).disabled = true));
      const result = await bookingAdminAction(booking, "confirm");
      if (!result.ok) return fail("adminBookings.saveError");
      Object.assign(booking, result.booking);
      notices.set(booking.id, { text: t(result.emailSent ? "adminBookings.sent.confirm" : "adminBookings.notSent"), ok: result.emailSent });
      paint();
      return;
    }

    if (action === "cancel" && !window.confirm(t("adminBookings.cancelConfirm", { name: booking.name, when: `${when.day} ${when.time}` }))) return;

    const status: TourBooking["status"] = action === "cancel" ? "cancelled" : "booked";
    card.querySelectorAll("button").forEach((b) => (b.disabled = true));
    const result = await setTourBookingStatus(booking.id, status);
    if (result === "ok") {
      booking.status = status;
      notices.delete(booking.id);
      if (editingId === booking.id) editingId = null;
      paint();
      return;
    }
    fail(result === "slot_taken" ? "adminBookings.restoreTaken" : "adminBookings.saveError");
  });

  void load();
}
