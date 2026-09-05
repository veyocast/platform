begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(14);

insert into auth.users(
  id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,
  raw_app_meta_data,raw_user_meta_data
) values (
  '00000000-0000-4000-8000-000000001501','authenticated','authenticated',
  'welcome-layout-owner@test.invalid','x',now(),now(),now(),'{}','{}'
);
insert into public.profiles(id,display_name) values
  ('00000000-0000-4000-8000-000000001501','Welcome layout owner');
insert into public.tenants(id,name,slug) values
  ('10000000-0000-4000-8000-000000001501','Welcome layout tenant','welcome-layout-tenant');
insert into public.tenant_settings(tenant_id) values
  ('10000000-0000-4000-8000-000000001501');
insert into public.tenant_memberships(tenant_id,user_id,role) values
  ('10000000-0000-4000-8000-000000001501','00000000-0000-4000-8000-000000001501','tenant_owner');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001501',true);
select lives_ok($$select public.upsert_sportlink_connection_v1(
  '10000000-0000-4000-8000-000000001501','Sportlink · Welkom','Welkomclub',
  '1501','encrypted-value','initialization-vector','authentication-tag')$$,
  'owner creates the encrypted Sportlink connection');

reset role;
select set_config(
  'test.s150_connection_id',
  (select id::text from public.sportlink_connections
   where tenant_id='10000000-0000-4000-8000-000000001501'),
  true
);
select set_config(
  'test.s150_data_source_id',
  (select data_source_id::text from public.sportlink_connections
   where tenant_id='10000000-0000-4000-8000-000000001501'),
  true
);

insert into public.sports_teams(
  tenant_id,source_connection_id,external_id,name
) values (
  '10000000-0000-4000-8000-000000001501',
  current_setting('test.s150_connection_id')::uuid,
  'club-team-150','Welkomclub 1'
);

insert into public.provider_asset_cache(
  id,provider,entity_type,external_entity_id,asset_role
) values (
  '40000000-0000-4000-8000-000000001501',
  'sportlink','team','visitor-next','team_logo'
);
insert into public.provider_asset_versions(
  id,cache_id,checksum_sha256,storage_bucket,storage_path,mime_type,
  file_size_bytes,width,height
) values (
  '50000000-0000-5000-8000-000000001501',
  '40000000-0000-4000-8000-000000001501',repeat('b',64),
  'provider-assets','providers/sportlink/team_logo/'||repeat('b',64)||'.webp',
  'image/webp',4096,256,256
);
update public.provider_asset_cache
set current_version_id='50000000-0000-5000-8000-000000001501'
where id='40000000-0000-4000-8000-000000001501';

insert into public.sports_matches(
  tenant_id,source_connection_id,external_id,starts_at,status,
  home_team,away_team,venue,dressing_rooms,officials,is_home_match
) values
(
  '10000000-0000-4000-8000-000000001501',
  current_setting('test.s150_connection_id')::uuid,'fixture-recent',
  statement_timestamp()-interval '10 minutes','scheduled',
  '{"externalId":"club-team-150","name":"Welkomclub 1","score":null}',
  '{"externalId":"visitor-recent","name":"Recente FC 1","score":null}',
  '{"field":"Veld 3"}','{"away":"Kleedkamer 8"}','[]',true
),
(
  '10000000-0000-4000-8000-000000001501',
  current_setting('test.s150_connection_id')::uuid,'fixture-later',
  statement_timestamp()+interval '60 minutes','scheduled',
  '{"externalId":"club-team-150","name":"Welkomclub 1","score":null}',
  '{"externalId":"visitor-later","name":"Later VV O17-2","score":null}',
  '{"field":"veld 2"}','{"away":"6"}','[]',true
),
(
  '10000000-0000-4000-8000-000000001501',
  current_setting('test.s150_connection_id')::uuid,'fixture-next',
  statement_timestamp()+interval '15 minutes','scheduled',
  '{"externalId":"club-team-150","name":"Welkomclub 1","score":null}',
  '{"externalId":"visitor-next","name":"Eerstvolgende SV JO17-1","score":null}',
  '{"field":"Veld 1"}','{"away":"Kleedkamer 2"}','[]',true
),
(
  '10000000-0000-4000-8000-000000001501',
  current_setting('test.s150_connection_id')::uuid,'fixture-away',
  statement_timestamp()+interval '20 minutes','scheduled',
  '{"externalId":"other-team","name":"Andere club","score":null}',
  '{"externalId":"club-team-150","name":"Welkomclub 1","score":null}',
  '{"field":"Veld 9"}','{"away":"9"}','[]',false
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001501',true);
select lives_ok($$select public.create_dynamic_slide_v1(
  '10000000-0000-4000-8000-000000001501','Welkomkaart S150',
  (select current_published_version_id from public.dynamic_templates
   where slide_type='sport_visitor_arrivals' and orientation='landscape'
     and status='published' order by slug limit 1),
  current_setting('test.s150_data_source_id')::uuid,'latest',
  '{
    "blueprintKey":"sportlink.visitor_arrivals",
    "title":"Aankomst bezoekende teams",
    "context":{
      "competitionId":null,
      "competitionSelectionMode":"auto_current",
      "phaseId":null,
      "poolId":null,
      "providerTeamId":"club-team-150",
      "seasonId":null
    },
    "teamContexts":[{
      "competitionId":null,
      "competitionSelectionMode":"auto_current",
      "phaseId":null,
      "poolId":null,
      "providerTeamId":"club-team-150",
      "seasonId":null
    }],
    "arrival":{
      "cardCount":4,
      "emptyBehavior":"skip",
      "minutesBefore":90,
      "minutesAfter":30,
      "showArrivalTime":true,
      "showCompetition":true,
      "showSponsor":true,
      "showWelcome":true
    }
  }'
)$$,'owner creates a visitor-arrival slide with stale presentation options');

