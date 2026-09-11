begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(89);

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
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000b01',true);
select lives_ok($$select public.upsert_sportlink_connection_v1(
  '10000000-0000-4000-8000-000000000b01','Sportlink · Testclub','Testclub',
  '1234','encrypted-value','initialization-vector','authentication-tag')$$,
  'tenant owner can store an already encrypted tested connection');
select is((select count(*) from public.sportlink_connections),1::bigint,
  'owner reads the own connection');
select is((select count(*) from public.sportlink_sync_policies),8::bigint,
  'exactly one policy per dataset group is initialized');
select is((select frequency from public.sportlink_sync_policies
  where dataset_group='club_profile'),'daily',
  'the tenant logo and club profile are checked daily');
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
select ok(not has_function_privilege(
  'authenticated',
  'public.complete_sportlink_sync_v3(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)',
  'execute'
), 'browser roles cannot execute the Sportlink standing-logo completion RPC');

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
insert into public.sportlink_sync_runs(
  id, tenant_id, connection_id, dataset_group, status, worker_id, locked_at
) values (
  '40000000-0000-4000-8000-000000000b11',
  '10000000-0000-4000-8000-000000000b01',
  (select id from public.sportlink_connections limit 1),
  'competitions',
  'running',
  'worker:sportlink-team-logo',
  now()
);
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select lives_ok(
  $$select public.complete_sportlink_sync_v3(
    '40000000-0000-4000-8000-000000000b11',
    'worker:sportlink-team-logo',
    '{}'::jsonb,
    '{}'::jsonb,
    '[{
      "assetId":"50000000-0000-5000-8000-000000000b11",
      "checksumSha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "fileSizeBytes":6789,
      "height":256,
      "mimeType":"image/webp",
      "role":"team_logo",
      "sourceUrl":"https://cdn.sportlink.com/logo/testclub.png",
      "storagePath":"tenants/10000000-0000-4000-8000-000000000b01/assets/50000000-0000-5000-8000-000000000b11/sportlink-team-logo.webp",
      "title":"Testclub 1 teamlogo",
      "width":256
    }]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[{
      "externalId":"standing-logo-import",
      "periodNumber":null,
      "pool":{"externalId":"799","name":"Logo poule"},
      "rows":[{
        "externalId":"logo-team",
        "logoUrl":"https://cdn.sportlink.com/logo/testclub.png",
        "teamName":"Testclub logo"
      }],
      "scoresPublished":true
    }]'::jsonb
  )$$,
  'the service worker completes a standing with a canonical local team logo'
);
reset role;
select is((
  select count(*)
  from public.media_assets
  where id = '50000000-0000-5000-8000-000000000b11'
    and tenant_id = '10000000-0000-4000-8000-000000000b01'
    and status = 'ready'
), 1::bigint, 'the standing team logo is a ready tenant-owned media asset');
select is((
  select row ->> 'logoMediaAssetId'
  from public.sports_standings standing
  cross join lateral jsonb_array_elements(standing.rows_json) row
  where standing.external_id = 'standing-logo-import'
  limit 1
), '50000000-0000-5000-8000-000000000b11',
  'the normalized standing row references the local team logo');
select is((
  select row ->> 'logoUrl'
  from public.sports_standings standing
  cross join lateral jsonb_array_elements(standing.rows_json) row
  where standing.external_id = 'standing-logo-import'
  limit 1
), null, 'the provider logo URL is not persisted into the player dataset');

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

insert into public.sports_teams(
  tenant_id, source_connection_id, external_id, name, metadata
) values (
  '10000000-0000-4000-8000-000000000b01',
  current_setting('test.sportlink_connection_id')::uuid,
  '20', 'Testclub 2',
  '{"competitionOptions":[{"externalId":"competition-a","name":"Reguliere competitie","period":"Fase 1","poolExternalId":"701","poolName":"Poule A"}]}'::jsonb
);

