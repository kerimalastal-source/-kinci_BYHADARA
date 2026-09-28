import { supabase } from "../lib/supabase";
import { lookup, isLocale } from "../i18n/dictionaries";

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
  /** Set when the team moved the booking to another time (migration 0005). */
  rescheduled_at?: string | null;
  /** The visitor's answer to the new time, from the link in their email. */
  customer_reply?: "accepted" | "declined" | null;
  customer_reply_at?: string | null;
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

export type AdminResult =
  | { ok: true; booking: TourBooking; emailSent: boolean }
  | { ok: false; error: "slot_taken" | "invalid" | "error" };

/** Project names in the booking's site language and in Arabic, for the visitor's email. */
function projectNames(booking: TourBooking): Record<string, { name: string; nameAr: string }> {
  const locale = isLocale(booking.site_locale) ? booking.site_locale : "en";
  const names: Record<string, { name: string; nameAr: string }> = {};
  for (const slug of booking.projects) {
    const name = lookup(locale, `projectsData.${slug}.name`);
    const nameAr = lookup("ar", `projectsData.${slug}.name`);
    if (typeof name === "string" && typeof nameAr === "string") names[slug] = { name, nameAr };
  }
  return names;
}

/**
 * Confirms a booking or moves it to a new time through /api/booking-admin, which also
 * emails the visitor ("confirmed" / "new time — does it suit you?"). The request is made
 * with the admin's own session, so the database checks they are an admin.
 */
export async function bookingAdminAction(
  booking: TourBooking,
  action: "confirm" | "reschedule",
  slot?: string
): Promise<AdminResult> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: "error" };
    const res = await fetch("/api/booking-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, id: booking.id, slot, names: projectNames(booking) })
    });
    const body = (await res.json().catch(() => null)) as { booking?: TourBooking; emailSent?: boolean; error?: string } | null;
    if (res.ok && body?.booking) return { ok: true, booking: body.booking, emailSent: Boolean(body.emailSent) };
    if (res.status === 409) return { ok: false, error: "slot_taken" };
    if (res.status === 400) return { ok: false, error: "invalid" };
    return { ok: false, error: "error" };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "error" };
  }
}
