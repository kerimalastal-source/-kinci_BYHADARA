// Collects the Instagram statistics with the live services and saves them in Supabase
// (save_ig_insights(), migration 0026, opened with CRON_SECRET). Run by the morning job
// (api/daily.ts, 9:00 Istanbul).
// Needs META_INSIGHTS_TOKEN (a system-user token with instagram_manage_insights; kept apart
// from META_ACCESS_TOKEN so the publishing token never changes), META_IG_USER_ID, Supabase
// and CRON_SECRET; without one of them nothing runs.
import { collectInsights } from "./igInsights.js";
import { hasSupabase, rpc, RpcError } from "./supabase.js";

/** The first setting still missing, or null when the collector can run. */
export function insightsMissing(): "token" | "account" | "supabase" | "secret" | null {
  if (!process.env.META_INSIGHTS_TOKEN) return "token";
  if (!/^\d+$/.test(process.env.META_IG_USER_ID ?? "")) return "account";
  if (!hasSupabase()) return "supabase";
  if ((process.env.CRON_SECRET ?? "").length < 32) return "secret";
  return null;
}

export interface InsightsRun {
  days: number;
  media: number;
  saved: { days?: number; media?: number; error?: string };
  errors: string[];
}

/** One collection now, saved; a 404 from the database means 0026 hasn't been run yet. */
export async function runInsights(): Promise<InsightsRun> {
  const result = await collectInsights({
    fetch,
    token: process.env.META_INSIGHTS_TOKEN!,
    igUserId: process.env.META_IG_USER_ID!,
    now: Date.now
  });
  const saved = (await rpc("save_ig_insights", {
    p_secret: process.env.CRON_SECRET,
    p_days: result.days,
    p_media: result.media
  })) as InsightsRun["saved"];
  return { days: result.days.length, media: result.media.length, saved: saved ?? {}, errors: result.errors };
}

/** The morning job's step: never throws; a short status for its answer and the log. */
export async function saveInstagramInsights(): Promise<string> {
  const missing = insightsMissing();
  if (missing) return `missing ${missing}`;
  try {
    const result = await runInsights();
    const status = result.saved.error ?? `${result.days} days, ${result.media} posts`;
    console.log(`daily: instagram ${status}${result.errors.length ? `; ${result.errors.join(" | ")}` : ""}`);
    return status;
  } catch (error) {
    if (error instanceof RpcError && error.status === 404) return "migration 0026 not run";
    console.error(`daily: instagram failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return "failed";
  }
}
