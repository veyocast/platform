begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  (
    '00000000-0000-4000-8000-000000000921', 'authenticated', 'authenticated',
    'video-editor@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000922', 'authenticated', 'authenticated',
    'video-viewer@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  );

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000921', 'Video editor'),
  ('00000000-0000-4000-8000-000000000922', 'Video viewer');

insert into public.tenants (id, name, slug)
values ('10000000-0000-4000-8000-000000000921', 'Video tenant', 'video-tenant');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  (
    '10000000-0000-4000-8000-000000000921',
    '00000000-0000-4000-8000-000000000921',
    'tenant_editor'
  ),
  (
    '10000000-0000-4000-8000-000000000921',
    '00000000-0000-4000-8000-000000000922',
    'tenant_viewer'
  );

insert into public.media_assets (
  id, tenant_id, created_by, kind, title, original_file_name, mime_type,
  status, storage_path, file_size_bytes
)
values
  (
    '20000000-0000-4000-8000-000000000921',
    '10000000-0000-4000-8000-000000000921',
    '00000000-0000-4000-8000-000000000921',
    'video', 'Geldige video', 'geldig.mp4', 'video/mp4', 'uploading',
    'tenants/10000000-0000-4000-8000-000000000921/assets/20000000-0000-4000-8000-000000000921/original/geldig.mp4',
    4096
  ),
  (
    '20000000-0000-4000-8000-000000000922',
    '10000000-0000-4000-8000-000000000921',
    '00000000-0000-4000-8000-000000000921',
    'video', 'Verkeerde grootte', 'verkeerd.mp4', 'video/mp4', 'uploading',
    'tenants/10000000-0000-4000-8000-000000000921/assets/20000000-0000-4000-8000-000000000922/original/verkeerd.mp4',
    2048
  );

insert into public.media_upload_sessions (
  id, tenant_id, asset_id, created_by, storage_path,
  expected_mime_type, expected_size_bytes, expires_at
)
values
  (
    '30000000-0000-4000-8000-000000000921',
    '10000000-0000-4000-8000-000000000921',
    '20000000-0000-4000-8000-000000000921',
    '00000000-0000-4000-8000-000000000921',
    'tenants/10000000-0000-4000-8000-000000000921/assets/20000000-0000-4000-8000-000000000921/original/geldig.mp4',
    'video/mp4', 4096, now() + interval '15 minutes'
  ),
  (
    '30000000-0000-4000-8000-000000000922',
    '10000000-0000-4000-8000-000000000921',
    '20000000-0000-4000-8000-000000000922',
    '00000000-0000-4000-8000-000000000921',
    'tenants/10000000-0000-4000-8000-000000000921/assets/20000000-0000-4000-8000-000000000922/original/verkeerd.mp4',
    'video/mp4', 2048, now() + interval '15 minutes'
  );

insert into storage.objects (bucket_id, name, owner, metadata)
values
  (
    'tenant-media',
    'tenants/10000000-0000-4000-8000-000000000921/assets/20000000-0000-4000-8000-000000000921/original/geldig.mp4',
    '00000000-0000-4000-8000-000000000921',
    '{"size": 4096, "mimetype": "video/mp4"}'::jsonb
  ),
  (
    'tenant-media',
    'tenants/10000000-0000-4000-8000-000000000921/assets/20000000-0000-4000-8000-000000000922/original/verkeerd.mp4',
    '00000000-0000-4000-8000-000000000921',
    '{"size": 1024, "mimetype": "video/mp4"}'::jsonb
  );

select ok(
  not has_function_privilege('anon', 'public.finalize_media_video_upload(uuid)', 'EXECUTE'),
  'anonymous users cannot finalize video uploads'
);
select ok(
  has_function_privilege('authenticated', 'public.finalize_media_video_upload(uuid)', 'EXECUTE'),
  'authenticated users may call the scoped finalizer'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000922', true);
select throws_ok(
  $$select public.finalize_media_video_upload('30000000-0000-4000-8000-000000000921')$$,
  '42501',
  'upload session is outside the writable tenant scope',
  'tenant viewers cannot finalize uploads'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000921', true);
select lives_ok(
  $$select public.finalize_media_video_upload('30000000-0000-4000-8000-000000000921')$$,
  'tenant editors can finalize a verified storage object'
);

select is(
  (select status::text from public.media_upload_sessions where id = '30000000-0000-4000-8000-000000000921'),
  'uploaded',
  'finalization closes the upload session'
);
select is(
  (select status::text from public.media_assets where id = '20000000-0000-4000-8000-000000000921'),
  'processing',
  'finalization makes the asset unavailable but processing'
);
select is(
  (select count(*) from public.media_processing_jobs where asset_id = '20000000-0000-4000-8000-000000000921'),
  1::bigint,
  'finalization enqueues exactly one processing job'
);
select is(
  (select requested_by from public.media_processing_jobs where asset_id = '20000000-0000-4000-8000-000000000921'),
  '00000000-0000-4000-8000-000000000921'::uuid,
  'the processing job records the authenticated requester'
);

select lives_ok(
  $$select public.finalize_media_video_upload('30000000-0000-4000-8000-000000000921')$$,
  'repeating finalization is idempotent'
);
select is(
  (select count(*) from public.media_processing_jobs where asset_id = '20000000-0000-4000-8000-000000000921'),
  1::bigint,
  'idempotent finalization does not duplicate the processing job'
);

select throws_ok(
  $$select public.finalize_media_video_upload('30000000-0000-4000-8000-000000000922')$$,
  '22023',
  'uploaded storage metadata does not match the session',
  'a storage object with the wrong size is rejected'
);
select is(
  (select status::text from public.media_assets where id = '20000000-0000-4000-8000-000000000922'),
  'uploading',
  'a rejected object is never queued or made ready'
);

select * from finish();
rollback;
