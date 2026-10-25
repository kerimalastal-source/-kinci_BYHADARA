import { t, link, getLocale, getProjectContent, intlTag, listSep } from "../../i18n";
import { escapeHtml } from "../../utils/html";
import { getProjectBySlug } from "../../data/projects";
import { inquiryKindKey } from "../../data/inquiries";
import type { DetailsRequest, FunnelCounts, OrganicDay, StatsDetails } from "../../data/adminStats";
import { ORGANIC_SOURCES, organicChart, visitorsChart, type ChartDay, type OrganicChartDay } from "./visitorsChart";
import type { VisitMode } from "./statsTop";

/**
 * The rest of the statistics page (owner's request 2026-10-18, phase 2), from
 * admin_stats_details() (supabase/migrations/0025): visitors per day with the previous
 * period as a dashed line and a table alternative, the visit journey, the audience by
 * region, project views against requests, and the latest requests. "real" or "all" visits,
 * as the switch at the top of the page says.
 */

const D = "adminStats.details";
const tag = () => intlTag();
const num = (n: number) => new Intl.NumberFormat(tag()).format(n);
const percent = (part: number, whole: number) =>
  whole ? `${new Intl.NumberFormat(tag(), { maximumFractionDigits: 1 }).format((part / whole) * 100)}%` : "—";

/** Date helpers the page already has (labels on the axis, the full date in the card). */
export interface DayFormat {
  date: (day: string) => string;
  axis: (day: string, i: number, n: number) => string;
  minor: (i: number, n: number) => boolean;
  short: (iso: string) => string;
}

const recordedBefore = (started: string | null, at: string) => !!started && Date.parse(started) <= Date.parse(at);

function panel(title: string, body: string, extra = ""): string {
  return `<section class="admin-panel admin-panel--wide${extra ? ` ${extra}` : ""}"><h2 class="admin-panel__title">${title}</h2>${body}</section>`;
}

/* ---------- Visitors per day ---------- */

export function chartPanel(d: StatsDetails, mode: VisitMode, fmt: DayFormat): string {
  const withPrev = recordedBefore(d.started.visits, d.prev_since);
  const days: ChartDay[] = d.daily.map((x) => ({
    day: x.day,
    visitors: mode === "real" ? x.real : x.all,
    pages: mode === "real" ? x.pages_real : x.pages_all,
    contacted: x.contacted,
    ...(withPrev ? { prev: mode === "real" ? x.prev_real : x.prev_all } : {})
  }));
  const total = days.reduce((s, x) => s + x.visitors, 0);
  const contacted = days.reduce((s, x) => s + x.contacted, 0);
  const best = days.reduce((b, x) => (x.visitors > b.visitors ? x : b), days[0]);
  const figure = (label: string, value: string, note = "") =>
    `<div class="vchart-figure"><p class="vchart-figure__label">${label}</p><p class="vchart-figure__value"><span dir="ltr">${value}</span></p>${note ? `<p class="vchart-figure__note">${note}</p>` : ""}</div>`;
  const chart = visitorsChart(days, {
    date: fmt.date,
    axis: fmt.axis,
    minor: fmt.minor,
    num,
    visitors: t("adminStats.real.tipVisitors"),
    pages: t("adminStats.real.tipPages"),
    contacted: t("adminStats.real.tipContacted"),
    previous: t(`${D}.chart.tipPrevious`),
    label: t("adminStats.real.chartLabel")
  });
  const table = `<div class="stats-table-scroll"><table class="admin-table">
      <thead><tr><th>${t(`${D}.chart.tableDate`)}</th><th>${t("adminStats.real.tipVisitors")}</th>${withPrev ? `<th>${t(`${D}.chart.tipPrevious`)}</th>` : ""}<th>${t("adminStats.real.tipPages")}</th><th>${t("adminStats.real.tipContacted")}</th></tr></thead>
      <tbody>${days
        .map(
          (x) =>
            `<tr><td>${escapeHtml(fmt.date(x.day))}</td><td dir="ltr">${num(x.visitors)}</td>${withPrev ? `<td dir="ltr">${num(x.prev ?? 0)}</td>` : ""}<td dir="ltr">${num(x.pages ?? 0)}</td><td dir="ltr">${num(x.contacted)}</td></tr>`
        )
        .join("")}</tbody>
    </table></div>`;
  const notes = [
    !withPrev && d.started.visits ? t(`${D}.chart.noPrevious`, { date: fmt.short(d.started.visits) }) : "",
    d.daily.some((x) => x.real > 0 && x.day < "2026-10-02") ? t("adminStats.real.early") : ""
  ].filter(Boolean);
  return panel(
    t("adminStats.real.title"),
    `<p class="admin-panel__hint">${mode === "real" ? t("adminStats.real.hint") : t(`${D}.chart.hintAll`)}</p>
    <div class="vchart-figures">
      ${figure(t("adminStats.real.visitors"), num(total))}
      ${figure(t("adminStats.real.average"), new Intl.NumberFormat(tag(), { maximumFractionDigits: 1 }).format(days.length ? total / days.length : 0))}
      ${figure(t("adminStats.real.best"), num(best?.visitors ?? 0), best?.visitors ? escapeHtml(fmt.date(best.day)) : "")}
      ${figure(t("adminStats.real.contacted"), num(contacted))}
    </div>
    <ul class="vchart-legend">
      <li><i class="vchart-legend__line"></i>${t(`${D}.chart.legendCurrent`)}</li>
      ${withPrev ? `<li><i class="vchart-legend__prev"></i>${t(`${D}.chart.legendPrevious`)}</li>` : ""}
      <li><i class="vchart-legend__mark"></i>${t(`${D}.chart.legendContacted`)}</li>
    </ul>
    ${chart}
    <button type="button" class="btn btn--outline btn--small stats-table-toggle" data-table-toggle aria-expanded="false">${t(`${D}.chart.tableShow`)}</button>
    <div class="stats-chart-table" hidden>${table}</div>
    ${notes.map((n) => `<p class="admin-panel__hint vchart-note">${n}</p>`).join("")}`
  );
}

