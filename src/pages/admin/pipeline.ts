import { t, link, intlTag } from "../../i18n";
import { requireAdmin } from "../../auth/session";
import { escapeHtml } from "../../utils/html";
import { fetchTourBookings, type TourBooking } from "../../data/tourBookings";
import { fetchInquiries, type Inquiry } from "../../data/inquiries";
import { OPEN_STAGES, STAGES, fetchCrmLeads, leadFor, saveCrmLead, type CrmLead, type Stage } from "../../data/crm";
import { adminHero, adminNav } from "./nav";
import { groupCustomers, type Customer } from "./customers";
import { followUpTag, money, projectName, stageLabel } from "./crmForm";

/**
 * Sales pipeline (/admin/pipeline): every customer (from the inquiries and tour bookings,
 * grouped as on the customers page) in a column per sales stage. A card's menu moves it to
 * another stage; "Open record" goes to the customer's history for the deal and follow-up.
 * Won and lost deals stay on the board for 60 days.
 */

const ISTANBUL = "Europe/Istanbul";
const CLOSED_DAYS = 60;
const tag = () => intlTag();
const shortDate = (iso: string) => new Intl.DateTimeFormat(tag(), { day: "numeric", month: "short", timeZone: ISTANBUL }).format(Date.parse(iso));
const istanbulDay = (ms: number) => new Date(ms + 3 * 3_600_000).toISOString().slice(0, 10);

interface Card {
  customer: Customer;
  lead: CrmLead | null;
  stage: Stage;
}

/** Totals per currency, e.g. "$250,000 · €90,000". */
function totals(leads: CrmLead[]): string {
  const sums = new Map<string, number>();
  for (const l of leads) if (l.deal_value) sums.set(l.currency, (sums.get(l.currency) ?? 0) + Number(l.deal_value));
  return sums.size ? [...sums].map(([c, v]) => money(v, c)).join(" · ") : "—";
}

function cardHtml(card: Card): string {
  const { customer: c, lead } = card;
  const project = lead?.project ?? c.entries.flatMap((e) => e.item.projects ?? [])[0];
  const record = c.phones[0] ?? c.emails[0] ?? c.name;
  return `<li class="pipeline-card" data-pipeline-card="${escapeHtml(c.id)}">
    <p class="pipeline-card__name"><strong dir="auto">${escapeHtml(c.name)}</strong></p>
    ${project ? `<p class="pipeline-card__meta">${escapeHtml(projectName(project))}</p>` : ""}
    ${lead?.deal_value ? `<p class="pipeline-card__value" dir="ltr">${escapeHtml(money(Number(lead.deal_value), lead.currency))}</p>` : ""}
    ${card.stage === "lost" && lead?.lost_reason ? `<p class="pipeline-card__meta" dir="auto">${escapeHtml(lead.lost_reason)}</p>` : ""}
    <p class="pipeline-card__tags">${followUpTag(lead)}<span class="pipeline-card__date">${t("adminCrm.lastActivity", { date: shortDate(c.last) })}</span></p>
    <div class="pipeline-card__actions">
      <label class="visually-hidden" for="stage-${escapeHtml(c.id)}">${t("adminCrm.moveTo")}</label>
      <select id="stage-${escapeHtml(c.id)}" data-pipeline-stage>${STAGES.map(
        (s) => `<option value="${s}"${s === card.stage ? " selected" : ""}>${stageLabel(s)}</option>`
      ).join("")}</select>
      <a href="${link(`/admin/customers?q=${encodeURIComponent(record)}`)}">${t("adminCrm.openRecord")}</a>
    </div>
  </li>`;
}

