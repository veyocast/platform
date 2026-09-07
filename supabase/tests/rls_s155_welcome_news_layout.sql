begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(26);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  (
    '00000000-0000-4000-8000-000000001551',
    'authenticated', 'authenticated', 's155-owner-a@veyocast.test', 'test',
    now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000001552',
    'authenticated', 'authenticated', 's155-owner-b@veyocast.test', 'test',
    now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  );

insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-000000001551', 'S155 owner A'),
  ('00000000-0000-4000-8000-000000001552', 'S155 owner B');

insert into public.tenants (id, name, slug) values
  ('10000000-0000-4000-8000-000000001551', 'S155 tenant A', 's155-tenant-a'),
  ('10000000-0000-4000-8000-000000001552', 'S155 tenant B', 's155-tenant-b');

insert into public.tenant_settings (tenant_id) values
  ('10000000-0000-4000-8000-000000001551'),
  ('10000000-0000-4000-8000-000000001552');

insert into public.tenant_memberships (tenant_id, user_id, role) values
  (
    '10000000-0000-4000-8000-000000001551',
    '00000000-0000-4000-8000-000000001551',
    'tenant_owner'
  ),
  (
    '10000000-0000-4000-8000-000000001552',
    '00000000-0000-4000-8000-000000001552',
    'tenant_owner'
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001551',
  true
);

select lives_ok(
  $$select public.upsert_sportlink_connection_v1(
    '10000000-0000-4000-8000-000000001551',
    'Sportlink · S155 tenant A',
    'S155 tenant A',
    '1551',
    'encrypted-value',
    'initialization-vector',
    'authentication-tag'
  )$$,
  'tenant A owner creates the encrypted Sportlink connection'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001552',
  true
);

select lives_ok(
  $$select public.upsert_sportlink_connection_v1(
    '10000000-0000-4000-8000-000000001552',
    'Sportlink · S155 tenant B',
    'S155 tenant B',
    '1552',
    'encrypted-value',
    'initialization-vector',
    'authentication-tag'
  )$$,
  'tenant B owner creates an isolated Sportlink connection'
);

reset role;

create temporary table s155_sources as
select
  connection.tenant_id,
  connection.id as connection_id,
  connection.data_source_id
from public.sportlink_connections connection
where connection.tenant_id in (
  '10000000-0000-4000-8000-000000001551',
  '10000000-0000-4000-8000-000000001552'
);
grant select on s155_sources to authenticated;

insert into public.sports_teams (
  tenant_id, source_connection_id, external_id, name, active
) values
  (
    '10000000-0000-4000-8000-000000001551',
    (select connection_id from s155_sources
     where tenant_id = '10000000-0000-4000-8000-000000001551'),
    's155-own-team',
    'Duindorp SV 1',
    true
  ),
  (
    '10000000-0000-4000-8000-000000001552',
    (select connection_id from s155_sources
     where tenant_id = '10000000-0000-4000-8000-000000001552'),
    's155-own-team',
    'Tenant B 1',
    true
  );

insert into public.sports_matches (
  tenant_id, source_connection_id, external_id, starts_at, status,
  home_team, away_team, competition, pool, venue, dressing_rooms, officials,
  scores_published, is_home_match, active
) values
  (
    '10000000-0000-4000-8000-000000001551',
    (select connection_id from s155_sources
     where tenant_id = '10000000-0000-4000-8000-000000001551'),
    's155-shared-fixture',
    statement_timestamp() + interval '15 minutes',
    'scheduled',
    '{"externalId":"s155-own-team","name":"Duindorp SV 1"}',
    '{"externalId":"s155-visitors","name":"Bezoekers FC 1"}',
    '{"externalId":"s155-competition","name":"S155 competitie"}',
    '{"externalId":"s155-pool","name":"S155 poule"}',
    '{"name":"Sportpark Houtrust","field":"Veld 1"}',
    '{"home":"Kleedkamer 4","away":"Kleedkamer: 2"}',
    '[]',
    false,
    true,
    true
  ),
  (
    '10000000-0000-4000-8000-000000001551',
    (select connection_id from s155_sources
     where tenant_id = '10000000-0000-4000-8000-000000001551'),
    's155-away-fixture',
    statement_timestamp() + interval '20 minutes',
    'scheduled',
    '{"externalId":"s155-opponent","name":"Andere club"}',
    '{"externalId":"s155-own-team","name":"Duindorp SV 1"}',
    '{"externalId":"s155-competition","name":"S155 competitie"}',
    '{"externalId":"s155-pool","name":"S155 poule"}',
    '{"name":"Uitpark","field":"Veld 9"}',
    '{"home":"1","away":"9"}',
    '[]',
    false,
    false,
    true
  ),
  (
    '10000000-0000-4000-8000-000000001551',
    (select connection_id from s155_sources
     where tenant_id = '10000000-0000-4000-8000-000000001551'),
    's155-foreign-fixture',
    statement_timestamp() + interval '25 minutes',
    'scheduled',
    '{"externalId":"s155-foreign-home","name":"Vreemde thuisclub"}',
    '{"externalId":"s155-foreign-away","name":"Vreemde uitclub"}',
    '{"externalId":"s155-competition","name":"S155 competitie"}',
    '{"externalId":"s155-pool","name":"S155 poule"}',
    '{"name":"Vreemd sportpark","field":"Veld 8"}',
    '{"home":"8","away":"7"}',
    '[]',
    false,
    true,
    true
  ),
  (
    -- The same fixture ID in another tenant must never win the S155 lookup.
    '10000000-0000-4000-8000-000000001552',
    (select connection_id from s155_sources
     where tenant_id = '10000000-0000-4000-8000-000000001552'),
    's155-shared-fixture',
    statement_timestamp() + interval '10 minutes',
    'scheduled',
    '{"externalId":"s155-own-team","name":"Tenant B 1"}',
    '{"externalId":"s155-tenant-b-away","name":"Tenant B bezoekers"}',
    '{"externalId":"s155-competition","name":"S155 competitie"}',
    '{"externalId":"s155-pool","name":"S155 poule"}',
    '{"name":"VERKEERDE TENANT","field":"Veld 99"}',
    '{"home":"99","away":"98"}',
    '[]',
    false,
    true,
    true
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001551',
  true
);

