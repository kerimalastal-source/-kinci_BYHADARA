// Meta Conversions API (owner's setup 2026-10-09: dataset "HADARA Real Estate", token in
// META_CAPI_TOKEN on Vercel). The browser sends ViewContent, Lead, Schedule and Contact to
// /api/meta-event with the same event ID it gave the Pixel, so Meta keeps one of the two.
// Only visitors who accepted the cookie notice send anything (src/utils/tracking.ts).
// Contact details from a sent form are normalised and SHA-256 hashed here, never stored.
import { createHash } from "node:crypto";

export const META_EVENTS = ["ViewContent", "Lead", "Schedule", "Contact"] as const;
export type MetaEvent = (typeof META_EVENTS)[number];

/** The Pixel/dataset ID: public, the same as the site's (VITE_META_PIXEL_ID can override both). */
export const DEFAULT_PIXEL_ID = "983229534799823";
const GRAPH = "https://graph.facebook.com/v21.0";
const SITE = /^https:\/\/(www\.)?hadararealestate\.com(\/|$)/;

export interface MetaEventInput {
  event: MetaEvent;
  eventId: string;
  url: string;
  fbp: string;
  fbc: string;
  params: Record<string, string | string[]>;
  user: { email: string; phone: string; name: string };
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Checks and trims what the browser sent; null when it isn't a valid event from our site. */
export function parseMetaEvent(body: unknown): MetaEventInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const event = META_EVENTS.find((e) => e === b.event);
  const eventId = text(b.eventId, 64);
  const url = text(b.url, 800);
  if (!event || !/^[\w.-]{8,64}$/.test(eventId) || !SITE.test(url)) return null;
  const rawParams = b.params && typeof b.params === "object" ? (b.params as Record<string, unknown>) : {};
  const params: Record<string, string | string[]> = {};
  for (const key of ["content_category", "content_name", "content_type"]) {
    const v = text(rawParams[key], 200);
    if (v) params[key] = v;
  }
  if (Array.isArray(rawParams.content_ids)) params.content_ids = rawParams.content_ids.slice(0, 5).map((v) => text(v, 80)).filter(Boolean);
  const rawUser = b.user && typeof b.user === "object" ? (b.user as Record<string, unknown>) : {};
  return {
    event,
    eventId,
    url,
    fbp: /^fb\.\d\.\d+\.\d+$/.test(text(b.fbp, 120)) ? text(b.fbp, 120) : "",
    fbc: /^fb\.\d\.\d+\.[\w-]+$/.test(text(b.fbc, 400)) ? text(b.fbc, 400) : "",
    params,
    user: { email: text(rawUser.email, 200), phone: text(rawUser.phone, 40), name: text(rawUser.name, 120) }
  };
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

/** Meta's normalisation: email lower-case, phone digits only with country code, names lower-case. */
export function hashedUser(user: MetaEventInput["user"]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const email = user.email.toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) out.em = [sha256(email)];
  const digits = user.phone.replace(/\D/g, "").replace(/^00/, "");
  if (digits.length >= 8) out.ph = [sha256(digits)];
  const parts = user.name.toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length) out.fn = [sha256(parts[0])];
  if (parts.length > 1) out.ln = [sha256(parts[parts.length - 1])];
  return out;
}

/** The request body Meta expects for one event. */
export function capiPayload(input: MetaEventInput, client: { ip: string; userAgent: string }, now = new Date()): Record<string, unknown> {
  const userData: Record<string, unknown> = { ...hashedUser(input.user) };
  if (client.ip) userData.client_ip_address = client.ip;
  if (client.userAgent) userData.client_user_agent = client.userAgent;
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;
  return {
    event_name: input.event,
    event_time: Math.floor(now.getTime() / 1000),
    event_id: input.eventId,
    event_source_url: input.url,
    action_source: "website",
    user_data: userData,
    custom_data: input.params
  };
}

/** Sends one event; returns Meta's answer (or why it wasn't sent). Never throws. */
export async function sendToMeta(
  input: MetaEventInput,
  client: { ip: string; userAgent: string },
  deps: { fetch: typeof fetch; token?: string; pixelId?: string; testCode?: string }
): Promise<{ ok: boolean; status: number | "skipped"; detail?: string }> {
  if (!deps.token) return { ok: false, status: "skipped", detail: "META_CAPI_TOKEN not set" };
  const pixel = deps.pixelId || DEFAULT_PIXEL_ID;
  const body = new URLSearchParams({
    data: JSON.stringify([capiPayload(input, client)]),
    access_token: deps.token,
    ...(deps.testCode ? { test_event_code: deps.testCode } : {})
  });
  try {
    const res = await deps.fetch(`${GRAPH}/${pixel}/events`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000)
    });
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    return { ok: res.ok, status: res.status, detail: data.error?.message };
  } catch (error) {
    return { ok: false, status: 0, detail: error instanceof Error ? error.message : String(error) };
  }
}
