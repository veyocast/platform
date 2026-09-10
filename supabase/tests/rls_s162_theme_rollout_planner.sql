begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

-- Keep the fixture deliberately small, but exercise the two source paths used
-- by the planner: a current published snapshot and snapshots referenced by an
-- active immutable release. The release references snapshot A twice so the
-- source collapse must preserve one mapping and its current-pointer flag.
insert into public.tenants (id, name, slug, status) values (
  '16200000-0000-4000-8000-000000000001',
  'S162 rollout planner',
  's162-rollout-planner',
  'active'
);

insert into public.tenant_settings (tenant_id) values (
  '16200000-0000-4000-8000-000000000001'
);

insert into public.dynamic_data_sources (
  id, tenant_id, name, kind, status, provider_status, config_json
) values (
  '16200000-0000-4000-8000-000000000011',
  '16200000-0000-4000-8000-000000000001',
  'S162 rollout source',
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
  '16200000-0000-4000-8000-000000000012',
  '16200000-0000-4000-8000-000000000001',
  'image',
  'S162 rollout asset',
  'rollout.png',
  'image/png',
  'ready',
  'tenant-media',
  'tenants/16200000-0000-4000-8000-000000000001/assets/16200000-0000-4000-8000-000000000012/original/rollout.png',
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
  '16200000-0000-4000-8000-000000000013',
  '16200000-0000-4000-8000-000000000001',
  '16200000-0000-4000-8000-000000000012',
  'original',
  'tenant-media',
  'tenants/16200000-0000-4000-8000-000000000001/assets/16200000-0000-4000-8000-000000000012/original/rollout.png',
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
  '16200000-0000-4000-8000-000000000001',
  fixture.name,
  'menu',
  'landscape',
  template.id,
  template.current_published_version_id,
  '16200000-0000-4000-8000-000000000011',
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
  ('16200000-0000-4000-8000-000000000101'::uuid, 'S162 rollout slide A'),
  ('16200000-0000-4000-8000-000000000102'::uuid, 'S162 rollout slide B')
) fixture(id, name);

update public.dynamic_slide_versions version
set status = 'published',
    published_at = now()
where version.dynamic_slide_id in (
  '16200000-0000-4000-8000-000000000101'::uuid,
  '16200000-0000-4000-8000-000000000102'::uuid
);

update public.dynamic_slides slide
set current_published_version_id = slide.active_draft_version_id,
    active_draft_version_id = null
where slide.id in (
  '16200000-0000-4000-8000-000000000101'::uuid,
  '16200000-0000-4000-8000-000000000102'::uuid
);

-- Publish a newer design for slide B, while its active release below keeps
-- pointing at B's original immutable version. A correct rollout must retain
-- that historical version on the release-only source row.
insert into public.dynamic_slide_versions (
  id, tenant_id, dynamic_slide_id, version_number, status, name, slide_type,
  orientation, template_id, template_version_id, data_source_id,
  selection_mode, configuration_json, theme_selection_json, edit_revision,
  based_on_version_id, published_at
)
select
  '16200000-0000-4000-8000-000000000202',
  version.tenant_id,
  version.dynamic_slide_id,
  2,
  'published',
  'S162 rollout slide B current',
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
  '16200000-0000-4000-8000-000000000102'::uuid
  and version.version_number = 1;

update public.dynamic_slides slide
set current_published_version_id =
      '16200000-0000-4000-8000-000000000202'::uuid
where slide.id = '16200000-0000-4000-8000-000000000102'::uuid;

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
  '16200000-0000-4000-8000-000000000012',
  now()
