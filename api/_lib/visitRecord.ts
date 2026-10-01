// Saves one page view and tells the team on Telegram (called by api/track.ts inside
// waitUntil, after the 204 went out). A new session sends the "new visitor" alert, later
// pages edit it, and the first opening of a request page sends a 🔥 reply. Visits that
// look automated (api/_lib/visitBots.ts) are saved but get no Telegram message at all.
import { editTelegram, sendTelegram } from "./telegram.js";
import { rpc, RpcError } from "./supabase.js";
import { botReason, burstFor, isDataCenterTown, SETTLE_MS } from "./visitBots.js";
import {
  newVisitorMessage,
  requestPageMessage,
  visitUpdateMessage,
  type Geo,
  type Landing,
  type PageView,
  type VisitState
} from "./visitAlerts.js";

export interface RecordOptions {
  /** How long a new session waits before deciding (SETTLE_MS; tests pass 0). */
  settleMs?: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function recordVisit(view: PageView, geo: Geo, origin: string, options: RecordOptions = {}): Promise<void> {
  const args = {
    p_session_id: view.sessionId,
    p_path: view.path,
    p_locale: view.locale,
    p_referrer: view.referrer || null,
    p_country: geo.country,
    p_city: geo.city
  };

  let state: VisitState;
  try {
    state = (await rpc("record_visit_state", args)) as VisitState;
  } catch (error) {
    // 404: migration 0004 hasn't been run yet — keep the plain alert of record_visit().
    if (!(error instanceof RpcError && error.status === 404)) throw error;
    const isNewSession = await rpc("record_visit", args);
    if (isNewSession === true && !view.referrer.startsWith("/") && !isDataCenterTown(geo)) {
      await sendTelegram(newVisitorMessage(view, geo, origin));
    }
    return;
  }

  // A new tab opened from the site starts its own session (sessionStorage is per tab) but
  // its first referrer is one of our own pages: it isn't a new visitor, so it gets no
  // alert, no updates and no 🔥 message.
  const landingReferrer = state.is_new ? view.referrer : state.landing?.referrer ?? "";
  if ((landingReferrer ?? "").startsWith("/")) return;

  // The ad campaign is kept with the visit's first page, for the statistics page (0008;
  // before it runs, the 404 is ignored).
  if (state.is_new && view.campaign) {
    await rpc("save_visit_campaign", { p_session_id: view.sessionId, p_campaign: view.campaign }).catch((error: unknown) => {
      if (!(error instanceof RpcError && error.status === 404)) console.error(`track: save_visit_campaign failed: ${error instanceof Error ? error.message : "unknown"}`);
    });
  }

  // The visit's device, for the "what visitors do" statistics (0015; before it runs, the
  // 404 is ignored).
  if (state.is_new && view.device) {
    await rpc("save_visit_device", { p_session_id: view.sessionId, p_device: view.device }).catch((error: unknown) => {
      if (!(error instanceof RpcError && error.status === 404)) console.error(`track: save_visit_device failed: ${error instanceof Error ? error.message : "unknown"}`);
    });
  }

    // The session's first page decides whether it is automated (for a new session: this page).
  const landing: Landing = state.is_new
    ? { path: view.path, locale: view.locale, referrer: view.referrer || null, country: geo.country, city: geo.city }
    : state.landing;

  // A data-center town needs no waiting: nothing is sent for this visit.
  if (isDataCenterTown(landing)) {
    console.info(`track: no alert, likely automated: data-center town (${landing.city}, ${landing.country})`);
    return;
  }

  const settleMs = options.settleMs ?? SETTLE_MS;
  let messageId = state.message_id ? Number(state.message_id) : null;
  const request = requestPageMessage(view, geo, state);
  const sessionMs = Math.max(0, Number(state.seconds) || 0) * 1000;

  // A later page with no alert to edit and no 🔥 to send: nothing to decide, unless the
  // first page's decision may still be pending (the session is younger than the wait).
  if (!state.is_new && !messageId && !request && sessionMs >= settleMs + 2000) return;

  // A new session waits so the other sessions of a burst have arrived (the first visit of
  // a burst is caught too). A later page opened during that wait waits until the first
  // page has decided, so its edit or 🔥 reply finds the alert.
  const wait = state.is_new ? settleMs : Math.max(0, settleMs + 2000 - sessionMs);
  if (wait > 0) await sleep(wait);

  const check = await burstFor(view.sessionId, landing.path);
  if (!state.is_new && check.messageId) messageId = check.messageId;
  const reason = botReason(landing, check.burst);
  if (reason) {
    console.info(`track: no alert, likely automated: ${reason} (${landing.city ?? "?"}, ${landing.country ?? "?"})`);
    return;
  }

  if (state.is_new) {
    messageId = await sendTelegram(newVisitorMessage(view, geo, origin));
    if (messageId) await rpc("save_visitor_alert", { p_session_id: view.sessionId, p_message_id: messageId });
  } else if (messageId) {
    // A message the team deleted can't be edited: that is logged (by editTelegram) and
    // never stops the 🔥 message below.
    await editTelegram(messageId, visitUpdateMessage(view, state, origin));
  }

  if (request) await sendTelegram(request, messageId);
}
