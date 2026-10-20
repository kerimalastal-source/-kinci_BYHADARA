import { supabase } from "../lib/supabase";

/** What /api/meta-leads found for one lead form (api/_lib/metaLeads.ts). */
export interface LeadFormReport {
  id: string;
  name: string;
  found: number;
  sent: number;
  already: number;
  failed: number;
  error?: string;
}

export interface LeadCheckResult {
  pageToken?: boolean;
  forms?: LeadFormReport[];
  sent?: number;
  /** A setting the server still needs: token, page, blob or telegram. */
  missing?: string;
  error?: string;
  status?: number;
}

/** Asks Meta for the lead forms' new leads now (admin button); null when the server wasn't reached. */
export async function checkLeadFormsNow(): Promise<LeadCheckResult | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: "session" };
  try {
    const res = await fetch("/api/meta-leads", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 403) return { error: "forbidden", status: 403 };
    const body = (await res.json().catch(() => null)) as LeadCheckResult | null;
    if (body && (res.ok || body.missing || body.error)) return body;
    return { error: "http", status: res.status };
  } catch {
    return null;
  }
}