insert into public.sports_matches(
  tenant_id, source_connection_id, external_id, starts_at, status,
  home_team, away_team, competition, pool, venue, dressing_rooms, officials,
  scores_published, is_home_match
) values
(
  '10000000-0000-4000-8000-000000000b01',
  current_setting('test.sportlink_connection_id')::uuid,
  'arrival-selected-10', now() + interval '45 minutes', 'scheduled',
  '{"externalId":"10","name":"Testclub 1"}',
  '{"externalId":"arrival-away-10","name":"Bezoekers A"}',
  '{"externalId":"competition-a","name":"Reguliere competitie","period":"Fase 1"}',
  '{"externalId":"701","name":"Poule A"}',
  '{"field":"Veld 1"}', '{"away":"Kleedkamer 4","official":"Bestuurskamer"}',
  '[{"displayName":"Scheidsrechter A"}]', false, true
),
(
  '10000000-0000-4000-8000-000000000b01',
  current_setting('test.sportlink_connection_id')::uuid,
  'arrival-selected-20', now() + interval '55 minutes', 'scheduled',
  '{"externalId":"20","name":"Testclub 2"}',
  '{"externalId":"arrival-away-20","name":"Bezoekers B"}',
  '{"externalId":"competition-a","name":"Reguliere competitie","period":"Fase 1"}',
  '{"externalId":"701","name":"Poule A"}',
  '{"field":"Veld 2"}', '{"away":"Kleedkamer 6","official":"Bestuurskamer"}',
  '[{"displayName":"Scheidsrechter B"}]', false, true
),
(
  '10000000-0000-4000-8000-000000000b01',
  current_setting('test.sportlink_connection_id')::uuid,
  'arrival-later-competition-10', now() + interval '75 minutes', 'scheduled',
  '{"externalId":"10","name":"Testclub 1"}',
  '{"externalId":"arrival-away-cup-10","name":"Bekerbezoekers"}',
  '{"externalId":"competition-b","name":"Districtsbeker","period":"Groep 3"}',
  '{"externalId":"702","name":"Poule B"}',
  '{"field":"Veld 4"}', '{"away":"Kleedkamer 9","official":"Bestuurskamer"}',
  '[{"displayName":"Scheidsrechter beker"}]', false, true
),
(
  '10000000-0000-4000-8000-000000000b01',
  current_setting('test.sportlink_connection_id')::uuid,
  'arrival-pinned-other-competition-20', now() + interval '70 minutes', 'scheduled',
  '{"externalId":"20","name":"Testclub 2"}',
  '{"externalId":"arrival-away-cup-20","name":"Andere bekerbezoekers"}',
  '{"externalId":"competition-b","name":"Districtsbeker","period":"Groep 3"}',
  '{"externalId":"702","name":"Poule B"}',
  '{"field":"Veld 5"}', '{"away":"Kleedkamer 10","official":"Bestuurskamer"}',
  '[{"displayName":"Scheidsrechter andere competitie"}]', false, true
),
(
  '10000000-0000-4000-8000-000000000b01',
  current_setting('test.sportlink_connection_id')::uuid,
  'arrival-not-selected', now() + interval '65 minutes', 'scheduled',
  '{"externalId":"30","name":"Niet geselecteerd"}',
  '{"externalId":"arrival-away-30","name":"Bezoekers buiten selectie"}',
  '{"externalId":"competition-c","name":"Andere competitie","period":"Fase 1"}',
  '{"externalId":"703","name":"Poule C"}',
  '{"field":"Veld 3"}', '{"away":"Kleedkamer 8","official":"Bestuurskamer"}',
  '[{"displayName":"Scheidsrechter buiten selectie"}]', false, true
);

