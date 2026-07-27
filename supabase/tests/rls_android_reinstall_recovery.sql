begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

insert into public.player_devices (
  id,
  tenant_id,
  screen_id,
  device_name,
  token_hash,
  status
)
values (
  '51000000-0000-4000-8000-000000000153',
  '10000000-0000-4000-8000-000000000101',
  '40000000-0000-4000-8000-000000000101',
  'Android reinstall Player',
  repeat('1', 64),
  'paired'
);

insert into public.player_installations (
  id,
  public_identifier_hash,
  credential_hash,
  bound_device_id,
  native_recovery_credential_hash,
  native_recovery_platform,
  native_recovery_bound_at
)
values (
  '52000000-0000-4000-8000-000000000153',
  repeat('2', 64),
  repeat('3', 64),
  '51000000-0000-4000-8000-000000000153',
  repeat('4', 64),
  'android',
  now()
);

set local role anon;
select is(
  public.register_player_installation_v2(
    repeat('5', 64),
    repeat('6', 64),
    null,
    null,
    repeat('4', 64),
    repeat('7', 64)
  ) ->> 'ok',
  'true',
  'official Android recovery credential can recover after app data removal'
);
select is(
  public.register_player_installation_v2(
    repeat('5', 64),
    repeat('6', 64),
    null,
    null,
    repeat('8', 64),
    repeat('9', 64)
  ) ->> 'code',
  'INSTALLATION_CREDENTIAL_REQUIRED',
  'a different native credential cannot take over the installation'
);
select throws_ok(
  $$
    select public.register_player_installation_v2(
      repeat('a', 64),
      repeat('b', 64),
      null,
      null,
      'not-a-hash',
      repeat('c', 64)
    )
  $$,
  '23514',
  'invalid installation hashes',
  'raw or malformed native identifiers are rejected'
);
select ok(
  not has_table_privilege('anon', 'public.player_installations', 'SELECT'),
  'anonymous Player cannot enumerate native recovery hashes'
);
select ok(
  not has_table_privilege('anon', 'public.player_devices', 'UPDATE'),
  'anonymous Player cannot rotate device credentials directly'
);

reset role;
select is(
  (
    select id
    from public.player_installations
    where public_identifier_hash = repeat('5', 64)
  ),
  '52000000-0000-4000-8000-000000000153'::uuid,
  'reinstall keeps the original Installation entity'
);
select is(
  (
    select credential_hash
    from public.player_installations
    where id = '52000000-0000-4000-8000-000000000153'
  ),
  repeat('6', 64),
  'reinstall rotates the installation credential'
);
select is(
  (
    select bound_device_id
    from public.player_installations
    where id = '52000000-0000-4000-8000-000000000153'
  ),
  '51000000-0000-4000-8000-000000000153'::uuid,
  'reinstall preserves the screen device binding'
);
select is(
  (
    select token_hash
    from public.player_devices
    where id = '51000000-0000-4000-8000-000000000153'
  ),
  repeat('7', 64),
  'reinstall rotates the lost device credential'
);
select is(
  (
    select screen_id
    from public.player_devices
    where id = '51000000-0000-4000-8000-000000000153'
  ),
  '40000000-0000-4000-8000-000000000101'::uuid,
  'reinstall keeps the same managed screen'
);
select is(
  (
    select status::text
    from public.player_devices
    where id = '51000000-0000-4000-8000-000000000153'
  ),
  'paired',
  'reinstall does not revoke a valid paired device'
);
select is(
  (
    select count(*)
    from private.player_pairing_events
    where installation_id = '52000000-0000-4000-8000-000000000153'
      and event_type = 'recover'
      and detail ->> 'method' = 'android_native_reinstall'
  ),
  1::bigint,
  'native reinstall recovery writes private pairing evidence'
);
select is(
  (
    select count(*)
    from public.audit_events
    where actor_device_id = '51000000-0000-4000-8000-000000000153'
      and action = 'player_device.native_reinstall_recovered'
  ),
  1::bigint,
  'native reinstall recovery is audited without a human actor'
);
select is(
  (
    select count(*)
    from public.player_installations
    where native_recovery_credential_hash = repeat('4', 64)
  ),
  1::bigint,
  'one native credential maps to at most one installation'
);

insert into public.pairing_sessions (
  id,
  code_hash,
  pending_token_hash,
  device_fingerprint_hash,
  installation_id,
  request_nonce_hash,
  expires_at
)
values (
  '53000000-0000-4000-8000-000000000153',
  repeat('8', 64),
  repeat('9', 64),
  repeat('5', 64),
  '52000000-0000-4000-8000-000000000153',
  repeat('a', 64),
  now() + interval '10 minutes'
);

set local role anon;
select ok(
  (
    public.recover_player_pairing_v2(
      repeat('5', 64),
      repeat('b', 64),
      repeat('6', 64),
      'soft'
    ) ->> 'cancelledPendingPairing'
  )::boolean,
  'installation credential can cancel the current pending pairing'
);
select is(
  public.recover_player_pairing_v2(
    repeat('5', 64),
    repeat('b', 64),
    repeat('6', 64),
    'soft'
  ) ->> 'bindingState',
  'PAIRED',
  'soft pairing recovery reports the preserved screen binding'
);

reset role;
select is(
  (
    select status::text
    from public.pairing_sessions
    where id = '53000000-0000-4000-8000-000000000153'
  ),
  'cancelled',
  'installation-authenticated recovery makes the old code unclaimable'
);
select is(
  (
    select count(*)
    from private.player_pairing_events
    where pairing_session_id = '53000000-0000-4000-8000-000000000153'
      and event_type = 'recover'
      and detail ->> 'proof' = 'installation_credential'
  ),
  1::bigint,
  'installation-authenticated recovery is written to the private event log'
);

insert into public.pairing_sessions (
  id,
  code_hash,
  pending_token_hash,
  device_fingerprint_hash,
  installation_id,
  request_nonce_hash,
  expires_at
)
values (
  '53000000-0000-4000-8000-000000000154',
  repeat('c', 64),
  repeat('d', 64),
  repeat('5', 64),
  '52000000-0000-4000-8000-000000000153',
  repeat('e', 64),
  now() + interval '10 minutes'
);

set local role anon;
select is(
  public.recover_player_pairing_v2(
    repeat('5', 64),
    repeat('f', 64),
    repeat('0', 64),
    'hard'
  ) ->> 'code',
  'RECOVERY_CREDENTIAL_INVALID',
  'unrelated recovery credentials cannot cancel a pairing'
);

reset role;
select is(
  (
    select status::text
    from public.pairing_sessions
    where id = '53000000-0000-4000-8000-000000000154'
  ),
  'pending',
  'failed recovery leaves the legitimate pending pairing intact'
);

set local role anon;
select ok(
  (
    public.recover_player_pairing_v2(
      repeat('5', 64),
      repeat('d', 64),
      null,
      'hard'
    ) ->> 'cancelledPendingPairing'
  )::boolean,
  'holder of the pending token can still recover without installation storage'
);
select ok(
  has_function_privilege(
    'anon',
    'public.register_player_installation_v2(text,text,text,text,text,text)',
    'EXECUTE'
  ),
  'anonymous recovery receives only the callable security-definer boundary'
);

select * from finish();
rollback;
