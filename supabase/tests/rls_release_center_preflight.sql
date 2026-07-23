begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(18);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000261', 'authenticated', 'authenticated', 'release-admin@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000262', 'authenticated', 'authenticated', 'release-viewer@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000263', 'authenticated', 'authenticated', 'release-other@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000261', 'Release admin'),
  ('00000000-0000-4000-8000-000000000262', 'Release viewer'),
  ('00000000-0000-4000-8000-000000000263', 'Other release admin');

insert into public.tenants (id, name, slug, screen_limit)
values
  ('10000000-0000-4000-8000-000000000261', 'Release tenant', 'release-tenant', 10),
  ('10000000-0000-4000-8000-000000000262', 'Other release tenant', 'other-release-tenant', 10);

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000261', '00000000-0000-4000-8000-000000000261', 'tenant_admin'),
  ('10000000-0000-4000-8000-000000000261', '00000000-0000-4000-8000-000000000262', 'tenant_viewer'),
  ('10000000-0000-4000-8000-000000000262', '00000000-0000-4000-8000-000000000263', 'tenant_admin');

insert into public.playlists (id, tenant_id, name, created_by)
values
  ('50000000-0000-4000-8000-000000000261', '10000000-0000-4000-8000-000000000261', 'Release historie', '00000000-0000-4000-8000-000000000261'),
  ('50000000-0000-4000-8000-000000000262', '10000000-0000-4000-8000-000000000262', 'Andere historie', '00000000-0000-4000-8000-000000000263');

insert into public.playlist_releases (
  id, tenant_id, playlist_id, version, manifest_hash, manifest_json,
  item_count, total_duration_seconds, total_bytes, published_by
)
values
  ('70000000-0000-4000-8000-000000000261', '10000000-0000-4000-8000-000000000261', '50000000-0000-4000-8000-000000000261', 1, repeat('a', 64), '{"schemaVersion":1,"items":[]}'::jsonb, 1, 10, 1024, '00000000-0000-4000-8000-000000000261'),
  ('70000000-0000-4000-8000-000000000262', '10000000-0000-4000-8000-000000000261', '50000000-0000-4000-8000-000000000261', 2, repeat('b', 64), '{"schemaVersion":1,"items":[]}'::jsonb, 1, 10, 2048, '00000000-0000-4000-8000-000000000261'),
  ('70000000-0000-4000-8000-000000000263', '10000000-0000-4000-8000-000000000262', '50000000-0000-4000-8000-000000000262', 1, repeat('c', 64), '{"schemaVersion":1,"items":[]}'::jsonb, 1, 10, 1024, '00000000-0000-4000-8000-000000000263');

insert into public.screens (id, tenant_id, name, status, orientation, created_by)
values
  ('60000000-0000-4000-8000-000000000261', '10000000-0000-4000-8000-000000000261', 'Kantine', 'active', 'landscape', '00000000-0000-4000-8000-000000000261'),
  ('60000000-0000-4000-8000-000000000262', '10000000-0000-4000-8000-000000000261', 'Bestuurskamer', 'maintenance', 'landscape', '00000000-0000-4000-8000-000000000261'),
  ('60000000-0000-4000-8000-000000000263', '10000000-0000-4000-8000-000000000261', 'Uitgeschakeld', 'disabled', 'landscape', '00000000-0000-4000-8000-000000000261'),
  ('60000000-0000-4000-8000-000000000264', '10000000-0000-4000-8000-000000000262', 'Ander scherm', 'active', 'landscape', '00000000-0000-4000-8000-000000000263');

