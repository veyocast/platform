begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(20);

-- Keep the fixture deliberately small, but exercise the two source paths used
-- by the planner: a current published snapshot and snapshots referenced by an
-- active immutable release. The release references snapshot A twice so the
-- source collapse must preserve one mapping and its current-pointer flag.
insert into public.tenants (id, name, slug, status, screen_limit) values (
  '18000000-0000-4000-8000-000000000001',
  'S180 rollout planner',
  's180-rollout-planner',
  'active', 10
);

insert into public.tenant_settings (tenant_id) values (
  '18000000-0000-4000-8000-000000000001'
);

insert into public.dynamic_data_sources (
  id, tenant_id, name, kind, status, provider_status, config_json
) values (
  '18000000-0000-4000-8000-000000000011',
  '18000000-0000-4000-8000-000000000001',
  'S180 rollout source',
  'manual_products',
  'active',
  'ready',
  '{}'::jsonb
);

insert into public.media_assets (
  id, tenant_id, kind, title, original_file_name, mime_type, status,
  storage_bucket, storage_path, file_size_bytes, checksum_sha256,
  width, height, processed_at
) values (
  '18000000-0000-4000-8000-000000000012',
  '18000000-0000-4000-8000-000000000001',
  'image',
  'S180 rollout asset',
  'rollout.png',
  'image/png',
  'ready',
  'tenant-media',
  'tenants/18000000-0000-4000-8000-000000000001/assets/18000000-0000-4000-8000-000000000012/original/rollout.png',
  100,
  repeat('a', 64),
  1920,
  1080,
  now()
);

insert into public.media_variants (
  id, tenant_id, asset_id, variant_type, storage_bucket, storage_path,
  mime_type, file_size_bytes, checksum_sha256, width, height
) values (
  '18000000-0000-4000-8000-000000000013',
  '18000000-0000-4000-8000-000000000001',
  '18000000-0000-4000-8000-000000000012',
  'original',
  'tenant-media',
  'tenants/18000000-0000-4000-8000-000000000001/assets/18000000-0000-4000-8000-000000000012/original/rollout.png',
  'image/png',
  100,
  repeat('b', 64),
  1920,
  1080
);

-- Use one of the repository's published menu templates. The S122 trigger
-- creates the version row; the owner-only test then promotes that fixture to
-- a published historical design without going through the authoring API.
with template as (
  select candidate.id, candidate.current_published_version_id
  from public.dynamic_templates candidate
  where candidate.slide_type = 'menu'
    and candidate.orientation = 'landscape'
    and candidate.status = 'published'
  order by candidate.created_at desc, candidate.id
  limit 1
)
insert into public.dynamic_slides (
  id, tenant_id, name, slide_type, orientation, template_id,
  template_version_id, data_source_id, selection_mode, status,
  configuration_json
)
select
  fixture.id,
  '18000000-0000-4000-8000-000000000001',
  fixture.name,
  'menu',
  'landscape',
  template.id,
  template.current_published_version_id,
  '18000000-0000-4000-8000-000000000011',
  'latest',
  'ready',
  '{
    "editorial": {
      "themeSelection": {
        "ref": {"catalog":"v2","id":"fieldflow","version":"1.0.0"},
        "modePolicy": {"kind":"fixed","mode":"dark"},
        "accent": "#2459ED",
        "support": null,
        "categoryOverrides": []
      }
    }
  }'::jsonb
from template
cross join (values
  ('18000000-0000-4000-8000-000000000101'::uuid, 'S180 rollout slide A'),
  ('18000000-0000-4000-8000-000000000102'::uuid, 'S180 rollout slide B')
) fixture(id, name);

update public.dynamic_slide_versions version
set status = 'published',
    published_at = now()
where version.dynamic_slide_id in (
  '18000000-0000-4000-8000-000000000101'::uuid,
  '18000000-0000-4000-8000-000000000102'::uuid
);

update public.dynamic_slides slide
set current_published_version_id = slide.active_draft_version_id,
    active_draft_version_id = null
where slide.id in (
  '18000000-0000-4000-8000-000000000101'::uuid,
  '18000000-0000-4000-8000-000000000102'::uuid
);

-- Publish a newer design for slide B, while its active release below keeps
-- pointing at B's original immutable version. Full content recovery must use
-- the new published design without modifying that historical source record.
insert into public.dynamic_slide_versions (
  id, tenant_id, dynamic_slide_id, version_number, status, name, slide_type,
  orientation, template_id, template_version_id, data_source_id,
  selection_mode, configuration_json, theme_selection_json, edit_revision,
  based_on_version_id, published_at
)
select
  '18000000-0000-4000-8000-000000000202',
  version.tenant_id,
  version.dynamic_slide_id,
  2,
  'published',
  'S180 rollout slide B current',
  version.slide_type,
  version.orientation,
  version.template_id,
  version.template_version_id,
  version.data_source_id,
  version.selection_mode,
  pg_catalog.jsonb_set(
    version.configuration_json,
    '{editorial,themeSelection,revision}',
    '2'::jsonb,
    true
  ),
  version.theme_selection_json,
  version.edit_revision + 1,
  version.id,
  now()
