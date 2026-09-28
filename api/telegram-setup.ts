// /api/telegram-setup — switches on replies from Telegram for the live chat (admins only,
// from the admin chats page). Signed-in admin's own Supabase token in Authorization.
//   GET   → {active, pending, lastError}   whether Telegram sends replies to /api/telegram-webhook
//   POST  → {active: true}                 points the bot's webhook at it (setWebhook)
import { botApi } from "./_lib/telegram.js";
import { hasSupabase, restAs } from "./_lib/supabase.js";
import { webhookSecret } from "./_lib/liveChat.js";

const SITE = (process.env.VITE_SITE_URL || "https://www.hadararealestate.com").replace(/\/$/, "");
const HOOK = `${SITE}/api/telegram-webhook`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

/** The admin check, made with the caller's own token (so is_admin() decides). */
async function isAdmin(request: Request): Promise<boolean> {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || !hasSupabase()) return false;
  const res = await restAs(token, "rpc/is_admin", { method: "POST", body: {} }).catch(() => null);
  return res?.status === 200 && res.data === true;
}

function missing(): string | null {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return "telegram";
  if (!webhookSecret()) return "secret";
  return null;
}

export async function GET(request: Request): Promise<Response> {
  if (!(await isAdmin(request))) return json({ error: "forbidden" }, 403);
  const gap = missing();
  if (gap) return json({ active: false, missing: gap });
  const info = (await botApi("getWebhookInfo", {})) as { url?: string; pending_update_count?: number; last_error_message?: string } | null;
  return json({ active: info?.url === HOOK, pending: info?.pending_update_count ?? 0, lastError: info?.last_error_message ?? null });
}

export async function POST(request: Request): Promise<Response> {
  if (!(await isAdmin(request))) return json({ error: "forbidden" }, 403);
  const gap = missing();
  if (gap) return json({ active: false, missing: gap }, 503);
  const done = await botApi("setWebhook", { url: HOOK, secret_token: webhookSecret(), allowed_updates: ["message"], drop_pending_updates: true });
  return done ? json({ active: true }) : json({ active: false, error: "telegram" }, 502);
}
