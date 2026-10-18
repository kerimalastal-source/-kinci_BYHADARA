-- 0021: leave automated visits out of every statistic (owner's request 2026-10-18).
-- Run once in the Supabase SQL Editor of "kerimalastal-source's Project"
-- (khibypqmvnxuetmvjcnn), after 0020. Replaces functions by the same name and arguments
-- (grants stay), so nothing breaks if it is run twice. Split it into parts if the editor
-- cuts a long paste (the helper, then each admin_* function).
--
-- classified_visits(since): one row per visit (new tabs opened from the site are not
-- visits) with whether it pressed a contact button and whether it is automated, by the
-- same weights as 0020 and classifyVisit() in api/_lib/visitInsights.ts. It is internal
-- (no grants). The statistics functions below now count only visits that are not automated:
-- admin_visit_stats (visitors, pages, sources, campaigns, countries, languages, landing
-- pages, projects), admin_behavior_stats (visits, devices, actions, forms) and
-- admin_ad_report (visits per campaign). admin_real_visitor_stats keeps counting all of
-- them, because it is the one panel that shows how many were left out. Not changed: the
-- cookie-notice counts (admin_consent_stats) and the morning digest's yesterday numbers.

do $$
begin
  if to_regclass('public.listings') is null then
    raise exception 'Wrong database: public.listings was not found. Run this in the HADARA Real Estate Supabase project.';
  end if;
  if to_regprocedure('public.admin_real_visitor_stats(integer)') is null then
    raise exception 'Run 0020 first.';
  end if;
end $$;

create or replace function public.classified_visits(since timestamptz)
returns table (session_id uuid, started timestamptz, contacted boolean, automated boolean)
language sql
stable
security definer
set search_path = public
as $$
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
    select v.session_id, v.started, coalesce(a.contacted, false) as contacted,
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
  select session_id, started, contacted, (not contacted and bot >= 3 and human < 3) as automated from scored;
$$;

revoke all on function public.classified_visits(timestamptz) from public, anon, authenticated;

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

  with daily as (
    select (started at time zone 'Europe/Istanbul')::date as day,
           count(*) as total,
           count(*) filter (where automated) as automated,
           count(*) filter (where contacted) as contacted
    from public.classified_visits(since) group by 1
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

create or replace function public.admin_visit_stats(p_days int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  days int := least(greatest(coalesce(p_days, 7), 1), 366);
  -- From the start of the Istanbul day, `days` days back (today included).
  since timestamptz := ((now() at time zone 'Europe/Istanbul')::date - (days - 1)) at time zone 'Europe/Istanbul';
  result jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'forbidden');
  end if;

  with ev as (
    select *, regexp_replace(path, '^/(ar|fa|fr|ru)(/|$)', '/') as page
    from public.visitor_events where created_at >= since
  ),
  sessions as (
    select session_id,
           min(created_at) as started,
           count(*) as pages,
           (array_agg(page order by created_at, id))[1] as landing,
           (array_agg(referrer order by created_at, id))[1] as referrer,
           (array_agg(country order by created_at, id))[1] as country,
           (array_agg(locale order by created_at, id))[1] as locale
    from ev group by session_id
  ),
  -- A new tab opened from the site (its first referrer is one of our pages) isn't a visitor.
  visits as (
    select s.*, c.campaign,
           public.traffic_source(c.campaign, s.referrer) as source,
           public.traffic_campaign(c.campaign) as campaign_name,
           (s.started at time zone 'Europe/Istanbul')::date as day
    from sessions s left join public.visitor_campaigns c using (session_id)
    where coalesce(s.referrer, '') not like '/%'
      and s.session_id not in (select b.session_id from public.classified_visits(since) b where b.automated)
  ),
  leads as (
    -- Leads carry only the ad campaign (no referrer): "none" when they came without one.
    select 'inquiry' as type, case when coalesce(source, '') = '' then 'none' else public.traffic_source(source, null) end as source
    from public.inquiries where created_at >= since
    union all
    select 'booking', case when coalesce(source, '') = '' then 'none' else public.traffic_source(source, null) end
    from public.tour_bookings where created_at >= since
  )
  select jsonb_build_object(
    'days', days,
    'since', since,
    'totals', (select jsonb_build_object(
        'visitors', count(*),
        'pages', coalesce(sum(pages), 0),
        'multi_page', count(*) filter (where pages > 1)) from visits),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'visitors', coalesce(v.visitors, 0), 'pages', coalesce(v.pages, 0)) order by d.day), '[]')
        from (select generate_series((now() at time zone 'Europe/Istanbul')::date - (days - 1), (now() at time zone 'Europe/Istanbul')::date, interval '1 day')::date as day) d
        left join (select day, count(*) as visitors, sum(pages) as pages from visits group by day) v using (day)),
    'sources', (select coalesce(jsonb_agg(x order by (x->>'visitors')::int desc), '[]') from (
        select jsonb_build_object('source', source, 'visitors', count(*)) as x from visits group by source order by count(*) desc limit 12) t),
    'campaigns', (select coalesce(jsonb_agg(x order by (x->>'visitors')::int desc), '[]') from (
        select jsonb_build_object('source', source, 'campaign', campaign_name, 'visitors', count(*)) as x
        from visits where campaign_name is not null group by source, campaign_name order by count(*) desc limit 12) t),
    'countries', (select coalesce(jsonb_agg(x order by (x->>'visitors')::int desc), '[]') from (
        select jsonb_build_object('country', coalesce(country, ''), 'visitors', count(*)) as x from visits group by country order by count(*) desc limit 12) t),
    'locales', (select coalesce(jsonb_agg(x order by (x->>'visitors')::int desc), '[]') from (
        select jsonb_build_object('locale', coalesce(locale, 'en'), 'visitors', count(*)) as x from visits group by locale) t),
    'landings', (select coalesce(jsonb_agg(x order by (x->>'visitors')::int desc), '[]') from (
        select jsonb_build_object('page', landing, 'visitors', count(*)) as x from visits group by landing order by count(*) desc limit 10) t),
    'projects', (select coalesce(jsonb_agg(x order by (x->>'visitors')::int desc), '[]') from (
        select jsonb_build_object('slug', slug, 'visitors', count(distinct session_id), 'views', count(*)) as x
        from (select substring(page from '^/projects/([a-z0-9-]+)') as slug, session_id from ev where page ~ '^/projects/[a-z0-9-]+'
                and session_id not in (select b.session_id from public.classified_visits(since) b where b.automated)) p
        group by slug order by count(distinct session_id) desc limit 12) t),
    'leads', (select jsonb_build_object(
        'inquiries', count(*) filter (where type = 'inquiry'),
        'bookings', count(*) filter (where type = 'booking')) from leads),
    'lead_sources', (select coalesce(jsonb_agg(x order by (x->>'total')::int desc), '[]') from (
        select jsonb_build_object('source', source, 'inquiries', count(*) filter (where type = 'inquiry'),
                                  'bookings', count(*) filter (where type = 'booking'), 'total', count(*)) as x
        from leads group by source) t)
  ) into result;

  return result;
