-- HADARA Real Estate — video tour bookings: the visitor picks another time themselves.
-- Run once in the Supabase SQL Editor of the HADARA Real Estate project
-- (khibypqmvnxuetmvjcnn), AFTER 0005_tour_booking_updates.sql. Safe to run twice.
--
-- When the team moves a tour and the visitor answers "I need another time", the answer
-- page (/api/tour-reply) lets them choose a free half hour. tour_booking_propose() moves
-- the booking to that time right away — the unique slot index keeps two bookings from
-- holding the same time — and marks it "proposed" until the team confirms it.

-- Guard: 0005 must have run first.
do $$
begin
  if to_regprocedure('public.tour_booking_reply(uuid, text)') is null or to_regprocedure('public.tour_slot_open(timestamptz)') is null then
    raise exception 'Run 0005_tour_booking_updates.sql first, in the HADARA Real Estate Supabase project.';
  end if;
end
$$;

-- "proposed": the visitor chose this time themselves, waiting for the team to confirm it.
alter table public.tour_bookings drop constraint if exists tour_bookings_customer_reply_check;
alter table public.tour_bookings
  add constraint tour_bookings_customer_reply_check check (customer_reply in ('accepted', 'declined', 'proposed'));

-- Moves the booking behind a reply link to a time the visitor picked. Same rules as a new
-- booking: a free half hour 9:00–18:30 Istanbul time outside the lunch break, from one hour
-- to 15 days ahead. Returns the booking as tour_booking_reply() does, or
-- {"error": "not_found" | "past" | "invalid" | "slot_taken"}.
create or replace function public.tour_booking_propose(p_token uuid, p_slot timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  booking public.tour_bookings;
begin
  select * into booking from public.tour_bookings
  where reply_token = p_token and status <> 'cancelled';
  if booking.id is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  if booking.slot_start < now() then
    return jsonb_build_object('error', 'past');
  end if;
  if p_slot is null or not public.tour_slot_open(p_slot)
     or p_slot < now() + interval '1 hour' or p_slot > now() + interval '15 days' then
    return jsonb_build_object('error', 'invalid');
  end if;

  begin
    update public.tour_bookings
    set slot_start = p_slot,
        status = 'booked',
        customer_reply = 'proposed',
        customer_reply_at = now()
    where id = booking.id;
  exception when unique_violation then
    return jsonb_build_object('error', 'slot_taken');
  end;

  return public.tour_booking_reply(p_token, null);
end;
$$;

revoke all on function public.tour_booking_propose(uuid, timestamptz) from public;
grant execute on function public.tour_booking_propose(uuid, timestamptz) to anon;
