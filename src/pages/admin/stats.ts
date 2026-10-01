import { t, getLocale, getProjectContent, intlTag } from "../../i18n";
import { requireAdmin } from "../../auth/session";
import { escapeHtml } from "../../utils/html";
import { getProjectBySlug } from "../../data/projects";
import {
  fetchBehaviorStats,
  fetchConsentStats,
  fetchVisitStats,
  type BehaviorStats,
  type ConsentStats,
  type VisitStats
} from "../../data/adminStats";
import { adminHero, adminNav } from "./nav";

/**
 * Visitor statistics (/admin/stats), from the anonymous visit records (kept a year since
 * migration 0015; admin_visit_stats(), supabase/migrations/0008 and 0017): visitors per day,
 * where they came from (ads, search, direct), countries, the projects they looked at, and the
 * messages and tour bookings each source brought. "What visitors do" (admin_behavior_stats(),
 * 0016): devices, button presses, interest per project, and forms started vs sent.
 */

const PERIODS = [7, 30, 90] as const;
let period: (typeof PERIODS)[number] = 7;

const tag = () => intlTag();
const num = (n: number) => new Intl.NumberFormat(tag()).format(n);
const pct = (part: number, whole: number) => (whole ? `${new Intl.NumberFormat(tag(), { maximumFractionDigits: 1 }).format((part / whole) * 100)}%` : "—");

/** Traffic sources as the database names them → dictionary keys (a dot can't be in a key). */
const SOURCE_KEYS: Record<string, string> = {
  direct: "direct",
  none: "none",
  "google-ads": "googleAds",
  "google.com": "googleSearch",
  google: "google",
  facebook: "facebook",
  "facebook.com": "facebook",
  instagram: "instagram",
  "instagram.com": "instagram",
  tiktok: "tiktok",
  "tiktok.com": "tiktok",
  "bing.com": "bing",
  youtube: "youtube",
  "youtube.com": "youtube",
  whatsapp: "whatsapp"
};

export function sourceLabel(source: string): string {
  const key = SOURCE_KEYS[source];
  return key ? t(`adminStats.sources.${key}`) : escapeHtml(source);
}

function countryLabel(code: string): string {
  if (!code) return t("adminStats.unknownCountry");
  try {
    return escapeHtml(new Intl.DisplayNames([getLocale()], { type: "region" }).of(code) ?? code);
  } catch {
    return escapeHtml(code);
  }
}

function pageLabel(page: string): string {
  const slug = page.match(/^\/projects\/([a-z0-9-]+)/)?.[1];
  if (slug && getProjectBySlug(slug)) return escapeHtml(getProjectContent(slug).name);
  const text = t(`adminStats.pages.${page === "/" ? "home" : page.slice(1).replace(/\//g, "_")}`);
  return text.startsWith("adminStats.pages.") ? `<span dir="ltr">${escapeHtml(page)}</span>` : text;
}

/** A ranked list: label, a bar as long as its share of the largest value, and the value. */
export function barList(rows: { label: string; value: number; note?: string }[], empty: string): string {
  if (!rows.length) return `<p class="admin-stats__empty">${empty}</p>`;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return `<ul class="bar-list">${rows
    .map(
      (r) => `<li>
        <span class="bar-list__label">${r.label}</span>
        <span class="bar-list__track" aria-hidden="true"><span class="bar-list__bar" style="width:${Math.max(2, (r.value / max) * 100)}%"></span></span>
        <span class="bar-list__value">${num(r.value)}${r.note ? ` <small>${r.note}</small>` : ""}</span>
      </li>`
    )
    .join("")}</ul>`;
}

