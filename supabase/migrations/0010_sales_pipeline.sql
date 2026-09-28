-- 0010: sales pipeline (one row per customer), follow-up reminders, and ad spend
-- for the cost-per-lead report. Run after 0007 and 0008 (needs inquiries, is_admin()
-- and cron_secret_ok()). Plain ASCII on purpose (the Supabase SQL editor mis-splits otherwise).

do $$
begin
  if to_regclass('public.inquiries') is null or to_regprocedure('public.is_admin()') is null
     or to_regprocedure('public.cron_secret_ok(text)') is null then
    raise exception 'Run 0007 and 0008 first, in the HADARA Real Estate project.';
  end if;
end $$;

/* ---------- Pipeline: one row per customer ---------- */

-- keys: 'e:<email>' and 'p:<last 9 phone digits>' of the customer's inquiries and bookings,
-- the same rule the admin customers page uses to group them.
create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  keys text[] not null check (cardinality(keys) between 1 and 20),
  name text not null default '' check (length(name) <= 200),
  email text check (length(email) <= 200),
  phone text check (length(phone) <= 40),
  stage text not null default 'new'
    check (stage in ('new', 'contacted', 'tour', 'visit', 'negotiation', 'won', 'lost')),
  deal_value numeric(14, 2) check (deal_value is null or deal_value >= 0),
  currency text not null default 'USD' check (currency in ('USD', 'EUR', 'TRY', 'GBP')),
  project text check (length(project) <= 80),
  lost_reason text check (length(lost_reason) <= 500),
  follow_up_at timestamptz,
  follow_up_note text check (length(follow_up_note) <= 500),
  follow_up_sent_at timestamptz,
  stage_changed_at timestamptz not null default now(),
  won_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_leads_keys_idx on public.crm_leads using gin (keys);
create index if not exists crm_leads_follow_up_idx on public.crm_leads (follow_up_at) where follow_up_sent_at is null;

-- Keeps the dates right: stage change time, won date, and a new reminder when the
-- follow-up time changes.
create or replace function public.crm_leads_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    new.won_at := case when new.stage = 'won' then now() else null end;
  end if;
  if tg_op = 'INSERT' or new.follow_up_at is distinct from old.follow_up_at then
    new.follow_up_sent_at := null;
  end if;
  return new;
end $$;

drop trigger if exists crm_leads_touch on public.crm_leads;
create trigger crm_leads_touch before insert or update on public.crm_leads
  for each row execute function public.crm_leads_touch();

alter table public.crm_leads enable row level security;
revoke all on public.crm_leads from anon;
grant select, insert, update, delete on public.crm_leads to authenticated;
drop policy if exists crm_leads_admin on public.crm_leads;
create policy crm_leads_admin on public.crm_leads for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

/* ---------- Follow-up reminders (server only, with the cron secret) ---------- */

create table if not exists public.internal_state (
  name text primary key,
  at timestamptz not null
);
alter table public.internal_state enable row level security;
revoke all on public.internal_state from anon, authenticated;

-- Follow-ups whose time has come, marked as sent so each is announced once. With
-- p_min_gap_seconds > 0 it runs at most that often (it is called from page views).
create or replace function public.claim_due_followups(p_secret text, p_min_gap_seconds int default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  last_run timestamptz;
  result jsonb;
begin
  if not public.cron_secret_ok(p_secret) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if coalesce(p_min_gap_seconds, 0) > 0 then
    select at into last_run from public.internal_state where name = 'followups';
    if last_run is not null and last_run > now() - make_interval(secs => p_min_gap_seconds) then
      return '[]'::jsonb;
    end if;
    insert into public.internal_state (name, at) values ('followups', now())
      on conflict (name) do update set at = excluded.at;
  end if;
  with due as (
    update public.crm_leads set follow_up_sent_at = now()
     where follow_up_at <= now() and follow_up_sent_at is null and stage not in ('won', 'lost')
    returning id, name, email, phone, stage, project, follow_up_at, follow_up_note
  )
  select coalesce(jsonb_agg(to_jsonb(due) order by follow_up_at), '[]'::jsonb) into result from due;
  return result;
end $$;

-- A reminder that could not be delivered is put back for the next run.
create or replace function public.release_followups(p_secret text, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.cron_secret_ok(p_secret) then
    update public.crm_leads set follow_up_sent_at = null where id = any(p_ids);
  end if;
end $$;

-- For the morning summary: today's follow-ups (Istanbul day) and how many are overdue.
create or replace function public.followups_today(p_secret text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Europe/Istanbul')::date;
begin
  if not public.cron_secret_ok(p_secret) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  return jsonb_build_object(
    'today', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'phone', phone, 'email', email,
                'stage', stage, 'project', project, 'at', follow_up_at, 'note', follow_up_note) order by follow_up_at), '[]'::jsonb)
              from public.crm_leads
              where stage not in ('won', 'lost') and (follow_up_at at time zone 'Europe/Istanbul')::date = today),
    'overdue', (select count(*) from public.crm_leads
                where stage not in ('won', 'lost') and follow_up_at < today::timestamp at time zone 'Europe/Istanbul'),
    'open', (select count(*) from public.crm_leads where stage not in ('new', 'won', 'lost')));
