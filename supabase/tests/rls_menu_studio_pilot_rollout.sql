begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(30);

insert into public.tenants (id, name, slug, status)
values
  ('10000000-0000-4000-8000-000000001131', 'S113 Pilotvereniging', 's113-pilot', 'active'),
  ('10000000-0000-4000-8000-000000001132', 'S113 Gepauzeerd', 's113-paused', 'paused');

insert into public.tenant_settings (tenant_id)
values
  ('10000000-0000-4000-8000-000000001131'),
  ('10000000-0000-4000-8000-000000001132');

select ok(
  not has_function_privilege(
    'anon',
    'private.set_menu_studio_pilot_flag_v1(text,text,boolean,text,text,text)',
    'EXECUTE'
  ),
  'anonymous users cannot execute the pilot rollout command'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.set_menu_studio_pilot_flag_v1(text,text,boolean,text,text,text)',
    'EXECUTE'
  ),
  'authenticated users cannot execute the operational pilot rollout command'
);

select ok(
  not has_function_privilege(
    'service_role',
    'private.set_menu_studio_pilot_flag_v1(text,text,boolean,text,text,text)',
    'EXECUTE'
  ),
  'the Data API service role cannot execute the operational pilot rollout command'
);

select throws_ok(
  $$select private.set_menu_studio_pilot_flag_v1(
    'S113 Pilotvereniging', 'publish', true,
    'S113 gecontroleerde pilot', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/11301'
  )$$,
  '55000',
  'enable MenuDocument.v2 read first',
  'rollout cannot skip the read dependency'
);

select throws_ok(
  $$select private.set_menu_studio_pilot_flag_v1(
    'S113 Pilotvereniging', 'read', true,
    'te kort', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/11302'
  )$$,
  '22023',
  'pilot rollout reason is invalid',
  'rollout requires an attributable reason'
);

select lives_ok(
  $$select private.set_menu_studio_pilot_flag_v1(
    'S113 Pilotvereniging', 'read', true,
    'S113 gecontroleerde pilot', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/11303'
  )$$,
  'read is enabled first'
);

select lives_ok(
  $$select private.set_menu_studio_pilot_flag_v1(
    'S113 Pilotvereniging', 'authoring', true,
    'S113 gecontroleerde pilot', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/11304'
  )$$,
  'authoring is enabled after read'
);

select lives_ok(
  $$select private.set_menu_studio_pilot_flag_v1(
    'S113 Pilotvereniging', 'linked_groups', true,
    'S113 gecontroleerde pilot', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/11305'
  )$$,
  'linked groups are enabled after authoring'
);

select lives_ok(
  $$select private.set_menu_studio_pilot_flag_v1(
    'S113 Pilotvereniging', 'media', true,
    'S113 gecontroleerde pilot', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/11306'
  )$$,
  'media is enabled after authoring'
);

select lives_ok(
  $$select private.set_menu_studio_pilot_flag_v1(
    'S113 Pilotvereniging', 'publish', true,
    'S113 gecontroleerde pilot', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/11307'
  )$$,
  'publish is enabled after authoring'
);

select lives_ok(
  $$select private.set_menu_studio_pilot_flag_v1(
    'S113 Pilotvereniging', 'player', true,
    'S113 gecontroleerde pilot', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/11308'
  )$$,
  'player is enabled after publish'
);

select ok(
  (
    select
      menu_document_v2_read_enabled
      and menu_studio_v2_authoring_enabled
      and menu_studio_v2_linked_groups_enabled
      and menu_studio_v2_media_enabled
      and menu_studio_v2_publish_enabled
      and menu_studio_v2_player_enabled
    from public.tenant_settings
    where tenant_id = '10000000-0000-4000-8000-000000001131'
  ),
  'all six Menu Studio pilot capabilities are enabled in order'
);

select is(
  (
    select count(*)
    from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000001131'
      and action = 'menu_studio.pilot_flag.updated'
  ),
  6::bigint,
  'every applied pilot flag writes one audit event'
);

select is(
  (
    select metadata ->> 'operator'
    from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000001131'
      and action = 'menu_studio.pilot_flag.updated'
    order by created_at desc, id desc
    limit 1
  ),
  'github:codex',
  'the audit event records the authenticated workflow operator'
);

select ok(
  (
    select actor_user_id is null
      and metadata ->> 'reason' = 'S113 gecontroleerde pilot'
      and metadata ->> 'workflowRun' like 'https://github.com/veyocast/platform/actions/runs/%'
    from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000001131'
      and action = 'menu_studio.pilot_flag.updated'
    order by created_at desc, id desc
    limit 1
  ),
  'the operational audit distinguishes its GitHub actor and reason from a tenant user'
);

