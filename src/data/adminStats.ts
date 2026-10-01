import { supabase } from "../lib/supabase";

/** What admin_visit_stats() returns (supabase/migrations/0008). No personal data. */
export interface VisitStats {
  days: number;
  since: string;
  totals: { visitors: number; pages: number; multi_page: number };
  daily: { day: string; visitors: number; pages: number }[];
  sources: { source: string; visitors: number }[];
  campaigns: { source: string; campaign: string; visitors: number }[];
  countries: { country: string; visitors: number }[];
  locales: { locale: string; visitors: number }[];
  landings: { page: string; visitors: number }[];
  projects: { slug: string; visitors: number; views: number }[];
  leads: { inquiries: number; bookings: number };
  lead_sources: { source: string; inquiries: number; bookings: number; total: number }[];
}

/** The last `days` days (Istanbul time, today included), or null when 0008 hasn't run. */
export async function fetchVisitStats(days: number): Promise<VisitStats | null> {
  const { data, error } = await supabase.rpc("admin_visit_stats", { p_days: days });
  if (error) {
    console.error(error);
    return null;
  }
  const stats = data as (VisitStats & { error?: string }) | null;
  return stats && !stats.error ? stats : null;
}

/** What visits did with the cookie notice (admin_consent_stats(), supabase/migrations/0009). */
export interface ConsentStats {
  shown: number;
  granted: number;
  denied: number;
  ignored: number;
}

/** Same period as fetchVisitStats, or null when 0009 hasn't run. */
export async function fetchConsentStats(days: number): Promise<ConsentStats | null> {
  const { data, error } = await supabase.rpc("admin_consent_stats", { p_days: days });
  if (error) {
    // Before migration 0009 the function doesn't exist; the panel just says so.
    if (error.code !== "PGRST202") console.error(error);
    return null;
  }
  const stats = data as (ConsentStats & { error?: string }) | null;
  return stats && !stats.error ? stats : null;
}

/** What admin_behavior_stats() returns (supabase/migrations/0016): counts per visit, no personal data. */
export interface BehaviorStats {
  days: number;
  visits: number;
  /** Visits with a WhatsApp, call, email, "I'm interested" or sent form. */
  contacted: number;
  devices: { device: string; visits: number; contacted: number }[];
  actions: { action: string; count: number; sessions: number }[];
  projects: { slug: string; action: string; sessions: number }[];
  forms: { form: string; started: number; sent: number }[];
}

/** Same period as fetchVisitStats, or null when 0015/0016 haven't run. */
export async function fetchBehaviorStats(days: number): Promise<BehaviorStats | null> {
  const { data, error } = await supabase.rpc("admin_behavior_stats", { p_days: days });
  if (error) {
    // Before migration 0016 the function doesn't exist; the section just says so.
    if (error.code !== "PGRST202") console.error(error);
    return null;
  }
  const stats = data as (BehaviorStats & { error?: string }) | null;
  return stats && !stats.error ? stats : null;
}
