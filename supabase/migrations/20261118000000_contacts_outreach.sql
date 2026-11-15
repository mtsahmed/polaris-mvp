-- Contacts and Outreach (journey milestones 5 and 7) and the pipeline board.
-- Run in the Supabase SQL Editor after 20261117000000_intelligence.sql.
-- The contacts, outreach_events and tasks tables already exist with the member-only RLS policy
-- and grants; this adds the columns the stages need and closes the send gate.

-- ---------------------------------------------------------------------------
-- Contacts: where each one came from, and who added it.
-- ---------------------------------------------------------------------------
alter table public.contacts
  add column if not exists apollo_id text,
  add column if not exists linkedin_url text,
  add column if not exists notes text,
  add column if not exists created_by uuid references auth.users (id) default auth.uid(),
  add column if not exists created_at timestamptz not null default now();

-- One saved contact per Apollo person per organization (a second reveal must not cost again).
create unique index if not exists contacts_org_apollo_idx
  on public.contacts (org_id, apollo_id) where apollo_id is not null;

-- ---------------------------------------------------------------------------
-- Pitches: who marked an email as sent, and when.
-- ---------------------------------------------------------------------------
alter table public.pitches
  add column if not exists sent_at timestamptz,
  add column if not exists sent_by uuid references auth.users (id);

-- The approval gate, extended to sending (roadmap rule: nothing leaves Polaris without a named
-- approver). A pitch can be marked sent only from "approved"; sent text cannot change; the
-- sender and time are stamped by the database, not the browser.
create or replace function public.enforce_pitch_approver()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.status in ('sent', 'done') then
    raise exception 'A pitch must be approved before it is sent.';
  end if;
  if tg_op = 'UPDATE' and old.status in ('sent', 'done') then
    if new.body is distinct from old.body or new.subject is distinct from old.subject then
      raise exception 'A sent pitch cannot be edited.';
    end if;
    if new.status not in ('sent', 'done') then
      raise exception 'A sent pitch cannot go back to draft or approved.';
    end if;
    new.approved_by := old.approved_by;
    new.approved_at := old.approved_at;
    new.sent_by := old.sent_by;
    new.sent_at := old.sent_at;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.status = 'sent' then
    if old.status <> 'approved' then
      raise exception 'A pitch must be approved before it is sent.';
    end if;
    new.approved_by := old.approved_by;
    new.approved_at := old.approved_at;
    new.sent_by := auth.uid();
    new.sent_at := now();
    return new;
  end if;

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

-- ---------------------------------------------------------------------------
-- Outreach events: sends, replies, calls, messages, meetings and bounces, per prospect.
-- ---------------------------------------------------------------------------
alter table public.outreach_events
  add column if not exists prospect_id uuid references public.prospects (id) on delete cascade,
  add column if not exists contact_id uuid references public.contacts (id) on delete set null,
  add column if not exists note text,
  add column if not exists created_by uuid references auth.users (id) default auth.uid();
create index if not exists outreach_events_prospect_idx on public.outreach_events (prospect_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Tasks: follow-ups created when an email is marked sent.
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column if not exists pitch_id uuid references public.pitches (id) on delete set null,
  add column if not exists done_at timestamptz;
create index if not exists tasks_prospect_idx on public.tasks (prospect_id, done, due_date);
