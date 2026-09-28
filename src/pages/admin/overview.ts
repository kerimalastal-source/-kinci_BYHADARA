import { t, link, getLocale, getProjectContent } from "../../i18n";
import { requireAdmin } from "../../auth/session";
import { escapeHtml } from "../../utils/html";
import { getProjectBySlug } from "../../data/projects";
import { fetchTourBookings, type TourBooking } from "../../data/tourBookings";
import { fetchInquiries, type Inquiry } from "../../data/inquiries";
import { fetchPendingListings } from "../../data/listings";
import { fetchVisitStats } from "../../data/adminStats";
import { adminHero, adminNav } from "./nav";
import { dailyChart, sourceLabel } from "./stats";

/**
 * The admin home (/admin): the day at a glance — today's and tomorrow's video tours,
 * inquiries waiting for an answer (oldest first, flagged after 24 hours), bookings to
 * confirm, listings to review and the last 7 days of visitors.
 */

const ISTANBUL = "Europe/Istanbul";
const DAY_MS = 86_400_000;
const STALE_MS = DAY_MS;

const tag = () => `${getLocale()}-u-nu-latn`;
const clock = (iso: string) =>
  new Intl.DateTimeFormat(tag(), { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ISTANBUL }).format(Date.parse(iso));
const istanbulDay = (ms: number) => new Date(ms + 3 * 3_600_000).toISOString().slice(0, 10);

/** "3 hours ago" / "2 days ago" in the page language. */
function ago(iso: string): string {
  const rtf = new Intl.RelativeTimeFormat(tag(), { numeric: "auto" });
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 60) return rtf.format(-Math.max(1, minutes), "minute");
  const hours = Math.round(minutes / 60);
  return hours < 48 ? rtf.format(-hours, "hour") : rtf.format(-Math.round(hours / 24), "day");
}

const projectNames = (slugs: string[]) =>
  slugs.map((slug) => (getProjectBySlug(slug) ? getProjectContent(slug).name : slug)).join(getLocale() === "ar" ? "، " : ", ");

function kpi(label: string, value: number | string, href: string, warn = false): string {
  return `<a class="admin-kpi admin-kpi--link${warn ? " admin-kpi--warn" : ""}" href="${href}">
    <p class="admin-kpi__label">${label}</p>
    <p class="admin-kpi__value" dir="ltr">${value}</p>
  </a>`;
}

function tourRow(b: TourBooking): string {
  const state =
    b.status === "confirmed" ? "confirmed" : b.customer_reply === "proposed" ? "proposed" : b.rescheduled_at && !b.customer_reply ? "waiting" : "booked";
  return `<li class="admin-list__item">
    <span class="admin-list__time" dir="ltr">${escapeHtml(clock(b.slot_start))}</span>
    <span class="admin-list__main"><strong dir="auto">${escapeHtml(b.name)}</strong><small>${escapeHtml(projectNames(b.projects))}</small></span>
    <span class="admin-tag admin-tag--${state}">${t(`adminHome.tourState.${state}`)}</span>
  </li>`;
}

function inquiryRow(i: Inquiry): string {
  const stale = Date.now() - Date.parse(i.created_at) > STALE_MS;
  return `<li class="admin-list__item">
    <span class="admin-list__main"><strong dir="auto">${escapeHtml(i.name)}</strong><small>${t(`adminInquiries.kinds.${i.kind}`)}</small></span>
    <span class="admin-tag${stale ? " admin-tag--late" : ""}">${escapeHtml(ago(i.created_at))}</span>
    <a class="admin-list__open" href="${link(`/admin/inquiries?q=${encodeURIComponent(i.reference)}`)}">${t("adminHome.open")}</a>
  </li>`;
}

function list(items: string[], empty: string): string {
  return items.length ? `<ul class="admin-list">${items.join("")}</ul>` : `<p class="admin-stats__empty">${empty}</p>`;
}

