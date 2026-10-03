// Saves one page view and tells the team on Telegram (called by api/track.ts inside
// waitUntil, after the 204 went out). A new session sends the "new visitor" alert, later
// pages edit it, and the first opening of a request page sends a 🔥 reply. Visits that
// look automated (api/_lib/visitBots.ts) are saved but get no Telegram message at all.
import { editTelegram, escapeHtml, sendTelegram } from "./telegram.js";
import { alertInsightLines, insightFacts, type Insight, type VisitFacts } from "./visitInsights.js";
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

  // Who the visit looks like (system, browser, time zone, screen, automation flag), for
  // the "is it a person" reading (0018; before it runs, the 404 is ignored).
  if (state.is_new && (view.os || view.browser || view.tz || view.screen || view.webdriver != null)) {
    await rpc("save_visit_profile", {
      p_session_id: view.sessionId,
      p_os: view.os ?? null,
      p_browser: view.browser ?? null,
      p_tz: view.tz || null,
      p_screen: view.screen || null,
      p_webdriver: view.webdriver ?? null
    }).catch((error: unknown) => {
      if (!(error instanceof RpcError && error.status === 404)) console.error(`track: save_visit_profile failed: ${error instanceof Error ? error.message : "unknown"}`);
    });
  }

  // A browser that says it is driven by software gets no Telegram message either.
  if (state.is_new && view.webdriver === true) {
    console.info("track: no alert, likely automated: automated browser");
    return;
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
    // A first page has no engagement yet: the verdict reads "⏳" until the page reports.
    const facts: VisitFacts = {
      city: geo.city,
      country: geo.country,
      referrer: view.referrer,
      campaign: view.campaign,
      device: view.device || null,
      os: view.os ?? null,
      browser: view.browser ?? null,
      tz: view.tz || null,
      screen: view.screen || null,
      webdriver: view.webdriver ?? null,
      pages: [{ path: view.path, at: 0 }]
    };
    messageId = await sendTelegram(newVisitorMessage(view, geo, origin, alertInsightLines(facts, escapeHtml)));
    if (messageId) await rpc("save_visitor_alert", { p_session_id: view.sessionId, p_message_id: messageId });
  } else if (messageId) {
    // A message the team deleted can't be edited: that is logged (by editTelegram) and
    // never stops the 🔥 message below.
    const insight = await visitInsight(view.sessionId);
    const extra = insight ? alertInsightLines(insightFacts(insight), escapeHtml) : [];
    await editTelegram(messageId, visitUpdateMessage(view, state, origin, extra));
  }

  if (request) await sendTelegram(request, messageId);
}

/** visit_insight() of a session, or null (before 0018 runs, or on any error). */
async function visitInsight(sessionId: string): Promise<Insight | null> {
  try {
    return (await rpc("visit_insight", { p_session_id: sessionId })) as Insight | null;
  } catch (error) {
    if (!(error instanceof RpcError && error.status === 404)) console.error(`track: visit_insight failed: ${error instanceof Error ? error.message : "unknown"}`);
    return null;
  }
}

/**
 * Rewrites a visit's alert after its engagement arrived (api/track.ts, { type:
 * "engagement" }), so the verdict follows what the visitor did; an edit rings no
 * notification. `insight` is what record_visit_engagement() returned; `view` is the page
 * the browser was on (with its trail and titles). Nothing happens for a visit without an
 * alert (automated, or a new tab opened from the site).
 */
export async function refreshAlert(view: PageView, insight: Insight, origin: string): Promise<void> {
  const messageId = insight.message_id ? Number(insight.message_id) : null;
  const landing = insight.landing;
  if (!messageId || !landing || (landing.referrer ?? "").startsWith("/") || isDataCenterTown(landing)) return;
  const pages = insight.pages?.length ?? 1;
  // A report for a page the visitor has already left: the next page's own edit (which
  // re-reads the visit) shows the newer state, so this one mustn't overwrite it.
  if (pages > 1 && insight.pages[pages - 1]?.path !== view.path) return;
  const extra = alertInsightLines(insightFacts(insight), escapeHtml);
  let text: string;
  if (pages > 1) {
    const state: VisitState = {
      is_new: false,
      pages_before: pages - 1,
      seconds: Number(insight.seconds) || 0,
      seen_before: true,
      landing,
      message_id: messageId
    };
    text = visitUpdateMessage(view, state, origin, extra);
  } else {
    const first: PageView = { ...view, path: landing.path, locale: view.locale, referrer: landing.referrer ?? "" };
    text = newVisitorMessage(first, { country: landing.country, city: landing.city }, origin, extra);
  }
  if (await editTelegram(messageId, text)) console.info("track: alert updated after engagement");
}