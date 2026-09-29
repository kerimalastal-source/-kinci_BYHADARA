import { t, link, getProjectContent, intlTag, listSep } from "../../i18n";
import { requireAdmin } from "../../auth/session";
import { escapeHtml } from "../../utils/html";
import { getProjectBySlug } from "../../data/projects";
import { fetchTourBookings, type TourBooking } from "../../data/tourBookings";
import { fetchInquiries, type Inquiry } from "../../data/inquiries";
import { fetchPendingListings } from "../../data/listings";
import { fetchVisitStats } from "../../data/adminStats";
import { OPEN_STAGES, fetchCrmLeads, type CrmLead } from "../../data/crm";
import { followUpWhen, stageTag } from "./crmForm";
import { adminHero, adminNav } from "./nav";
import { dailyChart, sourceLabel } from "./stats";
import { publishSocialNow, type SocialPublishResult } from "../../data/socialPublish";

/**
 * The admin home (/admin): the day at a glance — today's and tomorrow's video tours,
 * inquiries waiting for an answer (oldest first, flagged after 24 hours), bookings to
 * confirm, listings to review and the last 7 days of visitors.
 */

const ISTANBUL = "Europe/Istanbul";
const DAY_MS = 86_400_000;
const STALE_MS = DAY_MS;

const tag = () => intlTag();
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
  slugs.map((slug) => (getProjectBySlug(slug) ? getProjectContent(slug).name : slug)).join(listSep());

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

function followUpRow(l: CrmLead): string {
  const late = Date.parse(l.follow_up_at!) < Date.now();
  const record = l.phone ?? l.email ?? l.name;
  return `<li class="admin-list__item">
    <span class="admin-list__time${late ? " admin-list__time--late" : ""}">${escapeHtml(followUpWhen(l.follow_up_at!))}</span>
    <span class="admin-list__main"><strong dir="auto">${escapeHtml(l.name)}</strong>${l.follow_up_note ? `<small dir="auto">${escapeHtml(l.follow_up_note)}</small>` : ""}</span>
    ${stageTag(l.stage)}
    <a class="admin-list__open" href="${link(`/admin/customers?q=${encodeURIComponent(record)}`)}">${t("adminHome.open")}</a>
  </li>`;
}

function list(items: string[], empty: string): string {
  return items.length ? `<ul class="admin-list">${items.join("")}</ul>` : `<p class="admin-stats__empty">${empty}</p>`;
}

/** One line about what the "publish now" button did. */
function socialStatus(result: SocialPublishResult | null): string {
  if (!result) return t("adminHome.social.error");
  if (result.started) return t("adminHome.social.started");
  if (result.error === "blob") return t("adminHome.social.blob");
  if (result.error === "forbidden") return t("adminHome.social.forbidden");
  if (result.error === "session") return t("adminHome.social.session");
  if (result.error === "http") return t("adminHome.social.http", { status: String(result.status ?? "") });
  if (result.error || !result.results) return t("adminHome.social.failed");
  if (!result.found) return t("adminHome.social.missing");
  if (result.results.some((r) => r.errors.length)) return t("adminHome.social.failed");
  const published = result.results.filter((r) => r.facebook === "published" || r.instagram === "published").length;
  return t("adminHome.social.done", { published: String(published), already: String(result.results.length - published) });
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
            <div data-home-followups></div>
          </section>
        </div>
        <section class="admin-panel admin-panel--wide">
          <h2 class="admin-panel__title">${t("adminHome.visitors")}</h2>
          <div data-home-visits><p>${t("common.loading")}</p></div>
          <a class="admin-panel__more" href="${link("/admin/stats")}">${t("adminHome.allStats")}</a>
        </section>
        <section class="admin-panel admin-panel--wide admin-social">
          <h2 class="admin-panel__title">${t("adminHome.social.title")}</h2>
          <p class="admin-panel__hint">${t("adminHome.social.hint")}</p>
          <button type="button" class="btn btn--primary btn--small" data-social-publish>${t("adminHome.social.button")}</button>
          <p class="admin-social__status" data-home-social role="status" aria-live="polite"></p>
        </section>
      </div>
    </section>`;

  main.querySelector<HTMLButtonElement>("[data-social-publish]")!.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const status = main.querySelector<HTMLElement>("[data-home-social]")!;
    button.disabled = true;
    status.textContent = t("adminHome.social.sending");
    const result = await publishSocialNow();
    button.disabled = false;
    status.textContent = socialStatus(result);
  });

  const requestId = crypto.randomUUID();
  main.dataset.requestId = requestId;
  const live = () => main.dataset.requestId === requestId;
  const $ = (name: string) => main.querySelector<HTMLElement>(`[data-home-${name}]`)!;

  void Promise.allSettled([fetchTourBookings(), fetchInquiries(), fetchPendingListings(), fetchVisitStats(7), fetchCrmLeads()]).then(
    ([bookingsResult, inquiriesResult, listingsResult, statsResult, crmResult]) => {
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

      // Sales follow-ups due today or overdue (the pipeline, migration 0010).
      const crm = crmResult.status === "fulfilled" ? crmResult.value : null;
      if (crm) {
        const endOfToday = Date.parse(`${todayKey}T21:00:00Z`); // 24:00 Istanbul
        const due = crm
          .filter((l) => l.follow_up_at && OPEN_STAGES.includes(l.stage) && Date.parse(l.follow_up_at) < endOfToday)
          .sort((a, b) => Date.parse(a.follow_up_at!) - Date.parse(b.follow_up_at!));
        $("followups").innerHTML = `<h3 class="admin-panel__subtitle">${t("adminHome.followUpsToday")}</h3>${list(due.slice(0, 8).map(followUpRow), t("adminHome.noFollowUps"))}
          <a class="admin-panel__more" href="${link("/admin/pipeline")}">${t("adminHome.allPipeline")}</a>`;
      }

      $("visits").innerHTML = stats
        ? `${dailyChart(stats.daily)}
          <p class="admin-home__visits">${t("adminHome.visitorsWeek", { count: String(stats.totals.visitors) })}${
            stats.sources.length ? ` · ${t("adminHome.topSources")}: ${stats.sources.slice(0, 3).map((s) => `${sourceLabel(s.source)} (${s.visitors})`).join(listSep())}` : ""
          }</p>`
        : `<p class="admin-stats__empty">${t("adminStats.unavailable")}</p>`;
    }
  );
}