/** Visitors per day as columns; each shows its numbers on hover or focus. */
export function dailyChart(daily: VisitStats["daily"]): string {
  const max = Math.max(...daily.map((d) => d.visitors), 1);
  const dense = daily.length > 10;
  // Every 3rd day under a month, every 7th for longer periods.
  const every = daily.length > 31 ? 7 : 3;
  const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(tag(), { ...opts, timeZone: "UTC" }).format(Date.parse(`${day}T12:00:00Z`));
  const peak = daily.reduce((best, d, i) => (d.visitors > daily[best].visitors ? i : best), 0);
  const columns = daily
    .map((d, i) => {
      const full = dayLabel(d.day, { weekday: "long", day: "numeric", month: "long" });
      const tip = `${full}: ${t("adminStats.tipVisitors", { count: num(d.visitors) })} · ${t("adminStats.tipPages", { count: num(d.pages) })}`;
      const showValue = d.visitors > 0 && (i === peak || i === daily.length - 1);
      return `<div class="day-chart__col" tabindex="0" role="img" aria-label="${escapeHtml(tip)}">
        <span class="day-chart__tip" aria-hidden="true">${escapeHtml(tip)}</span>
        <span class="day-chart__bar-wrap">
          ${showValue ? `<span class="day-chart__value">${num(d.visitors)}</span>` : ""}
          <span class="day-chart__bar${d.visitors ? "" : " day-chart__bar--zero"}" style="height:${(d.visitors / max) * 100}%"></span>
        </span>
        <span class="day-chart__label">${
          dense
            ? escapeHtml(i % every === (daily.length - 1) % every ? dayLabel(d.day, { day: "numeric", month: "numeric" }) : "")
            : `<span class="day-chart__label-long">${escapeHtml(dayLabel(d.day, { weekday: "short" }))}</span><span class="day-chart__label-short">${escapeHtml(dayLabel(d.day, { day: "numeric" }))}</span>`
        }</span>
      </div>`;
    })
    .join("");
  return `<div class="day-chart${dense ? " day-chart--dense" : ""}" dir="ltr">
    <span class="day-chart__max" aria-hidden="true">${num(max)}</span>
    <div class="day-chart__cols">${columns}</div>
  </div>`;
}

function tile(label: string, value: string, note = ""): string {
  return `<div class="admin-kpi"><p class="admin-kpi__label">${label}</p><p class="admin-kpi__value" dir="ltr">${value}</p>${note ? `<p class="admin-kpi__note">${note}</p>` : ""}</div>`;
}

function panel(title: string, body: string, wide = false): string {
  return `<section class="admin-panel${wide ? " admin-panel--wide" : ""}"><h2 class="admin-panel__title">${title}</h2>${body}</section>`;
}

/** Accepted / declined / didn't answer, out of the visits that saw the cookie notice. */
function consentPanel(c: ConsentStats | null): string {
  if (!c) return panel(t("adminStats.consentTitle"), `<p class="admin-stats__empty">${t("adminStats.consentUnavailable")}</p>`);
  if (!c.shown) return panel(t("adminStats.consentTitle"), `<p class="admin-stats__empty">${t("adminStats.consentEmpty")}</p>`);
  const rows = [
    { label: t("adminStats.consentAccepted"), value: c.granted },
    { label: t("adminStats.consentDeclined"), value: c.denied },
    { label: t("adminStats.consentIgnored"), value: c.ignored }
  ].map((r) => ({ ...r, note: pct(r.value, c.shown) }));
  const recent = period > 30 ? ` ${t("adminStats.consentRecent")}` : "";
  return panel(t("adminStats.consentTitle"), `<p class="admin-panel__hint">${t("adminStats.consentHint", { count: num(c.shown) })}${recent}</p>${barList(rows, "")}`);
}

const CONTACT_ACTIONS = new Set(["whatsapp", "call", "interested"]);
const VIEW_ACTIONS = new Set(["video_play", "map_open"]);

/** A dictionary label, or the raw value (escaped) when the dictionary has none. */
function label(key: string, raw: string): string {
  const text = t(key);
  return text === key ? escapeHtml(raw) : text;
}

