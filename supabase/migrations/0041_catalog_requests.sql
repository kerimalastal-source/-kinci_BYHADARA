-- 0041: "Send me the catalogue" on a project page. The visitor leaves a WhatsApp number (and,
-- if they like, a name) to get the PDF catalogue; the site's server (api/_lib/catalogRequest.ts)
-- calls save_catalog_request() with the cron secret. The request becomes an inquiry of kind
-- 'manual' (reference HC-XXXXXX, status 'new', details.form = 'catalog'), so it shows on the
-- customers page, in "waiting for your reply", in the morning digest and in the ad report by
-- its source; and a pipeline row (stage 'new') is opened unless the person already has one.
-- The same phone asking again for the same project within a day gets the first reference back
-- (no second row, no second alert). At most 5 requests a day per phone, 300 a day in total.
-- Run after 0007, 0008, 0010 and 0019. Plain ASCII on purpose.

do $$
begin
  if to_regclass('public.inquiries') is null or to_regclass('public.crm_leads') is null
     or to_regprocedure('public.cron_secret_ok(text)') is null then
    raise exception 'Run 0007, 0008, 0010 and 0019 first, in the HADARA Real Estate project.';
  end if;
end $$;

-- Returns {"reference": "HC-XXXXXX", "created": true|false} or {"error": "forbidden" | "invalid" | "limit"}.
create or replace function public.save_catalog_request(
  p_secret text,
  p_name text,
  p_phone text,
  p_project text,
  p_catalog text,
  p_message text,
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
  v_name text := trim(coalesce(p_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_digits text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9);
  v_keys text[];
begin
  if not public.cron_secret_ok(p_secret) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if length(v_name) > 100
     or v_phone !~ '^\+?[0-9][0-9 ()-]{5,28}$'
     or length(v_digits) < 6
     or coalesce(p_project, '') !~ '^[a-z0-9-]{1,60}$'
     or coalesce(p_catalog, '') !~ '^[a-z0-9-]{1,60}$'
     or length(coalesce(p_message, '')) > 500
     or coalesce(p_locale, '') !~ '^[a-z]{2}$'
     or length(coalesce(p_source, '')) > 300
     or length(coalesce(p_page, '')) > 200 then
    return jsonb_build_object('error', 'invalid');
  end if;

  -- The same person asking again for the same project today: nothing new to save.
  select reference into ref
  from public.inquiries
  where details->>'form' = 'catalog'
    and created_at > now() - interval '1 day'
    and right(regexp_replace(phone, '\D', '', 'g'), 9) = v_digits
    and projects = array[p_project]
  order by created_at desc
  limit 1;
  if ref is not null then
    return jsonb_build_object('reference', ref, 'created', false);
  end if;

  if (select count(*) from public.inquiries
      where details->>'form' = 'catalog' and created_at > now() - interval '1 day'
        and right(regexp_replace(phone, '\D', '', 'g'), 9) = v_digits) >= 5
     or (select count(*) from public.inquiries
         where details->>'form' = 'catalog' and created_at > now() - interval '1 day') >= 300 then
    return jsonb_build_object('error', 'limit');
  end if;

  loop
    ref := 'HC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.inquiries (
        reference, kind, name, email, phone, message, projects, details, site_locale, source, page, status
      ) values (
        ref, 'manual', coalesce(nullif(v_name, ''), v_phone), '', v_phone,
        nullif(trim(coalesce(p_message, '')), ''),
        array[p_project],
        jsonb_build_object('form', 'catalog', 'catalog', p_catalog),
        p_locale, nullif(trim(coalesce(p_source, '')), ''), nullif(trim(coalesce(p_page, '')), ''), 'new'
      );
      exit;
    exception when unique_violation then
      -- the random reference collided: try another one
    end;
  end loop;

  v_keys := array['p:' || v_digits];
  if not exists (select 1 from public.crm_leads where keys && v_keys) then
    insert into public.crm_leads (keys, name, email, phone, stage, project)
    values (v_keys, coalesce(nullif(v_name, ''), v_phone), null, v_phone, 'new', p_project);
  end if;

  return jsonb_build_object('reference', ref, 'created', true);
end;
$$;

revoke all on function public.save_catalog_request(text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.save_catalog_request(text, text, text, text, text, text, text, text, text) to anon;
