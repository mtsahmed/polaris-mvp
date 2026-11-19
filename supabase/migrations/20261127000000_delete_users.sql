-- Delete a user and their data from inside Polaris (Admin > Users). Polaris app admins only.
-- Run in the Supabase SQL Editor after 20261126000000_segment_and_size.sql.
--
-- Owner's choices (19 November 2026):
-- * A workspace where the user is the only member is deleted with everything in it.
-- * In a workspace shared with others, everything the user created, approved, decided or sent is
--   transferred to that workspace's owner (another owner, else the longest-standing admin, else
--   the longest-standing member). If the user was its only owner, that person becomes owner.
--   No row is left pointing at nobody.
-- * Usage & cost records in shared workspaces are kept, so totals stay right; they show as
--   "Deleted user". (A deleted workspace takes its own usage records with it, as before.)
-- * Only Polaris app admins can do this, never on themselves or on another app admin.
-- Deleting through Supabase's own Users page still fails while the user has work saved; use Polaris.

-- 1. Usage records outlive the person: their "who" becomes empty, shown as "Deleted user".
do $$
declare
  r record;
begin
  for r in
    select c.conname from pg_constraint c
    where c.conrelid = 'public.provider_calls'::regclass and c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass and c.confdeltype <> 'n'
  loop
    execute format('alter table public.provider_calls drop constraint %I', r.conname);
  end loop;
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.provider_calls'::regclass and c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
  ) then
    alter table public.provider_calls add constraint provider_calls_created_by_fkey
      foreign key (created_by) references auth.users (id) on delete set null;
  end if;
end;
$$;

-- 2. True only inside platform_delete_user(). The setting is local to that transaction and cannot
--    be set through the API, so the frozen-row triggers below let the transfer through.
create or replace function public.deleting_user()
returns boolean language sql stable as $$
  select coalesce(current_setting('polaris.deleting_user', true), '') <> '';
$$;

-- Pitch approval and sending gate (as in 20261118000000), plus the transfer exception.
create or replace function public.enforce_pitch_approver()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and public.deleting_user() then
    return new;
  end if;
  if tg_op = 'INSERT' and new.status in ('sent', 'done') then
    raise exception 'A pitch must be approved before it is sent.';
  end if;
  if tg_op = 'UPDATE' and old.status in ('sent', 'done') then
    if new.body is distinct from old.body or new.subject is distinct from old.subject then
      raise exception 'A sent pitch cannot be edited.';
    end if;
    if new.status not in ('sent', 'done') then
      raise exception 'A sent pitch cannot go back to draft or approved.';
    end if;
    new.approved_by := old.approved_by;
    new.approved_at := old.approved_at;
    new.sent_by := old.sent_by;
    new.sent_at := old.sent_at;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.status = 'sent' then
    if old.status <> 'approved' then
      raise exception 'A pitch must be approved before it is sent.';
    end if;
    new.approved_by := old.approved_by;
    new.approved_at := old.approved_at;
    new.sent_by := auth.uid();
    new.sent_at := now();
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'approved'
     and (new.body is distinct from old.body or new.subject is distinct from old.subject) then
    new.status := 'draft';
  end if;
  if new.status = 'draft' then
    new.approved_by := null;
    new.approved_at := null;
  elsif tg_op = 'INSERT' or old.status = 'draft' then
    new.approved_by := auth.uid();
    new.approved_at := now();
  end if;
  return new;
end;
$$;

-- ICP approval (as in 20261112000000), plus the transfer exception.
create or replace function public.enforce_icp_approval()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and public.deleting_user() then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.approved then
    raise exception 'Approved ICP versions cannot be changed; create a new version instead.';
  end if;
  if new.approved then
    new.approved_by := auth.uid();
    new.approved_at := now();
  else
    new.approved_by := null;
    new.approved_at := null;
  end if;
  return new;
end;
$$;

-- 3. Who takes over a workspace's work when `leaving` goes: another owner, else the
--    longest-standing admin, else the longest-standing member. NULL when nobody else is in it.
create or replace function public.workspace_heir(target_org uuid, leaving uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select m.user_id from public.memberships m
  where m.org_id = target_org and m.user_id <> leaving
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at, m.user_id
  limit 1;
$$;
revoke all on function public.workspace_heir(uuid, uuid) from public, anon, authenticated;

-- 4. Every account with its workspaces, for the Admin > Users page. App admins only.
create or replace function public.platform_user_overview()
returns table (
  user_id uuid, email text, full_name text, created_at timestamptz, last_sign_in_at timestamptz,
  confirmed boolean, is_app_admin boolean, workspaces jsonb
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only Polaris app admins can list users.';
  end if;
  return query
    select
      u.id, u.email::text, (u.raw_user_meta_data ->> 'full_name')::text, u.created_at, u.last_sign_in_at,
      u.email_confirmed_at is not null,
      exists (select 1 from public.platform_admins pa where pa.email = lower(u.email)),
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', o.name, 'role', m.role,
          'members', (select count(*) from public.memberships x where x.org_id = o.id)
        ) order by o.name)
        from public.memberships m join public.organizations o on o.id = m.org_id
        where m.user_id = u.id
      ), '[]'::jsonb)
    from auth.users u
    order by u.created_at;
