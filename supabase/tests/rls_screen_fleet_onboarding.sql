begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(33);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-4000-8000-000000000271', 'authenticated', 'authenticated', 'fleet-admin@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000272', 'authenticated', 'authenticated', 'fleet-viewer@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000273', 'authenticated', 'authenticated', 'fleet-other@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000271', 'Fleet admin'),
  ('00000000-0000-4000-8000-000000000272', 'Fleet viewer'),
  ('00000000-0000-4000-8000-000000000273', 'Other fleet admin');

insert into public.tenants (id, name, slug, screen_limit)
values
  ('10000000-0000-4000-8000-000000000271', 'Fleet tenant', 'fleet-tenant', 1),
  ('10000000-0000-4000-8000-000000000272', 'Other fleet tenant', 'other-fleet-tenant', 2);

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000271', '00000000-0000-4000-8000-000000000271', 'tenant_admin'),
  ('10000000-0000-4000-8000-000000000271', '00000000-0000-4000-8000-000000000272', 'tenant_viewer'),
  ('10000000-0000-4000-8000-000000000272', '00000000-0000-4000-8000-000000000273', 'tenant_admin');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000271', true);

select ok(
  public.create_screen_v1(
    '10000000-0000-4000-8000-000000000271', 'Kantine links', 'Kantine',
    'landscape', 1920, 1080, null
  ) is not null,
  'transactional screen command creates a screen'
);
select is(
  (select count(*) from public.screens where tenant_id = '10000000-0000-4000-8000-000000000271'),
  1::bigint,
  'screen command writes exactly one tenant-scoped screen'
);
select is(
  (select count(*) from public.audit_events where tenant_id = '10000000-0000-4000-8000-000000000271' and action = 'screen.created'),
  1::bigint,
  'screen creation is audited once'
);
select throws_ok(
  $$select public.create_screen_v1('10000000-0000-4000-8000-000000000271', 'Tweede scherm', '', 'landscape', 1920, 1080, null)$$,
  'P0001', 'tenant screen limit reached',
  'screen limit is enforced inside the transaction boundary'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000272', true);
select throws_ok(
  $$select public.create_screen_v1('10000000-0000-4000-8000-000000000271', 'Viewer scherm', '', 'landscape', 1920, 1080, null)$$,
  '42501', 'actor cannot manage screens for this tenant',
  'tenant viewer cannot create a screen through the command'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000273', true);
select throws_ok(
  $$select public.update_screen_v1('10000000-0000-4000-8000-000000000271', (select id from public.screens where tenant_id = '10000000-0000-4000-8000-000000000271'), 'Spoof', '', 'landscape', 1920, 1080, 'active')$$,
  '42501', 'actor cannot manage screens for this tenant',
  'another tenant cannot update the screen'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select ok(
  (public.create_pairing_session_v3(repeat('a', 64), repeat('b', 64), repeat('c', 64)) ->> 'ok')::boolean,
  'anonymous Player creates a bounded hashed pairing session'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000271', true);
select ok(
  (public.claim_pairing_session_v3(
    repeat('a', 64),
    '10000000-0000-4000-8000-000000000271',
    (select id from public.screens where tenant_id = '10000000-0000-4000-8000-000000000271'),
    'LG kantine'
  ) ->> 'ok')::boolean,
  'tenant admin claims the pending Player session'
);
select is(
  (select status from public.player_devices where tenant_id = '10000000-0000-4000-8000-000000000271' order by created_at desc limit 1),
  'paired'::public.player_device_status,
  'claim creates one paired device'
);
select is(
  public.claim_pairing_session_v3(
    repeat('a', 64),
    '10000000-0000-4000-8000-000000000271',
    (select id from public.screens where tenant_id = '10000000-0000-4000-8000-000000000271'),
    'Replay'
  ) ->> 'code',
  'INVALID_OR_REPLAYED',
  'a claimed code cannot be replayed'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select ok(
  (public.create_pairing_session_v3(repeat('d', 64), repeat('e', 64), repeat('f', 64)) ->> 'ok')::boolean,
  'second Player session is available for wrong-tenant proof'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000273', true);
select throws_ok(
  $$select public.claim_pairing_session_v3(repeat('d', 64), '10000000-0000-4000-8000-000000000271', (select id from public.screens where tenant_id = '10000000-0000-4000-8000-000000000271'), 'Wrong tenant')$$,
  '42501', 'actor cannot pair devices for this tenant',
  'wrong-tenant actor cannot consume a valid code'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000271', true);
select ok(
  public.rename_player_device_v1(
    '10000000-0000-4000-8000-000000000271',
    (select id from public.player_devices where tenant_id = '10000000-0000-4000-8000-000000000271' and status = 'paired'),
    'Kantine webOS'
  ) is not null,
  'admin renames a device through the guarded command'
);
select is(
  (select device_name from public.player_devices where tenant_id = '10000000-0000-4000-8000-000000000271' and status = 'paired'),
  'Kantine webOS',
  'device rename is persisted'
);
select ok(
  public.update_screen_v1(
    '10000000-0000-4000-8000-000000000271',
    (select id from public.screens where tenant_id = '10000000-0000-4000-8000-000000000271'),
    'Kantine links', 'Kantine', 'landscape', 1920, 1080, 'maintenance'
  ) is not null,
  'screen enters maintenance transactionally'
);
select is(
  (select status from public.player_devices where tenant_id = '10000000-0000-4000-8000-000000000271' and device_name = 'Kantine webOS'),
  'paired'::public.player_device_status,
  'maintenance preserves the paired identity and offline last-known-good path'
);
select throws_ok(
  $$select public.request_screen_sync_retry_v1('10000000-0000-4000-8000-000000000271', (select id from public.screens where tenant_id = '10000000-0000-4000-8000-000000000271'))$$,
  'P0002', 'active paired device not found',
  'maintenance screen refuses a sync retry'
);
select ok(
  public.update_screen_v1(
    '10000000-0000-4000-8000-000000000271',
    (select id from public.screens where tenant_id = '10000000-0000-4000-8000-000000000271'),
    'Kantine links', 'Kantine', 'landscape', 1920, 1080, 'active'
  ) is not null,
  'screen can return to active state'
);
select ok(
  public.request_screen_sync_retry_v1(
    '10000000-0000-4000-8000-000000000271',
    (select id from public.screens where tenant_id = '10000000-0000-4000-8000-000000000271')
  ) is not null,
  'active paired screen accepts a controlled retry request'
);
select ok(
  (select sync_retry_requested_at is not null from public.player_devices where tenant_id = '10000000-0000-4000-8000-000000000271' and status = 'paired'),
  'retry request remains visible until the Player reconnects'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select ok(
  public.record_player_heartbeat_v2(
    repeat('b', 64), 'ERROR_RECOVERABLE', null, null, 100, 1000,
    '1.0.0', 'LG webOS', '{"manifestSchemaVersions":[1]}'::jsonb,
    'failed', '{"lastPlaybackError":{"code":"VIDEO_STALLED"}}'::jsonb
  ) is not null,
  'paired Player records the first operational heartbeat'
);
reset role;
select is(
  (select last_error_code from public.player_devices where tenant_id = '10000000-0000-4000-8000-000000000271' and status = 'paired'),
  'VIDEO_STALLED',
  'only the allowlisted safe Player error code is persisted'
);
select ok(
  (select sync_retry_requested_at is null from public.player_devices where tenant_id = '10000000-0000-4000-8000-000000000271' and status = 'paired'),
  'heartbeat acknowledges and clears the retry request'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000271', true);
select ok(
  public.revoke_player_device_v1(
    '10000000-0000-4000-8000-000000000271',
    (select id from public.player_devices where tenant_id = '10000000-0000-4000-8000-000000000271' and status = 'paired')
  ) is not null,
  'admin revokes the device explicitly'
);
reset role;
set local role anon;
select is(
  (select count(*) from public.get_player_device_bootstrap(repeat('b', 64))),
  0::bigint,
  'revoked device cannot bootstrap'
);
select throws_ok(
  $$select public.record_player_heartbeat_v2(repeat('b', 64), 'READY', null, null, null, null, '1.0.0', 'LG webOS', '{}'::jsonb, null, '{}'::jsonb)$$,
  'P0002', 'active device not found',
  'revoked device heartbeat fails closed'
);

reset role;
insert into private.pairing_creation_attempts(fingerprint_hash, outcome)
select repeat('9', 64), 'created' from generate_series(1, 5);
set local role anon;
select is(
  public.create_pairing_session_v3(repeat('1', 64), repeat('2', 64), repeat('9', 64)) ->> 'code',
  'RATE_LIMITED',
  'pairing creation is rate limited durably per device fingerprint'
);

reset role;
insert into private.pairing_claim_attempts(actor_user_id, outcome)
select '00000000-0000-4000-8000-000000000271', 'invalid' from generate_series(1, 10);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000271', true);
select is(
  public.claim_pairing_session_v3(
    repeat('7', 64), '10000000-0000-4000-8000-000000000271',
    (select id from public.screens where tenant_id = '10000000-0000-4000-8000-000000000271'), 'Rate limited'
  ) ->> 'code',
  'RATE_LIMITED',
  'pairing claims are rate limited per authenticated actor'
);
select ok(
  not has_table_privilege('authenticated', 'private.pairing_claim_attempts', 'SELECT'),
  'pairing rate-limit evidence is not exposed to browser roles'
);

reset role;
delete from private.pairing_claim_attempts where actor_user_id = '00000000-0000-4000-8000-000000000271';
set local role anon;
select ok(
  (public.create_pairing_session_v3(repeat('3', 64), repeat('4', 64), repeat('5', 64)) ->> 'ok')::boolean,
  'a fresh Player can be paired after the previous device was revoked'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000271', true);
select ok(
  (public.claim_pairing_session_v3(
    repeat('3', 64), '10000000-0000-4000-8000-000000000271',
    (select id from public.screens where tenant_id = '10000000-0000-4000-8000-000000000271'), 'Replacement Player'
  ) ->> 'ok')::boolean,
  'revoked screen can be safely re-paired'
);
select ok(
  public.update_screen_v1(
    '10000000-0000-4000-8000-000000000271',
    (select id from public.screens where tenant_id = '10000000-0000-4000-8000-000000000271'),
    'Kantine links', 'Kantine', 'landscape', 1920, 1080, 'disabled'
  ) is not null,
  'screen can be disabled transactionally'
);
select is(
  (select status from public.player_devices where tenant_id = '10000000-0000-4000-8000-000000000271' and device_name = 'Replacement Player'),
  'revoked'::public.player_device_status,
  'disabling a screen revokes its currently paired device atomically'
);

select * from finish();
rollback;
