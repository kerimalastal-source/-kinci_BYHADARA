-- 0027: Facebook page statistics of "Hadara Real Estate", saved every morning next to the
-- Instagram ones (owner's request 2026-10-20). Run once in the Supabase SQL Editor of
-- "kerimalastal-source's Project" (khibypqmvnxuetmvjcnn), after 0008. Addition only.
--
-- The morning job (api/daily.ts) asks Meta for the page's numbers of the last 28 days and
-- for every post of the last 30 days, then calls save_fb_insights() with the cron secret.
-- Only our own page's totals: no visitor data.
--
--   * fb_page_daily: one row per day: followers, new follows, unfollows, reach, views,
--     page views, engagements.
--   * fb_post_stats: one row per post: type, date, text start, link, reach, views,
--     reactions, comments, shares, clicks.
--   * save_fb_insights(secret, days, posts): upserts both; a value Meta didn't return keeps
--     the one already saved. Returns {"days": n, "posts": n} or {"error": "forbidden"}.
-- Admins can read both tables.

do $$
begin
  if to_regprocedure('public.cron_secret_ok(text)') is null or to_regprocedure('public.is_admin()') is null then
    raise exception 'Run 0008_admin_insights.sql first, in the HADARA Real Estate project.';
  end if;
end $$;

create table if not exists public.fb_page_daily (
  day date primary key,
  followers int,
  new_follows int,
  unfollows int,
  reach int,
  views int,
  page_views int,
  engagements int,
  updated_at timestamptz not null default now()
);

create table if not exists public.fb_post_stats (
  post_id text primary key,
  posted_at timestamptz,
  post_type text,
  message text,
  permalink text,
  reach int,
  views int,
  reactions int,
  comments int,
  shares int,
  clicks int,
  updated_at timestamptz not null default now()
);

create index if not exists fb_post_stats_posted_at on public.fb_post_stats (posted_at);

alter table public.fb_page_daily enable row level security;
alter table public.fb_post_stats enable row level security;
revoke all on public.fb_page_daily from anon, authenticated;
revoke all on public.fb_post_stats from anon, authenticated;
grant select on public.fb_page_daily to authenticated;
grant select on public.fb_post_stats to authenticated;

drop policy if exists "Admins read Facebook days" on public.fb_page_daily;
create policy "Admins read Facebook days" on public.fb_page_daily
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins read Facebook posts" on public.fb_post_stats;
create policy "Admins read Facebook posts" on public.fb_post_stats
  for select to authenticated using (public.is_admin());

create or replace function public.save_fb_insights(p_secret text, p_days jsonb, p_posts jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_days int := 0;
  n_posts int := 0;
begin
  if not public.cron_secret_ok(p_secret) then
    return jsonb_build_object('error', 'forbidden');
  end if;

  if jsonb_typeof(p_days) = 'array' then
    insert into public.fb_page_daily as t (day, followers, new_follows, unfollows, reach, views, page_views,
      engagements, updated_at)
    select d.day, d.followers, d.new_follows, d.unfollows, d.reach, d.views, d.page_views, d.engagements, now()
    from jsonb_to_recordset(p_days) as d(day date, followers int, new_follows int, unfollows int, reach int,
      views int, page_views int, engagements int)
    where d.day is not null
    on conflict (day) do update set
      followers = coalesce(excluded.followers, t.followers),
      new_follows = coalesce(excluded.new_follows, t.new_follows),
      unfollows = coalesce(excluded.unfollows, t.unfollows),
      reach = coalesce(excluded.reach, t.reach),
      views = coalesce(excluded.views, t.views),
      page_views = coalesce(excluded.page_views, t.page_views),
      engagements = coalesce(excluded.engagements, t.engagements),
      updated_at = now();
    get diagnostics n_days = row_count;
  end if;

  if jsonb_typeof(p_posts) = 'array' then
    insert into public.fb_post_stats as t (post_id, posted_at, post_type, message, permalink, reach, views,
      reactions, comments, shares, clicks, updated_at)
    select p.post_id, p.posted_at, p.post_type, left(p.message, 300), p.permalink, p.reach, p.views,
      p.reactions, p.comments, p.shares, p.clicks, now()
    from jsonb_to_recordset(p_posts) as p(post_id text, posted_at timestamptz, post_type text, message text,
      permalink text, reach int, views int, reactions int, comments int, shares int, clicks int)
    where coalesce(p.post_id, '') <> ''
    on conflict (post_id) do update set
      posted_at = coalesce(excluded.posted_at, t.posted_at),
      post_type = coalesce(excluded.post_type, t.post_type),
      message = coalesce(excluded.message, t.message),
      permalink = coalesce(excluded.permalink, t.permalink),
      reach = coalesce(excluded.reach, t.reach),
      views = coalesce(excluded.views, t.views),
      reactions = coalesce(excluded.reactions, t.reactions),
      comments = coalesce(excluded.comments, t.comments),
      shares = coalesce(excluded.shares, t.shares),
      clicks = coalesce(excluded.clicks, t.clicks),
      updated_at = now();
    get diagnostics n_posts = row_count;
  end if;

  return jsonb_build_object('days', n_days, 'posts', n_posts);
end;
$$;

revoke all on function public.save_fb_insights(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_fb_insights(text, jsonb, jsonb) to anon;
