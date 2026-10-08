// /api/meta-event — forwards the Pixel's key events to Meta's Conversions API from the server
// (api/_lib/metaCapi.ts). Answers 204 right away; the call to Meta runs in the background.
import { waitUntil } from "@vercel/functions";
import { parseMetaEvent, sendToMeta } from "./_lib/metaCapi.js";

const BOT_AGENT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pingdom|uptime|monitor/i;
const noContent = (status = 204) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request): Promise<Response> {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (!userAgent || BOT_AGENT.test(userAgent)) return noContent();
  const input = parseMetaEvent(await request.json().catch(() => null));
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