end;
$$;
revoke all on function public.platform_user_overview() from public, anon;
grant execute on function public.platform_user_overview() to authenticated;

-- 5. Delete a user. Returns what happened: workspaces deleted and workspaces handed over.
create or replace function public.platform_delete_user(target uuid, confirm_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_email text;
  col record;
  org record;
  heir uuid;
  orgs uuid[] := '{}';
  found uuid[];
  deleted jsonb := '[]'::jsonb;
  moved jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_platform_admin() then
    raise exception 'Only Polaris app admins can delete users.';
  end if;
  if target = auth.uid() then
    raise exception 'You cannot delete your own account here.';
  end if;
  select lower(u.email) into target_email from auth.users u where u.id = target;
  if target_email is null then
    raise exception 'User not found. They may already be deleted.';
  end if;
  if lower(trim(coalesce(confirm_email, ''))) <> target_email then
    raise exception 'The email you typed does not match this user.';
  end if;
  if exists (select 1 from public.platform_admins pa where pa.email = target_email) then
    raise exception 'This account is a Polaris app admin. Remove it from platform_admins first.';
  end if;

  perform set_config('polaris.deleting_user', target::text, true);

  -- Workspaces touched: those they belong to, plus any where they left work behind earlier.
  select coalesce(array_agg(m.org_id), '{}') into orgs from public.memberships m where m.user_id = target;
  select orgs || coalesce(array_agg(o.id), '{}') into orgs from public.organizations o where o.created_by = target;
  for col in
    select c.conrelid::regclass as tbl, a.attname as name
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'auth.users'::regclass
      and c.connamespace = 'public'::regnamespace
      and c.confdeltype in ('a', 'r') and array_length(c.conkey, 1) = 1
      and c.conrelid <> 'public.organizations'::regclass
      and exists (select 1 from pg_attribute oa
                  where oa.attrelid = c.conrelid and oa.attname = 'org_id' and not oa.attisdropped)
  loop
    execute format('select array_agg(distinct org_id) from %s where %I = $1', col.tbl, col.name)
      into found using target;
    orgs := orgs || coalesce(found, '{}');
  end loop;

  -- Each workspace: delete it if nobody else is in it, otherwise hand it over.
  for org in
    select o.id, o.name from public.organizations o where o.id = any (orgs) order by o.name
  loop
    heir := public.workspace_heir(org.id, target);
    if heir is null then
      deleted := deleted || jsonb_build_object('workspace', org.name);
      delete from public.organizations where id = org.id;
    else
      if not exists (
        select 1 from public.memberships m
        where m.org_id = org.id and m.user_id <> target and m.role = 'owner'
      ) then
        update public.memberships set role = 'owner' where org_id = org.id and user_id = heir;
      end if;
      moved := moved || jsonb_build_object(
        'workspace', org.name,
        'to', (select coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), u.email::text)
               from auth.users u where u.id = heir));
      update public.organizations set created_by = heir where id = org.id and created_by = target;
    end if;
  end loop;

  -- Transfer every remaining "who did it" stamp to the heir of the row's workspace.
  for col in
    select c.conrelid::regclass as tbl, a.attname as name
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'auth.users'::regclass
      and c.connamespace = 'public'::regnamespace
      and c.confdeltype in ('a', 'r') and array_length(c.conkey, 1) = 1
      and c.conrelid <> 'public.organizations'::regclass
      and exists (select 1 from pg_attribute oa
                  where oa.attrelid = c.conrelid and oa.attname = 'org_id' and not oa.attisdropped)
  loop
    execute format(
      'update %s set %I = public.workspace_heir(org_id, $1) where %I = $1', col.tbl, col.name, col.name)
      using target;
  end loop;

  delete from auth.users where id = target;
  return jsonb_build_object('email', target_email, 'deleted', deleted, 'transferred', moved);
end;
$$;
revoke all on function public.platform_delete_user(uuid, text) from public, anon;
grant execute on function public.platform_delete_user(uuid, text) to authenticated;
