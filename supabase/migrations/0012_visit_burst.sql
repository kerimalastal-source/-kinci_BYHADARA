-- 0012: no Telegram alert for likely automated visits (link checks from data centers).
-- Run once in the Supabase SQL Editor of "kerimalastal-source's Project"
-- (khibypqmvnxuetmvjcnn), after 0002 and 0004. Additions only: nothing existing changes.
--
-- Facebook and others open a shared link in a normal browser from their data centers,
-- often several at once, so the user agent doesn't give them away. api/track.ts asks
-- visit_check() how many other sessions opened the same first page within 10 seconds
-- of this session's start; if any did (or the city is a data-center town), it sends no
-- Telegram message for that visit. The visit itself is still saved in visitor_events.

do $$
begin
  if to_regclass('public.listings') is null then
    raise exception 'Wrong database: public.listings was not found. Run this in the HADARA Real Estate Supabase project (the one with the resale tables).';
  end if;
  if to_regclass('public.visitor_events') is null or to_regclass('public.visitor_alerts') is null then
    raise exception 'visitor_events / visitor_alerts not found: run 0002_visitor_events.sql and 0004_visitor_alerts.sql first.';
  end if;
end
$$;

-- Returns {"others": <other sessions that opened p_path within 10 s of this session's
-- first page (or of now, before it is saved)>, "message_id": <this session's Telegram
-- alert, or null>}. Counts only, never another session's data.
create or replace function public.visit_check(p_session_id uuid, p_path text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with started as (
    select coalesce(min(created_at), now()) as at
    from public.visitor_events
    where session_id = p_session_id
  )
  select jsonb_build_object(
    'others', (
      select count(distinct e.session_id)::int
      from public.visitor_events e, started
      where e.session_id <> p_session_id
        and e.path = p_path
        and e.created_at between started.at - interval '10 seconds' and started.at + interval '10 seconds'
    ),
    'message_id', (select message_id from public.visitor_alerts where session_id = p_session_id)
  );
$$;

-- Only anon (the Vercel function's key) may call it.
revoke all on function public.visit_check(uuid, text) from public, anon, authenticated;
grant execute on function public.visit_check(uuid, text) to anon;
