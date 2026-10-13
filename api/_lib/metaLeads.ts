// Telegram alerts for Meta lead-form ads (Instant Forms filled in inside Facebook/Instagram,
// e.g. the Marmara Haven villa campaign). Those visitors never open our site, so the site asks
// Meta for new leads instead: api/track.ts checks every minute or so while the site has
// visitors, and the morning job checks once more. Each lead is announced once: a marker file
// in Vercel Blob is claimed first (put without overwrite), so two checks at the same moment
// can't both send it, and a lead whose Telegram message failed is released for the next check.
// The lead itself (name, phone, answers) is only passed on to Telegram, never stored here.
// Needs META_LEADS_TOKEN (a system-user token with leads_retrieval); without it nothing runs.
import { escapeHtml } from "./telegram.js";
import { ISTANBUL } from "./bookingMessages.js";

const GRAPH = "https://graph.facebook.com/v21.0";
/** The villa lead forms (Arabic/English and Russian), unless META_LEAD_FORM_IDS lists others. */
export const DEFAULT_FORMS = ["2435699266837249", "1348770123836883"];
/** Leads older than this are never announced (the first check after setup, or a long gap). */
const LOOKBACK_SECONDS = 2 * 24 * 3600;

export interface LeadStore {
  /** Creates the marker; false when it already exists (the lead was announced). */
  claim(path: string): Promise<boolean>;
  remove(path: string): Promise<void>;
}

export interface LeadDeps {
  fetch: typeof fetch;
  token: string;
  pageId: string;
  forms: string[];
  store: LeadStore;
  telegram: (html: string) => Promise<boolean>;
  now: () => number;
}

interface Question {
  key: string;
  label: string;
  options: { key: string; value: string }[];
}

interface Form {
  name: string;
  questions: Question[];
}

export interface Lead {
  id: string;
  created_time?: string;
  field_data?: { name: string; values?: string[] }[];
  ad_name?: string;
  platform?: string;
}

class GraphError extends Error {}

async function graph(deps: LeadDeps, path: string, params: Record<string, string>, token: string): Promise<Record<string, unknown>> {
  const query = new URLSearchParams({ ...params, access_token: token });
  const response = await deps.fetch(`${GRAPH}/${path}?${query}`, { signal: AbortSignal.timeout(10_000) });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || data.error) {
    const error = (data.error ?? {}) as { message?: string; code?: number };
    // Meta's message (e.g. a missing permission); never the token.
    throw new GraphError(`${error.code ?? response.status}: ${(error.message ?? "request failed").slice(0, 200)}`);
  }
  return data;
}

/** Form names and questions rarely change: read once per server instance and hour. */
const formCache = new Map<string, { form: Form; at: number }>();

async function readForm(deps: LeadDeps, id: string, token: string): Promise<Form> {
  const cached = formCache.get(id);
  if (cached && deps.now() - cached.at < 3600_000) return cached.form;
  const data = await graph(deps, id, { fields: "name,questions{key,label,options{key,value}}" }, token);
  const questions = Array.isArray(data.questions) ? (data.questions as Question[]) : [];
  const form: Form = {
    name: typeof data.name === "string" ? data.name : id,
    questions: questions.map((q) => ({ key: q.key, label: q.label ?? q.key, options: Array.isArray(q.options) ? q.options : [] }))
  };
  formCache.set(id, { form, at: deps.now() });
  return form;
}

/** "2026-10-14T01:23:45+0000" (Meta's format) → milliseconds. */
export function leadTime(value: string | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(time) ? null : time;
}

const STANDARD: Record<string, string> = { full_name: "👤", phone_number: "📞", email: "✉️" };

