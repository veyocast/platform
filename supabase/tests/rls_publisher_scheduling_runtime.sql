begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(23);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  (
    '00000000-0000-4000-8000-000000000481',
    'authenticated', 'authenticated', 'runtime-admin@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000482',
    'authenticated', 'authenticated', 'runtime-editor@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000483',
    'authenticated', 'authenticated', 'runtime-viewer@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  );

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000481', 'Runtime admin'),
  ('00000000-0000-4000-8000-000000000482', 'Runtime editor'),
  ('00000000-0000-4000-8000-000000000483', 'Runtime viewer');

insert into public.tenants (id, name, slug, screen_limit)
values (
  '10000000-0000-4000-8000-000000000481',
  'Runtime tenant',
  'runtime-tenant',
  10
);
insert into public.tenant_settings (tenant_id, timezone_name)
values ('10000000-0000-4000-8000-000000000481', 'Europe/Amsterdam');
insert into public.tenant_memberships (tenant_id, user_id, role)
values
  (
    '10000000-0000-4000-8000-000000000481',
    '00000000-0000-4000-8000-000000000481',
    'tenant_admin'
  ),
  (
    '10000000-0000-4000-8000-000000000481',
    '00000000-0000-4000-8000-000000000482',
    'tenant_editor'
  ),
  (
    '10000000-0000-4000-8000-000000000481',
    '00000000-0000-4000-8000-000000000483',
    'tenant_viewer'
  );

insert into public.playlists (
  id, tenant_id, name, status, created_by, updated_by
)
values
  (
    '50000000-0000-4000-8000-000000000481',
    '10000000-0000-4000-8000-000000000481',
    'Default release', 'published',
    '00000000-0000-4000-8000-000000000481',
    '00000000-0000-4000-8000-000000000481'
  ),
  (
    '50000000-0000-4000-8000-000000000482',
    '10000000-0000-4000-8000-000000000481',
    'Group release', 'published',
    '00000000-0000-4000-8000-000000000481',
    '00000000-0000-4000-8000-000000000481'
  ),
  (
    '50000000-0000-4000-8000-000000000483',
    '10000000-0000-4000-8000-000000000481',
    'Override release', 'published',
    '00000000-0000-4000-8000-000000000481',
    '00000000-0000-4000-8000-000000000481'
  );
insert into public.playlist_releases (
  id, tenant_id, playlist_id, version, manifest_hash, manifest_json,
  item_count, total_duration_seconds, total_bytes, published_by
)
values
  (
    '70000000-0000-4000-8000-000000000481',
    '10000000-0000-4000-8000-000000000481',
    '50000000-0000-4000-8000-000000000481',
    1, repeat('a', 64), '{"schemaVersion":1,"items":[]}'::jsonb,
    1, 10, 1024, '00000000-0000-4000-8000-000000000481'
  ),
  (
    '70000000-0000-4000-8000-000000000482',
    '10000000-0000-4000-8000-000000000481',
    '50000000-0000-4000-8000-000000000482',
    1, repeat('b', 64), '{"schemaVersion":1,"items":[]}'::jsonb,
    1, 10, 1024, '00000000-0000-4000-8000-000000000481'
  ),
  (
    '70000000-0000-4000-8000-000000000483',
    '10000000-0000-4000-8000-000000000481',
    '50000000-0000-4000-8000-000000000483',
    1, repeat('c', 64), '{"schemaVersion":1,"items":[]}'::jsonb,
    1, 10, 1024, '00000000-0000-4000-8000-000000000481'
  );

insert into public.screens (
  id, tenant_id, name, status, assigned_playlist_id, assigned_release_id,
  created_by
)
values
  (
    '60000000-0000-4000-8000-000000000481',
    '10000000-0000-4000-8000-000000000481',
    'Entree', 'active',
    '50000000-0000-4000-8000-000000000481',
    '70000000-0000-4000-8000-000000000481',
    '00000000-0000-4000-8000-000000000481'
  ),
  (
    '60000000-0000-4000-8000-000000000482',
    '10000000-0000-4000-8000-000000000481',
    'Kantine', 'active',
    '50000000-0000-4000-8000-000000000481',
    '70000000-0000-4000-8000-000000000481',
    '00000000-0000-4000-8000-000000000481'
  );
insert into public.player_devices (
  id, tenant_id, screen_id, token_hash, status, desired_release_id
)
values
  (
    '80000000-0000-4000-8000-000000000481',
    '10000000-0000-4000-8000-000000000481',
    '60000000-0000-4000-8000-000000000481',
    repeat('d', 64), 'paired',
    '70000000-0000-4000-8000-000000000481'
  ),
  (
    '80000000-0000-4000-8000-000000000482',
    '10000000-0000-4000-8000-000000000481',
    '60000000-0000-4000-8000-000000000482',
    repeat('e', 64), 'paired',
    '70000000-0000-4000-8000-000000000481'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000481',
  true
);

select is(
  (
    public.mutate_screen_group_v1(
      '10000000-0000-4000-8000-000000000481',
      null,
      0,
      'create',
      '{
        "name":"Publieke ruimtes",
        "description":"Entree en kantine",
        "screenIds":[
          "60000000-0000-4000-8000-000000000481",
          "60000000-0000-4000-8000-000000000482"
        ],
        "defaultReleaseId":"70000000-0000-4000-8000-000000000481"
      }'::jsonb,
      '90000000-0000-4000-8000-000000000481'
    ) ->> 'outcome'
  ),
  'applied',
  'group creation succeeds through the guarded command'
);
select is(
  (
    select count(*)
    from public.screen_group_memberships
    where screen_group_id = (
      select id from public.screen_groups
      where tenant_id = '10000000-0000-4000-8000-000000000481'
        and name = 'Publieke ruimtes'
    )
  ),
  2::bigint,
  'group creation writes all validated memberships atomically'
);
select is(
  (
    select default_release_id
    from public.screen_groups
    where tenant_id = '10000000-0000-4000-8000-000000000481'
      and name = 'Publieke ruimtes'
  ),
  '70000000-0000-4000-8000-000000000481'::uuid,
  'group creation persists a tenant-valid default release'
);
select throws_ok(
  $$select public.mutate_screen_group_v1(
      '10000000-0000-4000-8000-000000000481',
      null,
      0,
      'create',
      '{"name":"Ongeldig","screenIds":["60000000-0000-4000-8000-000000009999"]}'::jsonb,
      '90000000-0000-4000-8000-000000000482'
    )$$,
  '23514',
  'one or more group screens are unavailable',
  'invalid group membership rolls back the complete create command'
);
select is(
  (
    select count(*) from public.screen_groups
    where tenant_id = '10000000-0000-4000-8000-000000000481'
  ),
  1::bigint,
  'a rejected membership never leaves a partial screen group'
);