from public.dynamic_slide_versions version
where version.dynamic_slide_id =
  '18000000-0000-4000-8000-000000000102'::uuid
  and version.version_number = 1;

update public.dynamic_slides slide
set current_published_version_id =
      '18000000-0000-4000-8000-000000000202'::uuid
where slide.id = '18000000-0000-4000-8000-000000000102'::uuid;

insert into public.dynamic_slide_snapshots (
  id, tenant_id, dynamic_slide_id, dynamic_slide_version_id,
  template_version_id, data_source_id, source_revision_hash,
  snapshot_data_json, status, output_media_asset_id, completed_at
)
select
  fixture.snapshot_id,
  slide.tenant_id,
  slide.id,
  source_version.id,
  source_version.template_version_id,
  source_version.data_source_id,
  fixture.source_hash,
  pg_catalog.jsonb_build_object(
    'providerPayload', pg_catalog.jsonb_build_object(
      'fixture', fixture.fixture_name
    ),
    'themePresentation', pg_catalog.jsonb_build_object(
      'settingsRevision', 0,
      'selection', pg_catalog.jsonb_build_object(
        'ref', pg_catalog.jsonb_build_object(
          'catalog', 'v2', 'id', 'fieldflow', 'version', '1.0.0'
        )
      )
    )
  ),
  'ready',
  '18000000-0000-4000-8000-000000000012',
  now()
from public.dynamic_slides slide
join (values
  (
    '18000000-0000-4000-8000-000000000101'::uuid,
    '18000000-0000-4000-8000-000000000111'::uuid,
    repeat('1', 64),
    'A',
    1
  ),
  (
    '18000000-0000-4000-8000-000000000102'::uuid,
    '18000000-0000-4000-8000-000000000112'::uuid,
    repeat('2', 64),
    'B',
    1
  ),
  (
    '18000000-0000-4000-8000-000000000102'::uuid,
    '18000000-0000-4000-8000-000000000113'::uuid,
    repeat('3', 64),
    'B-current',
    2
  )
) fixture(slide_id, snapshot_id, source_hash, fixture_name, version_number)
  on fixture.slide_id = slide.id
join public.dynamic_slide_versions source_version
  on source_version.dynamic_slide_id = slide.id
 and source_version.version_number = fixture.version_number;

update public.dynamic_slides slide
set current_snapshot_id = snapshot.id,
    status = 'ready'
from public.dynamic_slide_snapshots snapshot
where snapshot.dynamic_slide_id = slide.id
  and (
    (slide.id = '18000000-0000-4000-8000-000000000101'::uuid
      and snapshot.id = '18000000-0000-4000-8000-000000000111'::uuid)
    or
    (slide.id = '18000000-0000-4000-8000-000000000102'::uuid
      and snapshot.id = '18000000-0000-4000-8000-000000000113'::uuid)
  );

insert into public.playlists (id, tenant_id, name, status) values (
  '18000000-0000-4000-8000-000000000121',
  '18000000-0000-4000-8000-000000000001',
  'S180 actieve playlist',
  'published'
);

insert into public.playlist_releases (
  id, tenant_id, playlist_id, version, release_notes, manifest_hash,
  manifest_json, item_count, total_duration_seconds, total_bytes
) values (
  '18000000-0000-4000-8000-000000000122',
  '18000000-0000-4000-8000-000000000001',
  '18000000-0000-4000-8000-000000000121',
  1,
  'S180 active source release',
  repeat('3', 64),
  jsonb_build_object('schemaVersion',1,'items',jsonb_build_array(jsonb_build_object('kind','image'),jsonb_build_object('kind','image'),jsonb_build_object('kind','image'))),
  3,
  30,
  300
);

insert into public.playlist_release_items (
  id, tenant_id, playlist_id, release_id, media_asset_id, media_variant_id,
  sort_order, duration_seconds, fit_mode, muted, asset_kind, asset_title,
  storage_bucket, storage_path, mime_type, file_size_bytes, checksum_sha256,
  width, height, dynamic_snapshot_id
)
select
  item.id,
  '18000000-0000-4000-8000-000000000001',
  '18000000-0000-4000-8000-000000000121',
  '18000000-0000-4000-8000-000000000122',
  '18000000-0000-4000-8000-000000000012',
  '18000000-0000-4000-8000-000000000013',
  item.sort_order,
  10,
  'contain',
  true,
  'image',
  'S180 rollout asset',
  'tenant-media',
  'tenants/18000000-0000-4000-8000-000000000001/assets/18000000-0000-4000-8000-000000000012/original/rollout.png',
  'image/png',
  100,
  repeat('b', 64),
  1920,
  1080,
  item.snapshot_id
