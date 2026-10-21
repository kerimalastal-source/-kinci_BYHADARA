-- 0029: tighter privileges before Supabase's change of 2026-10-30 (new tables in public
-- no longer get Data API grants automatically). Review of 2026-10-20, approved by the owner.
-- Run once in the Supabase SQL Editor of "kerimalastal-source's Project" (khibypqmvnxuetmvjcnn).
-- Changes privileges only; no table, row or policy is changed. Safe to run twice.
--
--   1. anon and authenticated lose TRUNCATE, REFERENCES, TRIGGER (and MAINTAIN on PostgreSQL 17)
--      on every table in public, now and for tables created later by postgres. The site never
--      uses them, and TRUNCATE is not limited by row level security.
--   2. Trigger functions can no longer be called through /rest/v1/rpc (triggers still fire:
--      PostgreSQL checks EXECUTE only when a trigger is created).
--   3. Functions without a fixed search_path get search_path = public.
--   4. listings (resale): visitors (anon) read only the columns the public pages show;
--      title_deed_number and admin_notes (no longer used) are readable by nobody through the
--      API; anon no longer reads listing_inquiries (it never saw a row there anyway).

do $$
declare
  t record;
  extra text := case when current_setting('server_version_num')::int >= 170000 then ', maintain' else '' end;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm') loop
    execute format('revoke truncate, references, trigger%s on public.%I from anon, authenticated', extra, t.relname);
  end loop;
  execute format('alter default privileges for role postgres in schema public revoke truncate, references, trigger%s on tables from anon, authenticated', extra);
end $$;

do $$
declare
  f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
              and pg_get_userbyid(p.proowner) = current_user loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

do $$
declare
  f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proconfig is null and p.prokind = 'f'
              and pg_get_userbyid(p.proowner) = current_user
              and p.proname in ('touch_updated_at', 'touch_tour_booking', 'touch_inquiry', 'tour_slot_open',
                                'traffic_source', 'traffic_campaign', 'reset_tour_reminder', 'crm_leads_touch',
                                'stats_is_test') loop
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end $$;

-- Only where listings is the real resale table (the test databases use a one-column stand-in).
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'listings' and column_name = 'title_deed_number') then
    revoke select on public.listings from anon, authenticated;
    grant select (id, owner_id, status, title, description, city, district, property_type, size_m2,
                  bedrooms, bathrooms, asking_price, currency, created_at, updated_at)
      on public.listings to anon;
    grant select (id, owner_id, status, title, description, city, district, address_line, property_type,
                  size_m2, bedrooms, bathrooms, asking_price, currency, original_purchase_year,
                  rejection_reason, created_at, updated_at, reviewed_at, reviewed_by)
      on public.listings to authenticated;
  end if;
  if to_regclass('public.listing_inquiries') is not null then
    revoke select on public.listing_inquiries from anon;
  end if;
end $$;
