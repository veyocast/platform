begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(19);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values (
  '00000000-0000-4000-8000-000000000102',
  'authenticated',
  'authenticated',
  'slice-tenant-b@castivo.test',
  'test',
  now(), now(), now(), '{}'::jsonb, '{}'::jsonb
);

insert into public.profiles (id, display_name)
values ('00000000-0000-4000-8000-000000000102', 'Slice tenant B');

insert into public.tenants (id, name, slug)
values (
  '10000000-0000-4000-8000-000000000102',
  'Slice tenant B',
  'slice-tenant-b'
);

insert into public.tenant_memberships (tenant_id, user_id, role)
values (
  '10000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000102',
  'tenant_admin'
);

insert into public.media_assets (
  id, tenant_id, created_by, kind, title, original_file_name,
  mime_type, status, storage_path, file_size_bytes, checksum_sha256, processed_at
)
values (
  '20000000-0000-4000-8000-000000000101',
  '10000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000101',
  'image',
  'Pilotafbeelding',
  'pilot.png',
  'image/png',
  'ready',
  'tenants/10000000-0000-4000-8000-000000000101/assets/20000000-0000-4000-8000-000000000101/original/pilot.png',
  1024,
  repeat('a', 64),
  now()
);

insert into public.media_variants (
  id, tenant_id, asset_id, variant_type, storage_path,
  mime_type, file_size_bytes, checksum_sha256
)
values (
  '30000000-0000-4000-8000-000000000101',
  '10000000-0000-4000-8000-000000000101',
  '20000000-0000-4000-8000-000000000101',
  'original',
  'tenants/10000000-0000-4000-8000-000000000101/assets/20000000-0000-4000-8000-000000000101/original/pilot.png',
  'image/png',
  1024,
  repeat('a', 64)
);

insert into public.playlists (id, tenant_id, name, created_by)
values (
  '50000000-0000-4000-8000-000000000101',
  '10000000-0000-4000-8000-000000000101',
  'Live slicetest',
  '00000000-0000-4000-8000-000000000101'
);

insert into public.playlist_items (
  id, tenant_id, playlist_id, media_asset_id, sort_order,
  duration_seconds, fit_mode, muted, created_by
)
values (
  '51000000-0000-4000-8000-000000000101',
  '10000000-0000-4000-8000-000000000101',
  '50000000-0000-4000-8000-000000000101',
  '20000000-0000-4000-8000-000000000101',
  0, 10, 'contain', true,
  '00000000-0000-4000-8000-000000000101'
);

create temporary table live_slice_results (
  pairing_session_id uuid,
  player_device_id uuid,
  heartbeat_id uuid,
  release_id uuid
);

insert into live_slice_results default values;
grant select, update on live_slice_results to anon, authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}',
  true
);
select is(
  private.current_user_id(),
  '00000000-0000-4000-8000-000000000101'::uuid,
  'current user helper reads the real PostgREST request.jwt.claims shape'
);
select set_config('request.jwt.claims', '', true);

select ok(
  has_table_privilege('service_role', 'public.media_assets', 'UPDATE'),
  'server-only service role can finish media validation'
);
select ok(
  has_table_privilege('service_role', 'public.media_variants', 'INSERT'),
  'server-only service role can register verified media variants'
);
select ok(
  has_table_privilege('service_role', 'public.playlist_releases', 'SELECT'),
  'server-only service role can read immutable release metadata'
);
select ok(
  has_table_privilege('service_role', 'public.playlist_release_items', 'SELECT'),
  'server-only service role can read immutable release items'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

update live_slice_results
set pairing_session_id = public.create_pairing_session_v2(
  encode(extensions.digest('ABC234', 'sha256'), 'hex'),
  encode(extensions.digest('slice-device-secret', 'sha256'), 'hex'),
  encode(extensions.digest('slice-fingerprint', 'sha256'), 'hex')
);

select ok(
  (select pairing_session_id is not null from live_slice_results),
  'anonymous Player can create a token-owning pairing session'
);

select is(
  (select count(*) from public.pairing_sessions),
  0::bigint,
  'anonymous Player cannot enumerate pairing sessions or pending token hashes'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);

select throws_ok(
  $$
    select public.claim_pairing_session_v2(
      encode(extensions.digest('ABC234', 'sha256'), 'hex'),
      '10000000-0000-4000-8000-000000000101',
      '40000000-0000-4000-8000-000000000101',
      'Cross-tenant Player'
    )
  $$,
  '42501',
  'actor cannot pair devices for this tenant',
  'tenant B cannot claim a pairing session for tenant A'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);

update live_slice_results
set player_device_id = public.claim_pairing_session_v2(
  encode(extensions.digest('ABC234', 'sha256'), 'hex'),
  '10000000-0000-4000-8000-000000000101',
  '40000000-0000-4000-8000-000000000101',
  'Live slice Player'
);

select ok(
  (select player_device_id is not null from live_slice_results),
  'tenant owner can claim the Player-owned pairing session'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (
    select screen_id
    from public.get_player_device_bootstrap(
      encode(extensions.digest('slice-device-secret', 'sha256'), 'hex')
    )
  ),
  '40000000-0000-4000-8000-000000000101'::uuid,
  'hashed device token resolves only to its paired screen bootstrap'
);

select is(
  (
    select count(*)
    from public.player_devices
    where token_hash = 'slice-device-secret'
  ),
  0::bigint,
  'plaintext device token is never stored'
);

update live_slice_results
set heartbeat_id = public.record_player_heartbeat(
  encode(extensions.digest('slice-device-secret', 'sha256'), 'hex'),
  'PLAYING',
  null,
  512,
  4096,
  'test-1',
  'active',
  '{"source":"pgtap"}'::jsonb
);

select ok(
  (select heartbeat_id is not null from live_slice_results),
  'paired Player can record a heartbeat without a Supabase Auth-user'
);

select throws_ok(
  $$
    select count(*) from public.player_heartbeats
  $$,
  '42501',
  'permission denied for table player_heartbeats',
  'anonymous callers cannot read heartbeat telemetry'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);

select is(
  (select count(*) from public.player_heartbeats),
  1::bigint,
  'tenant owner can read own Player heartbeat'
);

update live_slice_results
set release_id = public.publish_playlist_to_screens(
  '50000000-0000-4000-8000-000000000101',
  array['40000000-0000-4000-8000-000000000101'::uuid],
  'Live slice test'
);

select ok(
  (select release_id is not null from live_slice_results),
  'tenant owner atomically publishes an immutable release'
);

select is(
  (
    select assigned_release_id
    from public.screens
    where id = '40000000-0000-4000-8000-000000000101'
  ),
  (select release_id from live_slice_results),
  'atomic publish assigns the new release to the target screen'
);

select is(
  (
    select desired_release_id
    from public.player_devices
    where id = (select player_device_id from live_slice_results)
  ),
  (select release_id from live_slice_results),
  'atomic publish updates the paired Player desired release'
);

reset role;
select throws_ok(
  $$
    update public.playlist_releases
    set release_notes = 'Mutated'
    where id = (select release_id from live_slice_results)
  $$,
  '23514',
  'playlist releases are immutable',
  'live slice release rejects mutation'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
select is(
  (select count(*) from public.player_heartbeats),
  0::bigint,
  'tenant B cannot read tenant A heartbeat telemetry'
);

select * from finish();
rollback;
