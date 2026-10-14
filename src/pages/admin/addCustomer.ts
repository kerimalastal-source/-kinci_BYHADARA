import { t, getLocale } from "../../i18n";
import { escapeHtml } from "../../utils/html";
import { toWesternDigits } from "../../utils/numbers";
import { countries } from "../../data/countries";
import { projects as allProjects } from "../../data/projects";
import { renderPhoneInput, getPhoneValue, isPhoneValid, setPhoneInvalid } from "../../components/phoneInput";
import { MANUAL_CHANNELS, addManualCustomer, type ManualChannel } from "../../data/inquiries";
import { CURRENCIES, STAGES, fromIstanbulInput, leadFor, personKeys, saveCrmLead, type CrmLead, type Currency, type Stage } from "../../data/crm";
import { projectName, stageLabel } from "./crmForm";

/**
 * "Add a customer" on the pipeline page: a customer who reached the team on WhatsApp, by
 * phone or at the office without filling in a form on the site. Saved as an inquiry of kind
 * "manual" (admin_add_customer(), migration 0019) — so they appear on the customers page, the
 * pipeline and the ad report like any other lead — plus their pipeline row (stage, deal value,
 * next follow-up).
 */

/** Where the customer came from, saved in the same "utm_source=… · utm_campaign=…" form as the site's leads. */
const SOURCES: Record<string, string> = {
  gulf: "utm_source=facebook · utm_campaign=gulf-whatsapp",
  villa: "utm_source=facebook · utm_campaign=villa-leads",
  otherAd: "utm_source=facebook · utm_campaign=other-ad",
  social: "utm_source=social",
  website: "utm_source=website",
  referral: "utm_source=referral",
  none: ""
};

const PHONE_ID = "add-customer-phone";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function countryOptions(): string {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([getLocale()], { type: "region" });
  } catch {
    names = null;
  }
  return countries
    .map((c) => ({ code: c.iso2, name: names?.of(c.iso2) ?? c.name }))
    .sort((a, b) => a.name.localeCompare(b.name, getLocale()))
    .map((c) => `<option value="${c.code}">${escapeHtml(c.name)}</option>`)
    .join("");
}

export function addCustomerHtml(): string {
  const A = (key: string) => t(`adminCrm.add.${key}`);
  return `<div class="pipeline-add">
    <button type="button" class="btn btn--primary btn--small" data-add-customer-open aria-expanded="false" aria-controls="add-customer-form">${A("open")}</button>
    <form class="ads-form add-customer" id="add-customer-form" data-add-customer novalidate hidden>
      <h2 class="add-customer__title">${A("title")}</h2>
      <p class="crm-form__hint">${A("intro")}</p>
      <div class="ads-form__grid">
        <label class="inquiry-card__field"><span>${A("name")}</span><input name="name" type="text" dir="auto" maxlength="100" autocomplete="off" required /></label>
        <div class="inquiry-card__field add-customer__phone"><span>${A("phone")}</span>${renderPhoneInput(PHONE_ID, "phone")}</div>
        <label class="inquiry-card__field"><span>${A("email")}</span><input name="email" type="email" dir="ltr" maxlength="254" autocomplete="off" /></label>
        <label class="inquiry-card__field"><span>${A("country")}</span>
          <select name="country"><option value="">${A("countryNone")}</option>${countryOptions()}</select>
        </label>
        <label class="inquiry-card__field"><span>${A("channel")}</span>
          <select name="channel">${MANUAL_CHANNELS.map((c) => `<option value="${c}">${A(`channels.${c}`)}</option>`).join("")}</select>
        </label>
        <label class="inquiry-card__field"><span>${A("source")}</span>
          <select name="source">${Object.keys(SOURCES).map((s) => `<option value="${s}">${A(`sources.${s}`)}</option>`).join("")}</select>
        </label>
        <label class="inquiry-card__field"><span>${t("adminCrm.project")}</span>
          <select name="project"><option value="">${t("adminCrm.projectNone")}</option>${allProjects
            .filter((p) => !p.soldOut)
            .map((p) => `<option value="${escapeHtml(p.slug)}">${escapeHtml(projectName(p.slug))}</option>`)
            .join("")}</select>
        </label>
        <label class="inquiry-card__field"><span>${t("adminCrm.stage")}</span>
          <select name="stage">${STAGES.filter((s) => s !== "won" && s !== "lost")
            .map((s) => `<option value="${s}"${s === "contacted" ? " selected" : ""}>${stageLabel(s)}</option>`)
            .join("")}</select>
        </label>
        <div class="inquiry-card__field"><span>${A("value")}</span>
          <span class="crm-form__money">
            <input name="deal_value" type="text" inputmode="decimal" dir="ltr" autocomplete="off" aria-label="${A("value")}" />
            <select name="currency" aria-label="${t("adminCrm.currency")}">${CURRENCIES.map((c) => `<option value="${c}">${c}</option>`).join("")}</select>
          </span>
        </div>
        <label class="inquiry-card__field"><span>${t("adminCrm.followUp")}</span><input name="follow_up_at" type="datetime-local" /></label>
        <label class="inquiry-card__field ads-form__note"><span>${t("adminCrm.followUpNote")}</span>
          <input name="follow_up_note" type="text" dir="auto" maxlength="500" placeholder="${t("adminCrm.notePlaceholder")}" />
        </label>
        <label class="inquiry-card__field add-customer__note"><span>${A("note")}</span>
          <textarea name="note" rows="3" dir="auto" maxlength="5000" placeholder="${A("notePlaceholder")}"></textarea>
        </label>
      </div>
      <p class="crm-form__hint">${t("adminCrm.followUpHint")}</p>
      <p class="booking-card__error" role="status" data-add-customer-notice></p>
      <div class="booking-card__actions">
        <button type="submit" class="btn btn--primary btn--small">${A("submit")}</button>
        <button type="button" class="btn btn--outline btn--small" data-add-customer-cancel>${A("cancel")}</button>
      </div>
    </form>
  </div>`;
}

