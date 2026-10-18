-- 0023: leave automated visits out of the admin statistics (3 of 3, after 0022).
-- Run once in the Supabase SQL Editor of "kerimalastal-source's Project"
-- (khibypqmvnxuetmvjcnn), after 0021. Recreates admin_behavior_stats() (as 0016 left it)
-- and admin_consent_stats() (as 0009 left it), except that the visits visit_verdicts()
-- marks automated are left out. Same names, arguments and return types.

do $$
begin
  if to_regprocedure('public.visit_verdicts(timestamp with time zone)') is null then
    raise exception 'Run 0021_automated_visits.sql first, in the HADARA Real Estate project.';
  end if;
end $$;

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

  with bots as (
    select session_id from public.visit_verdicts(since) where automated
  ),
  sessions as (
    select e.session_id, (array_agg(e.referrer order by e.created_at, e.id))[1] as referrer
    from public.visitor_events e
    where e.created_at >= since and not exists (select 1 from bots b where b.session_id = e.session_id)
    group by e.session_id
  ),
  visits as (
    select s.session_id, coalesce(d.device, 'unknown') as device
    from sessions s left join public.visitor_devices d using (session_id)
    where coalesce(s.referrer, '') not like '/%'
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

create or replace function public.admin_consent_stats(p_days int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  days int := least(greatest(coalesce(p_days, 7), 1), 30);
  since timestamptz := ((now() at time zone 'Europe/Istanbul')::date - (days - 1)) at time zone 'Europe/Istanbul';
  result jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'forbidden');
  end if;

  with bots as (
    select session_id from public.visit_verdicts(since) where automated
  )
  select jsonb_build_object(
           'shown', count(*),
           'granted', count(*) filter (where c.choice = 'granted'),
           'denied', count(*) filter (where c.choice = 'denied'),
           'ignored', count(*) filter (where c.choice = 'none'))
    into result
    from public.visitor_consent c
   where c.created_at >= since
     and coalesce((select e.referrer from public.visitor_events e
                    where e.session_id = c.session_id
                    order by e.created_at, e.id limit 1), '') not like '/%'
     and not exists (select 1 from bots b where b.session_id = c.session_id);

  return result;
end $$;

revoke all on function public.admin_consent_stats(int) from public;
grant execute on function public.admin_consent_stats(int) to authenticated;
