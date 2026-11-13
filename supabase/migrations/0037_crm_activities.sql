-- 0037: activity log per customer (calls, WhatsApp messages, emails, meetings,
-- video tours, price offers, notes), and an automatic line for every sales-stage
-- change. Admins only. Run after 0010 (needs crm_leads and is_admin()).
-- Plain ASCII on purpose (the Supabase SQL editor mis-splits otherwise).

do $$
begin
  if to_regclass('public.crm_leads') is null or to_regprocedure('public.is_admin()') is null then
    raise exception 'Run 0010 first, in the HADARA Real Estate project.';
  end if;
end $$;

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads (id) on delete cascade,
  kind text not null
    check (kind in ('call', 'whatsapp', 'email', 'meeting', 'tour', 'offer', 'note', 'stage')),
  -- For 'stage': '<old stage>><new stage>' (old is empty for a new customer).
  body text not null default '' check (length(body) <= 2000),
  happened_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists crm_activities_lead_idx on public.crm_activities (lead_id, happened_at desc);

alter table public.crm_activities enable row level security;
revoke all on public.crm_activities from anon, authenticated;
grant select, insert, delete on public.crm_activities to authenticated;
drop policy if exists crm_activities_admin on public.crm_activities;
create policy crm_activities_admin on public.crm_activities for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Every stage change (and a new customer's first stage) is written to the log.
create or replace function public.crm_leads_log_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.crm_activities (lead_id, kind, body) values (new.id, 'stage', '>' || new.stage);
  elsif new.stage is distinct from old.stage then
    insert into public.crm_activities (lead_id, kind, body) values (new.id, 'stage', old.stage || '>' || new.stage);
  end if;
  return null;
end $$;

revoke all on function public.crm_leads_log_stage() from public, anon, authenticated;

drop trigger if exists crm_leads_log_stage on public.crm_leads;
create trigger crm_leads_log_stage after insert or update of stage on public.crm_leads
  for each row execute function public.crm_leads_log_stage();

-- Customers already in the pipeline start their log with their current stage.
insert into public.crm_activities (lead_id, kind, body, happened_at, created_by)
select l.id, 'stage', '>' || l.stage, l.stage_changed_at, null
  from public.crm_leads l
 where not exists (select 1 from public.crm_activities a where a.lead_id = l.id);
