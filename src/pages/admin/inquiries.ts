import { t, link, getLocale, getProjectContent, intlTag, listSep } from "../../i18n";
import { requireAdmin } from "../../auth/session";
import { escapeHtml } from "../../utils/html";
import { getProjectBySlug } from "../../data/projects";
import { fetchInquiries, updateInquiry, type Inquiry, type InquiryKind, type InquiryStatus } from "../../data/inquiries";
import { adminNav, queryParam } from "./nav";
import { customerLink, whatsappReplies } from "./replies";

/**
 * Admin inbox for the site's forms (/admin/inquiries): contact messages, custom property
 * requests and engineering consultation requests (api/inquiry.ts, migration 0007).
 * The team moves each inquiry through new → contacted → interested → closed and keeps
 * internal notes on it; nothing here is ever sent to the visitor.
 */

type Tab = "new" | "active" | "closed" | "all";
const TABS: Tab[] = ["new", "active", "closed", "all"];
const STATUSES: InquiryStatus[] = ["new", "contacted", "interested", "closed"];
const ISTANBUL = "Europe/Istanbul";

/** Form answers saved as option keys: [detail key, label key, option labels group]. */
const DETAIL_FIELDS: Record<InquiryKind, [string, string, string | null][]> = {
  contact: [],
  property_request: [
    ["propertyType", "propertyRequest.propertyTypeLabel", "propertyRequest.propertyTypes"],
    ["city", "propertyRequest.cityLabel", null],
    ["district", "propertyRequest.districtLabel", null],
    ["condition", "propertyRequest.conditionLabel", "propertyRequest.conditions"],
    ["budget", "propertyRequest.budgetLabel", "propertyRequest.budgets"],
    ["floor", "propertyRequest.floorLabel", "propertyRequest.floors"]
  ],
  consultation: [
    ["service", "consultancy.form.serviceLabel", "consultancy.form.services"],
    ["projectType", "consultancy.form.projectTypeLabel", "consultancy.form.projectTypes"],
    ["company", "consultancy.form.companyLabel", null],
    ["country", "consultancy.form.countryLabel", null],
    ["location", "consultancy.form.locationLabel", null],
    ["area", "consultancy.form.areaLabel", null]
  ]
};

let activeTab: Tab = "new";
let query = "";
/** A message on a card after an action (e.g. "notes saved"), until the next repaint of it. */
const notices = new Map<string, { text: string; ok: boolean }>();

const tag = () => intlTag();
const sep = () => (listSep());

function formatWhen(iso: string): { day: string; time: string } {
  const ms = Date.parse(iso);
  return {
    day: new Intl.DateTimeFormat(tag(), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: ISTANBUL }).format(ms),
    // 24-hour times: no AM/PM marker to reorder inside Arabic text.
    time: new Intl.DateTimeFormat(tag(), { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ISTANBUL }).format(ms)
  };
}

function tabOf(inquiry: Inquiry): Exclude<Tab, "all"> {
  if (inquiry.status === "new") return "new";
  return inquiry.status === "closed" ? "closed" : "active";
}

/** A label without the form's "required" star. */
const fieldLabel = (key: string) => t(key).replace(/\s*\*$/, "");

/** Known keys get their label; anything unexpected is shown as-is, escaped. */
function optionLabel(group: string | null, value: string): string {
  if (!group) return escapeHtml(value);
  const text = t(`${group}.${value}`);
  return escapeHtml(text === `${group}.${value}` ? value : text);
}

function countryName(iso2: string): string {
  try {
    return new Intl.DisplayNames([getLocale()], { type: "region" }).of(iso2) ?? iso2;
  } catch {
    return iso2;
  }
}

function row(label: string, value: string): string {
  return value ? `<div><dt>${label}</dt><dd>${value}</dd></div>` : "";
}

function projectLinks(slugs: string[]): string {
  return slugs
    .map((slug) =>
      getProjectBySlug(slug) ? `<a href="${link(`/projects/${slug}`)}">${escapeHtml(getProjectContent(slug).name)}</a>` : escapeHtml(slug)
    )
    .join(sep());
}

function detailRows(inquiry: Inquiry): string {
  return DETAIL_FIELDS[inquiry.kind]
    .map(([key, labelKey, group]) => {
      const value = inquiry.details?.[key];
      if (!value) return "";
      return row(fieldLabel(labelKey), key === "country" ? escapeHtml(countryName(value)) : optionLabel(group, value));
    })
    .join("");
}

