import { t, link, getProjectContent, intlTag, listSep } from "../../i18n";
import { escapeHtml } from "../../utils/html";
import { getProjectBySlug } from "../../data/projects";
import { inquiryKindKey, updateInquiry } from "../../data/inquiries";
import type { OverviewPeriod, OverviewSource, StatsOverview, WaitingInquiry } from "../../data/adminStats";

/**
 * The top of the statistics page (owner's request 2026-10-18, phase 1), from
 * admin_stats_overview() (supabase/migrations/0024): four cards against the previous period
 * of the same length, the inquiries awaiting a reply, the source x campaign table, and the
 * CSV export. "real" counts real visitors only (the morning report's classifier), "all"
 * every visit; requests never include the owner's test requests.
 */

export type VisitMode = "real" | "all";

const tag = () => intlTag();
const num = (n: number) => new Intl.NumberFormat(tag()).format(n);
/** Keeps a number with its sign and % together inside Arabic or Persian text. */
const iso = (text: string) => `⁦${text}⁩`;
const percent = (rate: number) => `${new Intl.NumberFormat(tag(), { maximumFractionDigits: 1 }).format(rate * 100)}%`;
const DAY_MS = 86_400_000;

const leads = (p: OverviewPeriod) => p.inquiries + p.bookings;
const rate = (p: OverviewPeriod, mode: VisitMode) => (p[mode].visitors ? leads(p) / p[mode].visitors : 0);

