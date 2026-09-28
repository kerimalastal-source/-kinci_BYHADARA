// /api/live-chat — the visitor's side of the live chat with the team (src/components/liveChat.ts,
// supabase/migrations/0011).
//
//   POST {chat?, token?, text, name?, contact?, locale, page, campaign?, website}
//        sends a message (no chat = a new conversation) → 200 {chat, token, reference, id}
//        and posts it to the team's Telegram in the background.
//   GET  ?chat=&token=&after=  → 200 {messages: [{id, sender, body, at}]}
//
// Errors: 400 invalid · 404 unknown conversation (the browser starts a new one) · 429 too
// many messages · 503 not set up yet (0011 not run) or too many new conversations.
// No IP address is stored: only the approximate country / city from Vercel's headers.
import { waitUntil } from "@vercel/functions";
import { sendTelegram } from "./_lib/telegram.js";
import { hasSupabase, rpc, RpcError } from "./_lib/supabase.js";
import { newChatMessage, nextChatMessage, type ChatContext } from "./_lib/liveChat.js";

const LOCALES = ["en", "ar", "fa", "fr", "ru"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT_AGENT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse/i;
const SITE = (process.env.VITE_SITE_URL || "https://www.hadararealestate.com").replace(/\/$/, "");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
/** Control characters and angle brackets out of the short fields. */
const clean = (value: string) => value.replace(/[\u0000-\u001f<>]/g, "").trim();

interface Sent {
  chat: string;
  token: string;
  reference: string;
  message: number;
  new: boolean;
  name: string | null;
  contact: string | null;
  telegram_root: number | null;
  error?: string;
}

async function notifyTeam(sent: Sent, context: ChatContext, body: string, newDetails: boolean): Promise<void> {
  const secret = process.env.CRON_SECRET ?? "";
  const messageId = sent.new
    ? await sendTelegram(newChatMessage(context, body, SITE))
    : await sendTelegram(nextChatMessage(context, body, newDetails), sent.telegram_root);
  // Without the link a Telegram reply can't find its conversation (needs CRON_SECRET).
  if (messageId && secret.length >= 32) {
    await rpc("live_chat_link_telegram", { p_secret: secret, p_chat: sent.chat, p_message_id: messageId, p_root: sent.new }).catch(
      (error: unknown) => console.error(`live-chat: link failed: ${error instanceof Error ? error.message : "unknown"}`)
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!hasSupabase()) return json({ error: "unavailable" }, 503);
  if (BOT_AGENT.test(request.headers.get("user-agent") ?? "")) return json({ error: "invalid" }, 400);
  const data = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  // The hidden "website" field is only ever filled in by bots.
  if (text(data.website, 200)) return json({ error: "invalid" }, 400);

  const chat = text(data.chat, 36);
  const token = text(data.token, 36);
  const body = text(data.text, 2000);
  const name = clean(text(data.name, 120));
  const contact = clean(text(data.contact, 160));
  const locale = LOCALES.includes(text(data.locale, 8)) ? text(data.locale, 8) : "en";
  const page = text(data.page, 300).split(/[?#]/)[0];
  const campaign = clean(text(data.campaign, 300));
  if (!body || (chat && (!UUID.test(chat) || !UUID.test(token)))) return json({ error: "invalid" }, 400);

  const country = request.headers.get("x-vercel-ip-country");
  let city = request.headers.get("x-vercel-ip-city");
  try {
    city = city ? decodeURIComponent(city) : null;
  } catch {
    /* keep it as sent */
  }

  let sent: Sent;
  try {
    sent = (await rpc("live_chat_send", {
      p_chat: chat || null,
      p_token: chat ? token : null,
      p_body: body,
      p_name: name || null,
      p_contact: contact || null,
      p_locale: locale,
      // A path on this site only ("//other.site" would be a link elsewhere).
      p_page: /^\/(?!\/)\S*$/.test(page) ? page : null,
      p_country: country && /^[A-Z]{2}$/.test(country) ? country : null,
      p_city: city ? city.slice(0, 100) : null,
      p_campaign: campaign || null
    })) as Sent;
  } catch (error) {
    if (error instanceof RpcError && error.status === 404) console.error("live-chat: live_chat_send is missing — run supabase/migrations/0011");
    else console.error(`live-chat: ${error instanceof Error ? error.message : "unknown error"}`);
    return json({ error: "unavailable" }, 503);
  }
  if (sent?.error) {
    const status = { invalid: 400, not_found: 404, limit: 429, busy: 503 }[sent.error] ?? 400;
    return json({ error: sent.error }, status);
  }

  const context: ChatContext = {
    reference: sent.reference,
    name: sent.name,
    contact: sent.contact,
    locale,
    page: /^\/(?!\/)\S*$/.test(page) ? page : null,
    country: country ?? null,
    city,
    campaign: campaign || null
  };
  waitUntil(
    notifyTeam(sent, context, body, Boolean(name || contact)).catch((error: unknown) =>
      console.error(`live-chat: notify failed: ${error instanceof Error ? error.message : "unknown"}`)
    )
  );
  return json({ chat: sent.chat, token: sent.token, reference: sent.reference, id: sent.message });
}

export async function GET(request: Request): Promise<Response> {
  if (!hasSupabase()) return json({ error: "unavailable" }, 503);
  const params = new URL(request.url).searchParams;
  const chat = params.get("chat") ?? "";
  const token = params.get("token") ?? "";
  const after = Math.max(0, Math.floor(Number(params.get("after")) || 0));
  if (!UUID.test(chat) || !UUID.test(token)) return json({ error: "invalid" }, 400);
  try {
    const result = (await rpc("live_chat_poll", { p_chat: chat, p_token: token, p_after: after })) as { messages?: unknown[]; error?: string };
    if (result?.error) return json({ error: result.error }, 404);
    return json({ messages: result?.messages ?? [] });
  } catch (error) {
    if (!(error instanceof RpcError && error.status === 404)) console.error(`live-chat: poll: ${error instanceof Error ? error.message : "unknown"}`);
    return json({ error: "unavailable" }, 503);
  }
}
