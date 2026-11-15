-- Emails the AI web search reported but Polaris could not find on the cited page are kept (the
-- owner's choice, 15 November 2026) and marked, so they are never mistaken for confirmed ones.
-- Run in the Supabase SQL Editor after 20261119000000_contact_web_sources.sql.

alter table public.contacts
  add column if not exists email_unconfirmed boolean not null default false;
