-- Usage & cost per person. Run in the Supabase SQL Editor after 20261122000000_delete_workspace.sql.
--
-- Members read only the provider calls they made; owners and admins read the whole workspace's.
-- Every call is attributed to the signed-in user who started it (created_by defaults to auth.uid(),
-- background jobs run with that user's session), and a row can no longer be attributed to someone else.

drop policy if exists "members read provider calls" on public.provider_calls;
create policy "admins read all provider calls, members their own" on public.provider_calls
  for select to authenticated
  using (
    public.is_org_admin(org_id)
    or (public.is_org_member(org_id) and created_by = (select auth.uid()))
  );

drop policy if exists "members log provider calls" on public.provider_calls;
create policy "members log their own provider calls" on public.provider_calls
  for insert to authenticated
  with check (public.is_org_member(org_id) and created_by = (select auth.uid()));

create index if not exists provider_calls_user_idx on public.provider_calls (org_id, created_by, created_at desc);

-- Names and emails of a workspace's members, for the admin view of Usage & cost.
-- auth.users is not readable from the app, so this security-definer function returns only
-- these fields, and only to the workspace's owners and admins.
create or replace function public.workspace_members(target_org uuid)
returns table (user_id uuid, email text, full_name text, role public.member_role)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_org_admin(target_org) then
    raise exception 'Only owners and admins can list workspace members.';
  end if;
  return query
    select m.user_id, u.email::text, (u.raw_user_meta_data ->> 'full_name')::text, m.role
    from public.memberships m
    join auth.users u on u.id = m.user_id
    where m.org_id = target_org
    order by m.created_at;
end;
$$;
revoke all on function public.workspace_members(uuid) from public, anon;
grant execute on function public.workspace_members(uuid) to authenticated;
