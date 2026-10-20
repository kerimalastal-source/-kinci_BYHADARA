-- 0026: Instagram statistics of @hadararealestate, saved every morning (owner's request
-- 2026-10-20: "so we can pull the statistics and analyse them").
-- Run once in the Supabase SQL Editor of "kerimalastal-source's Project"
-- (khibypqmvnxuetmvjcnn), after 0008. Addition only: two new tables and one function.
--
-- api/ig-insights.ts (Vercel Cron, 8:00 Istanbul) asks Meta for the account's numbers of the
-- last 28 days and for every post of the last 30 days, then calls save_ig_insights() with
-- the cron secret. Instagram keeps most account numbers for about 30 days only, so saving
-- them every day builds the history. Only our own account's totals: no visitor data.
--
--   * ig_account_daily: one row per day (Meta's day): followers, reach, views, profile
--     visits, interactions, likes, comments, shares, saves, link taps.
--   * ig_media_stats: one row per post: type, date, caption start, link, reach, views,
--     likes, comments, saves, shares, interactions.
--   * save_ig_insights(secret, days, media): upserts both; a value Meta didn't return keeps
--     the one already saved. Returns {"days": n, "media": n} or {"error": "forbidden"}.
-- Admins can read both tables (for a statistics panel later).

do $$
begin
  if to_regprocedure('public.cron_secret_ok(text)') is null or to_regprocedure('public.is_admin()') is null then
    raise exception 'Run 0008_admin_insights.sql first, in the HADARA Real Estate project.';
  end if;
end $$;

create table if not exists public.ig_account_daily (
  day date primary key,
  followers int,
  follows int,
  media_count int,
  new_followers int,
  reach int,
  views int,
  profile_views int,
  accounts_engaged int,
  total_interactions int,
  likes int,
  comments int,
  shares int,
  saves int,
  website_clicks int,
  profile_links_taps int,
  updated_at timestamptz not null default now()
);

create table if not exists public.ig_media_stats (
  media_id text primary key,
  posted_at timestamptz,
  media_type text,
  product_type text,
  caption text,
  permalink text,
  reach int,
  views int,
  likes int,
  comments int,
  saves int,
  shares int,
  total_interactions int,
  updated_at timestamptz not null default now()
);

create index if not exists ig_media_stats_posted_at on public.ig_media_stats (posted_at);

alter table public.ig_account_daily enable row level security;
alter table public.ig_media_stats enable row level security;
revoke all on public.ig_account_daily from anon, authenticated;
revoke all on public.ig_media_stats from anon, authenticated;
grant select on public.ig_account_daily to authenticated;
grant select on public.ig_media_stats to authenticated;

drop policy if exists "Admins read Instagram days" on public.ig_account_daily;
create policy "Admins read Instagram days" on public.ig_account_daily
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins read Instagram posts" on public.ig_media_stats;
create policy "Admins read Instagram posts" on public.ig_media_stats
  for select to authenticated using (public.is_admin());

create or replace function public.save_ig_insights(p_secret text, p_days jsonb, p_media jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_days int := 0;
  n_media int := 0;
begin
  if not public.cron_secret_ok(p_secret) then
    return jsonb_build_object('error', 'forbidden');
  end if;

  if jsonb_typeof(p_days) = 'array' then
    insert into public.ig_account_daily as t (day, followers, follows, media_count, new_followers, reach, views,
      profile_views, accounts_engaged, total_interactions, likes, comments, shares, saves, website_clicks,
      profile_links_taps, updated_at)
    select d.day, d.followers, d.follows, d.media_count, d.new_followers, d.reach, d.views, d.profile_views,
      d.accounts_engaged, d.total_interactions, d.likes, d.comments, d.shares, d.saves, d.website_clicks,
      d.profile_links_taps, now()
    from jsonb_to_recordset(p_days) as d(day date, followers int, follows int, media_count int, new_followers int,
      reach int, views int, profile_views int, accounts_engaged int, total_interactions int, likes int,
      comments int, shares int, saves int, website_clicks int, profile_links_taps int)
    where d.day is not null
    on conflict (day) do update set
      followers = coalesce(excluded.followers, t.followers),
      follows = coalesce(excluded.follows, t.follows),
      media_count = coalesce(excluded.media_count, t.media_count),
      new_followers = coalesce(excluded.new_followers, t.new_followers),
      reach = coalesce(excluded.reach, t.reach),
      views = coalesce(excluded.views, t.views),
      profile_views = coalesce(excluded.profile_views, t.profile_views),
      accounts_engaged = coalesce(excluded.accounts_engaged, t.accounts_engaged),
      total_interactions = coalesce(excluded.total_interactions, t.total_interactions),
      likes = coalesce(excluded.likes, t.likes),
      comments = coalesce(excluded.comments, t.comments),
      shares = coalesce(excluded.shares, t.shares),
      saves = coalesce(excluded.saves, t.saves),
      website_clicks = coalesce(excluded.website_clicks, t.website_clicks),
      profile_links_taps = coalesce(excluded.profile_links_taps, t.profile_links_taps),
      updated_at = now();
    get diagnostics n_days = row_count;
  end if;

  if jsonb_typeof(p_media) = 'array' then
    insert into public.ig_media_stats as t (media_id, posted_at, media_type, product_type, caption, permalink,
      reach, views, likes, comments, saves, shares, total_interactions, updated_at)
    select m.media_id, m.posted_at, m.media_type, m.product_type, left(m.caption, 300), m.permalink,
      m.reach, m.views, m.likes, m.comments, m.saves, m.shares, m.total_interactions, now()
    from jsonb_to_recordset(p_media) as m(media_id text, posted_at timestamptz, media_type text, product_type text,
      caption text, permalink text, reach int, views int, likes int, comments int, saves int, shares int,
      total_interactions int)
    where coalesce(m.media_id, '') <> ''
    on conflict (media_id) do update set
      posted_at = coalesce(excluded.posted_at, t.posted_at),
      media_type = coalesce(excluded.media_type, t.media_type),
      product_type = coalesce(excluded.product_type, t.product_type),
      caption = coalesce(excluded.caption, t.caption),
      permalink = coalesce(excluded.permalink, t.permalink),
      reach = coalesce(excluded.reach, t.reach),
      views = coalesce(excluded.views, t.views),
      likes = coalesce(excluded.likes, t.likes),
      comments = coalesce(excluded.comments, t.comments),
      saves = coalesce(excluded.saves, t.saves),
      shares = coalesce(excluded.shares, t.shares),
      total_interactions = coalesce(excluded.total_interactions, t.total_interactions),
      updated_at = now();
    get diagnostics n_media = row_count;
  end if;

  return jsonb_build_object('days', n_days, 'media', n_media);
end;
$$;

revoke all on function public.save_ig_insights(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_ig_insights(text, jsonb, jsonb) to anon;
