begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(20);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-4000-8000-000000000241', 'authenticated', 'authenticated', 's24-editor@veyocast.test', 'test', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-4000-8000-000000000242', 'authenticated', 'authenticated', 's24-viewer@veyocast.test', 'test', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-4000-8000-000000000243', 'authenticated', 'authenticated', 's24-other@veyocast.test', 'test', now(), now(), now(), '{}', '{}');

insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-000000000241', 'S24 editor'),
  ('00000000-0000-4000-8000-000000000242', 'S24 viewer'),
  ('00000000-0000-4000-8000-000000000243', 'S24 other tenant');

insert into public.tenants (id, name, slug, media_storage_limit_bytes) values
  ('10000000-0000-4000-8000-000000000241', 'S24 tenant A', 's24-tenant-a', 524288000),
  ('10000000-0000-4000-8000-000000000242', 'S24 tenant B', 's24-tenant-b', 524288000);

insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('10000000-0000-4000-8000-000000000241', '00000000-0000-4000-8000-000000000241', 'tenant_editor'),
  ('10000000-0000-4000-8000-000000000241', '00000000-0000-4000-8000-000000000242', 'tenant_viewer'),
  ('10000000-0000-4000-8000-000000000242', '00000000-0000-4000-8000-000000000243', 'tenant_admin');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000241', true);

create temporary table s24_intent on commit drop as
select * from public.create_media_video_upload_intent(
  '10000000-0000-4000-8000-000000000241',
  'Hervatbare introductie',
  'intro.mp4',
  'video/mp4',
  10485760,
  '24000000-0000-4000-8000-000000000001'
);

select is((select count(*) from s24_intent), 1::bigint, 'editor creates one resumable upload intent');

select is(
  (select upload_session_id from public.create_media_video_upload_intent(
    '10000000-0000-4000-8000-000000000241', 'Hervatbare introductie',
    'intro.mp4', 'video/mp4', 10485760,
    '24000000-0000-4000-8000-000000000001'
  )),
  (select upload_session_id from s24_intent),
  'replaying the idempotency key resumes the same session'
);

select is(
  (select count(*) from public.media_upload_sessions where tenant_id = '10000000-0000-4000-8000-000000000241'),
  1::bigint,
  'idempotent replay does not create a duplicate session'
);

select throws_ok(
  $$select * from public.create_media_video_upload_intent(
    '10000000-0000-4000-8000-000000000241', 'Andere titel',
    'intro.mp4', 'video/mp4', 10485760,
    '24000000-0000-4000-8000-000000000001'
  )$$,
  '23505',
  'idempotency key belongs to another or expired upload intent',
  'replay with changed metadata is rejected'
);

