begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(57);

select is(private.rebase_dynamic_placement_configuration_v1(
  '{"title":"Oud","scale":100,"seconds":10,"rendererVersion":"oud"}',
  '{"title":"Nieuw","scale":90,"seconds":15,"rendererVersion":"nieuw"}',
  '{"title":"Oud","scale":100,"seconds":10,"rendererVersion":"oud"}'),
  '{"title":"Nieuw","scale":90,"seconds":10,"rendererVersion":"nieuw"}'::jsonb,
  'inherited placement settings follow the new design while playback duration stays fixed');
select is(private.rebase_dynamic_placement_configuration_v1(
  '{"title":"Oud","scale":100,"themeId":"fieldflow","orientation":"landscape"}',
  '{"title":"Nieuw","scale":90,"themeId":"fieldflow","orientation":"portrait"}',
  '{"title":"Oud","scale":100,"themeId":"onzetrots-tv","orientation":"landscape"}'),
  '{"title":"Nieuw","scale":90,"themeId":"onzetrots-tv","orientation":"portrait"}'::jsonb,
  'explicit playlist theme is retained without pinning old source layout or orientation');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-4000-8000-000000001221', 'authenticated', 'authenticated', 'versions-a@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001222', 'authenticated', 'authenticated', 'versions-b@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles(id, display_name) values
  ('00000000-0000-4000-8000-000000001221', 'Version owner A'),
  ('00000000-0000-4000-8000-000000001222', 'Version owner B');
insert into public.tenants(id, name, slug) values
  ('10000000-0000-4000-8000-000000001221', 'Version tenant A', 'version-tenant-a'),
  ('10000000-0000-4000-8000-000000001222', 'Version tenant B', 'version-tenant-b');
insert into public.tenant_settings(tenant_id) values
  ('10000000-0000-4000-8000-000000001221'),
  ('10000000-0000-4000-8000-000000001222');
update public.tenants set screen_limit=2 where id='10000000-0000-4000-8000-000000001221';
insert into public.tenant_memberships(tenant_id, user_id, role) values
  ('10000000-0000-4000-8000-000000001221', '00000000-0000-4000-8000-000000001221', 'tenant_owner'),
  ('10000000-0000-4000-8000-000000001222', '00000000-0000-4000-8000-000000001222', 'tenant_owner');

insert into public.dynamic_data_sources(
  id, tenant_id, name, kind, status, provider_status, config_json
) values
  ('20000000-0000-4000-8000-000000001221', '10000000-0000-4000-8000-000000001221', 'Sportlink A', 'sportlink', 'active', 'ready', '{}'::jsonb),
  ('20000000-0000-4000-8000-000000001222', '10000000-0000-4000-8000-000000001222', 'Sportlink B', 'sportlink', 'active', 'ready', '{}'::jsonb);

create temporary table version_test_state(name text primary key, id uuid, value jsonb);
grant select, insert, update on version_test_state to authenticated;

insert into public.dynamic_slides(
  id, tenant_id, name, slide_type, orientation, template_id,
  template_version_id, data_source_id, selection_mode, status,
  configuration_json
)
select
  '30000000-0000-4000-8000-000000001221',
  '10000000-0000-4000-8000-000000001221',
  'JO17 stand', 'sport_standing', 'landscape', template.id, version.id,
  '20000000-0000-4000-8000-000000001221', 'latest', 'draft',
  '{"schemaVersion":1,"blueprintKey":"sportlink.pool_standings","title":"Poulestand","context":{"competitionId":null,"competitionSelectionMode":"auto_current","phaseId":null,"poolId":null,"providerTeamId":"jo17","seasonId":null},"display":{"columns":"two","showDressingRoom":false,"showField":true,"showHomeAway":true,"showReferee":false},"editorial":{"schemaVersion":2,"themeSelection":{"ref":{"catalog":"v2","id":"fieldflow","version":"1.0.0"},"modePolicy":{"kind":"fixed","mode":"light"},"accent":null,"support":null,"categoryOverrides":[]}},"maxItems":40}'::jsonb
from public.dynamic_templates template
join public.dynamic_template_versions version
  on version.id = template.current_published_version_id
