-- HADARA Real Estate — admin insights: visitor statistics, the daily Telegram summary and
-- the day-before tour reminder email.
-- Run once in the Supabase SQL Editor of the HADARA Real Estate project
-- (khibypqmvnxuetmvjcnn), AFTER 0004, 0005 and 0007. Safe to run twice.
--
--   * visitor_campaigns: the ad campaign (utm_source / utm_campaign …) a visit came from,
--     saved with the visit's first page (save_visit_campaign(), called by /api/track).
--   * admin_visit_stats(days): aggregated visits, sources, countries, pages and leads for
--     the admin statistics page. Admins only; no personal data.
--   * daily_digest(secret) / mark_tour_reminded(secret, ids): what the daily job
--     (/api/daily, a Vercel cron) needs for the morning summary and the reminders. They
--     only answer with the secret stored in internal_secrets, which the team copies once
--     into Vercel as CRON_SECRET:
--         select value from public.internal_secrets where name = 'cron';

-- Guard: stop right here if this is not the HADARA Real Estate database, or a migration
-- this one builds on hasn't run.
do $$
begin
  if to_regclass('public.listings') is null or to_regprocedure('public.is_admin()') is null then
    raise exception 'Wrong database: run this in the HADARA Real Estate Supabase project (the one with the resale tables).';
  end if;
  if to_regclass('public.visitor_alerts') is null then
    raise exception 'Run 0004_visitor_alerts.sql first.';
  end if;
  if to_regprocedure('public.tour_booking_reply(uuid, text)') is null then
    raise exception 'Run 0005_tour_booking_updates.sql first.';
  end if;
  if to_regclass('public.inquiries') is null then
    raise exception 'Run 0007_inquiries.sql first.';
  end if;
end
$$;

/* ---------- Ad campaign of each visit ---------- */

create table if not exists public.visitor_campaigns (
  session_id uuid primary key,
  campaign text not null,
  created_at timestamptz not null default now()
);

create index if not exists visitor_campaigns_created_at_idx on public.visitor_campaigns (created_at);

alter table public.visitor_campaigns enable row level security;
revoke all on public.visitor_campaigns from anon, authenticated;

create or replace function public.save_visit_campaign(p_session_id uuid, p_campaign text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.visitor_campaigns (session_id, campaign)
  select p_session_id, left(trim(p_campaign), 300)
  where length(trim(coalesce(p_campaign, ''))) > 0
  on conflict (session_id) do nothing;
$$;

-- Same signature as 0004's: now also clears old campaigns.
create or replace function public.purge_old_visitor_events()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.visitor_events where created_at < now() - interval '30 days';
  delete from public.visitor_alerts where created_at < now() - interval '30 days';
  delete from public.visitor_campaigns where created_at < now() - interval '30 days';
$$;

revoke all on function public.save_visit_campaign(uuid, text) from public;
grant execute on function public.save_visit_campaign(uuid, text) to anon;

/* ---------- Where a visit or a lead came from ---------- */

-- "facebook", "instagram", "google-ads", "google.com", "direct"… from the campaign string
-- ("utm_source=facebook · utm_campaign=villa", or a gclid / fbclid) or the referring site.
create or replace function public.traffic_source(p_campaign text, p_referrer text)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_campaign, '') ~ 'utm_source=' then lower(substring(p_campaign from 'utm_source=([^ ·&]+)'))
    when coalesce(p_campaign, '') ~ 'gclid=' then 'google-ads'
    when coalesce(p_campaign, '') ~ 'fbclid=' then 'facebook'
    when coalesce(p_referrer, '') = '' then 'direct'
    else regexp_replace(lower(p_referrer), '^(www|m|l|lm|mobile)\.', '')
  end;
$$;

-- The campaign name (utm_campaign) of a campaign string, or null.
create or replace function public.traffic_campaign(p_campaign text)
returns text
language sql
immutable
as $$
  select lower(substring(p_campaign from 'utm_campaign=([^ ·&]+)'));
$$;

/* ---------- Statistics page (admins) ---------- */

