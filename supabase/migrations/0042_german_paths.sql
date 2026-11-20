-- 0042: count German pages (/de/...) as the same page as the other languages.
-- Run once (after 0041). The German site (/de) came after 0013, 0022 and 0025, whose
-- record_visit_state(), admin_visit_stats() and admin_stats_details() strip only the
-- /ar, /fa, /fr and /ru prefixes. This recreates the three functions exactly as they
-- are, with /de added to that list and nothing else changed, so /de/contact after
-- /contact is not a second first opening of the contact page, and German page views
-- count under the same page in the statistics. Same names, arguments and return
-- types, so the grants stay as they are.

do $$
begin
  if to_regclass('public.visitor_events') is null or to_regprocedure('public.visit_verdicts(timestamptz)') is null then
    raise exception 'Run this on the HADARA Real Estate database, after 0041.';
  end if;
end
$$;

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
  v_page text := regexp_replace(left(coalesce(p_path, '/'), 300), '^/(ar|fa|fr|ru|de)(/|$)', '/');
  v_pages int;
  v_started timestamptz;
  v_seen boolean;
  v_landing jsonb;
  v_message bigint;
begin
  perform pg_advisory_xact_lock(hashtext(p_session_id::text));

  select count(*)::int, min(created_at),
         coalesce(bool_or(regexp_replace(path, '^/(ar|fa|fr|ru|de)(/|$)', '/') = v_page), false)
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

  with bots as (
    select session_id from public.visit_verdicts(since) where automated
  ),
  ev as (
    select e.*, regexp_replace(e.path, '^/(ar|fa|fr|ru|de)(/|$)', '/') as page
    from public.visitor_events e
    where e.created_at >= since and not exists (select 1 from bots b where b.session_id = e.session_id)
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

create or replace function public.admin_stats_details(p_days int)
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
  prev timestamptz := (today - (2 * days - 1)) at time zone 'Europe/Istanbul';
  result jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'forbidden');
  end if;

  with v as (
    select x.session_id, x.automated, x.contacted, x.pages, (x.started >= since) as cur,
           (x.started at time zone 'Europe/Istanbul')::date as day
    from public.visit_verdicts(prev) x
  ),
  ev as (
    select e.session_id, regexp_replace(e.path, '^/(ar|fa|fr|ru|de)(/|$)', '/') as page, e.locale, e.country, e.created_at, e.id
    from public.visitor_events e join v using (session_id)
    where e.created_at >= prev and v.cur
  ),
  firsts as (
    select distinct on (session_id) session_id, coalesce(locale, 'en') as locale, coalesce(country, '') as country
    from ev order by session_id, created_at, id
  ),
  journey as (
    select v.session_id, v.automated,
           exists (select 1 from ev where ev.session_id = v.session_id and ev.page ~ '^/projects/[a-z0-9-]+') as project,
           exists (select 1 from ev where ev.session_id = v.session_id and ev.page in
             ('/contact', '/property-request', '/video-tour', '/engineering-architecture/request-consultation')) as request_page,
           exists (select 1 from public.visitor_actions a where a.session_id = v.session_id and a.action = 'form_sent') as sent
    from v where v.cur
  ),
  leads as (
    select 'inquiry' as type, id, reference, kind, coalesce(details->>'form', '') as form, name, projects, source, status, created_at
    from public.inquiries
    where created_at >= since and not public.stats_is_test(name, email, details->>'company')
    union all
    select 'booking', id, reference, 'booking', '', name, projects, source, status, created_at
    from public.tour_bookings
    where created_at >= since and not public.stats_is_test(name, email, null)
  ),
  pv as (
    select substring(ev.page from '^/projects/([a-z0-9-]+)') as slug, ev.session_id, v.automated
    from ev join v using (session_id) where ev.page ~ '^/projects/[a-z0-9-]+'
  ),
  asked as (select unnest(projects) as slug, count(*) as n from leads group by 1),
  proj as (
    select slug,
           count(*) filter (where not automated) as views_real, count(*) as views_all,
           count(distinct session_id) filter (where not automated) as visitors_real, count(distinct session_id) as visitors_all
    from pv group by slug
  )
  select jsonb_build_object(
    'days', days,
    'since', since,
    'prev_since', prev,
    'started', jsonb_build_object(
      'visits', (select min(created_at) from public.visitor_events),
      'actions', (select min(created_at) from public.visitor_actions)),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'real', (select count(*) from v where v.day = d.day and not v.automated),
        'all', (select count(*) from v where v.day = d.day),
        'pages_real', (select coalesce(sum(pages), 0) from v where v.day = d.day and not v.automated),
        'pages_all', (select coalesce(sum(pages), 0) from v where v.day = d.day),
        'contacted', (select count(*) from v where v.day = d.day and v.contacted),
        'prev_real', (select count(*) from v where v.day = d.day - days and not v.automated),
        'prev_all', (select count(*) from v where v.day = d.day - days)) order by d.day), '[]')
      from (select generate_series(today - (days - 1), today, interval '1 day')::date as day) d),
    'funnel', (select jsonb_build_object(
        'real', jsonb_build_object('visits', count(*) filter (where not automated),
          'project', count(*) filter (where not automated and project),
          'request_page', count(*) filter (where not automated and request_page),
          'sent', count(*) filter (where not automated and sent)),
        'all', jsonb_build_object('visits', count(*), 'project', count(*) filter (where project),
          'request_page', count(*) filter (where request_page), 'sent', count(*) filter (where sent)))
      from journey),
    'countries', (select coalesce(jsonb_agg(x order by (x->>'all')::int desc), '[]') from (
        select jsonb_build_object('country', f.country, 'real', count(*) filter (where not v.automated), 'all', count(*),
                                  'contacted', count(*) filter (where v.contacted)) as x
        from firsts f join v using (session_id) group by f.country order by count(*) desc limit 80) t),
    'devices', (select coalesce(jsonb_agg(x), '[]') from (
        select jsonb_build_object('device', coalesce(d.device, 'unknown'), 'real', count(*) filter (where not v.automated), 'all', count(*)) as x
        from v left join public.visitor_devices d using (session_id) where v.cur
        group by coalesce(d.device, 'unknown') order by count(*) desc) t),
    'locales', (select coalesce(jsonb_agg(x), '[]') from (
        select jsonb_build_object('locale', f.locale, 'real', count(*) filter (where not v.automated), 'all', count(*)) as x
        from firsts f join v using (session_id) group by f.locale order by count(*) desc) t),
    'projects', (select coalesce(jsonb_agg(jsonb_build_object('slug', s.slug,
          'views_real', coalesce(p.views_real, 0), 'views_all', coalesce(p.views_all, 0),
          'visitors_real', coalesce(p.visitors_real, 0), 'visitors_all', coalesce(p.visitors_all, 0),
          'requests', coalesce(a.n, 0)) order by coalesce(a.n, 0) desc, coalesce(p.views_all, 0) desc), '[]')
      from (select slug from proj union select slug from asked) s
      left join proj p using (slug) left join asked a using (slug)),
    'recent', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]')
      from (select type, id, reference, kind, form, name, projects, status, created_at,
                   case when coalesce(source, '') = '' then 'none' else public.traffic_source(source, null) end as source,
                   coalesce(public.traffic_campaign(source), '') as campaign
            from leads order by created_at desc limit 12) r)
  ) into result;

  return result;
end;
$$;
