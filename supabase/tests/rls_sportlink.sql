begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(45);

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
  'matches','five_minutes',true)$$,
  'tenant owner can choose the five-minute dataset frequency');
select is((select frequency from public.sportlink_sync_policies
  where dataset_group='matches'),'five_minutes',
  'the five-minute frequency is stored');

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
insert into public.sports_standings(
  tenant_id,source_connection_id,external_id,pool_external_id,
  rows_json,scores_published,season_key,metadata
) values
(
  '10000000-0000-4000-8000-000000000b01',
  (select id from public.sportlink_connections limit 1),
  'standing-history','701','[]',true,'2025/2026',
  '{"season":"2025/2026"}'
),
(
  '10000000-0000-4000-8000-000000000b01',
  (select id from public.sportlink_connections limit 1),
  'standing-history','701','[]',true,'2026/2027',
  '{"season":"2026/2027"}'
);
select is((select count(*) from public.sports_standings
  where external_id='standing-history'),2::bigint,
  'the same competition standing remains available for historical seasons');
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

select ok(not has_function_privilege(
  'authenticated',
  'public.complete_sportlink_sync_v2(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)',
  'execute'
), 'browser roles cannot execute the Sportlink media completion RPC');

reset role;
insert into public.sportlink_sync_runs(
  id, tenant_id, connection_id, dataset_group, status, worker_id, locked_at
) values (
  '40000000-0000-4000-8000-000000000b10',
  '10000000-0000-4000-8000-000000000b01',
  (select id from public.sportlink_connections limit 1),
  'club_profile',
  'running',
  'worker:sportlink-club-logo',
  now()
);
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select lives_ok(
  $$select public.complete_sportlink_sync_v2(
    '40000000-0000-4000-8000-000000000b10',
    'worker:sportlink-club-logo',
    '{"externalId":"club-duindorp","name":"Duindorp sv"}'::jsonb,
    '{
      "assetId":"50000000-0000-5000-8000-000000000b10",
      "checksumSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "fileSizeBytes":12345,
      "height":398,
      "mimeType":"image/webp",
      "role":"club_logo",
      "storagePath":"tenants/10000000-0000-4000-8000-000000000b01/assets/50000000-0000-5000-8000-000000000b10/sportlink-club-logo.webp",
      "title":"Duindorp sv clublogo",
      "width":512
    }'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
  )$$,
  'the service worker registers and completes an official club logo import'
);
reset role;
select is((
  select count(*)
  from public.media_assets
  where id = '50000000-0000-5000-8000-000000000b10'
    and tenant_id = '10000000-0000-4000-8000-000000000b01'
    and status = 'ready'
), 1::bigint, 'the Sportlink club logo is a ready tenant-owned media asset');
select is((
  select logo_media_asset_id
  from public.sports_clubs
  where external_id = 'club-duindorp'
), '50000000-0000-5000-8000-000000000b10'::uuid,
  'the normalized client club references its local Sportlink logo');

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
    jsonb_build_array(
      jsonb_build_object(
        'externalId','match-cup',
        'startsAt',(now() + interval '1 day')::text,
        'status','scheduled',
        'homeTeam',jsonb_build_object(
          'externalId','10','name','Testclub 1','score',null
        ),
        'awayTeam',jsonb_build_object(
          'externalId','20','name','Bezoekers','score',null
        ),
        'competition',jsonb_build_object(
          'externalId','competition-b',
          'name','Districtsbeker',
          'period','Groep 3',
          'type','Beker'
        ),
        'pool',jsonb_build_object(
          'externalId','702','name','Poule B'
        ),
        'venue',jsonb_build_object('field','Veld 1'),
        'dressingRooms','{}'::jsonb,
        'officials','[]'::jsonb,
        'isHomeMatch',true
      ),
      jsonb_build_object(
        'externalId','match-league',
        'startsAt',(now() + interval '2 days')::text,
        'status','scheduled',
        'homeTeam',jsonb_build_object(
          'externalId','30','name','Ander team','score',null
        ),
        'awayTeam',jsonb_build_object(
          'externalId','40','name','Andere bezoekers','score',null
        ),
        'competition',jsonb_build_object(
          'externalId','competition-c',
          'name','Reguliere competitie',
          'period','Fase 1',
          'type','Competitie'
        ),
        'pool',jsonb_build_object(
          'externalId','703','name','Poule C'
        ),
        'venue',jsonb_build_object('field','Veld 2'),
        'dressingRooms','{}'::jsonb,
        'officials','[]'::jsonb,
        'isHomeMatch',false
      )
    ),
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

