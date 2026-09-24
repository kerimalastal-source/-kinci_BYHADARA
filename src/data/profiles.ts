import { supabase } from "../lib/supabase";
import type { Profile } from "../auth/session";

export async function fetchProfileById(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}
