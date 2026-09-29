import { supabase } from "../lib/supabase";

/** What /api/social-publish did for each of today's posts (api/_lib/social.ts). */
export interface SocialPublishResult {
  date?: string;
  found?: boolean;
  results?: { post: string; facebook: string; instagram: string; errors: string[] }[];
  error?: string;
}

/** Publishes today's social posts now (admin button); null when the request didn't go through. */
export async function publishSocialNow(): Promise<SocialPublishResult | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  try {
    const res = await fetch("/api/social-publish", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 403 || res.status === 404) return null;
    return (await res.json().catch(() => ({ error: "failed" }))) as SocialPublishResult;
  } catch {
    return null;
  }
}