where template.slide_type = 'sport_standing'
  and template.orientation = 'landscape'
  and template.status = 'published'
limit 1;

select is(
  (select count(*) from public.dynamic_slide_versions where dynamic_slide_id = '30000000-0000-4000-8000-000000001221'),
  1::bigint,
  'a logical slide starts with exactly one configuration version'
);
select is(
  (select status from public.dynamic_slide_versions where dynamic_slide_id = '30000000-0000-4000-8000-000000001221'),
  'draft',
  'the initial unrendered version is a draft'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid = 'public.dynamic_slide_versions'::regclass),
  'configuration versions force RLS'
);
select is(
  (select private.build_dynamic_snapshot_data(slide) #>> '{sport,displayConfig,columns}'
   from public.dynamic_slides slide
   where slide.id = '30000000-0000-4000-8000-000000001221'),
  'two',
  'Sportlink display configuration reaches the immutable snapshot builder'
);
select throws_ok(
  $$update public.dynamic_slides
    set configuration_json = jsonb_set(
      configuration_json,
      '{editorial,themeSelection,ref,id}',
      '"editorial"'::jsonb
    )
    where id = '30000000-0000-4000-8000-000000001221'$$,
  '23514',
  'authorable dynamic theme is invalid',
  'the database rejects a hidden legacy theme for changed authoring'
);
select ok(
  has_table_privilege('authenticated', 'public.dynamic_slide_versions', 'SELECT')
  and not has_table_privilege('authenticated', 'public.dynamic_slide_versions', 'INSERT'),
  'Data API grants expose read-only version history'
);

insert into public.media_assets(id,tenant_id,kind,title,original_file_name,mime_type,status,storage_bucket,storage_path,file_size_bytes,checksum_sha256,width,height,processed_at)
select asset_id,'10000000-0000-4000-8000-000000001221','image','Version poster','poster.png','image/png','ready','tenant-media',
  'tenants/10000000-0000-4000-8000-000000001221/assets/' || asset_id::text || '/original/poster.png',100,repeat('c',64),1920,1080,now()
from unnest(array['50000000-0000-4000-8000-000000001221'::uuid,'50000000-0000-4000-8000-000000001222'::uuid]) asset_id;
insert into public.media_variants(tenant_id,asset_id,variant_type,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height)
select tenant_id,id,'original',storage_path,mime_type,file_size_bytes,checksum_sha256,width,height from public.media_assets
where id in ('50000000-0000-4000-8000-000000001221','50000000-0000-4000-8000-000000001222');

insert into public.dynamic_slide_snapshots(
  id, tenant_id, dynamic_slide_id, template_version_id, data_source_id,
  source_revision_hash, snapshot_data_json, status, completed_at, output_media_asset_id
)
select
  '40000000-0000-4000-8000-000000001221', slide.tenant_id, slide.id,
  slide.template_version_id, slide.data_source_id, repeat('a', 64),
  private.build_dynamic_snapshot_data(slide),
  'queued', null, '50000000-0000-4000-8000-000000001221'::uuid
from public.dynamic_slides slide where slide.id = '30000000-0000-4000-8000-000000001221';
update public.dynamic_slides
set current_snapshot_id = '40000000-0000-4000-8000-000000001221', status = 'ready'
where id = '30000000-0000-4000-8000-000000001221';

update public.dynamic_slide_snapshots set status='ready',completed_at=now() where id='40000000-0000-4000-8000-000000001221';
select is((select status from public.dynamic_slide_versions where dynamic_slide_id='30000000-0000-4000-8000-000000001221'),'publishing','ready snapshot with unchanged pointer reproduces the stalled publication');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001221',true);
select is(public.publish_dynamic_slide_version_v1('30000000-0000-4000-8000-000000001221',
  (select active_draft_version_id from public.dynamic_slides where id='30000000-0000-4000-8000-000000001221'),
  (select edit_revision from public.dynamic_slide_versions where dynamic_slide_id='30000000-0000-4000-8000-000000001221')) ->> 'outcome',
  'published','retry promotes the real ready artifact even when its pointer is unchanged');

