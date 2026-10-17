-- 0020: real visitors per day, without automated visits (owner's request 2026-10-18).
-- Run once in the Supabase SQL Editor of "kerimalastal-source's Project"
-- (khibypqmvnxuetmvjcnn), after 0018. Additions only: nothing existing changes, and the
-- stats page says "not available yet" until this runs.
--
-- admin_real_visitor_stats(days): for each Istanbul day, all visits, the automated ones
-- and the visits that pressed a contact button. A visit is automated by the same weights
-- as classifyVisit() in api/_lib/visitInsights.ts (webdriver, data-center town, several
-- visits opening the same page within 10 s, server-like screen or UTC zone, Linux desktop,
-- very fast page changes, no input and an instant leave) against the signs of a person
-- (contact, video/map/favorite, input, scroll, reading time, natural page changes, coming
-- from search or an ad). A visit that pressed a contact button is always a person. New tabs
-- opened from the site are not visits, as in admin_visit_stats(). Counts only, admin only.

do $$
begin
  if to_regclass('public.listings') is null then
    raise exception 'Wrong database: public.listings was not found. Run this in the HADARA Real Estate Supabase project.';
  end if;
  if to_regclass('public.visitor_profiles') is null or to_regclass('public.visitor_engagement') is null then
    raise exception 'Run 0018_visit_insights.sql first.';
  end if;
end $$;

create or replace function public.admin_real_visitor_stats(p_days int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  days int := least(greatest(coalesce(p_days, 30), 1), 366);
  since timestamptz := ((now() at time zone 'Europe/Istanbul')::date - (days - 1)) at time zone 'Europe/Istanbul';
  result jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'forbidden');
  end if;

  with ev as (
    select session_id, path, referrer, city, country, created_at
    from public.visitor_events where created_at >= since
  ),
  s as (
    select session_id, min(created_at) as started, count(*) as pages,
           (array_agg(path order by created_at))[1] as landing,
           (array_agg(referrer order by created_at))[1] as referrer,
           (array_agg(city order by created_at))[1] as city,
           (array_agg(country order by created_at))[1] as country
    from ev group by session_id
  ),
  v as (select * from s where coalesce(referrer, '') not like '/%'),
  gaps as (
    select session_id, count(*) as n, bool_and(g < 2) as all_fast, bool_or(g between 5 and 1800) as natural_gap
    from (select session_id, extract(epoch from created_at - lag(created_at) over (partition by session_id order by created_at)) as g
          from ev) x
    where g is not null group by session_id
  ),
  burst as (
    select v.session_id, exists (
      select 1 from public.visitor_events e
      where e.session_id <> v.session_id and e.path = v.landing
        and e.created_at between v.started - interval '10 seconds' and v.started + interval '10 seconds') as hit
    from v
  ),
  eng as (
    select session_id, sum(interactions) as inter, sum(active_seconds) as active, max(scroll_pct) as scroll
    from public.visitor_engagement where created_at >= since - interval '1 day' group by session_id
  ),
  act as (
    select session_id,
           bool_or(action = 'form_sent') as sent,
           bool_or(action in ('whatsapp', 'call', 'email', 'interested', 'form_sent', 'tour_link')) as contacted,
           bool_or(action in ('video_play', 'map_open', 'favorite', 'chat_open', 'form_start')) as looked
    from public.visitor_actions where created_at >= since - interval '1 day' group by session_id
  ),
  scored as (
    select v.started, coalesce(a.contacted, false) as contacted,
        case when p.webdriver then 5
             when regexp_replace(lower(coalesce(v.city, '')), '[^a-z .-]', '', 'g') || '|' || lower(coalesce(v.country, '')) in (
               'clonee|ie', 'odense|dk', 'lule|se', 'prineville|us', 'forest city|us', 'altoona|us', 'los lunas|us',
               'papillion|us', 'new albany|us', 'sandston|us', 'eagle mountain|us', 'ashburn|us', 'boardman|us',
               'umatilla|us', 'the dalles|us', 'moncks corner|us', 'lenoir|us', 'pryor|us', 'boydton|us',
               'saint-ghislain|be', 'st. ghislain|be', 'hamina|fi', 'eemshaven|nl') then 5
             when b.hit then 5 else 0 end
      + case when p.screen = '800x600' then 1.5 else 0 end
      + case when p.tz ~* '^(Etc/)?(UTC|GMT|Universal|Zulu)$' then 1.5 else 0 end
      + case when d.device = 'desktop' and p.os = 'Linux' then 0.5 else 0 end
      + case when g.n >= 2 and g.all_fast then 3 else 0 end
      + case when e.session_id is not null and coalesce(e.inter, 0) = 0 and coalesce(e.active, 0) < 5
                  and v.pages = 1 and a.session_id is null then 1 else 0 end as bot,
        case when a.sent then 10 when a.contacted then 6 else 0 end
      + case when a.looked then 3 else 0 end
      + case when e.inter >= 3 then 2.5 when e.inter >= 1 then 1.5 else 0 end
      + case when e.scroll >= 50 then 1 else 0 end
      + case when e.active >= 20 then 1 else 0 end
      + case when g.natural_gap then 1 else 0 end
      + case when c.campaign is not null or (coalesce(v.referrer, '') <> '' and v.referrer not like '/%') then 0.5 else 0 end as human
    from v
    left join burst b using (session_id)
    left join public.visitor_profiles p using (session_id)
    left join public.visitor_devices d using (session_id)
    left join public.visitor_campaigns c using (session_id)
    left join gaps g using (session_id)
    left join eng e using (session_id)
    left join act a using (session_id)
  ),
  daily as (
    select (started at time zone 'Europe/Istanbul')::date as day,
           count(*) as total,
           count(*) filter (where not contacted and bot >= 3 and human < 3) as automated,
           count(*) filter (where contacted) as contacted
    from scored group by 1
  )
  select jsonb_build_object(
    'days', days,
    'daily', coalesce(jsonb_agg(jsonb_build_object(
        'day', dd.day::date, 'total', coalesce(total, 0), 'automated', coalesce(automated, 0), 'contacted', coalesce(contacted, 0))
      order by dd.day), '[]'::jsonb))
  into result
  from generate_series((now() at time zone 'Europe/Istanbul')::date - (days - 1), (now() at time zone 'Europe/Istanbul')::date, interval '1 day') dd(day)
  left join daily on daily.day = dd.day::date;
  return result;
end;
$$;

revoke all on function public.admin_real_visitor_stats(int) from public, anon, authenticated;
grant execute on function public.admin_real_visitor_stats(int) to authenticated;
