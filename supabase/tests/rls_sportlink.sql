begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(27);

insert into auth.users (
  id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,
  raw_app_meta_data,raw_user_meta_data
) values
('00000000-0000-4000-8000-000000000b01','authenticated','authenticated',
 'sport-owner@test.invalid','x',now(),now(),now(),'{}','{}'),
('00000000-0000-4000-8000-000000000b02','authenticated','authenticated',
 'sport-other@test.invalid','x',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name) values
('00000000-0000-4000-8000-000000000b01','Sport owner'),
('00000000-0000-4000-8000-000000000b02','Other owner');
insert into public.tenants(id,name,slug) values
('10000000-0000-4000-8000-000000000b01','Sport tenant','sport-tenant'),
('10000000-0000-4000-8000-000000000b02','Other sport tenant','other-sport-tenant');
insert into public.tenant_settings(tenant_id) values
('10000000-0000-4000-8000-000000000b01'),
('10000000-0000-4000-8000-000000000b02');
insert into public.tenant_memberships(tenant_id,user_id,role) values
('10000000-0000-4000-8000-000000000b01','00000000-0000-4000-8000-000000000b01','tenant_owner'),
('10000000-0000-4000-8000-000000000b02','00000000-0000-4000-8000-000000000b02','tenant_owner');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000b01',true);
select lives_ok($$select public.upsert_sportlink_connection_v1(
  '10000000-0000-4000-8000-000000000b01','Sportlink · Testclub','Testclub',
  '1234','encrypted-value','initialization-vector','authentication-tag')$$,
  'tenant owner can store an already encrypted tested connection');
select is((select count(*) from public.sportlink_connections),1::bigint,
  'owner reads the own connection');
select is((select count(*) from public.sportlink_sync_policies),8::bigint,
  'exactly one policy per dataset group is initialized');
select is((select timezone from public.sportlink_connections),
  'Europe/Amsterdam',
  'a Sportlink connection inherits the tenant timezone');
select ok(not has_column_privilege('authenticated',
  'public.sportlink_connections','encrypted_client_id','select'),
  'encrypted Client ID is not selectable by browser roles');
select ok(not has_column_privilege('authenticated',
  'public.sportlink_connections','encryption_tag','select'),
  'encryption authentication tag is not selectable by browser roles');
select is((select count(*) from public.sportlink_sync_policies
  where not enabled),2::bigint,
  'privacy-sensitive people and volunteer policies default to disabled');
select lives_ok($$select public.update_sportlink_sync_policy_v1(
  (select id from public.sportlink_connections limit 1),
  'matches','daily',true)$$,
  'tenant owner can choose an exact supported dataset frequency');
select is((select frequency from public.sportlink_sync_policies
  where dataset_group='matches'),'daily',
  'the selected frequency is stored');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000b02',true);
select is((select count(*) from public.sportlink_connections),0::bigint,
  'another tenant cannot read the connection');
select throws_ok($$select public.upsert_sportlink_connection_v1(
  '10000000-0000-4000-8000-000000000b01','Cross tenant','Nope',
  '0000','encrypted-value','initialization-vector','authentication-tag')$$,
  '42501',null,'another tenant cannot replace credentials');

reset role;
update public.tenant_settings
set timezone_name='Europe/Paris'
where tenant_id='10000000-0000-4000-8000-000000000b01';
select is((select timezone from public.sportlink_connections),
  'Europe/Paris',
  'a changed tenant timezone is propagated to the Sportlink connection');
update public.sportlink_sync_policies
set enabled=(dataset_group='matches'),next_sync_at=now();
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select is((select count(*) from public.claim_due_sportlink_sync_v1(
  'worker:sportlink-test',900)),1::bigint,
  'service worker atomically claims one due dataset');
select is((select count(*) from public.claim_due_sportlink_sync_v1(
  'worker:sportlink-test-2',900)),0::bigint,
  'a second worker cannot claim the active dataset lease');
reset role;
select set_config(
  'test.sportlink_run_id',
  (select id::text from public.sportlink_sync_runs where status='running' limit 1),
  true
);
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select is(public.renew_sportlink_sync_lease_v1(
  current_setting('test.sportlink_run_id')::uuid,
  'worker:sportlink-test-2'),false,
  'a different worker cannot renew an active dataset lease');
select is(public.renew_sportlink_sync_lease_v1(
  current_setting('test.sportlink_run_id')::uuid,
  'worker:sportlink-test'),true,
  'the owning worker can renew its active dataset lease');

reset role;
update public.sportlink_sync_runs
set locked_at=now()-interval '16 minutes'
where status='running';
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select is((select count(*) from public.claim_due_sportlink_sync_v1(
  'worker:sportlink-recovery',900)),1::bigint,
  'an expired worker lease is closed and immediately reclaimed');
reset role;
select is((select count(*) from public.sportlink_sync_runs
  where status='failed' and error_code='SPORTLINK_WORKER_LEASE_EXPIRED'),1::bigint,
  'lease recovery records the safe machine-readable failure');
select is((select count(*) from public.sportlink_sync_runs
  where status='running'),1::bigint,
  'lease recovery leaves exactly one active run for the dataset');
select is((select count(*) from public.audit_events
  where action='sportlink.sync.lease_expired'
    and result='failed'),1::bigint,
  'lease recovery writes one safe worker audit event');

select set_config(
  'test.sportlink_recovery_run_id',
  (select id::text from public.sportlink_sync_runs
    where status='running' limit 1),
  true
);
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select lives_ok(
  $$select public.complete_sportlink_sync_v1(
    current_setting('test.sportlink_recovery_run_id')::uuid,
    'worker:sportlink-recovery',
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
  )$$,
  'a valid provider run completes without a PL/pgSQL counter collision'
);
reset role;
select is((select count(*) from public.sportlink_sync_runs
  where status='succeeded' and read_count=0),1::bigint,
  'successful completion records the normalized read count');
select ok((select last_success_at is not null
  from public.sportlink_sync_policies where dataset_group='matches'),
  'successful completion updates the dataset policy');

reset role;
select set_config(
  'test.sportlink_connection_id',
  (select id::text from public.sportlink_connections limit 1),
  true
);
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select lives_ok(
  $$select public.record_sportlink_sync_v1(
    current_setting('test.sportlink_connection_id')::uuid,
    '{}'::jsonb,
    '[
      {
        "externalId":"10",
        "localExternalId":"1",
        "name":"Testclub 1",
        "competitionOptions":[{
          "externalId":"competition-a",
          "name":"Reguliere competitie",
          "period":"Fase 1",
          "poolExternalId":"701",
          "poolName":"Poule A",
          "type":"Competitie"
        }]
      },
      {
        "externalId":"10",
        "localExternalId":"1",
        "name":"Testclub 1",
        "competitionOptions":[{
          "externalId":"competition-b",
          "name":"Districtsbeker",
          "period":"Groep 3",
          "poolExternalId":"702",
          "poolName":"Poule B",
          "type":"Beker"
        }]
      }
    ]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
  )$$,
  'duplicate provider team rows complete as one normalized team'
);
reset role;
select is(
  (select count(*) from public.sports_teams where external_id='10'),
  1::bigint,
  'one canonical team row is stored for all competition contexts'
);
select is(
  (
    select jsonb_array_length(metadata -> 'competitionOptions')
    from public.sports_teams
    where external_id='10'
  ),
  2,
  'the canonical team retains both competition and cup choices'
);

set local role anon;
select is((select count(*) from public.sportlink_connections),0::bigint,
  'anonymous cannot read Sportlink connections');
select * from finish();
rollback;
