-- Fit scoring by deal goal, anchored ratings, coverage and knockouts (docs/polaris-fit-scoring-plan.md).
-- Run in the Supabase SQL Editor after 20261120000000_email_confirmation.sql.
--
-- briefs: each brief is scored for one deal goal. The AI rates both criteria sets (customer and
-- partner) so the goal can be changed without a new AI call. Older briefs keep deal_goal null and
-- are shown with the earlier single set until they are re-scored.
--
-- icps: knockout rules. A company that matches one is "Not a fit" whatever its score.

alter table public.briefs
  add column if not exists deal_goal text check (deal_goal in ('customer', 'partnership', 'referral', 'co_marketing')),
  add column if not exists deal_goal_suggested text check (deal_goal_suggested in ('customer', 'partnership', 'referral', 'co_marketing')),
  add column if not exists deal_goal_reason text,
  -- {customer: [{key, rating, reason, signal_ids}], partner: [...]}
  add column if not exists criteria_sets jsonb,
  -- [{rule, reason, signal_id}]
  add column if not exists knockouts jsonb not null default '[]',
  add column if not exists fit_known int check (fit_known between 0 and 5),
  add column if not exists fit_case text;

alter table public.icps
  add column if not exists excluded_geographies text[] not null default '{}',
  add column if not exists competitors text[] not null default '{}',
  add column if not exists min_employees int check (min_employees > 0);
