begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(15);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000105', 'authenticated', 'authenticated', 'author-admin@castivo.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated', 'author-editor@castivo.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000103', 'authenticated', 'authenticated', 'author-viewer@castivo.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000104', 'authenticated', 'authenticated', 'other-admin@castivo.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000105', 'Author admin'),
  ('00000000-0000-4000-8000-000000000102', 'Author editor'),
  ('00000000-0000-4000-8000-000000000103', 'Author viewer'),
  ('00000000-0000-4000-8000-000000000104', 'Other admin');

insert into public.tenants (id, name, slug)
values
  ('10000000-0000-4000-8000-000000000101', 'Author tenant', 'author-tenant'),
  ('10000000-0000-4000-8000-000000000102', 'Other tenant', 'other-author-tenant')
on conflict (id) do nothing;

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000105', 'tenant_admin'),
  ('10000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102', 'tenant_editor'),
  ('10000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000103', 'tenant_viewer'),
  ('10000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000104', 'tenant_admin');

insert into public.media_assets (id, tenant_id, created_by, kind, title, original_file_name, mime_type, status, storage_path, file_size_bytes, checksum_sha256, processed_at)
values
  ('20000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102', 'image', 'Eerste beeld', 'eerste.webp', 'image/webp', 'ready', 'tenants/10000000-0000-4000-8000-000000000101/assets/20000000-0000-4000-8000-000000000101/original/eerste.webp', 1000, repeat('a', 64), now()),
  ('20000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102', 'image', 'Tweede beeld', 'tweede.webp', 'image/webp', 'ready', 'tenants/10000000-0000-4000-8000-000000000101/assets/20000000-0000-4000-8000-000000000102/original/tweede.webp', 1000, repeat('b', 64), now()),
  ('20000000-0000-4000-8000-000000000103', '10000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102', 'video', 'Retry video', 'retry.mp4', 'video/mp4', 'validation_failed', 'tenants/10000000-0000-4000-8000-000000000101/assets/20000000-0000-4000-8000-000000000103/original/retry.mp4', 2000, null, null);

insert into public.playlists (id, tenant_id, name, created_by)
values ('50000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000101', 'Reorder concept', '00000000-0000-4000-8000-000000000102');

insert into public.playlist_items (id, tenant_id, playlist_id, media_asset_id, sort_order, created_by)
values
  ('51000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000101', '50000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000101', 0, '00000000-0000-4000-8000-000000000102'),
  ('51000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000101', '50000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000102', 1, '00000000-0000-4000-8000-000000000102');

insert into public.media_processing_jobs (id, tenant_id, asset_id, status, attempt_count, error_code, error_message, finished_at, requested_by)
values ('30000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000103', 'failed', 3, 'command_failed', 'ffmpeg failed', now(), '00000000-0000-4000-8000-000000000102');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000105', true);

select lives_ok(
  $$select public.update_tenant_control_settings('10000000-0000-4000-8000-000000000101', 'Nieuwe clubnaam', 12, 'cover', true, 'portrait', 1080, 1920)$$,
  'tenant admin can atomically update tenant control settings'
);

select is((select name from public.tenants where id = '10000000-0000-4000-8000-000000000101'), 'Nieuwe clubnaam', 'settings update changes the own tenant name');
select is((select default_image_duration_seconds from public.tenant_settings where tenant_id = '10000000-0000-4000-8000-000000000101'), 12, 'settings update persists playback defaults');
select is((select count(*) from public.audit_events where tenant_id = '10000000-0000-4000-8000-000000000101' and action = 'tenant.settings.updated'), 1::bigint, 'settings update writes an audit event');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
select throws_ok(
  $$select public.update_tenant_control_settings('10000000-0000-4000-8000-000000000101', 'Editor wijziging', 10, 'contain', true, 'landscape', 1920, 1080)$$,
  '42501',
  'actor cannot update tenant settings',
  'tenant editor cannot update tenant settings'
);

select lives_ok($$select public.reorder_playlist_item('51000000-0000-4000-8000-000000000102', -1)$$, 'tenant editor can reorder own playlist items');
select is((select sort_order from public.playlist_items where id = '51000000-0000-4000-8000-000000000102'), 0, 'reorder swaps item positions atomically');

reset role;
update public.playlists
set status = 'archived', archived_at = now()
where id = '50000000-0000-4000-8000-000000000101';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
select throws_ok(
  $$select public.reorder_playlist_item('51000000-0000-4000-8000-000000000102', 1)$$,
  '23514',
  'archived playlists cannot be reordered',
  'archived playlist items cannot be reordered through the security definer function'
);

select lives_ok($$select public.retry_media_processing('20000000-0000-4000-8000-000000000103')$$, 'tenant editor can retry own failed video');
select is((select status::text from public.media_processing_jobs where id = '30000000-0000-4000-8000-000000000101'), 'queued', 'retry returns the failed job to the queue');
select is((select status::text from public.media_assets where id = '20000000-0000-4000-8000-000000000103'), 'processing', 'retry marks the video as processing');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000103', true);
select throws_ok(
  $$select public.reorder_playlist_item('51000000-0000-4000-8000-000000000101', 1)$$,
  '42501',
  'actor cannot reorder this playlist',
  'tenant viewer cannot reorder playlist items'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000104', true);
select is((select count(*) from public.tenant_settings where tenant_id = '10000000-0000-4000-8000-000000000101'), 0::bigint, 'another tenant cannot read settings');
select throws_ok(
  $$select public.retry_media_processing('20000000-0000-4000-8000-000000000103')$$,
  '42501',
  'actor cannot retry this media asset',
  'another tenant cannot retry media processing'
);

reset role;
select ok(not has_function_privilege('anon', 'public.update_tenant_control_settings(uuid,text,integer,text,boolean,text,integer,integer)', 'EXECUTE'), 'anonymous users cannot update tenant settings');

select * from finish();
rollback;
