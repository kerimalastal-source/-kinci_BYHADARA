// WhatsApp Business (Cloud API) webhook: every message a customer sends to our business number
// becomes part of their customer record. A first message from a new number opens a customer
// (inquiry HW-XXXXXX, status "new", a pipeline row) with the ad that brought them, when they
// came from a click-to-WhatsApp ad (Meta adds a "referral" to that first message), and the
// team gets a Telegram alert. Every message is also written to the customer's activity log.
// The saving is save_whatsapp_message() (supabase/migrations/0039), called with the cron secret.
//
// Meta signs each call with the app secret (X-Hub-Signature-256 = HMAC-SHA256 of the raw body);
// calls without a valid signature are refused. Settings (Vercel, Production):
//   WHATSAPP_APP_SECRET      the Meta app's App Secret (required to accept messages)
//   WHATSAPP_VERIFY_TOKEN    any long random text, the same one typed in Meta's webhook settings
//   WHATSAPP_PHONE_NUMBER_ID optional: only messages to this business number are saved
import { createHmac, timingSafeEqual } from "node:crypto";
import { escapeHtml } from "./telegram.js";
import { ISTANBUL } from "./bookingMessages.js";
import { adCampaign } from "./whatsappAds.js";
import { STAGE_AR } from "./followups.js";

/** One message as the server keeps it. */
export interface WaMessage {
  id: string;
  /** The sender's number, digits only (WhatsApp's wa_id). */
  waId: string;
  name: string;
  /** Milliseconds. */
  at: number;
  /** The text, or a short label for a photo, voice note, location… */
  text: string;
  ad: { id: string; headline: string } | null;
}

interface RawMessage {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { caption?: string; filename?: string };
  referral?: { source_type?: string; source_id?: string; headline?: string; body?: string };
}

const MEDIA: Record<string, string> = {
  image: "صورة",
  video: "فيديو",
  audio: "رسالة صوتية",
  voice: "رسالة صوتية",
  document: "ملف",
  sticker: "ملصق",
  location: "موقع",
  contacts: "جهة اتصال",
  reaction: "تفاعل"
};

function messageText(m: RawMessage): string {
  const caption = m.image?.caption ?? m.video?.caption ?? m.document?.caption ?? "";
  const text =
    m.text?.body ??
    m.button?.text ??
    m.interactive?.button_reply?.title ??
    m.interactive?.list_reply?.title ??
    "";
  if (text) return text.trim();
  const label = MEDIA[m.type ?? ""] ?? "رسالة";
  return caption ? `[${label}] ${caption.trim()}` : `[${label}]`;
}

/** The customer messages in one webhook call (statuses, echoes and other numbers are left out). */
export function parseWebhook(body: unknown, phoneNumberId?: string): WaMessage[] {
  const out: WaMessage[] = [];
  const entries = (body as { object?: string; entry?: unknown[] } | null)?.entry;
  if ((body as { object?: string } | null)?.object !== "whatsapp_business_account" || !Array.isArray(entries)) return out;
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes as { field?: string; value?: Record<string, unknown> }[]) {
      if (change.field !== "messages" || !change.value) continue;
      const value = change.value as {
        metadata?: { phone_number_id?: string };
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: RawMessage[];
      };
      if (phoneNumberId && value.metadata?.phone_number_id !== phoneNumberId) continue;
      const names = new Map((value.contacts ?? []).map((c) => [c.wa_id ?? "", c.profile?.name ?? ""]));
      for (const m of value.messages ?? []) {
        if (!m.id || !m.from || !/^\d{6,20}$/.test(m.from)) continue;
        const seconds = Number(m.timestamp);
        const referral = m.referral?.source_type === "ad" && m.referral.source_id ? m.referral : null;
        out.push({
          id: m.id.slice(0, 300),
          waId: m.from,
          name: (names.get(m.from) ?? "").trim().slice(0, 200),
          at: Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : Date.now(),
          text: messageText(m).slice(0, 1900),
          ad: referral ? { id: String(referral.source_id).slice(0, 40), headline: (referral.headline ?? referral.body ?? "").trim().slice(0, 200) } : null
        });
      }
    }
  }
  return out;
}

/** Whether X-Hub-Signature-256 is Meta's signature of this exact body with our app secret. */
export function validSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=") || !appSecret) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const given = Buffer.from(header.slice(7), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The ad source as the customers page and the ad report read it. */
export function messageSource(ad: WaMessage["ad"]): string {
  if (!ad) return "utm_source=whatsapp";
  return `utm_source=facebook · utm_campaign=${adCampaign(ad.id)}`;
}

export interface SaveResult {
  reference?: string;
  /** A new customer was opened by this message. */
  created?: boolean;
  /** First WhatsApp message today from a customer already in our records (migration 0040). */
  returning?: boolean;
  /** Their previous WhatsApp message (ISO), or null. */
  last_at?: string | null;
  /** The name in our records and the pipeline stage (migration 0040). */
  name?: string;
  stage?: string | null;
  duplicate?: boolean;
  error?: string;
}

