-- Pitch studio (roadmap weeks 3–4): research summary on companies, research run details on
-- prospects, and the verbatim quote behind each signal. No new tables, so RLS and grants are
-- unchanged (companies, signals, prospects, concepts and pitches are already member-only).

alter table public.companies
  add column if not exists website text,
  add column if not exists summary text;

alter table public.signals
  add column if not exists quote text;

alter table public.prospects
  add column if not exists research_gaps text[] not null default '{}',
  add column if not exists researched_at timestamptz,
  add column if not exists research_model text,
  add column if not exists notes text;           -- what the user already knows or wants to try

alter table public.concepts
  add column if not exists model text;

alter table public.pitches
  add column if not exists model text;