/** The Telegram message for one lead (all values escaped). */
export function leadMessage(lead: Lead, form: Form, pageId: string): string {
  const fields = new Map((lead.field_data ?? []).map((f) => [f.name, (f.values ?? []).join(", ")]));
  const name = fields.get("full_name") || "—";
  const phone = fields.get("phone_number") ?? "";
  const email = fields.get("email") ?? "";
  const lines = [`<b>📝 حضارة للعقار — طلب جديد من نموذج إعلان</b>`, `📋 ${escapeHtml(form.name)}`, "", `👤 <b>${escapeHtml(name)}</b>`];
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    // U+200E keeps the number left-to-right inside the Arabic message.
    lines.push(`📞 ‎${escapeHtml(phone)}${digits.length >= 8 ? ` · <a href="https://wa.me/${digits}">واتساب</a>` : ""}`);
  }
  if (email) lines.push(`✉️ ${escapeHtml(email)}`);
  for (const [key, value] of fields) {
    if (key in STANDARD || !value) continue;
    const question = form.questions.find((q) => q.key === key);
    const answer = question?.options.find((o) => o.key === value)?.value ?? value;
    lines.push("", `❓ ${escapeHtml(question?.label ?? key.replace(/_/g, " "))}`, `➜ <b>${escapeHtml(answer)}</b>`);
  }
  lines.push("");
  const source = lead.platform === "ig" ? "إنستغرام" : lead.platform === "fb" ? "فيسبوك" : "";
  if (lead.ad_name || source) lines.push(`📣 ${[lead.ad_name && escapeHtml(lead.ad_name), source].filter(Boolean).join(" · ")}`);
  const time = leadTime(lead.created_time);
  if (time !== null) {
    const clock = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ISTANBUL }).format(time);
    lines.push(`🕒 ‎${clock} (توقيت إسطنبول)`);
  }
  lines.push(`⚡ اتصلوا به في أسرع وقت، ويفضّل خلال ساعة.`);
  lines.push(`<a href="https://business.facebook.com/latest/leads_center?asset_id=${encodeURIComponent(pageId)}">كل الطلبات في Meta</a>`);
  return lines.join("\n");
}

/** Today's date in Istanbul, for the once-a-day warning marker. */
const istanbulDay = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: ISTANBUL }).format(ms);

/** Announces the new leads of every form; returns how many were sent. */
export async function checkLeads(deps: LeadDeps): Promise<number> {
  let sent = 0;
  try {
    const page = await graph(deps, deps.pageId, { fields: "access_token" }, deps.token).catch(() => ({}) as Record<string, unknown>);
    const token = typeof page.access_token === "string" && page.access_token ? page.access_token : deps.token;
    const since = Math.floor(deps.now() / 1000) - LOOKBACK_SECONDS;
    for (const id of deps.forms) {
      const form = await readForm(deps, id, token);
      const data = await graph(
        deps,
        `${id}/leads`,
        {
          fields: "id,created_time,field_data,ad_name,platform",
          limit: "25",
          filtering: JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: since }])
        },
        token
      );
      const leads = (Array.isArray(data.data) ? (data.data as Lead[]) : []).filter((lead) => typeof lead.id === "string");
      // Oldest first, so the chat reads in order.
      leads.sort((a, b) => (leadTime(a.created_time) ?? 0) - (leadTime(b.created_time) ?? 0));
      for (const lead of leads) {
        const marker = `meta-leads/${lead.id}.sent`;
        if (!(await deps.store.claim(marker))) continue;
        if (await deps.telegram(leadMessage(lead, form, deps.pageId))) sent++;
        else await deps.store.remove(marker).catch(() => undefined);
      }
    }
  } catch (error) {
    if (!(error instanceof GraphError)) throw error;
    // Usually a token without leads_retrieval: say so on Telegram once a day.
    console.error(`meta-leads: ${error.message}`);
    if (await deps.store.claim(`meta-leads/warning-${istanbulDay(deps.now())}`).catch(() => false)) {
      await deps.telegram(`<b>⚠️ تعذّر قراءة طلبات نماذج الإعلانات من Meta</b>\n${escapeHtml(error.message)}\nالطلبات محفوظة في Meta Business Suite، ولن تصل إلى تيليجرام حتى يُحلّ الخطأ.`);
    }
  }
  return sent;
}