function renderCard(inquiry: Inquiry): string {
  const when = formatWhen(inquiry.created_at);
  const phoneDigits = inquiry.phone.replace(/[^\d]/g, "");
  const notice = notices.get(inquiry.id);
  const L = (key: string) => t(`adminInquiries.labels.${key}`);
  const language = inquiry.site_locale ? t(`lang.${inquiry.site_locale}`) : "";

  return `
    <article class="booking-card inquiry-card inquiry-card--${inquiry.status}" data-inquiry-id="${escapeHtml(inquiry.id)}">
      <header class="booking-card__head">
        <div class="booking-card__when">
          <p class="inquiry-card__kind inquiry-card__kind--${inquiry.kind}">${t(`adminInquiries.kinds.${inquiry.kind}`)}</p>
          <p class="inquiry-card__received">${escapeHtml(when.day)} · <span dir="ltr">${escapeHtml(when.time)}</span></p>
        </div>
        <div class="booking-card__meta">
          <span class="booking-status inquiry-status--${inquiry.status}">${t(`adminInquiries.status.${inquiry.status}`)}</span>
          <span class="booking-card__ref" dir="ltr">${escapeHtml(inquiry.reference)}</span>
        </div>
      </header>
      <p class="booking-card__name" dir="auto">${escapeHtml(inquiry.name)}</p>
      <dl class="booking-card__details">
        ${row(
          L("phone"),
          `<a href="tel:+${phoneDigits}" dir="ltr">${escapeHtml(inquiry.phone)}</a> · <a href="https://wa.me/${phoneDigits}" target="_blank" rel="noopener">${t("adminBookings.whatsapp")}</a>`
        )}
        ${row(L("email"), `<a href="mailto:${escapeHtml(inquiry.email)}" dir="ltr">${escapeHtml(inquiry.email)}</a>`)}
        ${row(L("projects"), projectLinks(inquiry.projects ?? []))}
        ${row(L("interests"), (inquiry.interests ?? []).map((k) => optionLabel("contact.topics", `${k}.label`)).join(sep()))}
        ${detailRows(inquiry)}
        ${row(L("subject"), inquiry.subject ? `<bdi>${escapeHtml(inquiry.subject)}</bdi>` : "")}
        ${row(L("siteLanguage"), escapeHtml(language === `lang.${inquiry.site_locale}` ? (inquiry.site_locale ?? "") : language))}
        ${row(L("source"), inquiry.source ? `<span dir="ltr">${escapeHtml(inquiry.source)}</span>` : "")}
        ${row(L("page"), inquiry.page ? `<span dir="ltr">${escapeHtml(inquiry.page)}</span>` : "")}
      </dl>
      ${inquiry.message ? `<p class="inquiry-card__message" dir="auto">${escapeHtml(inquiry.message)}</p>` : ""}
      <div class="inquiry-card__controls">
        <label class="inquiry-card__field">
          <span>${t("adminInquiries.statusLabel")}</span>
          <select data-inquiry-status>
            ${STATUSES.map((s) => `<option value="${s}"${s === inquiry.status ? " selected" : ""}>${t(`adminInquiries.status.${s}`)}</option>`).join("")}
          </select>
        </label>
        <label class="inquiry-card__field inquiry-card__field--notes">
          <span>${t("adminInquiries.notesLabel")}</span>
          <textarea rows="2" dir="auto" data-inquiry-notes placeholder="${t("adminInquiries.notesPlaceholder")}">${escapeHtml(inquiry.notes ?? "")}</textarea>
        </label>
      </div>
      <p class="booking-card__error${notice?.ok ? " booking-card__error--ok" : ""}" role="alert" data-inquiry-notice>${notice ? escapeHtml(notice.text) : ""}</p>
      <div class="booking-card__actions">
        <button type="button" class="btn btn--outline btn--small" data-inquiry-save-notes>${t("adminInquiries.saveNotes")}</button>
        ${whatsappReplies({
          phone: inquiry.phone,
          name: inquiry.name,
          locale: inquiry.site_locale,
          projects: inquiry.projects,
          topic: inquiry.kind === "property_request" ? "request" : inquiry.kind === "consultation" ? "consultation" : "general"
        })}
        ${customerLink(inquiry.email)}
      </div>
    </article>`;
}

/** Name, email, phone, reference or message containing the search (digits-only for phones). */
function matches(inquiry: Inquiry, search: string): boolean {
  if (!search) return true;
  const needle = search.toLocaleLowerCase();
  const digits = search.replace(/\D/g, "");
  const haystack = [inquiry.name, inquiry.email, inquiry.reference, inquiry.subject ?? "", inquiry.message ?? ""].join(" ").toLocaleLowerCase();
  return haystack.includes(needle) || (digits.length >= 4 && inquiry.phone.replace(/\D/g, "").includes(digits));
}

