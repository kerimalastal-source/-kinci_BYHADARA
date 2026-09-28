-- 0011: live chat with the team. A visitor writes in the site's chat panel, the message
-- reaches the team on Telegram, and the team's reply (a Telegram "reply" to it, or the
-- admin chats page) shows up in the visitor's chat. Run after 0008 (needs is_admin() and
-- cron_secret_ok()). Plain ASCII on purpose.

do $$
begin
  if to_regprocedure('public.is_admin()') is null or to_regprocedure('public.cron_secret_ok(text)') is null then
    raise exception 'Run 0008 first, in the HADARA Real Estate project.';
  end if;
end $$;

create table if not exists public.live_chats (
  id uuid primary key default gen_random_uuid(),
  -- The visitor's secret for reading and writing this conversation (kept in their browser).
  token uuid not null default gen_random_uuid(),
  reference text not null unique default ('LC-' || upper(substr(md5(gen_random_uuid()::text), 1, 6))),
  name text check (length(name) <= 120),
  contact text check (length(contact) <= 160),
  locale text check (length(locale) <= 8),
  page text check (length(page) <= 300),
  country text check (length(country) <= 2),
  city text check (length(city) <= 100),
  campaign text check (length(campaign) <= 300),
  -- The Telegram message that opened the conversation (later ones are sent as replies to it).
  telegram_root bigint,
  last_visitor_at timestamptz not null default now(),
  last_team_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists live_chats_updated_idx on public.live_chats (updated_at desc);

create table if not exists public.live_chat_messages (
  id bigint generated always as identity primary key,
  chat_id uuid not null references public.live_chats (id) on delete cascade,
  sender text not null check (sender in ('visitor', 'team')),
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists live_chat_messages_chat_idx on public.live_chat_messages (chat_id, id);

-- Which Telegram message belongs to which conversation (a reply to any of them reaches it).
create table if not exists public.live_chat_telegram (
  message_id bigint primary key,
  chat_id uuid not null references public.live_chats (id) on delete cascade
);

alter table public.live_chats enable row level security;
alter table public.live_chat_messages enable row level security;
alter table public.live_chat_telegram enable row level security;
revoke all on public.live_chats, public.live_chat_messages, public.live_chat_telegram from anon, authenticated;
grant select on public.live_chats, public.live_chat_messages to authenticated;
drop policy if exists live_chats_admin on public.live_chats;
create policy live_chats_admin on public.live_chats for select to authenticated using (public.is_admin());
drop policy if exists live_chat_messages_admin on public.live_chat_messages;
create policy live_chat_messages_admin on public.live_chat_messages for select to authenticated using (public.is_admin());

/* ---------- Visitor side (anon, through /api/live-chat) ---------- */

-- Sends a visitor message; p_chat null starts a new conversation. Returns the conversation,
-- its token and whether it is new, or {error: invalid | not_found | limit | busy}.
create or replace function public.live_chat_send(p_chat uuid, p_token uuid, p_body text, p_name text, p_contact text,
  p_locale text, p_page text, p_country text, p_city text, p_campaign text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.live_chats;
  is_new boolean := p_chat is null;
  recent int;
  msg bigint;
begin
  p_body := btrim(coalesce(p_body, ''));
  if length(p_body) = 0 or length(p_body) > 2000 then
    return jsonb_build_object('error', 'invalid');
  end if;
  if is_new then
    -- A ceiling on new conversations, so a flood can't swamp the team's Telegram.
    select count(*) into recent from public.live_chats where created_at > now() - interval '1 hour';
    if recent >= 60 then
      return jsonb_build_object('error', 'busy');
    end if;
    insert into public.live_chats (name, contact, locale, page, country, city, campaign)
    values (left(nullif(btrim(p_name), ''), 120), left(nullif(btrim(p_contact), ''), 160), left(p_locale, 8),
            left(p_page, 300), left(p_country, 2), left(p_city, 100), left(nullif(btrim(p_campaign), ''), 300))
    returning * into c;
  else
    select * into c from public.live_chats where id = p_chat and token = p_token for update;
    if not found then
      return jsonb_build_object('error', 'not_found');
    end if;
    select count(*) into recent from public.live_chat_messages
     where chat_id = c.id and sender = 'visitor' and created_at > now() - interval '10 minutes';
    if recent >= 30 then
      return jsonb_build_object('error', 'limit');
    end if;
    update public.live_chats
       set name = coalesce(left(nullif(btrim(p_name), ''), 120), name),
           contact = coalesce(left(nullif(btrim(p_contact), ''), 160), contact),
           page = coalesce(left(p_page, 300), page),
           last_visitor_at = now(), updated_at = now()
     where id = c.id returning * into c;
  end if;
  insert into public.live_chat_messages (chat_id, sender, body) values (c.id, 'visitor', p_body) returning id into msg;
  -- Conversations are kept 90 days after their last message.
  if random() < 0.02 then
    delete from public.live_chats where updated_at < now() - interval '90 days';
  end if;
  return jsonb_build_object('chat', c.id, 'token', c.token, 'reference', c.reference, 'message', msg, 'new', is_new,
    'name', c.name, 'contact', c.contact, 'telegram_root', c.telegram_root);
end $$;

-- The conversation's messages after p_after (0 = all), for the visitor's chat panel.
create or replace function public.live_chat_poll(p_chat uuid, p_token uuid, p_after bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.live_chats where id = p_chat and token = p_token) then
    return jsonb_build_object('error', 'not_found');
  end if;
  return jsonb_build_object('messages', (
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'sender', sender, 'body', body, 'at', created_at) order by id), '[]'::jsonb)
      from (select * from public.live_chat_messages where chat_id = p_chat and id > coalesce(p_after, 0) order by id limit 200) m));
