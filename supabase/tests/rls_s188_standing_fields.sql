begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-4000-8000-000000001881',
  'authenticated',
  'authenticated',
  's188-owner@veyocast.test',
  'test',
  now(),
  now(),
  now(),
  '{}'::jsonb,
  '{}'::jsonb
);

insert into public.profiles (id, display_name) values (
  '00000000-0000-4000-8000-000000001881',
  'S188 owner'
);

insert into public.tenants (id, name, slug) values (
  '10000000-0000-4000-8000-000000001881',
  'S188 tenant',
  's188-tenant'
);

insert into public.tenant_settings (tenant_id) values (
  '10000000-0000-4000-8000-000000001881'
);

insert into public.tenant_memberships (tenant_id, user_id, role) values (
  '10000000-0000-4000-8000-000000001881',
  '00000000-0000-4000-8000-000000001881',
  'tenant_owner'
);

create temporary table s188_source (
  tenant_id uuid not null,
  connection_id uuid not null,
  data_source_id uuid not null
);
grant select on s188_source to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001881',
  true
);

select public.upsert_sportlink_connection_v1(
  '10000000-0000-4000-8000-000000001881',
  'Sportlink · S188',
  'S188',
  '1881',
  'encrypted-value',
  'initialization-vector',
  'authentication-tag'
);

reset role;

insert into s188_source (tenant_id, connection_id, data_source_id)
select connection.tenant_id, connection.id, connection.data_source_id
from public.sportlink_connections connection
join public.dynamic_data_sources source
  on source.tenant_id = connection.tenant_id
 and source.id = connection.data_source_id
where connection.tenant_id = '10000000-0000-4000-8000-000000001881'
  and source.name = 'Sportlink · S188';

insert into public.sports_teams (
  tenant_id,
  source_connection_id,
  external_id,
  name,
  metadata
)
select
  tenant_id,
  connection_id,
  'team-1',
  'Testclub 1',
  '{"competitionOptions":[{"externalId":"league","poolExternalId":"pool-1","period":"competition","season":"2026"}]}'::jsonb
from s188_source;

insert into public.sports_matches (
  tenant_id,
  source_connection_id,
  external_id,
  starts_at,
  status,
  home_team,
  away_team,
  competition,
  pool,
  scores_published,
  active
)
select
  tenant_id,
  connection_id,
  fixture.id,
  now() - fixture.age,
  'finished',
  fixture.home_team,
  fixture.away_team,
  '{"externalId":"league","name":"Vierde klasse","period":"competition","season":"2026"}'::jsonb,
  '{"externalId":"pool-1","competitionExternalId":"league","name":"4C"}'::jsonb,
  true,
  true
from s188_source
cross join (values
  (
    'standing-win',
    interval '3 days',
    '{"externalId":"team-1","name":"Testclub 1","score":2}'::jsonb,
    '{"externalId":"opponent-1","name":"Tegenstander 1","score":0}'::jsonb
  ),
  (
    'standing-draw',
    interval '2 days',
    '{"externalId":"opponent-2","name":"Tegenstander 2","score":1}'::jsonb,
    '{"externalId":"team-1","name":"Testclub 1","score":1}'::jsonb
  ),
  (
    'standing-loss',
    interval '1 day',
    '{"externalId":"team-1","name":"Testclub 1","score":0}'::jsonb,
    '{"externalId":"opponent-3","name":"Tegenstander 3","score":2}'::jsonb
  )
) fixture(id, age, home_team, away_team);

