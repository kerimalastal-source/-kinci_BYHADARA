// Telegram alerts for Meta lead-form ads (Instant Forms filled in inside Facebook/Instagram,
// e.g. the Marmara Haven villa campaign). Those visitors never open our site, so the site asks
// Meta for new leads instead: api/track.ts checks every minute or so while the site has
// visitors, and the morning job checks once more. Each lead is announced once: a marker file
// in Vercel Blob is claimed first (put without overwrite), so two checks at the same moment
// can't both send it, and a lead whose Telegram message failed is released for the next check.
// Since 2026-11-12 each new lead is also saved as a customer (inquiry HF-XXXXXX + a pipeline row)
// through save_meta_lead() (migration 0038), so it shows on /admin/customers and /admin/pipeline.
// Needs META_LEADS_TOKEN (a system-user token with leads_retrieval); without it nothing runs.
import { escapeHtml } from "./telegram.js";
import { ISTANBUL } from "./bookingMessages.js";

const GRAPH = "https://graph.facebook.com/v21.0";
/**
 * The villa lead forms (Arabic/English and Russian), unless META_LEAD_FORM_IDS lists others:
 * the lighter v2 forms (2026-10-16) first, then the first ones while their ads still run.
 */
export const DEFAULT_FORMS = ["1475106064461512", "3428892427410306", "2435699266837249", "1348770123836883"];
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
  /** Saves the lead as a customer; returns its reference, or null when it could not (logged). */
  save?: (lead: SavedLead) => Promise<string | null>;
  now: () => number;
}

/** What is saved for one lead (migration 0038, save_meta_lead()). */
export interface SavedLead {
  id: string;
  name: string;
  phone: string;
  email: string;
  form: string;
  ad: string;
  platform: string;
  /** The form's other answers, one "question: answer" line each. */
  message: string;
  /** Project slug the form is about (the villa forms), or "". */
  project: string;
  /** The ad source, as the customers page and the ad report read it. */
  source: string;
  created: string | null;
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

/** The villa forms are about Marmara Haven; their leads count for the villa lead-form campaign. */
const VILLA_FORM = /marmara|villa/i;

/** The lead's fields and answers in the shape save_meta_lead() takes. */
export function savedLead(lead: Lead, form: Form): SavedLead {
  const fields = new Map((lead.field_data ?? []).map((f) => [f.name, (f.values ?? []).join(", ")]));
  const answers: string[] = [];
  for (const [key, value] of fields) {
    if (key in STANDARD || !value) continue;
    const question = form.questions.find((q) => q.key === key);
    const answer = question?.options.find((o) => o.key === value)?.value ?? value;
    answers.push(`${question?.label ?? key.replace(/_/g, " ")}: ${answer}`);
  }
  const villa = VILLA_FORM.test(form.name);
  const time = leadTime(lead.created_time);
  return {
    id: lead.id,
    name: (fields.get("full_name") ?? "").slice(0, 200),
    phone: (fields.get("phone_number") ?? "").slice(0, 40),
    email: (fields.get("email") ?? "").slice(0, 254),
    form: form.name.slice(0, 200),
    ad: (lead.ad_name ?? "").slice(0, 300),
    platform: lead.platform === "ig" ? "instagram" : lead.platform === "fb" ? "facebook" : "",
    message: [`نموذج الإعلان: ${form.name}`, ...answers].join("\n").slice(0, 5000),
    project: villa ? "marmara-haven-villa" : "",
    source: `utm_source=facebook · utm_campaign=${villa ? "villa-leads" : "lead-form"}`,
    created: time === null ? null : new Date(time).toISOString()
  };
}

/** The Telegram message for one lead (all values escaped); `reference` = its saved customer record. */
export function leadMessage(lead: Lead, form: Form, pageId: string, reference?: string | null): string {
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
  if (reference) {
    lines.push(`🗂️ حُفظ في سجل الزبائن: <a href="https://www.hadararealestate.com/ar/admin/customers?q=${encodeURIComponent(reference)}">${escapeHtml(reference)}</a>`);
  }
  lines.push(`<a href="https://business.facebook.com/latest/leads_center?asset_id=${encodeURIComponent(pageId)}">كل الطلبات في Meta</a>`);
  return lines.join("\n");
}

/** Today's date in Istanbul, for the once-a-day warning marker. */
const istanbulDay = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: ISTANBUL }).format(ms);

/** What one check found for one form (the admin "check now" button shows it). */
export interface FormReport {
  id: string;
  name: string;
  /** Leads of the last two days Meta returned. */
  found: number;
  /** Announced on Telegram by this check. */
  sent: number;
  /** Announced by an earlier check. */
  already: number;
  /** Their Telegram message failed (retried by the next check). */
  failed: number;
  error?: string;
}

export interface LeadReport {
  /** Whether the page token was read (otherwise the system user's own token was used). */
  pageToken: boolean;
  forms: FormReport[];
  sent: number;
}

/** Announces the new leads of every form and reports what each form returned. */
export async function inspectLeads(deps: LeadDeps): Promise<LeadReport> {
  const page = await graph(deps, deps.pageId, { fields: "access_token" }, deps.token).catch(() => ({}) as Record<string, unknown>);
  const pageToken = typeof page.access_token === "string" && page.access_token ? page.access_token : "";
  const token = pageToken || deps.token;
  const since = Math.floor(deps.now() / 1000) - LOOKBACK_SECONDS;
  const report: LeadReport = { pageToken: Boolean(pageToken), forms: [], sent: 0 };
  let graphError: GraphError | null = null;
  // One form failing (an archived form, a Blob hiccup) must not hide the leads of the others.
  for (const id of deps.forms) {
    const result: FormReport = { id, name: id, found: 0, sent: 0, already: 0, failed: 0 };
    report.forms.push(result);
    try {
      const form = await readForm(deps, id, token);
      result.name = form.name;
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
      result.found = leads.length;
      // Oldest first, so the chat reads in order.
      leads.sort((a, b) => (leadTime(a.created_time) ?? 0) - (leadTime(b.created_time) ?? 0));
      for (const lead of leads) {
        const marker = `meta-leads/${lead.id}.sent`;
        if (!(await deps.store.claim(marker))) {
          result.already++;
          continue;
        }
        // Saved first (the same lead id is saved once, so a retried check is harmless), then announced.
        const reference = deps.save ? await deps.save(savedLead(lead, form)).catch(() => null) : null;
        if (await deps.telegram(leadMessage(lead, form, deps.pageId, reference))) result.sent++;
        else {
          result.failed++;
          await deps.store.remove(marker).catch(() => undefined);
        }
      }
    } catch (error) {
      result.error = (error instanceof Error ? error.message : "unknown error").slice(0, 300);
      console.error(`meta-leads: form ${id}: ${result.error}`);
      if (error instanceof GraphError) graphError ??= error;
    }
    report.sent += result.sent;
  }
  // Usually a token without leads_retrieval: say so on Telegram once a day.
  if (graphError && (await deps.store.claim(`meta-leads/warning-${istanbulDay(deps.now())}`).catch(() => false))) {
    await deps.telegram(`<b>⚠️ تعذّر قراءة طلبات نماذج الإعلانات من Meta</b>\n${escapeHtml(graphError.message)}\nالطلبات محفوظة في Meta Business Suite، ولن تصل إلى تيليجرام حتى يُحلّ الخطأ.`);
  }
  return report;
}

/** Announces the new leads of every form; returns how many were sent. */
export async function checkLeads(deps: LeadDeps): Promise<number> {
  return (await inspectLeads(deps)).sent;
}
