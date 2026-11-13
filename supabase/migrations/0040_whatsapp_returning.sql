-- 0040: a customer already in our records who writes on WhatsApp again is announced on
-- Telegram once a day (owner's request 2026-11-12: a customer may come back days or a week
-- later). save_whatsapp_message() is the same as in 0039 and also returns:
--   * "returning": true for the first WhatsApp message of the day (Istanbul time) from a
--     customer who was already in the records (never for a customer this message opened);
--   * "last_at": their previous WhatsApp message, or null;
--   * "name" (the name in our records) and "stage" (pipeline stage), for the alert.
-- Run after 0039. Plain ASCII on purpose.

do $$
begin
  if to_regprocedure('public.save_whatsapp_message(text, text, text, text, text, text, text, text, text, timestamptz)') is null then
    raise exception 'Run 0039 first, in the HADARA Real Estate project.';
  end if;
end $$;

-- Returns {"reference", "created", "lead", "name", "stage", "returning", "last_at"}
--       | {"duplicate": true} | {"error": "forbidden" | "invalid"}.
create or replace function public.save_whatsapp_message(
  p_secret text,
  p_message_id text,
  p_wa_id text,
  p_name text,
  p_first text,
  p_activity text,
  p_ad_id text,
  p_ad_headline text,
  p_source text,
  p_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ref text;
  v_lead uuid;
  v_created boolean := false;
  v_digits text := right(coalesce(p_wa_id, ''), 9);
  v_name text := coalesce(nullif(trim(coalesce(p_name, '')), ''), '-');
  v_when timestamptz := least(coalesce(p_at, now()), now());
  v_last timestamptz;
  v_returning boolean := false;
  v_stage text;
  v_customer text;
begin
  if not public.cron_secret_ok(p_secret) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if length(coalesce(p_message_id, '')) not between 5 and 300
     or p_message_id ~ '[[:space:]]'
     or coalesce(p_wa_id, '') !~ '^[0-9]{6,20}$'
     or length(coalesce(p_name, '')) > 200
     or length(coalesce(p_first, '')) > 2000
     or length(coalesce(p_activity, '')) > 2000
     or coalesce(p_ad_id, '') !~ '^[0-9]{0,40}$'
     or length(coalesce(p_ad_headline, '')) > 300
     or length(coalesce(p_source, '')) > 300 then
    return jsonb_build_object('error', 'invalid');
  end if;

  insert into public.whatsapp_seen (message_id) values (p_message_id) on conflict do nothing;
  if not found then
    return jsonb_build_object('duplicate', true);
  end if;
  if random() < 0.05 then
    delete from public.whatsapp_seen where created_at < now() - interval '30 days';
  end if;

  select reference into ref
    from public.inquiries
   where right(regexp_replace(phone, '\D', '', 'g'), 9) = v_digits
   order by created_at desc
   limit 1;

  if ref is null then
    loop
      ref := 'HW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      begin
        insert into public.inquiries (
          reference, kind, name, email, phone, message, details, source, status, created_at, updated_at
        ) values (
          ref, 'manual', v_name, '', '+' || p_wa_id, nullif(trim(coalesce(p_first, '')), ''),
          jsonb_strip_nulls(jsonb_build_object(
            'form', 'whatsapp', 'channel', 'whatsapp', 'wa_id', p_wa_id,
            'ad_id', nullif(p_ad_id, ''), 'ad_headline', nullif(p_ad_headline, ''))),
          nullif(trim(coalesce(p_source, '')), ''), 'new', v_when, v_when
        );
        exit;
      exception when unique_violation then
        -- the random reference collided: try another one
      end;
    end loop;
    v_created := true;
  end if;

  select id into v_lead from public.crm_leads where keys && array['p:' || v_digits] order by updated_at desc limit 1;
  if v_lead is null then
    insert into public.crm_leads (keys, name, phone, stage)
    values (array['p:' || v_digits], v_name, '+' || p_wa_id, 'new')
    returning id into v_lead;
  end if;

  -- The customer's previous WhatsApp message (the webhook writes them with no author).
  select max(happened_at) into v_last
    from public.crm_activities
   where lead_id = v_lead and kind = 'whatsapp' and created_by is null;
  v_returning := not v_created and (
    v_last is null
    or (v_last at time zone 'Europe/Istanbul')::date < (v_when at time zone 'Europe/Istanbul')::date);

  if coalesce(p_activity, '') <> '' then
    insert into public.crm_activities (lead_id, kind, body, happened_at, created_by)
    values (v_lead, 'whatsapp', p_activity, v_when, null);
  end if;

  select stage into v_stage from public.crm_leads where id = v_lead;
  select name into v_customer from public.inquiries where reference = ref;

  return jsonb_build_object(
    'reference', ref, 'created', v_created, 'lead', v_lead,
    'name', coalesce(v_customer, v_name), 'stage', v_stage,
    'returning', v_returning, 'last_at', v_last);
end;
$$;

revoke all on function public.save_whatsapp_message(text, text, text, text, text, text, text, text, text, timestamptz) from public;
grant execute on function public.save_whatsapp_message(text, text, text, text, text, text, text, text, text, timestamptz) to anon;
