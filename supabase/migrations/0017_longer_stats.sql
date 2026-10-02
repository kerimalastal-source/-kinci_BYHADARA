-- 0017: longer periods on the admin statistics page (optional, after 0015 and 0016).
-- Run once in the Supabase SQL Editor of "kerimalastal-source's Project"
-- (khibypqmvnxuetmvjcnn), after 0014 and 0015.
--
-- Visits are now kept for a year (0015), so admin_visit_stats() may look back up to 366
-- days instead of 30 (the page offers 7, 30 and 90). This recreates the function exactly
-- as 0014 left it with only that limit changed. Same name, arguments and return type, so
-- the grants stay as they are.

do $$
begin
  if to_regclass('public.listings') is null then
    raise exception 'Wrong database: public.listings was not found. Run this in the HADARA Real Estate Supabase project (the one with the resale tables).';
  end if;
  if to_regprocedure('public.admin_visit_stats(integer)') is null then
    raise exception 'admin_visit_stats not found: run 0008 and 0014 first.';
  end if;
end
$$;

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
        from (select substring(page from '^/projects/([a-z0-9-]+)') as slug, session_id from ev where page ~ '^/projects/[a-z0-9-]+') p
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
