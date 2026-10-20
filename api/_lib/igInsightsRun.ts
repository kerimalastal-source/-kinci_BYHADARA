// Collects the Instagram and Facebook statistics with the live services and saves them in
// Supabase (save_ig_insights(), migration 0026, and save_fb_insights(), migration 0027, both
// opened with CRON_SECRET). Run by the morning job (api/daily.ts, 9:00 Istanbul).
// Needs META_INSIGHTS_TOKEN (a system-user token with instagram_manage_insights; kept apart
// from META_ACCESS_TOKEN so the publishing token never changes; read_insights too for the
// page's reach and views), META_IG_USER_ID / META_PAGE_ID, Supabase and CRON_SECRET; without
// one of them that network's step does nothing.
import { collectFacebook } from "./fbInsights.js";
import { collectInsights } from "./igInsights.js";
import { hasSupabase, rpc, RpcError } from "./supabase.js";
import { escapeHtml, sendTelegram } from "./telegram.js";

/** How long the Instagram step may keep starting requests (the job has 60 s in all). */
const INSTAGRAM_BUDGET_MS = 35_000;

/**
 * The team's Telegram note when a step saved nothing or Meta refused part of it: the free
 * Vercel plan keeps logs for an hour only, so the reason has to reach a person. Meta's own
 * messages only, never the token.
 */
export function insightsWarning(network: "instagram" | "facebook", status: string, errors: readonly string[]): string | null {
  if (!errors.length && !/^(failed|0 days|missing|migration)/.test(status)) return null;
  const name = network === "instagram" ? "إنستغرام" : "فيسبوك";
  const lines = [`<b>⚠️ أرقام ${name} — حضارة للعقار</b>`, `النتيجة: ${escapeHtml(status)}`];
  for (const error of errors.slice(0, 6)) lines.push(`• ${escapeHtml(error)}`);
  return lines.join("\n");
}

async function warn(network: "instagram" | "facebook", status: string, errors: readonly string[]): Promise<void> {
  const text = insightsWarning(network, status, errors);
  if (text) await sendTelegram(text).catch(() => null);
}

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
    now: Date.now,
    deadline: Date.now() + INSTAGRAM_BUDGET_MS
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
    await warn("instagram", status, result.errors);
    return status;
  } catch (error) {
    if (error instanceof RpcError && error.status === 404) return "migration 0026 not run";
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`daily: instagram failed: ${message}`);
    await warn("instagram", "failed", [message.slice(0, 220)]);
    return "failed";
  }
}

/** The morning job's Facebook step: never throws; a short status for its answer and the log. */
export async function saveFacebookInsights(): Promise<string> {
  const missing = insightsMissing();
  if (missing && missing !== "account") return `missing ${missing}`;
  if (!/^\d+$/.test(process.env.META_PAGE_ID ?? "")) return "missing page";
  try {
    const result = await collectFacebook({
      fetch,
      token: process.env.META_INSIGHTS_TOKEN!,
      pageId: process.env.META_PAGE_ID!,
      now: Date.now
    });
    const saved = ((await rpc("save_fb_insights", {
      p_secret: process.env.CRON_SECRET,
      p_days: result.days,
      p_posts: result.posts
    })) ?? {}) as { error?: string };
    const status = saved.error ?? `${result.days.length} days, ${result.posts.length} posts`;
    console.log(`daily: facebook ${status}${result.errors.length ? `; ${result.errors.join(" | ")}` : ""}`);
    await warn("facebook", status, result.errors);
    return status;
  } catch (error) {
    if (error instanceof RpcError && error.status === 404) return "migration 0027 not run";
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`daily: facebook failed: ${message}`);
    await warn("facebook", "failed", [message.slice(0, 220)]);
    return "failed";
  }
}
