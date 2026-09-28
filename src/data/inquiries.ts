import { supabase } from "../lib/supabase";

export type InquiryStatus = "new" | "contacted" | "interested" | "closed";
export type InquiryKind = "contact" | "property_request" | "consultation";

/** A message from the site's forms (public.inquiries, supabase/migrations/0007). Admins only. */
export interface Inquiry {
  id: string;
  reference: string;
  kind: InquiryKind;
  name: string;
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
