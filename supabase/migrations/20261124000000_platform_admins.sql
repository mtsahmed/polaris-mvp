-- Polaris app admins and usage totals. Run in the Supabase SQL Editor after
-- 20261123000000_usage_per_user.sql.
--
-- An app admin is above workspace roles: they can read the usage and cost of every user in every
-- workspace (read only; they get no access to workspace data such as profiles or contacts).
-- Admins are listed by email, so an address can be added before its account exists. The email must
-- be confirmed before it counts.

create table if not exists public.platform_admins (
  email text primary key check (email = lower(email)),
  added_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
-- No policies: the app never reads this table directly, only through is_platform_admin().

insert into public.platform_admins (email) values
  ('mts.ahmed2@gmail.com'),
  ('info@tiffanyaisys.com')
on conflict (email) do nothing;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from auth.users u
    join public.platform_admins pa on pa.email = lower(u.email)
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create policy "app admins read all provider calls" on public.provider_calls
  for select to authenticated using (public.is_platform_admin());

-- Every user and every workspace, for labelling the app-wide usage view. App admins only.
create or replace function public.platform_users()
returns table (user_id uuid, email text, full_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only Polaris app admins can list all users.';
  end if;
  return query
    select u.id, u.email::text, (u.raw_user_meta_data ->> 'full_name')::text
    from auth.users u
    order by u.created_at;
end;
$$;
revoke all on function public.platform_users() from public, anon;
grant execute on function public.platform_users() to authenticated;

create or replace function public.platform_workspaces()
returns table (org_id uuid, name text, members bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only Polaris app admins can list all workspaces.';
  end if;
  return query
    select o.id, o.name, (select count(*) from public.memberships m where m.org_id = o.id)
    from public.organizations o
    order by o.created_at;
end;
$$;
revoke all on function public.platform_workspaces() from public, anon;
grant execute on function public.platform_workspaces() to authenticated;

-- Usage totals added up in the database, so they are never cut off by the API's row limit.
-- Runs with the caller's own rights (not security definer), so row-level security decides what
-- it adds up: members their own calls, workspace admins their workspace, app admins everything.
create or replace function public.usage_summary(
  since timestamptz,
  target_org uuid default null,
  only_user uuid default null
)
returns table (org_id uuid, created_by uuid, provider text, calls bigint, cost numeric, credits numeric, tokens bigint)
language sql stable set search_path = '' as $$
  select
    c.org_id,
    c.created_by,
    c.provider,
    count(*),
    coalesce(sum(c.cost_estimate_usd), 0),
    coalesce(sum(c.credits), 0),
    coalesce(sum(coalesce(c.input_tokens, 0) + coalesce(c.output_tokens, 0)), 0)::bigint
  from public.provider_calls c
  where c.created_at >= since
    and (target_org is null or c.org_id = target_org)
    and (only_user is null or c.created_by = only_user)
  group by c.org_id, c.created_by, c.provider;
$$;
revoke all on function public.usage_summary(timestamptz, uuid, uuid) from public, anon;
grant execute on function public.usage_summary(timestamptz, uuid, uuid) to authenticated;
