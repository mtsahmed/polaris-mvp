-- Leads from the landing page's impact report (a one-page PDF of the visitor's calculator
-- scenario). Run in the Supabase SQL Editor after 20261124000000_platform_admins.sql.
--
-- Visitors are not signed in. They never read or write the table directly: they submit through
-- submit_impact_lead() and download their own report through impact_report(id), whose id is a
-- random UUID only they receive. Polaris app admins can read every lead.

create table if not exists public.impact_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (email = lower(email) and char_length(email) <= 254 and email like '%_@_%._%'),
  company text check (company is null or char_length(company) <= 160),
  goal text not null check (goal in ('partnerships', 'customers')),
  inputs jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists impact_leads_email_idx on public.impact_leads (email, created_at desc);
alter table public.impact_leads enable row level security;

create policy "app admins read impact leads" on public.impact_leads
  for select to authenticated using (public.is_platform_admin());

-- Saves a lead and returns the report id. At most five reports per email per hour, to slow abuse.
create or replace function public.submit_impact_lead(
  lead_name text,
  lead_email text,
  lead_company text,
  lead_goal text,
  lead_inputs jsonb
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  new_id uuid;
  clean_email text := lower(trim(lead_email));
begin
  if (select count(*) from public.impact_leads l
      where l.email = clean_email and l.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many reports for this email in the last hour. Try again later.';
  end if;
  insert into public.impact_leads (name, email, company, goal, inputs)
  values (trim(lead_name), clean_email, nullif(trim(coalesce(lead_company, '')), ''), lead_goal, lead_inputs)
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.submit_impact_lead(text, text, text, text, jsonb) from public;
grant execute on function public.submit_impact_lead(text, text, text, text, jsonb) to anon, authenticated;

-- What the PDF needs for one report. The email is not returned.
create or replace function public.impact_report(report_id uuid)
returns table (name text, company text, goal text, inputs jsonb, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.name, l.company, l.goal, l.inputs, l.created_at
  from public.impact_leads l
  where l.id = report_id;
$$;
revoke all on function public.impact_report(uuid) from public;
grant execute on function public.impact_report(uuid) to anon, authenticated;
