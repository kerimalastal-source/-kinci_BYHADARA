-- 0016: "What visitors do" for the admin statistics page (2 of 2 with 0015; 0017 is optional).
-- Run once in the Supabase SQL Editor of "kerimalastal-source's Project"
-- (khibypqmvnxuetmvjcnn), after 0015. Adds one function; nothing existing changes.
--
-- admin_behavior_stats(days): admins only, counts only (no session ids, no personal data):
--   visits and how many contacted us (WhatsApp, call, email, "I'm interested", a form sent),
--   devices, each action, actions per project, and forms started vs sent.
-- New tabs opened from the site (first referrer is one of our pages) aren't visits, as in
-- admin_visit_stats().

do $$
begin
  if to_regclass('public.visitor_actions') is null or to_regprocedure('public.is_admin()') is null then
    raise exception 'Run 0015 first, in the HADARA Real Estate project.';
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

  with sessions as (
    select session_id, (array_agg(referrer order by created_at, id))[1] as referrer
    from public.visitor_events where created_at >= since
    group by session_id
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
