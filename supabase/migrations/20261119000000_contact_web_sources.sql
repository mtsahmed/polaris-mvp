-- Automated contact finding (Apollo, then public web search) and richer contact details.
-- Run in the Supabase SQL Editor after 20261118000000_contacts_outreach.sql.

-- ---------------------------------------------------------------------------
-- Contacts: office or main line, WhatsApp number, and the page each detail was read from.
-- ---------------------------------------------------------------------------
alter table public.contacts
  add column if not exists phone text,
  add column if not exists whatsapp text,
  add column if not exists source_url text;

-- ---------------------------------------------------------------------------
-- Contact jobs: one row per contact-finding run for a company. The table is the queue: today
-- the app runs jobs right after the request (Next.js after()); a scheduled worker can later pick
-- up "queued" rows without changing the pages.
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.contact_job_status as enum ('queued', 'running', 'done', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists public.contact_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  status public.contact_job_status not null default 'queued',
  trigger text not null default 'retry',      -- pursue, bulk, retry
  summary jsonb not null default '[]'::jsonb, -- one entry per source: name, outcome, counts
  saved_count int not null default 0,
  error text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index if not exists contact_jobs_prospect_idx on public.contact_jobs (prospect_id, created_at desc);

alter table public.contact_jobs enable row level security;
drop policy if exists "org members full access" on public.contact_jobs;
create policy "org members full access" on public.contact_jobs
  for all to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
grant select, insert, update, delete on public.contact_jobs to authenticated;
