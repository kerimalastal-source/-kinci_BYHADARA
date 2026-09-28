import { t, getLocale, getProjectContent } from "../../i18n";
import { escapeHtml } from "../../utils/html";
import { toWesternDigits } from "../../utils/numbers";
import { getProjectBySlug, projects as allProjects } from "../../data/projects";
import { CURRENCIES, STAGES, fromIstanbulInput, toIstanbulInput, type CrmChanges, type CrmLead, type Currency, type Stage } from "../../data/crm";

/**
 * The sales block on a customer's record (stage, deal, next follow-up) and the small
 * stage / follow-up tags shared by the customers page and the pipeline board.
 */

const ISTANBUL = "Europe/Istanbul";
const tag = () => `${getLocale()}-u-nu-latn`;

/** "Thu 2 Oct, 15:30" in Istanbul time, 24-hour (no AM/PM to flip in RTL). */
export function followUpWhen(iso: string): string {
  return new Intl.DateTimeFormat(tag(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ISTANBUL }).format(
    Date.parse(iso)
  );
}

export const stageLabel = (stage: Stage) => t(`adminCrm.stages.${stage}`);

export function stageTag(stage: Stage): string {
  return `<span class="crm-stage crm-stage--${stage}">${stageLabel(stage)}</span>`;
}

/** "⏰ Thu 2 Oct, 15:30", red once it has passed; nothing for closed deals. */
export function followUpTag(lead: CrmLead | null): string {
  if (!lead?.follow_up_at || lead.stage === "won" || lead.stage === "lost") return "";
  const late = Date.parse(lead.follow_up_at) < Date.now();
  return `<span class="admin-tag${late ? " admin-tag--late" : ""}" title="${late ? t("adminCrm.overdue") : ""}">⏰ ${escapeHtml(followUpWhen(lead.follow_up_at))}</span>`;
}

/** "$420,000" / "€90,000" / "₺1,500,000" — the same in every language (shown left-to-right). */
export function money(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export const projectName = (slug: string) => (getProjectBySlug(slug) ? getProjectContent(slug).name : slug);

/** The form; `projects` (the customer's own) are listed first in the project menu. */
export function crmFormHtml(id: string, lead: CrmLead | null, projects: string[]): string {
  const stage = lead?.stage ?? "new";
  const slugs = [...new Set([...projects, ...allProjects.map((p) => p.slug)])];
  const value = lead?.deal_value != null ? String(lead.deal_value) : "";
  return `<form class="crm-form" data-crm-form="${escapeHtml(id)}" novalidate>
    <h3 class="customer-card__history">${t("adminCrm.sectionTitle")}</h3>
    <div class="crm-form__grid">
      <label class="inquiry-card__field"><span>${t("adminCrm.stage")}</span>
        <select name="stage">${STAGES.map((s) => `<option value="${s}"${s === stage ? " selected" : ""}>${stageLabel(s)}</option>`).join("")}</select>
      </label>
      <label class="inquiry-card__field"><span>${t("adminCrm.project")}</span>
        <select name="project"><option value="">${t("adminCrm.projectNone")}</option>${slugs
          .map((slug) => `<option value="${escapeHtml(slug)}"${slug === lead?.project ? " selected" : ""}>${escapeHtml(projectName(slug))}</option>`)
          .join("")}</select>
      </label>
      <div class="inquiry-card__field"><span>${t("adminCrm.value")}</span>
        <span class="crm-form__money">
          <input name="deal_value" type="text" inputmode="decimal" dir="ltr" autocomplete="off" value="${escapeHtml(value)}" aria-label="${t("adminCrm.value")}" />
          <select name="currency" aria-label="${t("adminCrm.currency")}">${CURRENCIES.map((c) => `<option value="${c}"${c === (lead?.currency ?? "USD") ? " selected" : ""}>${c}</option>`).join("")}</select>
        </span>
      </div>
      <label class="inquiry-card__field crm-form__lost"${stage === "lost" ? "" : " hidden"}><span>${t("adminCrm.lostReason")}</span>
        <input name="lost_reason" type="text" dir="auto" maxlength="500" value="${escapeHtml(lead?.lost_reason ?? "")}" placeholder="${t("adminCrm.lostPlaceholder")}" />
      </label>
      <label class="inquiry-card__field"><span>${t("adminCrm.followUp")}</span>
        <input name="follow_up_at" type="datetime-local" value="${toIstanbulInput(lead?.follow_up_at ?? null)}" />
      </label>
      <label class="inquiry-card__field crm-form__note"><span>${t("adminCrm.followUpNote")}</span>
        <input name="follow_up_note" type="text" dir="auto" maxlength="500" value="${escapeHtml(lead?.follow_up_note ?? "")}" placeholder="${t("adminCrm.notePlaceholder")}" />
      </label>
    </div>
    <p class="crm-form__hint">${t("adminCrm.followUpHint")}</p>
    <p class="booking-card__error" role="status" data-crm-notice></p>
    <div class="booking-card__actions">
      <button type="submit" class="btn btn--primary btn--small">${t("adminCrm.save")}</button>
    </div>
  </form>`;
}

/** The form's values as a change set, or an error message key. */
export function readCrmForm(form: HTMLFormElement): { changes: CrmChanges } | { error: string } {
  const data = new FormData(form);
  const text = (name: string) => String(data.get(name) ?? "").trim();
  const rawValue = toWesternDigits(text("deal_value")).replace(/[\s,]/g, "");
  const dealValue = rawValue ? Number(rawValue) : null;
  if (dealValue !== null && (!Number.isFinite(dealValue) || dealValue < 0)) return { error: "adminCrm.valueError" };
  const stage = text("stage") as Stage;
  return {
    changes: {
      stage: STAGES.includes(stage) ? stage : "new",
      project: text("project") || null,
      deal_value: dealValue,
      currency: (CURRENCIES as readonly string[]).includes(text("currency")) ? (text("currency") as Currency) : "USD",
      lost_reason: stage === "lost" ? text("lost_reason") || null : null,
      follow_up_at: fromIstanbulInput(text("follow_up_at")),
      follow_up_note: text("follow_up_note") || null
    }
  };
}

/** Shows the "why lost" field only for lost deals. */
export function syncCrmForm(form: HTMLFormElement): void {
  const stage = form.querySelector<HTMLSelectElement>('select[name="stage"]')?.value;
  const lost = form.querySelector<HTMLElement>(".crm-form__lost");
  if (lost) lost.hidden = stage !== "lost";
}