from public.dynamic_slides slide
join (values
  (
    '16200000-0000-4000-8000-000000000101'::uuid,
    '16200000-0000-4000-8000-000000000111'::uuid,
    repeat('1', 64),
    'A',
    1
  ),
  (
    '16200000-0000-4000-8000-000000000102'::uuid,
    '16200000-0000-4000-8000-000000000112'::uuid,
    repeat('2', 64),
    'B',
    1
  ),
  (
    '16200000-0000-4000-8000-000000000102'::uuid,
    '16200000-0000-4000-8000-000000000113'::uuid,
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
    (slide.id = '16200000-0000-4000-8000-000000000101'::uuid
      and snapshot.id = '16200000-0000-4000-8000-000000000111'::uuid)
    or
    (slide.id = '16200000-0000-4000-8000-000000000102'::uuid
      and snapshot.id = '16200000-0000-4000-8000-000000000113'::uuid)
  );

insert into public.playlists (id, tenant_id, name, status) values (
  '16200000-0000-4000-8000-000000000121',
  '16200000-0000-4000-8000-000000000001',
  'S162 actieve playlist',
  'published'
);

insert into public.playlist_releases (
  id, tenant_id, playlist_id, version, release_notes, manifest_hash,
  manifest_json, item_count, total_duration_seconds, total_bytes
) values (
  '16200000-0000-4000-8000-000000000122',
  '16200000-0000-4000-8000-000000000001',
  '16200000-0000-4000-8000-000000000121',
  1,
  'S162 active source release',
  repeat('3', 64),
  '{"fixture":true}'::jsonb,
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
  '16200000-0000-4000-8000-000000000001',
  '16200000-0000-4000-8000-000000000121',
  '16200000-0000-4000-8000-000000000122',
  '16200000-0000-4000-8000-000000000012',
  '16200000-0000-4000-8000-000000000013',
  item.sort_order,
  10,
  'contain',
  true,
  'image',
  'S162 rollout asset',
  'tenant-media',
  'tenants/16200000-0000-4000-8000-000000000001/assets/16200000-0000-4000-8000-000000000012/original/rollout.png',
  'image/png',
  100,
  repeat('b', 64),
  1920,
  1080,
  item.snapshot_id
from (values
  ('16200000-0000-4000-8000-000000000131'::uuid, 0, '16200000-0000-4000-8000-000000000111'::uuid),
  ('16200000-0000-4000-8000-000000000132'::uuid, 1, '16200000-0000-4000-8000-000000000112'::uuid),
  ('16200000-0000-4000-8000-000000000133'::uuid, 2, '16200000-0000-4000-8000-000000000111'::uuid)
) item(id, sort_order, snapshot_id);

insert into public.screens (
  id, tenant_id, name, orientation, status, assigned_playlist_id,
  assigned_release_id
) values (
  '16200000-0000-4000-8000-000000000141',
  '16200000-0000-4000-8000-000000000001',
  'S162 rollout screen',
  'landscape',
  'active',
  '16200000-0000-4000-8000-000000000121',
  '16200000-0000-4000-8000-000000000122'
);

create temporary table s162_rollout_result as
select private.start_tenant_theme_rollout_v2(
  '16200000-0000-4000-8000-000000000001',
  'fieldflow',
  (
    select revision
    from public.tenant_theme_profiles
    where tenant_id = '16200000-0000-4000-8000-000000000001'
      and theme_id = 'fieldflow'
  ),
  null,
  null
) as rollout_id;

select ok(
  (select rollout_id is not null from s162_rollout_result),
  'set-based theme planner returns a rollout identity for multiple sources'
);

select is(
  (
    select pg_catalog.jsonb_build_object(
      'snapshotCount', rollout.snapshot_count,
      'releaseTargetCount', rollout.release_target_count,
      'status', rollout.status
    )
    from public.tenant_theme_rollouts rollout
    join s162_rollout_result result on result.rollout_id = rollout.id
  ),
  '{"snapshotCount":3,"releaseTargetCount":1,"status":"rendering"}'::jsonb,
  'planner counts three unique source snapshots and one active release branch'
);

select is(
  (
    select count(*)
    from private.tenant_theme_rollout_snapshots mapping
    join s162_rollout_result result on result.rollout_id = mapping.rollout_id
    where mapping.tenant_id = '16200000-0000-4000-8000-000000000001'
      and mapping.advance_current
  ),
  2::bigint,
  'current snapshots remain advanceable while a historical release source stays pinned'
);

select is(
  (
    select count(*)
    from public.dynamic_slide_snapshots snapshot
    join s162_rollout_result result
      on snapshot.snapshot_data_json #>> '{_veyocastThemeRollout,id}' =
        result.rollout_id::text
    where snapshot.tenant_id = '16200000-0000-4000-8000-000000000001'
      and snapshot.status = 'queued'
  ),
  3::bigint,
  'planner creates one queued immutable successor per unique source snapshot'
);

select is(
  (
    select count(*)
    from public.dynamic_render_jobs job
    join public.dynamic_slide_snapshots snapshot
      on snapshot.tenant_id = job.tenant_id
     and snapshot.id = job.snapshot_id
    join s162_rollout_result result
      on snapshot.snapshot_data_json #>> '{_veyocastThemeRollout,id}' =
        result.rollout_id::text
  ),
  3::bigint,
  'planner queues exactly one render job per successor snapshot'
);

select ok(
  (
    select count(*) = 1
      and bool_and(branch.source_release_id =
        '16200000-0000-4000-8000-000000000122'::uuid)
    from private.tenant_theme_rollout_release_branches branch
    join s162_rollout_result result on result.rollout_id = branch.rollout_id
  ),
  'planner freezes every active release into one replacement branch'
);

select ok(
  (
    select bool_and(snapshot.status = 'ready')
      and bool_and(slide.current_snapshot_id = snapshot.id)
    from public.dynamic_slide_snapshots snapshot
    join public.dynamic_slides slide
      on slide.tenant_id = snapshot.tenant_id
     and slide.current_snapshot_id = snapshot.id
    where snapshot.id in (
      '16200000-0000-4000-8000-000000000111'::uuid,
      '16200000-0000-4000-8000-000000000113'::uuid
    )
  ),
  'planner leaves the last-known-good snapshots and pointers untouched'
);

select is(
  (
    select count(*)
    from private.tenant_theme_rollout_snapshots mapping
    join s162_rollout_result result on result.rollout_id = mapping.rollout_id
  ),
  3::bigint,
  'source collapse prevents duplicate rollout mappings while retaining history'
);

select ok(
  (
    select bool_and(snapshot.snapshot_data_json -> 'providerPayload' =
        pg_catalog.jsonb_build_object('fixture', case mapping.old_snapshot_id
          when '16200000-0000-4000-8000-000000000111'::uuid then 'A'
          when '16200000-0000-4000-8000-000000000112'::uuid then 'B'
          else 'B-current'
        end))
    from private.tenant_theme_rollout_snapshots mapping
    join public.dynamic_slide_snapshots snapshot
      on snapshot.tenant_id = mapping.tenant_id
     and snapshot.id = mapping.new_snapshot_id
    join s162_rollout_result result on result.rollout_id = mapping.rollout_id
  ),
  'successors preserve provider-owned source payloads while adding theme metadata'
);

select ok(
  (
    select bool_and(new_snapshot.dynamic_slide_version_id = old_snapshot.dynamic_slide_version_id)
    from private.tenant_theme_rollout_snapshots mapping
    join public.dynamic_slide_snapshots old_snapshot
      on old_snapshot.tenant_id = mapping.tenant_id
     and old_snapshot.id = mapping.old_snapshot_id
    join public.dynamic_slide_snapshots new_snapshot
      on new_snapshot.tenant_id = mapping.tenant_id
     and new_snapshot.id = mapping.new_snapshot_id
    join s162_rollout_result result on result.rollout_id = mapping.rollout_id
  ),
  'release-only historical snapshots retain their immutable design version identity'
);

select * from finish();
rollback;
