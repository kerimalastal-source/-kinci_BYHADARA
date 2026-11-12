// /api/meta-event — two Meta jobs in one function (the free Vercel plan allows 12 per deployment):
//   * POST from the browser: forwards the Pixel's key events to Meta's Conversions API
//     (api/_lib/metaCapi.ts). Answers 204 right away; the call to Meta runs in the background.
//   * WhatsApp Business webhook (also reachable as /api/whatsapp, vercel.json): GET is Meta's
//     subscription check (hub.verify_token), POST signed with X-Hub-Signature-256 carries the
//     customers' messages (api/_lib/whatsapp.ts). Answers 200 right away; saving runs after.
import { waitUntil } from "@vercel/functions";
import { parseMetaEvent, sendToMeta } from "./_lib/metaCapi.js";
import { handleMessages, parseWebhook, validSignature, type SaveResult } from "./_lib/whatsapp.js";
import { hasSupabase, rpc } from "./_lib/supabase.js";
import { sendTelegram } from "./_lib/telegram.js";

const BOT_AGENT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pingdom|uptime|monitor/i;
const noContent = (status = 204) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });

/** Meta's webhook subscription check: echo hub.challenge when the verify token matches. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = process.env.WHATSAPP_VERIFY_TOKEN ?? "";
  if (url.searchParams.get("hub.mode") === "subscribe" && token && url.searchParams.get("hub.verify_token") === token) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("forbidden", { status: 403 });
}

async function whatsapp(raw: string, signature: string | null): Promise<Response> {
  const appSecret = process.env.WHATSAPP_APP_SECRET ?? "";
  if (!validSignature(raw, signature, appSecret)) return new Response("forbidden", { status: 401 });
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("ok", { status: 200 });
  }
  const messages = parseWebhook(body, process.env.WHATSAPP_PHONE_NUMBER_ID || undefined);
  const secret = process.env.CRON_SECRET ?? "";
  if (messages.length && secret && hasSupabase()) {
    waitUntil(
      handleMessages(messages, {
        secret,
        save: async (args) => (await rpc("save_whatsapp_message", args)) as SaveResult | null,
        telegram: async (html) => (await sendTelegram(html)) !== null
      }).catch((error: unknown) => console.error(`whatsapp: ${error instanceof Error ? error.message : error}`))
    );
  }
  // Always 200 to a signed call, or Meta retries it for days.
  return new Response("ok", { status: 200 });
}

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get("x-hub-signature-256");
  const raw = await request.text().catch(() => "");
  if (signature) return whatsapp(raw, signature);
  const userAgent = request.headers.get("user-agent") ?? "";
  if (!userAgent || BOT_AGENT.test(userAgent)) return noContent();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const input = parseMetaEvent(parsed);
  if (!input) return noContent(400);
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || (request.headers.get("x-real-ip") ?? "");
  waitUntil(
    sendToMeta(input, { ip, userAgent }, {
      fetch,
      token: process.env.META_CAPI_TOKEN,
      pixelId: process.env.META_PIXEL_ID || process.env.VITE_META_PIXEL_ID,
      testCode: process.env.META_TEST_EVENT_CODE
    }).then((result) => {
      if (!result.ok) console.log(`meta-event: ${input.event} not sent (${result.status}) ${result.detail ?? ""}`);
    })
  );
  return noContent();
}
