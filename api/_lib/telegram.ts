// Telegram alerts for HADARA Real Estate (its own bot, not the hospitality site's).
// Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from the Vercel project's environment.
// Without them it does nothing, and it never throws, so a Telegram problem can't
// break the endpoint that called it. (Files under api/_lib are helpers, not routes.)

/** Escapes text for Telegram's parse_mode "HTML". */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function sendTelegram(html: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) {
      // Telegram's error text (e.g. "chat not found" before the bot was started); never the token.
      console.error(`telegram: sendMessage failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    }
  } catch (error) {
    console.error(`telegram: sendMessage error: ${error instanceof Error ? error.name : "unknown"}`);
  }
}
