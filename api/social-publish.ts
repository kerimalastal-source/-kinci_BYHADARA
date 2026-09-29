// /api/social-publish — publishes today's social posts (api/_lib/social.ts,
// scripts/social/README.md) on the Facebook Page and Instagram, and sends them to Telegram.
//   GET  — Vercel Cron at 07:00 UTC = 10:00 Istanbul (vercel.json), with
//          "Authorization: Bearer <CRON_SECRET>"; refuses everything without it.
//   POST — the "Publish today's posts now" button on the admin home (signed-in admin's own
//          Supabase token in Authorization, checked with is_admin()).
// A post already published on a platform is never published there again.
import { waitUntil } from "@vercel/functions";
import { hasSupabase, restAs } from "./_lib/supabase.js";
import { sendTelegram } from "./_lib/telegram.js";
import { hasBlob, publishTodaysPosts } from "./_lib/socialRun.js";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function isAdmin(request: Request): Promise<boolean> {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || !hasSupabase()) return false;
  const res = await restAs(token, "rpc/is_admin", { method: "POST", body: {} }).catch(() => null);
  return res?.status === 200 && res.data === true;
}

async function run(trigger: string): Promise<Response> {
  if (!hasBlob()) {
    // Without Blob there's no public image link and no record of what went out: publish nothing.
    console.error("social: no Blob store connected (BLOB_READ_WRITE_TOKEN missing)");
    await sendTelegram("⚠️ <b>لم تُنشر منشورات اليوم</b>\nمخزن Vercel Blob غير مربوط بمشروع الموقع (BLOB_READ_WRITE_TOKEN).");
    return json({ error: "blob" }, 503);
  }
  try {
    const result = await publishTodaysPosts();
    console.info(`social: publish (${trigger}) ${JSON.stringify(result)}`);
    return json(result);
  } catch (error) {
    console.error(`social: failed (${trigger}): ${error instanceof Error ? error.message : "unknown"}`);
    return json({ error: "failed" }, 500);
  }
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 32 || request.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "unauthorized" }, 401);
  return run("cron");
}

export async function POST(request: Request): Promise<Response> {
  if (!(await isAdmin(request))) return json({ error: "forbidden" }, 403);
  if (!hasBlob()) return run("admin");
  // Publishing takes up to a minute (Instagram processes each image): answer the button
  // straight away and keep going in the background; the report arrives on Telegram.
  waitUntil(run("admin"));
  return json({ started: true }, 202);
}
