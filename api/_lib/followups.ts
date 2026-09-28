// Sales follow-up reminders on Telegram (the pipeline, supabase/migrations/0010).
// A follow-up set on a customer's record is announced once when its time comes: from
// page views (api/track.ts, at most every two minutes) and from the daily job.
import { escapeHtml, sendTelegram } from "./telegram.js";
import { hasSupabase, rpc, RpcError } from "./supabase.js";
import { ISTANBUL } from "./bookingMessages.js";
import { PROJECT_NAMES } from "./projectNames.js";

export const STAGE_AR: Record<string, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  tour: "جولة فيديو",
  visit: "زيارة إسطنبول",
  negotiation: "تفاوض",
  won: "تم البيع",
  lost: "خسرناه"
};

/** A row from claim_due_followups() / followups_today(). */
export interface FollowUp {
  id?: string;
  name: string;
  email: string | null;
  phone: string | null;
  stage: string;
  project: string | null;
  follow_up_at: string;
  follow_up_note: string | null;
}

/** "15:30" in Istanbul. */
export const followUpTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ISTANBUL }).format(Date.parse(iso));

/** The customer's record in the admin (searched by phone, else email). */
export const recordUrl = (site: string, f: Pick<FollowUp, "phone" | "email" | "name">) =>
  `${site}/ar/admin/customers?q=${encodeURIComponent(f.phone ?? f.email ?? f.name)}`;

export function followUpMessage(f: FollowUp, site: string): string {
  const lines = [
    `<b>⏰ تذكير متابعة — حضارة للعقار</b>`,
    `👤 <b>${escapeHtml(f.name || "—")}</b> · ${escapeHtml(STAGE_AR[f.stage] ?? f.stage)}`,
    `🕒 الموعد: ${followUpTime(f.follow_up_at)}`
  ];
  if (f.follow_up_note) lines.push(`📝 ${escapeHtml(f.follow_up_note)}`);
  if (f.project) lines.push(`🏠 ${escapeHtml(PROJECT_NAMES[f.project]?.ar ?? f.project)}`);
  // U+200E keeps the number left-to-right inside the Arabic message.
  if (f.phone) lines.push(`📞 ‎${escapeHtml(f.phone)}`);
  if (f.email) lines.push(`✉️ ${escapeHtml(f.email)}`);
  lines.push(`<a href="${escapeHtml(recordUrl(site, f))}">سجل الزبون</a>`);
  return lines.join("\n");
}

/**
 * Sends the follow-ups that are due (each once; a failed one is put back for the next run).
 * minGapSeconds > 0 lets the database skip the check if it ran that recently.
 */
export async function sendDueFollowUps(site: string, minGapSeconds: number): Promise<number> {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 32 || !hasSupabase()) return 0;
  let due: unknown;
  try {
    due = await rpc("claim_due_followups", { p_secret: secret, p_min_gap_seconds: minGapSeconds });
  } catch (error) {
    // Until migration 0010 runs the function doesn't exist.
    if (!(error instanceof RpcError && error.status === 404)) console.error(`followups: ${error instanceof Error ? error.message : "unknown error"}`);
    return 0;
  }
  if (!Array.isArray(due) || !due.length) return 0;
  const failed: string[] = [];
  for (const f of due as FollowUp[]) {
    if ((await sendTelegram(followUpMessage(f, site))) === null && f.id) failed.push(f.id);
  }
  if (failed.length) {
    await rpc("release_followups", { p_secret: secret, p_ids: failed }).catch((error: unknown) => {
      console.error(`followups: release failed: ${error instanceof Error ? error.message : "unknown"}`);
    });
  }
  return due.length - failed.length;
}

/** Today's follow-ups for the morning summary, or null (no 0010 / no secret). */
export async function followUpsToday(): Promise<{ today: FollowUp[]; overdue: number; open: number } | null> {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 32) return null;
  const result = (await rpc("followups_today", { p_secret: secret }).catch(() => null)) as
    | ({ today: FollowUp[]; overdue: number; open: number } & { error?: string })
    | null;
  return result && !result.error ? result : null;
}
