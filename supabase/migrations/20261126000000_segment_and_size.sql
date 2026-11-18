-- End-to-end review (18 November 2026), items 8 and 9.
-- companies.size: company size as a source states it ("11–50 employees"), filled by Discovery.
-- prospects.segment: the industry segment this company belongs to for the profile, chosen by
-- Discovery from the profile's ICP industries. Older rows stay empty; the app then matches the
-- company's industry to the ICP industries when it shows them.
-- Both tables already have their grants and RLS policies; new columns inherit them.

alter table public.companies
  add column if not exists size text;

alter table public.prospects
  add column if not exists segment text;
