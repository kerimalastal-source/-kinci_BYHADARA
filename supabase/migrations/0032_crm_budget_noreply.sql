-- 0032: two additions to the sales pipeline (owner's request 2026-10-23).
-- 1) A "no reply" stage, so the team can filter the customers who did not answer and call them again.
-- 2) An approximate budget range per customer (US dollars), chosen from a list on the pipeline.
-- Table and constraint changes only; nothing else changes. Run after 0010.
-- Plain ASCII on purpose (the Supabase SQL editor mis-splits otherwise).

do $$
begin
  if to_regclass('public.crm_leads') is null then
    raise exception 'Run 0010 first, in the HADARA Real Estate project.';
  end if;
end $$;

alter table public.crm_leads drop constraint if exists crm_leads_stage_check;
alter table public.crm_leads add constraint crm_leads_stage_check
  check (stage in ('new', 'contacted', 'no_reply', 'tour', 'visit', 'negotiation', 'won', 'lost'));

alter table public.crm_leads add column if not exists budget text;
alter table public.crm_leads drop constraint if exists crm_leads_budget_check;
alter table public.crm_leads add constraint crm_leads_budget_check
  check (budget is null or budget in ('under100', '100-200', '200-300', '300-400', '400-500', '500-600', '600-1000', '1000plus'));
