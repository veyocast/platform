begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(40);

insert into public.playlists (
  id,
  tenant_id,
  name,
  status,
  created_by
)
values (
  '20000000-0000-4000-8000-000000000148',
  '10000000-0000-4000-8000-000000000101',
  'Recovery playlist',
  'published',
  '00000000-0000-4000-8000-000000000101'
);

insert into public.playlist_releases (
  id,
  tenant_id,
  playlist_id,
  version,
  manifest_hash,
  manifest_json,
  item_count,
  total_duration_seconds,
  total_bytes,
  published_by
)
values (
  '30000000-0000-4000-8000-000000000148',
  '10000000-0000-4000-8000-000000000101',
  '20000000-0000-4000-8000-000000000148',
  1,
  repeat('9', 64),
  '{}'::jsonb,
  1,
  10,
  100,
  '00000000-0000-4000-8000-000000000101'
);

update public.screens
set assigned_playlist_id = '20000000-0000-4000-8000-000000000148',
    assigned_release_id = '30000000-0000-4000-8000-000000000148',
    default_playlist_id = '20000000-0000-4000-8000-000000000148',
    default_release_id = '30000000-0000-4000-8000-000000000148'
where id = '40000000-0000-4000-8000-000000000101';

set local role anon;
select ok(
  (public.register_player_installation_v1(
    repeat('a', 64),
    repeat('c', 64),
    null,
    null
  ) ->> 'ok')::boolean,
  'anonymous Player registers a durable installation'
);
select ok(
  not has_table_privilege('anon', 'public.player_installations', 'SELECT'),
  'anonymous Player cannot read installation secrets directly'
);
select ok(
  (public.create_pairing_session_v4(
    repeat('d', 64),
    repeat('e', 64),
    repeat('c', 64),
    repeat('f', 64)
  ) ->> 'ok')::boolean,
  'installation credential creates a pairing session'
);
select ok(
  (public.create_pairing_session_v4(
    repeat('d', 64),
    repeat('e', 64),
    repeat('c', 64),
    repeat('f', 64)
  ) ->> 'reused')::boolean,
  'same pairing nonce is idempotent'
);

reset role;
select is(
  (
    select count(*)
    from public.pairing_sessions
    where installation_id = (
      select id from public.player_installations
      where public_identifier_hash = repeat('a', 64)
    )
      and status = 'pending'
  ),
  1::bigint,
  'idempotent requests leave one active pairing session'
);

set local role anon;
select ok(
  (public.create_pairing_session_v4(
    repeat('1', 64),
    repeat('2', 64),
    repeat('c', 64),
    repeat('3', 64)
  ) ->> 'ok')::boolean,
  'a new request atomically replaces the old pending attempt'
);

reset role;
select is(
  (
    select count(*)
    from public.pairing_sessions
    where installation_id = (
      select id from public.player_installations
      where public_identifier_hash = repeat('a', 64)
    )
      and status = 'pending'
  ),
  1::bigint,
  'two request identities never create duplicate active sessions'
);
select is(
  (
    select count(*)
    from private.player_pairing_events
    where event_type = 'cancel'
  ),
  1::bigint,
  'atomic replacement audits cancellation'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000101',
  true
);
select ok(
  (public.claim_pairing_session_v4(
    repeat('1', 64),
    '10000000-0000-4000-8000-000000000101',
    '40000000-0000-4000-8000-000000000101',
    'Recovery Player'
  ) ->> 'ok')::boolean,
  'tenant manager transactionally claims the installation pairing'
);

reset role;
select ok(
  (
    select bound_device_id is not null
    from public.player_installations
    where public_identifier_hash = repeat('a', 64)
  ),
  'claim binds installation and managed device'
);
select is(
  (
    select assigned_release_id
    from public.screens
    where id = '40000000-0000-4000-8000-000000000101'
  ),
  '30000000-0000-4000-8000-000000000148'::uuid,
  'screen starts with an immutable assigned release'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000101',
  true
);
select ok(
  (public.queue_player_command_v1(
    '10000000-0000-4000-8000-000000000101',
    '40000000-0000-4000-8000-000000000101',
    'RECOVER_PAIRING',
    '50000000-0000-4000-8000-000000000148',
    900,
    '{}'::jsonb
  ) ->> 'ok')::boolean,
  'tenant manager queues a pairing recovery command'
);