insert into public.player_devices (
  id, tenant_id, screen_id, token_hash, status, active_release_id, desired_release_id
)
values (
  '65000000-0000-4000-8000-000000000261',
  '10000000-0000-4000-8000-000000000261',
  '60000000-0000-4000-8000-000000000261',
  repeat('d', 64),
  'paired',
  '70000000-0000-4000-8000-000000000261',
  '70000000-0000-4000-8000-000000000262'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select ok(
  public.record_player_heartbeat_v2(
    repeat('d', 64), 'DOWNLOADING',
    '70000000-0000-4000-8000-000000000261',
    '70000000-0000-4000-8000-000000000262',
    512, 4096, 'release-test', 'LG webOS',
    '{"manifestSchemaVersions":[1],"releaseHashAlgorithms":["sha256"]}'::jsonb,
    'downloading', '{"networkState":"online"}'::jsonb
  ) is not null,
  'paired Player records versioned capabilities and desired-release progress'
);

reset role;
select is((select capabilities -> 'manifestSchemaVersions' from public.player_devices where id = '65000000-0000-4000-8000-000000000261'), '[1]'::jsonb, 'heartbeat persists declared manifest compatibility');
select is((select platform from public.player_devices where id = '65000000-0000-4000-8000-000000000261'), 'LG webOS', 'heartbeat persists the detected Player platform');
select is((select release_id from public.player_sync_events where device_id = '65000000-0000-4000-8000-000000000261' order by created_at desc limit 1), '70000000-0000-4000-8000-000000000262'::uuid, 'download progress is attributed to the desired release');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000261', true);

select is(
  (
    public.reassign_playlist_release_v2(
    '70000000-0000-4000-8000-000000000261',
    array['60000000-0000-4000-8000-000000000261'::uuid, '60000000-0000-4000-8000-000000000262'::uuid],
    '01000000-0000-4000-8000-000000000261'
    ) ->> 'targetCount'
  )::integer,
  2,
  'tenant admin reassigns an existing immutable release to multiple screens'
);
select is((select count(*) from public.screens where assigned_release_id = '70000000-0000-4000-8000-000000000261'), 2::bigint, 'all selected screens receive the existing release');
select is((select desired_release_id from public.player_devices where id = '65000000-0000-4000-8000-000000000261'), '70000000-0000-4000-8000-000000000261'::uuid, 'paired device receives the reassigned desired release');
select is((select count(*) from public.release_screen_assignments where release_id = '70000000-0000-4000-8000-000000000261'), 2::bigint, 'append-only deployment history records every target');
select is((select manifest_hash from public.playlist_releases where id = '70000000-0000-4000-8000-000000000261'), repeat('a', 64), 'reassignment never mutates the immutable release');
reset role;
select throws_ok(
  $$update public.release_screen_assignments set assignment_kind = 'published' where release_id = '70000000-0000-4000-8000-000000000261'$$,
  '23514', 'playlist releases are immutable',
  'deployment history cannot be rewritten'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000261', true);
select throws_ok(
  $$select public.reassign_playlist_release_v2(
    '70000000-0000-4000-8000-000000000261',
    array['60000000-0000-4000-8000-000000000263'::uuid],
    '01000000-0000-4000-8000-000000000262'
  )$$,
  '23514', 'one or more target screens are unavailable',
  'disabled targets are rejected atomically'
);
select throws_ok(
  $$select public.reassign_playlist_release_v2(
    '70000000-0000-4000-8000-000000000261',
    array['60000000-0000-4000-8000-000000000264'::uuid],
    '01000000-0000-4000-8000-000000000263'
  )$$,
  '23514', 'one or more target screens are unavailable',
  'cross-tenant targets are rejected atomically'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000262', true);
select throws_ok(
  $$select public.reassign_playlist_release_v2(
    '70000000-0000-4000-8000-000000000261',
    array['60000000-0000-4000-8000-000000000261'::uuid],
    '01000000-0000-4000-8000-000000000264'
  )$$,
  '42501', 'actor cannot reassign this release',
  'tenant viewer cannot reassign releases'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000263', true);
select is((select count(*) from public.release_screen_assignments), 0::bigint, 'another tenant cannot read assignment history');
select throws_ok(
  $$select public.reassign_playlist_release_v2(
    '70000000-0000-4000-8000-000000000261',
    array['60000000-0000-4000-8000-000000000261'::uuid],
    '01000000-0000-4000-8000-000000000265'
  )$$,
  '42501', 'actor cannot reassign this release',
  'another tenant cannot reassign the release'
);

reset role;
select ok(not has_function_privilege('anon', 'public.reassign_playlist_release_v2(uuid,uuid[],uuid)', 'EXECUTE'), 'anonymous callers cannot reassign releases');
select ok(not has_table_privilege('authenticated', 'public.release_screen_assignments', 'INSERT'), 'authenticated clients cannot forge deployment history');
select is((select count(*) from public.audit_events where action = 'playlist.release.reassigned' and tenant_id = '10000000-0000-4000-8000-000000000261'), 1::bigint, 'successful reassignment is audited exactly once');

select * from finish();
rollback;
