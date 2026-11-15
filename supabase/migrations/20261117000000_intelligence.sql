-- Intelligence stage (docs/polaris-journey-and-intelligence-spec.md, section 8).
--
-- briefs: one research brief per prospect, versioned (a refresh adds a version; earlier ones are
-- kept). The fit score lives here with its five criteria, replacing prospects.score and
-- prospects.score_reasons, which the app no longer reads or writes. Those two columns are left in
-- place for now and can be dropped later.
--
-- prospects: when the company was shortlisted, and the user's decision (pursue, hold, skip),
-- stored separately from the brief's recommendation, with who decided and when.
--
-- No column stores journey progress; the journey bar derives everything from these records.

create type public.brief_status as enum ('researching', 'ready', 'insufficient_evidence', 'failed');
create type public.prospect_decision as enum ('none', 'pursue', 'hold', 'skip');

create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  version int not null default 1,
  status public.brief_status not null default 'researching',
  summary text,
  fit_score int check (fit_score between 0 and 100),
  fit_band text check (fit_band in ('strong', 'possible', 'weak')),
  -- [{key, rating (0–20) or null for Unknown, reason, signal_ids}]
  criteria jsonb not null default '[]',
  -- [{statement, signal_id}]
  why_now jsonb not null default '[]',
  risks jsonb not null default '[]',
  recommendation text check (recommendation in ('pursue', 'hold', 'skip')),
  recommendation_reason text,
  suggested_angle text,
  -- [{role, reason}]
  target_roles jsonb not null default '[]',
  -- [{title, description, signal_ids}]
  concept_starters jsonb not null default '[]',
  signal_ids uuid[] not null default '{}',   -- every source the brief cites
  error text,                                -- why research failed, shown with a retry action
  model text,
  search_count int,
  cost_estimate_usd numeric(10, 4),
  researched_at timestamptz,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (prospect_id, version)
);
create index briefs_prospect_idx on public.briefs (prospect_id, version desc);

alter table public.briefs enable row level security;
create policy "org members full access" on public.briefs for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
grant select, insert, update, delete on public.briefs to authenticated;

alter table public.prospects
  add column if not exists shortlisted_at timestamptz,
  add column if not exists decision public.prospect_decision not null default 'none',
  add column if not exists decided_by uuid references auth.users (id),
  add column if not exists decided_at timestamptz,
  add column if not exists decision_reason text;

-- The decision is stamped with the acting user and time, like pitch and ICP approvals.
create or replace function public.stamp_prospect_decision()
returns trigger language plpgsql as $$
begin
  if new.decision is distinct from old.decision then
    if new.decision = 'none' then
      new.decided_by := null;
      new.decided_at := null;
      new.decision_reason := null;
    else
      new.decided_by := auth.uid();
      new.decided_at := now();
    end if;
  end if;
  return new;
end;
$$;
create trigger prospects_stamp_decision before update on public.prospects
  for each row execute function public.stamp_prospect_decision();

-- Web searches per AI call, so research cost can be traced to its searches.
alter table public.provider_calls add column if not exists searches int;

-- Companies already being pitched (added in the pitch studio or the pipeline) count as shortlisted.
update public.prospects
  set shortlisted_at = created_at
  where status = 'saved' and shortlisted_at is null;
