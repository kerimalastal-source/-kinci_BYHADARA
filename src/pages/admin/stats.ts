import { t, getLocale, getProjectContent, intlTag } from "../../i18n";
import { requireAdmin } from "../../auth/session";
import { escapeHtml } from "../../utils/html";
import { getProjectBySlug } from "../../data/projects";
import {
  fetchBehaviorStats,
  fetchConsentStats,
  fetchRealVisitorStats,
  fetchVisitStats,
  type BehaviorStats,
  type ConsentStats,
  type RealVisitorStats,
  type VisitStats
} from "../../data/adminStats";
import { adminHero, adminNav } from "./nav";

/**
 * Visitor statistics (/admin/stats), from the anonymous visit records (kept a year since
 * migration 0015; admin_visit_stats(), supabase/migrations/0008 and 0017): visitors per day,
 * where they came from (ads, search, direct), countries, the projects they looked at, and the
 * messages and tour bookings each source brought. "What visitors do" (admin_behavior_stats(),
 * 0016): devices, button presses, interest per project, and forms started vs sent. "Real visitors
 * per day" (admin_real_visitor_stats(), 0020): the same days without automated visits.
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

/**
 * Real visitors per day as a line, all visits before filtering as a dashed line behind it,
 * and the visits that got in touch as numbers under the axis. The line above the chart reads
 * out the day under the pointer or focus (the busiest day at first); it stays inside the
 * panel on a phone, where a tooltip over a narrow column would not.
 */
export function realChart(daily: RealVisitorStats["daily"]): string {
  const rows = daily.map((d) => ({ ...d, real: Math.max(0, d.total - d.automated) }));
  const n = rows.length;
  const max = Math.max(...rows.map((d) => d.total), 1);
  const x = (i: number) => (((i + 0.5) / n) * 1000).toFixed(1);
  const y = (v: number) => (200 - (v / max) * 200).toFixed(1);
  const line = (key: "real" | "total") => rows.map((d, i) => `${x(i)},${y(d[key])}`).join(" ");
  const peak = rows.reduce((best, d, i) => (d.real > rows[best].real ? i : best), 0);
  const height = (v: number) => `${((v / max) * 100).toFixed(2)}%`;
  const tips = rows.map((d) => {
    const full = dayLabel(d.day, { weekday: "long", day: "numeric", month: "long" });
    return `${full}: ${t("adminStats.real.tip", { real: num(d.real), automated: num(d.automated), contacted: num(d.contacted) })}`;
  });
  const cols = rows
    .map((d, i) => {
      const tip = escapeHtml(tips[i]);
      const showValue = d.real > 0 && (i === peak || i === n - 1);
      return `<div class="real-chart__col${i === peak ? " is-active" : ""}" tabindex="0" role="img" aria-label="${tip}" data-tip="${tip}">
        <span class="real-chart__guide" aria-hidden="true"></span>
        <span class="real-chart__dot" style="bottom:${height(d.real)}" aria-hidden="true"></span>
        ${showValue ? `<span class="real-chart__value" style="bottom:${height(d.real)}" aria-hidden="true">${num(d.real)}</span>` : ""}
      </div>`;
    })
    .join("");
  // Every other date label hides on a phone, where they would run into each other.
  const every = n > 31 ? 7 : 3;
  const minor = (i: number) => n > 10 && ((n - 1 - i) / every) % 2 === 1;
  const labels = rows
    .map((d, i) => `<span class="day-chart__label${minor(i) ? " real-chart__label--minor" : ""}">${axisLabel(d.day, i, n)}</span>`)
    .join("");
  const contacts = rows.map((d) => `<span>${d.contacted ? `<b>${num(d.contacted)}</b>` : ""}</span>`).join("");
  return `<div class="real-chart${n > 31 ? " real-chart--long" : ""}" dir="ltr">
    <p class="real-chart__readout" dir="auto" aria-hidden="true">${escapeHtml(tips[peak])}</p>
    <span class="real-chart__max" aria-hidden="true">${num(max)}</span>
    <div class="real-chart__plot">
      <svg class="real-chart__svg" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <polygon class="real-chart__area" points="${x(0)},200 ${line("real")} ${x(n - 1)},200"/>
        <polyline class="real-chart__total" points="${line("total")}" vector-effect="non-scaling-stroke"/>
        <polyline class="real-chart__line" points="${line("real")}" vector-effect="non-scaling-stroke"/>
      </svg>
      <div class="real-chart__cols">${cols}</div>
    </div>
    <div class="real-chart__row">${labels}</div>
    ${rows.some((d) => d.contacted) ? `<div class="real-chart__row real-chart__contacts" aria-hidden="true">${contacts}</div>` : ""}
  </div>`;
}

