-- HADARA Real Estate — inquiries inbox: the contact, property request and consultation
-- forms are saved here instead of only opening the visitor's email app.
-- Run once in the Supabase SQL Editor of the HADARA Real Estate project
-- (khibypqmvnxuetmvjcnn). Safe to run twice.
--
--   * The site's forms post to /api/inquiry, which calls submit_inquiry() with the anon key
--     (validation + at most 5 inquiries a day per email / phone). Nobody else can write.
--   * Admins read the inbox and change only the status and the internal notes
--     (/admin/inquiries). Visitors never read anything back.
--   * Inquiries are deleted two years after their last change (purge_old_inquiries()).

-- Guard: stop right here if this is not the HADARA Real Estate database.
do $$
begin
  if to_regclass('public.listings') is null or to_regprocedure('public.is_admin()') is null then
    raise exception 'Wrong database: public.listings / public.is_admin() were not found. Run this in the HADARA Real Estate Supabase project (the one with the resale tables).';
  end if;
end
$$;

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  kind text not null check (kind in ('contact', 'property_request', 'consultation')),
  name text not null,
  email text not null,
  phone text not null,
  subject text,
  message text,
  projects text[] not null default '{}',
  interests text[] not null default '{}',
  -- The form's other answers as option keys (property type, budget, service…), shown with
  -- labels in the admin's language.
  details jsonb not null default '{}',
  site_locale text,
  source text,
  page text,
  status text not null default 'new' check (status in ('new', 'contacted', 'interested', 'closed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inquiries_created_idx on public.inquiries (created_at desc);
create index if not exists inquiries_email_idx on public.inquiries (lower(email));
create index if not exists inquiries_phone_idx on public.inquiries (phone);

create or replace function public.touch_inquiry()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists inquiries_touch on public.inquiries;
create trigger inquiries_touch before update on public.inquiries
  for each row execute function public.touch_inquiry();

alter table public.inquiries enable row level security;
revoke all on public.inquiries from anon, authenticated;
grant select on public.inquiries to authenticated;
grant update (status, notes) on public.inquiries to authenticated;

drop policy if exists "Admins read inquiries" on public.inquiries;
create policy "Admins read inquiries" on public.inquiries
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins update inquiries" on public.inquiries;
create policy "Admins update inquiries" on public.inquiries
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.purge_old_inquiries()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.inquiries where updated_at < now() - interval '2 years';
$$;

-- Saves an inquiry from the site's forms. Returns {"reference": "HQ-XXXXXX"} or
-- {"error": "invalid" | "limit"}.
create or replace function public.submit_inquiry(
  p_kind text,
  p_name text,
  p_email text,
  p_phone text,
  p_subject text,
  p_message text,
  p_projects text[],
  p_interests text[],
  p_details jsonb,
  p_locale text,
  p_source text,
  p_page text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ref text;
  recent int;
begin
  if p_kind not in ('contact', 'property_request', 'consultation')
     or length(trim(coalesce(p_name, ''))) not between 1 and 100
     or coalesce(p_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 254
     or length(coalesce(p_phone, '')) not between 6 and 30
     or length(coalesce(p_subject, '')) > 200
     or length(coalesce(p_message, '')) > 5000
     or coalesce(array_length(p_projects, 1), 0) > 20
     or coalesce(array_length(p_interests, 1), 0) > 10
     or (p_details is not null and (jsonb_typeof(p_details) <> 'object' or length(p_details::text) > 3000)) then
    return jsonb_build_object('error', 'invalid');
  end if;

  select count(*) into recent from public.inquiries
  where created_at > now() - interval '1 day' and (lower(email) = lower(trim(p_email)) or phone = trim(p_phone));
  if recent >= 5 then
    return jsonb_build_object('error', 'limit');
  end if;

  loop
    ref := 'HQ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.inquiries (
        reference, kind, name, email, phone, subject, message, projects, interests, details,
        site_locale, source, page
      ) values (
        ref, p_kind, trim(p_name), trim(p_email), trim(p_phone), nullif(trim(coalesce(p_subject, '')), ''),
        nullif(trim(coalesce(p_message, '')), ''), coalesce(p_projects, '{}'), coalesce(p_interests, '{}'),
        coalesce(p_details, '{}'), left(p_locale, 8), left(p_source, 300), left(p_page, 200)
      );
      exit;
    exception when unique_violation then
      -- the random reference collided: try another one
    end;
  end loop;

  perform public.purge_old_inquiries();
  return jsonb_build_object('reference', ref);
end;
$$;

revoke all on function public.submit_inquiry(text, text, text, text, text, text, text[], text[], jsonb, text, text, text) from public;
revoke all on function public.purge_old_inquiries() from public;
grant execute on function public.submit_inquiry(text, text, text, text, text, text, text[], text[], jsonb, text, text, text) to anon;
