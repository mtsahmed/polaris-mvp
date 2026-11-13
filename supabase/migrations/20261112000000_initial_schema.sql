-- Polaris initial schema (roadmap section 5).
-- Every business table carries org_id and is protected by row-level security:
-- a user can only see or change rows of organizations they belong to.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'admin', 'member');
create type public.profile_type as enum (
  'media_creative_business', 'creator', 'athlete', 'agency', 'real_estate', 'legal', 'other'
);
create type public.source_kind as enum ('url', 'file', 'questionnaire');
create type public.source_status as enum ('pending', 'processing', 'ready', 'failed');
create type public.verification_status as enum ('verified', 'unverified', 'missing');
create type public.outreach_channel as enum ('email', 'call', 'text', 'whatsapp');
create type public.consent_status as enum ('yes', 'no', 'unknown');
create type public.pipeline_stage as enum (
  'new_lead', 'researching', 'ready_to_pitch', 'contacted', 'replied', 'meeting_booked', 'won', 'lost'
);
create type public.prospect_status as enum ('saved', 'rejected');
create type public.pitch_kind as enum ('first_contact', 'follow_up', 'call_talking_points');
create type public.pitch_status as enum ('draft', 'approved', 'sent', 'done');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  created_by uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

-- security definer so RLS policies can call it without recursing into memberships' own policies
create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = target_org and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_org_admin(target_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = target_org and m.user_id = (select auth.uid()) and m.role in ('owner', 'admin')
  );
$$;

-- Creates an organization and makes the caller its owner in one step.
create or replace function public.create_organization(org_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.organizations (name, created_by) values (trim(org_name), auth.uid())
  returning id into new_id;
  insert into public.memberships (org_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end;
$$;
revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Profiles and ICPs
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  type public.profile_type not null default 'media_creative_business',
  name text not null check (char_length(name) between 1 and 160),
  website text,
  positioning text,
  services text[] not null default '{}',
  audience text,
  strengths text[] not null default '{}',
  objectives text[] not null default '{}',
  voice_samples text[] not null default '{}',
  intelligence jsonb,               -- last AI-extracted draft, with citations, before the user edits
  intelligence_generated_at timestamptz,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_org_idx on public.profiles (org_id);

create table public.profile_sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind public.source_kind not null,
  location text not null,           -- URL, storage path or questionnaire label
  title text,
  extracted_text text,
  status public.source_status not null default 'pending',
  error text,
  created_at timestamptz not null default now()
);
create index profile_sources_profile_idx on public.profile_sources (profile_id);

create table public.icps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  version int not null default 1,
  industries text[] not null default '{}',
  company_traits text[] not null default '{}',
  geographies text[] not null default '{}',
  titles text[] not null default '{}',
  problems_addressed text[] not null default '{}',
  notes text,
  approved boolean not null default false,
  approved_by uuid references auth.users (id),
  approved_at timestamptz,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (profile_id, version)
);

-- ---------------------------------------------------------------------------
-- Companies, signals, prospects, contacts
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  domain text,
  industry text,
  location text,
  apollo_id text,
  created_at timestamptz not null default now(),
  unique (org_id, domain)
);

create table public.signals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  type text not null,
  summary text not null,
  source_url text not null,         -- a signal without a source is never stored
  source_date date,
  retrieved_at timestamptz not null default now(),
  search_provider text not null
);
create index signals_company_idx on public.signals (company_id);

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  stage public.pipeline_stage not null default 'new_lead',
  score numeric(5, 2),
  score_reasons jsonb not null default '[]',   -- [{signal_id, reason, weight}]
  status public.prospect_status not null default 'saved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, company_id)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  title text,
  email text,
  email_status public.verification_status not null default 'missing',
  mobile text,
  mobile_status public.verification_status not null default 'missing',
  outreach_method public.outreach_channel not null default 'email',
  consent_to_message public.consent_status not null default 'unknown',
  source text not null,
  retrieved_at timestamptz not null default now()
);
create index contacts_company_idx on public.contacts (company_id);

