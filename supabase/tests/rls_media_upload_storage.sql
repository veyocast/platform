begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

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
    'Welkom',
    'welkom.png',
    'image/png',
    'ready',
    'tenants/10000000-0000-4000-8000-000000000001/assets/20000000-0000-4000-8000-000000000001/original/welkom.png',
    204800,
    repeat('a', 64),
    1920,
    1080,
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000006',
    'video',
    'Tenant B intro',
    'intro.mp4',
    'video/mp4',
    'ready',
    'tenants/10000000-0000-4000-8000-000000000002/assets/20000000-0000-4000-8000-000000000002/original/intro.mp4',
    1024000,
    repeat('b', 64),
    1920,
    1080,
    now()
  );

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is(
  (select count(*) from public.media_assets),
  0::bigint,
  'anonymous sees no media asset rows'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
select is(
  (
    select count(*)
    from public.media_assets
    where tenant_id = '10000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'tenant viewer can read own tenant media'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000006', true);
select is(
  (
    select count(*)
    from public.media_assets
    where tenant_id = '10000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'tenant B cannot read tenant A media'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
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
  file_size_bytes
)
values (
  '20000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000004',
  'image',
  'Nieuw posterbeeld',
  'poster.webp',
  'image/webp',
  'uploading',
  'tenants/10000000-0000-4000-8000-000000000001/assets/20000000-0000-4000-8000-000000000003/original/poster.webp',
  409600
);

insert into public.media_upload_sessions (
  id,
  tenant_id,
  asset_id,
  created_by,
  storage_path,
  expected_mime_type,
  expected_size_bytes,
  expires_at
)
values (
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
  'tenants/10000000-0000-4000-8000-000000000001/assets/20000000-0000-4000-8000-000000000003/original/poster.webp',
  'image/webp',
  409600,
  now() + interval '15 minutes'
);

insert into public.media_processing_jobs (
  id,
  tenant_id,
  asset_id,
  requested_by
)
values (
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004'
);

select is(
  (
    select count(*)
    from public.media_upload_sessions
    where asset_id = '20000000-0000-4000-8000-000000000003'
  ),
  1::bigint,
  'tenant editor can create own upload session'
);

select is(
  (
    select count(*)
    from public.media_processing_jobs
    where asset_id = '20000000-0000-4000-8000-000000000003'
  ),
  1::bigint,
  'tenant editor can enqueue own processing job'
);

select throws_ok(
  $$
    insert into public.media_assets (
      id,
      tenant_id,
      created_by,
      kind,
      title,
      original_file_name,
      mime_type,
      storage_path,
      file_size_bytes
    )
    values (
      '20000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000004',
      'image',
      'Spoofed',
      'spoofed.png',
      'image/png',
      'tenants/10000000-0000-4000-8000-000000000002/assets/20000000-0000-4000-8000-000000000004/original/spoofed.png',
      2048
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "media_assets"',
  'tenant A editor cannot create tenant B media by spoofing tenant_id'
);

insert into storage.objects (
  bucket_id,
  name,
  owner,
  metadata
)
values (
  'tenant-media',
  'tenants/10000000-0000-4000-8000-000000000001/assets/20000000-0000-4000-8000-000000000003/original/poster.webp',
  '00000000-0000-4000-8000-000000000004',
  '{}'::jsonb
);

select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'tenant-media'
      and name = 'tenants/10000000-0000-4000-8000-000000000001/assets/20000000-0000-4000-8000-000000000003/original/poster.webp'
  ),
  1::bigint,
  'tenant editor can write storage object for own media asset path'
);

select throws_ok(
  $$
    insert into storage.objects (
      bucket_id,
      name,
      owner,
      metadata
    )
    values (
      'tenant-media',
      'tenants/10000000-0000-4000-8000-000000000002/assets/20000000-0000-4000-8000-000000000002/original/intro.mp4',
      '00000000-0000-4000-8000-000000000004',
      '{}'::jsonb
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'storage path spoofing into another tenant fails'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
select throws_ok(
  $$
    insert into public.media_assets (
      id,
      tenant_id,
      created_by,
      kind,
      title,
      original_file_name,
      mime_type,
      storage_path,
      file_size_bytes
    )
    values (
      '20000000-0000-4000-8000-000000000005',
      '10000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000005',
      'image',
      'Viewer upload',
      'viewer.png',
      'image/png',
      'tenants/10000000-0000-4000-8000-000000000001/assets/20000000-0000-4000-8000-000000000005/original/viewer.png',
      2048
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "media_assets"',
  'tenant viewer cannot upload media'
);

select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'tenant-media'
      and name = 'tenants/10000000-0000-4000-8000-000000000001/assets/20000000-0000-4000-8000-000000000003/original/poster.webp'
  ),
  1::bigint,
  'tenant viewer can read own tenant storage object'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000006', true);
select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'tenant-media'
      and name = 'tenants/10000000-0000-4000-8000-000000000001/assets/20000000-0000-4000-8000-000000000003/original/poster.webp'
  ),
  0::bigint,
  'tenant B cannot read tenant A storage object'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
update public.media_assets
set title = 'Platform viewer changed this'
where id = '20000000-0000-4000-8000-000000000001';

reset role;
select is(
  (
    select title
    from public.media_assets
    where id = '20000000-0000-4000-8000-000000000001'
  ),
  'Welkom',
  'platform viewer cannot mutate media'
);

select * from finish();

rollback;
