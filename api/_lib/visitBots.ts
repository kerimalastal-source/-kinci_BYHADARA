// Visits that are most likely automated link checks, not people (owner's request,
// 2026-09-29, same as HADARA Hospitality's botReason / burstFor). Facebook and others open
// a shared link in a normal-looking browser from their data centers, often several at the
// same moment, so the user agent doesn't give them away and they used to arrive on
// Telegram as new visitors. Such a visit gets no Telegram message at all (no alert, no
// edit, no 🔥); it is still saved in visitor_events.
import { rpc, RpcError } from "./supabase.js";

/**
 * Small towns whose visits are mostly data centers (Meta, Amazon, Google, Microsoft), as
 * "city|country" in lower case without accents. Real cities that also have a data center
 * (Fort Worth, Henrico, Council Bluffs, Sterling...) are left out on purpose, so a real
 * visitor there is never hidden: the same-page burst catches those checks instead.
 */
export const DATA_CENTER_TOWNS: ReadonlySet<string> = new Set([
  "clonee|ie",
  "odense|dk",
  "lulea|se",
  "prineville|us",
  "forest city|us",
  "altoona|us",
  "los lunas|us",
  "papillion|us",
  "new albany|us",
  "sandston|us",
  "eagle mountain|us",
  "ashburn|us",
  "boardman|us",
  "umatilla|us",
  "the dalles|us",
  "moncks corner|us",
  "lenoir|us",
  "pryor|us",
  "boydton|us",
  "saint-ghislain|be",
  "st. ghislain|be",
  "hamina|fi",
  "eemshaven|nl"
]);

/** "Luleå" → "lulea": lower case, accents removed. */
export function plainCity(city: string): string {
  return city.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/** True when the visit's city is one of the data-center towns. */
export function isDataCenterTown(place: { city: string | null; country: string | null }): boolean {
  if (!place.city || !place.country) return false;
  return DATA_CENTER_TOWNS.has(`${plainCity(place.city)}|${place.country.toLowerCase()}`);
}

/** Why a visit looks automated, or null: a data-center town, or other sessions opening the same page at once. */
export function botReason(place: { city: string | null; country: string | null }, burst: number): string | null {
  if (isDataCenterTown(place)) return "data-center town";
  return burst > 0 ? "same-page burst" : null;
}

/**
 * Other sessions that opened `path` (the session's first page) within 10 seconds of this
 * session's start, plus the session's Telegram alert id (visit_check(), migration 0012).
 * Until 0012 is run the burst counts as 0; any other failure is logged and counts as 0
 * too, so a database hiccup never hides a real visitor.
 */
export async function burstFor(sessionId: string, path: string): Promise<{ burst: number; messageId: number | null }> {
  try {
    const result = (await rpc("visit_check", { p_session_id: sessionId, p_path: path })) as {
      others?: unknown;
      message_id?: unknown;
    } | null;
    return { burst: Number(result?.others) || 0, messageId: Number(result?.message_id) || null };
  } catch (error) {
    if (!(error instanceof RpcError && error.status === 404)) {
      console.error(`track: visit_check failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
    return { burst: 0, messageId: null };
  }
}

/** How long a new session waits before its alert, so the rest of a burst has arrived and is counted. */
export const SETTLE_MS = 8000;