-- ---------------------------------------------------------------------------
-- Concepts, pitches, outreach
-- ---------------------------------------------------------------------------
create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  title text not null,
  description text not null,
  commercial_rationale text,
  signal_ids uuid[] not null default '{}',
  selected boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.pitches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  concept_id uuid references public.concepts (id) on delete set null,
  channel public.outreach_channel not null default 'email',
  kind public.pitch_kind not null default 'first_contact',
  subject text,
  body text not null,
  status public.pitch_status not null default 'draft',
  approved_by uuid references auth.users (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- the approval gate: nothing can be sent or done without a named approver
  constraint pitches_approval_required check (
    status = 'draft' or (approved_by is not null and approved_at is not null)
  )
);

create table public.outreach_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  pitch_id uuid references public.pitches (id) on delete set null,
  channel public.outreach_channel not null,
  type text not null,               -- sent, reply, bounce, call, message, meeting
  outcome text,
  occurred_at timestamptz not null default now(),
  provider_reference text
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  title text not null,
  due_date date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.provider_calls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null,           -- anthropic, apollo, instantly
  endpoint text not null,
  credits numeric,
  input_tokens int,
  output_tokens int,
  cost_estimate_usd numeric(10, 4),
  ok boolean not null default true,
  error text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index provider_calls_org_idx on public.provider_calls (org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger organizations_updated before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger prospects_updated before update on public.prospects
  for each row execute function public.set_updated_at();
create trigger pitches_updated before update on public.pitches
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

create policy "members read their organizations" on public.organizations
  for select to authenticated using (public.is_org_member(id));
create policy "admins update their organizations" on public.organizations
  for update to authenticated using (public.is_org_admin(id)) with check (public.is_org_admin(id));
-- inserts go through create_organization(); no direct insert policy

create policy "members read memberships of their organizations" on public.memberships
  for select to authenticated using (public.is_org_member(org_id));
create policy "admins manage memberships" on public.memberships
  for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- Same member-only policy for every org-scoped table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'profile_sources', 'icps', 'companies', 'signals', 'prospects', 'contacts',
    'concepts', 'pitches', 'outreach_events', 'tasks', 'provider_calls'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "org members full access" on public.%I for all to authenticated
         using (public.is_org_member(org_id)) with check (public.is_org_member(org_id))', t);
  end loop;
end;
$$;

-- provider_calls is an audit log: members may insert and read, never edit or delete.
drop policy "org members full access" on public.provider_calls;
create policy "members read provider calls" on public.provider_calls
  for select to authenticated using (public.is_org_member(org_id));
create policy "members log provider calls" on public.provider_calls
  for insert to authenticated with check (public.is_org_member(org_id));

-- Approval is recorded as the acting user, never someone else.
-- Editing an approved pitch's text sends it back to draft, so the approved text is what goes out.
create or replace function public.enforce_pitch_approver()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.status = 'approved'
     and (new.body is distinct from old.body or new.subject is distinct from old.subject) then
    new.status := 'draft';
  end if;
  if new.status = 'draft' then
    new.approved_by := null;
    new.approved_at := null;
  elsif tg_op = 'INSERT' or old.status = 'draft' then
    new.approved_by := auth.uid();
    new.approved_at := now();
  end if;
  return new;
end;
$$;
create trigger pitches_enforce_approver before insert or update on public.pitches
  for each row execute function public.enforce_pitch_approver();

-- ICP approval is likewise stamped with the acting user; approved versions are frozen.
create or replace function public.enforce_icp_approval()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.approved then
    raise exception 'Approved ICP versions cannot be changed; create a new version instead.';
  end if;
  if new.approved then
    new.approved_by := auth.uid();
    new.approved_at := now();
  else
    new.approved_by := null;
    new.approved_at := null;
  end if;
  return new;
end;
$$;
create trigger icps_enforce_approval before insert or update on public.icps
  for each row execute function public.enforce_icp_approval();

-- ---------------------------------------------------------------------------
-- Storage bucket for profile uploads: path must start with the org id.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('profile-uploads', 'profile-uploads', false)
  on conflict (id) do nothing;

create policy "members read org uploads" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-uploads' and public.is_org_member(((storage.foldername(name))[1])::uuid));
create policy "members write org uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-uploads' and public.is_org_member(((storage.foldername(name))[1])::uuid));
create policy "members delete org uploads" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-uploads' and public.is_org_member(((storage.foldername(name))[1])::uuid));
