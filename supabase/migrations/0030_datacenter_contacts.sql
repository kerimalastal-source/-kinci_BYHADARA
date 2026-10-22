-- 0030: a contact press from a data-center town or a driven browser no longer makes a
-- visit "real". Owner's approval 2026-10-22: of 19 visits that pressed a contact button
-- (25/9-22/10), about 12 came from Meta/cloud data-center towns (Prineville, Clonee, Lulea,
-- Forest City...), most likely ad review systems pressing the buttons.
-- Run once in the Supabase SQL Editor of "kerimalastal-source's Project"
-- (khibypqmvnxuetmvjcnn), after 0021. Same-name replacement of visit_verdicts() only.
--
-- visit_verdicts(since): as in 0021, except that a visit from a data-center town (the same
-- list as DATA_CENTER_TOWNS in api/_lib/visitBots.ts) or with navigator.webdriver is
-- automated even when it pressed a contact button, and is then not counted as contacted.
-- classifyVisit() in api/_lib/visitInsights.ts does the same for the morning report.

do $$
begin
  if to_regprocedure('public.visit_verdicts(timestamp with time zone)') is null then
    raise exception 'Run 0021_automated_visits.sql first, in the HADARA Real Estate project.';
  end if;
end $$;

create or replace function public.visit_verdicts(p_since timestamptz)
returns table (session_id uuid, started timestamptz, pages bigint, contacted boolean, automated boolean)
language sql
stable
security definer
set search_path = public
as $$
  with ev as (
    select session_id, path, referrer, city, country, created_at
    from public.visitor_events where created_at >= p_since
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
    from public.visitor_engagement where created_at >= p_since - interval '1 day' group by session_id
  ),
  act as (
    select session_id,
           bool_or(action = 'form_sent') as sent,
           bool_or(action in ('whatsapp', 'call', 'email', 'interested', 'form_sent', 'tour_link')) as contacted,
           bool_or(action in ('video_play', 'map_open', 'favorite', 'chat_open', 'form_start')) as looked
    from public.visitor_actions where created_at >= p_since - interval '1 day' group by session_id
  ),
  scored as (
    select v.session_id, v.started, v.pages, coalesce(a.contacted, false) as contacted,
        (coalesce(p.webdriver, false) or regexp_replace(lower(coalesce(v.city, '')), '[^a-z .-]', '', 'g') || '|' || lower(coalesce(v.country, '')) in (
               'clonee|ie', 'odense|dk', 'lule|se', 'prineville|us', 'forest city|us', 'altoona|us', 'los lunas|us',
               'papillion|us', 'new albany|us', 'sandston|us', 'eagle mountain|us', 'ashburn|us', 'boardman|us',
               'umatilla|us', 'the dalles|us', 'moncks corner|us', 'lenoir|us', 'pryor|us', 'boydton|us',
               'saint-ghislain|be', 'st. ghislain|be', 'hamina|fi', 'eemshaven|nl')) as hard,
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
  )
  select session_id, started, pages, (contacted and not hard) as contacted,
         (hard and contacted) or (not contacted and bot >= 3 and human < 3) as automated
  from scored;
$$;

revoke all on function public.visit_verdicts(timestamptz) from public, anon, authenticated;
