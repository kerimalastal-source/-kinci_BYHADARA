-- 0036: a crawler with tall desktop windows counts as automated unless it shows a person.
-- Owner's approval 2026-11-09 (add the automated visitor to the filter). From 2/11 to 8/11, 28 of
-- 73 visits counted as real came from Hong Kong, Singapore and Mexico City in one pattern: one
-- page, no referrer, a macOS or Windows desktop window 1200-1400 wide and 1050+ tall, nothing
-- touched. Since September 312 visits had such a screen; none contacted us or touched the page.
-- Run once in the Supabase SQL Editor of "kerimalastal-source's Project"
-- (khibypqmvnxuetmvjcnn), after 0035. Same-name replacement of visit_verdicts() only.
--
-- visit_verdicts(since): as in 0035, plus: a screen 1200-1400 wide whose height is 1050 or more
-- and at least 0.78 of the width is read like a US or China visit: automated unless it
-- contacted us or shows steady human use. classifyVisit() and alertHold() in
-- api/_lib/visitInsights.ts do the same for the morning report and the Telegram alerts.

do $$
begin
  if to_regprocedure('public.visit_verdicts(timestamp with time zone)') is null then
    raise exception 'Run 0021_automated_visits.sql and 0035 first, in the HADARA Real Estate project.';
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
        (coalesce(p.webdriver, false) or coalesce(p.screen, '') = '2000x2000' or regexp_replace(lower(coalesce(v.city, '')), '[^a-z .-]', '', 'g') || '|' || lower(coalesce(v.country, '')) in (
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
      + case when c.campaign is not null or (coalesce(v.referrer, '') <> '' and v.referrer not like '/%') then 0.5 else 0 end as human,
        (lower(coalesce(v.country, '')) in ('us', 'cn') or coalesce(p.tz, '') = 'Asia/Shanghai'
         or case when coalesce(p.screen, '') ~ '^[0-9]{3,4}x[0-9]{3,4}$'
                 then split_part(p.screen, 'x', 1)::int between 1200 and 1400
                      and split_part(p.screen, 'x', 2)::int >= 1050
                      and split_part(p.screen, 'x', 2)::numeric >= 0.78 * split_part(p.screen, 'x', 1)::int
                 else false end) as strict_geo,
        (coalesce(e.inter, 0) >= 4 or (coalesce(e.inter, 0) >= 2 and coalesce(e.active, 0) >= 20)
         or coalesce(g.natural_gap, false)) as steady
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
         hard or (not contacted and strict_geo and not steady)
              or (not contacted and bot >= 3 and human < 3) as automated
  from scored;
$$;

revoke all on function public.visit_verdicts(timestamptz) from public, anon, authenticated;