export function renderAdminPipeline(main: HTMLElement): void {
  if (!requireAdmin(main)) return;

  main.innerHTML = `
    ${adminHero(t("adminCrm.heroTitle"), t("adminCrm.heroSubtitle"))}
    <section class="section admin-pipeline">
      <div class="container">
        ${adminNav("pipeline")}
        <div class="admin-kpis" data-pipeline-kpis></div>
        <div class="pipeline-board" data-pipeline-board aria-live="polite"><p>${t("common.loading")}</p></div>
        <p class="admin-bookings__note">${t("adminCrm.boardNote", { days: CLOSED_DAYS })}</p>
      </div>
    </section>`;

  const requestId = crypto.randomUUID();
  main.dataset.requestId = requestId;
  const board = main.querySelector<HTMLElement>("[data-pipeline-board]")!;
  const kpis = main.querySelector<HTMLElement>("[data-pipeline-kpis]")!;
  let customers: Customer[] = [];
  let leads: CrmLead[] = [];

  const paint = () => {
    const cutoff = Date.now() - CLOSED_DAYS * 86_400_000;
    const cards: Card[] = customers
      .map((customer) => {
        const lead = leadFor(leads, customer.keys);
        return { customer, lead, stage: lead?.stage ?? "new" };
      })
      .filter((c) => OPEN_STAGES.includes(c.stage) || Date.parse(c.lead?.stage_changed_at ?? c.customer.last) >= cutoff);

    const open = leads.filter((l) => OPEN_STAGES.includes(l.stage) && l.stage !== "new");
    const monthStart = `${istanbulDay(Date.now()).slice(0, 7)}-01`;
    const wonMonth = leads.filter((l) => l.stage === "won" && l.won_at && istanbulDay(Date.parse(l.won_at)) >= monthStart);
    const today = istanbulDay(Date.now());
    const followToday = leads.filter((l) => OPEN_STAGES.includes(l.stage) && l.follow_up_at && istanbulDay(Date.parse(l.follow_up_at)) <= today).length;
    const tile = (label: string, value: string, note = "", warn = false) =>
      `<div class="admin-kpi${warn ? " admin-kpi--warn" : ""}"><p class="admin-kpi__label">${label}</p><p class="admin-kpi__value" dir="ltr">${value}</p>${note ? `<p class="admin-kpi__note" dir="ltr">${note}</p>` : ""}</div>`;
    kpis.innerHTML = [
      tile(t("adminCrm.kpi.open"), String(cards.filter((c) => OPEN_STAGES.includes(c.stage)).length)),
      tile(t("adminCrm.kpi.pipelineValue"), escapeHtml(totals(open))),
      tile(t("adminCrm.kpi.wonMonth"), String(wonMonth.length), escapeHtml(totals(wonMonth))),
      tile(t("adminCrm.kpi.followToday"), String(followToday), "", followToday > 0)
    ].join("");

    board.innerHTML = STAGES.map((stage) => {
      const inStage = cards.filter((c) => c.stage === stage);
      return `<section class="pipeline-column pipeline-column--${stage}">
        <h2 class="pipeline-column__title">${stageLabel(stage)} <span class="pipeline-column__count" dir="ltr">${inStage.length}</span></h2>
        ${inStage.length ? `<ul class="pipeline-column__list">${inStage.map(cardHtml).join("")}</ul>` : `<p class="pipeline-column__empty">${t("adminCrm.emptyStage")}</p>`}
      </section>`;
    }).join("");
  };

  Promise.all([fetchInquiries().catch(() => [] as Inquiry[]), fetchTourBookings().catch(() => [] as TourBooking[]), fetchCrmLeads()]).then(
    ([inquiries, bookings, crm]) => {
      if (main.dataset.requestId !== requestId) return;
      if (!crm) {
        kpis.innerHTML = "";
        board.innerHTML = `<p class="admin-bookings__empty">${t("adminCrm.unavailable")}</p>`;
        return;
      }
      customers = groupCustomers(inquiries, bookings);
      leads = crm;
      paint();
    }
  );

  board.addEventListener("change", async (e) => {
    const select = (e.target as Element).closest<HTMLSelectElement>("[data-pipeline-stage]");
    const id = select?.closest<HTMLElement>("[data-pipeline-card]")?.dataset.pipelineCard;
    const customer = customers.find((c) => c.id === id);
    if (!select || !customer) return;
    select.disabled = true;
    const existing = leadFor(leads, customer.keys);
    const saved = await saveCrmLead(
      existing,
      { keys: customer.keys, name: customer.name, email: customer.emails[0] ?? null, phone: customer.phones[0] ?? null },
      { stage: select.value as Stage }
    );
    if (!saved) {
      select.disabled = false;
      select.value = existing?.stage ?? "new";
      window.alert(t("adminCrm.saveError"));
      return;
    }
    leads = [saved, ...leads.filter((l) => l.id !== saved.id)];
    paint();
  });
}
