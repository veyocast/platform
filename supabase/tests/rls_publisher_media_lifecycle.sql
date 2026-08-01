begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(23);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-4000-8000-000000000281', 'authenticated', 'authenticated', 'media-editor@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000282', 'authenticated', 'authenticated', 'media-viewer@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000283', 'authenticated', 'authenticated', 'other-media-editor@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000281', 'Media editor'),
  ('00000000-0000-4000-8000-000000000282', 'Media viewer'),
  ('00000000-0000-4000-8000-000000000283', 'Andere media-editor');

insert into public.tenants (id, name, slug)
values
  ('10000000-0000-4000-8000-000000000281', 'Media tenant', 'media-tenant'),
  ('10000000-0000-4000-8000-000000000282', 'Andere media tenant', 'andere-media-tenant');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000281', '00000000-0000-4000-8000-000000000281', 'tenant_editor'),
  ('10000000-0000-4000-8000-000000000281', '00000000-0000-4000-8000-000000000282', 'tenant_viewer'),
  ('10000000-0000-4000-8000-000000000282', '00000000-0000-4000-8000-000000000283', 'tenant_editor');

insert into public.media_assets (
  id, tenant_id, created_by, kind, title, original_file_name, mime_type,
  status, storage_path, file_size_bytes, checksum_sha256, width, height,
  processed_at, deleted_at
)
values
  (
    '20000000-0000-4000-8000-000000000281',
    '10000000-0000-4000-8000-000000000281',
    '00000000-0000-4000-8000-000000000281',
    'image', 'Actieve media', 'actief.webp', 'image/webp', 'ready',
    'tenants/10000000-0000-4000-8000-000000000281/assets/20000000-0000-4000-8000-000000000281/original/actief.webp',
    2048, repeat('a', 64), 1920, 1080, now(), null
  ),
  (
    '20000000-0000-4000-8000-000000000282',
    '10000000-0000-4000-8000-000000000281',
    '00000000-0000-4000-8000-000000000281',
    'video', 'Conceptvideo', 'concept.mp4', 'video/mp4', 'ready',
    'tenants/10000000-0000-4000-8000-000000000281/assets/20000000-0000-4000-8000-000000000282/original/concept.mp4',
    2048, repeat('b', 64), 1920, 1080, now(), null
  ),
  (
    '20000000-0000-4000-8000-000000000283',
    '10000000-0000-4000-8000-000000000281',
    '00000000-0000-4000-8000-000000000281',
    'image', 'Gearchiveerde media', 'archief.webp', 'image/webp', 'ready',
    'tenants/10000000-0000-4000-8000-000000000281/assets/20000000-0000-4000-8000-000000000283/original/archief.webp',
    2048, repeat('c', 64), 1920, 1080, now(), now()
  ),
  (
    '20000000-0000-4000-8000-000000000284',
    '10000000-0000-4000-8000-000000000282',
    '00000000-0000-4000-8000-000000000283',
    'image', 'Andere tenantmedia', 'ander.webp', 'image/webp', 'ready',
    'tenants/10000000-0000-4000-8000-000000000282/assets/20000000-0000-4000-8000-000000000284/original/ander.webp',
    2048, repeat('d', 64), 1920, 1080, now(), null
  );

insert into public.playlists (id, tenant_id, name, created_by)
values (
  '50000000-0000-4000-8000-000000000281',
  '10000000-0000-4000-8000-000000000281',
  'Mediaconcept',
  '00000000-0000-4000-8000-000000000281'
);

insert into public.playlist_items (
  id, tenant_id, playlist_id, media_asset_id, sort_order, created_by
)
values (
  '51000000-0000-4000-8000-000000000281',
  '10000000-0000-4000-8000-000000000281',
  '50000000-0000-4000-8000-000000000281',
  '20000000-0000-4000-8000-000000000282',
  0,
  '00000000-0000-4000-8000-000000000281'
);