insert into public.sports_standings(
  tenant_id,source_connection_id,external_id,pool_external_id,
  rows_json,scores_published,season_key,metadata
) values (
  '10000000-0000-4000-8000-000000000b01',
  current_setting('test.sportlink_connection_id')::uuid,
  'standing-current','701',
  '[{
    "drawn":3,
    "externalId":"10",
    "form":[],
    "goalsAgainst":12,
    "goalsFor":30,
    "lost":1,
    "played":16,
    "points":39,
    "position":1,
    "teamName":"Testclub 1",
    "won":12
  }]'::jsonb,
  true,
  '2026/2027',
  '{
    "competition":{
      "externalId":"competition-a",
      "name":"Reguliere competitie",
      "season":"2026/2027"
    },
    "pool":{"externalId":"701","name":"Poule A"},
    "season":"2026/2027"
  }'::jsonb
);
insert into public.sports_matches(
  tenant_id,source_connection_id,external_id,starts_at,status,
  home_team,away_team,competition,pool,scores_published,is_home_match
) values
(
  '10000000-0000-4000-8000-000000000b01',
  current_setting('test.sportlink_connection_id')::uuid,
  'form-win',now()-interval '3 days','finished',
  '{"externalId":"10","name":"Testclub 1","score":2}',
  '{"externalId":"20","name":"Bezoekers","score":0}',
  '{"externalId":"competition-a","name":"Reguliere competitie"}',
  '{"externalId":"701","name":"Poule A"}',true,true
),
(
  '10000000-0000-4000-8000-000000000b01',
  current_setting('test.sportlink_connection_id')::uuid,
  'form-draw',now()-interval '2 days','finished',
  '{"externalId":"20","name":"Bezoekers","score":1}',
  '{"externalId":"10","name":"Testclub 1","score":1}',
  '{"externalId":"competition-a","name":"Reguliere competitie"}',
  '{"externalId":"701","name":"Poule A"}',true,false
),
(
  '10000000-0000-4000-8000-000000000b01',
  current_setting('test.sportlink_connection_id')::uuid,
  'form-loss',now()-interval '1 day','finished',
  '{"externalId":"10","name":"Testclub 1","score":0}',
  '{"externalId":"20","name":"Bezoekers","score":3}',
  '{"externalId":"competition-a","name":"Reguliere competitie"}',
  '{"externalId":"701","name":"Poule A"}',true,true
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000b01',
  true
);
select lives_ok(
  $$select public.create_dynamic_slide_v1(
    '10000000-0000-4000-8000-000000000b01',
    'Bekerprogramma Testclub 1',
    (
      select version.id
      from public.dynamic_template_versions version
      join public.dynamic_templates template
        on template.id = version.template_id
      where template.slug = 'editorial-arena-programma-dark-landscape'
        and version.status = 'published'
    ),
    (
      select connection.data_source_id
      from public.sportlink_connections connection
      limit 1
    ),
    'latest',
    '{
      "title":"Bekerprogramma",
      "maxItems":8,
      "sportTeamExternalId":"10",
      "sportCompetitionExternalId":"competition-b"
    }'::jsonb
  )$$,
  'tenant owner can create a team- and competition-scoped program slide'
);
select lives_ok(
  $$select public.create_dynamic_slide_v1(
    '10000000-0000-4000-8000-000000000b01',
    'Portraitstand Testclub 1',
    (
      select version.id
      from public.dynamic_template_versions version
      join public.dynamic_templates template
        on template.id = version.template_id
      where template.slug =
        'editorial-arena-competitiestand-dark-portrait'
        and version.status = 'published'
    ),
    (
      select connection.data_source_id
      from public.sportlink_connections connection
      limit 1
    ),
    'latest',
    '{
      "title":"Stand",
      "maxItems":18,
      "sportTeamExternalId":"10",
      "sportCompetitionExternalId":"competition-a",
      "sportSeason":"2026/2027"
    }'::jsonb
  )$$,
  'tenant owner can create an eighteen-row portrait standing slide'
);
select is(
  (
    select snapshot.snapshot_data_json #>
      '{sport,items,0,form}'
    from public.dynamic_slide_snapshots snapshot
    join public.dynamic_slides slide
      on slide.id = snapshot.dynamic_slide_id
    where slide.name = 'Portraitstand Testclub 1'
    order by snapshot.created_at desc
    limit 1
  ),
  '["win", "draw", "loss"]'::jsonb,
  'the standing snapshot freezes the last three results in chronological order'
);
select is(
  (
    select snapshot.snapshot_data_json #>>
      '{sport,selection,team,externalId}'
    from public.dynamic_slide_snapshots snapshot
    join public.dynamic_slides slide
      on slide.id = snapshot.dynamic_slide_id
    where slide.name = 'Bekerprogramma Testclub 1'
    order by snapshot.created_at desc
    limit 1
  ),
  '10',
  'the immutable snapshot freezes the selected team identity'
);
select is(
  (
    select snapshot.snapshot_data_json #>>
      '{sport,selection,competition,externalId}'
    from public.dynamic_slide_snapshots snapshot
    join public.dynamic_slides slide
      on slide.id = snapshot.dynamic_slide_id
    where slide.name = 'Bekerprogramma Testclub 1'
    order by snapshot.created_at desc
    limit 1
  ),
  'competition-b',
  'the immutable snapshot freezes the selected competition context'
);
select is(
  (
    select jsonb_array_length(
      snapshot.snapshot_data_json #> '{sport,items}'
    )
    from public.dynamic_slide_snapshots snapshot
    join public.dynamic_slides slide
      on slide.id = snapshot.dynamic_slide_id
    where slide.name = 'Bekerprogramma Testclub 1'
    order by snapshot.created_at desc
    limit 1
  ),
  1,
  'snapshot filtering happens before the configured item limit'
);
select is(
  (
    select snapshot.snapshot_data_json #>>
      '{sport,items,0,id}'
    from public.dynamic_slide_snapshots snapshot
    join public.dynamic_slides slide
      on slide.id = snapshot.dynamic_slide_id
    where slide.name = 'Bekerprogramma Testclub 1'
    order by snapshot.created_at desc
    limit 1
  ),
  'match-cup',
  'only the selected team and competition match is frozen'
);
select throws_ok(
  $$select public.create_dynamic_slide_v1(
    '10000000-0000-4000-8000-000000000b01',
    'Ongeldig team',
    (
      select version.id
      from public.dynamic_template_versions version
      join public.dynamic_templates template
        on template.id = version.template_id
      where template.slug = 'editorial-arena-programma-dark-landscape'
        and version.status = 'published'
    ),
    (
      select connection.data_source_id
      from public.sportlink_connections connection
      limit 1
    ),
    'latest',
    '{"sportTeamExternalId":"tenant-b-team"}'::jsonb
  )$$,
  '23514',
  null,
  'an unavailable or cross-tenant team identity is rejected server-side'
);

