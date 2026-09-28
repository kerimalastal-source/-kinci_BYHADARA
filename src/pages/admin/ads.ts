import { t, intlTag } from "../../i18n";
import { requireAdmin } from "../../auth/session";
import { escapeHtml } from "../../utils/html";
import { toWesternDigits } from "../../utils/numbers";
import { CURRENCIES, type Currency } from "../../data/crm";
import { addAdSpend, deleteAdSpend, fetchAdReport, fetchAdSpend, type AdReport, type AdSpend } from "../../data/ads";
import { adminHero, adminNav } from "./nav";
import { sourceLabel } from "./stats";
import { money } from "./crmForm";

/**
 * Ad results (/admin/ads): what each ad source / campaign cost and brought — visitors,
 * messages and bookings, won sales — so cost per lead and per sale are known
 * (admin_ad_report(), supabase/migrations/0010). The team types in what they spent;
 * the site already knows the rest from the utm_source / utm_campaign of the ad links.
 */

const SOURCES = ["instagram", "facebook", "google-ads", "tiktok", "youtube", "snapchat"] as const;
const PERIODS = ["thisMonth", "lastMonth", "last30", "last90"] as const;
type Period = (typeof PERIODS)[number];
let period: Period = "thisMonth";

const tag = () => intlTag();
const num = (n: number) => new Intl.NumberFormat(tag()).format(n);
const istanbulToday = () => new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const dayLabel = (day: string) => new Intl.DateTimeFormat(tag(), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(Date.parse(`${day}T12:00:00Z`));

function range(p: Period): [string, string] {
  const today = istanbulToday();
  const monthStart = `${today.slice(0, 7)}-01`;
  if (p === "thisMonth") return [monthStart, today];
  if (p === "lastMonth") {
    const lastDay = addDays(monthStart, -1);
    return [`${lastDay.slice(0, 7)}-01`, lastDay];
  }
  return [addDays(today, p === "last30" ? -29 : -89), today];
}

interface Row {
  source: string;
  /** null: the whole source (spend was entered for all its campaigns). */
  campaign: string | null;
  visitors: number;
  leads: number;
  sales: number;
  salesValue: Map<string, number>;
  spend: Map<string, number>;
}

const add = (m: Map<string, number>, currency: string, v: number) => m.set(currency, (m.get(currency) ?? 0) + v);
const moneyList = (m: Map<string, number>) => (m.size ? [...m].map(([c, v]) => money(v, c)).join(" · ") : "—");
/** Cost of one thing when all the spend is in one currency. */
function per(spend: Map<string, number>, count: number): string {
  if (spend.size !== 1 || !count) return "—";
  const [[currency, total]] = [...spend];
  return money(total / count, currency);
}

function buildRows(r: AdReport): Row[] {
  // Spend entered for a whole source (no campaign) groups that source's campaigns into one row.
  const wholeSource = new Set(r.spend.filter((s) => !s.campaign).map((s) => s.source));
  const rows = new Map<string, Row>();
  const row = (source: string, campaign: string | null) => {
    const c = wholeSource.has(source) ? null : campaign;
    const key = `${source}|${c ?? ""}`;
    if (!rows.has(key)) rows.set(key, { source, campaign: c, visitors: 0, leads: 0, sales: 0, salesValue: new Map(), spend: new Map() });
    return rows.get(key)!;
  };
  for (const v of r.visits) row(v.source, v.campaign).visitors += v.visitors;
  for (const l of r.leads) row(l.source, l.campaign).leads += l.inquiries + l.bookings;
  for (const w of r.won) {
    const x = row(w.source, w.campaign);
    x.sales += 1;
    if (w.value) add(x.salesValue, w.currency, Number(w.value));
  }
  for (const s of r.spend) add(row(s.source, s.campaign).spend, s.currency, Number(s.amount));
  // Paid rows first (by spend), then the rest by leads; "no ad" last.
  return [...rows.values()].sort((a, b) => {
    if ((a.source === "none") !== (b.source === "none")) return a.source === "none" ? 1 : -1;
    if (Boolean(a.spend.size) !== Boolean(b.spend.size)) return a.spend.size ? -1 : 1;
    return b.leads - a.leads || b.visitors - a.visitors;
  });
}

function returnOnSpend(row: Row): string {
  if (row.spend.size !== 1 || row.salesValue.size !== 1) return "—";
  const [[sc, spent]] = [...row.spend];
  const [[vc, value]] = [...row.salesValue];
  return sc === vc && spent > 0 ? `×${new Intl.NumberFormat(tag(), { maximumFractionDigits: 1 }).format(value / spent)}` : "—";
}

function reportHtml(r: AdReport): string {
  const rows = buildRows(r);
  const paid = rows.filter((x) => x.source !== "none");
  const spend = new Map<string, number>();
  for (const x of paid) for (const [c, v] of x.spend) add(spend, c, v);
  const leads = paid.reduce((n, x) => n + x.leads, 0);
  const sales = paid.reduce((n, x) => n + x.sales, 0);
  const tile = (label: string, value: string, note = "") =>
    `<div class="admin-kpi"><p class="admin-kpi__label">${label}</p><p class="admin-kpi__value" dir="ltr">${value}</p>${note ? `<p class="admin-kpi__note" dir="ltr">${note}</p>` : ""}</div>`;
  const kpis = `<div class="admin-kpis">
    ${tile(t("adminAds.kpi.spend"), escapeHtml(moneyList(spend)))}
    ${tile(t("adminAds.kpi.leads"), num(leads))}
    ${tile(t("adminAds.kpi.costPerLead"), escapeHtml(per(spend, leads)))}
    ${tile(t("adminAds.kpi.sales"), num(sales))}
    ${tile(t("adminAds.kpi.costPerSale"), escapeHtml(per(spend, sales)))}
  </div>`;
  if (!rows.length) return `${kpis}<p class="admin-stats__empty">${t("adminAds.empty")}</p>`;
  const name = (x: Row) =>
    x.source === "none"
      ? t("adminStats.sources.none")
      : `${sourceLabel(x.source)}${x.campaign ? ` · <span dir="ltr">${escapeHtml(x.campaign)}</span>` : wholeSourceNote(x, r)}`;
  return `${kpis}
    <div class="admin-table-wrap">
      <table class="admin-table ads-table">
        <thead><tr>
          <th>${t("adminAds.col.ad")}</th><th>${t("adminAds.col.spend")}</th><th>${t("adminAds.col.visitors")}</th><th>${t("adminAds.col.leads")}</th>
          <th>${t("adminAds.col.costPerLead")}</th><th>${t("adminAds.col.sales")}</th><th>${t("adminAds.col.costPerSale")}</th><th>${t("adminAds.col.return")}</th>
        </tr></thead>
        <tbody>${rows
          .map(
            (x) => `<tr${x.source === "none" ? ' class="ads-table__organic"' : ""}>
              <td>${name(x)}</td>
              <td dir="ltr">${escapeHtml(moneyList(x.spend))}</td>
              <td dir="ltr">${num(x.visitors)}</td>
              <td dir="ltr">${num(x.leads)}</td>
              <td dir="ltr">${escapeHtml(per(x.spend, x.leads))}</td>
              <td dir="ltr">${num(x.sales)}${x.salesValue.size ? ` <small>(${escapeHtml(moneyList(x.salesValue))})</small>` : ""}</td>
              <td dir="ltr">${escapeHtml(per(x.spend, x.sales))}</td>
              <td dir="ltr">${escapeHtml(returnOnSpend(x))}</td>
            </tr>`
          )
          .join("")}</tbody>
      </table>
    </div>
    <p class="admin-panel__hint">${t("adminAds.reportHint")}</p>`;
}

function wholeSourceNote(x: Row, r: AdReport): string {
  return r.spend.some((s) => s.source === x.source && !s.campaign) ? ` <small>(${t("adminAds.allCampaigns")})</small>` : "";
}

function spendList(entries: AdSpend[]): string {
  if (!entries.length) return `<p class="admin-stats__empty">${t("adminAds.noSpend")}</p>`;
  return `<ul class="admin-list ads-spend">${entries
    .map(
      (e) => `<li class="admin-list__item" data-spend="${escapeHtml(e.id)}">
        <span class="admin-list__main">
          <strong>${sourceLabel(e.source)}${e.campaign ? ` · <span dir="ltr">${escapeHtml(e.campaign)}</span>` : ` <small>(${t("adminAds.allCampaigns")})</small>`}</strong>
          <small>${escapeHtml(dayLabel(e.starts_on))} – ${escapeHtml(dayLabel(e.ends_on))}${e.note ? ` · <span dir="auto">${escapeHtml(e.note)}</span>` : ""}</small>
        </span>
        <span class="admin-list__time" dir="ltr">${escapeHtml(money(Number(e.amount), e.currency))}</span>
        <button type="button" class="btn btn--outline btn--small" data-spend-delete>${t("adminAds.delete")}</button>
      </li>`
    )
    .join("")}</ul>`;
}

function formHtml(): string {
  const [from, to] = range("thisMonth");
  return `<form class="ads-form" data-spend-form novalidate>
    <div class="ads-form__grid">
      <label class="inquiry-card__field"><span>${t("adminAds.form.source")}</span>
        <select name="source">${SOURCES.map((s) => `<option value="${s}">${sourceLabel(s)}</option>`).join("")}<option value="other">${t("adminAds.form.other")}</option></select>
      </label>
      <label class="inquiry-card__field" data-other-source hidden><span>${t("adminAds.form.otherSource")}</span>
        <input name="other" type="text" dir="ltr" maxlength="40" autocomplete="off" placeholder="snapchat" />
      </label>
      <label class="inquiry-card__field"><span>${t("adminAds.form.campaign")}</span>
        <input name="campaign" type="text" dir="ltr" maxlength="80" autocomplete="off" list="ads-campaigns" placeholder="villa" />
        <datalist id="ads-campaigns"></datalist>
      </label>
      <label class="inquiry-card__field"><span>${t("adminAds.form.from")}</span><input name="from" type="date" value="${from}" /></label>
      <label class="inquiry-card__field"><span>${t("adminAds.form.to")}</span><input name="to" type="date" value="${to}" /></label>
      <div class="inquiry-card__field"><span>${t("adminAds.form.amount")}</span>
        <span class="crm-form__money">
          <input name="amount" type="text" inputmode="decimal" dir="ltr" autocomplete="off" aria-label="${t("adminAds.form.amount")}" />
          <select name="currency" aria-label="${t("adminCrm.currency")}">${CURRENCIES.map((c) => `<option value="${c}">${c}</option>`).join("")}</select>
        </span>
      </div>
      <label class="inquiry-card__field ads-form__note"><span>${t("adminAds.form.note")}</span><input name="note" type="text" dir="auto" maxlength="300" /></label>
    </div>
    <p class="crm-form__hint">${t("adminAds.form.hint")}</p>
    <p class="booking-card__error" role="status" data-spend-notice></p>
    <div class="booking-card__actions"><button type="submit" class="btn btn--primary btn--small">${t("adminAds.form.add")}</button></div>
  </form>`;
}

/** The form's entry, or an error message key. */
function readForm(form: HTMLFormElement): { entry: Omit<AdSpend, "id" | "created_at"> } | { error: string } {
  const data = new FormData(form);
  const text = (name: string) => String(data.get(name) ?? "").trim();
  const source = (text("source") === "other" ? text("other") : text("source")).toLowerCase().replace(/\s+/g, "-");
  if (!/^[a-z0-9._-]{1,40}$/.test(source)) return { error: "adminAds.form.errorSource" };
  const from = text("from");
  const to = text("to");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return { error: "adminAds.form.errorDates" };
  const amount = Number(toWesternDigits(text("amount")).replace(/[\s,]/g, ""));
  if (!text("amount") || !Number.isFinite(amount) || amount < 0) return { error: "adminAds.form.errorAmount" };
  const currency = (CURRENCIES as readonly string[]).includes(text("currency")) ? (text("currency") as Currency) : "USD";
  return { entry: { source, campaign: text("campaign").toLowerCase() || null, starts_on: from, ends_on: to, amount, currency, note: text("note") || null } };
}

export function renderAdminAds(main: HTMLElement): void {
  if (!requireAdmin(main)) return;

  main.innerHTML = `
    ${adminHero(t("adminAds.heroTitle"), t("adminAds.heroSubtitle"))}
    <section class="section admin-ads">
      <div class="container">
        ${adminNav("ads")}
        <div class="admin-stats__periods" role="group" aria-label="${t("adminStats.period")}" data-ads-periods></div>
        <p class="admin-ads__range" data-ads-range></p>
        <div data-ads-report aria-live="polite"><p>${t("common.loading")}</p></div>
        <div class="admin-panels admin-panels--two">
          <section class="admin-panel">
            <h2 class="admin-panel__title">${t("adminAds.addTitle")}</h2>
            ${formHtml()}
          </section>
          <section class="admin-panel">
            <h2 class="admin-panel__title">${t("adminAds.spendTitle")}</h2>
            <div data-spend-list><p>${t("common.loading")}</p></div>
          </section>
        </div>
        <p class="admin-bookings__note">${t("adminAds.note")}</p>
      </div>
    </section>`;

  const requestId = crypto.randomUUID();
  main.dataset.requestId = requestId;
  const live = () => main.dataset.requestId === requestId;
  const $ = <T extends HTMLElement>(sel: string) => main.querySelector<T>(sel)!;
  const periodsEl = $("[data-ads-periods]");
  const rangeEl = $("[data-ads-range]");
  const reportEl = $("[data-ads-report]");
  const listEl = $("[data-spend-list]");
  const form = $<HTMLFormElement>("[data-spend-form]");
  let entries: AdSpend[] = [];

  const loadReport = async () => {
    periodsEl.innerHTML = PERIODS.map(
      (p) => `<button type="button" class="admin-stats__period" data-period="${p}" aria-pressed="${p === period}">${t(`adminAds.periods.${p}`)}</button>`
    ).join("");
    const [from, to] = range(period);
    rangeEl.textContent = `${dayLabel(from)} – ${dayLabel(to)}`;
    const report = await fetchAdReport(from, to);
    if (!live()) return;
    reportEl.innerHTML = report ? reportHtml(report) : `<p class="admin-bookings__empty">${t("adminAds.unavailable")}</p>`;
    if (report) {
      const campaigns = [...new Set([...report.visits, ...report.leads].map((x) => x.campaign).filter((c): c is string => Boolean(c)))];
      $("#ads-campaigns").innerHTML = campaigns.map((c) => `<option value="${escapeHtml(c)}"></option>`).join("");
    }
  };

  const loadSpend = async () => {
    const list = await fetchAdSpend();
    if (!live()) return;
    if (!list) {
      listEl.innerHTML = `<p class="admin-stats__empty">${t("adminAds.unavailable")}</p>`;
      form.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled = true;
      return;
    }
    entries = list;
    listEl.innerHTML = spendList(entries);
  };

  void loadReport();
  void loadSpend();

  periodsEl.addEventListener("click", (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>("[data-period]");
    if (!button) return;
    period = button.dataset.period as Period;
    reportEl.style.opacity = "0.5";
    void loadReport().then(() => (reportEl.style.opacity = ""));
  });

  form.addEventListener("change", () => {
    $("[data-other-source]").hidden = form.querySelector<HTMLSelectElement>('select[name="source"]')!.value !== "other";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const notice = $("[data-spend-notice]");
    const read = readForm(form);
    if ("error" in read) {
      notice.textContent = t(read.error);
      notice.classList.remove("booking-card__error--ok");
      return;
    }
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    button.disabled = true;
    const saved = await addAdSpend(read.entry);
    button.disabled = false;
    if (!saved) {
      notice.textContent = t("adminCrm.saveError");
      notice.classList.remove("booking-card__error--ok");
      return;
    }
    notice.textContent = t("adminAds.form.added");
    notice.classList.add("booking-card__error--ok");
    form.querySelector<HTMLInputElement>('input[name="amount"]')!.value = "";
    form.querySelector<HTMLInputElement>('input[name="note"]')!.value = "";
    entries = [saved, ...entries];
    listEl.innerHTML = spendList(entries);
    void loadReport();
  });

  listEl.addEventListener("click", async (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>("[data-spend-delete]");
    const id = button?.closest<HTMLElement>("[data-spend]")?.dataset.spend;
    if (!button || !id || !window.confirm(t("adminAds.confirmDelete"))) return;
    button.disabled = true;
    if (!(await deleteAdSpend(id))) {
      button.disabled = false;
      window.alert(t("adminCrm.saveError"));
      return;
    }
    entries = entries.filter((x) => x.id !== id);
    listEl.innerHTML = spendList(entries);
    void loadReport();
  });
}