/* ---------- Real visitors without paid ads (owner's request 2026-10-24, migration 0034) ---------- */

const O = "adminStats.organic";

export function organicPanel(daily: OrganicDay[] | null, fmt: DayFormat): string {
  if (!daily) return panel(t(`${O}.title`), `<p class="admin-stats__empty">${t(`${O}.unavailable`)}</p>`);
  const days: OrganicChartDay[] = daily.map((x) => ({
    day: x.day,
    counts: { search: x.search, direct: x.direct, posts: x.posts, social: x.social, referral: x.referral },
    contacted: x.contacted,
    paid: x.paid
  }));
  const one = (d: OrganicChartDay) => ORGANIC_SOURCES.reduce((s, k) => s + d.counts[k], 0);
  const total = days.reduce((s, d) => s + one(d), 0);
  const paid = days.reduce((s, d) => s + d.paid, 0);
  const contacted = days.reduce((s, d) => s + d.contacted, 0);
  const avg = (v: number) => new Intl.NumberFormat(tag(), { maximumFractionDigits: 1 }).format(v);
  const figure = (label: string, value: string) =>
    `<div class="vchart-figure"><p class="vchart-figure__label">${label}</p><p class="vchart-figure__value"><span dir="ltr">${value}</span></p></div>`;
  const used = ORGANIC_SOURCES.filter((k) => days.some((d) => d.counts[k]));
  const chart = organicChart(days, {
    date: fmt.date,
    axis: fmt.axis,
    minor: fmt.minor,
    num,
    avg,
    source: (k) => t(`${O}.sources.${k}`),
    total: t(`${O}.tipTotal`),
    average: t(`${O}.tipAverage`),
    contacted: t("adminStats.real.tipContacted"),
    paid: t(`${O}.tipPaid`),
    label: t(`${O}.title`)
  });
  return panel(
    t(`${O}.title`),
    `<p class="admin-panel__hint">${t(`${O}.hint`)}</p>
    <div class="vchart-figures">
      ${figure(t(`${O}.total`), num(total))}
      ${figure(t("adminStats.real.average"), avg(days.length ? total / days.length : 0))}
      ${figure(t(`${O}.share`), percent(total, total + paid))}
      ${figure(t("adminStats.real.contacted"), num(contacted))}
    </div>
    <ul class="vchart-legend">
      ${used.map((k) => `<li><i class="ochart-legend ochart__part--${k}"></i>${t(`${O}.sources.${k}`)}</li>`).join("")}
      <li><i class="ochart-legend__avg"></i>${t(`${O}.legendAverage`)}</li>
      <li><i class="vchart-legend__mark"></i>${t(`${O}.legendContacted`)}</li>
    </ul>
    ${total ? chart : `<p class="admin-stats__empty">${t(`${O}.empty`)}</p>`}
    <p class="admin-panel__hint vchart-note">${t(`${O}.note`)}</p>`
  );
}

