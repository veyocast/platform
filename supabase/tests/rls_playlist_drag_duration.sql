begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(15);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000271', 'authenticated', 'authenticated', 'drag-editor@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000272', 'authenticated', 'authenticated', 'drag-viewer@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000271', 'Drag editor'),
  ('00000000-0000-4000-8000-000000000272', 'Drag viewer');

insert into public.tenants (id, name, slug)
values ('10000000-0000-4000-8000-000000000271', 'Drag tenant', 'drag-tenant');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000271', '00000000-0000-4000-8000-000000000271', 'tenant_editor'),
  ('10000000-0000-4000-8000-000000000271', '00000000-0000-4000-8000-000000000272', 'tenant_viewer');

insert into public.media_assets (
  id, tenant_id, created_by, kind, title, original_file_name, mime_type,
  status, storage_path, file_size_bytes, checksum_sha256, width, height,
  duration_seconds, processed_at
)
values
  (
    '20000000-0000-4000-8000-000000000271',
    '10000000-0000-4000-8000-000000000271',
    '00000000-0000-4000-8000-000000000271',
    'video', 'Video met bronduur', 'bronduur.mp4', 'video/mp4', 'ready',
    'tenants/10000000-0000-4000-8000-000000000271/assets/20000000-0000-4000-8000-000000000271/original/bronduur.mp4',
    4096, repeat('c', 64), 1920, 1080, 12.2, now()
  ),
  (
    '20000000-0000-4000-8000-000000000272',
    '10000000-0000-4000-8000-000000000271',
    '00000000-0000-4000-8000-000000000271',
    'image', 'Tweede item', 'tweede.webp', 'image/webp', 'ready',
    'tenants/10000000-0000-4000-8000-000000000271/assets/20000000-0000-4000-8000-000000000272/original/tweede.webp',
    2048, repeat('d', 64), 1920, 1080, null, now()
  );

insert into public.playlists (id, tenant_id, name, created_by, updated_by)
values (
  '50000000-0000-4000-8000-000000000271',
  '10000000-0000-4000-8000-000000000271',
  'Drag concept',
  '00000000-0000-4000-8000-000000000271',
  '00000000-0000-4000-8000-000000000271'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000271', true);

select is(
  (select outcome from public.mutate_playlist_draft_v1(
    '50000000-0000-4000-8000-000000000271', 0, 'add_item',
    '{"mediaAssetId":"20000000-0000-4000-8000-000000000271"}'::jsonb
  )),
  'applied',
  'editor adds a validated MP4 to the draft'
);

select is(
  (select duration_seconds from public.playlist_items where media_asset_id = '20000000-0000-4000-8000-000000000271'),
  13,
  'MP4 duration rounds up to the complete validated source duration'
);

select is(
  (select outcome from public.mutate_playlist_draft_v1(
    '50000000-0000-4000-8000-000000000271', 1, 'add_item',
    '{"mediaAssetId":"20000000-0000-4000-8000-000000000272"}'::jsonb
  )),
  'applied',
  'editor adds a second media item'
);

select is(
  (select outcome from public.mutate_playlist_draft_v1(
    '50000000-0000-4000-8000-000000000271', 2, 'move_item',
    jsonb_build_object(
      'itemId', (select id from public.playlist_items where media_asset_id = '20000000-0000-4000-8000-000000000271'),
      'targetPosition', 1
    )
  )),
  'applied',
  'drag reorder applies atomically at the expected revision'
);

select is(
  (select sort_order from public.playlist_items where media_asset_id = '20000000-0000-4000-8000-000000000271'),
  1,
  'dragged video receives the requested position'
);

select is(
  (select sort_order from public.playlist_items where media_asset_id = '20000000-0000-4000-8000-000000000272'),
  0,
  'intervening item shifts without duplicate positions'
);

select is(
  (select outcome from public.mutate_playlist_draft_v1(
    '50000000-0000-4000-8000-000000000271', 3, 'update_item',
    jsonb_build_object(
      'itemId', (select id from public.playlist_items where media_asset_id = '20000000-0000-4000-8000-000000000271'),
      'displayName', 'Nieuwe videonaam',
      'durationSeconds', 12,
      'fitMode', 'cover',
      'muted', true
    )
  )),
  'applied',
  'edit dialog mutation applies at the expected revision'
);

select is(
  (select title from public.media_assets where id = '20000000-0000-4000-8000-000000000271'),
  'Nieuwe videonaam',
  'item rename updates the canonical media title'
);

select is(
  (select duration_seconds from public.playlist_items where media_asset_id = '20000000-0000-4000-8000-000000000271'),
  12,
  'edited playback duration within the source is stored on the draft item'
);

select is(
  (
    public.mutate_playlist_draft_v2(
      '50000000-0000-4000-8000-000000000271',
      4,
      'move_item',
      jsonb_build_object(
        'itemId', (
          select id
          from public.playlist_items
          where media_asset_id = '20000000-0000-4000-8000-000000000271'
        ),
        'targetPosition', 0
      ),
      '90000000-0000-4000-8000-000000000271'
    ) ->> 'outcome'
  ),
  'applied',
  'guarded drag reorder resolves the schema-qualified position constraint'
);

select ok(
  (
    select video.position_key < image.position_key
    from public.playlist_items video
    join public.playlist_items image
      on image.playlist_id = video.playlist_id
    where video.media_asset_id = '20000000-0000-4000-8000-000000000271'
      and image.media_asset_id = '20000000-0000-4000-8000-000000000272'
  ),
  'guarded drag reorder updates the canonical position key'
);

select is(
  (
    select sort_order
    from public.playlist_items
    where media_asset_id = '20000000-0000-4000-8000-000000000271'
  ),
  0,
  'guarded drag reorder keeps the legacy sort order synchronized'
);

select is(
  (select outcome from public.mutate_playlist_draft_v1(
    '50000000-0000-4000-8000-000000000271', 3, 'move_item',
    jsonb_build_object(
      'itemId', (select id from public.playlist_items where media_asset_id = '20000000-0000-4000-8000-000000000271'),
      'targetPosition', 0
    )
  )),
  'conflict',
  'stale drag cannot overwrite the newer draft revision'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000272', true);

select throws_ok(
  $$select * from public.mutate_playlist_draft_v1(
    '50000000-0000-4000-8000-000000000271', 4, 'move_item',
    jsonb_build_object(
      'itemId', (select id from public.playlist_items where media_asset_id = '20000000-0000-4000-8000-000000000271'),
      'targetPosition', 0
    )
  )$$,
  '42501',
  'actor cannot mutate this playlist',
  'tenant viewer cannot reorder playlist items'
);

reset role;
select ok(
  not has_function_privilege('anon', 'public.mutate_playlist_draft_v1(uuid,bigint,text,jsonb)', 'EXECUTE'),
  'anonymous cannot execute drag or item mutations'
);

select * from finish();
rollback;
