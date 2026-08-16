begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(4);

select is(
  (
    select count(distinct procedure.oid)
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) privilege
    where namespace.nspname = 'public'
      and procedure.prosecdef
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'PUBLIC cannot execute SECURITY DEFINER functions in the exposed schema'
);

with expected(oid) as (
  values
    ('public.acknowledge_player_command_v1(text,uuid)'::regprocedure),
    ('public.complete_player_command_v1(text,uuid,text,text)'::regprocedure),
    ('public.create_pairing_session(text,text)'::regprocedure),
    ('public.create_pairing_session_v2(text,text,text)'::regprocedure),
    ('public.create_pairing_session_v3(text,text,text)'::regprocedure),
    ('public.create_pairing_session_v4(text,text,text,text)'::regprocedure),
    ('public.create_pairing_session_v5(text,text,text,text)'::regprocedure),
    ('public.get_player_device_bootstrap(text)'::regprocedure),
    ('public.inspect_player_device_credential_v1(text)'::regprocedure),
    ('public.poll_player_commands_v1(text)'::regprocedure),
    (
      'public.record_player_heartbeat(text,text,uuid,bigint,bigint,text,text,jsonb)'
        ::regprocedure
    ),
    (
      'public.record_player_heartbeat_v2(text,text,uuid,uuid,bigint,bigint,text,text,jsonb,text,jsonb)'
        ::regprocedure
    ),
    ('public.recover_pending_pairing_v1(text,text,text)'::regprocedure),
    ('public.recover_player_pairing_v2(text,text,text,text)'::regprocedure),
    ('public.recover_player_pairing_v3(text,text,text,text)'::regprocedure),
    (
      'public.register_player_installation_v1(text,text,text,text)'
        ::regprocedure
    ),
    (
      'public.register_player_installation_v2(text,text,text,text,text,text)'
        ::regprocedure
    ),
    ('public.sync_player_automation_v1(text,jsonb)'::regprocedure),
    ('public.unpair_player_installation_v1(text,text)'::regprocedure)
),
actual(oid) as (
  select procedure.oid::regprocedure
  from pg_catalog.pg_proc procedure
  join pg_catalog.pg_namespace namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.prosecdef
    and has_function_privilege('anon', procedure.oid, 'EXECUTE')
),
difference(oid) as (
  (select oid from actual except select oid from expected)
  union all
  (select oid from expected except select oid from actual)
)
select is(
  (select count(*) from difference),
  0::bigint,
  'anon can execute exactly the credential-bound Player RPC allowlist'
);

with human_command(oid) as (
  values
    (
      'public.claim_pairing_session(text,uuid,uuid,text,text)'
        ::regprocedure
    ),
    ('public.claim_pairing_session_v2(text,uuid,uuid,text)'::regprocedure),
    ('public.claim_pairing_session_v4(text,uuid,uuid,text)'::regprocedure),
    (
      'public.create_dynamic_data_source_v1(uuid,text,text,jsonb)'
        ::regprocedure
    ),
    (
      'public.create_dynamic_template_v1(text,text,text,text,text,text,text,jsonb,jsonb)'
        ::regprocedure
    ),
    ('public.create_dynamic_template_version_v1(uuid)'::regprocedure),
    (
      'public.create_manual_product_v1(uuid,text,text,text,integer,text)'
        ::regprocedure
    ),
    ('public.deactivate_screen_v1(uuid,uuid)'::regprocedure),
    ('public.publish_dynamic_template_version_v1(uuid)'::regprocedure),
    (
      'public.queue_player_command_v1(uuid,uuid,text,uuid,integer,jsonb)'
        ::regprocedure
    ),
    ('public.record_data_source_failure_v1(uuid,text,text)'::regprocedure),
    ('public.record_rss_sync_v1(uuid,jsonb)'::regprocedure),
    ('public.remove_screen_v1(uuid,uuid,text)'::regprocedure),
    (
      'public.update_dynamic_template_draft_v1(uuid,bigint,text,text,text,text,jsonb,jsonb)'
        ::regprocedure
    ),
    (
      'public.upsert_sportlink_connection_v1(uuid,text,text,text,text,text,text)'
        ::regprocedure
    ),
    ('public.withdraw_dynamic_template_v1(uuid)'::regprocedure)
)
select is(
  (
    select count(*)
    from human_command
    where has_function_privilege('anon', oid, 'EXECUTE')
      or not has_function_privilege('authenticated', oid, 'EXECUTE')
  ),
  0::bigint,
  'human command RPCs require an authenticated caller at the ACL boundary'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.publish_playlist_to_screens(uuid,uuid[],text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.publish_playlist_to_screens(uuid,uuid[],text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'public.publish_playlist_to_screens(uuid,uuid[],text)',
    'EXECUTE'
  ),
  'the superseded publish RPC is unavailable to every Data API role'
);

select * from finish();
rollback;