end $$;

revoke all on function public.claim_due_followups(text, int) from public;
revoke all on function public.release_followups(text, uuid[]) from public;
revoke all on function public.followups_today(text) from public;
grant execute on function public.claim_due_followups(text, int) to anon;
grant execute on function public.release_followups(text, uuid[]) to anon;
grant execute on function public.followups_today(text) to anon;

/* ---------- Ad spend (cost per lead) ---------- */

-- What was spent on a source (utm_source: facebook, instagram, google-ads...) over a period,
-- optionally for one campaign (utm_campaign). Both stored lower-case, as the links send them.
create table if not exists public.ad_spend (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source ~ '^[a-z0-9._-]{1,40}$'),
  campaign text check (campaign is null or (campaign = lower(campaign) and length(campaign) between 1 and 80)),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'USD' check (currency in ('USD', 'EUR', 'TRY', 'GBP')),
  note text check (length(note) <= 300),
  created_at timestamptz not null default now()
);
alter table public.ad_spend enable row level security;
revoke all on public.ad_spend from anon;
grant select, insert, update, delete on public.ad_spend to authenticated;
drop policy if exists ad_spend_admin on public.ad_spend;
create policy ad_spend_admin on public.ad_spend for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- The cost-per-lead report for p_from..p_to (Istanbul days): ad visits, leads and won
-- sales per (source, campaign), and the spend falling in the period (prorated by day).
-- A won customer counts for the ad of their first message or booking.
create or replace function public.admin_ad_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  since timestamptz := p_from::timestamp at time zone 'Europe/Istanbul';
  until timestamptz := (p_to + 1)::timestamp at time zone 'Europe/Istanbul';
  result jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    return jsonb_build_object('error', 'invalid');
  end if;

  with leads as (
    select 'inquiry' as type, created_at, lower(trim(email)) as e, right(regexp_replace(phone, '\D', '', 'g'), 9) as p,
           case when coalesce(source, '') = '' then 'none' else public.traffic_source(source, null) end as source,
           public.traffic_campaign(source) as campaign
      from public.inquiries
    union all
    select 'booking', created_at, lower(trim(email)), right(regexp_replace(phone, '\D', '', 'g'), 9),
           case when coalesce(source, '') = '' then 'none' else public.traffic_source(source, null) end,
           public.traffic_campaign(source)
      from public.tour_bookings where status <> 'cancelled'
  ),
  won as (
    select l.deal_value, l.currency, f.source, f.campaign
      from public.crm_leads l
      left join lateral (
        select x.source, x.campaign from leads x
         where ('e:' || x.e) = any(l.keys) or (length(x.p) >= 6 and ('p:' || x.p) = any(l.keys))
         order by x.created_at limit 1) f on true
     where l.stage = 'won' and l.won_at >= since and l.won_at < until
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'visits', (select coalesce(jsonb_agg(jsonb_build_object('source', source, 'campaign', campaign, 'visitors', n)), '[]'::jsonb)
               from (select public.traffic_source(campaign, null) as source, public.traffic_campaign(campaign) as campaign, count(*) as n
                       from public.visitor_campaigns where created_at >= since and created_at < until group by 1, 2) v),
    'leads', (select coalesce(jsonb_agg(jsonb_build_object('source', source, 'campaign', campaign,
                'inquiries', inquiries, 'bookings', bookings)), '[]'::jsonb)
              from (select source, campaign, count(*) filter (where type = 'inquiry') as inquiries,
                           count(*) filter (where type = 'booking') as bookings
                      from leads where created_at >= since and created_at < until group by 1, 2) l),
    'won', (select coalesce(jsonb_agg(jsonb_build_object('source', coalesce(source, 'none'), 'campaign', campaign,
              'value', deal_value, 'currency', currency)), '[]'::jsonb) from won),
    'spend', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'source', source, 'campaign', campaign, 'currency', currency,
                'amount', round(amount * (least(ends_on, p_to) - greatest(starts_on, p_from) + 1)::numeric
                                       / (ends_on - starts_on + 1), 2))), '[]'::jsonb)
              from public.ad_spend where starts_on <= p_to and ends_on >= p_from)
  ) into result;
  return result;
end $$;

revoke all on function public.admin_ad_report(date, date) from public;
grant execute on function public.admin_ad_report(date, date) to authenticated;
