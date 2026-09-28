-- HADARA Real Estate — private video tour bookings
-- Run once in the Supabase SQL Editor of the HADARA Real Estate project
-- (khibypqmvnxuetmvjcnn — the one with the resale tables and visitor_events).
--
-- One tour per hour (one staff member): a unique index lets only one active booking
-- hold a slot, even when two visitors press "Book" at the same moment. Visitors book
-- through the site's /api/book function (book_tour() below); only admins can read the
-- bookings or change their status. Bookings are deleted one year after their date.

-- Guard: stop right here if this is not the HADARA Real Estate database.
do $$
begin
  if to_regclass('public.listings') is null or to_regprocedure('public.is_admin()') is null then
    raise exception 'Wrong database: public.listings / public.is_admin() were not found. Run this in the HADARA Real Estate Supabase project (the one with the resale tables).';
  end if;
end
$$;

create table if not exists public.tour_bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  slot_start timestamptz not null,
  projects text[] not null,
  focus text[] not null default '{}',
  app text not null check (app in ('whatsapp', 'facetime', 'zoom', 'meet')),
  tour_language text not null check (tour_language in ('ar', 'en', 'tr')),
  name text not null,
  email text not null,
  phone text not null,
  contact_method text not null check (contact_method in ('email', 'phone', 'whatsapp', 'telegram', 'viber')),
  site_locale text,
  visitor_timezone text,
  source text,
  status text not null default 'booked' check (status in ('booked', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active (not cancelled) booking per hour.
create unique index if not exists tour_bookings_one_per_slot on public.tour_bookings (slot_start) where status <> 'cancelled';
create index if not exists tour_bookings_slot_idx on public.tour_bookings (slot_start);
create index if not exists tour_bookings_email_idx on public.tour_bookings (lower(email));
create index if not exists tour_bookings_phone_idx on public.tour_bookings (phone);

create or replace function public.touch_tour_booking()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tour_bookings_touch on public.tour_bookings;
create trigger tour_bookings_touch before update on public.tour_bookings
  for each row execute function public.touch_tour_booking();

-- Access: admins read everything and change only the status; nobody else touches the table.
alter table public.tour_bookings enable row level security;
revoke all on public.tour_bookings from anon, authenticated;
grant select on public.tour_bookings to authenticated;
grant update (status) on public.tour_bookings to authenticated;

drop policy if exists "Admins read tour bookings" on public.tour_bookings;
create policy "Admins read tour bookings" on public.tour_bookings
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins update tour bookings" on public.tour_bookings;
create policy "Admins update tour bookings" on public.tour_bookings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Taken hours for the booking calendar: start times only, nothing about who booked.
create or replace function public.tour_taken_slots()
returns setof timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select slot_start from public.tour_bookings
  where status <> 'cancelled' and slot_start >= now() and slot_start < now() + interval '16 days'
  order by slot_start;
$$;

-- Deletes bookings one year after their date (also called from the site's endpoints).
create or replace function public.purge_old_tour_bookings()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.tour_bookings where slot_start < now() - interval '1 year';
$$;

-- Books a tour. Returns {"reference": "HT-XXXXXX"} or {"error": "..."}:
--   invalid     the details or the time are not acceptable
--   slot_taken  someone else holds that hour
--   limit       this email/phone already has 3 upcoming bookings
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
  local_hour int := extract(hour from p_slot at time zone 'Europe/Istanbul');
  ref text;
  upcoming int;
begin
  -- Tours start on the hour, 9:00–18:00 Istanbul time, from one hour to 15 days ahead.
  if p_slot is null or date_trunc('hour', p_slot) <> p_slot or local_hour < 9 or local_hour > 18
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

revoke all on function public.tour_taken_slots() from public;
revoke all on function public.purge_old_tour_bookings() from public;
revoke all on function public.book_tour(timestamptz, text[], text[], text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.tour_taken_slots() to anon, authenticated;
grant execute on function public.purge_old_tour_bookings() to anon;
grant execute on function public.book_tour(timestamptz, text[], text[], text, text, text, text, text, text, text, text, text) to anon;