reset role;
create temporary table s150_snapshot as
select private.build_dynamic_snapshot_data(slide) as payload
from public.dynamic_slides slide
where slide.tenant_id='10000000-0000-4000-8000-000000001501'
  and slide.name='Welkomkaart S150';

select is(
  (select jsonb_array_length(payload#>'{sport,items}') from s150_snapshot),
  3,
  'only the three home fixtures become visitor cards'
);
select is(
  (select array_agg(item.value->>'id' order by item.ordinality)
   from s150_snapshot,
   jsonb_array_elements(payload#>'{sport,items}') with ordinality item(value, ordinality)),
  array['fixture-next','fixture-later','fixture-recent']::text[],
  'the next upcoming fixture starts slide one and recent fixtures follow upcoming ones'
);
select is(
  (select payload#>>'{sport,items,0,primary}' from s150_snapshot),
  'Eerstvolgende SV JO17-1',
  'line one remains the visiting club and team name'
);
select is(
  (select payload#>>'{sport,items,0,secondary}' from s150_snapshot),
  (select 'Aanvang: ' || to_char(
      fixture.starts_at at time zone connection.timezone,
      'HH24:MI'
    ) || ' | Veld 1'
   from public.sports_matches fixture
   join public.sportlink_connections connection
     on connection.id=fixture.source_connection_id
   where fixture.external_id='fixture-next'
     and fixture.tenant_id='10000000-0000-4000-8000-000000001501'),
  'line two contains only kickoff time and normalized field number'
);
select is(
  (select payload#>>'{sport,items,0,meta}' from s150_snapshot),
  'Kleedkamer: 2',
  'line three contains only the normalized dressing room'
);
select is(
  (select payload#>>'{sport,title}' from s150_snapshot),
  'Welkom bezoekende teams',
  'the heading never uses the arrival label'
);
select is(
  (select (payload#>>'{sport,arrivalConfig,cardCount}')::integer from s150_snapshot),
  2,
  'visitor snapshots always publish two cards per page'
);
select ok(
  (select payload#>'{sport,arrivalConfig}' @> '{
    "showArrivalTime":false,
    "showCompetition":false,
    "showDressingRoom":true,
    "showField":true,
    "showKickoffTime":true,
    "showSponsor":false,
    "showWelcome":false
  }'::jsonb from s150_snapshot),
  'irrelevant visitor-card controls are frozen off'
);
select is(
  (select payload#>>'{sport,items,0,logoMediaAssetId}' from s150_snapshot),
  '50000000-0000-5000-8000-000000001501',
  'the checksum-bound opponent logo remains frozen in the snapshot'
);
select ok(
  (select not exists (
    select 1
    from jsonb_array_elements(payload#>'{sport,items}') item
    where concat_ws(' ', item->>'primary', item->>'secondary', item->>'meta')
      ilike '%aankomst%'
  ) from s150_snapshot),
  'no visible visitor-card line contains Aankomst'
);
select ok(
  (select payload::text not like '%https://%' from s150_snapshot),
  'no provider URL reaches the Player snapshot'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.build_dynamic_snapshot_data(public.dynamic_slides)',
    'execute'
  ),
  'browser roles cannot execute the privileged snapshot builder'
);

select * from finish();
rollback;
