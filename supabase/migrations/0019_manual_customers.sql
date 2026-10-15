-- 0019: customers the team adds by hand on /admin/pipeline (a WhatsApp chat from an ad,
-- a phone call, an office visit). They are saved as inquiries of kind 'manual' with
-- reference HM-XXXXXX, so they show up on the customers page, the pipeline and the ad
-- report (by their source, e.g. 'utm_source=facebook / utm_campaign=gulf-whatsapp')
-- like any other lead. Only admins can add them. Email is optional ('' when unknown).
-- Run after 0007 and 0010. Plain ASCII on purpose (the Supabase SQL editor mis-splits otherwise).

do $$
begin
  if to_regclass('public.inquiries') is null or to_regprocedure('public.is_admin()') is null
     or to_regclass('public.crm_leads') is null then
    raise exception 'Run 0007 and 0010 first, in the HADARA Real Estate project.';
  end if;
end $$;

alter table public.inquiries drop constraint if exists inquiries_kind_check;
alter table public.inquiries add constraint inquiries_kind_check
  check (kind in ('contact', 'property_request', 'consultation', 'manual'));

-- Returns {"reference": "HM-XXXXXX"} or {"error": "forbidden" | "invalid"}.
create or replace function public.admin_add_customer(
  p_name text,
  p_phone text,
  p_email text,
  p_country text,
  p_channel text,
  p_source text,
  p_projects text[],
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ref text;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 100
     or length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) not between 6 and 20
     or length(coalesce(p_phone, '')) > 30
     or (coalesce(p_email, '') <> '' and (p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 254))
     or coalesce(p_country, '') !~ '^([A-Z]{2})?$'
     or coalesce(p_channel, '') not in ('whatsapp', 'call', 'office', 'other')
     or length(coalesce(p_source, '')) > 300
     or coalesce(array_length(p_projects, 1), 0) > 20
     or length(coalesce(p_note, '')) > 5000 then
    return jsonb_build_object('error', 'invalid');
  end if;

  loop
    ref := 'HM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.inquiries (
        reference, kind, name, email, phone, message, projects, details, source, status
      ) values (
        ref, 'manual', trim(p_name), lower(trim(coalesce(p_email, ''))), trim(p_phone),
        nullif(trim(coalesce(p_note, '')), ''), coalesce(p_projects, '{}'),
        jsonb_strip_nulls(jsonb_build_object('form', 'manual', 'channel', p_channel, 'country', nullif(p_country, ''))),
        nullif(trim(coalesce(p_source, '')), ''), 'contacted'
      );
      exit;
    exception when unique_violation then
      -- the random reference collided: try another one
    end;
  end loop;

  return jsonb_build_object('reference', ref);
end;
$$;

revoke all on function public.admin_add_customer(text, text, text, text, text, text, text[], text) from public;
grant execute on function public.admin_add_customer(text, text, text, text, text, text, text[], text) to authenticated;