/* ---------- The visit journey ---------- */

const STEPS: (keyof FunnelCounts)[] = ["visits", "project", "request_page", "sent"];

export function funnelPanel(d: StatsDetails, mode: VisitMode, fmt: DayFormat): string {
  const f = d.funnel[mode];
  const rows = STEPS.map((key, i) => {
    const value = f[key];
    const share = percent(value, f.visits);
    const ofPrev = i > 1 ? ` <small>(${percent(value, f[STEPS[i - 1]])} ${t(`${D}.funnel.ofPrev`)})</small>` : "";
    const width = f.visits ? Math.max(value ? 1.5 : 0, (value / f.visits) * 100) : 0;
    return `<li class="stats-funnel__step">
      <span class="stats-funnel__label">${t(`${D}.funnel.steps.${key}`)}</span>
      <span class="stats-funnel__track" aria-hidden="true"><span class="stats-funnel__bar" style="width:${width}%"></span></span>
      <span class="stats-funnel__value"><b dir="ltr">${num(value)}</b> <span dir="ltr">${share}</span>${ofPrev}</span>
    </li>`;
  }).join("");
  const late = !recordedBefore(d.started.actions, d.since) && d.started.actions;
  return panel(
    t(`${D}.funnel.title`),
    `<p class="admin-panel__hint">${t(`${D}.funnel.hint`)}</p>
    <ol class="stats-funnel">${rows}</ol>
    ${late ? `<p class="admin-panel__hint vchart-note">${t(`${D}.funnel.sentNote`, { date: fmt.short(d.started.actions!) })}</p>` : ""}`
  );
}

/* ---------- Audience ---------- */

/** Countries grouped the way the team thinks about its markets. */
const REGIONS: Record<string, string[]> = {
  gulf: ["SA", "AE", "QA", "KW", "BH", "OM"],
  mena: ["IQ", "JO", "LB", "SY", "PS", "IL", "EG", "YE", "LY", "TN", "DZ", "MA", "SD", "IR", "MR"],
  turkey: ["TR"],
  europe: [
    "AL", "AD", "AT", "BE", "BA", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IS", "IE", "IT", "XK", "LV",
    "LI", "LT", "LU", "MT", "MD", "MC", "ME", "NL", "MK", "NO", "PL", "PT", "RO", "SM", "RS", "SK", "SI", "ES", "SE", "CH", "UA", "GB", "VA"
  ],
  cis: ["RU", "BY", "KZ", "UZ", "KG", "TJ", "TM", "AZ", "GE", "AM"]
};
const REGION_KEYS = ["all", ...Object.keys(REGIONS), "other"] as const;

function regionOf(country: string): string {
  for (const [key, list] of Object.entries(REGIONS)) if (list.includes(country)) return key;
  return "other";
}

function countryName(code: string): string {
  if (!code) return t("adminStats.unknownCountry");
  try {
    return escapeHtml(new Intl.DisplayNames([getLocale()], { type: "region" }).of(code) ?? code);
  } catch {
    return escapeHtml(code);
  }
}

function bars(rows: { label: string; value: number; note?: string; region?: string }[], empty: string): string {
  if (!rows.length) return `<p class="admin-stats__empty">${empty}</p>`;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return `<ul class="bar-list">${rows
    .map(
      (r) => `<li${r.region ? ` data-region="${r.region}"` : ""}>
        <span class="bar-list__label">${r.label}</span>
        <span class="bar-list__track" aria-hidden="true"><span class="bar-list__bar" style="width:${Math.max(2, (r.value / max) * 100)}%"></span></span>
        <span class="bar-list__value">${num(r.value)}${r.note ? ` <small>${r.note}</small>` : ""}</span>
      </li>`
    )
    .join("")}</ul>`;
}

