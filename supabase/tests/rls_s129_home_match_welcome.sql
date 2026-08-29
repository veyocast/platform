begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(8);

insert into auth.users(
  id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,
  raw_app_meta_data,raw_user_meta_data
) values (
  '00000000-0000-4000-8000-000000001291','authenticated','authenticated',
  'home-arrivals-owner@test.invalid','x',now(),now(),now(),'{}','{}'
);
insert into public.profiles(id,display_name) values
  ('00000000-0000-4000-8000-000000001291','Home arrivals owner');
insert into public.tenants(id,name,slug) values
  ('10000000-0000-4000-8000-000000001291','Home arrivals tenant','home-arrivals-tenant');
insert into public.tenant_settings(tenant_id) values
  ('10000000-0000-4000-8000-000000001291');
insert into public.tenant_memberships(tenant_id,user_id,role) values
  ('10000000-0000-4000-8000-000000001291','00000000-0000-4000-8000-000000001291','tenant_owner');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001291',true);
select lives_ok($$select public.upsert_sportlink_connection_v1(
  '10000000-0000-4000-8000-000000001291','Sportlink · Thuisclub','Thuisclub',
  '1291','encrypted-value','initialization-vector','authentication-tag')$$,
  'owner creates the encrypted Sportlink connection');

reset role;
select set_config(
  'test.s129_connection_id',
  (select id::text from public.sportlink_connections
   where tenant_id='10000000-0000-4000-8000-000000001291'),
  true
);
select set_config(
  'test.s129_data_source_id',
  (select data_source_id::text from public.sportlink_connections
   where tenant_id='10000000-0000-4000-8000-000000001291'),
  true
);

insert into public.sports_teams(
  tenant_id,source_connection_id,external_id,name
) values (
  '10000000-0000-4000-8000-000000001291',
  current_setting('test.s129_connection_id')::uuid,
  'club-team-1','Thuisclub 1'
);

insert into public.provider_asset_cache(
  id,provider,entity_type,external_entity_id,asset_role
) values (
  '40000000-0000-4000-8000-000000001291',
  'sportlink','team','visitor-team-1','team_logo'
);
insert into public.provider_asset_versions(
  id,cache_id,checksum_sha256,storage_bucket,storage_path,mime_type,
  file_size_bytes,width,height
) values (
  '50000000-0000-5000-8000-000000001291',
  '40000000-0000-4000-8000-000000001291',repeat('a',64),
  'provider-assets','providers/sportlink/team_logo/'||repeat('a',64)||'.webp',
  'image/webp',4096,256,256
);
update public.provider_asset_cache
set current_version_id='50000000-0000-5000-8000-000000001291'
where id='40000000-0000-4000-8000-000000001291';

insert into public.sports_matches(
  tenant_id,source_connection_id,external_id,starts_at,status,
  home_team,away_team,venue,dressing_rooms,officials,is_home_match
) values
(
  '10000000-0000-4000-8000-000000001291',
  current_setting('test.s129_connection_id')::uuid,'home-fixture',
  now()+interval '45 minutes','scheduled',
  '{"externalId":"club-team-1","name":"Thuisclub 1","score":null}',
  '{"externalId":"visitor-team-1","name":"Bezoekers FC","score":null}',
  '{"field":"Veld 1"}','{"away":"4"}','[]',true
),
(
  '10000000-0000-4000-8000-000000001291',
  current_setting('test.s129_connection_id')::uuid,'away-fixture',
  now()+interval '60 minutes','scheduled',
  '{"externalId":"other-club","name":"Andere club","score":null}',
  '{"externalId":"club-team-1","name":"Thuisclub 1","score":null}',
  '{"field":"Veld 2"}','{"away":"6"}','[]',false
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001291',true);
select lives_ok($$select public.create_dynamic_slide_v1(
  '10000000-0000-4000-8000-000000001291','Welkom thuisbezoekers',
  (select current_published_version_id from public.dynamic_templates
   where slide_type='sport_visitor_arrivals' and orientation='landscape'
     and status='published' order by slug limit 1),
  current_setting('test.s129_data_source_id')::uuid,'latest',
  '{"blueprintKey":"sportlink.visitor_arrivals","title":"Welkom op ons sportpark","arrival":{"cardCount":4,"emptyBehavior":"skip","minutesBefore":90,"minutesAfter":30}}'
)$$,'owner creates a visitor-arrival slide');

reset role;
create temporary table s129_snapshot as
select private.build_dynamic_snapshot_data(slide) as payload
from public.dynamic_slides slide
where slide.tenant_id='10000000-0000-4000-8000-000000001291'
  and slide.name='Welkom thuisbezoekers';

select is(
  (select jsonb_array_length(payload#>'{sport,items}') from s129_snapshot),
  1,
  'only the opponent visiting a home-playing club team is rendered'
);
select is(
  (select payload#>>'{sport,items,0,primary}' from s129_snapshot),
  'Bezoekers FC',
  'the away team of the home fixture is the welcome-card subject'
);
select ok(
  (select (payload#>>'{sport,items,0,homeMatch}')::boolean from s129_snapshot),
  'the immutable snapshot carries explicit home-match provenance'
);
select is(
  (select payload#>>'{sport,items,0,logoMediaAssetId}' from s129_snapshot),
  '50000000-0000-5000-8000-000000001291',
  'the cached opponent logo is frozen into the snapshot'
);
select ok(
  (select payload::text not like '%https://%' from s129_snapshot),
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
