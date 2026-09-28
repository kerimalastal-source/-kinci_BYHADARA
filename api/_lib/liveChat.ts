// Live chat with the team (supabase/migrations/0011): the Telegram side. Visitor messages
// are posted to the team's chat; a Telegram "reply" to any of them goes back to the visitor
// (api/telegram-webhook.ts). Texts for the team are in Arabic, like the other alerts.
import { createHash } from "node:crypto";
import { escapeHtml } from "./telegram.js";
import { PROJECT_NAMES } from "./projectNames.js";

/** The secret Telegram sends with every webhook call — derived from CRON_SECRET, so no new variable. */
export function webhookSecret(): string | null {
  const secret = process.env.CRON_SECRET ?? "";
  return secret.length >= 32 ? createHash("sha256").update(`${secret}:telegram-webhook`).digest("hex").slice(0, 48) : null;
}

const LANGUAGE_AR: Record<string, string> = { en: "الإنجليزية", ar: "العربية", fa: "الفارسية", fr: "الفرنسية", ru: "الروسية" };

export interface ChatContext {
  reference: string;
  name: string | null;
  contact: string | null;
  locale: string | null;
  page: string | null;
  country: string | null;
  city: string | null;
  campaign: string | null;
}

function where(c: ChatContext): string {
  let country = c.country ?? "";
  try {
    if (c.country) country = new Intl.DisplayNames(["ar"], { type: "region" }).of(c.country) ?? c.country;
  } catch {
    /* keep the code */
  }
  return [c.city, country].filter(Boolean).join("، ") || "غير معروف";
}

/** "لوتس يالي" for a /projects/<slug> page, or null. */
function pageProject(page: string | null): string | null {
  const slug = page?.match(/\/projects\/([a-z0-9-]+)/)?.[1];
  return slug ? (PROJECT_NAMES[slug]?.ar ?? null) : null;
}

const quote = (body: string) => `«${escapeHtml(body.length > 1500 ? `${body.slice(0, 1500)}…` : body)}»`;
/** U+200E keeps Latin paths and numbers left-to-right in the Arabic message. */
const ltr = (value: string) => `‎${escapeHtml(value)}`;

/** The first message of a new conversation, with who and where the visitor is. */
export function newChatMessage(c: ChatContext, body: string, site: string): string {
  const project = pageProject(c.page);
  const lines = [
    `<b>💬 حضارة للعقار — محادثة مباشرة جديدة</b> · ${ltr(c.reference)}`,
    `📍 ${escapeHtml(where(c))} · 🌐 ${escapeHtml(LANGUAGE_AR[c.locale ?? ""] ?? c.locale ?? "—")}`
  ];
  if (c.page) lines.push(`📄 ${ltr(c.page)}${project ? ` (${escapeHtml(project)})` : ""}`);
  if (c.campaign) lines.push(`📣 الإعلان: ${ltr(c.campaign)}`);
  if (c.name || c.contact) lines.push(`👤 ${escapeHtml(c.name ?? "")}${c.contact ? ` · ${ltr(c.contact)}` : ""}`);
  lines.push("", quote(body), "", `↩️ <i>ردّ على هذه الرسالة (Reply) ليصل ردّك إلى الزائر فوراً — بلغته إن أمكن.</i>`);
  lines.push(`<a href="${escapeHtml(`${site}/ar/admin/chats`)}">المحادثات في لوحة التحكم</a>`);
  return lines.join("\n");
}

/** A later message in the same conversation (sent as a reply to the first one); new contact details are shown once. */
export function nextChatMessage(c: ChatContext, body: string, newDetails: boolean): string {
  const parts = [ltr(c.reference)];
  if (c.name) parts.push(escapeHtml(c.name));
  if (newDetails && c.contact) parts.push(`👤 ${ltr(c.contact)}`);
  return `💬 ${parts.join(" · ")}\n${quote(body)}`;
}