export function renderAdminInquiries(main: HTMLElement): void {
  if (!requireAdmin(main)) return;
  // ?q=<reference or email> (from the admin home or a customer's history): search all tabs.
  const q = queryParam("q");
  if (q) {
    query = q;
    activeTab = "all";
  }

  main.innerHTML = `
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow eyebrow--on-dark">${t("admin.heroEyebrow")}</p>
        <h1>${t("adminInquiries.heroTitle")}</h1>
        <p class="page-hero__subtitle">${t("adminInquiries.heroSubtitle")}</p>
      </div>
    </section>
    <section class="section admin-bookings admin-inquiries">
      <div class="container">
        ${adminNav("inquiries")}
        <div class="admin-inquiries__bar">
          <div class="admin-bookings__tabs" role="tablist"></div>
          <input type="search" class="admin-inquiries__search" placeholder="${t("adminInquiries.searchPlaceholder")}" aria-label="${t("adminInquiries.searchPlaceholder")}" value="${escapeHtml(query)}" />
        </div>
        <p class="admin-bookings__note" data-inquiries-flash role="status">${t("adminInquiries.note")}</p>
        <div class="admin-bookings__list" aria-live="polite"><p>${t("common.loading")}</p></div>
      </div>
    </section>
  `;

  const requestId = crypto.randomUUID();
  main.dataset.requestId = requestId;
  const tabsEl = main.querySelector<HTMLElement>(".admin-bookings__tabs")!;
  const listEl = main.querySelector<HTMLElement>(".admin-bookings__list")!;
  const flashEl = main.querySelector<HTMLElement>("[data-inquiries-flash]")!;
  const searchEl = main.querySelector<HTMLInputElement>(".admin-inquiries__search")!;
  let inquiries: Inquiry[] = [];

  const paint = () => {
    const found = inquiries.filter((i) => matches(i, query.trim()));
    const groups: Record<Tab, Inquiry[]> = { new: [], active: [], closed: [], all: found };
    for (const i of found) groups[tabOf(i)].push(i);
    tabsEl.innerHTML = TABS.map(
      (tab) => `
      <button type="button" role="tab" class="admin-bookings__tab" data-inquiry-tab="${tab}" aria-selected="${tab === activeTab}">
        ${t(`adminInquiries.tabs.${tab}`)} <span class="admin-bookings__count">${groups[tab].length}</span>
      </button>`
    ).join("");
    const items = groups[activeTab];
    listEl.innerHTML = items.length
      ? items.map(renderCard).join("")
      : `<p class="admin-bookings__empty">${t(query.trim() ? "adminInquiries.noResults" : `adminInquiries.empty.${activeTab}`)}</p>`;
  };

  const flash = (text: string) => {
    flashEl.textContent = text;
    flashEl.classList.add("admin-inquiries__flash");
  };

  fetchInquiries()
    .then((data) => {
      if (main.dataset.requestId !== requestId) return;
      inquiries = data;
      paint();
    })
    .catch((err) => {
      console.error(err);
      if (main.dataset.requestId === requestId) listEl.innerHTML = `<p class="admin-bookings__empty">${t("adminInquiries.loadError")}</p>`;
    });

  tabsEl.addEventListener("click", (e) => {
    const tab = (e.target as Element).closest<HTMLElement>("[data-inquiry-tab]");
    if (!tab) return;
    activeTab = tab.dataset.inquiryTab as Tab;
    notices.clear();
    paint();
    tabsEl.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });

  searchEl.addEventListener("input", () => {
    query = searchEl.value;
    paint();
  });

  const cardOf = (el: Element | null) => {
    const card = el?.closest<HTMLElement>("[data-inquiry-id]");
    const inquiry = inquiries.find((i) => i.id === card?.dataset.inquiryId);
    return card && inquiry ? { card, inquiry } : null;
  };

  const save = async (card: HTMLElement, inquiry: Inquiry, changes: { status?: InquiryStatus; notes?: string | null }) => {
    const controls = card.querySelectorAll<HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>("button, select, textarea");
    controls.forEach((c) => (c.disabled = true));
    const saved = await updateInquiry(inquiry.id, changes);
    controls.forEach((c) => (c.disabled = false));
    if (!saved) {
      const notice = card.querySelector<HTMLElement>("[data-inquiry-notice]");
      if (notice) {
        notice.classList.remove("booking-card__error--ok");
        notice.textContent = t("adminInquiries.saveError");
      }
      return false;
    }
    Object.assign(inquiry, saved);
    return true;
  };

  // A new status saves right away; the card moves to its tab (a line above the list says where).
  listEl.addEventListener("change", async (e) => {
    const select = (e.target as Element).closest<HTMLSelectElement>("[data-inquiry-status]");
    const found = cardOf(select);
    if (!select || !found) return;
    const status = select.value as InquiryStatus;
    // Unsaved notes go along with the status change.
    const notes = found.card.querySelector<HTMLTextAreaElement>("[data-inquiry-notes]")?.value.trim() ?? "";
    const ok = await save(found.card, found.inquiry, { status, notes: notes || null });
    if (!ok) {
      select.value = found.inquiry.status;
      return;
    }
    notices.set(found.inquiry.id, { text: t("adminInquiries.saved"), ok: true });
    if (activeTab !== "all" && tabOf(found.inquiry) !== activeTab) {
      flash(t("adminInquiries.moved", { name: found.inquiry.name, status: t(`adminInquiries.status.${status}`) }));
    }
    paint();
  });

  listEl.addEventListener("click", async (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>("[data-inquiry-save-notes]");
    const found = cardOf(button);
    if (!button || !found) return;
    const notes = found.card.querySelector<HTMLTextAreaElement>("[data-inquiry-notes]")?.value.trim() ?? "";
    if (!(await save(found.card, found.inquiry, { notes: notes || null }))) return;
    notices.set(found.inquiry.id, { text: t("adminInquiries.notesSaved"), ok: true });
    paint();
  });
}
