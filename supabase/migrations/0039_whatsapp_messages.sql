-- 0039: WhatsApp Business messages (Cloud API webhook, api/_lib/whatsapp.ts) are saved to the
-- customer records. save_whatsapp_message() is called by the site's server with the cron secret
-- for each message a customer sends to our business number:
--   * each WhatsApp message id is handled once (whatsapp_seen, kept 30 days);
--   * a number with no inquiry yet (same last 9 digits) opens a customer: an inquiry of kind
--     'manual' (reference HW-XXXXXX, status 'new', details.form = 'whatsapp', with the ad it
--     came from) and, if they have none, a pipeline row (stage 'new');
--   * every message is written to the customer's activity log (crm_activities, kind 'whatsapp').
-- Run after 0008, 0010, 0019 and 0037. Plain ASCII on purpose.

do $$
begin
  if to_regclass('public.inquiries') is null or to_regclass('public.crm_leads') is null
     or to_regclass('public.crm_activities') is null
     or to_regprocedure('public.cron_secret_ok(text)') is null then
    raise exception 'Run 0008, 0010, 0019 and 0037 first, in the HADARA Real Estate project.';
  end if;
end $$;

create table if not exists public.whatsapp_seen (
  message_id text primary key check (length(message_id) between 5 and 300),
  created_at timestamptz not null default now()
);
alter table public.whatsapp_seen enable row level security;
revoke all on public.whatsapp_seen from anon, authenticated;

-- Returns {"reference", "created", "lead"} | {"duplicate": true} | {"error": "forbidden" | "invalid"}.
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

  if coalesce(p_activity, '') <> '' then
    insert into public.crm_activities (lead_id, kind, body, happened_at, created_by)
    values (v_lead, 'whatsapp', p_activity, v_when, null);
  end if;

  return jsonb_build_object('reference', ref, 'created', v_created, 'lead', v_lead);
end;
$$;

revoke all on function public.save_whatsapp_message(text, text, text, text, text, text, text, text, text, timestamptz) from public;
grant execute on function public.save_whatsapp_message(text, text, text, text, text, text, text, text, text, timestamptz) to anon;