select lives_ok(
  $$select public.update_tenant_control_settings_v2(
      '10000000-0000-4000-8000-000000000481',
      'Runtime tenant',
      12,
      'cover',
      true,
      'landscape',
      1920,
      1080,
      'Europe/Brussels',
      'crossfade',
      '#121416'
    )$$,
  'tenant admin can persist Publisher defaults and a valid IANA timezone'
);
select is(
  (
    select timezone_name || '|' || default_transition || '|' ||
      default_background_color
    from public.tenant_settings
    where tenant_id = '10000000-0000-4000-8000-000000000481'
  ),
  'Europe/Brussels|crossfade|#121416',
  'Publisher settings v2 persist the scheduling and presentation defaults'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000482',
  true
);

select is(
  (
    public.mutate_content_schedule_v1(
      '10000000-0000-4000-8000-000000000481',
      null,
      0,
      'create',
      jsonb_build_object(
        'name', 'Groepscampagne',
        'targetKind', 'screen_group',
        'targetId', (
          select id from public.screen_groups
          where tenant_id = '10000000-0000-4000-8000-000000000481'
            and name = 'Publieke ruimtes'
        ),
        'releaseId', '70000000-0000-4000-8000-000000000482',
        'timezoneName', 'Europe/Amsterdam',
        'scheduleKind', 'once',
        'startsAt', '2026-08-01T08:00:00Z',
        'endsAt', '2026-08-02T08:00:00Z',
        'priority', 500,
        'source', 'publisher'
      ),
      '90000000-0000-4000-8000-000000000483'
    ) ->> 'outcome'
  ),
  'applied',
  'an editor can create a group schedule through the guarded command'
);
select is(
  (
    select target_count
    from public.publisher_target_snapshots
    where id = (
      select target_snapshot_id from public.content_schedules
      where name = 'Groepscampagne'
    )
  ),
  2,
  'schedule creation freezes its exact target membership'
);
select is(
  (
    public.mutate_content_schedule_v1(
      '10000000-0000-4000-8000-000000000481',
      null,
      0,
      'create',
      '{
        "name":"Entree override",
        "targetKind":"screen",
        "targetId":"60000000-0000-4000-8000-000000000481",
        "releaseId":"70000000-0000-4000-8000-000000000483",
        "timezoneName":"Europe/Amsterdam",
        "scheduleKind":"once",
        "startsAt":"2026-08-01T08:00:00Z",
        "endsAt":"2026-08-02T08:00:00Z",
        "priority":1,
        "source":"override"
      }'::jsonb,
      '90000000-0000-4000-8000-000000000484'
    ) ->> 'outcome'
  ),
  'applied',
  'an explicit screen override can be scheduled'
);
select is(
  (
    select count(*)
    from public.check_content_schedule_conflicts_v1(
      '10000000-0000-4000-8000-000000000481',
      'screen',
      '60000000-0000-4000-8000-000000000481',
      '2026-08-01T10:00:00Z',
      '2026-08-01T12:00:00Z',
      null
    )
  ),
  2::bigint,
  'conflict review resolves both direct and frozen group overlaps'
);
select throws_ok(
  $$select public.apply_due_content_schedules_v1('2026-08-01T12:00:00Z')$$,
  '42501',
  'permission denied for function apply_due_content_schedules_v1',
  'authenticated editors cannot execute the runtime scheduler'
);

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

