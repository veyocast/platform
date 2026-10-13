begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

-- Original Menu-v2 producer: the oracle is committed pre-change code, not a
-- mock renderer. Each paired statement shares the same timestamp and policy.
create or replace function pg_temp.s209_original_menu(
  p_slide public.dynamic_slides
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  document jsonb;
  selection jsonb;
  result jsonb;
  club_name text;
  club_logo_id uuid;
  published_at timestamptz := now();
begin
  if p_slide.slide_type <> 'price_list'
    or p_slide.configuration_json ->> 'schemaVersion' is distinct from 'menu-document.v2'
  then
    return private.build_dynamic_snapshot_data_before_menu_studio_v2(p_slide);
  end if;

  document := private.resolve_menu_document_v2(
    p_slide.tenant_id,
    p_slide.data_source_id,
    p_slide.configuration_json
  );
  perform private.validate_menu_document_v2(
    p_slide.tenant_id, p_slide.data_source_id, document
  );
  document := jsonb_set(document, '{publication}', jsonb_build_object(
    'documentRevision', p_slide.menu_document_revision,
    'rendererVersion', '2.0.0',
    'contentFitVersion', 'dom-measured-2.0.0',
    'themeManifestVersion', '1.0.0',
    'assetManifestVersion', '1.0.0',
    'publishedAt', published_at
  ), true);
  select tenant.name into club_name
  from public.tenants tenant where tenant.id = p_slide.tenant_id;
  select coalesce(
    (select kit.logo_media_asset_id
     from public.studio_tenant_brand_kits kit
     where kit.tenant_id = p_slide.tenant_id),
    (select club.logo_media_asset_id
     from public.sports_clubs club
     where club.tenant_id = p_slide.tenant_id
       and club.active and club.logo_media_asset_id is not null
     order by club.last_synced_at desc, club.id limit 1)
  ) into club_logo_id;
  selection := jsonb_build_object(
    'accent', document #>> '{theme,brand,accent}',
    'support', document #>> '{theme,brand,support}',
    'categoryOverrides', '[]'::jsonb,
    'modePolicy', jsonb_build_object(
      'kind', 'fixed', 'mode', document #>> '{theme,mode}'
    ),
    'ref', jsonb_build_object(
      'catalog', 'v2',
      'id', document #>> '{theme,themeId}',
      'version', document #>> '{theme,themeVersion}'
    )
  );
  result := jsonb_build_object(
    'type', 'price_list',
    'menuDocument', document,
    'brand', jsonb_strip_nulls(jsonb_build_object(
      'clubName', club_name,
      'logoMediaAssetId', club_logo_id,
      'primaryColor', document #>> '{theme,brand,accent}'
    )),
    'themePresentation', jsonb_build_object(
      'catalogVersion', '1.0.0',
      'resolvedMode', jsonb_build_object(
        'mode', document #>> '{theme,mode}',
        'policy', selection -> 'modePolicy',
        'resolvedAt', published_at,
        'timezone', 'UTC'
      ),
      'selection', selection,
      'snapshotVersion', 1
    )
  );
  return result;
end;
$$;
select is((select encode(extensions.digest(prosrc,'sha256'),'hex') from pg_proc
  where oid='pg_temp.s209_original_menu(public.dynamic_slides)'::regprocedure),
  '2ca8aeaf7a083c458386abef53a7755bdfb9a4284ebc79cb43fdf8a58b10fc5c', 'reference is the exact original Menu-v2 body');

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values
('00000000-0000-4000-8000-000000002091','authenticated','authenticated','s209-a@test.invalid','x',now(),now(),now(),'{}','{}'),
('00000000-0000-4000-8000-000000002092','authenticated','authenticated','s209-b@test.invalid','x',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name) values
('00000000-0000-4000-8000-000000002091','S209 own'),('00000000-0000-4000-8000-000000002092','S209 foreign');
insert into public.tenants(id,name,slug) values
('10000000-0000-4000-8000-000000002091','S209 own','s209-own'),('10000000-0000-4000-8000-000000002092','S209 foreign','s209-foreign');
insert into public.tenant_settings(tenant_id) values
('10000000-0000-4000-8000-000000002091'),('10000000-0000-4000-8000-000000002092');
insert into public.tenant_memberships(tenant_id,user_id,role) values
('10000000-0000-4000-8000-000000002091','00000000-0000-4000-8000-000000002091','tenant_owner'),
('10000000-0000-4000-8000-000000002092','00000000-0000-4000-8000-000000002092','tenant_owner');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002091',true);
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000002091','S209 primary','Own SV','2091','encrypted-value','initialization-vector','authentication-tag');
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000002091','S209 secondary','Other SV','2092','encrypted-value','initialization-vector','authentication-tag');
select public.create_dynamic_data_source_v1('10000000-0000-4000-8000-000000002091','S209 menu','manual_products','{}');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002092',true);
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000002092','S209 foreign','Foreign SV','2093','encrypted-value','initialization-vector','authentication-tag');
reset role;
create temporary table s209_sources as
select case source.name when 'S209 primary' then 'primary' when 'S209 secondary' then 'secondary' else 'foreign' end name,
 c.tenant_id,c.id connection_id,c.data_source_id
from public.sportlink_connections c join public.dynamic_data_sources source on source.tenant_id=c.tenant_id and source.id=c.data_source_id
where c.tenant_id in ('10000000-0000-4000-8000-000000002091','10000000-0000-4000-8000-000000002092');
select is((select count(*) from s209_sources),3::bigint,'three tenant/source contexts exist');

insert into public.media_assets(id,tenant_id,kind,title,original_file_name,mime_type,status,storage_bucket,storage_path,file_size_bytes,checksum_sha256,width,height)
values ('60000000-0000-5000-8000-000000002091','10000000-0000-4000-8000-000000002091','image','Legacy provider','legacy.webp','image/webp','ready','tenant-media','tenants/10000000-0000-4000-8000-000000002091/assets/60000000-0000-5000-8000-000000002091/legacy.webp',10,repeat('a',64),64,64),
('60000000-0000-5000-8000-000000002092','10000000-0000-4000-8000-000000002091','image','Explicit Studio override','custom.webp','image/webp','ready','tenant-media','tenants/10000000-0000-4000-8000-000000002091/assets/60000000-0000-5000-8000-000000002092/custom.webp',10,repeat('d',64),64,64);
insert into public.sports_clubs(tenant_id,source_connection_id,external_id,name,logo_media_asset_id,last_synced_at)
select tenant_id,connection_id,'club-1','Testclub','60000000-0000-5000-8000-000000002091',now()-interval '1 day'
from s209_sources where name='primary';

create function pg_temp.s209_slide(p_type text default 'sport_program',p_source text default 'primary',p_extra jsonb default '{}')
returns public.dynamic_slides language sql stable as $$
select jsonb_populate_record(null::public.dynamic_slides,jsonb_build_object(
'id','20000000-0000-4000-8000-000000002091','tenant_id',s.tenant_id,'data_source_id',s.data_source_id,'name','S209 content',
'slide_type',p_type,'orientation','landscape','selection_mode','latest','template_id',t.id,'template_version_id',t.current_published_version_id,
'configuration_json',jsonb_build_object('title','S209 content')||p_extra))
from s209_sources s cross join lateral(select * from public.dynamic_templates where slide_type=p_type and orientation='landscape' and status='published' order by slug,id limit 1)t where s.name=p_source
$$;
create function pg_temp.s209_menu() returns public.dynamic_slides language sql stable as $$
select jsonb_populate_record(null::public.dynamic_slides,jsonb_build_object(
'id','20000000-0000-4000-8000-000000002091','tenant_id',source.tenant_id,'data_source_id',source.id,'name','S209 menu',
'slide_type','price_list','orientation','landscape','selection_mode','latest','template_id',t.id,'template_version_id',t.current_published_version_id,
'menu_document_revision',1,'configuration_json',jsonb_build_object(
'schemaVersion','menu-document.v2','id','20000000-0000-4000-8000-000000002091','tenantId',source.tenant_id,'revision',1,
'createdAt','2026-10-13T00:00:00.000Z','updatedAt','2026-10-13T00:00:00.000Z','title','Testmenu',
'assets','[]'::jsonb,'pages','[{"id":"page-1","order":0,"blocks":[]}]'::jsonb,
'theme','{"themeId":"fieldflow","themeVersion":"1.0.0","mode":"light","brand":{"accent":"#FF5C20"}}'::jsonb)))
from public.dynamic_data_sources source cross join lateral(select * from public.dynamic_templates where slide_type='price_list' and orientation='landscape' and status='published' order by slug,id limit 1)t
where source.tenant_id='10000000-0000-4000-8000-000000002091' and source.name='S209 menu'
$$;

create temporary table s209_authoring_before as select
(select count(*) from public.dynamic_slide_versions) slide_versions,
(select count(*) from public.playlist_releases) playlist_releases,
(select count(*) from public.dynamic_slide_snapshots) snapshots;

-- The old provider media pointer survives; successful complete_v4 must select
-- the new current provider version for the same club and source.
insert into public.sportlink_sync_runs(id,tenant_id,connection_id,dataset_group,status,worker_id,locked_at)
select '40000000-0000-4000-8000-000000002091',tenant_id,connection_id,'club_profile','running','worker:s209',now() from s209_sources where name='primary';
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select lives_ok($test$ select public.complete_sportlink_sync_v4(
'40000000-0000-4000-8000-000000002091','worker:s209','{"externalId":"club-1","name":"Testclub"}',
jsonb_build_object('assetId','50000000-0000-5000-8000-000000002091','checksumSha256',repeat('b',64),'externalId','club-1','fileSizeBytes',10,'height',64,'width',64,'mimeType','image/webp','role','club_logo','storagePath','providers/sportlink/club_logo/'||repeat('b',64)||'.webp')) $test$,
'first normalized provider logo completes through the service-role RPC');
reset role;
select is(private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(pg_temp.s209_slide())#>>'{brand,logoMediaAssetId}',
'50000000-0000-5000-8000-000000002091','current provider logo takes precedence over the old provider-owned media pointer');
select is(private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(pg_temp.s209_menu())#>>'{brand,logoMediaAssetId}',
'50000000-0000-5000-8000-000000002091','Menu-v2 uses the current provider club logo');
select is((private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(pg_temp.s209_menu())-'brand')::text,
(pg_temp.s209_original_menu(pg_temp.s209_menu())-'brand')::text,'Menu-v2 document, resolved theme and timestamps remain byte-identical in one statement');

insert into public.sportlink_sync_runs(id,tenant_id,connection_id,dataset_group,status,worker_id,locked_at)
select '40000000-0000-4000-8000-000000002092',tenant_id,connection_id,'club_profile','running','worker:s209',now() from s209_sources where name='primary';
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select lives_ok($test$ select public.complete_sportlink_sync_v4(
'40000000-0000-4000-8000-000000002092','worker:s209','{"externalId":"club-1","name":"Testclub"}',
jsonb_build_object('assetId','50000000-0000-5000-8000-000000002092','checksumSha256',repeat('c',64),'externalId','club-1','fileSizeBytes',10,'height',64,'width',64,'mimeType','image/webp','role','club_logo','storagePath','providers/sportlink/club_logo/'||repeat('c',64)||'.webp')) $test$,
'changed club logo completes without authoring a new slide or playlist');
reset role;
select is((select current_version_id from public.provider_asset_cache where provider='sportlink' and entity_type='club' and external_entity_id='club-1' and asset_role='club_logo'),
'50000000-0000-5000-8000-000000002092'::uuid,'provider cache activates precisely the newly committed version');
select is((select logo_provider_asset_version_id from public.sports_clubs where tenant_id='10000000-0000-4000-8000-000000002091' and external_id='club-1'),
'50000000-0000-5000-8000-000000002092'::uuid,'the same club points to its new normalized provider version');
select is(private.build_dynamic_snapshot_data(pg_temp.s209_slide())#>>'{brand,logoMediaAssetId}',
'50000000-0000-5000-8000-000000002092','the public canonical projector sees the changed club logo');
select is(private.build_dynamic_snapshot_data(pg_temp.s209_menu())#>>'{brand,logoMediaAssetId}',
'50000000-0000-5000-8000-000000002092','the canonical Menu-v2 projector sees the changed club logo');
select is((select logo_media_asset_id from public.sports_clubs where tenant_id='10000000-0000-4000-8000-000000002091' and external_id='club-1'),
'60000000-0000-5000-8000-000000002091'::uuid,'legacy immutable provider media remains stored and is not rewritten');
select is((select count(*) from public.provider_asset_versions where cache_id=(select id from public.provider_asset_cache where provider='sportlink' and asset_role='club_logo' and external_entity_id='club-1')),
2::bigint,'both immutable logo versions remain available for historical references');

insert into public.studio_tenant_brand_kits(tenant_id,primary_color,secondary_color,logo_media_asset_id)
values ('10000000-0000-4000-8000-000000002091','#123456','#ABCDEF','60000000-0000-5000-8000-000000002092');
select is(private.build_dynamic_snapshot_data(pg_temp.s209_slide())#>>'{brand,logoMediaAssetId}',
'60000000-0000-5000-8000-000000002092','explicit tenant Studio upload remains authoritative over updated Sportlink');
select is(private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(pg_temp.s209_menu())#>>'{brand,logoMediaAssetId}',
'60000000-0000-5000-8000-000000002092','explicit Studio upload remains authoritative in Menu-v2');
select is(private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(pg_temp.s209_menu())::text,
pg_temp.s209_original_menu(pg_temp.s209_menu())::text,'explicit-custom Menu payload remains exactly unchanged');
select is(private.build_dynamic_snapshot_data(pg_temp.s209_slide('sport_program','foreign'))#>>'{brand,logoMediaAssetId}',
null::text,'another tenant receives neither the provider logo nor the custom upload');
delete from public.studio_tenant_brand_kits where tenant_id='10000000-0000-4000-8000-000000002091';

-- Source-specific legacy remains above another source's provider fallback.
insert into public.sports_clubs(tenant_id,source_connection_id,external_id,name,logo_media_asset_id,last_synced_at)
select tenant_id,connection_id,'club-2','Secondary','60000000-0000-5000-8000-000000002091',now()+interval '1 hour' from s209_sources where name='secondary';
select is(private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(pg_temp.s209_slide('sport_program','primary'))#>>'{brand,logoMediaAssetId}',
'50000000-0000-5000-8000-000000002092','sports choose the matching source even when another source synced later');
select is(private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(pg_temp.s209_slide('sport_program','secondary'))#>>'{brand,logoMediaAssetId}',
'60000000-0000-5000-8000-000000002091','matching-source legacy fallback remains when its provider logo is unavailable');
update public.sports_clubs set active=false where external_id='club-2' and tenant_id='10000000-0000-4000-8000-000000002091';
select is(private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(pg_temp.s209_slide('sport_program','secondary'))#>>'{brand,logoMediaAssetId}',
'50000000-0000-5000-8000-000000002092','inactive source club is excluded and the same tenant fallback remains');
update public.sports_clubs set logo_provider_asset_version_id=null where tenant_id='10000000-0000-4000-8000-000000002091';
select is(private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(pg_temp.s209_slide())#>>'{brand,logoMediaAssetId}',
'60000000-0000-5000-8000-000000002091','legacy club media remains a genuine fallback when provider pointer is absent');
select is(private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(pg_temp.s209_menu())::text,
pg_temp.s209_original_menu(pg_temp.s209_menu())::text,'legacy-only Menu payload remains byte-identical');
update public.sports_clubs set active=false where tenant_id='10000000-0000-4000-8000-000000002091';
select is(private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(pg_temp.s209_menu())::text,
pg_temp.s209_original_menu(pg_temp.s209_menu())::text,'no-active-club Menu payload remains byte-identical');

select ok((select slide_versions=(select count(*) from public.dynamic_slide_versions)
 and playlist_releases=(select count(*) from public.playlist_releases)
 and snapshots=(select count(*) from public.dynamic_slide_snapshots) from s209_authoring_before),
'provider logo ingestion and projection create no authoring versions, releases or snapshots');
select ok((select bool_and(provolatile='s' and prosecdef and proconfig=array['search_path=""']::text[])
from pg_proc where oid in ('private.build_dynamic_snapshot_data_before_menu_studio_v2(public.dynamic_slides)'::regprocedure,
'private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(public.dynamic_slides)'::regprocedure)),
'both existing private aliases preserve stable definer and empty search_path');
select ok(not has_function_privilege(role_name, function_name, 'execute'), role_name||' cannot expose private brand aliases')
from (values ('anon'),('authenticated'),('service_role')) roles(role_name)
cross join (values ('private.build_dynamic_snapshot_data_before_menu_studio_v2(public.dynamic_slides)'),
('private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(public.dynamic_slides)')) functions(function_name);
select * from finish();
rollback;
