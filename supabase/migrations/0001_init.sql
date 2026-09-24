-- HADARA Resale Portal — initial schema
-- Run this once in the Supabase project's SQL Editor (Database > SQL Editor > New query),
-- then "Run". Safe to re-run: objects are created with IF NOT EXISTS / ON CONFLICT guards
-- where practical, but re-running will error on already-existing tables — that's expected,
-- it means the migration already applied.

create extension if not exists "pgcrypto";

-- ============================================================================
-- profiles
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  country text,
  role text not null default 'seller' check (role in ('seller', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- SECURITY DEFINER helper so RLS policies can check "is this caller an admin?"
-- without recursively re-triggering RLS on profiles (which would deadlock/loop).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Auto-create a profile row (role defaults to 'seller') whenever someone signs up.
-- There is no self-serve admin signup by design — promote a profile to 'admin'
-- manually from the SQL Editor after the person has registered normally.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, country, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'country',
    'seller'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- A signed-in user can never grant themselves 'admin' through a normal update.
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger trg_profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

create policy "profiles_select" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ============================================================================
-- listings
-- ============================================================================

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'approved', 'rejected', 'sold', 'withdrawn')),
  title text not null,
  description text,
  city text,
  district text,
  address_line text,
  property_type text check (property_type in ('apartment', 'villa', 'land', 'commercial', 'other')),
  size_m2 numeric,
  bedrooms integer,
  bathrooms integer,
  asking_price numeric,
  currency text not null default 'USD',
  original_purchase_year integer,
  title_deed_number text,
  admin_notes text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);

create index listings_owner_id_idx on public.listings (owner_id);
create index listings_status_idx on public.listings (status);

alter table public.listings enable row level security;

-- Server-side state machine: a non-admin owner can only submit a draft for
-- review, resubmit after rejection, or withdraw — never self-approve/reject,
-- and never touch the admin-only fields.
create or replace function public.enforce_listing_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  new.admin_notes := old.admin_notes;
  new.reviewed_at := old.reviewed_at;
  new.reviewed_by := old.reviewed_by;
  new.rejection_reason := old.rejection_reason;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status = 'pending_review')
      or (old.status in ('rejected', 'withdrawn') and new.status in ('draft', 'pending_review'))
      or (new.status = 'withdrawn' and old.status in ('draft', 'pending_review', 'approved'))
    ) then
      new.status := old.status;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_listings_enforce_transition
  before update on public.listings
  for each row execute function public.enforce_listing_transition();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_listings_touch_updated_at
  before update on public.listings
  for each row execute function public.touch_updated_at();

create policy "listings_select" on public.listings
  for select using (owner_id = auth.uid() or public.is_admin() or status = 'approved');

create policy "listings_insert_own" on public.listings
  for insert with check (owner_id = auth.uid());

create policy "listings_update_own_or_admin" on public.listings
  for update using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

create policy "listings_delete_own_draft_or_admin" on public.listings
  for delete using ((owner_id = auth.uid() and status in ('draft', 'rejected')) or public.is_admin());

-- ============================================================================
-- listing_photos
-- ============================================================================

create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create index listing_photos_listing_id_idx on public.listing_photos (listing_id);

alter table public.listing_photos enable row level security;

create policy "listing_photos_select" on public.listing_photos
  for select using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and (l.owner_id = auth.uid() or public.is_admin() or l.status = 'approved')
    )
  );

create policy "listing_photos_insert_own" on public.listing_photos
  for insert with check (
    exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
  );

create policy "listing_photos_delete_own_or_admin" on public.listing_photos
  for delete using (
    exists (select 1 from public.listings l where l.id = listing_id and (l.owner_id = auth.uid() or public.is_admin()))
  );

-- ============================================================================
-- listing_documents (title deed / ID — never public)
-- ============================================================================

create table public.listing_documents (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text not null,
  doc_type text not null check (doc_type in ('title_deed', 'id_document', 'other')),
  created_at timestamptz not null default now()
);

create index listing_documents_listing_id_idx on public.listing_documents (listing_id);

alter table public.listing_documents enable row level security;

create policy "listing_documents_select_owner_or_admin" on public.listing_documents
  for select using (
    exists (select 1 from public.listings l where l.id = listing_id and (l.owner_id = auth.uid() or public.is_admin()))
  );

create policy "listing_documents_insert_own" on public.listing_documents
  for insert with check (
    exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
  );

create policy "listing_documents_delete_own_or_admin" on public.listing_documents
  for delete using (
    exists (select 1 from public.listings l where l.id = listing_id and (l.owner_id = auth.uid() or public.is_admin()))
  );

-- ============================================================================
-- listing_inquiries (public buyer leads on an approved listing)
-- ============================================================================

create table public.listing_inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  message text,
  created_at timestamptz not null default now()
);

create index listing_inquiries_listing_id_idx on public.listing_inquiries (listing_id);

alter table public.listing_inquiries enable row level security;

create policy "listing_inquiries_insert_public" on public.listing_inquiries
  for insert with check (
    exists (select 1 from public.listings l where l.id = listing_id and l.status = 'approved')
  );

create policy "listing_inquiries_select_owner_or_admin" on public.listing_inquiries
  for select using (
    exists (select 1 from public.listings l where l.id = listing_id and (l.owner_id = auth.uid() or public.is_admin()))
  );

-- ============================================================================
-- Table privileges (we disabled "automatically expose new tables", so these
-- are granted explicitly; RLS policies above still gate row-level access)
-- ============================================================================

grant usage on schema public to anon, authenticated;

grant select, update on public.profiles to authenticated;

grant select, insert, update, delete on public.listings to authenticated;
grant select on public.listings to anon;

grant select, insert, delete on public.listing_photos to authenticated;
grant select on public.listing_photos to anon;

grant select, insert, delete on public.listing_documents to authenticated;

grant select, insert on public.listing_inquiries to authenticated, anon;

-- ============================================================================
-- Storage buckets
-- Convention: object path is "{owner_id}/{listing_id}/{filename}" in both buckets.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('listing-documents', 'listing-documents', false)
on conflict (id) do nothing;

create policy "listing_photos_public_read" on storage.objects
  for select using (bucket_id = 'listing-photos');

create policy "listing_photos_owner_write" on storage.objects
  for insert with check (
    bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "listing_photos_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "listing_documents_owner_or_admin_read" on storage.objects
  for select using (
    bucket_id = 'listing-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "listing_documents_owner_write" on storage.objects
  for insert with check (
    bucket_id = 'listing-documents' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "listing_documents_owner_or_admin_delete" on storage.objects
  for delete using (
    bucket_id = 'listing-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ============================================================================
-- Manual step after running this file: register a normal account on the site,
-- then run the following once (replace the email) to make it an admin:
--
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');
-- ============================================================================
