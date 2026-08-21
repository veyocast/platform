begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values (
  '00000000-0000-4000-8000-000000001131', 'authenticated', 'authenticated',
  'extended-media@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
);
insert into public.profiles (id, display_name)
values ('00000000-0000-4000-8000-000000001131', 'Extended media editor');
insert into public.tenants (id, name, slug)
values ('10000000-0000-4000-8000-000000001131', 'Extended media', 'extended-media');
insert into public.tenant_memberships (tenant_id, user_id, role)
values (
  '10000000-0000-4000-8000-000000001131',
  '00000000-0000-4000-8000-000000001131',
  'tenant_editor'
);

select lives_ok(
  $$insert into public.media_assets (
    id, tenant_id, created_by, kind, title, original_file_name, mime_type,
    status, storage_path, file_size_bytes, width, height
  ) values
    ('20000000-0000-4000-8000-000000001131', '10000000-0000-4000-8000-000000001131', '00000000-0000-4000-8000-000000001131', 'video', 'Animatie', 'animatie.gif', 'image/gif', 'processing', 'tenants/10000000-0000-4000-8000-000000001131/assets/20000000-0000-4000-8000-000000001131/original/animatie.gif', 1024, 1080, 1920),
    ('20000000-0000-4000-8000-000000001132', '10000000-0000-4000-8000-000000001131', '00000000-0000-4000-8000-000000001131', 'image', 'Vectorlogo', 'logo.svg', 'image/svg+xml', 'ready', 'tenants/10000000-0000-4000-8000-000000001131/assets/20000000-0000-4000-8000-000000001132/original/logo.svg', 512, 400, 200)$$,
  'the canonical media table routes GIF through video processing and accepts sanitized SVG'
);

select throws_ok(
  $$update public.media_assets set tintable = true where id = '20000000-0000-4000-8000-000000001131'$$,
  '23514',
  'new row for relation "media_assets" violates check constraint "media_assets_tintable_svg_v2_check"',
  'a raster or animated asset can never be marked tintable'
);

select lives_ok(
  $$update public.media_assets set tintable = true where id = '20000000-0000-4000-8000-000000001132'$$,
  'a sanitized single-color SVG may be marked tintable'
);

select is(
  (select allowed_mime_types @> array['image/gif', 'image/svg+xml', 'video/webm'] from storage.buckets where id = 'tenant-media'),
  true,
  'the private tenant bucket allows every extended Menu Studio format'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001131', true);

create temporary table extended_media_intent as
select * from public.create_media_video_upload_intent(
  '10000000-0000-4000-8000-000000001131',
  'WebM bron',
  'webm-bron.webm',
  'video/webm',
  4096,
  '30000000-0000-4000-8000-000000001131'
);
grant select on extended_media_intent to authenticated;

select is(
  (select storage_path like '%.webm' from extended_media_intent),
  true,
  'WebM upload intent preserves the validated extension'
);

select is(
  (select mime_type from public.media_assets where id = (select asset_id from extended_media_intent)),
  'video/webm',
  'WebM upload intent stores the source MIME type'
);

select throws_ok(
  $$select * from public.create_media_video_upload_intent(
    '10000000-0000-4000-8000-000000001131',
    'Mismatch', 'mismatch.mp4', 'video/webm', 4096,
    '30000000-0000-4000-8000-000000001132'
  )$$,
  '22023',
  'video upload intent is invalid',
  'WebM MIME and extension must match'
);

reset role;
insert into storage.objects (bucket_id, name, owner, metadata)
select
  'tenant-media', storage_path, '00000000-0000-4000-8000-000000001131',
  '{"size":4096,"mimetype":"video/webm"}'::jsonb
from extended_media_intent;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001131', true);

select lives_ok(
  $$select public.finalize_media_video_upload_v2((select upload_session_id from extended_media_intent))$$,
  'the existing idempotent finalizer queues a verified WebM source'
);

select is(
  (select status::text from public.media_assets where id = (select asset_id from extended_media_intent)),
  'processing',
  'WebM remains unavailable until normalized by the worker'
);

select is(
  (select count(*) from public.media_processing_jobs where asset_id = (select asset_id from extended_media_intent)),
  1::bigint,
  'WebM finalization queues exactly one normalization job'
);

select * from finish();
rollback;
