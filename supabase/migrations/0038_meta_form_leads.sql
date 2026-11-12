-- 0038: leads from Meta lead-form ads (Instant Forms inside Facebook/Instagram) are saved as
-- customers by themselves. The site's server (api/_lib/metaLeads.ts) already reads each new
-- lead from Meta to announce it on Telegram; it now also calls save_meta_lead() with the cron
-- secret. The lead becomes an inquiry of kind 'manual' (reference HF-XXXXXX, status 'new',
-- details.form = 'meta_lead'), so it shows on the customers page, in "waiting for your reply",
-- in the morning digest and in the ad report by its source; and a pipeline row (stage 'new')
-- is opened for it unless the person already has one. The same Meta lead id is saved once.
-- Run after 0007, 0008, 0010 and 0019. Plain ASCII on purpose.

do $$
begin
  if to_regclass('public.inquiries') is null or to_regclass('public.crm_leads') is null
     or to_regprocedure('public.cron_secret_ok(text)') is null then
    raise exception 'Run 0007, 0008, 0010 and 0019 first, in the HADARA Real Estate project.';
  end if;
end $$;

create index if not exists inquiries_meta_lead_idx on public.inquiries ((details->>'meta_lead_id'))
  where details ? 'meta_lead_id';

-- Returns {"reference": "HF-XXXXXX", "created": true|false} or {"error": "forbidden" | "invalid"}.
create or replace function public.save_meta_lead(
  p_secret text,
  p_lead_id text,
  p_name text,
  p_phone text,
  p_email text,
  p_form text,
  p_ad text,
  p_platform text,
  p_message text,
  p_project text,
  p_source text,
  p_created timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ref text;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := trim(coalesce(p_phone, ''));
  v_digits text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9);
  v_keys text[] := '{}';
  v_when timestamptz := coalesce(p_created, now());
begin
  if not public.cron_secret_ok(p_secret) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if coalesce(p_lead_id, '') !~ '^[0-9]{5,40}$'
     or length(coalesce(p_name, '')) > 200
     or length(v_phone) > 40
     or length(v_email) > 254
     or (v_email = '' and length(v_digits) < 6)
     or length(coalesce(p_form, '')) > 200
     or length(coalesce(p_ad, '')) > 300
     or coalesce(p_platform, '') !~ '^[a-z_]{0,20}$'
     or length(coalesce(p_message, '')) > 5000
     or length(coalesce(p_project, '')) > 80
     or length(coalesce(p_source, '')) > 300
     or v_when > now() + interval '1 hour' then
    return jsonb_build_object('error', 'invalid');
  end if;

  select reference into ref from public.inquiries where details->>'meta_lead_id' = p_lead_id limit 1;
  if ref is not null then
    return jsonb_build_object('reference', ref, 'created', false);
  end if;

  loop
    ref := 'HF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.inquiries (
        reference, kind, name, email, phone, message, projects, details, source, status, created_at, updated_at
      ) values (
        ref, 'manual', coalesce(nullif(trim(coalesce(p_name, '')), ''), '-'), v_email, v_phone,
        nullif(trim(coalesce(p_message, '')), ''),
        case when coalesce(p_project, '') = '' then '{}'::text[] else array[p_project] end,
        jsonb_strip_nulls(jsonb_build_object(
          'form', 'meta_lead', 'meta_lead_id', p_lead_id,
          'meta_form', nullif(p_form, ''), 'meta_ad', nullif(p_ad, ''), 'meta_platform', nullif(p_platform, ''))),
        nullif(trim(coalesce(p_source, '')), ''), 'new', v_when, v_when
      );
      exit;
    exception when unique_violation then
      -- the random reference collided: try another one
    end;
  end loop;

  if v_email <> '' then v_keys := v_keys || ('e:' || v_email); end if;
  if length(v_digits) >= 6 then v_keys := v_keys || ('p:' || v_digits); end if;
  if not exists (select 1 from public.crm_leads where keys && v_keys) then
    insert into public.crm_leads (keys, name, email, phone, stage, project)
    values (v_keys, coalesce(nullif(trim(coalesce(p_name, '')), ''), '-'), nullif(v_email, ''), nullif(v_phone, ''), 'new',
            nullif(p_project, ''));
  end if;

  return jsonb_build_object('reference', ref, 'created', true);
end;
$$;

revoke all on function public.save_meta_lead(text, text, text, text, text, text, text, text, text, text, text, timestamptz) from public;
grant execute on function public.save_meta_lead(text, text, text, text, text, text, text, text, text, text, text, timestamptz) to anon;
