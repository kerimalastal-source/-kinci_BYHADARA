import { getLocale } from "../i18n";
import { campaignSource } from "../utils/campaign";

/**
 * Live chat with the team (api/live-chat.ts, supabase/migrations/0011): the conversation's
 * id and secret token stay in this browser (localStorage "hadara-live-chat") so a visitor
 * who comes back sees the team's answers. Messages are polled: every few seconds while the
 * chat panel is open, every 30 s for a while after it closes (for the unread dot).
 */

export interface LiveMessage {
  /** Server id; negative while it is being sent. */
  id: number;
  sender: "visitor" | "team";
  body: string;
  at: string;
  failed?: boolean;
}

interface LiveState {
  chat: string | null;
  token: string | null;
  reference: string | null;
  messages: LiveMessage[];
  name: string;
  contact: string;
  /** The visitor gave (or skipped) their name and contact. */
  detailsDone: boolean;
  /** The last team message the visitor has seen. */
  seen: number;
  updated: number;
}

const KEY = "hadara-live-chat";
const ENDPOINT = "/api/live-chat";
const KEEP_MS = 30 * 86_400_000;
const FAST_MS = 4000;
const SLOW_MS = 30_000;
/** How long after the last activity the closed panel keeps checking for replies. */
const SLOW_FOR_MS = 3 * 3_600_000;

const empty = (): LiveState => ({ chat: null, token: null, reference: null, messages: [], name: "", contact: "", detailsDone: false, seen: 0, updated: Date.now() });

function load(): LiveState {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as LiveState | null;
    if (saved && Date.now() - saved.updated < KEEP_MS) return { ...empty(), ...saved, messages: (saved.messages ?? []).filter((m) => m.id > 0) };
  } catch {
    /* storage blocked or corrupt */
  }
  return empty();
}

let state = load();
let timer: number | undefined;
let fast = false;
let listener: (() => void) | null = null;
let sending = 0;

function save(): void {
  state.updated = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, messages: state.messages.slice(-100) }));
  } catch {
    /* the conversation still works for this page */
  }
}

export const liveMessages = (): readonly LiveMessage[] => state.messages;
export const liveReference = () => state.reference;
export const liveDetails = () => ({ name: state.name, contact: state.contact, done: state.detailsDone });
/** A conversation exists (the visitor wrote at least once). */
export const hasLiveChat = () => Boolean(state.chat);
/** Team answers the visitor hasn't seen yet. */
export const liveUnread = () => state.messages.filter((m) => m.sender === "team" && m.id > state.seen).length;

export function markLiveSeen(): void {
  const last = Math.max(0, ...state.messages.filter((m) => m.sender === "team").map((m) => m.id));
  if (last > state.seen) {
    state.seen = last;
    save();
  }
}

/** Called after every change (new message, reply, failure) so the panel and the bubble repaint. */
export function onLiveChange(fn: () => void): void {
  listener = fn;
}

const changed = () => listener?.();

function merge(messages: LiveMessage[]): boolean {
  let added = false;
  for (const m of messages) {
    if (!state.messages.some((x) => x.id === m.id)) {
      state.messages.push(m);
      added = true;
    }
  }
  if (added) state.messages.sort((a, b) => (a.id < 0 ? 1 : b.id < 0 ? -1 : a.id - b.id));
  return added;
}

export type SendResult = "ok" | "limit" | "unavailable" | "error";

/** Sends a visitor message (shown at once, confirmed when the server answers). */
export async function sendLive(body: string, retryOf?: number): Promise<SendResult> {
  const text = body.trim().slice(0, 2000);
  if (!text) return "error";
  const tempId = retryOf ?? -(++sending + Date.now());
  const existing = state.messages.find((m) => m.id === tempId);
  if (existing) existing.failed = false;
  else state.messages.push({ id: tempId, sender: "visitor", body: text, at: new Date().toISOString() });
  changed();

  const post = () =>
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat: state.chat,
        token: state.token,
        text,
        name: state.name,
        contact: state.contact,
        locale: getLocale(),
        page: window.location.pathname,
        campaign: campaignSource(),
        website: ""
      })
    });

  let res: Response;
  try {
    res = await post();
    // The conversation is gone (older than 90 days): start a new one.
    if (res.status === 404 && state.chat) {
      state.chat = state.token = state.reference = null;
      res = await post();
    }
  } catch {
    res = new Response(null, { status: 0 });
  }

  const pending = state.messages.find((m) => m.id === tempId);
  if (res.ok) {
    const data = (await res.json()) as { chat: string; token: string; reference: string; id: number };
    state.chat = data.chat;
    state.token = data.token;
    state.reference = data.reference;
    if (pending) pending.id = data.id;
    save();
    startLivePolling(fast);
    changed();
    return "ok";
  }
  if (pending) pending.failed = true;
  changed();
  if (res.status === 429) return "limit";
  if (res.status === 503) return "unavailable";
  return "error";
}

/** Keeps the visitor's name and contact; they go with the next message (and are sent now if the chat exists). */
export async function setLiveDetails(name: string, contact: string, note: string): Promise<void> {
  state.name = name.trim().slice(0, 120);
  state.contact = contact.trim().slice(0, 160);
  state.detailsDone = true;
  save();
  changed();
  if ((state.name || state.contact) && state.chat) await sendLive(note);
}

export function skipLiveDetails(): void {
  state.detailsDone = true;
  save();
  changed();
}

async function poll(): Promise<void> {
  if (!state.chat || !state.token || document.hidden) return;
  const after = Math.max(0, ...state.messages.filter((m) => m.id > 0).map((m) => m.id));
  try {
    const res = await fetch(`${ENDPOINT}?chat=${state.chat}&token=${state.token}&after=${after}`, { cache: "no-store" });
    if (res.status === 404) {
      // Expired on the server: forget it (a new message starts a new conversation).
      state = { ...empty(), name: state.name, contact: state.contact, detailsDone: state.detailsDone };
      save();
      changed();
      return;
    }
    if (!res.ok) return;
    const data = (await res.json()) as { messages: LiveMessage[] };
    if (merge(data.messages)) {
      save();
      changed();
    }
  } catch {
    /* offline for a moment: the next tick tries again */
  }
}

/** Polls fast while the panel is open, slowly for a few hours after the last activity. */
export function startLivePolling(open: boolean): void {
  fast = open;
  window.clearTimeout(timer);
  if (!state.chat) return;
  const tick = () => {
    const recent = Date.now() - state.updated < SLOW_FOR_MS || state.messages.some((m) => Date.now() - Date.parse(m.at) < SLOW_FOR_MS);
    if (!fast && !recent) return;
    void poll().finally(() => {
      timer = window.setTimeout(tick, fast ? FAST_MS : SLOW_MS);
    });
  };
  tick();
}
