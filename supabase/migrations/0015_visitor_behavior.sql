-- 0015: what visitors do on the site, and a year of history (1 of 2; then run 0016).
-- Run once in the Supabase SQL Editor of "kerimalastal-source's Project"
-- (khibypqmvnxuetmvjcnn), after 0008. Additions only, plus a longer keep time.
--
--   * visitor_devices: mobile / tablet / desktop of each visit (saved with its first page).
--   * visitor_actions: button presses and form starts (WhatsApp, call, "I'm interested",
--     video, map, save, chat, form started / sent), with the project they were about.
--     Anonymous like visitor_events: the random per-tab session id, never a name or number.
--   * purge_old_visitor_events(): same name, now keeps visits for 365 days (was 30).
--     Telegram message ids are still cleared after 30 days.

do $$
begin
  if to_regclass('public.visitor_events') is null or to_regclass('public.visitor_campaigns') is null then
    raise exception 'Run 0002, 0004 and 0008 first, in the HADARA Real Estate project.';
  end if;
end $$;

create table if not exists public.visitor_devices (
  session_id uuid primary key,
  device text not null check (device in ('mobile', 'tablet', 'desktop')),
  created_at timestamptz not null default now()
);
create index if not exists visitor_devices_created_at_idx on public.visitor_devices (created_at);
alter table public.visitor_devices enable row level security;
revoke all on public.visitor_devices from anon, authenticated;

create table if not exists public.visitor_actions (
  id bigserial primary key,
  session_id uuid not null,
  action text not null check (action in (
    'whatsapp', 'call', 'email', 'interested', 'favorite', 'video_play',
    'map_open', 'chat_open', 'tour_link', 'form_start', 'form_sent')),
  target text,
  path text,
  created_at timestamptz not null default now()
);
create index if not exists visitor_actions_created_at_idx on public.visitor_actions (created_at);
create index if not exists visitor_actions_session_idx on public.visitor_actions (session_id);
alter table public.visitor_actions enable row level security;
revoke all on public.visitor_actions from anon, authenticated;

create or replace function public.save_visit_device(p_session_id uuid, p_device text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.visitor_devices (session_id, device)
  select p_session_id, p_device
  where p_device in ('mobile', 'tablet', 'desktop')
  on conflict (session_id) do nothing;
$$;

-- At most 40 actions per session per 10 minutes (anything more is not a person).
create or replace function public.record_visit_action(p_session_id uuid, p_action text, p_target text, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_session_id is null or p_action is null then return; end if;
  if (select count(*) from public.visitor_actions
      where session_id = p_session_id and created_at > now() - interval '10 minutes') >= 40 then
    return;
  end if;
  insert into public.visitor_actions (session_id, action, target, path)
  values (p_session_id, p_action, nullif(left(trim(coalesce(p_target, '')), 80), ''), nullif(left(coalesce(p_path, ''), 300), ''));
exception when check_violation then
  return;
end;
$$;

create or replace function public.purge_old_visitor_events()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.visitor_events where created_at < now() - interval '365 days';
  delete from public.visitor_alerts where created_at < now() - interval '30 days';
  delete from public.visitor_campaigns where created_at < now() - interval '365 days';
  delete from public.visitor_devices where created_at < now() - interval '365 days';
  delete from public.visitor_actions where created_at < now() - interval '365 days';
$$;

revoke all on function public.save_visit_device(uuid, text) from public, anon, authenticated;
grant execute on function public.save_visit_device(uuid, text) to anon;
revoke all on function public.record_visit_action(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.record_visit_action(uuid, text, text, text) to anon;