/** Contact rate, devices, each action, interest per project, and forms started vs sent. */
function behaviorSection(b: BehaviorStats | null): string {
  const head = `<h2 class="admin-stats__section">${t("adminStats.behavior.title")}</h2>
    <p class="admin-stats__section-hint">${t("adminStats.behavior.hint")}</p>`;
  if (!b) return `${head}<p class="admin-bookings__empty">${t("adminStats.behavior.unavailable")}</p>`;

  const empty = t("adminStats.behavior.empty");
  const devices = barList(
    b.devices.map((d) => ({
      label: label(`adminStats.behavior.devices.${d.device}`, d.device),
      value: d.visits,
      note: t("adminStats.behavior.devicesNote", { rate: pct(d.contacted, d.visits) })
    })),
    t("adminStats.empty")
  );
  const actions = barList(
    b.actions.map((a) => ({ label: label(`adminStats.behavior.actions.${a.action}`, a.action), value: a.sessions, note: pct(a.sessions, b.visits) })),
    empty
  );

  const perProject = new Map<string, { contact: number; saved: number; viewed: number }>();
  for (const row of b.projects) {
    if (!getProjectBySlug(row.slug)) continue;
    const entry = perProject.get(row.slug) ?? { contact: 0, saved: 0, viewed: 0 };
    if (CONTACT_ACTIONS.has(row.action)) entry.contact += row.sessions;
    else if (row.action === "favorite") entry.saved += row.sessions;
    else if (VIEW_ACTIONS.has(row.action)) entry.viewed += row.sessions;
    perProject.set(row.slug, entry);
  }
  const projectRows = [...perProject]
    .sort(([, a], [, b]) => b.contact - a.contact || b.saved - a.saved || b.viewed - a.viewed)
    .slice(0, 12);
  const projects = projectRows.length
    ? `<div class="admin-table-fit"><table class="admin-table">
        <thead><tr><th>${t("adminStats.behavior.project")}</th><th>${t("adminStats.behavior.contact")}</th><th>${t("adminStats.behavior.saved")}</th><th>${t("adminStats.behavior.viewed")}</th></tr></thead>
        <tbody>${projectRows
          .map(([slug, r]) => `<tr><td>${escapeHtml(getProjectContent(slug).name)}</td><td dir="ltr">${num(r.contact)}</td><td dir="ltr">${num(r.saved)}</td><td dir="ltr">${num(r.viewed)}</td></tr>`)
          .join("")}</tbody>
      </table></div>`
    : `<p class="admin-stats__empty">${empty}</p>`;

  const forms = b.forms.length
    ? `<div class="admin-table-fit"><table class="admin-table">
        <thead><tr><th>${t("adminStats.behavior.form")}</th><th>${t("adminStats.behavior.started")}</th><th>${t("adminStats.behavior.sent")}</th><th>${t("adminStats.behavior.completion")}</th></tr></thead>
        <tbody>${b.forms
          .map(
            (r) =>
              `<tr><td>${label(`adminStats.behavior.forms.${r.form}`, r.form)}</td><td dir="ltr">${num(r.started)}</td><td dir="ltr">${num(r.sent)}</td><td dir="ltr">${r.started ? pct(Math.min(r.sent, r.started), r.started) : "—"}</td></tr>`
          )
          .join("")}</tbody>
      </table></div>`
    : `<p class="admin-stats__empty">${empty}</p>`;

  return `${head}
    <div class="admin-kpis">
      ${tile(t("adminStats.behavior.contacted"), num(b.contacted), t("adminStats.behavior.contactedNote"))}
      ${tile(t("adminStats.behavior.contactRate"), pct(b.contacted, b.visits), t("adminStats.behavior.contactRateNote"))}
    </div>
    <div class="admin-panels">
      ${panel(t("adminStats.behavior.actionsTitle"), `<p class="admin-panel__hint">${t("adminStats.behavior.actionsHint")}</p>${actions}`)}
      ${panel(t("adminStats.behavior.devicesTitle"), devices)}
      ${panel(t("adminStats.behavior.projectsTitle"), `<p class="admin-panel__hint">${t("adminStats.behavior.projectsHint")}</p>${projects}`)}
      ${panel(t("adminStats.behavior.formsTitle"), `<p class="admin-panel__hint">${t("adminStats.behavior.formsHint")}</p>${forms}`)}
    </div>`;
}