reset role;
select is(
  (
    select count(*)
    from public.player_commands
    where nonce = '50000000-0000-4000-8000-000000000148'
  ),
  1::bigint,
  'recovery action creates one command'
);

select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select is(
  jsonb_array_length(
    public.poll_player_commands_v1(repeat('c', 64)) -> 'commands'
  ),
  1,
  'installation polling receives the recovery command'
);

reset role;
select ok(
  exists (
    select 1
    from public.audit_events event
    join public.player_commands command
      on command.id::text = event.metadata ->> 'commandId'
    where command.nonce = '50000000-0000-4000-8000-000000000148'
      and event.action = 'player_command.delivered'
      and event.actor_user_id is null
      and event.actor_device_id = command.device_id
  ),
  'anonymous installation polling writes a verified device audit'
);
select ok(
  (
    select delivered_at is not null
    from public.player_commands
    where nonce = '50000000-0000-4000-8000-000000000148'
  ),
  'polling marks the command delivered'
);
select set_config(
  'test.recover_command_id',
  (
    select id::text
    from public.player_commands
    where nonce = '50000000-0000-4000-8000-000000000148'
  ),
  true
);

set local role anon;
select ok(
  (public.acknowledge_player_command_v1(
    repeat('c', 64),
    current_setting('test.recover_command_id')::uuid
  ) ->> 'ok')::boolean,
  'Player acknowledges the recovery command'
);

reset role;
select ok(
  (
    select acknowledged_at is not null
    from public.player_commands
    where nonce = '50000000-0000-4000-8000-000000000148'
  ),
  'Control can distinguish Player recovery in progress'
);

set local role anon;
select ok(
  (public.complete_player_command_v1(
    repeat('c', 64),
    current_setting('test.recover_command_id')::uuid,
    repeat('4', 64),
    null
  ) ->> 'ok')::boolean,
  'Player atomically rotates the broken device credential'
);

reset role;
select is(
  (
    select token_hash
    from public.player_devices
    where tenant_id = '10000000-0000-4000-8000-000000000101'
      and screen_id = '40000000-0000-4000-8000-000000000101'
      and status = 'paired'
  ),
  repeat('4', 64),
  'recovery replaces only the device credential'
);
select is(
  (
    select assigned_release_id
    from public.screens
    where id = '40000000-0000-4000-8000-000000000101'
  ),
  '30000000-0000-4000-8000-000000000148'::uuid,
  'pairing recovery preserves screen and playlist release'
);
select ok(
  (
    select completed_at is not null
    from public.player_commands
    where nonce = '50000000-0000-4000-8000-000000000148'
  ),
  'completed recovery is terminal'
);
select ok(
  exists (
    select 1
    from public.audit_events event
    join public.player_commands command
      on command.id::text = event.metadata ->> 'commandId'
    where command.nonce = '50000000-0000-4000-8000-000000000148'
      and event.action = 'player_command.completed'
      and event.actor_user_id is null
      and event.actor_device_id = command.device_id
  ),
  'anonymous command completion writes a verified device audit'
);

set local role anon;
select is(
  jsonb_array_length(
    public.poll_player_commands_v1(repeat('c', 64)) -> 'commands'
  ),
  0,
  'completed command is not delivered again'
);
select ok(
  (public.complete_player_command_v1(
    repeat('c', 64),
    current_setting('test.recover_command_id')::uuid,
    repeat('4', 64),
    null
  ) ->> 'alreadyCompleted')::boolean,
  'completion replay is idempotent'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000101',
  true
);
select ok(
  (public.queue_player_command_v1(
    '10000000-0000-4000-8000-000000000101',
    '40000000-0000-4000-8000-000000000101',
    'RELOAD_PLAYER',
    '60000000-0000-4000-8000-000000000148',
    30,
    '{}'::jsonb
  ) ->> 'ok')::boolean,
  'manager queues a short-lived reload command'
);

