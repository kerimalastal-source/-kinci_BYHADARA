import { t, link, getProjectContent, intlTag, listSep } from "../../i18n";
import { requireAdmin } from "../../auth/session";
import { escapeHtml } from "../../utils/html";
import { getProjectBySlug } from "../../data/projects";
import { fetchTourBookings, type TourBooking } from "../../data/tourBookings";
import { MANUAL_CHANNELS, fetchInquiries, inquiryKindKey, updateCustomer, type Inquiry, type ManualChannel } from "../../data/inquiries";
import { adminHero, adminNav, queryParam } from "./nav";
import { whatsappReplies } from "./replies";
import { sourceLabel } from "./stats";
import { fetchCrmLeads, leadFor, personKeys, phoneKey, saveCrmLead, type CrmLead } from "../../data/crm";
import { crmFormHtml, followUpTag, readCrmForm, stageTag, syncCrmForm } from "./crmForm";
import { SOURCES, countryOptions, linkCountryToPhone } from "./addCustomer";
import { getPhoneValue, isPhoneValid, renderPhoneInput, setPhoneInvalid, setPhoneValue } from "../../components/phoneInput";
import { toWesternDigits } from "../../utils/numbers";

/**
 * Customers (/admin/customers): every inquiry and video tour booking grouped by person —
 * the same email, or the same phone number, is the same customer — newest activity first,
 * each with their full history (messages, requests, tours, the team's notes).
 * ?q=<email|phone|name|reference> pre-fills the search (the cards' "Customer history" link).
 */

export type Entry = { type: "inquiry"; at: string; item: Inquiry } | { type: "tour"; at: string; item: TourBooking };

export interface Customer {
  id: string;
  /** Email and phone keys, as the sales pipeline (crm_leads) matches them. */
  keys: string[];
  name: string;
  emails: string[];
  phones: string[];
  locale: string | null;
  entries: Entry[];
  last: string;
  sources: string[];
}

const ISTANBUL = "Europe/Istanbul";
let query = "";

const tag = () => intlTag();
const sep = () => (listSep());
const when = (iso: string) =>
  new Intl.DateTimeFormat(tag(), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ISTANBUL }).format(
    Date.parse(iso)
  );
const projectNames = (slugs: string[]) =>
  slugs.map((slug) => (getProjectBySlug(slug) ? getProjectContent(slug).name : slug)).join(sep());

/** "facebook" from "utm_source=facebook · utm_campaign=villa" (as the statistics page names it). */
export function campaignSource(campaign: string): string {
  const utm = campaign.match(/utm_source=([^ ·&]+)/)?.[1];
  if (utm) return utm.toLowerCase();
  if (campaign.includes("gclid=")) return "google-ads";
  if (campaign.includes("fbclid=")) return "facebook";
  return campaign;
}

/** Groups the records that share an email or a phone number (union–find). */
export function groupCustomers(inquiries: Inquiry[], bookings: TourBooking[]): Customer[] {
  const records: { email: string; phone: string; name: string; locale: string | null; source: string | null; entry: Entry }[] = [
    ...inquiries.map((i) => ({ email: i.email, phone: i.phone, name: i.name, locale: i.site_locale, source: i.source, entry: { type: "inquiry", at: i.created_at, item: i } as Entry })),
    ...bookings.map((b) => ({ email: b.email, phone: b.phone, name: b.name, locale: b.site_locale, source: b.source, entry: { type: "tour", at: b.created_at, item: b } as Entry }))
  ];
  const parent = records.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const seen = new Map<string, number>();
  records.forEach((r, i) => {
    for (const key of [`e:${r.email.trim().toLowerCase()}`, `p:${phoneKey(r.phone)}`]) {
      if (key.length < 6) continue;
      const other = seen.get(key);
      if (other === undefined) seen.set(key, i);
      else parent[find(i)] = find(other);
    }
  });

  const groups = new Map<number, typeof records>();
  records.forEach((r, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), r]);
  });

  return [...groups.values()]
    .map((rs) => {
      const sorted = [...rs].sort((a, b) => Date.parse(b.entry.at) - Date.parse(a.entry.at));
      const latest = sorted[0];
      const emails = [...new Set(sorted.map((r) => r.email.trim().toLowerCase()).filter(Boolean))];
      const phones = [...new Map(sorted.map((r) => [phoneKey(r.phone), r.phone.trim()])).values()];
      return {
        id: phoneKey(latest.phone) || latest.email.toLowerCase(),
        keys: personKeys(emails, phones),
        name: latest.name,
        emails,
        phones,
        locale: latest.locale,
        entries: sorted.map((r) => r.entry),
        last: latest.entry.at,
        sources: [...new Set(sorted.map((r) => r.source).filter((s): s is string => Boolean(s)))]
      };
    })
    .sort((a, b) => Date.parse(b.last) - Date.parse(a.last));
}

