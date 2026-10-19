// /api/meta-leads — the admin "check lead forms now" button (admin home page). Signed-in
// admin's own Supabase token in Authorization. Asks Meta for the villa lead forms' leads of
// the last two days right away, sends any not yet on Telegram, and answers with what each
// form returned (or Meta's error), so a missing alert can be explained without the logs.
//   POST → {pageToken, forms: [{id, name, found, sent, already, failed, error?}], sent}
//          {missing: "token" | "page" | "blob" | "telegram"} (503) when a setting is absent
import { hasSupabase, restAs } from "./_lib/supabase.js";
import { inspectMetaLeads, leadsMissing } from "./_lib/metaLeadsRun.js";

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
  const missing = leadsMissing();
  if (missing) return json({ missing }, 503);
  try {
    return json(await inspectMetaLeads());
  } catch (error) {
    console.error(`meta-leads: check failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return json({ error: "failed" }, 500);
  }
}
