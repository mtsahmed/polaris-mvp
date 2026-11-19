-- "Last changed" times for AI results, so a re-run button can tell whether anything new has arrived
-- since the result was made (owner review, 19 November 2026: secondary buttons are active only when
-- there is new data). Run in the Supabase SQL Editor after 20261127000000_delete_users.sql.
--
-- ICPs, concepts and Intelligence briefs had only created_at, but drafts, concepts and briefs are
-- updated in place (AI redraft, Save changes, choosing a concept, Re-score). Existing rows start
-- from the time they were made (or researched), so nothing looks newer than it is.

alter table public.icps add column if not exists updated_at timestamptz;
-- Approved versions are frozen by icps_enforce_approval, which would refuse (and re-stamp) this
-- one-off backfill, so the lock is off only for this statement and back on straight after.
alter table public.icps disable trigger icps_enforce_approval;
update public.icps set updated_at = coalesce(approved_at, created_at) where updated_at is null;
alter table public.icps enable trigger icps_enforce_approval;
alter table public.icps alter column updated_at set default now(), alter column updated_at set not null;

alter table public.concepts add column if not exists updated_at timestamptz;
update public.concepts set updated_at = created_at where updated_at is null;
alter table public.concepts alter column updated_at set default now(), alter column updated_at set not null;

alter table public.briefs add column if not exists updated_at timestamptz;
update public.briefs set updated_at = coalesce(researched_at, created_at) where updated_at is null;
alter table public.briefs alter column updated_at set default now(), alter column updated_at set not null;

-- Same helper as the other tables (20261112000000_initial_schema.sql).
drop trigger if exists icps_updated on public.icps;
create trigger icps_updated before update on public.icps
  for each row execute function public.set_updated_at();
drop trigger if exists concepts_updated on public.concepts;
create trigger concepts_updated before update on public.concepts
  for each row execute function public.set_updated_at();
drop trigger if exists briefs_updated on public.briefs;
create trigger briefs_updated before update on public.briefs
  for each row execute function public.set_updated_at();
