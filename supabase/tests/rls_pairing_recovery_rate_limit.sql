begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

set local role anon;
select ok(
  (
    public.register_player_installation_v1(
      repeat('a', 64),
      repeat('b', 64),
      null,
      null
    ) ->> 'ok'
  )::boolean,
  'anonymous Player registers an installation for recovery'
);
select ok(
  (
    public.create_pairing_session_v5(
      repeat('c', 64),
      repeat('d', 64),
      repeat('b', 64),
      repeat('e', 64)
    ) ->> 'ok'
  )::boolean,
  'installation creates its initial pairing session'
);

reset role;
insert into private.pairing_creation_attempts(fingerprint_hash, outcome)
select repeat('a', 64), 'created'
from generate_series(1, 4);

set local role anon;
select is(
  public.create_pairing_session_v5(
    repeat('1', 64),
    repeat('2', 64),
    repeat('b', 64),
    repeat('3', 64)
  ) ->> 'code',
  'RATE_LIMITED',
  'five recent creations still enforce the normal installation limit'
);
select ok(
  (
    public.recover_player_pairing_v3(
      repeat('a', 64),
      null,
      repeat('b', 64),
      'soft'
    ) ->> 'ok'
  )::boolean,
  'credential-authenticated soft recovery is accepted'
);

reset role;
select is(
  (
    select count(*)
    from private.pairing_recovery_grants recovery_grant
    join public.player_installations installation
      on installation.id = recovery_grant.installation_id
    where installation.public_identifier_hash = repeat('a', 64)
      and recovery_grant.consumed_at is null
  ),
  1::bigint,
  'recovery grants exactly one unconsumed retry'
);

set local role anon;
select ok(
  (
    public.create_pairing_session_v5(
      repeat('4', 64),
      repeat('5', 64),
      repeat('b', 64),
      repeat('6', 64)
    ) ->> 'ok'
  )::boolean,
  'the authenticated recovery escapes the existing installation limit once'
);

reset role;
select is(
  (
    select count(*)
    from private.pairing_recovery_grants recovery_grant
    join public.player_installations installation
      on installation.id = recovery_grant.installation_id
    where installation.public_identifier_hash = repeat('a', 64)
      and recovery_grant.consumed_at is null
  ),
  0::bigint,
  'the recovery retry is consumed after successful creation'
);
select is(
  (
    select count(*)
    from public.pairing_sessions pairing
    join public.player_installations installation
      on installation.id = pairing.installation_id
    where installation.public_identifier_hash = repeat('a', 64)
      and pairing.status = 'pending'::public.pairing_session_status
  ),
  1::bigint,
  'recovery still leaves at most one active pairing session'
);

set local role anon;
select ok(
  (
    public.register_player_installation_v1(
      repeat('7', 64),
      repeat('8', 64),
      null,
      null
    ) ->> 'ok'
  )::boolean,
  'a second installation is available for global-limit proof'
);

reset role;
insert into private.pairing_creation_attempts(fingerprint_hash, outcome)
select repeat('9', 64), 'created'
from generate_series(1, 300);

set local role anon;
select is(
  public.create_pairing_session_v5(
    repeat('0', 64),
    repeat('1', 64),
    repeat('8', 64),
    repeat('2', 64)
  ) ->> 'code',
  'RATE_LIMITED',
  'global abuse protection remains active after recovery relief'
);

reset role;
select ok(
  not has_table_privilege(
    'anon',
    'private.pairing_recovery_grants',
    'SELECT'
  ),
  'anonymous Players cannot inspect recovery grants'
);
select is(
  (
    select count(*)
    from private.player_pairing_events
    where event_type = 'recover'
      and detail ->> 'reason' = 'pairing_rate_limit_relief'
  ),
  1::bigint,
  'rate-limit recovery relief is audited'
);

select * from finish();
rollback;
