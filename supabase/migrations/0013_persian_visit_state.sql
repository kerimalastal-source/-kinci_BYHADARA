-- 0013: count Persian pages (/fa/...) as the same page as the other languages (1 of 2).
-- Run once in the Supabase SQL Editor of "kerimalastal-source's Project"
-- (khibypqmvnxuetmvjcnn), after 0004. Then run 0014.
--
-- The Persian site (/fa) came after 0004, whose record_visit_state() strips only the
-- /ar, /fr and /ru prefixes when it checks whether a page was already opened in the
-- visit. This recreates the function exactly as it is, with /fa added to that list and
-- nothing else changed, so /fa/contact after /contact is not a second first opening of
-- the contact page (no second fire alert). Same name, arguments and return type, so
-- the grants stay as they are.

do $$
begin
  if to_regclass('public.listings') is null then
    raise exception 'Wrong database: public.listings was not found. Run this in the HADARA Real Estate Supabase project (the one with the resale tables).';
  end if;
  if to_regprocedure('public.record_visit_state(uuid, text, text, text, text, text)') is null then
    raise exception 'record_visit_state not found: run 0004 first.';
  end if;
end
$$;

create or replace function public.record_visit_state(
  p_session_id uuid,
  p_path text,
  p_locale text,
  p_referrer text,
  p_country text,
  p_city text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text := left(coalesce(p_path, '/'), 300);
  v_page text := regexp_replace(left(coalesce(p_path, '/'), 300), '^/(ar|fa|fr|ru)(/|$)', '/');
  v_pages int;
  v_started timestamptz;
  v_seen boolean;
  v_landing jsonb;
  v_message bigint;
begin
  perform pg_advisory_xact_lock(hashtext(p_session_id::text));

  select count(*)::int, min(created_at),
         coalesce(bool_or(regexp_replace(path, '^/(ar|fa|fr|ru)(/|$)', '/') = v_page), false)
    into v_pages, v_started, v_seen
    from public.visitor_events
   where session_id = p_session_id;

  select jsonb_build_object('path', path, 'locale', locale, 'referrer', referrer, 'country', country, 'city', city)
    into v_landing
    from public.visitor_events
   where session_id = p_session_id
   order by created_at, id
   limit 1;

  select message_id into v_message from public.visitor_alerts where session_id = p_session_id;

  insert into public.visitor_events (session_id, path, locale, referrer, country, city)
  values (p_session_id, v_path, left(p_locale, 8), left(p_referrer, 300), left(p_country, 8), left(p_city, 100));

  return jsonb_build_object(
    'is_new', v_pages = 0,
    'pages_before', v_pages,
    'seconds', coalesce(floor(extract(epoch from now() - v_started)), 0)::int,
    'seen_before', v_seen,
    'landing', coalesce(v_landing, jsonb_build_object(
      'path', v_path, 'locale', left(p_locale, 8), 'referrer', left(p_referrer, 300),
      'country', left(p_country, 8), 'city', left(p_city, 100))),
    'message_id', v_message
  );
end;
$$;
