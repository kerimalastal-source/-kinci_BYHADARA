// Collects the Instagram statistics with the live services and saves them in Supabase
// (save_ig_insights(), migration 0026, opened with CRON_SECRET). Used by api/ig-insights.ts.
// Needs META_INSIGHTS_TOKEN (a system-user token with instagram_manage_insights; kept apart
// from META_ACCESS_TOKEN so the publishing token never changes), META_IG_USER_ID, Supabase
// and CRON_SECRET; without one of them nothing runs.
import { collectInsights } from "./igInsights.js";
import { hasSupabase, rpc } from "./supabase.js";

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