/** Wires the button and form; `onAdded` reloads the board. */
export function initAddCustomer(root: HTMLElement, getLeads: () => CrmLead[], onAdded: () => Promise<void>): void {
  const open = root.querySelector<HTMLButtonElement>("[data-add-customer-open]");
  const form = root.querySelector<HTMLFormElement>("[data-add-customer]");
  if (!open || !form) return;
  const notice = form.querySelector<HTMLElement>("[data-add-customer-notice]")!;
  const say = (text: string, ok = false) => {
    notice.textContent = text;
    notice.classList.toggle("booking-card__error--ok", ok);
  };
  const toggle = (show: boolean) => {
    form.hidden = !show;
    open.setAttribute("aria-expanded", String(show));
    if (show) form.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
  };

  open.addEventListener("click", () => toggle(form.hidden));
  form.querySelector("[data-add-customer-cancel]")?.addEventListener("click", () => {
    toggle(false);
    open.focus();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    const name = text("name");
    const phoneOk = isPhoneValid(form, PHONE_ID);
    setPhoneInvalid(form, PHONE_ID, !phoneOk);
    if (!name || !phoneOk) return say(t("adminCrm.add.required"));
    const email = text("email").toLowerCase();
    if (email && !EMAIL_RE.test(email)) return say(t("adminCrm.add.emailError"));
    const rawValue = toWesternDigits(text("deal_value")).replace(/[\s,]/g, "");
    const dealValue = rawValue ? Number(rawValue) : null;
    if (dealValue !== null && (!Number.isFinite(dealValue) || dealValue < 0)) return say(t("adminCrm.valueError"));

    const phone = getPhoneValue(form, PHONE_ID).replace(/\s+/g, " ");
    const project = text("project");
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    button.disabled = true;
    say("");

    const added = await addManualCustomer({
      name,
      phone,
      email,
      country: text("country"),
      channel: (MANUAL_CHANNELS as readonly string[]).includes(text("channel")) ? (text("channel") as ManualChannel) : "other",
      source: SOURCES[text("source")] ?? "",
      projects: project ? [project] : [],
      note: text("note")
    });
    if ("error" in added) {
      button.disabled = false;
      return say(t(added.error === "unavailable" ? "adminCrm.add.unavailable" : added.error === "invalid" ? "adminCrm.add.required" : "adminCrm.add.error"));
    }

    // The pipeline row: stage, deal and the next follow-up (merged into an existing row for the same phone/email).
    const keys = personKeys(email ? [email] : [], [phone]);
    const stage = (STAGES as readonly string[]).includes(text("stage")) ? (text("stage") as Stage) : "contacted";
    const saved = await saveCrmLead(
      leadFor(getLeads(), keys),
      { keys, name, email: email || null, phone },
      {
        stage,
        project: project || null,
        deal_value: dealValue,
        currency: (CURRENCIES as readonly string[]).includes(text("currency")) ? (text("currency") as Currency) : "USD",
        follow_up_at: fromIstanbulInput(text("follow_up_at")),
        follow_up_note: text("follow_up_note") || null
      }
    );
    button.disabled = false;
    if (!saved) return say(t("adminCrm.saveError"));

    form.reset();
    await onAdded();
    say(t("adminCrm.add.added", { name, reference: added.reference }), true);
  });
}