function renderStats(s: VisitStats, consent: ConsentStats | null, behavior: BehaviorStats | null): string {
  const leads = s.leads.inquiries + s.leads.bookings;
  const leadRows = s.lead_sources.length
    ? `<table class="admin-table">
        <thead><tr><th>${t("adminStats.source")}</th><th>${t("adminStats.inquiries")}</th><th>${t("adminStats.bookings")}</th></tr></thead>
        <tbody>${s.lead_sources
          .map((r) => `<tr><td>${sourceLabel(r.source)}</td><td dir="ltr">${num(r.inquiries)}</td><td dir="ltr">${num(r.bookings)}</td></tr>`)
          .join("")}</tbody>
      </table>`
    : `<p class="admin-stats__empty">${t("adminStats.noLeads")}</p>`;

  // Before migration 0017 the visit statistics stop at 30 days.
  const limited = s.days < period ? `<p class="admin-stats__limited">${t("adminStats.limitedDays", { count: num(s.days) })}</p>` : "";

  return `
    ${limited}
    <div class="admin-kpis">
      ${tile(t("adminStats.kpi.visitors"), num(s.totals.visitors))}
      ${tile(t("adminStats.kpi.pages"), num(s.totals.pages), t("adminStats.kpi.perVisit", { count: s.totals.visitors ? (s.totals.pages / s.totals.visitors).toFixed(1) : "0" }))}
      ${tile(t("adminStats.kpi.engaged"), pct(s.totals.multi_page, s.totals.visitors), t("adminStats.kpi.engagedNote"))}
      ${tile(t("adminStats.kpi.leads"), num(leads), t("adminStats.kpi.leadsNote", { inquiries: num(s.leads.inquiries), bookings: num(s.leads.bookings) }))}
      ${tile(t("adminStats.kpi.conversion"), pct(leads, s.totals.visitors), t("adminStats.kpi.conversionNote"))}
    </div>
    ${panel(t("adminStats.dailyTitle"), dailyChart(s.daily), true)}
    <div class="admin-panels">
      ${panel(t("adminStats.sourcesTitle"), barList(s.sources.map((r) => ({ label: sourceLabel(r.source), value: r.visitors, note: pct(r.visitors, s.totals.visitors) })), t("adminStats.empty")))}
      ${panel(t("adminStats.leadsTitle"), `<p class="admin-panel__hint">${t("adminStats.leadsHint")}</p>${leadRows}`)}
      ${panel(t("adminStats.projectsTitle"), barList(s.projects.filter((p) => getProjectBySlug(p.slug)).map((p) => ({ label: escapeHtml(getProjectContent(p.slug).name), value: p.visitors })), t("adminStats.empty")))}
      ${panel(t("adminStats.countriesTitle"), barList(s.countries.map((r) => ({ label: countryLabel(r.country), value: r.visitors, note: pct(r.visitors, s.totals.visitors) })), t("adminStats.empty")))}
      ${panel(t("adminStats.campaignsTitle"), barList(s.campaigns.map((r) => ({ label: `${sourceLabel(r.source)} · <span dir="ltr">${escapeHtml(r.campaign)}</span>`, value: r.visitors })), t("adminStats.noCampaigns")))}
      ${panel(t("adminStats.landingsTitle"), barList(s.landings.map((r) => ({ label: pageLabel(r.page), value: r.visitors })), t("adminStats.empty")))}
      ${panel(t("adminStats.localesTitle"), barList(s.locales.map((r) => ({ label: t(`lang.${r.locale}`), value: r.visitors, note: pct(r.visitors, s.totals.visitors) })), t("adminStats.empty")))}
      ${consentPanel(consent)}
    </div>
    ${behaviorSection(behavior)}
    <p class="admin-bookings__note">${t("adminStats.note")}</p>`;
}

export function renderAdminStats(main: HTMLElement): void {
  if (!requireAdmin(main)) return;

  main.innerHTML = `
    ${adminHero(t("adminStats.heroTitle"), t("adminStats.heroSubtitle"))}
    <section class="section admin-stats">
      <div class="container">
        ${adminNav("stats")}
        <div class="admin-stats__periods" role="group" aria-label="${t("adminStats.period")}"></div>
        <div class="admin-stats__body" aria-live="polite"><p>${t("common.loading")}</p></div>
      </div>
    </section>`;

  const requestId = crypto.randomUUID();
  main.dataset.requestId = requestId;
  const periodsEl = main.querySelector<HTMLElement>(".admin-stats__periods")!;
  const bodyEl = main.querySelector<HTMLElement>(".admin-stats__body")!;

  const load = async () => {
    periodsEl.innerHTML = PERIODS.map(
      (p) => `<button type="button" class="admin-stats__period" data-period="${p}" aria-pressed="${p === period}">${t("adminStats.lastDays", { count: p })}</button>`
    ).join("");
    const [stats, consent, behavior] = await Promise.all([fetchVisitStats(period), fetchConsentStats(period), fetchBehaviorStats(period)]);
    if (main.dataset.requestId !== requestId) return;
    bodyEl.innerHTML = stats ? renderStats(stats, consent, behavior) : `<p class="admin-bookings__empty">${t("adminStats.unavailable")}</p>`;
  };

  periodsEl.addEventListener("click", (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>("[data-period]");
    if (!button) return;
    period = Number(button.dataset.period) as (typeof PERIODS)[number];
    bodyEl.style.opacity = "0.5";
    void load().then(() => (bodyEl.style.opacity = ""));
  });

  void load();
}
