-- HADARA Real Estate — video tour bookings: half-hour slots, lunch break, confirm and
-- reschedule emails, and the visitor's answer to a new time.
-- Run once in the Supabase SQL Editor of the HADARA Real Estate project
-- (khibypqmvnxuetmvjcnn), AFTER 0003_tour_bookings.sql. Safe to run twice.
--
-- What changes:
--   * Tours start every half hour, 9:00–18:30 Istanbul time, except the lunch break:
--     12:00, 12:30 and 13:00 can't be booked by visitors (book_tour()).
--   * The team can move a booking to another time (admin_reschedule_tour(), admins only).
--     Each move creates a fresh reply token; the visitor's email links to /api/tour-reply
--     with it, and tour_booking_reply() records "accepted" / "declined" for that time only.

-- Guard: stop right here if this is not the HADARA Real Estate database, or 0003 hasn't run.
do $$
begin
  if to_regclass('public.tour_bookings') is null or to_regprocedure('public.is_admin()') is null then
    raise exception 'Run 0003_tour_bookings.sql first, in the HADARA Real Estate Supabase project (the one with the resale tables).';
  end if;
end
$$;

alter table public.tour_bookings add column if not exists rescheduled_at timestamptz;
alter table public.tour_bookings add column if not exists reply_token uuid;
alter table public.tour_bookings add column if not exists customer_reply text;
alter table public.tour_bookings add column if not exists customer_reply_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tour_bookings_customer_reply_check') then
    alter table public.tour_bookings
      add constraint tour_bookings_customer_reply_check check (customer_reply in ('accepted', 'declined'));
  end if;
end
$$;

create unique index if not exists tour_bookings_reply_token_idx on public.tour_bookings (reply_token);

-- Admins read the new columns too (the table grant covers them); the reply token is only
-- ever handed out by admin_reschedule_tour() to the site's email.

-- Is this Istanbul start time one visitors may book? Half hours 9:00–18:30, no lunch break.
create or replace function public.tour_slot_open(p_slot timestamptz)
returns boolean
language sql
stable
as $$
  select extract(second from p_slot) = 0
     and extract(minute from p_slot at time zone 'Europe/Istanbul') in (0, 30)
     and (p_slot at time zone 'Europe/Istanbul')::time between time '09:00' and time '18:30'
     and not ((p_slot at time zone 'Europe/Istanbul')::time between time '12:00' and time '13:00');
$$;

