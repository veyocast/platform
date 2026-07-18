begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(5);

select has_table('public', 'player_device_lab_runs', 'device lab run table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.player_device_lab_runs'::regclass),
  true,
  'device lab run RLS is active'
);

set local role anon;
select throws_ok(
  $$ select count(*) from public.player_device_lab_runs $$,
  '42501',
  'permission denied for table player_device_lab_runs',
  'anonymous cannot read diagnostic runs'
);

set local role authenticated;
select throws_ok(
  $$ insert into public.player_device_lab_runs (
       run_id, captured_at, app_version, deployment_sha, report
     ) values ('forbidden-run', now(), 'test', 'test', '{}'::jsonb) $$,
  '42501',
  'permission denied for table player_device_lab_runs',
  'authenticated users cannot write diagnostic runs directly'
);

reset role;
set local role service_role;
select lives_ok(
  $$ insert into public.player_device_lab_runs (
       run_id, captured_at, app_version, deployment_sha, report
     ) values ('service-run', now(), 'test', 'test', '{}'::jsonb) $$,
  'service role can store a redacted diagnostic run'
);

select * from finish();
rollback;