insert into public.media_variants (
  id, tenant_id, asset_id, variant_type, storage_path, mime_type,
  file_size_bytes, checksum_sha256, width, height, duration_seconds
)
values (
  '22000000-0000-4000-8000-000000000282',
  '10000000-0000-4000-8000-000000000281',
  '20000000-0000-4000-8000-000000000282',
  'player_1080p',
  'tenants/10000000-0000-4000-8000-000000000281/assets/20000000-0000-4000-8000-000000000282/variants/player.mp4',
  'video/mp4', 2048, repeat('b', 64), 1920, 1080, 10
);

insert into public.playlist_releases (
  id, tenant_id, playlist_id, version, manifest_hash, manifest_json,
  item_count, total_duration_seconds, total_bytes, published_by
)
values (
  '70000000-0000-4000-8000-000000000281',
  '10000000-0000-4000-8000-000000000281',
  '50000000-0000-4000-8000-000000000281',
  1, repeat('e', 64), '{"schemaVersion":1,"items":[]}'::jsonb,
  1, 10, 2048, '00000000-0000-4000-8000-000000000281'
);

insert into public.playlist_release_items (
  id, tenant_id, playlist_id, release_id, source_item_id, media_asset_id,
  media_variant_id, sort_order, duration_seconds, fit_mode, muted, asset_kind,
  asset_title, storage_path, mime_type, file_size_bytes, checksum_sha256,
  width, height, asset_duration_seconds
)
values (
  '71000000-0000-4000-8000-000000000281',
  '10000000-0000-4000-8000-000000000281',
  '50000000-0000-4000-8000-000000000281',
  '70000000-0000-4000-8000-000000000281',
  '51000000-0000-4000-8000-000000000281',
  '20000000-0000-4000-8000-000000000282',
  '22000000-0000-4000-8000-000000000282',
  0, 10, 'contain', true, 'video', 'Conceptvideo',
  'tenants/10000000-0000-4000-8000-000000000281/assets/20000000-0000-4000-8000-000000000282/variants/player.mp4',
  'video/mp4', 2048, repeat('b', 64), 1920, 1080, 10
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000281', true);

select is(
  public.mutate_media_asset_v1(
    '10000000-0000-4000-8000-000000000281',
    '20000000-0000-4000-8000-000000000281',
    'rename',
    '{"title":"Nieuwe mediatitel"}'::jsonb,
    '01000000-0000-4000-8000-000000000281'
  ) ->> 'outcome',
  'applied',
  'tenant editor renames media through the guarded command'
);
select is(
  (select title from public.media_assets where id = '20000000-0000-4000-8000-000000000281'),
  'Nieuwe mediatitel',
  'guarded rename persists the normalized title'
);
select is(
  public.mutate_media_asset_v1(
    '10000000-0000-4000-8000-000000000281',
    '20000000-0000-4000-8000-000000000281',
    'rename',
    '{"title":"Nieuwe mediatitel"}'::jsonb,
    '01000000-0000-4000-8000-000000000281'
  ) ->> 'outcome',
  'applied',
  'identical command replay is idempotent'
);
select is(
  (select count(*) from public.audit_events where action = 'publisher.media.rename'),
  1::bigint,
  'idempotent rename creates one server-authoritative audit event'
);

select is(
  public.mutate_media_asset_v1(
    '10000000-0000-4000-8000-000000000281',
    '20000000-0000-4000-8000-000000000281',
    'archive',
    '{}'::jsonb,
    '01000000-0000-4000-8000-000000000282'
  ) ->> 'operation',
  'archive',
  'unused media is archived through the guarded command'
);
select ok(
  (select deleted_at is not null from public.media_assets where id = '20000000-0000-4000-8000-000000000281'),
  'archive is a recoverable logical deletion'
);
select is(
  (
    select count(*)
    from public.list_publisher_archived_media_assets_v1(
      '10000000-0000-4000-8000-000000000281'
    )
  ),
  2::bigint,
  'archive listing returns only tenant-scoped archived media'
);

select is(
  public.mutate_media_asset_v1(
    '10000000-0000-4000-8000-000000000281',
    '20000000-0000-4000-8000-000000000281',
    'restore',
    '{}'::jsonb,
    '01000000-0000-4000-8000-000000000283'
  ) ->> 'operation',
  'restore',
  'archived media can be restored through the guarded command'
);
select ok(
  (select deleted_at is null from public.media_assets where id = '20000000-0000-4000-8000-000000000281'),
  'restore returns the original media record without changing storage'
);
select is(
  (
    select count(*)
    from public.list_publisher_archived_media_assets_v1(
      '10000000-0000-4000-8000-000000000281'
    )
  ),
  1::bigint,
  'restored media leaves the archive view'
);

select throws_ok(
  $$select public.mutate_media_asset_v1(
    '10000000-0000-4000-8000-000000000281',
    '20000000-0000-4000-8000-000000000282',
    'archive',
    '{}'::jsonb,
    '01000000-0000-4000-8000-000000000284'
  )$$,
  '23514',
  'media asset is still used by a draft playlist',
  'draft video usage blocks unconfirmed archival'
);

select is(
  public.mutate_media_asset_v1(
    '10000000-0000-4000-8000-000000000281',
    '20000000-0000-4000-8000-000000000282',
    'archive',
    '{"removeDraftReferences":true,"expectedDraftCount":1}'::jsonb,
    '01000000-0000-4000-8000-000000000287'
  ) ->> 'operation',
  'archive',
  'confirmed video removal is applied atomically'
);
select ok(
  (select deleted_at is not null from public.media_assets where id = '20000000-0000-4000-8000-000000000282'),
  'confirmed video removal moves the asset to the recoverable archive'
);
select is(
  (select count(*) from public.playlist_items where media_asset_id = '20000000-0000-4000-8000-000000000282'),
  0::bigint,
  'all mutable draft placements are removed'
);
select is(
  (
    select revision::text || ':' || status::text
    from public.playlists
    where id = '50000000-0000-4000-8000-000000000281'
  ),
  '1:draft',
  'the affected concept receives one revision and remains a draft'
);
select is(
  (select count(*) from public.playlist_release_items where media_asset_id = '20000000-0000-4000-8000-000000000282'),
  1::bigint,
  'immutable release history remains intact'
);
select is(
  (select count(*) from public.audit_events where action = 'publisher.playlist.media_removed'),
  1::bigint,
  'draft impact receives a playlist audit event'
);
select is(
  public.mutate_media_asset_v1(
    '10000000-0000-4000-8000-000000000281',
    '20000000-0000-4000-8000-000000000282',
    'archive',
    '{"removeDraftReferences":true,"expectedDraftCount":1}'::jsonb,
    '01000000-0000-4000-8000-000000000287'
  ) ->> 'operation',
  'archive',
  'confirmed video removal replays idempotently'
);
select is(
  (select count(*) from public.audit_events where action = 'publisher.media.archive'),
  2::bigint,
  'idempotent replay creates no duplicate media audit event'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000282', true);
select throws_ok(
  $$select public.mutate_media_asset_v1(
    '10000000-0000-4000-8000-000000000281',
    '20000000-0000-4000-8000-000000000281',
    'rename',
    '{"title":"Viewerwijziging"}'::jsonb,
    '01000000-0000-4000-8000-000000000285'
  )$$,
  '42501',
  'actor cannot manage media for this tenant',
  'tenant viewer cannot mutate media'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000283', true);
select throws_ok(
  $$select public.mutate_media_asset_v1(
    '10000000-0000-4000-8000-000000000281',
    '20000000-0000-4000-8000-000000000281',
    'rename',
    '{"title":"Cross tenant"}'::jsonb,
    '01000000-0000-4000-8000-000000000286'
  )$$,
  '42501',
  'actor cannot manage media for this tenant',
  'another tenant cannot mutate media'
);

reset role;
select ok(
  not has_function_privilege(
    'anon',
    'public.mutate_media_asset_v1(uuid,uuid,text,jsonb,uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute media lifecycle commands'
);

select is(
  (
    select count(*)
    from public.audit_events
    where action in (
      'publisher.media.rename',
      'publisher.media.archive',
      'publisher.media.restore'
    )
      and tenant_id = '10000000-0000-4000-8000-000000000281'
  ),
  4::bigint,
  'every successful media lifecycle command is audited once'
);

select * from finish();
rollback;
