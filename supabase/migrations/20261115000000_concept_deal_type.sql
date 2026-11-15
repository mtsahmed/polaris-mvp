-- Pitch studio: each concept says what kind of deal it proposes (partnership, customer,
-- referral, co-marketing) plus a short angle such as "Discounted pilot". Shown as a tag on the
-- concept so the user sees the outreach goal at a glance. No new tables, so RLS and grants
-- are unchanged. Existing concepts keep null until they are redrafted or edited.

alter table public.concepts
  add column if not exists deal_type text
    check (deal_type in ('partnership', 'customer', 'referral', 'co_marketing')),
  add column if not exists deal_angle text;
