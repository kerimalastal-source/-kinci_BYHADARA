// /api/meta-leads — the admin "check lead forms now" button (admin home page). Signed-in
// admin's own Supabase token in Authorization. Asks Meta for the villa lead forms' leads of
// the last two days right away, sends any not yet on Telegram, and answers with what each
// form returned (or Meta's error), so a missing alert can be explained without the logs.
//   POST → {pageToken, forms: [{id, name, found, sent, already, failed, error?}], sent}
//          {missing: "token" | "page" | "blob" | "telegram"} (503) when a setting is absent
//   POST {action: "whatsapp-connect", code, wabaId, phoneNumberId} → the admin's WhatsApp
//          Embedded Signup (coexistence) result: {ok, wabaId, numbers, subscribed, error?}
//          (api/_lib/whatsappConnect.ts; here because the free plan allows 12 functions)
import { hasSupabase, restAs } from "./_lib/supabase.js";
import { inspectMetaLeads, leadsMissing } from "./_lib/metaLeadsRun.js";
import { connectWhatsApp, DEFAULT_APP_ID, parseConnectInput } from "./_lib/whatsappConnect.js";
import { sendTelegram } from "./_lib/telegram.js";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

/** The admin check, made with the caller's own token (so is_admin() decides). */
async function isAdmin(request: Request): Promise<boolean> {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || !hasSupabase()) return false;
  const res = await restAs(token, "rpc/is_admin", { method: "POST", body: {} }).catch(() => null);
  return res?.status === 200 && res.data === true;
}

export async function POST(request: Request): Promise<Response> {
  if (!(await isAdmin(request))) return json({ error: "forbidden" }, 403);
  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  if (body?.action === "whatsapp-connect") {
    const input = parseConnectInput(body);
    if (!input) return json({ ok: false, error: "input" }, 400);
    const appSecret = process.env.WHATSAPP_APP_SECRET ?? "";
    if (!appSecret) return json({ ok: false, missing: "secret" }, 503);
    try {
      const result = await connectWhatsApp(input, {
        fetch,
        appId: process.env.META_APP_ID || DEFAULT_APP_ID,
        appSecret,
        telegram: (html) => sendTelegram(html)
      });
      if (!result.ok) console.log(`whatsapp-connect: ${result.error} ${result.detail ?? ""}`);
      return json(result, result.ok ? 200 : 502);
    } catch (error) {
      console.error(`whatsapp-connect: failed: ${error instanceof Error ? error.message : "unknown error"}`);
      return json({ ok: false, error: "failed" }, 500);
    }
  }
  const missing = leadsMissing();
  if (missing) return json({ missing }, 503);
  try {
    return json(await inspectMetaLeads());
  } catch (error) {
    console.error(`meta-leads: check failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return json({ error: "failed" }, 500);
  }
}
