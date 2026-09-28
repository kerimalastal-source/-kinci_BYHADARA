// Telegram alerts for HADARA Real Estate (its own bot, not the hospitality site's).
// Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from the Vercel project's environment.
// Without them it does nothing, and it never throws, so a Telegram problem can't
// break the endpoint that called it. (Files under api/_lib are helpers, not routes.)

/** Escapes text for Telegram's parse_mode "HTML". */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Calls a Bot API method in the team's chat; returns its result, or null when not sent. */
async function callTelegram(method: string, body: Record<string, unknown>): Promise<{ message_id?: number } | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, parse_mode: "HTML", disable_web_page_preview: true, ...body }),
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) {
      // Telegram's error text (e.g. "chat not found" before the bot was started, or
      // "message to edit not found" once the team deleted it); never the token.
      console.error(`telegram: ${method} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    const data = (await res.json().catch(() => null)) as { result?: { message_id?: number } } | null;
    return data?.result ?? {};
  } catch (error) {
    // The request URL carries the token, so only the error's name is logged.
    console.error(`telegram: ${method} error: ${error instanceof Error ? error.name : "unknown"}`);
    return null;
  }
}

/**
 * Sends a message (Telegram HTML, values already escaped) — as a reply to `replyTo` when
 * given — and returns its message id, or null when it wasn't sent.
 */
export async function sendTelegram(html: string, replyTo?: number | null): Promise<number | null> {
  const result = await callTelegram("sendMessage", {
    text: html,
    ...(replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {})
  });
  return typeof result?.message_id === "number" ? result.message_id : null;
}

/** Replaces the text of an earlier message (no new notification). False when it failed. */
export async function editTelegram(messageId: number, html: string): Promise<boolean> {
  return (await callTelegram("editMessageText", { message_id: messageId, text: html })) !== null;
}

/** The team's chat (TELEGRAM_CHAT_ID), to recognise updates coming from it. */
export function teamChatId(): string | null {
  return process.env.TELEGRAM_CHAT_ID || null;
}

/** A Bot API call that isn't a message to the team's chat (webhook setup); its result or null. */
export async function botApi(method: string, body: Record<string, unknown>): Promise<unknown> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000)
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; result?: unknown; description?: string } | null;
    if (!res.ok || !data?.ok) {
      console.error(`telegram: ${method} failed (${res.status}): ${String(data?.description ?? "").slice(0, 200)}`);
      return null;
    }
    return data.result ?? true;
  } catch (error) {
    console.error(`telegram: ${method} error: ${error instanceof Error ? error.name : "unknown"}`);
    return null;
  }
}

/** Puts a reaction (e.g. 👍 "delivered") on a message in the team's chat. */
export async function reactTelegram(messageId: number, emoji: string): Promise<boolean> {
  return (await callTelegram("setMessageReaction", { message_id: messageId, reaction: [{ type: "emoji", emoji }] })) !== null;
}