-- Books a tour (replaces 0003's version: half-hour slots and the lunch break).
-- Returns {"reference": "HT-XXXXXX"} or {"error": "invalid" | "slot_taken" | "limit"}.
create or replace function public.book_tour(
  p_slot timestamptz,
  p_projects text[],
  p_focus text[],
  p_app text,
  p_language text,
  p_name text,
  p_email text,
  p_phone text,
  p_contact text,
  p_locale text,
  p_timezone text,
  p_source text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ref text;
  upcoming int;
begin
  if p_slot is null or not public.tour_slot_open(p_slot)
     or p_slot < now() + interval '1 hour' or p_slot > now() + interval '15 days' then
    return jsonb_build_object('error', 'invalid');
  end if;
  if coalesce(array_length(p_projects, 1), 0) not between 1 and 20
     or length(trim(coalesce(p_name, ''))) not between 1 and 100
     or coalesce(p_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 254
     or length(coalesce(p_phone, '')) not between 6 and 30
     or p_app not in ('whatsapp', 'facetime', 'zoom', 'meet')
     or p_language not in ('ar', 'en', 'tr')
     or p_contact not in ('email', 'phone', 'whatsapp', 'telegram', 'viber') then
    return jsonb_build_object('error', 'invalid');
  end if;

  select count(*) into upcoming from public.tour_bookings
  where status <> 'cancelled' and slot_start > now() and (lower(email) = lower(p_email) or phone = p_phone);
  if upcoming >= 3 then
    return jsonb_build_object('error', 'limit');
  end if;

  loop
    ref := 'HT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.tour_bookings (
        reference, slot_start, projects, focus, app, tour_language, name, email, phone,
        contact_method, site_locale, visitor_timezone, source
      ) values (
        ref, p_slot, p_projects, coalesce(p_focus, '{}'), p_app, p_language, trim(p_name), trim(p_email), trim(p_phone),
        p_contact, left(p_locale, 8), left(p_timezone, 64), left(p_source, 300)
      );
      exit;
    exception when unique_violation then
      if exists (select 1 from public.tour_bookings where slot_start = p_slot and status <> 'cancelled') then
        return jsonb_build_object('error', 'slot_taken');
      end if;
      -- otherwise the random reference collided: try another one
    end;
  end loop;

  perform public.purge_old_tour_bookings();
  return jsonb_build_object('reference', ref);
end;
$$;

-- Moves a booking to another time (admins only). The team may choose any half hour from
-- 9:00 to 18:30, lunch break included. The booking goes back to "booked" (waiting for the
-- visitor's answer), the earlier answer is cleared and a new reply token is issued for
-- the email about the new time.
-- Returns the updated booking as JSON, or {"error": "forbidden" | "invalid" | "not_found" | "slot_taken"}.
create or replace function public.admin_reschedule_tour(p_id uuid, p_slot timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  local_time time := (p_slot at time zone 'Europe/Istanbul')::time;
  booking public.tour_bookings;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if p_slot is null or extract(second from p_slot) <> 0
     or extract(minute from p_slot at time zone 'Europe/Istanbul') not in (0, 30)
     or local_time < time '09:00' or local_time > time '18:30'
     or p_slot < now() or p_slot > now() + interval '60 days' then
    return jsonb_build_object('error', 'invalid');
  end if;

  begin
    update public.tour_bookings
    set slot_start = p_slot,
        status = 'booked',
        rescheduled_at = now(),
        reply_token = gen_random_uuid(),
        customer_reply = null,
        customer_reply_at = null
    where id = p_id and status <> 'cancelled'
    returning * into booking;
  exception when unique_violation then
    return jsonb_build_object('error', 'slot_taken');
  end;

  if booking.id is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  return to_jsonb(booking);
end;
$$;

-- The visitor's answer to a new time, from the link in the reschedule email.
-- p_answer null only reads the booking (the page shows the time before the visitor answers).
-- "accepted" also confirms the booking. Returns what the answer page needs, or
-- {"error": "not_found"} for an unknown or outdated link, {"error": "past"} after the tour.
create or replace function public.tour_booking_reply(p_token uuid, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  booking public.tour_bookings;
begin
  if p_answer is not null and p_answer not in ('accepted', 'declined') then
    return jsonb_build_object('error', 'invalid');
  end if;

  select * into booking from public.tour_bookings
  where reply_token = p_token and status <> 'cancelled';
  if booking.id is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  if p_answer is not null and booking.slot_start < now() then
    return jsonb_build_object('error', 'past');
  end if;

  if p_answer is not null then
    update public.tour_bookings
    set customer_reply = p_answer,
        customer_reply_at = now(),
        status = case when p_answer = 'accepted' then 'confirmed' else status end
    where id = booking.id
    returning * into booking;
  end if;

  return jsonb_build_object(
    'reference', booking.reference,
    'slot_start', booking.slot_start,
    'name', booking.name,
    'email', booking.email,
    'phone', booking.phone,
    'contact_method', booking.contact_method,
    'projects', to_jsonb(booking.projects),
    'app', booking.app,
    'site_locale', booking.site_locale,
    'visitor_timezone', booking.visitor_timezone,
    'status', booking.status,
    'customer_reply', booking.customer_reply,
    'past', booking.slot_start < now()
  );
end;
$$;

revoke all on function public.tour_slot_open(timestamptz) from public;
revoke all on function public.admin_reschedule_tour(uuid, timestamptz) from public;
revoke all on function public.tour_booking_reply(uuid, text) from public;
grant execute on function public.tour_slot_open(timestamptz) to anon, authenticated;
grant execute on function public.admin_reschedule_tour(uuid, timestamptz) to authenticated;
grant execute on function public.tour_booking_reply(uuid, text) to anon;
