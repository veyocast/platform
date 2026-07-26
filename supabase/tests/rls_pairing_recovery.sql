begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

set local role anon;
select ok(
  (public.create_pairing_session_v3(
    repeat('1', 64),
    repeat('2', 64),
    repeat('3', 64)
  ) ->> 'ok')::boolean,
  'anonymous Player can create the pending session used by recovery'
);

select ok(
  (public.recover_pending_pairing_v1(
    repeat('2', 64),
    repeat('4', 64),
    'soft'
  ) ->> 'cancelledPendingPairing')::boolean,
  'holder of the pending credential cancels its own pairing attempt'
);

reset role;
select is(
  (
    select status
    from public.pairing_sessions
    where code_hash = repeat('1', 64)
  ),
  'cancelled'::public.pairing_session_status,
  'recovered pairing session is no longer claimable'
);
select is(
  (
    select count(*)
    from private.player_pairing_recovery_events
    where installation_id_hash = repeat('4', 64)
      and event_type = 'pending_pairing.cancelled'
  ),
  1::bigint,
  'successful pending recovery writes one private recovery event'
);

set local role anon;
select ok(
  not (public.recover_pending_pairing_v1(
    repeat('2', 64),
    repeat('4', 64),
    'soft'
  ) ->> 'cancelledPendingPairing')::boolean,
  'replaying the same recovery is idempotent'
);

reset role;
select is(
  (
    select count(*)
    from private.player_pairing_recovery_events
    where installation_id_hash = repeat('4', 64)
  ),
  1::bigint,
  'idempotent replay does not duplicate the recovery event'
);

set local role anon;
select ok(
  (public.create_pairing_session_v3(
    repeat('5', 64),
    repeat('6', 64),
    repeat('7', 64)
  ) ->> 'ok')::boolean,
  'a second independent pending session can be created'
);
select ok(
  not (public.recover_pending_pairing_v1(
    repeat('8', 64),
    repeat('9', 64),
    'hard'
  ) ->> 'cancelledPendingPairing')::boolean,
  'an unrelated credential cannot cancel another pending session'
);

reset role;
select ok(
  not has_table_privilege(
    'anon',
    'private.player_pairing_recovery_events',
    'SELECT'
  ),
  'recovery evidence is not exposed to the Player browser role'
);

select * from finish();
rollback;
