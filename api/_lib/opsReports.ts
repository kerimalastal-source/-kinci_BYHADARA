// The daily check of the work system on Telegram (supabase/migrations/0028).
// Claude's scheduled check writes a short Arabic report into ops_reports; the site sends it
// to the team, each report once: from page views (api/track.ts, at most every two minutes)
// and from the morning job. A report Telegram refuses is put back for the next run.
import { escapeHtml, sendTelegram } from "./telegram.js";
import { hasSupabase, rpc, RpcError } from "./supabase.js";

interface OpsReport {
  id: number;
  body: string;
}

export function opsReportMessage(body: string): string {
  return `<b>🩺 منظومة العمل — حضارة للعقار</b>\n${escapeHtml(body.trim())}`;
}

/** Sends the reports waiting in the database; returns how many went out. */
export async function sendOpsReports(minGapSeconds: number): Promise<number> {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 32 || !hasSupabase()) return 0;
  let due: unknown;
  try {
    due = await rpc("claim_ops_reports", { p_secret: secret, p_min_gap_seconds: minGapSeconds });
  } catch (error) {
    // Until migration 0028 runs the function doesn't exist.
    if (!(error instanceof RpcError && error.status === 404)) console.error(`ops reports: ${error instanceof Error ? error.message : "unknown error"}`);
    return 0;
  }
  if (!Array.isArray(due)) return 0;
  let sent = 0;
  for (const report of due as OpsReport[]) {
    if ((await sendTelegram(opsReportMessage(report.body))) !== null) sent++;
    else {
      await rpc("release_ops_report", { p_secret: secret, p_id: report.id }).catch((error: unknown) => {
        console.error(`ops reports: release failed: ${error instanceof Error ? error.message : "unknown"}`);
      });
    }
  }
  return sent;
}
