import { supabase } from "../lib/supabase";

/** A private video tour booking (public.tour_bookings, supabase/migrations/0003). Admins only. */
export interface TourBooking {
  id: string;
  reference: string;
  slot_start: string;
  projects: string[];
  focus: string[];
  app: string;
  tour_language: string;
  name: string;
  email: string;
  phone: string;
  contact_method: string;
  site_locale: string | null;
  visitor_timezone: string | null;
  source: string | null;
  status: "booked" | "confirmed" | "cancelled";
  created_at: string;
  updated_at: string;
}

export async function fetchTourBookings(): Promise<TourBooking[]> {
  const { data, error } = await supabase.from("tour_bookings").select("*").order("slot_start", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TourBooking[];
}

/**
 * Changes a booking's status. Restoring a cancelled booking fails with "slot_taken" when
 * someone else has booked that hour since (one active booking per hour).
 */
export async function setTourBookingStatus(id: string, status: TourBooking["status"]): Promise<"ok" | "slot_taken" | "error"> {
  const { error } = await supabase.from("tour_bookings").update({ status }).eq("id", id);
  if (!error) return "ok";
  console.error(error);
  return error.code === "23505" ? "slot_taken" : "error";
}