reset role;
update public.player_commands
set created_at = now() - interval '2 minutes',
    expires_at = now() - interval '1 minute'
where nonce = '60000000-0000-4000-8000-000000000148';

set local role anon;
select is(
  jsonb_array_length(
    public.poll_player_commands_v1(repeat('c', 64)) -> 'commands'
  ),
  0,
  'expired command is never executed'
);

reset role;
select is(
  (
    select failure_code
    from public.player_commands
    where nonce = '60000000-0000-4000-8000-000000000148'
  ),
  'COMMAND_EXPIRED',
  'server records explicit expiry'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000101',
  true
);
select ok(
  (public.queue_player_command_v1(
    '10000000-0000-4000-8000-000000000101',
    '40000000-0000-4000-8000-000000000101',
    'FORCE_UNPAIR',
    '70000000-0000-4000-8000-000000000148',
    900,
    '{}'::jsonb
  ) ->> 'ok')::boolean,
  'manager queues force-unpair without deleting the screen'
);

reset role;
select set_config(
  'test.force_unpair_command_id',
  (
    select id::text
    from public.player_commands
    where nonce = '70000000-0000-4000-8000-000000000148'
  ),
  true
);
set local role anon;
select is(
  jsonb_array_length(
    public.poll_player_commands_v1(repeat('c', 64)) -> 'commands'
  ),
  1,
  'Player receives force-unpair once'
);
select ok(
  (public.complete_player_command_v1(
    repeat('c', 64),
    current_setting('test.force_unpair_command_id')::uuid,
    null,
    null
  ) ->> 'ok')::boolean,
  'Player completes force-unpair'
);

reset role;
select is(
  (
    select status
    from public.player_devices
    where tenant_id = '10000000-0000-4000-8000-000000000101'
      and screen_id = '40000000-0000-4000-8000-000000000101'
    order by created_at desc
    limit 1
  ),
  'revoked'::public.player_device_status,
  'force-unpair revokes the old device credential'
);
select is(
  (
    select bound_device_id
    from public.player_installations
    where public_identifier_hash = repeat('a', 64)
  ),
  null::uuid,
  'force-unpair preserves but unbinds installation identity'
);
select is(
  (
    select assigned_release_id
    from public.screens
    where id = '40000000-0000-4000-8000-000000000101'
  ),
  '30000000-0000-4000-8000-000000000148'::uuid,
  'force-unpair preserves screen object and assigned playlist release'
);

set local role anon;
select ok(
  (public.create_pairing_session_v4(
    repeat('5', 64),
    repeat('6', 64),
    repeat('c', 64),
    repeat('7', 64)
  ) ->> 'ok')::boolean,
  'unpaired installation immediately creates a new code'
);

reset role;
select is(
  (
    select count(*)
    from public.pairing_sessions
    where installation_id = (
      select id from public.player_installations
      where public_identifier_hash = repeat('a', 64)
    )
      and status = 'pending'
  ),
  1::bigint,
  'new pairing still has exactly one active session'
);
select ok(
  not has_table_privilege(
    'anon',
    'private.player_pairing_events',
    'SELECT'
  ),
  'anonymous browser cannot read pairing audit events'
);
select ok(
  not has_table_privilege('anon', 'public.player_commands', 'SELECT'),
  'anonymous browser cannot bypass the command RPC'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000101',
  true
);
select is(
  (
    select count(*)
    from public.player_commands
    where tenant_id = '10000000-0000-4000-8000-000000000101'
  ),
  3::bigint,
  'tenant manager reads only the three own command records through RLS'
);
reset role;
select is(
  (
    select count(*)
    from private.player_pairing_events
    where installation_id = (
      select id from public.player_installations
      where public_identifier_hash = repeat('a', 64)
    )
      and event_type in ('create', 'claim', 'cancel')
  ),
  5::bigint,
  'pairing create, cancel and claim transitions are audited'
);

select * from finish();
rollback;