/** The real-visitors panel: the period's totals, the legend and the chart. */
function realPanel(r: RealVisitorStats | null): string {
  const title = t("adminStats.real.title");
  if (!r) return panel(title, `<p class="admin-stats__empty">${t("adminStats.real.unavailable")}</p>`, true);
  const total = r.daily.reduce((s, d) => s + d.total, 0);
  const automated = r.daily.reduce((s, d) => s + d.automated, 0);
  const contacted = r.daily.reduce((s, d) => s + d.contacted, 0);
  const early = r.daily.some((d) => d.total > 0 && d.day < "2026-10-02") ? `<p class="admin-panel__hint real-chart__note">${t("adminStats.real.early")}</p>` : "";
  const figure = (value: string, text: string) => `<p class="real-chart__figure"><b dir="ltr">${value}</b> ${text}</p>`;
  return panel(
    title,
    `<p class="admin-panel__hint">${t("adminStats.real.hint")}</p>
    <div class="real-chart__totals">
      ${figure(num(total - automated), t("adminStats.real.real"))}
      ${figure(num(automated), `${t("adminStats.real.automated")} <span dir="ltr">(${pct(automated, total)})</span>`)}
      ${figure(num(contacted), t("adminStats.real.contacted"))}
    </div>
    <ul class="real-chart__legend">
      <li><i class="real-chart__swatch"></i>${t("adminStats.real.legendReal")}</li>
      <li><i class="real-chart__swatch real-chart__swatch--total"></i>${t("adminStats.real.legendAll")}</li>
      <li><i class="real-chart__swatch real-chart__swatch--contact"></i>${t("adminStats.real.legendContact")}</li>
    </ul>
    ${realChart(r.daily)}
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

function renderStats(s: VisitStats, consent: ConsentStats | null, behavior: BehaviorStats | null, real: RealVisitorStats | null): string {
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
    ${realPanel(real)}
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
    const [stats, consent, behavior, real] = await Promise.all([
      fetchVisitStats(period),
      fetchConsentStats(period),
      fetchBehaviorStats(period),
      fetchRealVisitorStats(period)
    ]);
    if (main.dataset.requestId !== requestId) return;
    bodyEl.innerHTML = stats ? renderStats(stats, consent, behavior, real) : `<p class="admin-bookings__empty">${t("adminStats.unavailable")}</p>`;
  };

  // The real-visitors chart reads out the day under the pointer or focus.
  const showDay = (e: Event) => {
    const col = (e.target as Element).closest<HTMLElement>(".real-chart__col");
    const chart = col?.closest(".real-chart");
    if (!col || !chart) return;
    chart.querySelector(".real-chart__col.is-active")?.classList.remove("is-active");
    col.classList.add("is-active");
    chart.querySelector(".real-chart__readout")!.textContent = col.dataset.tip ?? "";
  };
  bodyEl.addEventListener("pointerover", showDay);
  bodyEl.addEventListener("focusin", showDay);

  periodsEl.addEventListener("click", (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>("[data-period]");
    if (!button) return;
    period = Number(button.dataset.period) as (typeof PERIODS)[number];
    bodyEl.style.opacity = "0.5";
    void load().then(() => (bodyEl.style.opacity = ""));
  });

  void load();
}
