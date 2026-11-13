import { t, intlTag } from "../../i18n";
import { escapeHtml } from "../../utils/html";
import { STAGES, fromIstanbulInput, toIstanbulInput, type Stage } from "../../data/crm";
import { ACTIVITY_ICONS, ACTIVITY_KINDS, type ActivityKind, type CrmActivity } from "../../data/crmActivities";
import { stageLabel } from "./crmForm";

/**
 * A customer's activity log on their record (/admin/customers): a quick form (what kind,
 * what happened, when) and the dated list, newest first. Stage changes are written by the
 * database itself (migration 0037), so the log also shows how the customer moved along.
 */

const ISTANBUL = "Europe/Istanbul";
const A = (key: string, params?: Record<string, string | number>) => t(`adminCrm.activity.${key}`, params);

const when = (iso: string) =>
  new Intl.DateTimeFormat(intlTag(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ISTANBUL }).format(
    Date.parse(iso)
  );
const shortDate = (iso: string) => new Intl.DateTimeFormat(intlTag(), { day: "numeric", month: "short", timeZone: ISTANBUL }).format(Date.parse(iso));

const isStage = (s: string): s is Stage => (STAGES as readonly string[]).includes(s);

/** "Stage: Contacted → No reply" in the page's words. */
function stageText(body: string): string {
  const [from, to = ""] = body.split(">");
  if (!isStage(to)) return escapeHtml(body);
  return isStage(from) ? A("stageMove", { from: stageLabel(from), to: stageLabel(to) }) : A("stageSet", { to: stageLabel(to) });
}

export const kindLabel = (kind: ActivityKind) => A(`kinds.${kind}`);

function itemHtml(a: CrmActivity): string {
  const stage = a.kind === "stage";
  return `<li class="activity-item${stage ? " activity-item--stage" : ""}" data-activity="${escapeHtml(a.id)}">
    <span class="activity-item__icon" aria-hidden="true">${ACTIVITY_ICONS[a.kind] ?? "•"}</span>
    <div class="activity-item__main">
      <p class="activity-item__head">
        <span class="activity-item__what">
          <strong>${stage ? stageText(a.body) : kindLabel(a.kind)}</strong>
          <time class="activity-item__date" datetime="${escapeHtml(a.happened_at)}">${escapeHtml(when(a.happened_at))}</time>
        </span>
        ${stage ? "" : `<button type="button" class="activity-item__delete" data-activity-delete aria-label="${A("delete")}" title="${A("delete")}">×</button>`}
      </p>
      ${!stage && a.body ? `<p class="activity-item__body" dir="auto">${escapeHtml(a.body)}</p>` : ""}
    </div>
  </li>`;
}

/** The log section; `activities` null = migration 0037 not run yet. */
export function activityLogHtml(customerId: string, activities: CrmActivity[] | null): string {
  const id = escapeHtml(customerId);
  if (!activities) {
    return `<section class="activity-log"><h3 class="customer-card__history">${A("title")}</h3><p class="admin-panel__hint">${A("needs0037")}</p></section>`;
  }
  const kinds = ACTIVITY_KINDS.map(
    (k, i) =>
      `<label class="activity-kind"><input type="radio" name="kind" value="${k}"${i === 0 ? " checked" : ""} /><span>${ACTIVITY_ICONS[k]} ${kindLabel(k)}</span></label>`
  ).join("");
  return `<section class="activity-log">
    <h3 class="customer-card__history">${A("title")}</h3>
    <form class="activity-form" data-activity-form="${id}" novalidate>
      <fieldset class="activity-kinds"><legend class="visually-hidden">${A("kind")}</legend>${kinds}</fieldset>
      <label class="inquiry-card__field"><span>${A("body")}</span>
        <textarea name="body" rows="2" dir="auto" maxlength="2000" placeholder="${A("placeholder")}"></textarea>
      </label>
      <div class="activity-form__row">
        <label class="inquiry-card__field"><span>${A("when")}</span>
          <input name="happened_at" type="datetime-local" value="${toIstanbulInput(new Date().toISOString())}" />
        </label>
        <button type="submit" class="btn btn--primary btn--small">${A("add")}</button>
      </div>
      <p class="booking-card__error" role="status" data-activity-notice></p>
    </form>
    ${
      activities.length
        ? `<ol class="activity-list">${activities.map(itemHtml).join("")}</ol>`
        : `<p class="activity-log__empty">${A("empty")}</p>`
    }
  </section>`;
}

/** The form's values, or an error key. */
export function readActivityForm(form: HTMLFormElement): { kind: ActivityKind; body: string; happened_at: string | null } | { error: string } {
  const data = new FormData(form);
  const kind = String(data.get("kind") ?? "") as ActivityKind;
  const body = String(data.get("body") ?? "").trim();
  const happened = fromIstanbulInput(String(data.get("happened_at") ?? "").trim());
  if (!(ACTIVITY_KINDS as readonly string[]).includes(kind)) return { error: "adminCrm.activity.bodyRequired" };
  if (kind === "note" && !body) return { error: "adminCrm.activity.bodyRequired" };
  if (happened && Date.parse(happened) > Date.now() + 10 * 60_000) return { error: "adminCrm.activity.future" };
  return { kind, body, happened_at: happened };
}

/** "📞 Last: call · 12 Nov" for the pipeline card (the latest thing the team did, not a stage change). */
export function lastActivityLine(activities: CrmActivity[]): string {
  const a = activities.find((x) => x.kind !== "stage");
  if (!a) return "";
  return `<p class="pipeline-card__meta pipeline-card__activity">${ACTIVITY_ICONS[a.kind]} ${A("last", { what: kindLabel(a.kind), date: `<span class="pipeline-card__when">${escapeHtml(shortDate(a.happened_at))}</span>` })}</p>`;
}