select is(
  public.apply_due_content_schedules_v1('2026-08-01T12:00:00Z'),
  2,
  'the runtime applies exactly one deterministic winner per screen'
);

reset role;
select is(
  (
    select assigned_release_id
    from public.screens
    where id = '60000000-0000-4000-8000-000000000481'
  ),
  '70000000-0000-4000-8000-000000000483'::uuid,
  'an override wins over a higher-priority group schedule'
);
select is(
  (
    select assigned_release_id
    from public.screens
    where id = '60000000-0000-4000-8000-000000000482'
  ),
  '70000000-0000-4000-8000-000000000482'::uuid,
  'the remaining group member receives the group release'
);
select is(
  (
    select active_assignment_source
    from public.screens
    where id = '60000000-0000-4000-8000-000000000481'
  ),
  'override',
  'the active screen records truthful assignment provenance'
);
select is(
  (
    select desired_release_id
    from public.player_devices
    where screen_id = '60000000-0000-4000-8000-000000000482'
  ),
  '70000000-0000-4000-8000-000000000482'::uuid,
  'runtime resolution updates the paired device desired release'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select is(
  public.apply_due_content_schedules_v1('2026-08-01T12:00:00Z'),
  0,
  're-evaluating unchanged winners is idempotent'
);
select is(
  public.apply_due_content_schedules_v1('2026-08-03T12:00:00Z'),
  2,
  'expired schedules atomically fall back on both screens'
);

reset role;
select is(
  (
    select count(*)
    from public.screens
    where tenant_id = '10000000-0000-4000-8000-000000000481'
      and assigned_release_id = '70000000-0000-4000-8000-000000000481'
      and active_assignment_source = 'default'
      and active_schedule_id is null
  ),
  2::bigint,
  'fallback restores the durable default assignment and clears provenance'
);
select is(
  (
    select count(*)
    from public.release_screen_assignments
    where tenant_id = '10000000-0000-4000-8000-000000000481'
      and assignment_kind in ('scheduled', 'fallback')
  ),
  4::bigint,
  'runtime changes leave an append-only assignment trail'
);
select is(
  (
    select count(*)
    from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000000481'
      and action in (
        'publisher.schedule.applied',
        'publisher.schedule.fallback_applied'
      )
  ),
  4::bigint,
  'every runtime assignment and fallback has an audit event'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000483',
  true
);
select throws_ok(
  $$select public.mutate_content_schedule_v1(
      '10000000-0000-4000-8000-000000000481',
      null,
      0,
      'create',
      '{}'::jsonb,
      '90000000-0000-4000-8000-000000000485'
    )$$,
  '42501',
  'actor cannot mutate schedules for this tenant',
  'a viewer cannot mutate content schedules'
);

select * from finish();
rollback;