select lives_ok(
  $$select public.create_dynamic_slide_v1(
    '10000000-0000-4000-8000-000000001551',
    'S155 bezoekerswelkomst',
    (
      select template.current_published_version_id
      from public.dynamic_templates template
      where template.slide_type = 'sport_visitor_arrivals'
        and template.orientation = 'landscape'
        and template.status = 'published'
      order by template.slug
      limit 1
    ),
    (
      select data_source_id
      from s155_sources
      where tenant_id = '10000000-0000-4000-8000-000000001551'
    ),
    'latest',
    '{
      "blueprintKey":"sportlink.visitor_arrivals",
      "title":"Welkom bezoekende teams",
      "context":{
        "competitionId":null,
        "competitionSelectionMode":"auto_current",
        "phaseId":null,
        "poolId":null,
        "providerTeamId":"s155-own-team",
        "seasonId":null
      },
      "teamContexts":[{
        "competitionId":null,
        "competitionSelectionMode":"auto_current",
        "phaseId":null,
        "poolId":null,
        "providerTeamId":"s155-own-team",
        "seasonId":null
      }],
      "arrival":{
        "cardCount":2,
        "emptyBehavior":"skip",
        "minutesBefore":90,
        "minutesAfter":30,
        "showClubLogo":false
      }
    }'
  )$$,
  'tenant A creates one visitor-welcome slide'
);

reset role;

create temporary table s155_snapshot as
select private.build_dynamic_snapshot_data(slide) as payload
from public.dynamic_slides slide
where slide.tenant_id = '10000000-0000-4000-8000-000000001551'
  and slide.name = 'S155 bezoekerswelkomst';