end $$;

revoke all on function public.live_chat_send(uuid, uuid, text, text, text, text, text, text, text, text) from public;
revoke all on function public.live_chat_poll(uuid, uuid, bigint) from public;
grant execute on function public.live_chat_send(uuid, uuid, text, text, text, text, text, text, text, text) to anon;
grant execute on function public.live_chat_poll(uuid, uuid, bigint) to anon;

/* ---------- Team side ---------- */

-- The server records each Telegram message it sent for a conversation (with the cron secret).
create or replace function public.live_chat_link_telegram(p_secret text, p_chat uuid, p_message_id bigint, p_root boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.cron_secret_ok(p_secret) then
    return;
  end if;
  insert into public.live_chat_telegram (message_id, chat_id) values (p_message_id, p_chat) on conflict do nothing;
  if p_root then
    update public.live_chats set telegram_root = p_message_id where id = p_chat and telegram_root is null;
  end if;
end $$;

-- A team reply on Telegram (a reply to one of the conversation's messages).
create or replace function public.live_chat_team_reply(p_secret text, p_reply_to bigint, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
  ref text;
begin
  if not public.cron_secret_ok(p_secret) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  select chat_id into target from public.live_chat_telegram where message_id = p_reply_to;
  if target is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  p_body := btrim(coalesce(p_body, ''));
  if length(p_body) = 0 or length(p_body) > 2000 then
    return jsonb_build_object('error', 'invalid');
  end if;
  insert into public.live_chat_messages (chat_id, sender, body) values (target, 'team', p_body);
  update public.live_chats set last_team_at = now(), updated_at = now() where id = target returning reference into ref;
  return jsonb_build_object('chat', target, 'reference', ref);
end $$;

-- A reply typed on the admin chats page.
create or replace function public.live_chat_admin_reply(p_chat uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  msg bigint;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'forbidden');
  end if;
  p_body := btrim(coalesce(p_body, ''));
  if length(p_body) = 0 or length(p_body) > 2000 then
    return jsonb_build_object('error', 'invalid');
  end if;
  insert into public.live_chat_messages (chat_id, sender, body) values (p_chat, 'team', p_body) returning id into msg;
  update public.live_chats set last_team_at = now(), updated_at = now() where id = p_chat;
  return jsonb_build_object('message', msg);
end $$;

revoke all on function public.live_chat_link_telegram(text, uuid, bigint, boolean) from public;
revoke all on function public.live_chat_team_reply(text, bigint, text) from public;
revoke all on function public.live_chat_admin_reply(uuid, text) from public;
grant execute on function public.live_chat_link_telegram(text, uuid, bigint, boolean) to anon;
grant execute on function public.live_chat_team_reply(text, bigint, text) to anon;
grant execute on function public.live_chat_admin_reply(uuid, text) to authenticated;