from (values
  ('18000000-0000-4000-8000-000000000131'::uuid, 0, '18000000-0000-4000-8000-000000000111'::uuid),
  ('18000000-0000-4000-8000-000000000132'::uuid, 1, '18000000-0000-4000-8000-000000000112'::uuid),
  ('18000000-0000-4000-8000-000000000133'::uuid, 2, '18000000-0000-4000-8000-000000000111'::uuid)
) item(id, sort_order, snapshot_id);

insert into public.screens (
  id, tenant_id, name, orientation, status, assigned_playlist_id,
  assigned_release_id
) values (
  '18000000-0000-4000-8000-000000000141',
  '18000000-0000-4000-8000-000000000001',
  'S180 rollout screen',
  'landscape',
  'active',
  '18000000-0000-4000-8000-000000000121',
  '18000000-0000-4000-8000-000000000122'
);

insert into public.playlists(id,tenant_id,name,status)
values ('18000000-0000-4000-8000-000000000901','18000000-0000-4000-8000-000000000001','Asset only','published');
insert into public.playlist_releases(id,tenant_id,playlist_id,version,manifest_hash,manifest_json,item_count,total_duration_seconds,total_bytes)
values ('18000000-0000-4000-8000-000000000902','18000000-0000-4000-8000-000000000001',
  '18000000-0000-4000-8000-000000000901',1,repeat('9',64),
  '{"schemaVersion":1,"items":[{"kind":"image"}]}',1,10,100);
insert into public.playlist_release_items(tenant_id,playlist_id,release_id,media_asset_id,media_variant_id,
  sort_order,duration_seconds,fit_mode,muted,asset_kind,asset_title,storage_bucket,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height)
select tenant_id,'18000000-0000-4000-8000-000000000901','18000000-0000-4000-8000-000000000902',media_asset_id,media_variant_id,
  0,duration_seconds,fit_mode,muted,asset_kind,asset_title,storage_bucket,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height
from public.playlist_release_items where id='18000000-0000-4000-8000-000000000131';
insert into public.screens(id,tenant_id,name,orientation,status,assigned_playlist_id,assigned_release_id,
  default_playlist_id,default_release_id,active_assignment_source)
values ('18000000-0000-4000-8000-000000000903','18000000-0000-4000-8000-000000000001','Asset screen','portrait','active',
  '18000000-0000-4000-8000-000000000901','18000000-0000-4000-8000-000000000902',
  '18000000-0000-4000-8000-000000000901','18000000-0000-4000-8000-000000000902','default');

update public.tenant_theme_profiles set selection_json=jsonb_set(selection_json,'{modePolicy}','{"kind":"fixed","mode":"light"}')
where tenant_id='18000000-0000-4000-8000-000000000001';
create temporary table recovery_before as
select id,snapshot_data_json from public.dynamic_slide_snapshots where tenant_id='18000000-0000-4000-8000-000000000001';
create temporary table recovery_releases_before as
select id,manifest_json,manifest_hash from public.playlist_releases where tenant_id='18000000-0000-4000-8000-000000000001';

insert into public.dynamic_slide_versions(id,tenant_id,dynamic_slide_id,version_number,status,name,slide_type,
  orientation,template_id,template_version_id,data_source_id,selection_mode,configuration_json,theme_selection_json,edit_revision,based_on_version_id)
select '18000000-0000-4000-8000-000000000811',tenant_id,dynamic_slide_id,2,'draft','Unpublished design',slide_type,
  orientation,template_id,template_version_id,data_source_id,selection_mode,
  configuration_json || '{"draftOnlySentinel":true}',theme_selection_json,edit_revision+1,id
from public.dynamic_slide_versions where dynamic_slide_id='18000000-0000-4000-8000-000000000101' and version_number=1;
update public.dynamic_slides set active_draft_version_id='18000000-0000-4000-8000-000000000811'
where id='18000000-0000-4000-8000-000000000101';
create temporary table recovery_draft_before as select to_jsonb(v) as value from public.dynamic_slide_versions v
where id='18000000-0000-4000-8000-000000000811';

select ok(not has_function_privilege('anon','private.start_tenant_content_recovery_v1(uuid,bigint,text,text)','execute'),'anonymous cannot invoke owner recovery');
select ok(not has_function_privilege('authenticated','private.start_tenant_content_recovery_v1(uuid,bigint,text,text)','execute'),'Studio cannot bypass normal authorization');
select ok(not has_function_privilege('service_role','private.start_tenant_content_recovery_v1(uuid,bigint,text,text)','execute'),'worker service role cannot invoke owner recovery');
select throws_ok($$select private.start_tenant_content_recovery_v1('18000000-0000-4000-8000-000000000001',999,repeat('a',40),'Test recovery after deploy')$$,'40001','tenant theme revision changed','stale revision aborts before writes');
select throws_ok($$select private.start_tenant_content_recovery_v1('18000000-0000-4000-8000-000000009999',1,repeat('a',40),'Test recovery after deploy')$$,'P0002','active recovery tenant is unavailable','missing tenant cannot be recovered');