select is(
  private.set_menu_studio_pilot_flag_v1(
    'S113 Pilotvereniging', 'player', true,
    'S113 gecontroleerde pilot', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/11309'
  ) ->> 'changed',
  'false',
  'reapplying the same flag value is idempotent'
);

select is(
  (
    select count(*)
    from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000001131'
      and action = 'menu_studio.pilot_flag.updated'
  ),
  6::bigint,
  'an idempotent rollout retry does not append a misleading mutation event'
);

select throws_ok(
  $$select private.set_menu_studio_pilot_flag_v1(
    'S113 Pilotvereniging', 'publish', false,
    'S113 gecontroleerde rollback', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/11310'
  )$$,
  '55000',
  'disable Menu Studio player first',
  'rollback cannot disable publish while player remains enabled'
);

select lives_ok(
  $$select private.set_menu_studio_pilot_flag_v1(
    'S113 Pilotvereniging', 'player', false,
    'S113 gecontroleerde rollback', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/11311'
  )$$,
  'player is disabled first during rollback'
);

select lives_ok(
  $$select private.set_menu_studio_pilot_flag_v1(
    'S113 Pilotvereniging', 'publish', false,
    'S113 gecontroleerde rollback', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/11312'
  )$$,
  'publish is disabled after player'
);

select lives_ok(
  $$select private.set_menu_studio_pilot_flag_v1(
    'S113 Pilotvereniging', 'media', false,
    'S113 gecontroleerde rollback', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/11313'
  )$$,
  'media is disabled before authoring'
);

select lives_ok(
  $$select private.set_menu_studio_pilot_flag_v1(
    'S113 Pilotvereniging', 'linked_groups', false,
    'S113 gecontroleerde rollback', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/11314'
  )$$,
  'linked groups are disabled before authoring'
);

select lives_ok(
  $$select private.set_menu_studio_pilot_flag_v1(
    'S113 Pilotvereniging', 'authoring', false,
    'S113 gecontroleerde rollback', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/11315'
  )$$,
  'authoring is disabled after its dependent capabilities'
);

select lives_ok(
  $$select private.set_menu_studio_pilot_flag_v1(
    'S113 Pilotvereniging', 'read', false,
    'S113 gecontroleerde rollback', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/11316'
  )$$,
  'read is disabled last'
);

select ok(
  (
    select
      not menu_document_v2_read_enabled
      and not menu_studio_v2_authoring_enabled
      and not menu_studio_v2_linked_groups_enabled
      and not menu_studio_v2_media_enabled
      and not menu_studio_v2_publish_enabled
      and not menu_studio_v2_player_enabled
    from public.tenant_settings
    where tenant_id = '10000000-0000-4000-8000-000000001131'
  ),
  'the guarded rollback returns all six flags to false'
);

select is(
  (
    select count(*)
    from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000001131'
      and action = 'menu_studio.pilot_flag.updated'
  ),
  12::bigint,
  'the six rollback changes are also audited'
);

select throws_ok(
  $$select private.set_menu_studio_pilot_flag_v1(
    'S113 Gepauzeerd', 'read', true,
    'S113 gecontroleerde pilot', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/11317'
  )$$,
  '55000',
  'pilot tenant is not active',
  'a paused tenant cannot be activated as a pilot'
);

insert into public.tenants (id, name, slug)
values ('10000000-0000-4000-8000-000000001133', 's113 pilotvereniging', 's113-pilot-duplicate');

select throws_ok(
  $$select private.set_menu_studio_pilot_flag_v1(
    'S113 Pilotvereniging', 'read', true,
    'S113 gecontroleerde pilot', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/11318'
  )$$,
  '21000',
  'pilot tenant name is not unique',
  'case-insensitive duplicate tenant names fail closed'
);

select throws_ok(
  $$select private.set_menu_studio_pilot_flag_v1(
    'Onbekende S113 tenant', 'read', true,
    'S113 gecontroleerde pilot', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/11319'
  )$$,
  'P0002',
  'pilot tenant not found',
  'an unknown tenant name cannot be activated'
);

select throws_ok(
  $$select private.set_menu_studio_pilot_flag_v1(
    'S113 Gepauzeerd', 'read', true,
    'S113 gecontroleerde pilot', 'onbekende-operator',
    'https://github.com/veyocast/platform/actions/runs/11320'
  )$$,
  '22023',
  'pilot rollout operator is invalid',
  'rollout requires a validated GitHub operator identity'
);

select * from finish();
rollback;
