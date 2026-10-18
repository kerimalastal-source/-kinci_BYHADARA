-- 0025: the rest of the statistics page (owner's request 2026-10-18, phase 2).
-- Run once in the Supabase SQL Editor of "kerimalastal-source's Project"
-- (khibypqmvnxuetmvjcnn), after 0024. Read-only addition: nothing new is collected and
-- nothing existing changes; the page keeps its older sections until this runs.
--
-- admin_stats_details(days): one read of the visits for the period and the one before it:
-- visitors per day (real and all) for both periods, the visit journey (visit, saw a
-- project, opened a request page, sent a form), countries, devices and entry language,
-- project views against requests, and the latest requests (tests left out). Admin only.

do $$
begin
  if to_regprocedure('public.stats_is_test(text, text, text)') is null then
    raise exception 'Run 0024_stats_overview.sql first, in the HADARA Real Estate project.';
  end if;
end $$;

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
    select e.session_id, regexp_replace(e.path, '^/(ar|fa|fr|ru)(/|$)', '/') as page, e.locale, e.country, e.created_at, e.id
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

revoke all on function public.admin_stats_details(int) from public, anon;
grant execute on function public.admin_stats_details(int) to authenticated;
