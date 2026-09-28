import { t, link, intlTag } from "../../i18n";
import { lookup, isLocale, type Locale } from "../../i18n/dictionaries";
import { escapeHtml } from "../../utils/html";
import { WHATSAPP_ICON } from "../../components/floatingButtons";

/**
 * Ready-made WhatsApp replies on the admin cards (inquiries and tour bookings): each opens
 * WhatsApp with a message already written in the customer's own language (the language they
 * used on the site), with their name and what they asked about. The team only presses send.
 * The texts are in each dictionary under whatsappTemplates.*.
 */

type TemplateKey = "welcome" | "call" | "info" | "followup" | "tour";

export interface ReplyContext {
  phone: string;
  name: string;
  /** The customer's site language (the templates' language). */
  locale: string | null;
  /** Project slugs they asked about. */
  projects?: string[];
  /** What the inquiry was, when there's no project: "request" | "consultation" | "general". */
  topic?: "request" | "consultation" | "general";
  /** A tour booking: its start time and call app. */
  tour?: { slot: string; app: string };
}

const text = (locale: Locale, key: string) => String(lookup(locale, key) ?? lookup("en", key) ?? "");
const fill = (template: string, vars: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");

/** What the message is about, in the customer's language. */
function topicText(locale: Locale, c: ReplyContext): string {
  if (c.tour) return text(locale, "whatsappTemplates.topics.tour");
  const names = (c.projects ?? []).map((slug) => String(lookup(locale, `projectsData.${slug}.name`) ?? slug));
  if (names.length) {
    const ListFormat = (Intl as unknown as { ListFormat?: new (locale: string, options: object) => { format(list: string[]): string } }).ListFormat;
    const joined = ListFormat ? new ListFormat(locale, { type: "conjunction" }).format(names) : names.join(", ");
    return fill(text(locale, names.length > 1 ? "whatsappTemplates.topics.projects" : "whatsappTemplates.topics.project"), { names: joined });
  }
  return text(locale, `whatsappTemplates.topics.${c.topic ?? "general"}`);
}

function tourWhen(locale: Locale, slot: string): string {
  return new Intl.DateTimeFormat(intlTag(locale as Locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Istanbul"
  }).format(Date.parse(slot));
}

/** "Ready reply on WhatsApp ▾" with one link per template. */
export function whatsappReplies(c: ReplyContext): string {
  const digits = c.phone.replace(/[^\d]/g, "");
  if (digits.length < 6) return "";
  const locale: Locale = isLocale(c.locale) ? c.locale : "en";
  const firstName = c.name.trim().split(/\s+/)[0] ?? c.name;
  const vars: Record<string, string> = {
    name: firstName,
    topic: topicText(locale, c),
    when: c.tour ? tourWhen(locale, c.tour.slot) : "",
    app: c.tour ? text(locale, `videoTour.wizard.apps.${c.tour.app}`) : ""
  };
  const keys: TemplateKey[] = c.tour ? ["tour", "call", "followup"] : ["welcome", "call", "info", "followup"];
  const items = keys
    .map((key) => {
      const message = fill(text(locale, `whatsappTemplates.${key}`), vars);
      const href = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
      return `<li><a href="${escapeHtml(href)}" target="_blank" rel="noopener" title="${escapeHtml(message)}">
        <strong>${t(`adminReplies.labels.${key}`)}</strong>
        <span lang="${locale}" dir="auto">${escapeHtml(message)}</span>
      </a></li>`;
    })
    .join("");
  return `<details class="wa-replies">
    <summary class="btn btn--outline btn--small wa-replies__toggle">${WHATSAPP_ICON}<span>${t("adminReplies.button")}</span></summary>
    <div class="wa-replies__menu">
      <p class="wa-replies__note">${t("adminReplies.language", { language: t(`lang.${locale}`) })}</p>
      <ul>${items}</ul>
    </div>
  </details>`;
}

/** "Customer history" link to the customers page, searching this email. */
export function customerLink(email: string): string {
  return `<a class="btn btn--outline btn--small" href="${link(`/admin/customers?q=${encodeURIComponent(email)}`)}">${t("adminReplies.history")}</a>`;
}
