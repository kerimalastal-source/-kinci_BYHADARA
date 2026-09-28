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
