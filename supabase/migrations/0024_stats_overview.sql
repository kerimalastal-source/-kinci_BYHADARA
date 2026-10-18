-- 0024: the top of the statistics page (owner's request 2026-10-18, phase 1).
-- Run once in the Supabase SQL Editor of "kerimalastal-source's Project"
-- (khibypqmvnxuetmvjcnn), after 0021. Read-only additions: nothing new is collected and
-- nothing existing changes; the page says "available after update 0024" until this runs.
--
-- stats_is_test(name, email, company): a test request (the owner's own emails, kept here
-- only as SHA-256 hashes, or "test" in the name or company). Internal.
-- admin_stats_overview(days): one read of the visits for the period and the one before it
-- (same length): visitors (real and all), requests (inquiries and tour bookings, tests left
-- out), WhatsApp and call presses, when recording of each started, the source x campaign
-- table, and the inquiries still waiting for a reply (any date, oldest first). Admin only.

do $$
begin
  if to_regprocedure('public.visit_verdicts(timestamp with time zone)') is null then
    raise exception 'Run 0021_automated_visits.sql first, in the HADARA Real Estate project.';
  end if;
end $$;

create or replace function public.stats_is_test(p_name text, p_email text, p_company text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_name, '') ~* 'test' or coalesce(p_company, '') ~* 'test'
      or encode(sha256(convert_to(lower(btrim(coalesce(p_email, ''))), 'UTF8')), 'hex') in (
        '6e2b52b1d994c16c5082882aceffe8938ddf4dd2ba7a14795261695463f36ea9',
        '2e1ab1a105d8792f3691988fefc33677354e0f6df139ef08f864170764e86ce6');
$$;

revoke all on function public.stats_is_test(text, text, text) from public, anon, authenticated;

create or replace function public.admin_stats_overview(p_days int)
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

  with verdicts as (select * from public.visit_verdicts(prev)),
  visits as (
    select v.session_id, v.automated, (v.started >= since) as cur,
           public.traffic_source(c.campaign, f.referrer) as source,
           coalesce(public.traffic_campaign(c.campaign), '') as campaign
    from verdicts v
    left join public.visitor_campaigns c using (session_id)
    left join lateral (select e.referrer from public.visitor_events e
                       where e.session_id = v.session_id order by e.created_at, e.id limit 1) f on true
  ),
  clicks as (
    select (a.created_at >= since) as cur, coalesce(v.automated, false) as automated, v.source, v.campaign
    from public.visitor_actions a left join visits v using (session_id)
    where a.created_at >= prev and a.action in ('whatsapp', 'call')
  ),
  leads as (
    select 'inquiry' as type, (created_at >= since) as cur,
           public.stats_is_test(name, email, details->>'company') as test,
           case when coalesce(source, '') = '' then 'none' else public.traffic_source(source, null) end as source,
           coalesce(public.traffic_campaign(source), '') as campaign
    from public.inquiries where created_at >= prev
    union all
    select 'booking', (created_at >= since), public.stats_is_test(name, email, null),
           case when coalesce(source, '') = '' then 'none' else public.traffic_source(source, null) end,
           coalesce(public.traffic_campaign(source), '')
    from public.tour_bookings where created_at >= prev
  ),
  periods as (
    select p.cur, jsonb_build_object(
      'real', jsonb_build_object(
        'visitors', (select count(*) from visits where cur = p.cur and not automated),
        'clicks', (select count(*) from clicks where cur = p.cur and not automated)),
      'all', jsonb_build_object(
        'visitors', (select count(*) from visits where cur = p.cur),
        'clicks', (select count(*) from clicks where cur = p.cur)),
      'inquiries', (select count(*) from leads where cur = p.cur and not test and type = 'inquiry'),
      'bookings', (select count(*) from leads where cur = p.cur and not test and type = 'booking')) as x
    from (values (true), (false)) p(cur)
  ),
  cells as (
    select source, campaign, count(*) filter (where not automated) as real_visits, count(*) as all_visits,
           0 as leads, 0 as real_clicks, 0 as all_clicks
    from visits where cur group by 1, 2
    union all
    select source, campaign, 0, 0, count(*), 0, 0 from leads where cur and not test group by 1, 2
    union all
    select source, campaign, 0, 0, 0, count(*) filter (where not automated), count(*)
    from clicks where cur and source is not null group by 1, 2
  ),
  sources as (
    select source, campaign, sum(real_visits) as real_visits, sum(all_visits) as all_visits, sum(leads) as leads,
           sum(real_clicks) as real_clicks, sum(all_clicks) as all_clicks
    from cells group by 1, 2
  ),
  waiting as (
    select id, reference, kind, coalesce(details->>'form', '') as form, name, projects, created_at
    from public.inquiries
    where status = 'new' and not public.stats_is_test(name, email, details->>'company')
  )
  select jsonb_build_object(
    'days', days,
    'since', since,
    'prev_since', prev,
    'started', jsonb_build_object(
      'visits', (select min(created_at) from public.visitor_events),
      'actions', (select min(created_at) from public.visitor_actions),
      'leads', (select least(min(i.created_at), (select min(created_at) from public.tour_bookings)) from public.inquiries i)),
    'automated', (select count(*) from visits where cur and automated),
    'tests', (select count(*) from leads where cur and test),
    'current', (select x from periods where cur),
    'previous', (select x from periods where not cur),
    'sources', (select coalesce(jsonb_agg(to_jsonb(s) order by s.leads desc, s.all_visits desc, s.source), '[]')
                from (select * from sources order by leads desc, all_visits desc limit 40) s),
    'waiting_total', (select count(*) from waiting),
    'waiting', (select coalesce(jsonb_agg(to_jsonb(w) order by w.created_at), '[]')
                from (select * from waiting order by created_at limit 50) w)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_stats_overview(int) from public, anon;
grant execute on function public.admin_stats_overview(int) to authenticated;
