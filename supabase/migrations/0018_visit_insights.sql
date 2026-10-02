-- 0018: is it a person? Device, engagement and the morning visitor report.
-- Owner's request 2026-10-02, the same as HADARA Hospitality (its PRs #159 and #161).
-- Run once in the Supabase SQL Editor of "kerimalastal-source's Project"
-- (khibypqmvnxuetmvjcnn), after 0017. Additions only; the code published before this
-- keeps working, and the new code ignores the 404s until it runs.
--
--   * visitor_profiles: per visit, the system and browser read from the user agent (never
--     the user agent itself), the browser's time zone, the screen size and whether the
--     browser says it is driven by software (navigator.webdriver).
--   * visitor_engagement: per page view, the seconds it was visible, its deepest scroll (%)
--     and the seconds with touch, mouse or keyboard input (a count, never what or where).
--   * save_visit_profile(), record_visit_engagement(): written by api/track.ts.
--   * visit_insight(session): what the live Telegram alert needs to judge a visit.
--   * visit_report(secret, hours): every visit of the last hours, for the morning report
--     (the same CRON_SECRET as daily_digest()).
--   * purge_old_visitor_events(): same name, also clears the two new tables after 365 days.
-- Anonymous like visitor_events: the random per-tab session id, no IP, no name.

do $$
begin
  if to_regclass('public.listings') is null then
    raise exception 'Wrong database: public.listings was not found. Run this in the HADARA Real Estate Supabase project.';
  end if;
  if to_regclass('public.visitor_actions') is null or to_regclass('public.visitor_devices') is null
     or to_regprocedure('public.cron_secret_ok(text)') is null then
    raise exception 'Run 0002 to 0017 first, in the HADARA Real Estate project.';
  end if;
end $$;

create table if not exists public.visitor_profiles (
  session_id uuid primary key,
  os text,
  browser text,
  tz text,
  screen text,
  webdriver boolean,
  created_at timestamptz not null default now()
);
create index if not exists visitor_profiles_created_at_idx on public.visitor_profiles (created_at);
alter table public.visitor_profiles enable row level security;
revoke all on public.visitor_profiles from anon, authenticated;

create table if not exists public.visitor_engagement (
  session_id uuid not null,
  view_id text not null,
  path text,
  active_seconds integer not null default 0,
  scroll_pct integer not null default 0,
  interactions integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, view_id)
);
create index if not exists visitor_engagement_created_at_idx on public.visitor_engagement (created_at);
alter table public.visitor_engagement enable row level security;
revoke all on public.visitor_engagement from anon, authenticated;

-- Saved with the visit's first page; a visit without a page view is ignored.
create or replace function public.save_visit_profile(
  p_session_id uuid, p_os text, p_browser text, p_tz text, p_screen text, p_webdriver boolean)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.visitor_profiles (session_id, os, browser, tz, screen, webdriver)
  select p_session_id, nullif(left(coalesce(p_os, ''), 20), ''), nullif(left(coalesce(p_browser, ''), 20), ''),
    nullif(left(coalesce(p_tz, ''), 64), ''), nullif(left(coalesce(p_screen, ''), 11), ''), p_webdriver
  where exists (select 1 from public.visitor_events where session_id = p_session_id)
  on conflict (session_id) do nothing;
$$;

-- What the alert needs to judge a visit: device and profile, the pages in order with
-- seconds since the first, the engagement of each page view, the button presses, the
-- first page, and the Telegram alert id.
create or replace function public.visit_insight(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ev as (
    select path, created_at from public.visitor_events where session_id = p_session_id
  ), first as (
    select min(created_at) as at from ev
  )
  select case when not exists (select 1 from ev) then null else jsonb_build_object(
    'device', (select device from public.visitor_devices where session_id = p_session_id),
    'profile', (select jsonb_build_object('os', os, 'browser', browser, 'tz', tz, 'screen', screen, 'webdriver', webdriver)
                from public.visitor_profiles where session_id = p_session_id),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('path', ev.path,
               'at', round(extract(epoch from ev.created_at - first.at))::int) order by ev.created_at)
             from ev, first), '[]'::jsonb),
    'engagement', coalesce((select jsonb_agg(jsonb_build_object('path', path, 'active', active_seconds,
                    'scroll', scroll_pct, 'interactions', interactions) order by created_at)
                  from public.visitor_engagement where session_id = p_session_id), '[]'::jsonb),
    'actions', coalesce((select jsonb_agg(jsonb_build_object('action', action, 'target', target) order by created_at)
               from public.visitor_actions where session_id = p_session_id), '[]'::jsonb),
    'landing', (select jsonb_build_object('path', path, 'locale', locale, 'referrer', referrer, 'country', country, 'city', city)
                from public.visitor_events where session_id = p_session_id order by created_at limit 1),
    'seconds', (select round(extract(epoch from max(created_at) - min(created_at)))::int from ev),
    'message_id', (select message_id from public.visitor_alerts where session_id = p_session_id)
  ) end;