create or replace function public.admin_visit_stats(p_days int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  days int := least(greatest(coalesce(p_days, 7), 1), 30);
  -- From the start of the Istanbul day, `days` days back (today included).
  since timestamptz := ((now() at time zone 'Europe/Istanbul')::date - (days - 1)) at time zone 'Europe/Istanbul';
  result jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'forbidden');
  end if;

  with ev as (
    select *, regexp_replace(path, '^/(ar|fr|ru)(/|$)', '/') as page
    from public.visitor_events where created_at >= since
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

revoke all on function public.admin_visit_stats(int) from public;
grant execute on function public.admin_visit_stats(int) to authenticated;

/* ---------- Daily job: morning summary + tour reminders ---------- */

alter table public.tour_bookings add column if not exists reminder_sent_at timestamptz;

-- A booking moved to another time gets a reminder for its new day.
create or replace function public.reset_tour_reminder()
returns trigger
language plpgsql
as $$
begin
  if new.slot_start is distinct from old.slot_start then
    new.reminder_sent_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tour_bookings_reset_reminder on public.tour_bookings;
create trigger tour_bookings_reset_reminder before update on public.tour_bookings
  for each row execute function public.reset_tour_reminder();

-- Secrets only the database and the site's server know. Nobody can read them through the API.
create table if not exists public.internal_secrets (
  name text primary key,
  value text not null,
  created_at timestamptz not null default now()
);

alter table public.internal_secrets enable row level security;
revoke all on public.internal_secrets from anon, authenticated;

insert into public.internal_secrets (name, value)
values ('cron', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (name) do nothing;

create or replace function public.cron_secret_ok(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.internal_secrets where name = 'cron' and value = coalesce(p_secret, '') and length(value) >= 32);
$$;

revoke all on function public.cron_secret_ok(text) from public, anon, authenticated;

-- Everything the morning summary needs, and the tours of tomorrow (Istanbul time) that
-- haven't had their reminder yet. Returns {"error": "forbidden"} without the right secret.
create or replace function public.daily_digest(p_secret text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Europe/Istanbul')::date;
  day_start timestamptz := today at time zone 'Europe/Istanbul';
begin
  if not public.cron_secret_ok(p_secret) then
    return jsonb_build_object('error', 'forbidden');
  end if;

  return jsonb_build_object(
    'today', today,
    'tours_today', (select coalesce(jsonb_agg(jsonb_build_object(
        'reference', reference, 'slot_start', slot_start, 'name', name, 'phone', phone, 'projects', to_jsonb(projects),
        'app', app, 'status', status, 'customer_reply', customer_reply) order by slot_start), '[]')
      from public.tour_bookings
      where status <> 'cancelled' and slot_start >= day_start and slot_start < day_start + interval '1 day'),
    'reminders', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'reference', reference, 'slot_start', slot_start, 'name', name, 'email', email, 'phone', phone,
        'projects', to_jsonb(projects), 'app', app, 'tour_language', tour_language, 'contact_method', contact_method,
        'site_locale', site_locale, 'visitor_timezone', visitor_timezone, 'source', source) order by slot_start), '[]')
      from public.tour_bookings
      where status <> 'cancelled' and reminder_sent_at is null
        and slot_start >= day_start + interval '1 day' and slot_start < day_start + interval '2 days'),
    'bookings_waiting', (select count(*) from public.tour_bookings where status = 'booked' and slot_start > now()),
    'bookings_yesterday', (select count(*) from public.tour_bookings
      where created_at >= day_start - interval '1 day' and created_at < day_start),
    'inquiries_new', (select count(*) from public.inquiries where status = 'new'),
    'inquiries_yesterday', (select count(*) from public.inquiries
      where created_at >= day_start - interval '1 day' and created_at < day_start),
    'inquiries_stale_count', (select count(*) from public.inquiries where status = 'new' and created_at < now() - interval '24 hours'),
    'inquiries_stale', (select coalesce(jsonb_agg(x), '[]') from (
      select jsonb_build_object('reference', reference, 'name', name, 'kind', kind, 'created_at', created_at) as x
      from public.inquiries where status = 'new' and created_at < now() - interval '24 hours'
      order by created_at limit 10) t),
    'listings_pending', (select count(*) from public.listings where status = 'pending_review'),
    'visitors_yesterday', (select count(*) from (
      select session_id from public.visitor_events
      where created_at >= day_start - interval '1 day' and created_at < day_start
      group by session_id
      having coalesce((array_agg(referrer order by created_at, id))[1], '') not like '/%') v),
    'sources_yesterday', (select coalesce(jsonb_agg(x order by (x->>'visitors')::int desc), '[]') from (
      select jsonb_build_object('source', source, 'visitors', count(*)) as x
      from (
        select public.traffic_source(c.campaign, s.referrer) as source
        from (
          select session_id, (array_agg(referrer order by created_at, id))[1] as referrer
          from public.visitor_events
          where created_at >= day_start - interval '1 day' and created_at < day_start
          group by session_id
        ) s left join public.visitor_campaigns c using (session_id)
        where coalesce(s.referrer, '') not like '/%'
      ) v
      group by source order by count(*) desc limit 4) t)
  );
end;
$$;

-- Marks the tours whose reminder email went out, so a second run doesn't send it again.
create or replace function public.mark_tour_reminded(p_secret text, p_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  marked int;
begin
  if not public.cron_secret_ok(p_secret) then
    return 0;
  end if;
  update public.tour_bookings set reminder_sent_at = now()
  where id = any(coalesce(p_ids, '{}')) and reminder_sent_at is null;
  get diagnostics marked = row_count;
  return marked;
end;
$$;

revoke all on function public.daily_digest(text) from public;
revoke all on function public.mark_tour_reminded(text, uuid[]) from public;
grant execute on function public.daily_digest(text) to anon;
grant execute on function public.mark_tour_reminded(text, uuid[]) to anon;