select throws_ok(
  $$select * from public.create_media_video_upload_intent(
    '10000000-0000-4000-8000-000000000242', 'Tenant B aanval',
    'intro.mp4', 'video/mp4', 1048576,
    '24000000-0000-4000-8000-000000000002'
  )$$,
  '42501',
  'an active writable tenant is required',
  'editor cannot create an intent in another tenant'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000242', true);
select throws_ok(
  $$select * from public.create_media_video_upload_intent(
    '10000000-0000-4000-8000-000000000241', 'Viewer aanval',
    'intro.mp4', 'video/mp4', 1048576,
    '24000000-0000-4000-8000-000000000003'
  )$$,
  '42501',
  'an active writable tenant is required',
  'tenant viewer cannot create an upload intent'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000241', true);

select throws_ok(
  $$select * from public.create_media_video_upload_intent(
    '10000000-0000-4000-8000-000000000241', 'Traversal',
    '../intro.mp4', 'video/mp4', 1048576,
    '24000000-0000-4000-8000-000000000004'
  )$$,
  '22023', 'video upload intent is invalid',
  'path traversal in a filename is rejected server-side'
);

select throws_ok(
  $$select * from public.create_media_video_upload_intent(
    '10000000-0000-4000-8000-000000000241', 'Verkeerd MIME',
    'intro.mp4', 'video/quicktime', 1048576,
    '24000000-0000-4000-8000-000000000005'
  )$$,
  '22023', 'video upload intent is invalid',
  'MIME mismatch is rejected server-side'
);

select throws_ok(
  $$select * from public.create_media_video_upload_intent(
    '10000000-0000-4000-8000-000000000241', 'Te groot',
    'intro.mp4', 'video/mp4', 524288001,
    '24000000-0000-4000-8000-000000000006'
  )$$,
  '22023', 'video upload intent is invalid',
  'oversized videos are rejected server-side'
);

select throws_ok(
  $$select * from public.create_media_video_upload_intent(
    '10000000-0000-4000-8000-000000000241', 'Quota overschrijding',
    'groot.mp4', 'video/mp4', 524288000,
    '24000000-0000-4000-8000-000000000007'
  )$$,
  '53100', 'tenant media storage quota would be exceeded',
  'reserved uploads count toward the tenant quota'
);

insert into storage.objects (bucket_id, name, owner, metadata)
select storage_bucket, storage_path, '00000000-0000-4000-8000-000000000241',
  jsonb_build_object('size', 10485760, 'mimetype', 'video/mp4')
from s24_intent;

select is(
  (select count(*) from storage.objects where name = (select storage_path from s24_intent)),
  1::bigint,
  'storage RLS accepts only the exact active upload intent path'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner, metadata)
    select 'tenant-media',
      regexp_replace(storage_path, 'intro\.mp4$', 'ander.mp4'),
      '00000000-0000-4000-8000-000000000241', '{}'::jsonb
    from s24_intent$$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'a sibling path without an exact upload intent is rejected'
);

create temporary table s24_finalize_intent on commit drop as
select * from public.create_media_video_upload_intent(
  '10000000-0000-4000-8000-000000000241',
  'Finalisatie replay',
  'finalize.mp4',
  'video/mp4',
  1048576,
  '24000000-0000-4000-8000-000000000008'
);

insert into storage.objects (bucket_id, name, owner, metadata)
select storage_bucket, storage_path, '00000000-0000-4000-8000-000000000241',
  jsonb_build_object('size', '1048576', 'mimetype', 'video/mp4')
from s24_finalize_intent;

create temporary table s24_finalized on commit drop as
select * from public.finalize_media_video_upload_v2(
  (select upload_session_id from s24_finalize_intent)
);

select is((select count(*) from s24_finalized), 1::bigint, 'finalize creates one processing result');

select is(
  (select job_id from public.finalize_media_video_upload_v2(
    (select upload_session_id from s24_finalize_intent)
  )),
  (select job_id from s24_finalized),
  'finalize replay returns the same processing job'
);

select is(
  (select count(*) from public.media_processing_jobs
    where asset_id = (select asset_id from s24_finalize_intent)),
  1::bigint,
  'finalize replay does not enqueue a duplicate processing job'
);

do $$ begin
  perform public.create_media_video_upload_intent('10000000-0000-4000-8000-000000000241', 'Batch twee', 'batch-2.mp4', 'video/mp4', 1024, '24000000-0000-4000-8000-000000000009');
  perform public.create_media_video_upload_intent('10000000-0000-4000-8000-000000000241', 'Batch drie', 'batch-3.mp4', 'video/mp4', 1024, '24000000-0000-4000-8000-000000000010');
  perform public.create_media_video_upload_intent('10000000-0000-4000-8000-000000000241', 'Batch vier', 'batch-4.mp4', 'video/mp4', 1024, '24000000-0000-4000-8000-000000000011');
  perform public.create_media_video_upload_intent('10000000-0000-4000-8000-000000000241', 'Batch vijf', 'batch-5.mp4', 'video/mp4', 1024, '24000000-0000-4000-8000-000000000012');
end $$;

select throws_ok(
  $$select * from public.create_media_video_upload_intent(
    '10000000-0000-4000-8000-000000000241', 'Batch zes',
    'batch-6.mp4', 'video/mp4', 1024,
    '24000000-0000-4000-8000-000000000013'
  )$$,
  '54000', 'actor has too many pending media upload intents',
  'per-actor pending intent limit bounds upload batches'
);

select ok(
  public.cancel_media_video_upload((select upload_session_id from s24_intent)),
  'pending upload can be cancelled explicitly'
);

select is(
  (select status::text from public.media_assets where id = (select asset_id from s24_intent)),
  'deleted',
  'cancelled upload is unavailable to playlists and releases quota'
);

select ok(
  public.cancel_media_video_upload((select upload_session_id from s24_intent)),
  'cancelling an already cancelled upload is idempotent'
);

select is(
  (select count(*) from information_schema.columns
    where table_schema = 'public'
      and table_name = 'media_upload_sessions'
      and column_name in ('token', 'signed_url', 'signed_upload_url', 'access_token')),
  0::bigint,
  'signed URLs and access tokens are never persisted in upload sessions'
);

select * from finish();
rollback;
