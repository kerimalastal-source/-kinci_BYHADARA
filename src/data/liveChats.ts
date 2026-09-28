import { supabase } from "../lib/supabase";

/** A live chat conversation (public.live_chats, supabase/migrations/0011). Admins only. */
export interface LiveChat {
  id: string;
  reference: string;
  name: string | null;
  contact: string | null;
  locale: string | null;
  page: string | null;
  country: string | null;
  city: string | null;
  campaign: string | null;
  last_visitor_at: string;
  last_team_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiveChatMessage {
  id: number;
  chat_id: string;
  sender: "visitor" | "team";
  body: string;
  created_at: string;
}

const missing = (code?: string) => ["42P01", "PGRST205", "PGRST202"].includes(code ?? "");

/** Conversations, latest activity first; null when migration 0011 hasn't run. */
export async function fetchLiveChats(): Promise<LiveChat[] | null> {
  const { data, error } = await supabase
    .from("live_chats")
    .select("id, reference, name, contact, locale, page, country, city, campaign, last_visitor_at, last_team_at, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) {
    if (!missing(error.code)) console.error(error);
    return null;
  }
  return (data ?? []) as LiveChat[];
}

/** The latest message of each listed conversation (for the list's preview). */
export async function fetchLastMessages(chatIds: string[]): Promise<Map<string, LiveChatMessage>> {
  const last = new Map<string, LiveChatMessage>();
  if (!chatIds.length) return last;
  const { data, error } = await supabase
    .from("live_chat_messages")
    .select("*")
    .in("chat_id", chatIds.slice(0, 200))
    .order("id", { ascending: false })
    .limit(1000);
  if (error) console.error(error);
  for (const m of (data ?? []) as LiveChatMessage[]) if (!last.has(m.chat_id)) last.set(m.chat_id, m);
  return last;
}

export async function fetchChatMessages(chatId: string): Promise<LiveChatMessage[]> {
  const { data, error } = await supabase.from("live_chat_messages").select("*").eq("chat_id", chatId).order("id").limit(500);
  if (error) console.error(error);
  return (data ?? []) as LiveChatMessage[];
}

export async function replyToChat(chatId: string, body: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("live_chat_admin_reply", { p_chat: chatId, p_body: body });
  if (error) console.error(error);
  return !error && !(data as { error?: string } | null)?.error;
}

/** Whether Telegram replies reach the site (api/telegram-setup.ts); `activate` switches them on. */
export async function telegramReplies(activate = false): Promise<{ active: boolean; missing?: string; lastError?: string | null } | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  try {
    const res = await fetch("/api/telegram-setup", { method: activate ? "POST" : "GET", headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 403 || res.status === 404) return null;
    return (await res.json()) as { active: boolean; missing?: string; lastError?: string | null };
  } catch {
    return null;
  }
}