select is(
  (select status from public.dynamic_slide_versions where dynamic_slide_id = '30000000-0000-4000-8000-000000001221'),
  'published',
  'ready output atomically promotes the initial version'
);
select ok(
  (select current_published_version_id is not null and active_draft_version_id is null from public.dynamic_slides where id = '30000000-0000-4000-8000-000000001221'),
  'logical slide points only at the ready current version'
);
select throws_ok(
  $$update public.dynamic_slides
    set configuration_json = jsonb_set(configuration_json, '{title}', '"Unsafe edit"'::jsonb)
    where id = '30000000-0000-4000-8000-000000001221'$$,
  '55000',
  'published slide design requires an active draft version',
  'published design cannot be mutated outside a version draft'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001221', true);
insert into version_test_state(name, value)
values ('create-v2', public.create_or_resume_dynamic_slide_version_v1('30000000-0000-4000-8000-000000001221', null));

select is((select value ->> 'outcome' from version_test_state where name = 'create-v2'), 'created', 'owner creates a cloned v2 draft');
select is(public.create_or_resume_dynamic_slide_version_v1('30000000-0000-4000-8000-000000001221', null) ->> 'outcome', 'resumed', 'repeated click resumes the one active draft');
select is((select count(*) from public.dynamic_slide_versions where dynamic_slide_id = '30000000-0000-4000-8000-000000001221'), 2::bigint, 'idempotent draft creation prevents v3/v4 clutter');
select is((select version_number from public.dynamic_slide_versions where id = (select active_draft_version_id from public.dynamic_slides where id = '30000000-0000-4000-8000-000000001221')), 2, 'new draft has the next user-facing version number');
select is((select configuration_json #>> '{context,providerTeamId}' from public.dynamic_slide_versions where version_number = 2 and dynamic_slide_id = '30000000-0000-4000-8000-000000001221'), 'jo17', 'dynamic provider binding is cloned instead of frozen snapshot data');
select is((select theme_selection_json #>> '{ref,id}' from public.dynamic_slide_versions where version_number = 2 and dynamic_slide_id = '30000000-0000-4000-8000-000000001221'), 'fieldflow', 'FieldFlow theme is cloned as versioned configuration');
reset role;
select throws_ok(
  $$update public.dynamic_slide_versions set name = 'Tampered history' where dynamic_slide_id = '30000000-0000-4000-8000-000000001221' and version_number = 1$$,
  '55000', 'published dynamic slide versions are immutable',
  'historical published configuration cannot be mutated'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001221', true);
select throws_ok(
  $$select public.create_or_resume_dynamic_slide_version_v1('30000000-0000-4000-8000-000000001222', null)$$,
  'P0002', 'dynamic slide not found',
  'an unknown or cross-tenant logical slide cannot be versioned'
);
select is((select count(*) from public.dynamic_slide_versions), 2::bigint, 'only the own tenant versions are visible through RLS');

reset role;
update public.dynamic_slide_versions
set status = 'publishing'
where dynamic_slide_id = '30000000-0000-4000-8000-000000001221' and version_number = 2;
insert into public.dynamic_slide_snapshots(
  id, tenant_id, dynamic_slide_id, template_version_id, data_source_id,
  source_revision_hash, snapshot_data_json, status, completed_at, output_media_asset_id
)
select
  '40000000-0000-4000-8000-000000001222', slide.tenant_id, slide.id,
  slide.template_version_id, slide.data_source_id, repeat('b', 64),
  private.build_dynamic_snapshot_data(slide),
  'ready', now(), '50000000-0000-4000-8000-000000001222'::uuid
from public.dynamic_slides slide where slide.id = '30000000-0000-4000-8000-000000001221';
insert into public.playlists(id,tenant_id,name) values
 ('60000000-0000-4000-8000-000000001221','10000000-0000-4000-8000-000000001221','Playlist A'),
 ('60000000-0000-4000-8000-000000001222','10000000-0000-4000-8000-000000001221','Playlist B');
insert into public.playlist_releases(tenant_id,playlist_id,version,manifest_hash,manifest_json,item_count,total_duration_seconds,total_bytes)
select tenant_id,id,1,repeat('d',64),jsonb_build_object('version',1,'items',jsonb_build_array(jsonb_build_object('id',id,'durationSeconds',17))),1,17,100
from public.playlists where id in ('60000000-0000-4000-8000-000000001221','60000000-0000-4000-8000-000000001222');
insert into public.playlist_release_items(tenant_id,playlist_id,release_id,media_asset_id,media_variant_id,sort_order,duration_seconds,fit_mode,muted,asset_kind,asset_title,storage_path,mime_type,file_size_bytes,checksum_sha256,dynamic_snapshot_id,live_data_enabled)
select release.tenant_id,release.playlist_id,release.id,asset.id,variant.id,0,17,'contain',true,'image','Poster',asset.storage_path,asset.mime_type,asset.file_size_bytes,asset.checksum_sha256,'40000000-0000-4000-8000-000000001221',true
from public.playlist_releases release join public.media_assets asset on asset.id='50000000-0000-4000-8000-000000001221'
join public.media_variants variant on variant.asset_id=asset.id
where release.playlist_id in ('60000000-0000-4000-8000-000000001221','60000000-0000-4000-8000-000000001222');
insert into public.playlist_items(tenant_id,playlist_id,media_asset_id,sort_order,duration_seconds,display_title)
select tenant_id,id,'50000000-0000-4000-8000-000000001221',0,99,'Nog niet gepubliceerd concept'
from public.playlists where id in ('60000000-0000-4000-8000-000000001221','60000000-0000-4000-8000-000000001222');

insert into public.screens(id,tenant_id,name,status,assigned_playlist_id,assigned_release_id,default_playlist_id,default_release_id)
select '71000000-0000-4000-8000-000000001221',tenant_id,'Default scherm','active',playlist_id,id,playlist_id,id
from public.playlist_releases where playlist_id='60000000-0000-4000-8000-000000001221';
insert into public.screens(id,tenant_id,name,status,assigned_playlist_id,assigned_release_id)
select '71000000-0000-4000-8000-000000001222',tenant_id,'Gepland scherm','active',playlist_id,id
from public.playlist_releases where playlist_id='60000000-0000-4000-8000-000000001222';
insert into public.content_schedules(id,tenant_id,name,target_kind,target_screen_id,playlist_id,release_id,timezone_name,starts_at,ends_at,priority)
select '72000000-0000-4000-8000-000000001221',tenant_id,'Kantine planning','screen',id,assigned_playlist_id,assigned_release_id,'Europe/Amsterdam',now()-interval '1 hour',now()+interval '1 hour',77
from public.screens where id='71000000-0000-4000-8000-000000001222';
update public.content_schedules schedule set target_snapshot_id=private.create_publisher_target_snapshot(
  tenant_id,release_id,id,'schedule',id,array[target_screen_id],null)
where id='72000000-0000-4000-8000-000000001221';
update public.screens screen set active_assignment_source='schedule',active_schedule_id=schedule.id,active_target_snapshot_id=schedule.target_snapshot_id
from public.content_schedules schedule where screen.id=schedule.target_screen_id and schedule.id='72000000-0000-4000-8000-000000001221';
insert into public.player_devices(tenant_id,screen_id,token_hash,status,desired_release_id)
select tenant_id,id,repeat(case when name='Default scherm' then 'a' else 'b' end,64),'paired',assigned_release_id
from public.screens where id in ('71000000-0000-4000-8000-000000001221','71000000-0000-4000-8000-000000001222');

update public.dynamic_slides
set current_snapshot_id = '40000000-0000-4000-8000-000000001222'
where id = '30000000-0000-4000-8000-000000001221';

select is((select version_number from public.dynamic_slide_versions where id = (select current_published_version_id from public.dynamic_slides where id = '30000000-0000-4000-8000-000000001221')), 2, 'ready v2 becomes the current version');
select is((select status from public.dynamic_slide_versions where dynamic_slide_id = '30000000-0000-4000-8000-000000001221' and version_number = 1), 'published', 'v1 remains immutable history after v2 publication');
select is((select dynamic_slide_version_id from public.dynamic_slide_snapshots where id = '40000000-0000-4000-8000-000000001222'), (select current_published_version_id from public.dynamic_slides where id = '30000000-0000-4000-8000-000000001221'), 'thumbnail/data snapshot retains concrete version provenance');
select is((select count(*) from public.dynamic_slides where id = '30000000-0000-4000-8000-000000001221'), 1::bigint, 'library keeps one logical slide after multiple versions');

select is((select count(*) from public.playlist_releases where playlist_id in ('60000000-0000-4000-8000-000000001221','60000000-0000-4000-8000-000000001222')),4::bigint,'publication derives exactly one new immutable release for both playlists');
select is((select count(*) from public.playlist_release_items item join public.playlist_publications publication on publication.release_id=item.release_id where item.dynamic_snapshot_id='40000000-0000-4000-8000-000000001222'),2::bigint,'both current playlists bind the newly active snapshot');
select ok((select bool_and(duration_seconds=17 and sort_order=0) from public.playlist_release_items where playlist_id in ('60000000-0000-4000-8000-000000001221','60000000-0000-4000-8000-000000001222')),'duration and order remain unchanged');
select ok((select bool_and(manifest_json#>>'{items,0,id}'=playlist_id::text) from public.playlist_releases where playlist_id in ('60000000-0000-4000-8000-000000001221','60000000-0000-4000-8000-000000001222')),'manifest occurrence identity remains unchanged');
update public.dynamic_slides set current_snapshot_id=current_snapshot_id where id='30000000-0000-4000-8000-000000001221';
select is((select count(*) from public.playlist_releases where playlist_id in ('60000000-0000-4000-8000-000000001221','60000000-0000-4000-8000-000000001222')),4::bigint,'repeated completion creates no duplicate release');
select is((select count(*) from public.playlist_release_items where dynamic_snapshot_id='40000000-0000-4000-8000-000000001221'),2::bigint,'previous playable immutable releases remain available');
select ok((select bool_and(screen.assigned_release_id=publication.release_id) from public.screens screen join public.playlist_publications publication on publication.playlist_id=screen.assigned_playlist_id where screen.id in ('71000000-0000-4000-8000-000000001221','71000000-0000-4000-8000-000000001222')),'default and scheduled screens follow the current publication');
select ok((select bool_and(device.desired_release_id=screen.assigned_release_id) from public.player_devices device join public.screens screen on screen.id=device.screen_id where screen.id in ('71000000-0000-4000-8000-000000001221','71000000-0000-4000-8000-000000001222')),'paired devices receive the new desired release without a restart');
select ok((select default_release_id=assigned_release_id from public.screens where id='71000000-0000-4000-8000-000000001221'),'future default playback follows the new release');
select ok((select schedule.release_id=screen.assigned_release_id and schedule.target_snapshot_id=screen.active_target_snapshot_id and schedule.target_screen_id=screen.id from public.content_schedules schedule join public.screens screen on screen.active_schedule_id=schedule.id where schedule.id='72000000-0000-4000-8000-000000001221'),'schedule and immutable target provenance switch together');
select ok((select priority=77 and timezone_name='Europe/Amsterdam' and starts_at=now()-interval '1 hour' and ends_at=now()+interval '1 hour' from public.content_schedules where id='72000000-0000-4000-8000-000000001221'),'publication preserves planning times, timezone and priority');
select ok((select bool_and(duration_seconds=99 and display_title='Nog niet gepubliceerd concept') from public.playlist_items where playlist_id in ('60000000-0000-4000-8000-000000001221','60000000-0000-4000-8000-000000001222')),'automatic refresh leaves unpublished playlist edits untouched');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001221',true);
select public.create_or_resume_dynamic_slide_version_v1('30000000-0000-4000-8000-000000001221',null);
reset role;
select is((select version_number from public.dynamic_slide_versions where id=(select current_published_version_id from public.dynamic_slides where id='30000000-0000-4000-8000-000000001221')),2,'creating an intentional draft does not publish it');
update public.dynamic_slide_versions set status='publishing'
where dynamic_slide_id='30000000-0000-4000-8000-000000001221' and version_number=3;
insert into public.dynamic_slide_snapshots(id,tenant_id,dynamic_slide_id,template_version_id,data_source_id,source_revision_hash,snapshot_data_json,status)
select '40000000-0000-4000-8000-000000001223',tenant_id,id,template_version_id,data_source_id,
  private.dynamic_snapshot_content_hash_v1(slide,private.build_dynamic_snapshot_data(slide)),
  private.build_dynamic_snapshot_data(slide),'rendering'
from public.dynamic_slides slide where id='30000000-0000-4000-8000-000000001221';
insert into public.dynamic_render_jobs(tenant_id,snapshot_id,output_media_asset_id,status,attempt_count,locked_at,locked_by,lease_token)
values('10000000-0000-4000-8000-000000001221','40000000-0000-4000-8000-000000001223',gen_random_uuid(),'rendering',3,now()-interval '11 minutes','expired-worker',gen_random_uuid());
select public.publish_dynamic_slide_version_v1('30000000-0000-4000-8000-000000001221',
  (select active_draft_version_id from public.dynamic_slides where id='30000000-0000-4000-8000-000000001221'),
  (select edit_revision from public.dynamic_slide_versions where dynamic_slide_id='30000000-0000-4000-8000-000000001221' and version_number=3));
select is((select status from public.dynamic_render_jobs where snapshot_id='40000000-0000-4000-8000-000000001223'),'queued','an explicit retry requeues the same expired job');
select ok((select lease_token is null and locked_by is null from public.dynamic_render_jobs where snapshot_id='40000000-0000-4000-8000-000000001223'),'retry fences the expired worker lease');
select is((select version_number from public.dynamic_slide_versions where id=(select current_published_version_id from public.dynamic_slides where id='30000000-0000-4000-8000-000000001221')),2,'v2 remains active during retry');
select is((select count(*) from public.dynamic_render_jobs where snapshot_id='40000000-0000-4000-8000-000000001223'),1::bigint,'retry does not duplicate jobs');
update public.dynamic_render_jobs set status='failed',error_code='RENDER_FAILED',error_detail='Temporary renderer failure'
where snapshot_id='40000000-0000-4000-8000-000000001223';
update public.dynamic_slide_snapshots set status='failed',error_code='RENDER_FAILED'
where id='40000000-0000-4000-8000-000000001223';
insert into version_test_state(name,value) values('failed-retry',public.publish_dynamic_slide_version_v1('30000000-0000-4000-8000-000000001221',
  (select active_draft_version_id from public.dynamic_slides where id='30000000-0000-4000-8000-000000001221'),
  (select edit_revision from public.dynamic_slide_versions where dynamic_slide_id='30000000-0000-4000-8000-000000001221' and version_number=3)));
select ok((select status='queued' and error_code is null from public.dynamic_render_jobs where snapshot_id=(select (value->>'snapshotId')::uuid from version_test_state where name='failed-retry')),'failed immutable snapshot creates a fresh queued render for the same version');
select is((select count(*) from public.playlist_releases where playlist_id in ('60000000-0000-4000-8000-000000001221','60000000-0000-4000-8000-000000001222')),4::bigint,'failed publication never replaces the last playable releases');
select isnt((select (value->>'snapshotId')::uuid from version_test_state where name='failed-retry'),
  '40000000-0000-4000-8000-000000001223'::uuid,'real-hash retry never reuses a terminal failed snapshot');
select is((select status from public.dynamic_slide_snapshots where id='40000000-0000-4000-8000-000000001223'),
  'failed','retry preserves immutable failure history');
insert into version_test_state(name,value) select 'failed-retry-first',value from version_test_state where name='failed-retry';
insert into version_test_state(name,value) values('failed-retry-repeat',public.publish_dynamic_slide_version_v1(
  '30000000-0000-4000-8000-000000001221',
  (select active_draft_version_id from public.dynamic_slides where id='30000000-0000-4000-8000-000000001221'),
  (select edit_revision from public.dynamic_slide_versions where dynamic_slide_id='30000000-0000-4000-8000-000000001221' and version_number=3)));
select is((select value->>'snapshotId' from version_test_state where name='failed-retry-repeat'),
  (select value->>'snapshotId' from version_test_state where name='failed-retry-first'),'a repeated click follows the already queued retry');
select is((select count(*) from public.dynamic_render_jobs where snapshot_id=
  (select (value->>'snapshotId')::uuid from version_test_state where name='failed-retry-first')),1::bigint,'a repeated click never duplicates its retry job');
update public.dynamic_render_jobs set status='failed',error_code='RENDER_FAILED'
  where snapshot_id=(select (value->>'snapshotId')::uuid from version_test_state where name='failed-retry-first');
update public.dynamic_slide_snapshots set status='failed',error_code='RENDER_FAILED'
  where id=(select (value->>'snapshotId')::uuid from version_test_state where name='failed-retry-first');
insert into version_test_state(name,value) values('failed-retry-second',public.publish_dynamic_slide_version_v1(
  '30000000-0000-4000-8000-000000001221',
  (select active_draft_version_id from public.dynamic_slides where id='30000000-0000-4000-8000-000000001221'),
  (select edit_revision from public.dynamic_slide_versions where dynamic_slide_id='30000000-0000-4000-8000-000000001221' and version_number=3)));
select isnt((select value->>'snapshotId' from version_test_state where name='failed-retry-second'),
  (select value->>'snapshotId' from version_test_state where name='failed-retry-first'),'another explicit retry can recover a second terminal failure');
select is((select job.status from public.dynamic_render_jobs job where job.snapshot_id=
  (select (value->>'snapshotId')::uuid from version_test_state where name='failed-retry-second')),'queued','the second retry really queues new work');
select ok((select private.sync_dom_semantic_data_v2(retried.snapshot_data_json)=private.sync_dom_semantic_data_v2(failed.snapshot_data_json)
  from public.dynamic_slide_snapshots retried cross join public.dynamic_slide_snapshots failed
  where retried.id=(select (value->>'snapshotId')::uuid from version_test_state where name='failed-retry-second')
  and failed.id='40000000-0000-4000-8000-000000001223'),'retry identity changes without changing the selected content');
select is((select count(*) from public.dynamic_slide_versions where dynamic_slide_id='30000000-0000-4000-8000-000000001221'),
  3::bigint,'successive attempts remain under v3 without extra versions');
select is((select version_number from public.dynamic_slide_versions where id=(select current_published_version_id
  from public.dynamic_slides where id='30000000-0000-4000-8000-000000001221')),2,'the previous working version survives successive failures');
insert into version_test_state(name,value) values('failed-retry-second-repeat',public.publish_dynamic_slide_version_v1(
  '30000000-0000-4000-8000-000000001221',
  (select active_draft_version_id from public.dynamic_slides where id='30000000-0000-4000-8000-000000001221'),
  (select edit_revision from public.dynamic_slide_versions where dynamic_slide_id='30000000-0000-4000-8000-000000001221' and version_number=3)));
select is((select value->>'snapshotId' from version_test_state where name='failed-retry-second-repeat'),
  (select value->>'snapshotId' from version_test_state where name='failed-retry-second'),'a retry chain remains idempotent at its pending tip');
select is((select count(*) from public.playlist_releases where playlist_id in
  ('60000000-0000-4000-8000-000000001221','60000000-0000-4000-8000-000000001222')),4::bigint,
  'retry clicks do not publish incomplete playlist releases');
update version_test_state set value=(select value from version_test_state where name='failed-retry-second') where name='failed-retry';
update public.dynamic_slide_snapshots set status='ready',output_media_asset_id='50000000-0000-4000-8000-000000001222',completed_at=now()
where id=(select (value->>'snapshotId')::uuid from version_test_state where name='failed-retry');
select public.publish_dynamic_slide_version_v1('30000000-0000-4000-8000-000000001221',
  (select active_draft_version_id from public.dynamic_slides where id='30000000-0000-4000-8000-000000001221'),
  (select edit_revision from public.dynamic_slide_versions where dynamic_slide_id='30000000-0000-4000-8000-000000001221' and version_number=3));
select is((select version_number from public.dynamic_slide_versions where id=(select current_published_version_id from public.dynamic_slides where id='30000000-0000-4000-8000-000000001221')),3,'the recovered job activates v3 on the same logical slide');

select * from finish();
rollback;