export function audiencePanel(d: StatsDetails, mode: VisitMode): string {
  const countries = d.countries.map((c) => ({ ...c, value: c[mode], region: regionOf(c.country) })).filter((c) => c.value > 0);
  const total = countries.reduce((s, c) => s + c.value, 0);
  const byRegion = (key: string) => countries.filter((c) => key === "all" || c.region === key).reduce((s, c) => s + c.value, 0);
  const chips = REGION_KEYS.filter((key) => key === "all" || byRegion(key) > 0)
    .map(
      (key) =>
        `<button type="button" class="stats-chip" data-region-filter="${key}" aria-pressed="${key === "all"}">${t(`${D}.audience.regions.${key}`)} <span dir="ltr">${num(byRegion(key))}</span></button>`
    )
    .join("");
  const countryList = bars(
    countries.map((c) => ({ label: countryName(c.country), value: c.value, note: percent(c.value, total), region: c.region })),
    t("adminStats.empty")
  );
  const devTotal = d.devices.reduce((s, x) => s + x[mode], 0);
  const devices = bars(
    d.devices
      .filter((x) => x[mode] > 0)
      .map((x) => {
        const key = `adminStats.behavior.devices.${x.device}`;
        const label = t(key);
        return { label: label === key ? escapeHtml(x.device) : label, value: x[mode], note: percent(x[mode], devTotal) };
      }),
    t("adminStats.empty")
  );
  const locTotal = d.locales.reduce((s, x) => s + x[mode], 0);
  const locales = bars(
    d.locales.filter((x) => x[mode] > 0).map((x) => ({ label: t(`lang.${x.locale}`), value: x[mode], note: percent(x[mode], locTotal) })),
    t("adminStats.empty")
  );
  return panel(
    t(`${D}.audience.title`),
    `<div class="stats-audience">
      <div class="stats-audience__col stats-audience__col--wide">
        <h3 class="admin-panel__subtitle">${t(`${D}.audience.countries`)}</h3>
        <div class="stats-chips" role="group" aria-label="${t(`${D}.audience.countries`)}">${chips}</div>
        <div class="stats-audience__countries">${countryList}</div>
      </div>
      <div class="stats-audience__col"><h3 class="admin-panel__subtitle">${t(`${D}.audience.devices`)}</h3>${devices}</div>
      <div class="stats-audience__col"><h3 class="admin-panel__subtitle">${t(`${D}.audience.languages`)}</h3>${locales}</div>
    </div>`
  );
}

/* ---------- Projects: views against requests ---------- */

const PROJECTS_SHOWN = 10;

export function projectsPanel(d: StatsDetails, mode: VisitMode): string {
  const rows = d.projects
    .filter((p) => getProjectBySlug(p.slug))
    .map((p) => ({ slug: p.slug, views: mode === "real" ? p.views_real : p.views_all, visitors: mode === "real" ? p.visitors_real : p.visitors_all, requests: p.requests }))
    .filter((p) => p.views || p.requests)
    .sort((a, b) => b.requests - a.requests || b.views - a.views);
  const P = `${D}.projects`;
  const body = rows.length
    ? `<div class="stats-table-scroll"><table class="admin-table stats-projects">
        <thead><tr><th>${t(`${P}.project`)}</th><th>${t(`${P}.views`)}</th><th>${t(`${P}.visitors`)}</th><th>${t(`${P}.requests`)}</th></tr></thead>
        <tbody>${rows
          .map(
            (r, i) => `<tr${r.requests ? ` class="stats-sources__hit"` : ""}${i >= PROJECTS_SHOWN && !r.requests ? " hidden" : ""}>
              <td>${escapeHtml(getProjectContent(r.slug).name)}${r.requests ? ` <span class="admin-tag admin-tag--confirmed">${t(`${P}.requested`)}</span>` : ""}</td>
              <td dir="ltr">${num(r.views)}</td><td dir="ltr">${num(r.visitors)}</td><td dir="ltr">${num(r.requests)}</td>
            </tr>`
          )
          .join("")}</tbody>
      </table></div>
      ${rows.some((r, i) => i >= PROJECTS_SHOWN && !r.requests) ? `<button type="button" class="btn btn--outline btn--small stats-sources__more" data-rows-more aria-expanded="false" data-more="${escapeHtml(t(`${P}.more`, { count: num(rows.length) }))}" data-less="${escapeHtml(t(`${P}.less`))}">${t(`${P}.more`, { count: num(rows.length) })}</button>` : ""}`
    : `<p class="admin-stats__empty">${t(`${P}.empty`)}</p>`;
  return panel(t(`${P}.title`), `<p class="admin-panel__hint">${t(`${P}.hint`)}</p>${body}`, "stats-projects-panel");
}

/* ---------- Latest requests ---------- */

