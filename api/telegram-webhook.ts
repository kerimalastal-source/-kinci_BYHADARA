// POST /api/telegram-webhook — Telegram calls this for each message in the bot's chats
// (switched on once from the admin chats page, api/telegram-setup.ts). A team member's
// *reply* to a live chat message goes to that visitor's chat (live_chat_team_reply(),
// supabase/migrations/0011) and gets a 👍; anything else is ignored.
// Telegram signs every call with the secret set at setup (X-Telegram-Bot-Api-Secret-Token).
import { reactTelegram, sendTelegram, teamChatId } from "./_lib/telegram.js";
import { rpc } from "./_lib/supabase.js";
import { webhookSecret } from "./_lib/liveChat.js";

interface TelegramMessage {
  message_id: number;
  chat?: { id: number | string };
  from?: { is_bot?: boolean };
  text?: string;
  caption?: string;
  reply_to_message?: { message_id: number; from?: { is_bot?: boolean } };
}

const ok = () => new Response("ok", { status: 200 });

export async function POST(request: Request): Promise<Response> {
  const secret = webhookSecret();
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) return new Response("forbidden", { status: 401 });

  const update = (await request.json().catch(() => null)) as { message?: TelegramMessage } | null;
  const message = update?.message;
  // Only the team's own chat, and only replies with text.
  if (!message || String(message.chat?.id) !== teamChatId() || message.from?.is_bot) return ok();
  const body = (message.text ?? message.caption ?? "").trim();
  const replyTo = message.reply_to_message?.message_id;
  if (!body || !replyTo) return ok();

  const result = (await rpc("live_chat_team_reply", { p_secret: process.env.CRON_SECRET ?? "", p_reply_to: replyTo, p_body: body }).catch(
    (error: unknown) => {
      console.error(`telegram-webhook: ${error instanceof Error ? error.message : "unknown error"}`);
      return { error: "failed" };
    }
  )) as { chat?: string; error?: string } | null;

  if (result?.chat) {
    await reactTelegram(message.message_id, "👍");
  } else if (result?.error === "not_found" && message.reply_to_message?.from?.is_bot) {
    // A reply to one of the bot's other alerts (a visitor notice, a booking…): say it went nowhere.
    await sendTelegram("ℹ️ هذا الرد ليس على رسالة من محادثة مباشرة، فلم يصل إلى أي زائر. للرد على زائر، اضغط «رد» على رسالته في المحادثة المباشرة.", message.message_id);
  } else if (result?.error === "invalid") {
    await sendTelegram("⚠️ لم يُرسل الرد: الرسالة طويلة جداً (الحد 2000 حرف).", message.message_id);
  } else if (result?.error) {
    await sendTelegram("⚠️ تعذّر إرسال ردّك إلى الزائر، حاول مرة أخرى أو ردّ من لوحة التحكم.", message.message_id);
  }
  return ok();
}