reset role;
select set_config(
  'test.sportlink_source_revision_before',
  (
    select source.revision::text
    from public.dynamic_data_sources source
    join public.sportlink_connections connection
      on connection.data_source_id = source.id
    limit 1
  ),
  true
);
select set_config(
  'test.sportlink_snapshot_count_before',
  (select count(*)::text from public.dynamic_slide_snapshots),
  true
);
select set_config(
  'test.sportlink_render_count_before',
  (select count(*)::text from public.dynamic_render_jobs),
  true
);
update public.sportlink_sync_policies
set enabled = (dataset_group = 'matches'),
    next_sync_at = now();

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select is(
  (select count(*) from public.claim_due_sportlink_sync_v1(
    'worker:sportlink-content-check',
    900
  )),
  1::bigint,
  'a later Sportlink content check claims one due dataset'
);
reset role;
select set_config(
  'test.sportlink_content_check_run_id',
  (
    select id::text
    from public.sportlink_sync_runs
    where status = 'running'
    order by started_at desc
    limit 1
  ),
  true
);
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select lives_ok(
  $$select public.complete_sportlink_sync_v1(
    current_setting('test.sportlink_content_check_run_id')::uuid,
    'worker:sportlink-content-check',
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
  )$$,
  'an unchanged Sportlink content check completes normally'
);

reset role;
select is(
  (
    select source.revision
    from public.dynamic_data_sources source
    join public.sportlink_connections connection
      on connection.data_source_id = source.id
    limit 1
  ),
  current_setting('test.sportlink_source_revision_before')::bigint + 1,
  'a successful Sportlink check advances exactly one source revision'
);
select is(
  (select count(*) from public.dynamic_slide_snapshots),
  current_setting('test.sportlink_snapshot_count_before')::bigint,
  'unchanged Sportlink data creates no extra dynamic snapshot'
);
select is(
  (select count(*) from public.dynamic_render_jobs),
  current_setting('test.sportlink_render_count_before')::bigint,
  'unchanged Sportlink data creates no extra fallback render'
);

set local role anon;
select is((select count(*) from public.sportlink_connections),0::bigint,
  'anonymous cannot read Sportlink connections');
select * from finish();
rollback;