/** "18/10 14:20", Istanbul time, built by hand: Intl's Arabic date carries marks that scramble it in an LTR cell. */
function when(iso: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Istanbul" })
      .formatToParts(Date.parse(iso))
      .map((p) => [p.type, p.value])
  );
  return `${parts.day}/${parts.month} ${parts.hour}:${parts.minute}`;
}

export function recentPanel(d: StatsDetails, sourceLabel: (s: string) => string): string {
  const R = `${D}.recent`;
  const type = (r: DetailsRequest) => (r.type === "booking" ? t(`${R}.booking`) : t(`adminInquiries.kinds.${inquiryKindKey({ kind: r.kind, details: { form: r.form } })}`));
  const status = (r: DetailsRequest) => {
    const key = r.type === "booking" ? `adminBookings.status.${r.status}` : `adminInquiries.status.${r.status}`;
    const text = t(key);
    return text === key ? escapeHtml(r.status) : text;
  };
  const projects = (slugs: string[]) =>
    slugs.length ? escapeHtml(slugs.map((s) => (getProjectBySlug(s) ? getProjectContent(s).name : s)).join(listSep())) : "—";
  const open = (r: DetailsRequest) =>
    r.type === "booking" ? link("/admin/bookings") : link(`/admin/inquiries?q=${encodeURIComponent(r.reference)}`);
  const body = d.recent.length
    ? `<div class="stats-table-scroll"><table class="admin-table">
        <thead><tr><th>${t(`${R}.date`)}</th><th>${t(`${R}.name`)}</th><th>${t(`${R}.type`)}</th><th>${t(`${R}.projects`)}</th><th>${t(`${R}.source`)}</th><th>${t(`${R}.status`)}</th></tr></thead>
        <tbody>${d.recent
          .map(
            (r) => `<tr>
              <td dir="ltr">${escapeHtml(when(r.created_at))}</td>
              <td><a href="${open(r)}" dir="auto">${escapeHtml(r.name)}</a></td>
              <td>${type(r)}</td>
              <td>${projects(r.projects)}</td>
              <td>${sourceLabel(r.source)}${r.campaign ? ` · <span dir="ltr">${escapeHtml(r.campaign)}</span>` : ""}</td>
              <td><span class="admin-tag">${status(r)}</span></td>
            </tr>`
          )
          .join("")}</tbody>
      </table></div>`
    : `<p class="admin-stats__empty">${t(`${R}.empty`)}</p>`;
  return panel(
    t(`${R}.title`),
    `<p class="admin-panel__hint">${t(`${R}.hint`)}</p>${body}
    <p class="stats-recent__links"><a class="admin-panel__more" href="${link("/admin/inquiries")}">${t(`${R}.openInquiries`)}</a> <a class="admin-panel__more" href="${link("/admin/bookings")}">${t(`${R}.openBookings`)}</a></p>`
  );
}

/** Region chips, the table switch under the chart, and "show all" on the projects table. */
export function initDetails(root: HTMLElement): void {
  root.querySelectorAll<HTMLButtonElement>("[data-region-filter]").forEach((chip) =>
    chip.addEventListener("click", () => {
      const key = chip.dataset.regionFilter!;
      root.querySelectorAll<HTMLButtonElement>("[data-region-filter]").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      root.querySelectorAll<HTMLElement>(".stats-audience__countries [data-region]").forEach((li) => (li.hidden = key !== "all" && li.dataset.region !== key));
    })
  );
  root.querySelector<HTMLButtonElement>("[data-table-toggle]")?.addEventListener("click", (e) => {
    const button = e.currentTarget as HTMLButtonElement;
    const box = root.querySelector<HTMLElement>(".stats-chart-table")!;
    box.hidden = !box.hidden;
    button.setAttribute("aria-expanded", String(!box.hidden));
    button.textContent = t(box.hidden ? `${D}.chart.tableShow` : `${D}.chart.tableHide`);
  });
  root.querySelector<HTMLButtonElement>("[data-rows-more]")?.addEventListener("click", (e) => {
    const button = e.currentTarget as HTMLButtonElement;
    const open = button.getAttribute("aria-expanded") !== "true";
    root.querySelectorAll<HTMLElement>(".stats-projects tbody tr").forEach((tr, i) => {
      if (!tr.classList.contains("stats-sources__hit")) tr.hidden = !open && i >= PROJECTS_SHOWN;
    });
    button.setAttribute("aria-expanded", String(open));
    button.textContent = open ? button.dataset.less! : button.dataset.more!;
  });
}