create temporary table recovery_result as select private.start_tenant_content_recovery_v1(
  '18000000-0000-4000-8000-000000000001',
  (select revision from public.tenant_theme_profiles where tenant_id='18000000-0000-4000-8000-000000000001' and theme_id='fieldflow'),
  repeat('a',40),'Regression test after verified deployment') as rollout_id;

select is((select snapshot_count from public.tenant_theme_rollouts where id=(select rollout_id from recovery_result)),3,'all current and release-only snapshots receive new jobs');
select is((select release_target_count from public.tenant_theme_rollouts where id=(select rollout_id from recovery_result)),2,'asset-only playlist is included');
select throws_ok($$select private.start_tenant_content_recovery_v1('18000000-0000-4000-8000-000000000001',
  (select revision from public.tenant_theme_profiles where tenant_id='18000000-0000-4000-8000-000000000001' and theme_id='fieldflow'),
  repeat('a',40),'Duplicate recovery must not enqueue')$$,'55000','tenant already has an active rollout','concurrent recovery is rejected');
select ok((select bool_and(s.snapshot_data_json#>>'{themePresentation,resolvedMode,mode}'='light')
  from public.dynamic_slide_snapshots s join private.tenant_theme_rollout_snapshots m on m.new_snapshot_id=s.id
  where m.rollout_id=(select rollout_id from recovery_result)),'new snapshots inherit fixed light');
select ok((select bool_and(not(s.snapshot_data_json ? 'providerPayload'))
  from public.dynamic_slide_snapshots s join private.tenant_theme_rollout_snapshots m on m.new_snapshot_id=s.id
  where m.rollout_id=(select rollout_id from recovery_result)),'provider data is freshly built instead of copied');
select is((select s.dynamic_slide_version_id from public.dynamic_slide_snapshots s
  join private.tenant_theme_rollout_snapshots m on m.new_snapshot_id=s.id
  where m.rollout_id=(select rollout_id from recovery_result) and m.old_snapshot_id='18000000-0000-4000-8000-000000000112'),
  '18000000-0000-4000-8000-000000000202'::uuid,'recovery uses latest published design for active slides');
select is((select count(*) from public.dynamic_render_jobs j join private.tenant_theme_rollout_snapshots m on m.new_snapshot_id=j.snapshot_id
  where m.rollout_id=(select rollout_id from recovery_result)),3::bigint,'one render job per new immutable snapshot');
select is((select count(*) from private.tenant_theme_rollout_snapshots m where m.rollout_id=(select rollout_id from recovery_result)
  and m.tenant_id<>'18000000-0000-4000-8000-000000000001'),0::bigint,'no cross-tenant mappings');

-- Simulate successful renderer completion; existing triggers publish/assign.
update public.dynamic_slide_snapshots set status='ready',output_media_asset_id='18000000-0000-4000-8000-000000000012',completed_at=now()
where id in (select new_snapshot_id from private.tenant_theme_rollout_snapshots where rollout_id=(select rollout_id from recovery_result));
select is((select status from public.tenant_theme_rollouts where id=(select rollout_id from recovery_result)),'ready','rollout finishes after all render completions');
select is((select count(*) from private.tenant_theme_rollout_releases where rollout_id=(select rollout_id from recovery_result)),2::bigint,'both playlists have new immutable releases');
select ok((select assigned_release_id<>'18000000-0000-4000-8000-000000000902'::uuid and default_release_id=assigned_release_id
  from public.screens where id='18000000-0000-4000-8000-000000000903'),'official assignment advances asset-only screen');
select ok((select bool_and(b.snapshot_data_json=s.snapshot_data_json) from recovery_before b join public.dynamic_slide_snapshots s using(id)),'historical snapshots remain immutable');
select ok((select bool_and(b.manifest_json=r.manifest_json and b.manifest_hash=r.manifest_hash)
  from recovery_releases_before b join public.playlist_releases r using(id)),'historical releases remain immutable');
select is((select to_jsonb(v) from public.dynamic_slide_versions v where id='18000000-0000-4000-8000-000000000811'),
  (select value from recovery_draft_before),'unpublished draft is preserved byte for byte');
select is((select active_draft_version_id from public.dynamic_slides where id='18000000-0000-4000-8000-000000000101'),
  '18000000-0000-4000-8000-000000000811'::uuid,'current render advancement does not publish or detach the draft');
select * from finish();
rollback;