insert into public.sports_standings (
  tenant_id,
  source_connection_id,
  external_id,
  pool_external_id,
  season_key,
  rows_json,
  metadata,
  scores_published,
  active,
  last_synced_at
)
select
  tenant_id,
  connection_id,
  'standing-1',
  'pool-1',
  '2026',
  '[
    {
      "externalId":"team-1",
      "teamName":"Testclub 1",
      "position":1,
      "won":1,
      "drawn":1,
      "lost":1,
      "goalsFor":3,
      "goalsAgainst":3,
      "points":4,
      "logoMediaAssetId":"50000000-0000-5000-8000-000000001881"
    },
    {
      "externalId":"opponent-1",
      "teamName":"Tegenstander 1",
      "position":2,
      "played":8,
      "won":2,
      "drawn":2,
      "lost":4,
      "points":8,
      "form":["loss","win","draw"],
      "logoMediaAssetId":"50000000-0000-5000-8000-000000001882"
    }
  ]'::jsonb,
  '{
    "competition":{"externalId":"league","name":"Vierde klasse","period":"competition","season":"2026"},
    "pool":{"externalId":"pool-1","name":"4C"}
  }'::jsonb,
  true,
  true,
  now()
from s188_source;

create function pg_temp.s188_snapshot()
returns jsonb
language sql
stable
as $$
  select private.build_dynamic_snapshot_data(
    jsonb_populate_record(
      null::public.dynamic_slides,
      jsonb_build_object(
        'id', '20000000-0000-4000-8000-000000001881',
        'tenant_id', source.tenant_id,
        'data_source_id', source.data_source_id,
        'name', 'Stand',
        'slide_type', 'sport_standing',
        'orientation', 'landscape',
        'selection_mode', 'latest',
        'template_id', template.id,
        'template_version_id', template.current_published_version_id,
        'configuration_json', jsonb_build_object(
          'blueprintKey', 'sportlink.pool_standings',
          'title', 'Stand',
          'context', jsonb_build_object(
            'providerTeamId', 'team-1',
            'competitionSelectionMode', 'auto_current',
            'competitionId', null,
            'poolId', null,
            'phaseId', null,
            'seasonId', null
          )
        )
      )
    )
  )
  from s188_source source
  cross join lateral (
    select candidate.*
    from public.dynamic_templates candidate
    where candidate.slide_type = 'sport_standing'
      and candidate.status = 'published'
      and candidate.orientation = 'landscape'
    order by candidate.slug
    limit 1
  ) template
$$;

select is(
  pg_temp.s188_snapshot() #>> '{sport,items,0,logoMediaAssetId}',
  '50000000-0000-5000-8000-000000001881',
  'pool standing snapshot restores the team logo asset'
);
select is(
  pg_temp.s188_snapshot() #>> '{sport,items,0,played}',
  '3',
  'pool standing snapshot derives played from W/G/V when absent'
);
select is(
  pg_temp.s188_snapshot() #> '{sport,items,0,form}',
  '["win","draw","loss"]'::jsonb,
  'pool standing snapshot derives the last three published results'
);
select is(
  pg_temp.s188_snapshot() #>> '{sport,items,1,played}',
  '8',
  'pool standing snapshot retains the provider played total'
);
select is(
  pg_temp.s188_snapshot() #> '{sport,items,1,form}',
  '["loss","win","draw"]'::jsonb,
  'pool standing snapshot retains provider form'
);
select is(
  pg_temp.s188_snapshot() #>> '{sport,items,1,logoMediaAssetId}',
  '50000000-0000-5000-8000-000000001882',
  'pool standing snapshot retains every row logo'
);

select ok(
  not has_function_privilege(
    'anon',
    'private.build_dynamic_snapshot_data(public.dynamic_slides)',
    'execute'
  ),
  'anonymous users cannot call the snapshot builder'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.build_dynamic_snapshot_data_before_s188_standing_fields(public.dynamic_slides)',
    'execute'
  ),
  'Studio users cannot bypass the standing enrichment boundary'
);
select ok(
  not has_function_privilege(
    'service_role',
    'private.build_dynamic_snapshot_data_before_s188_standing_fields(public.dynamic_slides)',
    'execute'
  ),
  'the historical snapshot builder is not exposed as a service RPC'
);

select * from finish();
rollback;