select set_config(
  'test.s146_arrival_drafts',
  (
    with blueprints(blueprint_key, slide_type, slide_name, slide_title) as (
      values
        ('sportlink.visitor_arrivals', 'sport_visitor_arrivals',
          'Welkom bezoekers gekoppeld', 'Bezoekers welkom'),
        ('sportlink.referee_arrivals', 'sport_referee_arrivals',
          'Welkom scheidsrechters gekoppeld', 'Scheidsrechters welkom')
    )
    select jsonb_agg(jsonb_build_object(
      'blueprintKey', blueprint.blueprint_key,
      'context', jsonb_build_object(
        'competitionId', null,
        'competitionSelectionMode', 'auto_current',
        'phaseId', null,
        'poolId', null,
        'providerTeamId', '10',
        'seasonId', null
      ),
      'teamContexts', jsonb_build_array(
        jsonb_build_object(
          'competitionId', null,
          'competitionSelectionMode', 'auto_current',
          'phaseId', null,
          'poolId', null,
          'providerTeamId', '10',
          'seasonId', null
        ),
        jsonb_build_object(
          'competitionId', 'competition-a',
          'competitionSelectionMode', 'pinned',
          'phaseId', 'Fase 1',
          'poolId', '701',
          'providerTeamId', '20',
          'seasonId', null
        )
      ),
      'arrival', jsonb_build_object(
        'cardCount', 4,
        'emptyBehavior', 'skip',
        'minutesBefore', 90,
        'minutesAfter', 30
      ),
      'display', jsonb_build_object(
        'columns', 'two', 'showDressingRoom', true, 'showField', true,
        'showHomeAway', true, 'showReferee', true
      ),
      'name', blueprint.slide_name,
      'orientation', 'landscape',
      'templateVersionId', (
        select template.current_published_version_id
        from public.dynamic_templates template
        where template.slide_type = blueprint.slide_type
          and template.orientation = 'landscape'
          and template.status = 'published'
        limit 1
      ),
      'themeSelection', jsonb_build_object(
        'ref', jsonb_build_object(
          'catalog', 'v2', 'id', 'fieldflow', 'version', '1.0.0'
        ),
        'modePolicy', jsonb_build_object('kind', 'fixed', 'mode', 'light'),
        'accent', null, 'support', null, 'categoryOverrides', '[]'::jsonb
      ),
      'title', blueprint.slide_title
    ) order by blueprint.blueprint_key)::text
    from blueprints blueprint
  ),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000b01',true);
select is(
  (
    public.create_sportlink_slide_batch_v3(
      '10000000-0000-4000-8000-000000000b01',
      (select data_source_id from public.sportlink_connections limit 1),
      current_setting('test.s146_arrival_drafts')::jsonb,
      '60000000-0000-4000-8000-000000000b46'
    ) ->> 'count'
  )::integer,
  2,
  'two welcome purposes create two linked components rather than four team slides'
);
select is(
  (select count(*) from public.dynamic_slides
   where name in ('Welkom bezoekers gekoppeld', 'Welkom scheidsrechters gekoppeld')),
  2::bigint,
  'each selected welcome purpose is persisted exactly once'
);
select is(
  (select count(*) from public.dynamic_slide_versions
   where name in ('Welkom bezoekers gekoppeld', 'Welkom scheidsrechters gekoppeld')
     and jsonb_array_length(configuration_json -> 'teamContexts') = 2),
  2::bigint,
  'both linked welcome components retain the complete two-team selection'
);
select is(
  (select count(*) from public.dynamic_slide_versions
   where name in ('Welkom bezoekers gekoppeld', 'Welkom scheidsrechters gekoppeld')
     and configuration_json #>> '{teamContexts,0,competitionSelectionMode}' = 'auto_current'
     and configuration_json #>> '{teamContexts,1,competitionSelectionMode}' = 'pinned'),
  2::bigint,
  'current competition is the default while one team can be pinned independently'
);
select is(
  (select jsonb_array_length(snapshot.snapshot_data_json #> '{sport,items}')
   from public.dynamic_slide_snapshots snapshot
   join public.dynamic_slides slide on slide.id = snapshot.dynamic_slide_id
   where slide.name = 'Welkom bezoekers gekoppeld'
   order by snapshot.created_at desc limit 1),
  2,
  'the visitor component aggregates only arrivals for both selected teams'
);
select is(
  (select jsonb_array_length(snapshot.snapshot_data_json #> '{sport,items}')
   from public.dynamic_slide_snapshots snapshot
   join public.dynamic_slides slide on slide.id = snapshot.dynamic_slide_id
   where slide.name = 'Welkom scheidsrechters gekoppeld'
   order by snapshot.created_at desc limit 1),
  2,
  'the referee component aggregates officials for both selected teams'
);
select is(
  (select jsonb_agg(item ->> 'id' order by item ->> 'id')
   from public.dynamic_slide_snapshots snapshot
   join public.dynamic_slides slide on slide.id = snapshot.dynamic_slide_id
   cross join lateral jsonb_array_elements(snapshot.snapshot_data_json #> '{sport,items}') item
   where slide.name = 'Welkom bezoekers gekoppeld'),
  '["arrival-selected-10", "arrival-selected-20"]'::jsonb,
  'auto-current chooses the nearest competition and pinned selection excludes other competitions and teams'
);
select is(
  (select jsonb_agg(item ->> 'primary' order by item ->> 'primary')
   from public.dynamic_slide_snapshots snapshot
   join public.dynamic_slides slide on slide.id = snapshot.dynamic_slide_id
   cross join lateral jsonb_array_elements(snapshot.snapshot_data_json #> '{sport,items}') item
   where slide.name = 'Welkom scheidsrechters gekoppeld'),
  '["Scheidsrechter A", "Scheidsrechter B"]'::jsonb,
  'an unselected team never enters the referee component snapshot'
);
select is(
  (select (snapshot.snapshot_data_json #>> '{sport,selectedTeamCount}')::integer
   from public.dynamic_slide_snapshots snapshot
   join public.dynamic_slides slide on slide.id = snapshot.dynamic_slide_id
   where slide.name = 'Welkom bezoekers gekoppeld'
   order by snapshot.created_at desc limit 1),
  2,
  'the immutable snapshot records the selected-team count'
);
reset role;
update public.sports_matches
set officials = (
  select jsonb_agg(
    jsonb_build_object('displayName', 'Scheidsrechter ' || official_index)
    order by official_index
  )
  from generate_series(1, 45) official_index
)
where external_id = 'arrival-selected-10';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000b01',true);
select lives_ok(
  $$select set_config(
    'test.s146_referee_snapshot_id',
    public.refresh_dynamic_slide_v1(
      (select id from public.dynamic_slides
       where name = 'Welkom scheidsrechters gekoppeld')
    ) ->> 'snapshotId',
    true
  )$$,
  'the linked referee component refreshes after a large officials payload'
);
select is(
  (select jsonb_array_length(snapshot.snapshot_data_json #> '{sport,items}')
   from public.dynamic_slide_snapshots snapshot
   where snapshot.id = current_setting(
     'test.s146_referee_snapshot_id'
   )::uuid),
  40,
  'the linked referee component is capped at forty deterministic cards'
);
select is(
  (
    public.create_sportlink_slide_batch_v3(
      '10000000-0000-4000-8000-000000000b01',
      (select data_source_id from public.sportlink_connections limit 1),
      current_setting('test.s146_arrival_drafts')::jsonb,
      '60000000-0000-4000-8000-000000000b46'
    ) ->> 'count'
  )::integer,
  2,
  'retrying the same welcome batch returns the original result'
);
select is(
  (select count(*) from public.dynamic_slides
   where name in ('Welkom bezoekers gekoppeld', 'Welkom scheidsrechters gekoppeld')),
  2::bigint,
  'an idempotent retry creates no duplicate welcome components'
);
select throws_ok(
  $$select public.create_sportlink_slide_batch_v3(
    '10000000-0000-4000-8000-000000000b01',
    (select data_source_id from public.sportlink_connections limit 1),
    jsonb_set(
      current_setting('test.s146_arrival_drafts')::jsonb,
      '{0,title}',
      '"Gewijzigde titel"'::jsonb
    ),
    '60000000-0000-4000-8000-000000000b46'
  )$$,
  '22023', null,
  'an idempotency key cannot be replayed with a different request payload'
);
select throws_ok(
  $$select public.create_sportlink_slide_batch_v3(
    '10000000-0000-4000-8000-000000000b01',
    (select data_source_id from public.sportlink_connections limit 1),
    (
      current_setting('test.s146_arrival_drafts')::jsonb
        #- '{0,context,competitionSelectionMode}'
        #- '{0,teamContexts,0,competitionSelectionMode}'
    ),
    '60000000-0000-4000-8000-000000000b50'
  )$$,
  '22023', null,
  'every selected team requires an explicit competition selection mode'
);
select throws_ok(
  $$select public.create_sportlink_slide_batch_v3(
    '10000000-0000-4000-8000-000000000b01',
    (select data_source_id from public.sportlink_connections limit 1),
    jsonb_set(
      current_setting('test.s146_arrival_drafts')::jsonb,
      '{0,arrival,minutesBefore}',
      '999999999999999999999999999999999999'::jsonb
    ),
    '60000000-0000-4000-8000-000000000b53'
  )$$,
  '22023', null,
  'oversized numeric arrival input is rejected as a controlled validation error'
);
select throws_ok(
  $$select public.create_sportlink_slide_batch_v3(
    '10000000-0000-4000-8000-000000000b01',
    (select data_source_id from public.sportlink_connections limit 1),
    jsonb_set(
      current_setting('test.s146_arrival_drafts')::jsonb,
      '{0,teamContexts,1,providerTeamId}',
      '"10"'::jsonb
    ),
    '60000000-0000-4000-8000-000000000b51'
  )$$,
  '22023', null,
  'one linked welcome component cannot contain the same team twice'
);
select throws_ok(
  $$select public.create_sportlink_slide_batch_v3(
    '10000000-0000-4000-8000-000000000b01',
    (select data_source_id from public.sportlink_connections limit 1),
    jsonb_set(
      current_setting('test.s146_arrival_drafts')::jsonb,
      '{0,context,providerTeamId}',
      '"20"'::jsonb
    ),
    '60000000-0000-4000-8000-000000000b52'
  )$$,
  '22023', null,
  'the canonical context must stay equal to the first selected team'
);
select throws_ok(
  $$select public.create_sportlink_slide_batch_v3(
    '10000000-0000-4000-8000-000000000b01',
    (select data_source_id from public.sportlink_connections limit 1),
    jsonb_set(
      jsonb_set(
        current_setting('test.s146_arrival_drafts')::jsonb,
        '{0,context,providerTeamId}',
        '"tenant-b-team"'::jsonb
      ),
      '{0,teamContexts,0,providerTeamId}',
      '"tenant-b-team"'::jsonb
    ),
    '60000000-0000-4000-8000-000000000b47'
  )$$,
  '22023', null,
  'an unavailable team cannot enter a welcome selection'
);
select throws_ok(
  $$select public.create_sportlink_slide_batch_v3(
    '10000000-0000-4000-8000-000000000b01',
    (select data_source_id from public.sportlink_connections limit 1),
    jsonb_build_array(
      current_setting('test.s146_arrival_drafts')::jsonb -> 0,
      current_setting('test.s146_arrival_drafts')::jsonb -> 0
    ),
    '60000000-0000-4000-8000-000000000b48'
  )$$,
  '22023', null,
  'one batch cannot fan one welcome purpose out into duplicate team slides'
);
select throws_ok(
  $$select public.create_sportlink_slide_batch_v1(
    '10000000-0000-4000-8000-000000000b01',
    (select data_source_id from public.sportlink_connections limit 1),
    current_setting('test.s146_arrival_drafts')::jsonb,
    '60000000-0000-4000-8000-000000000b53'
  )$$,
  '22023', 'linked arrival components require Sportlink batch v3',
  'legacy Sportlink v1 cannot recreate one welcome slide per team'
);
select throws_ok(
  $$select public.create_sportlink_slide_batch_v2(
    '10000000-0000-4000-8000-000000000b01',
    (select data_source_id from public.sportlink_connections limit 1),
    current_setting('test.s146_arrival_drafts')::jsonb,
    '60000000-0000-4000-8000-000000000b54'
  )$$,
  '22023', 'linked arrival components require Sportlink batch v3',
  'legacy Sportlink v2 cannot recreate one welcome slide per team'
);

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000b02',true);
select throws_ok(
  $$select public.create_sportlink_slide_batch_v3(
    '10000000-0000-4000-8000-000000000b01',
    (select data_source_id from public.sportlink_connections limit 1),
    current_setting('test.s146_arrival_drafts')::jsonb,
    '60000000-0000-4000-8000-000000000b49'
  )$$,
  '42501', null,
  'another tenant cannot create or replay a linked welcome batch'
);
reset role;
select ok(
  not has_function_privilege(
    'anon',
    'public.create_sportlink_slide_batch_v3(uuid,uuid,jsonb,uuid)',
    'execute'
  ),
  'anonymous users cannot execute the linked welcome batch RPC'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.create_sportlink_slide_batch_v3(uuid,uuid,jsonb,uuid)',
    'execute'
  ),
  'the browser batch RPC is not exposed to the service role'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.sportlink_team_contexts_are_valid_v1(uuid,uuid,jsonb)',
    'execute'
  ),
  'authenticated users cannot call the private team validator directly'
);
select ok(
  not has_function_privilege(
    'service_role',
    'private.sportlink_team_contexts_are_valid_v1(uuid,uuid,jsonb)',
    'execute'
  ),
  'the private team validator is not exposed to the service role'
);
select throws_ok(
  $$update public.dynamic_slide_versions
    set configuration_json = jsonb_set(
      configuration_json,
      '{context,providerTeamId}',
      '"20"'::jsonb
    )
    where name = 'Welkom bezoekers gekoppeld'$$,
  '23514', null,
  'the persistence trigger rejects a primary context that diverges from the first selected team'
);
select throws_ok(
  $$update public.dynamic_slide_versions
    set configuration_json = configuration_json - 'teamContexts'
    where name = 'Welkom bezoekers gekoppeld'$$,
  '23514', null,
  'a linked welcome version cannot silently lose its aggregate team selection'
);
select is(
  (select count(*)
   from public.dynamic_slide_versions
   where name in ('Welkom bezoekers gekoppeld', 'Welkom scheidsrechters gekoppeld')
     and configuration_json -> 'context'
       is not distinct from configuration_json #> '{teamContexts,0}'),
  2::bigint,
  'rejected direct updates leave both linked welcome versions unchanged'
);

select set_config(
  'test.s146_arrival_configuration',
  (
    select configuration_json::text
    from public.dynamic_slide_versions
    where name = 'Welkom bezoekers gekoppeld'
  ),
  true
);
select set_config(
  'test.s146_arrival_status',
  (
    select status::text
    from public.dynamic_slide_versions
    where name = 'Welkom bezoekers gekoppeld'
  ),
  true
);
alter table public.dynamic_slide_versions
  disable trigger dynamic_slide_versions_validate_arrival_team_contexts;
update public.dynamic_slide_versions
set configuration_json = configuration_json - 'teamContexts'
where name = 'Welkom bezoekers gekoppeld';
alter table public.dynamic_slide_versions
  enable trigger dynamic_slide_versions_validate_arrival_team_contexts;

select throws_ok(
  $$update public.dynamic_slide_versions
    set status = 'publishing'
    where name = 'Welkom bezoekers gekoppeld'$$,
  '23514', null,
  'a legacy welcome draft cannot publish before its linked team selection is saved'
);
select is(
  (
    select status::text
    from public.dynamic_slide_versions
    where name = 'Welkom bezoekers gekoppeld'
  ),
  current_setting('test.s146_arrival_status'),
  'a rejected legacy publication leaves the existing version status unchanged'
);

update public.dynamic_slide_versions
set configuration_json =
  current_setting('test.s146_arrival_configuration')::jsonb
where name = 'Welkom bezoekers gekoppeld';

delete from public.sports_matches
where external_id in (
  'arrival-later-competition-10',
  'arrival-pinned-other-competition-20'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000b01',true);
select is(
  (
    with combinations(team_id, team_name, blueprint_key, slide_type, theme_id) as (
      values
        ('10', 'Testclub 1', 'sportlink.pool_schedule_next_7_days', 'sport_program', 'fieldflow'),
        ('10', 'Testclub 1', 'sportlink.pool_results_previous_7_days', 'sport_results', 'fieldflow'),
        ('10', 'Testclub 1', 'sportlink.pool_standings', 'sport_standing', 'fieldflow'),
        ('20', 'Testclub 2', 'sportlink.pool_schedule_next_7_days', 'sport_program', 'fieldflow'),
        ('20', 'Testclub 2', 'sportlink.pool_results_previous_7_days', 'sport_results', 'fieldflow'),
        ('20', 'Testclub 2', 'sportlink.pool_standings', 'sport_standing', 'fieldflow')
    ), drafts as (
      select jsonb_agg(jsonb_build_object(
        'blueprintKey', combination.blueprint_key,
        'context', jsonb_build_object(
          'competitionId', 'competition-a',
          'competitionSelectionMode', 'pinned',
          'phaseId', 'Fase 1',
          'poolId', '701',
          'providerTeamId', combination.team_id,
          'seasonId', '2026/2027'
        ),
        'display', jsonb_build_object(
          'columns', 'two', 'showDressingRoom', false, 'showField', true,
          'showHomeAway', true, 'showReferee', false
        ),
        'name', 'Bulk ' || combination.team_name || ' · ' || combination.blueprint_key,
        'orientation', 'landscape',
        'templateVersionId', (
          select template.current_published_version_id
          from public.dynamic_templates template
          where template.slide_type = combination.slide_type
            and template.orientation = 'landscape'
            and template.status = 'published'
          limit 1
        ),
        'themeSelection', jsonb_build_object(
          'ref', jsonb_build_object('catalog', 'v2', 'id', combination.theme_id, 'version', '1.0.0'),
          'modePolicy', jsonb_build_object('kind', 'fixed', 'mode', 'light'),
          'accent', null, 'support', null, 'categoryOverrides', '[]'::jsonb
        ),
        'title', combination.blueprint_key
      ) order by combination.team_id, combination.blueprint_key) as value
      from combinations combination
    )
    select (public.create_sportlink_slide_batch_v2(
      '10000000-0000-4000-8000-000000000b01',
      (select data_source_id from public.sportlink_connections limit 1),
      drafts.value,
      '60000000-0000-4000-8000-000000000b01'
    ) ->> 'count')::integer
    from drafts
  ),
  6,
  'two teams times three slide types atomically creates six logical slides'
);
select is(
  (select count(*) from public.dynamic_slide_versions
   where name like 'Bulk %'
     and theme_selection_json #>> '{ref,id}' = 'fieldflow'),
  6::bigint,
  'the bulk authoring path applies FieldFlow to every slide'
);
select is(
  (select count(*) from public.dynamic_slide_versions
   where name like 'Bulk %'
     and theme_selection_json #>> '{ref,id}' in ('editorial', 'obsidian', 'atelier')),
  0::bigint,
  'the bulk authoring path cannot persist a hidden legacy theme'
);
select is(
  (select count(*)
   from public.dynamic_slide_snapshots snapshot
   join public.dynamic_slides slide on slide.id = snapshot.dynamic_slide_id
   join public.dynamic_slide_versions version
     on version.id = snapshot.dynamic_slide_version_id
   where slide.name like 'Bulk %'
     and snapshot.snapshot_data_json #>> '{themePresentation,selection,ref,id}' =
       version.theme_selection_json #>> '{ref,id}'),
  6::bigint,
  'every typed Sportlink snapshot freezes the selected version theme for Player rendering'
);
reset role;
update public.dynamic_slides
set status = 'archived'
where name like 'Bulk %';

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
    "logoMediaAssetId":"50000000-0000-5000-8000-000000000b11",
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
      '{sport,items,0,logoMediaAssetId}'
    from public.dynamic_slide_snapshots snapshot
    join public.dynamic_slides slide
      on slide.id = snapshot.dynamic_slide_id
    where slide.name = 'Portraitstand Testclub 1'
    order by snapshot.created_at desc
    limit 1
  ),
  '50000000-0000-5000-8000-000000000b11',
  'the immutable standing snapshot includes the cached row logo'
);
select is(
  (
    select snapshot.snapshot_data_json #>>
      '{brand,logoMediaAssetId}'
    from public.dynamic_slide_snapshots snapshot
    join public.dynamic_slides slide
      on slide.id = snapshot.dynamic_slide_id
    where slide.name = 'Portraitstand Testclub 1'
    order by snapshot.created_at desc
    limit 1
  ),
  '50000000-0000-5000-8000-000000000b10',
  'the immutable snapshot prefers the official club logo in the masthead'
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
  (
    select count(*)::text
    from public.dynamic_slide_snapshots snapshot
    join public.dynamic_slides slide
      on slide.id = snapshot.dynamic_slide_id
    where slide.name = 'Bekerprogramma Testclub 1'
  ),
  true
);
select set_config(
  'test.sportlink_render_count_before',
  (
    select count(*)::text
    from public.dynamic_render_jobs job
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = job.snapshot_id
    join public.dynamic_slides slide
      on slide.id = snapshot.dynamic_slide_id
    where slide.name = 'Bekerprogramma Testclub 1'
  ),
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
  (
    select count(*)
    from public.dynamic_slide_snapshots snapshot
    join public.dynamic_slides slide
      on slide.id = snapshot.dynamic_slide_id
    where slide.name = 'Bekerprogramma Testclub 1'
  ),
  current_setting('test.sportlink_snapshot_count_before')::bigint,
  'unchanged Sportlink data creates no extra snapshot for the selected slide'
);
select is(
  (
    select count(*)
    from public.dynamic_render_jobs job
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = job.snapshot_id
    join public.dynamic_slides slide
      on slide.id = snapshot.dynamic_slide_id
    where slide.name = 'Bekerprogramma Testclub 1'
  ),
  current_setting('test.sportlink_render_count_before')::bigint,
  'unchanged Sportlink data creates no extra render for the selected slide'
);

set local role anon;
select is((select count(*) from public.sportlink_connections),0::bigint,
  'anonymous cannot read Sportlink connections');
select * from finish();
rollback;
