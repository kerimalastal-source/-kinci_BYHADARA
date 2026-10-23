-- 0033: "Edit customer details" on /admin/customers (owner's request 2026-10-23).
-- One call corrects a customer's name, main phone and main email on every record of theirs
-- (inquiries and video tour bookings), and for a customer added by hand also the country,
-- how they reached the team and the ad they came from. Their sales pipeline row (crm_leads)
-- follows: it takes the new name, phone and email, and keeps its old keys plus the new ones,
-- so the customer stays linked to their stage, deal and follow-up.
-- Only the rows passed in are touched; a second phone or email of the customer stays as it is.
-- Admins only. Run after 0019 (and 0010). Plain ASCII on purpose (the Supabase SQL editor mis-splits otherwise).

do $$
begin
  if to_regclass('public.inquiries') is null or to_regclass('public.tour_bookings') is null
     or to_regclass('public.crm_leads') is null or to_regprocedure('public.is_admin()') is null then
    raise exception 'Run 0003, 0007, 0010 and 0019 first, in the HADARA Real Estate project.';
  end if;
end $$;

-- Returns {"ok": true} or {"error": "forbidden" | "invalid"}.
-- p_old_phone / p_old_email: the main phone and email shown in the form; the records that have
-- them get the new ones. p_manual_id: the customer's latest hand-added inquiry (or null), which
-- also gets the country, channel and source.
create or replace function public.admin_update_customer(
  p_inquiry_ids uuid[],
  p_booking_ids uuid[],
  p_lead_id uuid,
  p_old_phone text,
  p_old_email text,
  p_name text,
  p_phone text,
  p_email text,
  p_manual_id uuid,
  p_country text,
  p_channel text,
  p_source text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_old_email text := lower(trim(coalesce(p_old_email, '')));
  v_old_key text := right(regexp_replace(coalesce(p_old_phone, ''), '\D', '', 'g'), 9);
  v_new_key text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9);
  v_keys text[];
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if length(v_name) not between 1 and 100
     or length(regexp_replace(v_phone, '\D', '', 'g')) not between 6 and 20
     or length(v_phone) > 30
     or (v_email <> '' and (v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254))
     or coalesce(p_country, '') !~ '^([A-Z]{2})?$'
     or (p_manual_id is not null and coalesce(p_channel, '') not in ('whatsapp', 'call', 'office', 'other'))
     or length(coalesce(p_source, '')) > 300
     or coalesce(array_length(p_inquiry_ids, 1), 0) > 500
     or coalesce(array_length(p_booking_ids, 1), 0) > 500 then
    return jsonb_build_object('error', 'invalid');
  end if;

  -- Inquiries: the name everywhere; the phone and email where they were the old main ones.
  -- An email can only be cleared on a hand-added inquiry (the site's forms always have one).
  update public.inquiries i set
    name = v_name,
    phone = case when length(v_old_key) >= 4
                   and right(regexp_replace(i.phone, '\D', '', 'g'), 9) = v_old_key then v_phone else i.phone end,
    email = case when lower(trim(i.email)) = v_old_email and (v_email <> '' or i.kind = 'manual') then v_email else i.email end
  where i.id = any(coalesce(p_inquiry_ids, '{}'));

  -- Tour bookings always keep an email (reminders go to it).
  update public.tour_bookings b set
    name = v_name,
    phone = case when length(v_old_key) >= 4
                   and right(regexp_replace(b.phone, '\D', '', 'g'), 9) = v_old_key then v_phone else b.phone end,
    email = case when v_old_email <> '' and lower(trim(b.email)) = v_old_email and v_email <> '' then v_email else b.email end
  where b.id = any(coalesce(p_booking_ids, '{}'));

  -- The hand-added inquiry: country, channel and the ad it came from.
  if p_manual_id is not null then
    update public.inquiries set
      details = jsonb_strip_nulls(
        (coalesce(details, '{}'::jsonb) - 'country' - 'channel')
        || jsonb_build_object('form', 'manual', 'channel', p_channel, 'country', nullif(p_country, ''))
      ),
      source = nullif(trim(coalesce(p_source, '')), '')
    where id = p_manual_id and kind = 'manual';
  end if;

  -- The pipeline row keeps its old keys and gains the new ones.
  if p_lead_id is not null then
    select array(
      select distinct k from unnest(
        l.keys
        || case when v_email <> '' then array['e:' || v_email] else '{}'::text[] end
        || case when length(v_new_key) >= 4 then array['p:' || v_new_key] else '{}'::text[] end
      ) as k
      where length(k) >= 6
    ) into v_keys
    from public.crm_leads l where l.id = p_lead_id;

    update public.crm_leads set
      keys = v_keys[1:20],
      name = v_name,
      phone = v_phone,
      email = nullif(v_email, '')
    where id = p_lead_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_update_customer(uuid[], uuid[], uuid, text, text, text, text, text, uuid, text, text, text) from public;
grant execute on function public.admin_update_customer(uuid[], uuid[], uuid, text, text, text, text, text, uuid, text, text, text) to authenticated;
