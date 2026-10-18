import { t, getLocale, getProjectContent, intlTag } from "../../i18n";
import { requireAdmin } from "../../auth/session";
import { escapeHtml } from "../../utils/html";
import { getProjectBySlug } from "../../data/projects";
import {
  fetchBehaviorStats,
  fetchConsentStats,
  fetchRealVisitorStats,
  fetchStatsOverview,
  fetchVisitStats,
  fetchWaitingInquiries,
  type BehaviorStats,
  type ConsentStats,
  type RealVisitorStats,
  type StatsOverview,
  type VisitStats,
  type WaitingInquiry
} from "../../data/adminStats";
import { adminHero, adminNav } from "./nav";
import { initVisitorsChart, visitorsChart } from "./visitorsChart";
import { downloadCsv, excludedLine, initSourcesPanel, initWaitingPanel, sourcesPanel, statsCards, waitingPanel, type VisitMode } from "./statsTop";

/**
 * Visitor statistics (/admin/stats), from the anonymous visit records (kept a year since
 * migration 0015; admin_visit_stats(), supabase/migrations/0008 and 0017): visitors per day,
 * where they came from (ads, search, direct), countries, the projects they looked at, and the
 * messages and tour bookings each source brought. "What visitors do" (admin_behavior_stats(),
 * 0016): devices, button presses, interest per project, and forms started vs sent. "Real visitors
 * per day" (admin_real_visitor_stats(), 0020/0021) leads the page; since 0021-0023 every number on
 * it leaves automated visits out. Since 0024 (owner's redesign 2026-10-18, phase 1) the page
 * opens with four cards against the previous period, the inquiries awaiting a reply and the
 * source x campaign table (statsTop.ts); the older lists are folded below.
 */

const PERIODS = [7, 30, 90, 365] as const;
let period: (typeof PERIODS)[number] = 30;
let mode: VisitMode = "real";

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
  whatsapp: "whatsapp",
  // Customers added by hand on the pipeline page (migration 0019).
  social: "social",
  website: "website",
  referral: "referral"
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

const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(tag(), { ...opts, timeZone: "UTC" }).format(Date.parse(`${day}T12:00:00Z`));

/** The label under day i of n: every 3rd day under a month, every 7th for longer periods; weekdays for a week. */
function axisLabel(day: string, i: number, n: number): string {
  if (n <= 10) {
    return `<span class="day-chart__label-long">${escapeHtml(dayLabel(day, { weekday: "short" }))}</span><span class="day-chart__label-short">${escapeHtml(dayLabel(day, { day: "numeric" }))}</span>`;
  }
  const every = n > 31 ? 7 : 3;
  // "3/10" built by hand: Intl's Arabic day/month carries direction marks that scramble it in the LTR axis.
  const [, month, date] = day.split("-").map(Number);
  return i % every === (n - 1) % every ? `${date}/${month}` : "";
}

