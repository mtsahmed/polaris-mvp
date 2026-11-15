-- Discovery (roadmap weeks 5–6): the AI suggests companies that fit a profile's ICP. A suggestion
-- is a prospect with status 'suggested' until the user adds it to the pipeline ('saved') or
-- dismisses it ('rejected'). The fit score and its reasons use the existing prospects.score and
-- prospects.score_reasons columns. No new tables, so RLS and grants are unchanged.
--
-- Run this whole file in the Supabase SQL Editor. "add value" must run on its own, outside
-- another transaction, which the SQL Editor does when the file is run as is.

alter type public.prospect_status add value if not exists 'suggested';

alter table public.prospects
  add column if not exists fit_summary text,        -- why the AI thinks the company fits
  add column if not exists discovered_at timestamptz,
  add column if not exists discovery_model text,
  add column if not exists discovery_focus text;    -- what the user narrowed the search to
