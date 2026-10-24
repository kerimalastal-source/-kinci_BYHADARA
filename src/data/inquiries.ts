import { supabase } from "../lib/supabase";

export type InquiryStatus = "new" | "contacted" | "interested" | "closed";
/** "manual": a customer the team added by hand on the pipeline page (migration 0019). */
export type InquiryKind = "contact" | "property_request" | "consultation" | "manual";

/** A message from the site's forms (public.inquiries, supabase/migrations/0007). Admins only. */
export interface Inquiry {
  id: string;
  reference: string;
  kind: InquiryKind;
  name: string;
  /** "" for a customer added by hand without an email. */
  email: string;
  phone: string;
  subject: string | null;
  message: string | null;
  projects: string[];
  interests: string[];
  /** The form's other answers as option keys (property type, budget, service…). */
  details: Record<string, string>;
  site_locale: string | null;
  source: string | null;
  page: string | null;
  status: InquiryStatus;
  /** The team's internal notes; never shown to the visitor. */
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** The latest inquiries, newest first (older ones stay in the database until purged). */
export async function fetchInquiries(): Promise<Inquiry[]> {
  const { data, error } = await supabase.from("inquiries").select("*").order("created_at", { ascending: false }).limit(1000);
  if (error) throw error;
  return (data ?? []) as Inquiry[];
}

/** Changes an inquiry's status and/or internal notes (the only columns admins may edit). */
export async function updateInquiry(id: string, changes: { status?: InquiryStatus; notes?: string | null }): Promise<Inquiry | null> {
  const { data, error } = await supabase.from("inquiries").update(changes).eq("id", id).select("*").single();
  if (error) {
    console.error(error);
    return null;
  }
  return data as Inquiry;
}

/** The key under adminInquiries.kinds.*: a Buyer's Guide question (details.form = "guide") or the form's kind. */
export function inquiryKindKey(inquiry: { kind: string; details?: Record<string, string> | null }): string {
  return inquiry.details?.form === "guide" ? "guide" : inquiry.kind;
}

/** How the team first spoke with a customer they add by hand. */
export const MANUAL_CHANNELS = ["whatsapp", "call", "office", "other"] as const;
export type ManualChannel = (typeof MANUAL_CHANNELS)[number];

export interface ManualCustomer {
  name: string;
  phone: string;
  email: string;
  /** ISO 3166 code, or "". */
  country: string;
  channel: ManualChannel;
  /** Campaign string as the site's forms save it ("utm_source=facebook · utm_campaign=gulf-whatsapp"), or "". */
  source: string;
  projects: string[];
  note: string;
}

/**
 * Adds a customer by hand (a WhatsApp chat, a call, an office visit) as an inquiry of kind
 * "manual" (admin_add_customer(), migration 0019). "unavailable" until 0019 has run.
 */
export async function addManualCustomer(c: ManualCustomer): Promise<{ reference: string } | { error: "forbidden" | "invalid" | "unavailable" | "failed" }> {
  const { data, error } = await supabase.rpc("admin_add_customer", {
    p_name: c.name,
    p_phone: c.phone,
    p_email: c.email,
    p_country: c.country,
    p_channel: c.channel,
    p_source: c.source,
    p_projects: c.projects,
    p_note: c.note
  });
  if (error) {
    console.error(error);
    return { error: error.code === "PGRST202" || error.code === "42883" ? "unavailable" : "failed" };
  }
  const result = data as { reference?: string; error?: "forbidden" | "invalid" };
  return result.reference ? { reference: result.reference } : { error: result.error ?? "failed" };
}

export interface CustomerEdit {
  inquiryIds: string[];
  bookingIds: string[];
  /** The customer's pipeline row, so it keeps matching them (or null). */
  leadId: string | null;
  /** The main phone and email shown in the form; the records that have them get the new ones. */
  oldPhone: string;
  oldEmail: string;
  name: string;
  phone: string;
  email: string;
  /** The latest hand-added inquiry, which also takes the country, channel and source (or null). */
  manualId: string | null;
  country: string;
  channel: ManualChannel | "";
  source: string;
}

/**
 * Corrects a customer's details on all their records (admin_update_customer(), migration 0033).
 * "unavailable" until 0033 has run.
 */
export async function updateCustomer(c: CustomerEdit): Promise<{ ok: true } | { error: "forbidden" | "invalid" | "unavailable" | "failed" }> {
  const { data, error } = await supabase.rpc("admin_update_customer", {
    p_inquiry_ids: c.inquiryIds,
    p_booking_ids: c.bookingIds,
    p_lead_id: c.leadId,
    p_old_phone: c.oldPhone,
    p_old_email: c.oldEmail,
    p_name: c.name,
    p_phone: c.phone,
    p_email: c.email,
    p_manual_id: c.manualId,
    p_country: c.country,
    p_channel: c.channel,
    p_source: c.source
  });
  if (error) {
    console.error(error);
    return { error: error.code === "PGRST202" || error.code === "42883" ? "unavailable" : "failed" };
  }
  const result = data as { ok?: boolean; error?: "forbidden" | "invalid" };
  return result.ok ? { ok: true } : { error: result.error ?? "failed" };
}
