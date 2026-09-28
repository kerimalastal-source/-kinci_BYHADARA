-- 0009: what visitors did with the cookie notice (accepted / declined / ignored).
-- Anonymous, like visitor_events: only the random per-tab session id and the choice.
-- Run after 0002 and 0008 (needs visitor_events and is_admin()).

do $$
begin
  if to_regclass('public.visitor_events') is null or to_regprocedure('public.is_admin()') is null then
    raise exception 'Run this in the HADARA Real Estate project (visitor_events and is_admin() are missing).';
  end if;
end $$;

create table if not exists public.visitor_consent (
  session_id uuid primary key,
  choice text not null check (choice in ('granted', 'denied', 'none')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists visitor_consent_created_at_idx on public.visitor_consent (created_at);
alter table public.visitor_consent enable row level security;
revoke all on public.visitor_consent from anon, authenticated;

-- 'none' = the notice was shown; a later 'granted' / 'denied' replaces it, never the reverse.
create or replace function public.save_visit_consent(p_session uuid, p_choice text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_session is null or p_choice is null or p_choice not in ('granted', 'denied', 'none') then
    return;
  end if;
  insert into public.visitor_consent (session_id, choice)
  values (p_session, p_choice)
  on conflict (session_id) do update
    set choice = case when excluded.choice = 'none' then visitor_consent.choice else excluded.choice end,
        updated_at = now();
  -- Same 30 days as the visit records.
  if random() < 0.02 then
    delete from public.visitor_consent where created_at < now() - interval '30 days';
  end if;
end $$;

revoke all on function public.save_visit_consent(uuid, text) from public;
grant execute on function public.save_visit_consent(uuid, text) to anon;

-- Visits that saw the notice in the last p_days days (Istanbul days, today included).
-- A new tab opened from our own site is not a new visit, so it is left out.
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
                    order by e.created_at, e.id limit 1), '') not like '/%';

  return result;
end $$;

revoke all on function public.admin_consent_stats(int) from public;
grant execute on function public.admin_consent_stats(int) to authenticated;