function matches(c: Customer, search: string): boolean {
  if (!search) return true;
  const needle = search.toLocaleLowerCase();
  const digits = search.replace(/\D/g, "");
  const text = [c.name, ...c.emails, ...c.entries.map((e) => e.item.reference), ...c.entries.map((e) => e.item.name)].join(" ").toLocaleLowerCase();
  return text.includes(needle) || (digits.length >= 4 && c.phones.some((p) => p.replace(/\D/g, "").includes(digits)));
}

function entryHtml(e: Entry): string {
  if (e.type === "inquiry") {
    const i = e.item;
    const message = i.message ? `<p class="customer-entry__text" dir="auto">${escapeHtml(i.message.length > 280 ? `${i.message.slice(0, 280)}…` : i.message)}</p>` : "";
    const notes = i.notes ? `<p class="customer-entry__notes"><strong>${t("adminInquiries.notesLabel")}:</strong> <span dir="auto">${escapeHtml(i.notes)}</span></p>` : "";
    return `<li class="customer-entry">
      <p class="customer-entry__head">📩 <strong>${t(`adminInquiries.kinds.${inquiryKindKey(i)}`)}</strong>
        <span class="booking-status inquiry-status--${i.status}">${t(`adminInquiries.status.${i.status}`)}</span>
        <span class="customer-entry__date">${escapeHtml(when(i.created_at))}</span>
        <a href="${link(`/admin/inquiries?q=${encodeURIComponent(i.reference)}`)}" dir="ltr">${escapeHtml(i.reference)}</a></p>
      ${i.projects?.length ? `<p class="customer-entry__meta">${escapeHtml(projectNames(i.projects))}</p>` : ""}
      ${message}${notes}
    </li>`;
  }
  const b = e.item;
  return `<li class="customer-entry">
    <p class="customer-entry__head">📅 <strong>${t("adminCustomers.tour")}</strong>
      <span class="booking-status booking-status--${b.status}">${t(`adminBookings.status.${b.status}`)}</span>
      <span class="customer-entry__date">${escapeHtml(when(b.slot_start))}</span>
      <a href="${link("/admin/bookings")}" dir="ltr">${escapeHtml(b.reference)}</a></p>
    <p class="customer-entry__meta">${escapeHtml(projectNames(b.projects))} · ${t(`videoTour.wizard.apps.${b.app}`)} · ${t("adminCustomers.bookedOn", { date: when(b.created_at) })}</p>
  </li>`;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Unique ids for the phone fields of the edit forms (customer ids hold "@" and "."). */
let editCount = 0;

/** The customer's latest hand-added inquiry (the one that holds country, channel and source). */
const manualOf = (c: Customer) =>
  c.entries.find((e): e is Extract<Entry, { type: "inquiry" }> => e.type === "inquiry" && e.item.kind === "manual")?.item;

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames([intlTag()], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** "Edit customer details": name, main phone and email, and for a hand-added customer the country, channel and source. */
function editFormHtml(c: Customer): string {
  const A = (key: string) => t(`adminCrm.add.${key}`);
  const E = (key: string) => t(`adminCustomers.edit.${key}`);
  const phoneId = `customer-edit-${++editCount}`;
  const manual = manualOf(c);
  const sourceKey = manual ? Object.keys(SOURCES).find((k) => SOURCES[k] === (manual.source ?? "")) : undefined;
  const manualFields = manual
    ? `<label class="inquiry-card__field"><span>${A("country")}</span>
        <select name="country"><option value="">${A("countryNone")}</option>${countryOptions(manual.details?.country ?? "")}</select>
      </label>
      <label class="inquiry-card__field"><span>${A("channel")}</span>
        <select name="channel">${MANUAL_CHANNELS.map((ch) => `<option value="${ch}"${ch === manual.details?.channel ? " selected" : ""}>${A(`channels.${ch}`)}</option>`).join("")}</select>
      </label>
      <label class="inquiry-card__field"><span>${A("source")}</span>
        <select name="source">${
          sourceKey === undefined
            ? `<option value="__keep" selected dir="auto">${escapeHtml(manual.source ?? "")}</option>`
            : ""
        }${Object.keys(SOURCES).map((k) => `<option value="${k}"${k === sourceKey ? " selected" : ""}>${A(`sources.${k}`)}</option>`).join("")}</select>
      </label>`
    : "";
  return `<form class="ads-form customer-edit" data-customer-edit="${escapeHtml(c.id)}" data-phone-id="${phoneId}" novalidate hidden>
    <h3 class="customer-card__history">${E("title")}</h3>
    <div class="ads-form__grid">
      <label class="inquiry-card__field"><span>${A("name")}</span><input name="name" type="text" dir="auto" maxlength="100" autocomplete="off" value="${escapeHtml(c.name)}" required /></label>
      <div class="inquiry-card__field add-customer__phone"><span>${A("phone")}</span>${renderPhoneInput(phoneId, "phone")}</div>
      <label class="inquiry-card__field"><span>${A("email")}</span><input name="email" type="email" dir="ltr" maxlength="254" autocomplete="off" value="${escapeHtml(c.emails[0] ?? "")}" /></label>
      ${manualFields}
    </div>
    <p class="crm-form__hint">${E(c.phones.length > 1 || c.emails.length > 1 ? "hintMany" : "hint")}</p>
    <p class="booking-card__error" role="status" data-customer-edit-notice></p>
    <div class="booking-card__actions">
      <button type="submit" class="btn btn--primary btn--small">${E("save")}</button>
      <button type="button" class="btn btn--outline btn--small" data-customer-edit-cancel>${E("cancel")}</button>
    </div>
  </form>`;
}

/** `lead` is the customer's pipeline row (null: none yet; undefined: pipeline not set up — 0010). */
function renderCustomer(c: Customer, open: boolean, lead: CrmLead | null | undefined): string {
  const inquiries = c.entries.filter((e) => e.type === "inquiry").length;
  const tours = c.entries.filter((e) => e.type === "tour").length;
  const latestInquiry = c.entries.find((e): e is Extract<Entry, { type: "inquiry" }> => e.type === "inquiry")?.item;
  const nextTour = c.entries
    .filter((e): e is Extract<Entry, { type: "tour" }> => e.type === "tour")
    .map((e) => e.item)
    .find((b) => b.status !== "cancelled" && Date.parse(b.slot_start) > Date.now());
  const projects = [...new Set(c.entries.flatMap((e) => e.item.projects ?? []))];
  const replies = whatsappReplies({
    phone: c.phones[0] ?? "",
    name: c.name,
    locale: c.locale,
    projects,
    topic: latestInquiry?.kind === "property_request" ? "request" : latestInquiry?.kind === "consultation" ? "consultation" : "general",
    tour: nextTour ? { slot: nextTour.slot_start, app: nextTour.app } : undefined
  });
  return `<details class="customer-card"${open ? " open" : ""}>
    <summary class="customer-card__summary">
      <span class="customer-card__who">
        <strong dir="auto">${escapeHtml(c.name)}</strong>
        <small><span dir="ltr">${escapeHtml(c.phones[0] ?? "")}</span>${c.emails[0] ? ` · <span dir="ltr">${escapeHtml(c.emails[0])}</span>` : ""}</small>
      </span>
      <span class="customer-card__counts">
        ${inquiries ? `<span class="admin-tag">${t("adminCustomers.inquiries", { count: inquiries })}</span>` : ""}
        ${tours ? `<span class="admin-tag admin-tag--confirmed">${t("adminCustomers.tours", { count: tours })}</span>` : ""}
        ${lead !== undefined ? stageTag(lead?.stage ?? "new") : latestInquiry ? `<span class="booking-status inquiry-status--${latestInquiry.status}">${t(`adminInquiries.status.${latestInquiry.status}`)}</span>` : ""}
        ${followUpTag(lead ?? null)}
      </span>
      <span class="customer-card__last">${t("adminCustomers.last", { date: when(c.last) })}</span>
    </summary>
    <div class="customer-card__body">
      <dl class="booking-card__details">
        <div><dt>${t("adminInquiries.labels.phone")}</dt><dd>${c.phones.map((p) => `<a href="tel:+${p.replace(/\D/g, "")}" dir="ltr">${escapeHtml(p)}</a>`).join(" · ")}</dd></div>
        ${c.emails.length ? `<div><dt>${t("adminInquiries.labels.email")}</dt><dd>${c.emails.map((e) => `<a href="mailto:${escapeHtml(e)}" dir="ltr">${escapeHtml(e)}</a>`).join(" · ")}</dd></div>` : ""}
        ${projects.length ? `<div><dt>${t("adminInquiries.labels.projects")}</dt><dd>${escapeHtml(projectNames(projects))}</dd></div>` : ""}
        ${manualOf(c)?.details?.country ? `<div><dt>${t("adminCrm.add.country")}</dt><dd>${escapeHtml(countryName(manualOf(c)!.details.country))}</dd></div>` : ""}
        ${manualOf(c)?.details?.channel ? `<div><dt>${t("adminCrm.add.channel")}</dt><dd>${t(`adminCrm.add.channels.${manualOf(c)!.details.channel}`)}</dd></div>` : ""}
        ${c.locale ? `<div><dt>${t("adminInquiries.labels.siteLanguage")}</dt><dd>${t(`lang.${c.locale}`)}</dd></div>` : ""}
        ${c.sources.length ? `<div><dt>${t("adminInquiries.labels.source")}</dt><dd>${[...new Set(c.sources.map(campaignSource))].map(sourceLabel).join(sep())}</dd></div>` : ""}
      </dl>
      <p class="booking-card__error booking-card__error--ok" role="status" data-customer-saved></p>
      <div class="customer-card__edit">
        <button type="button" class="btn btn--outline btn--small" data-customer-edit-open aria-expanded="false">${t("adminCustomers.edit.open")}</button>
      </div>
      ${editFormHtml(c)}
      ${lead !== undefined ? crmFormHtml(c.id, lead, projects) : `<p class="admin-panel__hint">${t("adminCrm.unavailable")}</p>`}
      <h3 class="customer-card__history">${t("adminCustomers.history")}</h3>
      <ol class="customer-entries">${c.entries.map(entryHtml).join("")}</ol>
      <div class="booking-card__actions">${replies}</div>
    </div>
  </details>`;
}

export function renderAdminCustomers(main: HTMLElement): void {
  if (!requireAdmin(main)) return;
  query = queryParam("q") || query;

  main.innerHTML = `
    ${adminHero(t("adminCustomers.heroTitle"), t("adminCustomers.heroSubtitle"))}
    <section class="section admin-customers">
      <div class="container">
        ${adminNav("customers")}
        <div class="admin-inquiries__bar admin-customers__bar">
          <p class="admin-customers__count" data-customers-count></p>
          <input type="search" class="admin-inquiries__search" placeholder="${t("adminCustomers.searchPlaceholder")}" aria-label="${t("adminCustomers.searchPlaceholder")}" value="${escapeHtml(query)}" />
        </div>
        <div class="customer-list" aria-live="polite"><p>${t("common.loading")}</p></div>
      </div>
    </section>`;

  const requestId = crypto.randomUUID();
  main.dataset.requestId = requestId;
  const listEl = main.querySelector<HTMLElement>(".customer-list")!;
  const countEl = main.querySelector<HTMLElement>("[data-customers-count]")!;
  const searchEl = main.querySelector<HTMLInputElement>(".admin-inquiries__search")!;
  let customers: Customer[] = [];
  /** Pipeline rows; null until migration 0010 has run. */
  let leads: CrmLead[] | null = null;
  const leadOf = (c: Customer) => (leads ? leadFor(leads, c.keys) : undefined);

  /** `openEntry`: keep the customer holding this record open (after editing their details). */
  const paint = (openEntry?: string) => {
    const found = customers.filter((c) => matches(c, query.trim()) || (openEntry && c.entries.some((e) => e.item.id === openEntry)));
    countEl.textContent = t("adminCustomers.count", { count: found.length });
    // One match (e.g. from a card's "Customer history" link) opens straight away.
    listEl.innerHTML = found.length
      ? found.map((c) => renderCustomer(c, found.length === 1 || (!!openEntry && c.entries.some((e) => e.item.id === openEntry)), leadOf(c))).join("")
      : `<p class="admin-bookings__empty">${t(query.trim() ? "adminInquiries.noResults" : "adminCustomers.empty")}</p>`;
  };

  const load = (openEntry?: string) =>
    Promise.all([fetchInquiries().catch(() => [] as Inquiry[]), fetchTourBookings().catch(() => [] as TourBooking[]), fetchCrmLeads()]).then(
      ([inquiries, bookings, crm]) => {
        if (main.dataset.requestId !== requestId) return;
        customers = groupCustomers(inquiries, bookings);
        leads = crm;
        paint(openEntry);
      }
    );

  load().catch((err) => {
    console.error(err);
    if (main.dataset.requestId === requestId) listEl.innerHTML = `<p class="admin-bookings__empty">${t("adminInquiries.loadError")}</p>`;
  });

  // "Edit customer details": open / close the form (filled in the first time it opens).
  listEl.addEventListener("click", (e) => {
    const target = e.target as Element;
    const opener = target.closest<HTMLButtonElement>("[data-customer-edit-open]");
    const cancel = target.closest<HTMLButtonElement>("[data-customer-edit-cancel]");
    const body = (opener ?? cancel)?.closest<HTMLElement>(".customer-card__body");
    const form = body?.querySelector<HTMLFormElement>("[data-customer-edit]");
    const button = body?.querySelector<HTMLButtonElement>("[data-customer-edit-open]");
    if (!form || !button) return;
    const show = !!opener && form.hidden;
    if (show && !form.dataset.ready) {
      const customer = customers.find((c) => c.id === form.dataset.customerEdit);
      const phoneId = form.dataset.phoneId!;
      setPhoneValue(form, phoneId, customer?.phones[0] ?? "");
      linkCountryToPhone(form, phoneId);
      form.dataset.ready = "1";
    }
    form.hidden = !show;
    button.setAttribute("aria-expanded", String(show));
    if (show) form.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    else if (cancel) button.focus();
  });

  listEl.addEventListener("submit", async (e) => {
    const form = (e.target as Element).closest<HTMLFormElement>("[data-customer-edit]");
    if (!form) return;
    e.preventDefault();
    const customer = customers.find((c) => c.id === form.dataset.customerEdit);
    const notice = form.querySelector<HTMLElement>("[data-customer-edit-notice]")!;
    const say = (key: string) => {
      notice.textContent = t(key);
      notice.classList.remove("booking-card__error--ok");
    };
    if (!customer) return;
    const data = new FormData(form);
    const text = (name: string) => toWesternDigits(String(data.get(name) ?? "")).trim();
    const phoneId = form.dataset.phoneId!;
    const phoneOk = isPhoneValid(form, phoneId);
    setPhoneInvalid(form, phoneId, !phoneOk);
    const name = text("name");
    const email = text("email").toLowerCase();
    if (!name || !phoneOk) return say("adminCrm.add.required");
    if (email && !EMAIL_RE.test(email)) return say("adminCrm.add.emailError");
    // A tour booking always needs an email (its reminder goes there).
    const hasTour = customer.entries.some((en) => en.type === "tour");
    if (!email && customer.emails[0] && hasTour) return say("adminCustomers.edit.emailNeeded");

    const manual = manualOf(customer);
    const sourceKey = text("source");
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    submit.disabled = true;
    notice.textContent = "";
    const result = await updateCustomer({
      inquiryIds: customer.entries.filter((en) => en.type === "inquiry").map((en) => en.item.id),
      bookingIds: customer.entries.filter((en) => en.type === "tour").map((en) => en.item.id),
      leadId: leads ? leadFor(leads, customer.keys)?.id ?? null : null,
      oldPhone: customer.phones[0] ?? "",
      oldEmail: customer.emails[0] ?? "",
      name,
      phone: getPhoneValue(form, phoneId).replace(/\s+/g, " "),
      email,
      manualId: manual?.id ?? null,
      country: manual ? text("country") : "",
      channel: manual ? ((MANUAL_CHANNELS as readonly string[]).includes(text("channel")) ? (text("channel") as ManualChannel) : "other") : "",
      source: manual ? (sourceKey === "__keep" ? manual.source ?? "" : SOURCES[sourceKey] ?? "") : ""
    });
    submit.disabled = false;
    if ("error" in result) {
      return say(
        result.error === "unavailable" ? "adminCustomers.edit.unavailable" : result.error === "invalid" ? "adminCrm.add.required" : "adminCustomers.edit.error"
      );
    }
    // Reload everything (the customer may now group differently) and keep their card open.
    const anchor = customer.entries[0].item.id;
    await load(anchor).catch(() => undefined);
    const card = [...listEl.querySelectorAll<HTMLElement>(".customer-card")].find((el) =>
      customers.some((c) => c.entries.some((en) => en.item.id === anchor) && el.querySelector(`[data-customer-edit="${CSS.escape(c.id)}"]`))
    );
    const saved = card?.querySelector<HTMLElement>("[data-customer-saved]");
    if (saved) saved.textContent = t("adminCustomers.edit.saved");
  });

  listEl.addEventListener("change", (e) => {
    const form = (e.target as Element).closest<HTMLFormElement>("[data-crm-form]");
    if (form) syncCrmForm(form);
  });

  listEl.addEventListener("submit", async (e) => {
    const form = (e.target as Element).closest<HTMLFormElement>("[data-crm-form]");
    if (!form || !leads) return;
    e.preventDefault();
    const customer = customers.find((c) => c.id === form.dataset.crmForm);
    const notice = form.querySelector<HTMLElement>("[data-crm-notice]")!;
    if (!customer) return;
    const read = readCrmForm(form);
    if ("error" in read) {
      notice.textContent = t(read.error);
      notice.classList.remove("booking-card__error--ok");
      return;
    }
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    button.disabled = true;
    const existing = leadFor(leads, customer.keys);
    const saved = await saveCrmLead(
      existing,
      { keys: customer.keys, name: customer.name, email: customer.emails[0] ?? null, phone: customer.phones[0] ?? null },
      read.changes
    );
    button.disabled = false;
    if (!saved || saved === "needs0032") {
      notice.textContent = t(saved ? "adminCrm.needs0032" : "adminCrm.saveError");
      notice.classList.remove("booking-card__error--ok");
      return;
    }
    leads = [saved, ...leads.filter((l) => l.id !== saved.id)];
    // Repaint this card (tags in its summary) and keep it open.
    const card = form.closest<HTMLDetailsElement>(".customer-card")!;
    card.outerHTML = renderCustomer(customer, true, saved);
    const fresh = listEl.querySelector<HTMLFormElement>(`[data-crm-form="${CSS.escape(customer.id)}"]`);
    const freshNotice = fresh?.querySelector<HTMLElement>("[data-crm-notice]");
    if (freshNotice) {
      freshNotice.textContent = t("adminCrm.saved");
      freshNotice.classList.add("booking-card__error--ok");
    }
  });

  searchEl.addEventListener("input", () => {
    query = searchEl.value;
    paint();
  });
}