end;
$$;

create or replace function public.admin_behavior_stats(p_days int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  days int := least(greatest(coalesce(p_days, 7), 1), 366);
  since timestamptz := ((now() at time zone 'Europe/Istanbul')::date - (days - 1)) at time zone 'Europe/Istanbul';
  result jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'forbidden');
  end if;

  with sessions as (
    select session_id, (array_agg(referrer order by created_at, id))[1] as referrer
    from public.visitor_events where created_at >= since
    group by session_id
  ),
  visits as (
    select s.session_id, coalesce(d.device, 'unknown') as device
    from sessions s left join public.visitor_devices d using (session_id)
    where coalesce(s.referrer, '') not like '/%'
      and s.session_id not in (select b.session_id from public.classified_visits(since) b where b.automated)
  ),
  acts as (
    select a.session_id, a.action, a.target
    from public.visitor_actions a join visits v using (session_id)
    where a.created_at >= since
  ),
  contacted as (
    select distinct session_id from acts
    where action in ('whatsapp', 'call', 'email', 'interested', 'form_sent')
  )
  select jsonb_build_object(
    'days', days,
    'visits', (select count(*) from visits),
    'contacted', (select count(*) from contacted),
    'devices', (select coalesce(jsonb_agg(x order by (x->>'visits')::int desc), '[]') from (
        select jsonb_build_object('device', v.device, 'visits', count(*), 'contacted', count(c.session_id)) as x
        from visits v left join contacted c using (session_id) group by v.device) t),
    'actions', (select coalesce(jsonb_agg(x order by (x->>'sessions')::int desc), '[]') from (
        select jsonb_build_object('action', action, 'count', count(*), 'sessions', count(distinct session_id)) as x
        from acts group by action) t),
    'projects', (select coalesce(jsonb_agg(x order by (x->>'sessions')::int desc), '[]') from (
        select jsonb_build_object('slug', target, 'action', action, 'sessions', count(distinct session_id)) as x
        from acts
        where target ~ '^[a-z0-9-]+$'
          and action in ('whatsapp', 'call', 'interested', 'favorite', 'video_play', 'map_open')
        group by target, action) t),
    'forms', (select coalesce(jsonb_agg(x order by (x->>'started')::int desc), '[]') from (
        select jsonb_build_object('form', target,
          'started', count(distinct session_id) filter (where action = 'form_start'),
          'sent', count(distinct session_id) filter (where action = 'form_sent')) as x
        from acts
        where action in ('form_start', 'form_sent') and target is not null
        group by target) t)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_behavior_stats(int) from public, anon;
grant execute on function public.admin_behavior_stats(int) to authenticated;

create or replace function public.admin_ad_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  since timestamptz := p_from::timestamp at time zone 'Europe/Istanbul';
  until timestamptz := (p_to + 1)::timestamp at time zone 'Europe/Istanbul';
  result jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    return jsonb_build_object('error', 'invalid');
  end if;

  with leads as (
    select 'inquiry' as type, created_at, lower(trim(email)) as e, right(regexp_replace(phone, '\D', '', 'g'), 9) as p,
           case when coalesce(source, '') = '' then 'none' else public.traffic_source(source, null) end as source,
           public.traffic_campaign(source) as campaign
      from public.inquiries
    union all
    select 'booking', created_at, lower(trim(email)), right(regexp_replace(phone, '\D', '', 'g'), 9),
           case when coalesce(source, '') = '' then 'none' else public.traffic_source(source, null) end,
           public.traffic_campaign(source)
      from public.tour_bookings where status <> 'cancelled'
  ),
  won as (
    select l.deal_value, l.currency, f.source, f.campaign
      from public.crm_leads l
      left join lateral (
        select x.source, x.campaign from leads x
         where ('e:' || x.e) = any(l.keys) or (length(x.p) >= 6 and ('p:' || x.p) = any(l.keys))
         order by x.created_at limit 1) f on true
     where l.stage = 'won' and l.won_at >= since and l.won_at < until
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'visits', (select coalesce(jsonb_agg(jsonb_build_object('source', source, 'campaign', campaign, 'visitors', n)), '[]'::jsonb)
               from (select public.traffic_source(campaign, null) as source, public.traffic_campaign(campaign) as campaign, count(*) as n
                       from public.visitor_campaigns where created_at >= since and created_at < until
                        and session_id not in (select b.session_id from public.classified_visits(since) b where b.automated) group by 1, 2) v),
    'leads', (select coalesce(jsonb_agg(jsonb_build_object('source', source, 'campaign', campaign,
                'inquiries', inquiries, 'bookings', bookings)), '[]'::jsonb)
              from (select source, campaign, count(*) filter (where type = 'inquiry') as inquiries,
                           count(*) filter (where type = 'booking') as bookings
                      from leads where created_at >= since and created_at < until group by 1, 2) l),
    'won', (select coalesce(jsonb_agg(jsonb_build_object('source', coalesce(source, 'none'), 'campaign', campaign,
              'value', deal_value, 'currency', currency)), '[]'::jsonb) from won),
    'spend', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'source', source, 'campaign', campaign, 'currency', currency,
                'amount', round(amount * (least(ends_on, p_to) - greatest(starts_on, p_from) + 1)::numeric
                                       / (ends_on - starts_on + 1), 2))), '[]'::jsonb)
              from public.ad_spend where starts_on <= p_to and ends_on >= p_from)
  ) into result;
  return result;
end $$;

revoke all on function public.admin_ad_report(date, date) from public;
grant execute on function public.admin_ad_report(date, date) to authenticated;
