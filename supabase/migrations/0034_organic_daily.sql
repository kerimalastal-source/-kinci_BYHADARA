-- 0034: "Real visitors without paid ads" on /admin/stats (owner's request 2026-10-24).
-- Read-only addition: nothing new is collected and nothing existing changes; the page shows
-- the chart only after this runs. Run after 0025 (it uses visit_verdicts from 0031).
-- Plain ASCII on purpose (the Supabase SQL editor mis-splits otherwise).
--
-- admin_organic_daily(days): for each day of the period, the real (not automated) visits
-- that did not come from a paid ad, split by where they came from: search, direct, posts
-- (our own social posts, utm_campaign post-*), social (other links from social apps) and
-- referral (other sites); how many of them got in touch; and, for comparison, the real
-- visits that came from a paid ad (utm_medium=paid, or a Google Ads click). Admin only.

do $$
begin
  if to_regprocedure('public.visit_verdicts(timestamptz)') is null
     or to_regprocedure('public.traffic_source(text, text)') is null
     or to_regprocedure('public.is_admin()') is null then
    raise exception 'Run 0008 and 0021 (or later) first, in the HADARA Real Estate project.';
  end if;
end $$;

create or replace function public.admin_organic_daily(p_days int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  days int := least(greatest(coalesce(p_days, 30), 1), 366);
  today date := (now() at time zone 'Europe/Istanbul')::date;
  since timestamptz := (today - (days - 1)) at time zone 'Europe/Istanbul';
  result jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'forbidden');
  end if;

  with v as (
    select x.session_id, x.contacted, (x.started at time zone 'Europe/Istanbul')::date as day
    from public.visit_verdicts(since) x
    where not x.automated
  ),
  firsts as (
    select distinct on (e.session_id) e.session_id, e.referrer
    from public.visitor_events e join v using (session_id)
    where e.created_at >= since
    order by e.session_id, e.created_at, e.id
  ),
  src as (
    select v.session_id, v.day, v.contacted, coalesce(c.campaign, '') as raw,
           coalesce(public.traffic_source(c.campaign, f.referrer), 'direct') as s,
           coalesce(public.traffic_campaign(c.campaign), '') as campaign
    from v
    left join firsts f using (session_id)
    left join public.visitor_campaigns c using (session_id)
  ),
  ch as (
    select day, contacted,
           case when raw ~ 'utm_medium=paid' or s = 'google-ads' then 'paid'
                when campaign like 'post-%' then 'posts'
                when s in ('facebook', 'facebook.com', 'm.facebook.com', 'l.facebook.com', 'lm.facebook.com', 'fb',
                           'ig', 'instagram', 'instagram.com', 'l.instagram.com',
                           'tiktok', 'youtube', 'linkedin.com', 'x.com', 't.co') then 'social'
                when s = 'google' or s ~ '(^|\.)google\.' or s in ('bing.com', 'yandex.ru', 'yandex.com', 'duckduckgo.com', 'yahoo.com') then 'search'
                when s = 'direct' then 'direct'
                else 'referral' end as channel
    from src
  )
  select jsonb_build_object(
    'days', days,
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'search', (select count(*) from ch where ch.day = d.day and channel = 'search'),
        'direct', (select count(*) from ch where ch.day = d.day and channel = 'direct'),
        'posts', (select count(*) from ch where ch.day = d.day and channel = 'posts'),
        'social', (select count(*) from ch where ch.day = d.day and channel = 'social'),
        'referral', (select count(*) from ch where ch.day = d.day and channel = 'referral'),
        'contacted', (select count(*) from ch where ch.day = d.day and channel <> 'paid' and contacted),
        'paid', (select count(*) from ch where ch.day = d.day and channel = 'paid')) order by d.day), '[]')
      from (select generate_series(today - (days - 1), today, interval '1 day')::date as day) d)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_organic_daily(int) from public, anon;
grant execute on function public.admin_organic_daily(int) to authenticated;
