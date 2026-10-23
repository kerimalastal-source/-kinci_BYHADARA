import { supabase } from "../lib/supabase";

/** Where a customer is in the sale (public.crm_leads, supabase/migrations/0010). */
export const STAGES = ["new", "contacted", "no_reply", "tour", "visit", "negotiation", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];
/** The stages still being worked on (not won or lost). */
export const OPEN_STAGES: readonly Stage[] = ["new", "contacted", "no_reply", "tour", "visit", "negotiation"];
/** Stages and fields added by migration 0032 ("no reply" and the budget range). */
export const STAGES_0032: readonly Stage[] = ["no_reply"];

/** The customer's approximate budget in US dollars (migration 0032), in thousands. */
export const BUDGETS = ["under100", "100-200", "200-300", "300-400", "400-500", "500-600", "600-1000", "1000plus"] as const;
export type Budget = (typeof BUDGETS)[number];

/** "$100,000 – $200,000", "Under $100,000", "$1,000,000+": numbers in the same form in every language. */
export function budgetLabel(budget: Budget): string {
  const usd = (k: number) => `$${(k * 1000).toLocaleString("en-US")}`;
  if (budget === "under100") return `< ${usd(100)}`;
  if (budget === "1000plus") return `${usd(1000)}+`;
  const [from, to] = budget.split("-").map(Number);
  return `${usd(from)} – ${usd(to)}`;
}

export const CURRENCIES = ["USD", "EUR", "TRY", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** One customer's sale: stage, deal, next follow-up. Admins only. */
export interface CrmLead {
  id: string;
  /** "e:<email>" and "p:<last 9 phone digits>" — the same keys the customers page groups by. */
  keys: string[];
  name: string;
  email: string | null;
  phone: string | null;
  stage: Stage;
  deal_value: number | null;
  currency: Currency;
  /** Approximate budget range (migration 0032; missing before it runs). */
  budget?: Budget | null;
  /** Project slug of the deal. */
  project: string | null;
  lost_reason: string | null;
  follow_up_at: string | null;
  follow_up_note: string | null;
  follow_up_sent_at: string | null;
  stage_changed_at: string;
  won_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CrmChanges = Partial<Pick<CrmLead, "stage" | "deal_value" | "currency" | "budget" | "project" | "lost_reason" | "follow_up_at" | "follow_up_note">>;

/** Who the row belongs to: refreshed on every save, so a customer's new email or phone joins it. */
export interface CrmPerson {
  keys: string[];
  name: string;
  email: string | null;
  phone: string | null;
}

/** Phone numbers written differently (+90 555…, 0555…) match on their last 9 digits. */
export const phoneKey = (phone: string) => phone.replace(/\D/g, "").slice(-9);

/** A customer's matching keys from their emails and phones (too-short ones are left out). */
export function personKeys(emails: string[], phones: string[]): string[] {
  const keys = [...emails.map((e) => `e:${e.trim().toLowerCase()}`), ...phones.map((p) => `p:${phoneKey(p)}`)];
  return [...new Set(keys.filter((k) => k.length >= 6))];
}

/** All pipeline rows, or null when migration 0010 hasn't run yet (the table doesn't exist). */
export async function fetchCrmLeads(): Promise<CrmLead[] | null> {
  const { data, error } = await supabase.from("crm_leads").select("*").order("updated_at", { ascending: false }).limit(2000);
  if (error) {
    if (!["42P01", "PGRST205"].includes(error.code ?? "")) console.error(error);
    return null;
  }
  return (data ?? []) as CrmLead[];
}

/** The row for a customer with these keys (the most recently updated one if several match). */
export function leadFor(leads: CrmLead[], keys: string[]): CrmLead | null {
  return leads.find((lead) => lead.keys.some((k) => keys.includes(k))) ?? null;
}

/** True when the changes use what migration 0032 added (a budget or the "no reply" stage). */
export const uses0032 = (changes: CrmChanges) => !!changes.budget || (!!changes.stage && STAGES_0032.includes(changes.stage));

/**
 * Creates the customer's row on first save, or updates it (merging in any new keys).
 * Returns "needs0032" when the save failed only because migration 0032 hasn't run yet.
 */
export async function saveCrmLead(existing: CrmLead | null, person: CrmPerson, changes: CrmChanges): Promise<CrmLead | null | "needs0032"> {
  // Before 0032 the column doesn't exist, so an empty budget is left out rather than sent as null.
  if (changes.budget === null && !existing?.budget) {
    changes = { ...changes };
    delete changes.budget;
  }
  const row = { ...person, keys: [...new Set([...(existing?.keys ?? []), ...person.keys])].slice(0, 20), ...changes };
  const query = existing
    ? supabase.from("crm_leads").update(row).eq("id", existing.id).select("*").single()
    : supabase.from("crm_leads").insert(row).select("*").single();
  const { data, error } = await query;
  if (error) {
    // 23514: the old stage check; PGRST204 / 42703: no budget column.
    if (uses0032(changes) && ["23514", "PGRST204", "42703"].includes(error.code ?? "")) return "needs0032";
    console.error(error);
    return null;
  }
  return data as CrmLead;
}

/* Istanbul is UTC+3 all year: follow-up times are typed and shown in Istanbul time. */
const ISTANBUL_OFFSET_MS = 3 * 3_600_000;

/** "2026-10-02T15:30" (Istanbul) for a datetime-local input. */
export function toIstanbulInput(iso: string | null): string {
  return iso ? new Date(Date.parse(iso) + ISTANBUL_OFFSET_MS).toISOString().slice(0, 16) : "";
}

/** The ISO time of a datetime-local value typed in Istanbul time, or null. */
export function fromIstanbulInput(value: string): string | null {
  const ms = Date.parse(`${value}:00Z`);
  return value && Number.isFinite(ms) ? new Date(ms - ISTANBUL_OFFSET_MS).toISOString() : null;
}