export interface WaDeps {
  save: (args: Record<string, unknown>) => Promise<SaveResult | null>;
  telegram: (html: string) => Promise<boolean>;
  secret: string;
}

const clock = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ISTANBUL }).format(ms);

/** The Telegram alert for a new customer's first message (all values escaped). */
export function newCustomerAlert(m: WaMessage, reference: string): string {
  const lines = [
    `<b>💬 حضارة للعقار — محادثة واتساب جديدة</b>`,
    "",
    `👤 <b>${escapeHtml(m.name || "—")}</b>`,
    `📞 ‎+${escapeHtml(m.waId)} · <a href="https://wa.me/${m.waId}">واتساب</a>`
  ];
  if (m.ad) {
    const campaign = adCampaign(m.ad.id);
    lines.push(`📣 من إعلان: ${escapeHtml(m.ad.headline || m.ad.id)}${campaign.startsWith("ctwa-") ? "" : ` (${escapeHtml(campaign)})`}`);
  } else {
    lines.push(`📣 بدون إعلان (تواصل مباشر)`);
  }
  lines.push("", `✉️ ${escapeHtml(m.text.length > 500 ? `${m.text.slice(0, 500)}…` : m.text)}`, "");
  lines.push(`🕒 ‎${clock(m.at)} (توقيت إسطنبول)`);
  lines.push(`🗂️ حُفظ في سجل الزبائن: <a href="https://www.hadararealestate.com/ar/admin/customers?q=${encodeURIComponent(reference)}">${escapeHtml(reference)}</a>`);
  return lines.join("\n");
}

const istanbulDay = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: ISTANBUL }).format(ms);

/** "أمس", "قبل يومين", "قبل 5 أيام", "قبل 12 يوماً" between two moments, in Istanbul days. */
export function daysAgo(fromMs: number, toMs: number): string {
  const days = Math.round((Date.parse(istanbulDay(toMs)) - Date.parse(istanbulDay(fromMs))) / 86_400_000);
  if (days <= 0) return "اليوم";
  if (days === 1) return "أمس";
  if (days === 2) return "قبل يومين";
  if (days <= 10) return `قبل ${days} أيام`;
  return `قبل ${days} يوماً`;
}

/** The Telegram alert when a customer already in our records writes again (all values escaped). */
export function returningAlert(m: WaMessage, r: SaveResult): string {
  const stage = r.stage ? STAGE_AR[r.stage] ?? r.stage : "";
  const lines = [
    `<b>💬 حضارة للعقار — زبون رجع كتب على واتساب</b>`,
    "",
    `👤 <b>${escapeHtml(r.name || m.name || "—")}</b>${stage ? ` · ${escapeHtml(stage)}` : ""}`,
    `📞 ‎+${escapeHtml(m.waId)} · <a href="https://wa.me/${m.waId}">واتساب</a>`
  ];
  const last = r.last_at ? Date.parse(r.last_at) : NaN;
  lines.push(
    Number.isFinite(last)
      ? `🕓 آخر رسالة واتساب منه: ‎${clock(last)} (${daysAgo(last, m.at)})`
      : `🕓 أول رسالة واتساب منه (مسجّل عندنا من قبل)`
  );
  if (m.ad) lines.push(`📣 من إعلان: ${escapeHtml(m.ad.headline || m.ad.id)}`);
  lines.push("", `✉️ ${escapeHtml(m.text.length > 500 ? `${m.text.slice(0, 500)}…` : m.text)}`, "");
  lines.push(`🕒 ‎${clock(m.at)} (توقيت إسطنبول)`);
  if (r.reference) {
    lines.push(`🗂️ سجل الزبون: <a href="https://www.hadararealestate.com/ar/admin/customers?q=${encodeURIComponent(r.reference)}">${escapeHtml(r.reference)}</a>`);
  }
  return lines.join("\n");
}

/** Saves each message (oldest first) and announces new customers, and customers who write
 *  again (once a day each). Returns how many were saved. */
export async function handleMessages(messages: WaMessage[], deps: WaDeps): Promise<number> {
  let saved = 0;
  for (const m of [...messages].sort((a, b) => a.at - b.at)) {
    const result = await deps
      .save({
        p_secret: deps.secret,
        p_message_id: m.id,
        p_wa_id: m.waId,
        p_name: m.name,
        p_first: m.text,
        p_activity: `رسالة من الزبون: ${m.text}`,
        p_ad_id: m.ad?.id ?? "",
        p_ad_headline: m.ad?.headline ?? "",
        p_source: messageSource(m.ad),
        p_at: new Date(m.at).toISOString()
      })
      .catch((error: unknown) => {
        console.error(`whatsapp: ${error instanceof Error ? error.message : error}`);
        return null;
      });
    if (!result || result.error) {
      if (result?.error) console.error(`whatsapp: save refused ${m.id}: ${result.error}`);
      continue;
    }
    if (result.duplicate) continue;
    saved++;
    if (result.created && result.reference) await deps.telegram(newCustomerAlert(m, result.reference));
    else if (result.returning) await deps.telegram(returningAlert(m, result));
  }
  return saved;
}
