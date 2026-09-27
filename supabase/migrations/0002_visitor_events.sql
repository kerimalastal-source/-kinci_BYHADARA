-- HADARA Real Estate — anonymous visitor events (Telegram "new visitor" alerts)
-- Run once in the Supabase SQL Editor of the HADARA Real Estate project: the same
-- project as VITE_SUPABASE_URL in the Vercel project "kinci-byhadara", the one that
-- already has the resale tables (profiles, listings, ...).
--
-- Stores no IP address and no personal data: a random per-tab session id (made in the
-- browser, kept in sessionStorage — no cookie), the page path, the site language, the
-- referring site's host name only, and the approximate country/city from Vercel's
-- geolocation headers. Rows older than 30 days are deleted.

-- Guard: stop right here if this is not the HADARA Real Estate database.
do $$
begin
  if to_regclass('public.listings') is null then
    raise exception 'Wrong database: public.listings was not found. Run this in the HADARA Real Estate Supabase project (the one with the resale tables).';
  end if;
end
$$;

create table if not exists public.visitor_events (
  id bigint generated always as identity primary key,
  session_id uuid not null,
  path text not null,
  locale text,
  referrer text,
  country text,
  city text,
  created_at timestamptz not null default now()
);

create index if not exists visitor_events_session_id_idx on public.visitor_events (session_id);
create index if not exists visitor_events_created_at_idx on public.visitor_events (created_at);

-- Nobody reads or writes the table directly through the API: RLS on, no policies,
-- no table grants. The site writes only through record_visit() below.
alter table public.visitor_events enable row level security;
revoke all on public.visitor_events from anon, authenticated;

-- Records one page view and returns true when it is the first event of that session
-- (the Vercel function sends the Telegram alert only then). The advisory lock keeps
-- two simultaneous first page views of one session from both counting as "new".
create or replace function public.record_visit(
  p_session_id uuid,
  p_path text,
  p_locale text,
  p_referrer text,
  p_country text,
  p_city text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  is_new boolean;
begin
  perform pg_advisory_xact_lock(hashtext(p_session_id::text));
  select not exists (select 1 from public.visitor_events where session_id = p_session_id) into is_new;
  insert into public.visitor_events (session_id, path, locale, referrer, country, city)
  values (
    p_session_id,
    left(coalesce(p_path, '/'), 300),
    left(p_locale, 8),
    left(p_referrer, 300),
    left(p_country, 8),
    left(p_city, 100)
  );
  return is_new;
end;
$$;

-- Deletes events older than 30 days (the function calls it on ~1% of requests).
create or replace function public.purge_old_visitor_events()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.visitor_events where created_at < now() - interval '30 days';
$$;

revoke all on function public.record_visit(uuid, text, text, text, text, text) from public;
revoke all on function public.purge_old_visitor_events() from public;
grant execute on function public.record_visit(uuid, text, text, text, text, text) to anon;
grant execute on function public.purge_old_visitor_events() to anon;
