import { supabase } from "../lib/supabase";
import type { Currency } from "./crm";

/** Money spent on an ad source (and optionally one campaign) over a period (public.ad_spend, 0010). */
export interface AdSpend {
  id: string;
  source: string;
  campaign: string | null;
  starts_on: string;
  ends_on: string;
  amount: number;
  currency: Currency;
  note: string | null;
  created_at: string;
}

/** What admin_ad_report() returns for a period (supabase/migrations/0010). */
export interface AdReport {
  from: string;
  to: string;
  visits: { source: string; campaign: string | null; visitors: number }[];
  leads: { source: string; campaign: string | null; inquiries: number; bookings: number }[];
  won: { source: string; campaign: string | null; value: number | null; currency: Currency }[];
  /** Spend entries overlapping the period, the amount prorated to its days. */
  spend: { id: string; source: string; campaign: string | null; amount: number; currency: Currency }[];
}

const missing = (code?: string) => ["42P01", "PGRST205", "PGRST202"].includes(code ?? "");

/** All spend entries, newest period first; null when migration 0010 hasn't run. */
export async function fetchAdSpend(): Promise<AdSpend[] | null> {
  const { data, error } = await supabase.from("ad_spend").select("*").order("starts_on", { ascending: false }).limit(500);
  if (error) {
    if (!missing(error.code)) console.error(error);
    return null;
  }
  return (data ?? []) as AdSpend[];
}

export async function addAdSpend(entry: Omit<AdSpend, "id" | "created_at">): Promise<AdSpend | null> {
  const { data, error } = await supabase.from("ad_spend").insert(entry).select("*").single();
  if (error) {
    console.error(error);
    return null;
  }
  return data as AdSpend;
}

export async function deleteAdSpend(id: string): Promise<boolean> {
  const { error } = await supabase.from("ad_spend").delete().eq("id", id);
  if (error) console.error(error);
  return !error;
}

/** The report for from..to (YYYY-MM-DD, Istanbul days), or null when unavailable. */
export async function fetchAdReport(from: string, to: string): Promise<AdReport | null> {
  const { data, error } = await supabase.rpc("admin_ad_report", { p_from: from, p_to: to });
  if (error) {
    if (!missing(error.code)) console.error(error);
    return null;
  }
  const report = data as (AdReport & { error?: string }) | null;
  return report && !report.error ? report : null;
}
