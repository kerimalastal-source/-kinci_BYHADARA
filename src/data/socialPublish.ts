import { supabase } from "../lib/supabase";

/** What /api/social-publish did for each of today's posts (api/_lib/social.ts). */
export interface SocialPublishResult {
  date?: string;
  found?: boolean;
  results?: { post: string; facebook: string; instagram: string; errors: string[] }[];
  /** The admin button: publishing continues in the background, the report goes to Telegram. */
  started?: boolean;
  error?: string;
  /** HTTP status when the server answered with an error the page has no message for. */
  status?: number;
}

/** Publishes today's social posts now (admin button); null when the request didn't reach the server. */
export async function publishSocialNow(): Promise<SocialPublishResult | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: "session" };
  try {
    const res = await fetch("/api/social-publish", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 403) return { error: "forbidden", status: 403 };
    const body = (await res.json().catch(() => null)) as SocialPublishResult | null;
    if (body && (res.ok || body.error)) return body;
    return { error: "http", status: res.status };
  } catch {
    return null;
  }
}
