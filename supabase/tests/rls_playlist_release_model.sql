begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(16);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'platform-admin@castivo.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'platform-viewer@castivo.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'tenant-a-admin@castivo.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'tenant-a-editor@castivo.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000005',
    'authenticated',
    'authenticated',
    'tenant-a-viewer@castivo.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000006',
    'authenticated',
    'authenticated',
    'tenant-b-admin@castivo.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  );

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000001', 'Platform admin'),
  ('00000000-0000-4000-8000-000000000002', 'Platform viewer'),
  ('00000000-0000-4000-8000-000000000003', 'Tenant A admin'),
  ('00000000-0000-4000-8000-000000000004', 'Tenant A editor'),
  ('00000000-0000-4000-8000-000000000005', 'Tenant A viewer'),
  ('00000000-0000-4000-8000-000000000006', 'Tenant B admin');

insert into public.tenants (id, name, slug)
values
  ('10000000-0000-4000-8000-000000000001', 'Tenant A', 'tenant-a'),
  ('10000000-0000-4000-8000-000000000002', 'Tenant B', 'tenant-b');

insert into public.platform_memberships (user_id, role)
values
  ('00000000-0000-4000-8000-000000000001', 'platform_admin'),
  ('00000000-0000-4000-8000-000000000002', 'platform_viewer');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000003',
    'tenant_admin'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000004',
    'tenant_editor'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000005',
    'tenant_viewer'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000006',
    'tenant_admin'
  );

insert into public.media_assets (
  id,
  tenant_id,
  created_by,
  kind,
  title,
  original_file_name,
  mime_type,
  status,
  storage_path,
  file_size_bytes,
  checksum_sha256,
  width,
  height,
  processed_at
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000004',
    'image',
    'Zomerroute poster',
    'zomerroute.webp',
    'image/webp',
    'ready',
    'tenants/10000000-0000-4000-8000-000000000001/assets/20000000-0000-4000-8000-000000000001/original/zomerroute.webp',
    204800,
    repeat('a', 64),
    1920,
    1080,
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000004',
    'image',
    'Nog verwerken',
    'processing.webp',
    'image/webp',
    'processing',
    'tenants/10000000-0000-4000-8000-000000000001/assets/20000000-0000-4000-8000-000000000002/original/processing.webp',
    204800,
    null,
    null,
    null,
    null
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000006',
    'image',
    'Tenant B poster',
    'tenant-b.webp',
    'image/webp',
    'ready',
    'tenants/10000000-0000-4000-8000-000000000002/assets/20000000-0000-4000-8000-000000000003/original/tenant-b.webp',
    204800,
    repeat('b', 64),
    1920,
    1080,
    now()
  );

insert into public.media_variants (
  id,
  tenant_id,
  asset_id,
  variant_type,
  storage_path,
  mime_type,
  file_size_bytes,
  checksum_sha256,
  width,
  height
)
values
  (
    '21000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'original',
    'tenants/10000000-0000-4000-8000-000000000001/assets/20000000-0000-4000-8000-000000000001/original/zomerroute.webp',
    'image/webp',
    204800,
    repeat('a', 64),
    1920,
    1080
  ),
  (
    '21000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000003',
    'original',
    'tenants/10000000-0000-4000-8000-000000000002/assets/20000000-0000-4000-8000-000000000003/original/tenant-b.webp',
    'image/webp',
    204800,
    repeat('b', 64),
    1920,
    1080
  );

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);

insert into public.playlists (
  id,
  tenant_id,
  name,
  description,
  created_by
)
values (
  '50000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Zomerroute',
  'Daglus voor de entree',
  '00000000-0000-4000-8000-000000000004'
);

