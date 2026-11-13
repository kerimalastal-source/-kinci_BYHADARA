import { supabase } from "../lib/supabase";

/** What happened with a customer (public.crm_activities, supabase/migrations/0037). */
export const ACTIVITY_KINDS = ["call", "whatsapp", "email", "meeting", "tour", "offer", "note"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number] | "stage";

export const ACTIVITY_ICONS: Record<ActivityKind, string> = {
  call: "📞",
  whatsapp: "💬",
  email: "✉️",
  meeting: "🤝",
  tour: "🎥",
  offer: "💰",
  note: "📝",
  stage: "🔀"
};

export interface CrmActivity {
  id: string;
  lead_id: string;
  kind: ActivityKind;
  /** The team's words; for "stage": "<old>><new>" (old empty for a new customer). */
  body: string;
  happened_at: string;
  created_at: string;
}

const MISSING = ["42P01", "PGRST205"];

/** Every activity, newest first; null when migration 0037 hasn't run yet. */
export async function fetchActivities(): Promise<CrmActivity[] | null> {
  const { data, error } = await supabase
    .from("crm_activities")
    .select("id, lead_id, kind, body, happened_at, created_at")
    .order("happened_at", { ascending: false })
    .limit(5000);
  if (error) {
    if (!MISSING.includes(error.code ?? "")) console.error(error);
    return null;
  }
  return (data ?? []) as CrmActivity[];
}

/** A customer's activities (the list is already newest first). */
export const activitiesOf = (all: CrmActivity[], leadId: string | null | undefined) => (leadId ? all.filter((a) => a.lead_id === leadId) : []);

/** Adds one; "needs0037" when the table doesn't exist yet, null on any other failure. */
export async function addActivity(row: { lead_id: string; kind: ActivityKind; body: string; happened_at?: string | null }): Promise<CrmActivity | null | "needs0037"> {
  const { data, error } = await supabase
    .from("crm_activities")
    .insert({ lead_id: row.lead_id, kind: row.kind, body: row.body, ...(row.happened_at ? { happened_at: row.happened_at } : {}) })
    .select("id, lead_id, kind, body, happened_at, created_at")
    .single();
  if (error) {
    if (MISSING.includes(error.code ?? "")) return "needs0037";
    console.error(error);
    return null;
  }
  return data as CrmActivity;
}

export async function deleteActivity(id: string): Promise<boolean> {
  const { error } = await supabase.from("crm_activities").delete().eq("id", id);
  if (error) console.error(error);
  return !error;
}
