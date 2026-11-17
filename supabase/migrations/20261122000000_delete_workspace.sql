-- Delete a workspace (organization) and everything in it. Owners and admins only.
-- Run in the Supabase SQL Editor after 20261121000000_fit_scoring.sql.
--
-- There is deliberately no DELETE policy on organizations: the only way to delete one is this
-- function, which re-checks the caller's role and requires the exact workspace name, so a stray
-- request cannot remove a workspace. Every org-scoped table references organizations with
-- "on delete cascade", so one delete removes profiles, ICPs, prospects, briefs, contacts, pitches,
-- outreach history, usage logs and memberships together.

create or replace function public.delete_organization(target_org uuid, confirm_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  org_name text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_org_admin(target_org) then
    raise exception 'Only owners and admins can delete a workspace.';
  end if;

  select name into org_name from public.organizations where id = target_org;
  if org_name is null then
    raise exception 'Workspace not found.';
  end if;
  if trim(coalesce(confirm_name, '')) <> org_name then
    raise exception 'The name you typed does not match the workspace name.';
  end if;

  delete from public.organizations where id = target_org;
end;
$$;
revoke all on function public.delete_organization(uuid, text) from public, anon;
grant execute on function public.delete_organization(uuid, text) to authenticated;