select is(
  (select pg_catalog.jsonb_array_length(payload #> '{sport,items}')
   from s155_snapshot),
  1,
  'only one exact tenant-owned home fixture reaches the welcome payload'
);

select is(
  (select payload #>> '{sport,items,0,id}' from s155_snapshot),
  's155-shared-fixture',
  'the selected fixture keeps its stable provider ID'
);

select is(
  (select payload #>> '{sport,items,0,date}' from s155_snapshot),
  (
    select pg_catalog.to_char(
      fixture.starts_at at time zone connection.timezone,
      'DD-MM-YYYY'
    )
    from public.sports_matches fixture
    join public.sportlink_connections connection
      on connection.id = fixture.source_connection_id
     and connection.tenant_id = fixture.tenant_id
    where fixture.tenant_id = '10000000-0000-4000-8000-000000001551'
      and fixture.external_id = 's155-shared-fixture'
  ),
  'the structured date uses the Sportlink source timezone'
);

select is(
  (select payload #>> '{sport,items,0,kickoffTime}' from s155_snapshot),
  (
    select pg_catalog.to_char(
      fixture.starts_at at time zone connection.timezone,
      'HH24:MI'
    )
    from public.sports_matches fixture
    join public.sportlink_connections connection
      on connection.id = fixture.source_connection_id
     and connection.tenant_id = fixture.tenant_id
    where fixture.tenant_id = '10000000-0000-4000-8000-000000001551'
      and fixture.external_id = 's155-shared-fixture'
  ),
  'the structured kickoff time uses the same timezone'
);

select is(
  (select payload #>> '{sport,items,0,homeTeam}' from s155_snapshot),
  'Duindorp SV 1',
  'the tenant home team is explicit'
);

select is(
  (select payload #>> '{sport,items,0,awayTeam}' from s155_snapshot),
  'Bezoekers FC 1',
  'the visiting team is explicit'
);

select is(
  (select payload #>> '{sport,items,0,homeRoom}' from s155_snapshot),
  '4',
  'the home dressing-room prefix is normalized once'
);

select is(
  (select payload #>> '{sport,items,0,awayRoom}' from s155_snapshot),
  '2',
  'the away dressing-room prefix is normalized once'
);

select is(
  (select payload #>> '{sport,items,0,field}' from s155_snapshot),
  '1',
  'the field prefix is normalized once'
);

select is(
  (select payload #>> '{sport,items,0,venueName}' from s155_snapshot),
  'Sportpark Houtrust',
  'the exact Sportlink accommodation name is frozen in the snapshot'
);

select is(
  (select payload #>> '{sport,items,0,primary}' from s155_snapshot),
  'Bezoekers FC 1',
  'the legacy primary field remains compatible'
);

select is(
  (select payload #>> '{sport,items,0,secondary}' from s155_snapshot),
  (
    select 'Aanvang: ' || pg_catalog.to_char(
        fixture.starts_at at time zone connection.timezone,
        'HH24:MI'
      ) || ' | Veld 1'
    from public.sports_matches fixture
    join public.sportlink_connections connection
      on connection.id = fixture.source_connection_id
     and connection.tenant_id = fixture.tenant_id
    where fixture.tenant_id = '10000000-0000-4000-8000-000000001551'
      and fixture.external_id = 's155-shared-fixture'
  ),
  'the legacy secondary field remains compatible'
);

select is(
  (select payload #>> '{sport,items,0,meta}' from s155_snapshot),
  'Kleedkamer: 2',
  'the legacy meta field remains compatible'
);

select is(
  (select payload #>> '{sport,items,0,dressingRoom}' from s155_snapshot),
  '2',
  'the legacy dressingRoom field mirrors the visiting room'
);

select is(
  (select (payload #>> '{sport,items,0,homeMatch}')::boolean
   from s155_snapshot),
  true,
  'the structured card keeps an explicit home-match marker'
);

select ok(
  (select not (payload #> '{sport,items}') @>
    '[{"id":"s155-away-fixture"}]'::jsonb from s155_snapshot),
  'an away fixture for the selected tenant team stays excluded'
);

select ok(
  (select not (payload #> '{sport,items}') @>
    '[{"id":"s155-foreign-fixture"}]'::jsonb from s155_snapshot),
  'a foreign-versus-foreign fixture stays excluded even with a home flag'
);

select ok(
  (select payload::text not like '%VERKEERDE TENANT%' from s155_snapshot),
  'the colliding fixture from another tenant cannot influence the payload'
);

select ok(
  (select payload::text not like '%https://%' from s155_snapshot),
  'no provider URL reaches the immutable Player payload'
);

select ok(
  not has_function_privilege(
    'anon',
    'private.build_dynamic_snapshot_data(public.dynamic_slides)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'private.build_dynamic_snapshot_data(public.dynamic_slides)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'private.build_dynamic_snapshot_data(public.dynamic_slides)',
    'EXECUTE'
  ),
  'the current snapshot builder is not Data API executable'
);

select ok(
  not has_function_privilege(
    'anon',
    'private.build_dynamic_snapshot_data_before_s155_welcome_news_layout(public.dynamic_slides)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'private.build_dynamic_snapshot_data_before_s155_welcome_news_layout(public.dynamic_slides)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'private.build_dynamic_snapshot_data_before_s155_welcome_news_layout(public.dynamic_slides)',
    'EXECUTE'
  ),
  'the predecessor snapshot builder remains private'
);

select ok(
  not has_function_privilege(
    'anon',
    'private.queue_visitor_welcome_snapshots_v1(uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'private.queue_visitor_welcome_snapshots_v1(uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'private.queue_visitor_welcome_snapshots_v1(uuid,uuid)',
    'EXECUTE'
  ),
  'the corrective published-version queue is not Data API executable'
);

select ok(
  (
    select procedure.prosecdef
      and procedure.provolatile = 's'
      and procedure.proconfig @> array['search_path=""']::text[]
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'private'
      and procedure.proname = 'build_dynamic_snapshot_data'
      and pg_catalog.pg_get_function_identity_arguments(procedure.oid) =
        'p_slide dynamic_slides'
  ),
  'the wrapper is a stable definer with an empty search path'
);

select * from finish();
rollback;