select is(
  (
    select count(*)
    from public.playlists
    where id = '50000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'tenant editor can create an own tenant playlist'
);

insert into public.playlist_items (
  id,
  tenant_id,
  playlist_id,
  media_asset_id,
  sort_order,
  duration_seconds,
  fit_mode,
  created_by
)
values (
  '51000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  0,
  12,
  'contain',
  '00000000-0000-4000-8000-000000000004'
);

select is(
  (
    select count(*)
    from public.playlist_items
    where playlist_id = '50000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'tenant editor can add ready media to own playlist'
);

select ok(
  (
    select can_publish
    from public.review_playlist_publish('50000000-0000-4000-8000-000000000001')
  ),
  'publish review marks ready playlist as publishable'
);

select ok(
  public.publish_playlist(
    '50000000-0000-4000-8000-000000000001',
    'Goedgekeurde zomerroute'
  ) is not null,
  'tenant editor can publish an immutable playlist release'
);

select is(
  (
    select version
    from public.playlist_releases
    where playlist_id = '50000000-0000-4000-8000-000000000001'
  ),
  1,
  'first playlist release gets version 1'
);

select is(
  (
    select count(*)
    from public.playlist_release_items
    where playlist_id = '50000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'publish creates immutable release item snapshots'
);

reset role;
select throws_ok(
  $$
    update public.playlist_releases
    set release_notes = 'Mutated'
    where playlist_id = '50000000-0000-4000-8000-000000000001'
  $$,
  '23514',
  'playlist releases are immutable',
  'release rows reject updates even for table owner'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select throws_ok(
  $$
    insert into public.playlist_releases (
      tenant_id,
      playlist_id,
      version,
      manifest_hash,
      manifest_json,
      item_count,
      total_duration_seconds,
      total_bytes,
      published_by
    )
    values (
      '10000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      99,
      repeat('c', 64),
      '{"items":[]}'::jsonb,
      1,
      12,
      204800,
      '00000000-0000-4000-8000-000000000004'
    )
  $$,
  '42501',
  'permission denied for table playlist_releases',
  'tenant editor cannot insert release rows directly'
);

select throws_ok(
  $$
    insert into public.playlist_items (
      id,
      tenant_id,
      playlist_id,
      media_asset_id,
      sort_order,
      created_by
    )
    values (
      '51000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      1,
      '00000000-0000-4000-8000-000000000004'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "playlist_items"',
  'tenant editor cannot add media that is not ready'
);

insert into public.playlists (
  id,
  tenant_id,
  name,
  created_by
)
values (
  '50000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  'Lege playlist',
  '00000000-0000-4000-8000-000000000004'
);

select throws_ok(
  $$
    select public.publish_playlist(
      '50000000-0000-4000-8000-000000000002',
      'Geen items'
    )
  $$,
  '23514',
  'playlist has no items to publish',
  'empty playlists cannot be published'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
select throws_ok(
  $$
    insert into public.playlists (
      id,
      tenant_id,
      name,
      created_by
    )
    values (
      '50000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000001',
      'Viewer concept',
      '00000000-0000-4000-8000-000000000005'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "playlists"',
  'tenant viewer cannot create playlists'
);

select throws_ok(
  $$
    select public.publish_playlist(
      '50000000-0000-4000-8000-000000000001',
      'Viewer publish'
    )
  $$,
  '42501',
  'actor cannot publish this playlist',
  'tenant viewer cannot publish playlists'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000006', true);
select is(
  (
    select count(*)
    from public.playlists
    where tenant_id = '10000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'tenant B cannot read tenant A playlists'
);

select throws_ok(
  $$
    insert into public.playlist_items (
      id,
      tenant_id,
      playlist_id,
      media_asset_id,
      sort_order,
      created_by
    )
    values (
      '51000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      2,
      '00000000-0000-4000-8000-000000000006'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "playlist_items"',
  'tenant B cannot write tenant A playlist items by spoofing tenant_id'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
update public.playlists
set name = 'Platform viewer changed this'
where id = '50000000-0000-4000-8000-000000000001';

reset role;
select is(
  (
    select name
    from public.playlists
    where id = '50000000-0000-4000-8000-000000000001'
  ),
  'Zomerroute',
  'platform viewer cannot mutate playlists'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is(
  (
    select count(*)
    from public.playlists
  ),
  0::bigint,
  'anonymous sees no playlist rows'
);

select * from finish();

rollback;
