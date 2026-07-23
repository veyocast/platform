begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(24);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  (
    '00000000-0000-4000-8000-000000000491',
    'authenticated', 'authenticated', 'release-editor@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000492',
    'authenticated', 'authenticated', 'release-viewer@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  );
insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000491', 'Release editor'),
  ('00000000-0000-4000-8000-000000000492', 'Release viewer');
insert into public.tenants (id, name, slug, screen_limit)
values (
  '10000000-0000-4000-8000-000000000491',
  'Release tenant',
  'release-tenant',
  5
);
insert into public.tenant_settings (
  tenant_id, timezone_name, default_transition, default_background_color
)
values (
  '10000000-0000-4000-8000-000000000491',
  'Europe/Amsterdam',
  'crossfade',
  '#101214'
);
insert into public.tenant_memberships (tenant_id, user_id, role)
values
  (
    '10000000-0000-4000-8000-000000000491',
    '00000000-0000-4000-8000-000000000491',
    'tenant_editor'
  ),
  (
    '10000000-0000-4000-8000-000000000491',
    '00000000-0000-4000-8000-000000000492',
    'tenant_viewer'
  );

insert into public.media_assets (
  id, tenant_id, created_by, kind, title, original_file_name, mime_type,
  status, storage_path, file_size_bytes, checksum_sha256, width, height,
  processed_at
)
values (
  '20000000-0000-4000-8000-000000000491',
  '10000000-0000-4000-8000-000000000491',
  '00000000-0000-4000-8000-000000000491',
  'image',
  'Clubwelkom',
  'welkom.webp',
  'image/webp',
  'ready',
  'tenants/10000000-0000-4000-8000-000000000491/assets/20000000-0000-4000-8000-000000000491/original/welkom.webp',
  4096,
  repeat('a', 64),
  1920,
  1080,
  now()
);
insert into public.media_variants (
  id, tenant_id, asset_id, variant_type, storage_path, mime_type,
  file_size_bytes, checksum_sha256, width, height
)
values (
  '30000000-0000-4000-8000-000000000491',
  '10000000-0000-4000-8000-000000000491',
  '20000000-0000-4000-8000-000000000491',
  'original',
  'tenants/10000000-0000-4000-8000-000000000491/assets/20000000-0000-4000-8000-000000000491/variants/original.webp',
  'image/webp',
  2048,
  repeat('b', 64),
  1920,
  1080
);
insert into public.playlists (
  id, tenant_id, name, description, created_by, updated_by,
  default_image_duration_seconds, default_transition, default_fit_mode,
  default_background_color, default_video_muted, loop_enabled
)
values (
  '50000000-0000-4000-8000-000000000491',
  '10000000-0000-4000-8000-000000000491',
  'Wedstrijddag',
  'Immutable Publisher release',
  '00000000-0000-4000-8000-000000000491',
  '00000000-0000-4000-8000-000000000491',
  12,
  'crossfade',
  'cover',
  '#101214',
  true,
  true
);
insert into public.playlist_sections (
  id, tenant_id, playlist_id, name, position_key, enabled, created_by, updated_by
)
values (
  '51000000-0000-4000-8000-000000000491',
  '10000000-0000-4000-8000-000000000491',
  '50000000-0000-4000-8000-000000000491',
  'Sponsors',
  1024,
  true,
  '00000000-0000-4000-8000-000000000491',
  '00000000-0000-4000-8000-000000000491'
), (
  '51000000-0000-4000-8000-000000000492',
  '10000000-0000-4000-8000-000000000491',
  '50000000-0000-4000-8000-000000000491',
  'Tijdelijk verborgen',
  2048,
  false,
  '00000000-0000-4000-8000-000000000491',
  '00000000-0000-4000-8000-000000000491'
);
insert into public.playlist_items (
  id, tenant_id, playlist_id, section_id, media_asset_id,
  sort_order, position_key, duration_seconds, fit_mode, muted,
  display_title, transition, crop_focus_x, crop_focus_y,
  background_color, volume_percent, trim_start_seconds, trim_end_seconds,
  visible_from, visible_until, enabled, accessibility_name, created_by
)
values (
  '52000000-0000-4000-8000-000000000491',
  '10000000-0000-4000-8000-000000000491',
  '50000000-0000-4000-8000-000000000491',
  '51000000-0000-4000-8000-000000000491',
  '20000000-0000-4000-8000-000000000491',
  0,
  1024,
  12,
  'cover',
  true,
  'Sponsorwelkom',
  'wipe',
  0.25,
  0.75,
  '#151719',
  60,
  1,
  9,
  '2026-08-01T08:00:00Z',
  '2026-08-03T08:00:00Z',
  true,
  'Welkom van de sponsor',
  '00000000-0000-4000-8000-000000000491'
), (
  '52000000-0000-4000-8000-000000000492',
  '10000000-0000-4000-8000-000000000491',
  '50000000-0000-4000-8000-000000000491',
  '51000000-0000-4000-8000-000000000492',
  '20000000-0000-4000-8000-000000000491',
  1,
  2048,
  8,
  'contain',
  true,
  'Tijdelijk verborgen',
  'cut',
  0.5,
  0.5,
  null,
  100,
  0,
  null,
  null,
  null,
  true,
  'Verborgen sponsoritem',
  '00000000-0000-4000-8000-000000000491'
);
insert into public.screens (
  id, tenant_id, name, status, created_by
)
values (
  '60000000-0000-4000-8000-000000000491',
  '10000000-0000-4000-8000-000000000491',
  'Hoofdscherm',
  'active',
  '00000000-0000-4000-8000-000000000491'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000491',
  true
);

create temporary table publish_result as
select public.publish_playlist_to_targets_v3(
  '50000000-0000-4000-8000-000000000491',
  0,
  array['60000000-0000-4000-8000-000000000491'::uuid],
  'Canonpublicatie',
  '90000000-0000-4000-8000-000000000491'
) as outcome;

select is(
  (select outcome ->> 'outcome' from publish_result),
  'published',
  'v3 publication creates an immutable release'
);
select is(
  (
    select item_count
    from public.playlist_releases
    where id = (select (outcome ->> 'releaseId')::uuid from publish_result)
  ),
  1,
  'disabled sections remain outside the immutable player release'
);
select is(
  (
    select jsonb_array_length(snapshot_json -> 'items')
    from public.playlist_release_authoring_snapshots
    where release_id = (select (outcome ->> 'releaseId')::uuid from publish_result)
  ),
  2,
  'disabled section items remain available in the lossless authoring snapshot'
);
select is(
  (
    select manifest_json #>> '{items,0,transition}'
    from public.playlist_releases
    where id = (select (outcome ->> 'releaseId')::uuid from publish_result)
  ),
  'wipe',
  'the player manifest materializes the item transition'
);
select is(
  (
    select format(
      '%s|%s|%s|%s|%s',
      manifest_json #>> '{items,0,cropFocus,x}',
      manifest_json #>> '{items,0,cropFocus,y}',
      manifest_json #>> '{items,0,volumePercent}',
      manifest_json #>> '{items,0,trim,startSeconds}',
      manifest_json #>> '{items,0,trim,endSeconds}'
    )
    from public.playlist_releases
    where id = (select (outcome ->> 'releaseId')::uuid from publish_result)
  ),
  '0.25000|0.75000|60|1.000|9.000',
  'the player manifest contains deterministic crop, volume and trim values'
);
select is(
  (
    select format(
      '%s|%s|%s',
      manifest_json #>> '{items,0,section,name}',
      manifest_json #>> '{items,0,accessibilityName}',
      manifest_json #>> '{presentationDefaults,transition}'
    )
    from public.playlist_releases
    where id = (select (outcome ->> 'releaseId')::uuid from publish_result)
  ),
  'Sponsors|Welkom van de sponsor|crossfade',
  'the immutable manifest carries section, accessibility and default presentation'
);
select is(
  (
    select manifest_hash
    from public.playlist_releases
    where id = (select (outcome ->> 'releaseId')::uuid from publish_result)
  ),
  (
    select encode(
      extensions.digest(
        pg_catalog.convert_to(manifest_json::text, 'UTF8'),
        'sha256'
      ),
      'hex'
    )
    from public.playlist_releases
    where id = (select (outcome ->> 'releaseId')::uuid from publish_result)
  ),
  'the stored manifest hash covers the fully enriched manifest'
);
select is(
  (
    select format(
      '%s|%s|%s|%s|%s',
      transition,
      crop_focus_x,
      volume_percent,
      section_name,
      enabled
    )
    from public.playlist_release_items
    where release_id = (select (outcome ->> 'releaseId')::uuid from publish_result)
  ),
  'wipe|0.25000|60|Sponsors|t',
  'immutable release rows materialize the same presentation source'
);
select is(
  (
    select count(*)
    from public.playlist_release_authoring_snapshots
    where release_id = (select (outcome ->> 'releaseId')::uuid from publish_result)
  ),
  1::bigint,
  'publication stores one lossless authoring snapshot'
);
select is(
  (
    select count(*)
    from public.publisher_target_snapshot_screens
    where snapshot_id = (
      select (outcome ->> 'targetSnapshotId')::uuid from publish_result
    )
  ),
  1::bigint,
  'publication freezes exact target provenance'
);
select is(
  (
    select assigned_release_id
    from public.screens
    where id = '60000000-0000-4000-8000-000000000491'
  ),
  (select (outcome ->> 'releaseId')::uuid from publish_result),
  'the published release becomes the durable screen default'
);
select throws_ok(
  $$update public.playlist_release_items
    set transition = 'cut'
    where release_id = (
      select (outcome ->> 'releaseId')::uuid from publish_result
    )$$,
  '42501',
  'permission denied for table playlist_release_items',
  'materialized player presentation cannot be rewritten by an editor'
);

select is(
  (
    public.mutate_playlist_draft_v2(
      '50000000-0000-4000-8000-000000000491',
      0,
      'update_item_presentation',
      '{
        "itemId":"52000000-0000-4000-8000-000000000491",
        "durationSeconds":30,
        "fitMode":"contain",
        "muted":false,
        "displayTitle":"Tijdelijke wijziging",
        "transition":"cut",
        "cropFocusX":0.5,
        "cropFocusY":0.5,
        "backgroundColor":"#FFFFFF",
        "volumePercent":100,
        "trimStartSeconds":0,
        "trimEndSeconds":null,
        "visibleFrom":null,
        "visibleUntil":null,
        "enabled":false,
        "accessibilityName":"Gewijzigde plaatsing"
      }'::jsonb,
      '90000000-0000-4000-8000-000000000492'
    ) ->> 'outcome'
  ),
  'applied',
  'the draft can diverge after publication without mutating its release'
);
select is(
  (
    public.restore_playlist_release_to_draft_v1(
      (select (outcome ->> 'releaseId')::uuid from publish_result),
      1,
      '90000000-0000-4000-8000-000000000493'
    ) ->> 'outcome'
  ),
  'restored',
  'restore creates a new draft state from the immutable authoring snapshot'
);
select is(
  (
    select format(
      '%s|%s|%s|%s|%s',
      display_title,
      transition,
      crop_focus_x,
      volume_percent,
      enabled
    )
    from public.playlist_items
    where playlist_id = '50000000-0000-4000-8000-000000000491'
      and display_title = 'Sponsorwelkom'
  ),
  'Sponsorwelkom|wipe|0.25000|60|t',
  'restore faithfully reconstructs item-owned presentation'
);
select is(
  (
    select format('%s|%s', revision, status)
    from public.playlists
    where id = '50000000-0000-4000-8000-000000000491'
  ),
  '2|draft',
  'restore advances revision and never mutates the historic release'
);
select is(
  (
    select count(*) from public.playlist_releases
    where playlist_id = '50000000-0000-4000-8000-000000000491'
  ),
  1::bigint,
  'restore does not fabricate a new release'
);
select is(
  (
    public.restore_playlist_release_to_draft_v1(
      (select (outcome ->> 'releaseId')::uuid from publish_result),
      1,
      '90000000-0000-4000-8000-000000000493'
    ) ->> 'actualRevision'
  ),
  '2',
  'an identical restore retry replays its durable idempotency receipt'
);
select is(
  (
    select revision from public.playlists
    where id = '50000000-0000-4000-8000-000000000491'
  ),
  2::bigint,
  'idempotent restore replay cannot increment the draft revision twice'
);
select throws_ok(
  $$select public.restore_playlist_release_to_draft_v1(
      (select (outcome ->> 'releaseId')::uuid from publish_result),
      2,
      '90000000-0000-4000-8000-000000000493'
    )$$,
  '23505',
  'idempotency key belongs to another publisher command',
  'an idempotency key cannot be reused for a different restore request'
);
select is(
  (
    public.restore_playlist_release_to_draft_v1(
      (select (outcome ->> 'releaseId')::uuid from publish_result),
      1,
      '90000000-0000-4000-8000-000000000494'
    ) ->> 'outcome'
  ),
  'conflict',
  'a stale restore reports the current revision without overwriting work'
);
select is(
  (
    select count(*)
    from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000000491'
      and action in (
        'publisher.playlist.published',
        'publisher.playlist.release_restored_to_draft',
        'publisher.playlist.restore_conflict'
      )
  ),
  3::bigint,
  'publish, restore and stale conflict all create server-authored audit events'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000492',
  true
);
select throws_ok(
  $$select public.restore_playlist_release_to_draft_v1(
      (select (outcome ->> 'releaseId')::uuid from publish_result),
      2,
      '90000000-0000-4000-8000-000000000495'
    )$$,
  '42501',
  'actor cannot restore this release',
  'a viewer cannot restore a release to the shared draft'
);
select is(
  (
    select title
    from public.media_assets
    where id = '20000000-0000-4000-8000-000000000491'
  ),
  'Clubwelkom',
  'publish and restore never rename reusable media'
);

select * from finish();
rollback;
