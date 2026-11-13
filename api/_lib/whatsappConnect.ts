// Connecting a WhatsApp Business number to our webhook through Meta's Embedded Signup, with
// "coexistence": the number stays on the WhatsApp Business app on the phone, and Meta copies
// every message to /api/whatsapp as well. The admin page (src/data/whatsappConnect.ts) runs the
// signup in Meta's popup and sends us the one-time code plus the WABA id from the popup's
// message event; here we trade the code for a business token, find the number, subscribe our
// app to the WABA (POST /{waba}/subscribed_apps, without it no message reaches the webhook)
// and tell the team on Telegram which phone_number_id to put in WHATSAPP_PHONE_NUMBER_ID.
// Coexistence numbers skip /register (that would take the number off the app). The token is
// not kept anywhere.
//
// Settings (Vercel): WHATSAPP_APP_SECRET (already used to check webhook signatures), and
// META_APP_ID only if the Meta app ever changes (default: HADARA Publisher Real Estate).

export const GRAPH = "https://graph.facebook.com/v22.0";
export const DEFAULT_APP_ID = "1839985177009532";

export interface ConnectInput {
  code: string;
  wabaId: string;
  phoneNumberId: string;
  /** The admin page's address (origin + path), for the redirect_uri Meta may tie the code to. */
  page?: string;
}

const SITE = "https://www.hadararealestate.com";

/**
 * The redirect_uri values to try when trading the code. Facebook's JavaScript SDK does not
 * say which one its popup used, and Meta answers "redirect_uri is identical…" when it differs,
 * so: none first (the documented way), then the page itself, the site root, and Facebook's
 * own login_success page. Only our own site's addresses are ever sent.
 */
