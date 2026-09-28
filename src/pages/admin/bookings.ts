import { t, link, getLocale, getProjectContent } from "../../i18n";
import { requireAdmin } from "../../auth/session";
import { escapeHtml } from "../../utils/html";
import { getProjectBySlug } from "../../data/projects";
import { fetchTourBookings, setTourBookingStatus, type TourBooking } from "../../data/tourBookings";

/**
 * Admin page for private video tour bookings (/admin/bookings): upcoming, past and
 * cancelled tabs; "Confirm" marks a booking as seen and ready, "Cancel" frees the hour
 * (after a confirmation prompt — the visitor is NOT notified automatically, the team
 * contacts them), and a cancelled booking can be restored while its hour is still free.
 */

type Tab = "upcoming" | "past" | "cancelled";
const TABS: Tab[] = ["upcoming", "past", "cancelled"];
const ISTANBUL = "Europe/Istanbul";
/** A tour counts as past once it has ended (45 minutes). */
const TOUR_MS = 45 * 60_000;

let activeTab: Tab = "upcoming";

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

function renderCard(booking: TourBooking, tab: Tab): string {
  const when = formatWhen(booking.slot_start);
  const phoneDigits = booking.phone.replace(/[^\d]/g, "");
  const actions =
    booking.status === "cancelled"
      ? `<button type="button" class="btn btn--outline btn--small" data-booking-action="restore">${t("adminBookings.actions.restore")}</button>`
      : `${
          booking.status === "booked" && tab === "upcoming"
            ? `<button type="button" class="btn btn--primary btn--small" data-booking-action="confirm">${t("adminBookings.actions.confirm")}</button>`
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
      <p class="booking-card__error" role="alert" data-booking-error></p>
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
      ? items.map((b) => renderCard(b, activeTab)).join("")
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

  listEl.addEventListener("click", async (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>("[data-booking-action]");
    const card = button?.closest<HTMLElement>("[data-booking-id]");
    const booking = bookings.find((b) => b.id === card?.dataset.bookingId);
    if (!button || !card || !booking) return;
    const action = button.dataset.bookingAction as "confirm" | "cancel" | "restore";
    const when = formatWhen(booking.slot_start);

    if (action === "cancel" && !window.confirm(t("adminBookings.cancelConfirm", { name: booking.name, when: `${when.day} ${when.time}` }))) return;

    const status: TourBooking["status"] = action === "confirm" ? "confirmed" : action === "cancel" ? "cancelled" : "booked";
    card.querySelectorAll("button").forEach((b) => (b.disabled = true));
    const result = await setTourBookingStatus(booking.id, status);
    if (result === "ok") {
      booking.status = status;
      paint();
      return;
    }
    card.querySelectorAll("button").forEach((b) => (b.disabled = false));
    const error = card.querySelector<HTMLElement>("[data-booking-error]");
    if (error) error.textContent = t(result === "slot_taken" ? "adminBookings.restoreTaken" : "adminBookings.saveError");
  });

  void load();
}
