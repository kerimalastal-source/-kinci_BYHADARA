// Sends email through Resend (https://resend.com). Reads RESEND_API_KEY and, optionally,
// BOOKING_FROM_EMAIL ("Name <address@verified-domain>") from the Vercel project's
// environment. Without the key it sends nothing, and it never throws, so an email
// problem can't break the request that triggered it.

const DEFAULT_FROM = "HADARA Real Estate <bookings@hadararealestate.com>";

export interface EmailAttachment {
  filename: string;
  /** Base64-encoded file content. */
  content: string;
}

export interface Email {
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail(email: Email): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.BOOKING_FROM_EMAIL || DEFAULT_FROM,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
        ...(email.attachments?.length ? { attachments: email.attachments } : {})
      }),
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) {
      console.error(`email: send failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`email: send error: ${error instanceof Error ? error.name : "unknown"}`);
    return false;
  }
}