export function shortDate(isoDate: string): string {
  return new Intl.DateTimeFormat(tag(), { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" }).format(Date.parse(isoDate));
}

/** A comparison is fair only when recording had started before the previous period began. */
function recordedBefore(started: string | null, prevSince: string): boolean {
  return !!started && Date.parse(started) <= Date.parse(prevSince);
}

/** "▲ +18% vs. previous period" (green up, red down, a word for screen readers), or why there is none. */
function delta(kind: "pct" | "count" | "points", current: number, previous: number, started: string | null, o: StatsOverview): string {
  if (!recordedBefore(started, o.prev_since)) {
    return `<p class="stats-card__delta stats-card__delta--none">${t("adminStats.top.delta.noCompare", { date: shortDate(started ?? o.since) })}</p>`;
  }
  const diff = current - previous;
  if (Math.abs(diff) < 1e-9) return `<p class="stats-card__delta stats-card__delta--none">${t("adminStats.top.delta.same")}</p>`;
  const sign = diff > 0 ? "+" : "−";
  // Only the signed number is isolated, so the unit word stays in the sentence's direction.
  let value: string;
  if (kind === "points") value = `${iso(`${sign}${new Intl.NumberFormat(tag(), { maximumFractionDigits: 1 }).format(Math.abs(diff) * 100)}`)} ${t("adminStats.top.delta.points")}`;
  else if (kind === "pct" && previous > 0) value = iso(`${sign}${percent(Math.abs(diff) / previous)}`);
  else value = `${iso(`${sign}${num(Math.abs(diff))}`)}${kind === "count" ? ` ${t("adminStats.top.delta.requests")}` : ""}`;
  const up = diff > 0;
  return `<p class="stats-card__delta stats-card__delta--${up ? "up" : "down"}">
    <span aria-hidden="true">${up ? "▲" : "▼"}</span>
    <span class="visually-hidden">${t(`adminStats.top.delta.${up ? "up" : "down"}`)}:</span>
    ${value} ${t("adminStats.top.delta.vsPrev")}
  </p>`;
}

function card(label: string, value: string, deltaHtml: string, note = ""): string {
  return `<div class="stats-card">
    <p class="stats-card__label">${label}</p>
    <p class="stats-card__value" dir="ltr">${value}</p>
    ${deltaHtml}
    ${note ? `<p class="stats-card__note">${note}</p>` : ""}
  </div>`;
}

/** The excluded line under the toolbar: automated visits and test requests left out. */
export function excludedLine(o: StatsOverview | null, mode: VisitMode): string {
  if (!o) return "";
  const parts = [t(`adminStats.top.excluded${mode === "real" ? "Real" : "All"}`, { automated: num(o.automated), tests: num(o.tests) })];
  if (o.started.visits && Date.parse(o.started.visits) > Date.parse(o.since)) parts.push(t("adminStats.top.recordedFrom", { date: shortDate(o.started.visits) }));
  return parts.map((p) => `<span>${p}</span>`).join(" ");
}

/** The four cards: visitors, requests, conversion, WhatsApp/call presses. */
export function statsCards(o: StatsOverview | null, mode: VisitMode): string {
  if (!o) return `<p class="admin-stats__empty stats-unavailable">${t("adminStats.top.unavailable")}</p>`;
  const c = o.current;
  const p = o.previous;
  const leadsStarted = o.started.leads && o.started.visits ? (Date.parse(o.started.leads) > Date.parse(o.started.visits) ? o.started.leads : o.started.visits) : null;
  return `<div class="stats-cards">
    ${card(t(`adminStats.top.cards.visitors${mode === "real" ? "Real" : "All"}`), num(c[mode].visitors), delta("pct", c[mode].visitors, p[mode].visitors, o.started.visits, o))}
    ${card(
      t("adminStats.top.cards.leads"),
      num(leads(c)),
      delta("count", leads(c), leads(p), o.started.leads, o),
      t("adminStats.top.cards.leadsNote", { inquiries: num(c.inquiries), bookings: num(c.bookings) })
    )}
    ${card(t("adminStats.top.cards.conversion"), c[mode].visitors ? percent(rate(c, mode)) : "—", delta("points", rate(c, mode), rate(p, mode), leadsStarted, o))}
    ${card(t("adminStats.top.cards.clicks"), num(c[mode].clicks), delta("pct", c[mode].clicks, p[mode].clicks, o.started.actions, o))}
  </div>`;
}

/* ---------- Awaiting your reply ---------- */

const WAITING_SHOWN = 6;

function waitedFor(isoDate: string): string {
  const rtf = new Intl.RelativeTimeFormat(tag(), { numeric: "auto" });
  const minutes = Math.round((Date.now() - Date.parse(isoDate)) / 60_000);
  if (minutes < 60) return rtf.format(-Math.max(1, minutes), "minute");
  const hours = Math.round(minutes / 60);
  return hours < 48 ? rtf.format(-hours, "hour") : rtf.format(-Math.round(hours / 24), "day");
}

const projectNames = (slugs: string[]) =>
  slugs.map((slug) => (getProjectBySlug(slug) ? getProjectContent(slug).name : slug)).join(listSep());

function waitingRow(w: WaitingInquiry, hidden: boolean): string {
  const late = Date.now() - Date.parse(w.created_at) > DAY_MS;
  const kind = t(`adminInquiries.kinds.${inquiryKindKey({ kind: w.kind, details: { form: w.form } })}`);
  const projects = w.projects.length ? ` · ${escapeHtml(projectNames(w.projects))}` : "";
  return `<li class="stats-waiting__item"${hidden ? " hidden" : ""} data-waiting="${escapeHtml(w.id)}">
    <span class="stats-waiting__who">
      <strong dir="auto">${escapeHtml(w.name)}</strong>
      <small>${kind}${projects} · <span dir="ltr">${escapeHtml(w.reference)}</span></small>
    </span>
    <span class="stats-waiting__acts">
      ${late ? `<span class="admin-tag admin-tag--late">${t("adminStats.top.waiting.late")}</span>` : ""}
      <span class="stats-waiting__age">${escapeHtml(waitedFor(w.created_at))}</span>
      <a class="btn btn--outline btn--small" href="${link(`/admin/inquiries?q=${encodeURIComponent(w.reference)}`)}">${t("adminStats.top.waiting.open")}</a>
      <button type="button" class="btn btn--primary btn--small" data-contacted="${escapeHtml(w.id)}">${t("adminStats.top.waiting.done")}</button>
    </span>
  </li>`;
}

/** Every inquiry still marked "new", oldest first; "Contacted" saves the same status the inquiries box does. */
export function waitingPanel(items: WaitingInquiry[] | null, total: number, fallback: boolean): string {
  const title = `<h2 class="admin-panel__title">${t("adminStats.top.waiting.title")}${items?.length ? ` <span class="admin-tag" data-waiting-count dir="ltr">${num(total)}</span>` : ""}</h2>`;
  if (!items) return `<section class="admin-panel admin-panel--wide stats-waiting">${title}<p class="admin-stats__empty">${t("adminStats.top.waiting.unavailable")}</p></section>`;
  const body = items.length
    ? `<ul class="stats-waiting__list">${items.map((w, i) => waitingRow(w, i >= WAITING_SHOWN)).join("")}</ul>
       <div class="stats-waiting__more">
         ${items.length > WAITING_SHOWN ? `<button type="button" class="btn btn--outline btn--small" data-waiting-more aria-expanded="false">${t("adminStats.top.waiting.more", { count: num(items.length) })}</button>` : ""}
         ${total > items.length ? `<a class="admin-panel__more" href="${link("/admin/inquiries")}">${t("adminStats.top.waiting.inBox", { count: num(total) })}</a>` : ""}
       </div>`
    : `<p class="admin-stats__empty">${t("adminStats.top.waiting.empty")}</p>`;
  return `<section class="admin-panel admin-panel--wide stats-waiting">
    ${title}
    <p class="admin-panel__hint">${t("adminStats.top.waiting.hint")}${fallback ? ` ${t("adminStats.top.waiting.fallback")}` : ""}</p>
    <p class="stats-waiting__status" role="status" aria-live="polite"></p>
    ${body}
  </section>`;
}

export function initWaitingPanel(root: HTMLElement): void {
  const panel = root.querySelector<HTMLElement>(".stats-waiting");
  if (!panel) return;
  const status = panel.querySelector<HTMLElement>(".stats-waiting__status");
  panel.addEventListener("click", async (e) => {
    const target = e.target as Element;
    const more = target.closest<HTMLButtonElement>("[data-waiting-more]");
    if (more) {
      const open = more.getAttribute("aria-expanded") !== "true";
      panel.querySelectorAll<HTMLElement>(".stats-waiting__item").forEach((li, i) => (li.hidden = !open && i >= WAITING_SHOWN));
      more.setAttribute("aria-expanded", String(open));
      const count = panel.querySelectorAll(".stats-waiting__item").length;
      more.textContent = open ? t("adminStats.top.waiting.less") : t("adminStats.top.waiting.more", { count: num(count) });
      return;
    }
    const button = target.closest<HTMLButtonElement>("[data-contacted]");
    if (!button || button.disabled) return;
    button.disabled = true;
    button.textContent = t("adminStats.top.waiting.saving");
    const saved = await updateInquiry(button.dataset.contacted!, { status: "contacted" });
    if (!saved) {
      button.disabled = false;
      button.textContent = t("adminStats.top.waiting.done");
      if (status) status.textContent = t("adminStats.top.waiting.error");
      return;
    }
    if (status) status.textContent = "";
    button.closest("li")?.remove();
    const counter = panel.querySelector<HTMLElement>("[data-waiting-count]");
    if (counter) {
      const left = Math.max(0, Number(counter.dataset.left ?? counter.textContent?.replace(/\D/g, "")) - 1);
      counter.dataset.left = String(left);
      counter.textContent = num(left);
    }
    // Bring the next hidden one into view so the list keeps its length.
    const showing = panel.querySelector("[data-waiting-more]")?.getAttribute("aria-expanded") === "true";
    if (!showing) panel.querySelectorAll<HTMLElement>(".stats-waiting__item").forEach((li, i) => (li.hidden = i >= WAITING_SHOWN));
    if (!panel.querySelector(".stats-waiting__item")) {
      panel.querySelector(".stats-waiting__list")?.replaceWith(Object.assign(document.createElement("p"), { className: "admin-stats__empty", textContent: t("adminStats.top.waiting.empty") }));
    }
  });
}

/* ---------- Sources and campaigns ---------- */

const SOURCES_SHOWN = 10;

function sourceRows(o: StatsOverview, mode: VisitMode): (OverviewSource & { visits: number; clicks: number })[] {
  return o.sources
    .map((s) => ({ ...s, visits: mode === "real" ? s.real_visits : s.all_visits, clicks: mode === "real" ? s.real_clicks : s.all_clicks }))
    .filter((s) => s.visits || s.leads || s.clicks)
    .sort((a, b) => b.leads - a.leads || b.visits - a.visits || b.clicks - a.clicks);
}

/** Source x campaign: visits, requests, WhatsApp/call presses and conversion; rows with requests are marked. */
export function sourcesPanel(o: StatsOverview | null, mode: VisitMode, sourceLabel: (s: string) => string, details: string): string {
  const head = `<h2 class="admin-panel__title">${t("adminStats.top.sources.title")}</h2>`;
  const fold = `<details class="stats-fold stats-fold--inner"><summary>${t("adminStats.top.sources.details")}</summary><div class="stats-fold__body">${details}</div></details>`;
  if (!o) return `<section class="admin-panel admin-panel--wide">${head}<p class="admin-stats__empty stats-unavailable">${t("adminStats.top.unavailable")}</p>${fold}</section>`;
  const rows = sourceRows(o, mode);
  const s = "adminStats.top.sources";
  const table = rows.length
    ? `<div class="stats-table-scroll"><table class="admin-table stats-sources">
        <thead><tr><th>${t(`${s}.source`)}</th><th>${t(`${s}.campaign`)}</th><th>${t(`${s}.visits`)}</th><th>${t(`${s}.leads`)}</th><th>${t(`${s}.clicks`)}</th><th>${t(`${s}.rate`)}</th></tr></thead>
        <tbody>${rows
          .map(
            (r, i) => `<tr${r.leads ? ` class="stats-sources__hit"` : ""}${i >= SOURCES_SHOWN ? " hidden" : ""}>
              <td>${sourceLabel(r.source)}</td>
              <td>${r.campaign ? `<span dir="ltr">${escapeHtml(r.campaign)}</span>` : "—"}</td>
              <td dir="ltr">${num(r.visits)}</td><td dir="ltr">${num(r.leads)}</td><td dir="ltr">${num(r.clicks)}</td>
              <td dir="ltr">${r.visits ? percent(r.leads / r.visits) : "—"}</td>
            </tr>`
          )
          .join("")}</tbody>
      </table></div>
      ${rows.length > SOURCES_SHOWN ? `<button type="button" class="btn btn--outline btn--small stats-sources__more" data-sources-more aria-expanded="false">${t(`${s}.more`, { count: num(rows.length) })}</button>` : ""}`
    : `<p class="admin-stats__empty">${t(`${s}.empty`)}</p>`;
  return `<section class="admin-panel admin-panel--wide stats-sources-panel">${head}<p class="admin-panel__hint">${t(`${s}.hint`)}</p>${table}${fold}</section>`;
}

export function initSourcesPanel(root: HTMLElement): void {
  root.querySelector<HTMLButtonElement>("[data-sources-more]")?.addEventListener("click", (e) => {
    const button = e.currentTarget as HTMLButtonElement;
    const open = button.getAttribute("aria-expanded") !== "true";
    const rows = root.querySelectorAll<HTMLElement>(".stats-sources tbody tr");
    rows.forEach((tr, i) => (tr.hidden = !open && i >= SOURCES_SHOWN));
    button.setAttribute("aria-expanded", String(open));
    button.textContent = open ? t("adminStats.top.sources.less") : t("adminStats.top.sources.more", { count: num(rows.length) });
  });
}

/* ---------- CSV export ---------- */

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The cards (this period and the previous one) and the sources table, as a CSV file. */
export function downloadCsv(o: StatsOverview, mode: VisitMode, sourceText: (s: string) => string): void {
  const s = "adminStats.top";
  const day = (d: string) => new Date(Date.parse(d)).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  const prevEnd = new Date(Date.parse(o.since) - 1).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  const fixed = (n: number) => (n * 100).toFixed(1);
  const lines: (string | number)[][] = [
    [t(`${s}.csv.period`), `${day(o.since)} – ${today}`, `${day(o.prev_since)} – ${prevEnd}`],
    [t(`${s}.csv.mode`), t(`${s}.mode${mode === "real" ? "Real" : "All"}`)],
    [],
    [t(`${s}.csv.metric`), t(`${s}.csv.current`), t(`${s}.csv.previous`)],
    [t(`${s}.cards.visitors${mode === "real" ? "Real" : "All"}`), o.current[mode].visitors, o.previous[mode].visitors],
    [t(`${s}.cards.leads`), leads(o.current), leads(o.previous)],
    [`${t(`${s}.cards.conversion`)} (%)`, fixed(rate(o.current, mode)), fixed(rate(o.previous, mode))],
    [t(`${s}.cards.clicks`), o.current[mode].clicks, o.previous[mode].clicks],
    [],
    [t(`${s}.sources.source`), t(`${s}.sources.campaign`), t(`${s}.sources.visits`), t(`${s}.sources.leads`), t(`${s}.sources.clicks`), `${t(`${s}.sources.rate`)} (%)`],
    ...sourceRows(o, mode).map((r) => [sourceText(r.source), r.campaign, r.visits, r.leads, r.clicks, r.visits ? fixed(r.leads / r.visits) : ""])
  ];
  const csv = "﻿" + lines.map((l) => l.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `hadara-stats-${day(o.since)}-${today}.csv` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