export function renderAdminOverview(main: HTMLElement): void {
  if (!requireAdmin(main)) return;

  const today = new Intl.DateTimeFormat(tag(), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: ISTANBUL }).format(Date.now());
  main.innerHTML = `
    ${adminHero(t("adminHome.heroTitle"), today)}
    <section class="section admin-home">
      <div class="container">
        ${adminNav("home")}
        <div class="admin-kpis" data-home-kpis><p>${t("common.loading")}</p></div>
        <div class="admin-panels admin-panels--two">
          <section class="admin-panel">
            <h2 class="admin-panel__title">${t("adminHome.toursToday")}</h2>
            <div data-home-today></div>
            <h3 class="admin-panel__subtitle">${t("adminHome.toursTomorrow")}</h3>
            <div data-home-tomorrow></div>
            <a class="admin-panel__more" href="${link("/admin/bookings")}">${t("adminHome.allBookings")}</a>
          </section>
          <section class="admin-panel">
            <h2 class="admin-panel__title">${t("adminHome.followUp")}</h2>
            <p class="admin-panel__hint">${t("adminHome.followUpHint")}</p>
            <div data-home-inquiries></div>
            <a class="admin-panel__more" href="${link("/admin/inquiries")}">${t("adminHome.allInquiries")}</a>
          </section>
        </div>
        <section class="admin-panel admin-panel--wide">
          <h2 class="admin-panel__title">${t("adminHome.visitors")}</h2>
          <div data-home-visits><p>${t("common.loading")}</p></div>
          <a class="admin-panel__more" href="${link("/admin/stats")}">${t("adminHome.allStats")}</a>
        </section>
      </div>
    </section>`;

  const requestId = crypto.randomUUID();
  main.dataset.requestId = requestId;
  const live = () => main.dataset.requestId === requestId;
  const $ = (name: string) => main.querySelector<HTMLElement>(`[data-home-${name}]`)!;

  void Promise.allSettled([fetchTourBookings(), fetchInquiries(), fetchPendingListings(), fetchVisitStats(7)]).then(
    ([bookingsResult, inquiriesResult, listingsResult, statsResult]) => {
      if (!live()) return;
      const bookings = bookingsResult.status === "fulfilled" ? bookingsResult.value : [];
      const inquiries = inquiriesResult.status === "fulfilled" ? inquiriesResult.value : [];
      const pendingListings = listingsResult.status === "fulfilled" ? listingsResult.value.length : 0;
      const stats = statsResult.status === "fulfilled" ? statsResult.value : null;

      const now = Date.now();
      const todayKey = istanbulDay(now);
      const tomorrowKey = istanbulDay(now + DAY_MS);
      const active = bookings.filter((b) => b.status !== "cancelled");
      const toursToday = active.filter((b) => istanbulDay(Date.parse(b.slot_start)) === todayKey);
      const toursTomorrow = active.filter((b) => istanbulDay(Date.parse(b.slot_start)) === tomorrowKey);
      const toConfirm = active.filter((b) => b.status === "booked" && Date.parse(b.slot_start) > now).length;
      const fresh = inquiries.filter((i) => i.status === "new").sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
      const stale = fresh.filter((i) => now - Date.parse(i.created_at) > STALE_MS).length;
      const visitorsToday = stats?.daily.at(-1)?.visitors;

      $("kpis").innerHTML = [
        kpi(t("adminHome.kpi.newInquiries"), fresh.length, link("/admin/inquiries")),
        kpi(t("adminHome.kpi.stale"), stale, link("/admin/inquiries"), stale > 0),
        kpi(t("adminHome.kpi.toConfirm"), toConfirm, link("/admin/bookings"), toConfirm > 0),
        kpi(t("adminHome.kpi.toursToday"), toursToday.length, link("/admin/bookings")),
        kpi(t("adminHome.kpi.visitorsToday"), visitorsToday ?? "—", link("/admin/stats")),
        kpi(t("adminHome.kpi.listings"), pendingListings, link("/admin/listings"), pendingListings > 0)
      ].join("");

      $("today").innerHTML = list(toursToday.map(tourRow), t("adminHome.noToursToday"));
      $("tomorrow").innerHTML = list(toursTomorrow.map(tourRow), t("adminHome.noToursTomorrow"));
      $("inquiries").innerHTML = list(fresh.slice(0, 8).map(inquiryRow), t("adminHome.noFollowUp"));
      if (fresh.length > 8) $("inquiries").insertAdjacentHTML("beforeend", `<p class="admin-panel__hint">${t("adminHome.more", { count: fresh.length - 8 })}</p>`);

      $("visits").innerHTML = stats
        ? `${dailyChart(stats.daily)}
          <p class="admin-home__visits">${t("adminHome.visitorsWeek", { count: String(stats.totals.visitors) })}${
            stats.sources.length ? ` · ${t("adminHome.topSources")}: ${stats.sources.slice(0, 3).map((s) => `${sourceLabel(s.source)} (${s.visitors})`).join(getLocale() === "ar" ? "، " : ", ")}` : ""
          }</p>`
        : `<p class="admin-stats__empty">${t("adminStats.unavailable")}</p>`;
    }
  );
}
