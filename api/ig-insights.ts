// /api/ig-insights — saves our Instagram account's statistics every morning (vercel.json:
// 05:00 UTC = 8:00 Istanbul), so they can be read and analysed later from Supabase
// (ig_account_daily, ig_media_stats; migration 0026). Instagram keeps most numbers for about
// 30 days only: saving them daily builds the history.
//   GET  from Vercel Cron, "Authorization: Bearer <CRON_SECRET>".
//   POST from a signed-in admin (their own Supabase token), to collect right away.
//   → {days, media, saved: {days, media}, errors}; 503 {missing} when a setting is absent,
//     503 {error: "migration"} until 0026 has been run.
import { hasSupabase, restAs, RpcError } from "./_lib/supabase.js";
import { insightsMissing, runInsights } from "./_lib/igInsightsRun.js";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

/** The admin check, made with the caller's own token (so is_admin() decides). */
async function isAdmin(request: Request): Promise<boolean> {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || !hasSupabase()) return false;
  const res = await restAs(token, "rpc/is_admin", { method: "POST", body: {} }).catch(() => null);
  return res?.status === 200 && res.data === true;
}

async function run(): Promise<Response> {
  const missing = insightsMissing();
  if (missing) return json({ missing }, 503);
  try {
    const result = await runInsights();
    console.log(`ig-insights: ${result.days} days, ${result.media} posts${result.errors.length ? `; ${result.errors.join(" | ")}` : ""}`);
    return json(result);
  } catch (error) {
    if (error instanceof RpcError && error.status === 404) return json({ error: "migration" }, 503);
    console.error(`ig-insights: failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return json({ error: "failed" }, 500);
  }
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 32 || request.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "unauthorized" }, 401);
  return run();
}

export async function POST(request: Request): Promise<Response> {
  if (!(await isAdmin(request))) return json({ error: "forbidden" }, 403);
  return run();
}