$$;

-- Sent again with the running totals each time a page is left, hidden or open 15/45 s:
-- the larger values are kept. Only for a visit seen in the last day, at most 200 page
-- views per visit. Returns visit_insight() of the visit, or null when ignored.
create or replace function public.record_visit_engagement(
  p_session_id uuid, p_view_id text, p_path text, p_active integer, p_scroll integer, p_interactions integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_session_id is null or coalesce(p_view_id, '') = '' then return null; end if;
  if not exists (select 1 from public.visitor_events
                 where session_id = p_session_id and created_at > now() - interval '1 day') then
    return null;
  end if;
  if not exists (select 1 from public.visitor_engagement where session_id = p_session_id and view_id = left(p_view_id, 64))
     and (select count(*) from public.visitor_engagement where session_id = p_session_id) >= 200 then
    return null;
  end if;
  insert into public.visitor_engagement (session_id, view_id, path, active_seconds, scroll_pct, interactions)
  values (p_session_id, left(p_view_id, 64), nullif(left(coalesce(p_path, ''), 300), ''),
    least(greatest(coalesce(p_active, 0), 0), 86400), least(greatest(coalesce(p_scroll, 0), 0), 100),
    least(greatest(coalesce(p_interactions, 0), 0), 100000))
  on conflict (session_id, view_id) do update set
    active_seconds = greatest(public.visitor_engagement.active_seconds, excluded.active_seconds),
    scroll_pct = greatest(public.visitor_engagement.scroll_pct, excluded.scroll_pct),
    interactions = greatest(public.visitor_engagement.interactions, excluded.interactions),
    updated_at = now();
  return public.visit_insight(p_session_id);
end;
$$;

-- Every visit that started in the last p_hours (at most 500, oldest first), with what
-- visit_insight() gives plus the start time and the ad campaign. Only with the cron secret.
create or replace function public.visit_report(p_secret text, p_hours integer default 24)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.cron_secret_ok(p_secret) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  return coalesce((
    select jsonb_agg(public.visit_insight(s.session_id)
             || jsonb_build_object('session_id', s.session_id, 'started', extract(epoch from s.started),
                  'campaign', (select campaign from public.visitor_campaigns c where c.session_id = s.session_id))
           order by s.started)
    from (
      select session_id, min(created_at) as started from public.visitor_events
      where created_at >= now() - make_interval(hours => least(greatest(coalesce(p_hours, 24), 1), 168))
      group by session_id
      having min(created_at) >= now() - make_interval(hours => least(greatest(coalesce(p_hours, 24), 1), 168))
      order by min(created_at) desc
      limit 500
    ) s
  ), '[]'::jsonb);
end;
$$;

create or replace function public.purge_old_visitor_events()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.visitor_events where created_at < now() - interval '365 days';
  delete from public.visitor_alerts where created_at < now() - interval '30 days';
  delete from public.visitor_campaigns where created_at < now() - interval '365 days';
  delete from public.visitor_devices where created_at < now() - interval '365 days';
  delete from public.visitor_actions where created_at < now() - interval '365 days';
  delete from public.visitor_profiles where created_at < now() - interval '365 days';
  delete from public.visitor_engagement where created_at < now() - interval '365 days';
$$;

revoke all on function public.save_visit_profile(uuid, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.save_visit_profile(uuid, text, text, text, text, boolean) to anon;
revoke all on function public.visit_insight(uuid) from public, anon, authenticated;
grant execute on function public.visit_insight(uuid) to anon;
revoke all on function public.record_visit_engagement(uuid, text, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.record_visit_engagement(uuid, text, text, integer, integer, integer) to anon;
revoke all on function public.visit_report(text, integer) from public, anon, authenticated;
grant execute on function public.visit_report(text, integer) to anon;
