-- Table privileges for signed-in users.
-- Newer Supabase projects do not grant access to tables created in SQL automatically,
-- which shows up as "permission denied for table ...". Row-level security still decides
-- which rows each user sees; these grants only allow the role to use the tables at all.
-- The anon (signed-out) role gets nothing.

grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.organizations,
  public.memberships,
  public.profiles,
  public.profile_sources,
  public.icps,
  public.companies,
  public.signals,
  public.prospects,
  public.contacts,
  public.concepts,
  public.pitches,
  public.outreach_events,
  public.tasks
to authenticated;

-- Usage log is append-only for users.
grant select, insert on public.provider_calls to authenticated;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.create_organization(text) to authenticated;

-- Tables added by later migrations still need their own explicit grants.
