-- HADARA Real Estate — live Telegram visitor alerts (updated in place during the visit)
-- Run once in the Supabase SQL Editor of the HADARA Real Estate project:
-- "kerimalastal-source's Project" (ref khibypqmvnxuetmvjcnn), the same project as
-- VITE_SUPABASE_URL in the Vercel project "kinci-byhadara", the one with the resale tables.
--
-- Additions only: record_visit() (used by the code deployed before this) is left exactly
-- as it is, so the current alerts keep working until the new code is published.
--   * visitor_alerts: the Telegram message id of each session's alert, so later pages
--     edit that same message instead of sending new ones.
--   * record_visit_state(): records a page view (like record_visit) and returns the state
--     of its session as jsonb.
--   * save_visitor_alert(): remembers a session's alert message id.
--   * purge_old_visitor_events(): same signature, now also clears visitor_alerts.
-- Still no IP address and no personal data.

-- Guard: stop right here if this is not the HADARA Real Estate database.
do $$
begin
  if to_regclass('public.listings') is null then
    raise exception 'Wrong database: public.listings was not found. Run this in the HADARA Real Estate Supabase project (the one with the resale tables).';
  end if;
  if to_regclass('public.visitor_events') is null then
    raise exception 'public.visitor_events was not found: run 0002_visitor_events.sql first.';
  end if;
end
$$;

create table if not exists public.visitor_alerts (
  session_id uuid primary key,
  message_id bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists visitor_alerts_created_at_idx on public.visitor_alerts (created_at);

-- Same as visitor_events: RLS on, no policies, no table grants. Written and read only
-- through the functions below.
alter table public.visitor_alerts enable row level security;
revoke all on public.visitor_alerts from anon, authenticated;

-- Records one page view and returns the session as it was before it:
--   is_new        no earlier page view in this session
--   pages_before  page views before this one
--   seconds       seconds since the session's first page view (0 for a new session)
--   seen_before   this page was already viewed in the session (the language prefix is
--                 ignored, so /contact and /ar/contact count as the same page)
--   landing       the session's first page view {path, locale, referrer, country, city}
--                 (this one for a new session)
--   message_id    the session's Telegram alert, or null
-- The advisory lock is the same as record_visit's, so two simultaneous page views of one
-- session are counted one after the other.
create or replace function public.record_visit_state(
  p_session_id uuid,
  p_path text,
  p_locale text,
  p_referrer text,
  p_country text,
  p_city text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text := left(coalesce(p_path, '/'), 300);
  v_page text := regexp_replace(left(coalesce(p_path, '/'), 300), '^/(ar|fr|ru)(/|$)', '/');
  v_pages int;
  v_started timestamptz;
  v_seen boolean;
  v_landing jsonb;
  v_message bigint;
begin
  perform pg_advisory_xact_lock(hashtext(p_session_id::text));

  select count(*)::int, min(created_at),
         coalesce(bool_or(regexp_replace(path, '^/(ar|fr|ru)(/|$)', '/') = v_page), false)
    into v_pages, v_started, v_seen
    from public.visitor_events
   where session_id = p_session_id;

  select jsonb_build_object('path', path, 'locale', locale, 'referrer', referrer, 'country', country, 'city', city)
    into v_landing
    from public.visitor_events
   where session_id = p_session_id
   order by created_at, id
   limit 1;

  select message_id into v_message from public.visitor_alerts where session_id = p_session_id;

  insert into public.visitor_events (session_id, path, locale, referrer, country, city)
  values (p_session_id, v_path, left(p_locale, 8), left(p_referrer, 300), left(p_country, 8), left(p_city, 100));

  return jsonb_build_object(
    'is_new', v_pages = 0,
    'pages_before', v_pages,
    'seconds', coalesce(floor(extract(epoch from now() - v_started)), 0)::int,
    'seen_before', v_seen,
    'landing', coalesce(v_landing, jsonb_build_object(
      'path', v_path, 'locale', left(p_locale, 8), 'referrer', left(p_referrer, 300),
      'country', left(p_country, 8), 'city', left(p_city, 100))),
    'message_id', v_message
  );
end;
$$;

-- Remembers the Telegram alert of a session (the first one stays if called twice).
create or replace function public.save_visitor_alert(p_session_id uuid, p_message_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.visitor_alerts (session_id, message_id)
  values (p_session_id, p_message_id)
  on conflict (session_id) do nothing;
$$;

-- Same signature as in 0002: deletes events and alert references older than 30 days.
create or replace function public.purge_old_visitor_events()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.visitor_events where created_at < now() - interval '30 days';
  delete from public.visitor_alerts where created_at < now() - interval '30 days';
$$;

-- Only anon (the Vercel function's key) may call the new functions; Supabase's default
-- privileges would otherwise also give them to authenticated.
revoke all on function public.record_visit_state(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.save_visitor_alert(uuid, bigint) from public, anon, authenticated;
grant execute on function public.record_visit_state(uuid, text, text, text, text, text) to anon;
grant execute on function public.save_visitor_alert(uuid, bigint) to anon;