/** Visitors per day as columns; each shows its numbers on hover or focus. */
export function dailyChart(daily: VisitStats["daily"]): string {
  const max = Math.max(...daily.map((d) => d.visitors), 1);
  const dense = daily.length > 10;
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
        <span class="day-chart__label">${axisLabel(d.day, i, daily.length)}</span>
      </div>`;
    })
    .join("");
  return `<div class="day-chart${dense ? " day-chart--dense" : ""}" dir="ltr">
    <span class="day-chart__max" aria-hidden="true">${num(max)}</span>
    <div class="day-chart__cols">${columns}</div>
  </div>`;
}

/** The visitors panel: the period's figures, the legend and the chart (automated visits left out). */
function visitorsPanel(r: RealVisitorStats | null): string {
  const title = t("adminStats.real.title");
  if (!r) return panel(title, `<p class="admin-stats__empty">${t("adminStats.real.unavailable")}</p>`, true);
  const total = r.daily.reduce((s, d) => s + d.visitors, 0);
  const contacted = r.daily.reduce((s, d) => s + d.contacted, 0);
  const best = r.daily.reduce((b, d) => (d.visitors > b.visitors ? d : b), r.daily[0]);
  const average = r.daily.length ? total / r.daily.length : 0;
  const early = r.daily.some((d) => d.visitors > 0 && d.day < "2026-10-02") ? `<p class="admin-panel__hint vchart-note">${t("adminStats.real.early")}</p>` : "";
  const figure = (label: string, value: string, note = "") =>
    `<div class="vchart-figure"><p class="vchart-figure__label">${label}</p><p class="vchart-figure__value"><span dir="ltr">${value}</span></p>${note ? `<p class="vchart-figure__note">${note}</p>` : ""}</div>`;
  const chart = visitorsChart(r.daily, {
    date: (day) => dayLabel(day, { weekday: "long", day: "numeric", month: "long" }),
    axis: axisLabel,
    minor: (i, n) => n > 10 && ((n - 1 - i) / (n > 31 ? 7 : 3)) % 2 === 1,
    num,
    visitors: t("adminStats.real.tipVisitors"),
    pages: t("adminStats.real.tipPages"),
    contacted: t("adminStats.real.tipContacted"),
    label: t("adminStats.real.chartLabel")
  });
  return panel(
    title,
    `<p class="admin-panel__hint">${t("adminStats.real.hint")} ${r.automated ? t("adminStats.real.excluded", { count: num(r.automated) }) : ""}</p>
    <div class="vchart-figures">
      ${figure(t("adminStats.real.visitors"), num(total))}
      ${figure(t("adminStats.real.average"), new Intl.NumberFormat(tag(), { maximumFractionDigits: 1 }).format(average))}
      ${figure(t("adminStats.real.best"), num(best?.visitors ?? 0), best?.visitors ? escapeHtml(dayLabel(best.day, { day: "numeric", month: "long" })) : "")}
      ${figure(t("adminStats.real.contacted"), num(contacted))}
    </div>
    <ul class="vchart-legend">
      <li><i class="vchart-legend__line"></i>${t("adminStats.real.legendVisitors")}</li>
      <li><i class="vchart-legend__mark"></i>${t("adminStats.real.legendContact")}</li>
    </ul>
    ${chart}
    ${early}`,
    true
  );
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

/** The folded details under the sources table: the former source, campaign, request and landing lists. */
function sourceDetails(s: VisitStats | null): string {
  if (!s) return `<p class="admin-stats__empty">${t("adminStats.unavailable")}</p>`;
  const leadRows = s.lead_sources.length
    ? `<div class="admin-table-fit"><table class="admin-table">
        <thead><tr><th>${t("adminStats.source")}</th><th>${t("adminStats.inquiries")}</th><th>${t("adminStats.bookings")}</th></tr></thead>
        <tbody>${s.lead_sources
          .map((r) => `<tr><td>${sourceLabel(r.source)}</td><td dir="ltr">${num(r.inquiries)}</td><td dir="ltr">${num(r.bookings)}</td></tr>`)
          .join("")}</tbody>
      </table></div>`
    : `<p class="admin-stats__empty">${t("adminStats.noLeads")}</p>`;
  return `<div class="admin-panels">
    ${panel(t("adminStats.sourcesTitle"), barList(s.sources.map((r) => ({ label: sourceLabel(r.source), value: r.visitors, note: pct(r.visitors, s.totals.visitors) })), t("adminStats.empty")))}
    ${panel(t("adminStats.leadsTitle"), `<p class="admin-panel__hint">${t("adminStats.leadsHint")}</p>${leadRows}`)}
    ${panel(t("adminStats.campaignsTitle"), barList(s.campaigns.map((r) => ({ label: `${sourceLabel(r.source)} · <span dir="ltr">${escapeHtml(r.campaign)}</span>`, value: r.visitors })), t("adminStats.noCampaigns")))}
    ${panel(t("adminStats.landingsTitle"), barList(s.landings.map((r) => ({ label: pageLabel(r.page), value: r.visitors })), t("adminStats.empty")))}
  </div>`;
}

/** Everything else, folded at the bottom: pages per visit, projects, countries, languages, cookies, behaviour. */
function moreSection(s: VisitStats | null, consent: ConsentStats | null, behavior: BehaviorStats | null): string {
  const visits = s
    ? `<div class="admin-kpis">
        ${tile(t("adminStats.kpi.pages"), num(s.totals.pages), t("adminStats.kpi.perVisit", { count: s.totals.visitors ? (s.totals.pages / s.totals.visitors).toFixed(1) : "0" }))}
        ${tile(t("adminStats.kpi.engaged"), pct(s.totals.multi_page, s.totals.visitors), t("adminStats.kpi.engagedNote"))}
      </div>
      <div class="admin-panels">
        ${panel(t("adminStats.projectsTitle"), barList(s.projects.filter((p) => getProjectBySlug(p.slug)).map((p) => ({ label: escapeHtml(getProjectContent(p.slug).name), value: p.visitors })), t("adminStats.empty")))}
        ${panel(t("adminStats.countriesTitle"), barList(s.countries.map((r) => ({ label: countryLabel(r.country), value: r.visitors, note: pct(r.visitors, s.totals.visitors) })), t("adminStats.empty")))}
        ${panel(t("adminStats.localesTitle"), barList(s.locales.map((r) => ({ label: t(`lang.${r.locale}`), value: r.visitors, note: pct(r.visitors, s.totals.visitors) })), t("adminStats.empty")))}
        ${consentPanel(consent)}
      </div>`
    : `<p class="admin-stats__empty">${t("adminStats.unavailable")}</p>`;
  return `<details class="stats-fold"><summary>${t("adminStats.top.more")}</summary><div class="stats-fold__body">${visits}${behaviorSection(behavior)}</div></details>`;
}

interface Loaded {
  stats: VisitStats | null;
  consent: ConsentStats | null;
  behavior: BehaviorStats | null;
  real: RealVisitorStats | null;
  overview: StatsOverview | null;
  waiting: WaitingInquiry[] | null;
  waitingTotal: number;
}

/** The page in the owner's order: cards, awaiting reply, the chart, sources; the rest folded below. */
function renderStats(d: Loaded): string {
  // Before migration 0017 the visit statistics stop at 30 days.
  const limited = d.stats && d.stats.days < period ? `<p class="admin-stats__limited">${t("adminStats.limitedDays", { count: num(d.stats.days) })}</p>` : "";
  return `
    ${limited}
    <p class="stats-excluded">${excludedLine(d.overview, mode)}</p>
    ${mode === "all" ? `<p class="stats-excluded">${t("adminStats.top.allNote")}</p>` : ""}
    ${statsCards(d.overview, mode)}
    ${waitingPanel(d.waiting, d.waitingTotal, !d.overview)}
    ${visitorsPanel(d.real)}
    ${sourcesPanel(d.overview, mode, sourceLabel, sourceDetails(d.stats))}
    ${moreSection(d.stats, d.consent, d.behavior)}
    <p class="admin-bookings__note">${t("adminStats.note")}</p>`;
}

/** A source's name as plain text (for the CSV file). */
function sourceText(source: string): string {
  const el = document.createElement("span");
  el.innerHTML = sourceLabel(source);
  return el.textContent ?? source;
}

export function renderAdminStats(main: HTMLElement): void {
  if (!requireAdmin(main)) return;

  main.innerHTML = `
    ${adminHero(t("adminStats.heroTitle"), t("adminStats.heroSubtitle"))}
    <section class="section admin-stats">
      <div class="container">
        ${adminNav("stats")}
        <div class="stats-toolbar">
          <div class="admin-stats__periods" role="group" aria-label="${t("adminStats.period")}"></div>
          <div class="admin-stats__periods" role="group" aria-label="${t("adminStats.top.modeLabel")}" data-modes></div>
          <button type="button" class="btn btn--outline btn--small stats-export" data-export disabled>${t("adminStats.top.export")}</button>
        </div>
        <div class="admin-stats__body" aria-live="polite"><p>${t("common.loading")}</p></div>
      </div>
    </section>`;

  const requestId = crypto.randomUUID();
  main.dataset.requestId = requestId;
  const periodsEl = main.querySelector<HTMLElement>(".admin-stats__periods")!;
  const modesEl = main.querySelector<HTMLElement>("[data-modes]")!;
  const exportEl = main.querySelector<HTMLButtonElement>("[data-export]")!;
  const bodyEl = main.querySelector<HTMLElement>(".admin-stats__body")!;
  let loaded: Loaded | null = null;

  const drawButtons = () => {
    periodsEl.innerHTML = PERIODS.map(
      (p) =>
        `<button type="button" class="admin-stats__period" data-period="${p}" aria-pressed="${p === period}">${p === 365 ? t("adminStats.top.year") : t("adminStats.lastDays", { count: p })}</button>`
    ).join("");
    modesEl.innerHTML = (["real", "all"] as const)
      .map((m) => `<button type="button" class="admin-stats__period" data-mode="${m}" aria-pressed="${m === mode}">${t(`adminStats.top.mode${m === "real" ? "Real" : "All"}`)}</button>`)
      .join("");
  };

  const draw = () => {
    if (!loaded) return;
    const open = [...bodyEl.querySelectorAll<HTMLDetailsElement>("details")].map((d) => d.open);
    bodyEl.innerHTML = renderStats(loaded);
    bodyEl.querySelectorAll<HTMLDetailsElement>("details").forEach((d, i) => (d.open = open[i] ?? false));
    exportEl.disabled = !loaded.overview;
    initVisitorsChart(bodyEl);
    initWaitingPanel(bodyEl);
    initSourcesPanel(bodyEl);
  };

  const load = async () => {
    drawButtons();
    const [stats, consent, behavior, real, overview] = await Promise.all([
      fetchVisitStats(period),
      fetchConsentStats(period),
      fetchBehaviorStats(period),
      fetchRealVisitorStats(period),
      fetchStatsOverview(period)
    ]);
    // Before 0024 the waiting list comes straight from the inquiries table.
    const waiting = overview ? overview.waiting : await fetchWaitingInquiries();
    if (main.dataset.requestId !== requestId) return;
    loaded = { stats, consent, behavior, real, overview, waiting, waitingTotal: overview ? overview.waiting_total : (waiting?.length ?? 0) };
    draw();
  };

  periodsEl.addEventListener("click", (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>("[data-period]");
    if (!button) return;
    period = Number(button.dataset.period) as (typeof PERIODS)[number];
    bodyEl.style.opacity = "0.5";
    void load().then(() => (bodyEl.style.opacity = ""));
  });

  modesEl.addEventListener("click", (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>("[data-mode]");
    if (!button) return;
    mode = button.dataset.mode as VisitMode;
    drawButtons();
    draw();
  });

  exportEl.addEventListener("click", () => {
    if (loaded?.overview) downloadCsv(loaded.overview, mode, sourceText);
  });

  void load();
}
