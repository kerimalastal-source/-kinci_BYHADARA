-- 0028: Telegram delivery of the daily check of the work system (owner's request
-- 2026-10-20: "send me a Telegram message that everything is fine").
-- Run once in the Supabase SQL Editor of "kerimalastal-source's Project"
-- (khibypqmvnxuetmvjcnn), after 0010. Addition only: one table and two functions.
--
-- The daily check is done by Claude (a scheduled task), which has no Telegram key. It
-- writes its short Arabic report into ops_reports through the Supabase connector, and the
-- site sends it to the team's Telegram the same way it sends sales follow-ups: from page
-- views (api/track.ts, at most every two minutes) and from the morning job (api/daily.ts).
--
--   * ops_reports: one row per report (plain text, up to 3500 characters); sent_at is set
--     when the site takes it. Nobody reads or writes it through the API.
--   * claim_ops_reports(secret, min_gap_seconds): the reports not sent yet (oldest first,
--     at most a week old), marked as sent. Returns a JSON array, or {"error": "forbidden"}.
--   * release_ops_report(secret, id): puts back a report Telegram did not accept.

do $$
begin
  if to_regprocedure('public.cron_secret_ok(text)') is null or to_regclass('public.internal_state') is null then
    raise exception 'Run 0008_admin_insights.sql and 0010_sales_pipeline.sql first, in the HADARA Real Estate project.';
  end if;
end $$;

create table if not exists public.ops_reports (
  id bigint generated always as identity primary key,
  body text not null check (length(body) between 1 and 3500),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.ops_reports enable row level security;
revoke all on public.ops_reports from anon, authenticated;

create or replace function public.claim_ops_reports(p_secret text, p_min_gap_seconds int default 0)
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
    select at into last_run from public.internal_state where name = 'ops_reports';
    if last_run is not null and last_run > now() - make_interval(secs => p_min_gap_seconds) then
      return '[]'::jsonb;
    end if;
    insert into public.internal_state (name, at) values ('ops_reports', now())
      on conflict (name) do update set at = excluded.at;
  end if;
  with due as (
    update public.ops_reports set sent_at = now()
     where sent_at is null and created_at > now() - interval '7 days'
    returning id, body, created_at
  )
  select coalesce(jsonb_agg(to_jsonb(due) order by created_at), '[]'::jsonb) into result from due;
  return result;
end $$;

create or replace function public.release_ops_report(p_secret text, p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.cron_secret_ok(p_secret) then
    update public.ops_reports set sent_at = null where id = p_id;
  end if;
end $$;

revoke all on function public.claim_ops_reports(text, int) from public;
revoke all on function public.release_ops_report(text, bigint) from public;
grant execute on function public.claim_ops_reports(text, int) to anon;
grant execute on function public.release_ops_report(text, bigint) to anon;
