begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

select ok(
  not has_function_privilege(
    'anon',
    'public.cleanup_player_pairing_smoke_v1(text)',
    'EXECUTE'
  ),
  'anonymous Players cannot execute deployment-smoke cleanup'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.cleanup_player_pairing_smoke_v1(text)',
    'EXECUTE'
  ),
  'authenticated Control users cannot execute deployment-smoke cleanup'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.cleanup_player_pairing_smoke_v1(text)',
    'EXECUTE'
  ),
  'only the service role can execute deployment-smoke cleanup'
);

insert into public.player_installations (
  id,
  public_identifier_hash,
  credential_hash
)
values (
  '54000000-0000-4000-8000-000000000153',
  repeat('e', 64),
  repeat('f', 64)
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
  '55000000-0000-4000-8000-000000000153',
  repeat('1', 64),
  repeat('2', 64),
  repeat('e', 64),
  '54000000-0000-4000-8000-000000000153',
  repeat('3', 64),
  now() + interval '10 minutes'
);

insert into private.player_pairing_events (
  installation_id,
  pairing_session_id,
  event_type
)
values (
  '54000000-0000-4000-8000-000000000153',
  '55000000-0000-4000-8000-000000000153',
  'recover'
);

insert into private.player_pairing_recovery_events (
  installation_id_hash,
  recovery_mode,
  event_type
)
values (
  repeat('e', 64),
  'soft',
  'pending_pairing.cancelled'
);

insert into private.pairing_creation_attempts (
  fingerprint_hash,
  outcome
)
values (
  repeat('e', 64),
  'created'
);

insert into public.player_devices (
  id,
  tenant_id,
  screen_id,
  device_name,
  token_hash,
  status
)
values (
  '56000000-0000-4000-8000-000000000153',
  '10000000-0000-4000-8000-000000000101',
  '40000000-0000-4000-8000-000000000101',
  'Bound smoke cleanup guard',
  repeat('4', 64),
  'paired'
);

insert into public.player_installations (
  id,
  public_identifier_hash,
  credential_hash,
  bound_device_id
)
values (
  '57000000-0000-4000-8000-000000000153',
  repeat('d', 64),
  repeat('c', 64),
  '56000000-0000-4000-8000-000000000153'
);

set local role service_role;
select is(
  public.cleanup_player_pairing_smoke_v1(repeat('e', 64)) ->> 'deleted',
  'true',
  'service role removes the exact unpaired smoke installation'
);
select is(
  public.cleanup_player_pairing_smoke_v1(repeat('e', 64)) ->> 'deleted',
  'false',
  'cleanup is idempotent after the smoke installation is gone'
);
select throws_ok(
  $$select public.cleanup_player_pairing_smoke_v1(repeat('d', 64))$$,
  '23514',
  'refusing to delete a bound Player installation',
  'cleanup refuses to remove a real bound Player installation'
);

reset role;
select is(
  (
    select count(*)
    from public.player_installations
    where public_identifier_hash = repeat('d', 64)
      and bound_device_id = '56000000-0000-4000-8000-000000000153'
  ),
  1::bigint,
  'a refused cleanup preserves the bound installation'
);
select is(
  (
    select count(*)
    from public.player_installations
    where public_identifier_hash = repeat('e', 64)
  ),
  0::bigint,
  'cleanup removes the temporary installation'
);
select is(
  (
    select count(*)
    from public.pairing_sessions
    where device_fingerprint_hash = repeat('e', 64)
  ),
  0::bigint,
  'cleanup removes the temporary pairing session'
);
select is(
  (
    select count(*)
    from private.player_pairing_events
    where installation_id = '54000000-0000-4000-8000-000000000153'
      or pairing_session_id = '55000000-0000-4000-8000-000000000153'
  ),
  0::bigint,
  'cleanup removes temporary private pairing evidence'
);
select is(
  (
    select count(*)
    from private.player_pairing_recovery_events
    where installation_id_hash = repeat('e', 64)
  ),
  0::bigint,
  'cleanup removes temporary recovery evidence'
);
select is(
  (
    select count(*)
    from private.pairing_creation_attempts
    where fingerprint_hash = repeat('e', 64)
  ),
  0::bigint,
  'cleanup removes the temporary rate-limit fingerprint'
);

select * from finish();
rollback;
