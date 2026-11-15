-- Row-level security check for briefs (journey spec, section 12): a user in one organization
-- cannot read another organization's briefs or prospect decisions.
--
-- Run in the Supabase SQL Editor after 20261117000000_intelligence.sql.
--
-- The block always ends with a deliberate error. That error undoes everything the test created,
-- so no test data is left behind, and its message carries the result:
--   "RLS TEST PASSED ..."  every check passed
--   "RLS TEST FAILED ..."  at least one check failed; the counts show which

do $$
declare
  own_briefs int;
  other_briefs int;
  other_prospects int;
  a_user uuid := '00000000-0000-4000-8000-00000000000a';
  b_user uuid := '00000000-0000-4000-8000-00000000000b';
  a_org uuid := '00000000-0000-4000-8000-0000000000a1';
  b_org uuid := '00000000-0000-4000-8000-0000000000b1';
begin
  -- Two throwaway users, each in their own organization, with one prospect and one brief each.
  insert into auth.users (id, email, aud, role) values
    (a_user, 'rls-test-a@example.invalid', 'authenticated', 'authenticated'),
    (b_user, 'rls-test-b@example.invalid', 'authenticated', 'authenticated');
  insert into public.organizations (id, name, created_by) values (a_org, 'RLS test A', a_user), (b_org, 'RLS test B', b_user);
  insert into public.memberships (org_id, user_id, role) values (a_org, a_user, 'owner'), (b_org, b_user, 'owner');
  insert into public.profiles (id, org_id, type, name) values
    ('00000000-0000-4000-8000-0000000000a2', a_org, 'other', 'A'),
    ('00000000-0000-4000-8000-0000000000b2', b_org, 'other', 'B');
  insert into public.companies (id, org_id, name, domain) values
    ('00000000-0000-4000-8000-0000000000a3', a_org, 'Co A', 'a.example.invalid'),
    ('00000000-0000-4000-8000-0000000000b3', b_org, 'Co B', 'b.example.invalid');
  insert into public.prospects (id, org_id, profile_id, company_id) values
    ('00000000-0000-4000-8000-0000000000a4', a_org, '00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a3'),
    ('00000000-0000-4000-8000-0000000000b4', b_org, '00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b3');
  insert into public.briefs (org_id, prospect_id, status) values
    (a_org, '00000000-0000-4000-8000-0000000000a4', 'ready'),
    (b_org, '00000000-0000-4000-8000-0000000000b4', 'ready');

  -- Act as user A, a signed-in member of organization A only.
  perform set_config('request.jwt.claims', json_build_object('sub', a_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into own_briefs from public.briefs where org_id = a_org;
  select count(*) into other_briefs from public.briefs where org_id = b_org;
  select count(*) into other_prospects from public.prospects where org_id = b_org;

  execute 'reset role';

  if own_briefs = 1 and other_briefs = 0 and other_prospects = 0 then
    raise exception 'RLS TEST PASSED: user A sees % own brief, % of organization B''s briefs and % of its prospects. (This error is deliberate; it removes the test data.)',
      own_briefs, other_briefs, other_prospects;
  else
    raise exception 'RLS TEST FAILED: user A sees % own brief (expected 1), % of organization B''s briefs (expected 0) and % of its prospects (expected 0).',
      own_briefs, other_briefs, other_prospects;
  end if;
end;
$$;
