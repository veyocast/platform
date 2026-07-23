begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(6);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values (
  '00000000-0000-4000-8000-000000000291',
  'authenticated', 'authenticated', 'duration-editor@veyocast.test',
  'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
);

insert into public.profiles (id, display_name)
values ('00000000-0000-4000-8000-000000000291', 'Duration editor');

insert into public.tenants (id, name, slug)
values (
  '10000000-0000-4000-8000-000000000291',
  'Duration tenant',
  'duration-tenant'
);

insert into public.tenant_memberships (tenant_id, user_id, role)
values (
  '10000000-0000-4000-8000-000000000291',
  '00000000-0000-4000-8000-000000000291',
  'tenant_editor'
);

insert into public.media_assets (
  id, tenant_id, created_by, kind, title, original_file_name, mime_type,
  status, storage_path, file_size_bytes, checksum_sha256, width, height,
  duration_seconds, processed_at
)
values
  (
    '20000000-0000-4000-8000-000000000291',
    '10000000-0000-4000-8000-000000000291',
    '00000000-0000-4000-8000-000000000291',
    'video', 'Bronvideo', 'bron.mp4', 'video/mp4', 'ready',
    'tenants/10000000-0000-4000-8000-000000000291/assets/20000000-0000-4000-8000-000000000291/original/bron.mp4',
    4096, repeat('a', 64), 1920, 1080, 12.2, now()
  ),
  (
    '20000000-0000-4000-8000-000000000292',
    '10000000-0000-4000-8000-000000000291',
    '00000000-0000-4000-8000-000000000291',
    'image', 'Bronafbeelding', 'bron.webp', 'image/webp', 'ready',
    'tenants/10000000-0000-4000-8000-000000000291/assets/20000000-0000-4000-8000-000000000292/original/bron.webp',
    2048, repeat('b', 64), 1920, 1080, null, now()
  );

insert into public.playlists (id, tenant_id, name, created_by)
values (
  '50000000-0000-4000-8000-000000000291',
  '10000000-0000-4000-8000-000000000291',
  'Videoduurconcept',
  '00000000-0000-4000-8000-000000000291'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000291',
  true
);

select lives_ok(
  $$
    insert into public.playlist_items (
      id, tenant_id, playlist_id, media_asset_id, sort_order,
      duration_seconds, created_by
    )
    values (
      '51000000-0000-4000-8000-000000000291',
      '10000000-0000-4000-8000-000000000291',
      '50000000-0000-4000-8000-000000000291',
      '20000000-0000-4000-8000-000000000291',
      0, 13, '00000000-0000-4000-8000-000000000291'
    )
  $$,
  'a video may use its rounded-up source duration'
);

select throws_ok(
  $$
    update public.playlist_items
    set duration_seconds = 14
    where id = '51000000-0000-4000-8000-000000000291'
  $$,
  '23514',
  'playlist video duration exceeds the available source duration',
  'a video cannot be extended past its source'
);

select lives_ok(
  $$
    update public.playlist_items
    set duration_seconds = 8,
        trim_start_seconds = 2,
        trim_end_seconds = 10
    where id = '51000000-0000-4000-8000-000000000291'
  $$,
  'duration may equal the selected trim range'
);

select throws_ok(
  $$
    update public.playlist_items
    set duration_seconds = 9
    where id = '51000000-0000-4000-8000-000000000291'
  $$,
  '23514',
  'playlist video duration exceeds the available source duration',
  'a trimmed video cannot outlive the selected range'
);

select throws_ok(
  $$
    update public.playlist_items
    set duration_seconds = 5,
        trim_start_seconds = 12.2,
        trim_end_seconds = null
    where id = '51000000-0000-4000-8000-000000000291'
  $$,
  '23514',
  'playlist video trim falls outside the source duration',
  'a trim start must remain inside the source'
);

select lives_ok(
  $$
    insert into public.playlist_items (
      id, tenant_id, playlist_id, media_asset_id, sort_order,
      duration_seconds, created_by
    )
    values (
      '51000000-0000-4000-8000-000000000292',
      '10000000-0000-4000-8000-000000000291',
      '50000000-0000-4000-8000-000000000291',
      '20000000-0000-4000-8000-000000000292',
      1, 120, '00000000-0000-4000-8000-000000000291'
    )
  $$,
  'image durations continue to use the playlist duration range'
);

select * from finish();
rollback;
