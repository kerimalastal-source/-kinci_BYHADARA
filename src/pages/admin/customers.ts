import { t, link, getLocale, getProjectContent } from "../../i18n";
import { requireAdmin } from "../../auth/session";
import { escapeHtml } from "../../utils/html";
import { getProjectBySlug } from "../../data/projects";
import { fetchTourBookings, type TourBooking } from "../../data/tourBookings";
import { fetchInquiries, type Inquiry } from "../../data/inquiries";
import { adminHero, adminNav, queryParam } from "./nav";
import { whatsappReplies } from "./replies";
import { sourceLabel } from "./stats";
import { fetchCrmLeads, leadFor, personKeys, phoneKey, saveCrmLead, type CrmLead } from "../../data/crm";
import { crmFormHtml, followUpTag, readCrmForm, stageTag, syncCrmForm } from "./crmForm";

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

const tag = () => `${getLocale()}-u-nu-latn`;
const sep = () => (getLocale() === "ar" ? "، " : ", ");
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
      const emails = [...new Set(sorted.map((r) => r.email.trim().toLowerCase()))];
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
      <p class="customer-entry__head">📩 <strong>${t(`adminInquiries.kinds.${i.kind}`)}</strong>
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
        <small><span dir="ltr">${escapeHtml(c.phones[0] ?? "")}</span> · <span dir="ltr">${escapeHtml(c.emails[0] ?? "")}</span></small>
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
        <div><dt>${t("adminInquiries.labels.email")}</dt><dd>${c.emails.map((e) => `<a href="mailto:${escapeHtml(e)}" dir="ltr">${escapeHtml(e)}</a>`).join(" · ")}</dd></div>
        ${projects.length ? `<div><dt>${t("adminInquiries.labels.projects")}</dt><dd>${escapeHtml(projectNames(projects))}</dd></div>` : ""}
        ${c.locale ? `<div><dt>${t("adminInquiries.labels.siteLanguage")}</dt><dd>${t(`lang.${c.locale}`)}</dd></div>` : ""}
        ${c.sources.length ? `<div><dt>${t("adminInquiries.labels.source")}</dt><dd>${[...new Set(c.sources.map(campaignSource))].map(sourceLabel).join(sep())}</dd></div>` : ""}
      </dl>
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

  const paint = () => {
    const found = customers.filter((c) => matches(c, query.trim()));
    countEl.textContent = t("adminCustomers.count", { count: found.length });
    // One match (e.g. from a card's "Customer history" link) opens straight away.
    listEl.innerHTML = found.length
      ? found.map((c) => renderCustomer(c, found.length === 1, leadOf(c))).join("")
      : `<p class="admin-bookings__empty">${t(query.trim() ? "adminInquiries.noResults" : "adminCustomers.empty")}</p>`;
  };

  Promise.all([fetchInquiries().catch(() => [] as Inquiry[]), fetchTourBookings().catch(() => [] as TourBooking[]), fetchCrmLeads()])
    .then(([inquiries, bookings, crm]) => {
      if (main.dataset.requestId !== requestId) return;
      customers = groupCustomers(inquiries, bookings);
      leads = crm;
      paint();
    })
    .catch((err) => {
      console.error(err);
      if (main.dataset.requestId === requestId) listEl.innerHTML = `<p class="admin-bookings__empty">${t("adminInquiries.loadError")}</p>`;
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
    if (!saved) {
      notice.textContent = t("adminCrm.saveError");
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