export function redirectCandidates(page?: string): (string | null)[] {
  const out: (string | null)[] = [null];
  if (page && page.startsWith(`${SITE}/`) && page.length < 300 && !/[?#\s]/.test(page)) out.push(page);
  out.push(`${SITE}/`, "https://www.facebook.com/connect/login_success.html");
  return [...new Set(out)];
}

export interface ConnectedNumber {
  id: string;
  display: string;
  name: string;
}

export interface ConnectResult {
  ok: boolean;
  wabaId?: string;
  numbers?: ConnectedNumber[];
  subscribed?: boolean;
  /** Which step failed: input, token, numbers or subscribe; with Meta's message when there is one. */
  error?: string;
  detail?: string;
}

export interface ConnectDeps {
  fetch: typeof fetch;
  appId: string;
  appSecret: string;
  telegram?: (html: string) => Promise<unknown>;
}

const ID = /^\d{5,30}$/;

/** The body the admin page posts, checked; null when it is not one. */
export function parseConnectInput(body: unknown): ConnectInput | null {
  const b = body as Record<string, unknown> | null;
  if (!b || b.action !== "whatsapp-connect") return null;
  const code = typeof b.code === "string" ? b.code.trim() : "";
  const wabaId = typeof b.wabaId === "string" ? b.wabaId.trim() : "";
  const phoneNumberId = typeof b.phoneNumberId === "string" ? b.phoneNumberId.trim() : "";
  const page = typeof b.page === "string" ? b.page.trim().slice(0, 300) : "";
  if (!code || code.length > 2000 || /\s/.test(code)) return null;
  if (wabaId && !ID.test(wabaId)) return null;
  if (phoneNumberId && !ID.test(phoneNumberId)) return null;
  return { code, wabaId, phoneNumberId, ...(page ? { page } : {}) };
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Meta's error message from a Graph response body, short and without anything secret. */
function graphError(data: unknown): string {
  const e = (data as { error?: { message?: string; code?: number } } | null)?.error;
  if (!e) return "";
  return `${e.code ?? ""} ${e.message ?? ""}`.trim().slice(0, 300);
}

async function graph(deps: ConnectDeps, path: string, token: string, init?: { method: string; body?: Record<string, unknown> }) {
  const url = `${GRAPH}/${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`;
  const res = await deps.fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined
  });
  const data = (await res.json().catch(() => null)) as unknown;
  return { ok: res.ok, data };
}

/** The Telegram note for the team: what got connected and the one setting left to change. */
export function connectedAlert(result: ConnectResult): string {
  const lines = ["🔗 <b>ربط رقم واتساب بالنظام</b>"];
  for (const n of result.numbers ?? []) {
    lines.push(`📞 ${escapeHtml(n.display || n.id)}${n.name ? ` (${escapeHtml(n.name)})` : ""}`);
    lines.push(`🆔 phone_number_id: <code>${escapeHtml(n.id)}</code>`);
  }
  lines.push(`🏢 WABA: <code>${escapeHtml(result.wabaId ?? "")}</code>`);
  lines.push(result.subscribed ? "✅ اشتراك التطبيق بالرسائل تم (subscribed_apps)." : "⚠️ اشتراك التطبيق بالرسائل لم يتم.");
  lines.push("إذا كان WHATSAPP_PHONE_NUMBER_ID مضبوطاً في Vercel، ضع فيه الرقم أعلاه (أو احذفه) ثم Redeploy.");
  return lines.join("\n");
}

/** The whole connection: code → token, the WABA's numbers, subscribed_apps, Telegram note. */
export async function connectWhatsApp(input: ConnectInput, deps: ConnectDeps): Promise<ConnectResult> {
  let token: string | undefined;
  let tokenError = "";
  for (const redirect of redirectCandidates(input.page)) {
    const tokenUrl =
      `${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(deps.appId)}` +
      `&client_secret=${encodeURIComponent(deps.appSecret)}&code=${encodeURIComponent(input.code)}` +
      (redirect ? `&redirect_uri=${encodeURIComponent(redirect)}` : "");
    const tokenRes = await deps.fetch(tokenUrl);
    const tokenData = (await tokenRes.json().catch(() => null)) as { access_token?: string } | null;
    token = tokenRes.ok ? tokenData?.access_token : undefined;
    if (token) break;
    tokenError = graphError(tokenData);
    // Only a redirect_uri mismatch is worth another try; an expired or used code is not.
    if (!/redirect_uri/i.test(tokenError)) break;
  }
  if (!token) return { ok: false, error: "token", detail: tokenError };

  let wabaId = input.wabaId;
  if (!wabaId && input.phoneNumberId) {
    const info = await graph(deps, `${input.phoneNumberId}?fields=whatsapp_business_account`, token);
    wabaId = (info.data as { whatsapp_business_account?: { id?: string } } | null)?.whatsapp_business_account?.id ?? "";
  }
  if (!ID.test(wabaId)) return { ok: false, error: "input", detail: "no WABA id from the signup" };

  const list = await graph(deps, `${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`, token);
  const rows = (list.data as { data?: { id?: string; display_phone_number?: string; verified_name?: string }[] } | null)?.data ?? [];
  let numbers: ConnectedNumber[] = rows
    .filter((r) => r.id && ID.test(r.id))
    .map((r) => ({ id: r.id!, display: (r.display_phone_number ?? "").slice(0, 40), name: (r.verified_name ?? "").slice(0, 100) }));
  if (input.phoneNumberId) {
    const chosen = numbers.filter((n) => n.id === input.phoneNumberId);
    numbers = chosen.length ? chosen : [{ id: input.phoneNumberId, display: "", name: "" }];
  }
  if (!list.ok && !numbers.length) return { ok: false, wabaId, error: "numbers", detail: graphError(list.data) };

  const sub = await graph(deps, `${wabaId}/subscribed_apps`, token, { method: "POST" });
  const subscribed = sub.ok && (sub.data as { success?: boolean } | null)?.success === true;
  const result: ConnectResult = {
    ok: subscribed,
    wabaId,
    numbers,
    subscribed,
    ...(subscribed ? {} : { error: "subscribe", detail: graphError(sub.data) })
  };
  if (deps.telegram) await deps.telegram(connectedAlert(result)).catch(() => undefined);
  return result;
}
