begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  (
    '00000000-0000-4000-8000-000000000461',
    'authenticated', 'authenticated', 'group-admin@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000462',
    'authenticated', 'authenticated', 'schedule-editor@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000463',
    'authenticated', 'authenticated', 'schedule-viewer@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000464',
    'authenticated', 'authenticated', 'schedule-other@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  );

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000461', 'Group admin'),
  ('00000000-0000-4000-8000-000000000462', 'Schedule editor'),
  ('00000000-0000-4000-8000-000000000463', 'Schedule viewer'),
  ('00000000-0000-4000-8000-000000000464', 'Schedule other');

insert into public.tenants (id, name, slug, screen_limit)
values
  ('10000000-0000-4000-8000-000000000461', 'Schedule tenant', 'schedule-tenant', 10),
  ('10000000-0000-4000-8000-000000000462', 'Other schedule tenant', 'other-schedule-tenant', 10);

insert into public.tenant_settings (tenant_id, timezone_name)
values
  ('10000000-0000-4000-8000-000000000461', 'Europe/Amsterdam'),
  ('10000000-0000-4000-8000-000000000462', 'Europe/London');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  (
    '10000000-0000-4000-8000-000000000461',
    '00000000-0000-4000-8000-000000000461',
    'tenant_admin'
  ),
  (
    '10000000-0000-4000-8000-000000000461',
    '00000000-0000-4000-8000-000000000462',
    'tenant_editor'
  ),
  (
    '10000000-0000-4000-8000-000000000461',
    '00000000-0000-4000-8000-000000000463',
    'tenant_viewer'
  ),
  (
    '10000000-0000-4000-8000-000000000462',
    '00000000-0000-4000-8000-000000000464',
    'tenant_admin'
  );

insert into public.playlists (id, tenant_id, name, status, created_by, updated_by)
values
  (
    '50000000-0000-4000-8000-000000000461',
    '10000000-0000-4000-8000-000000000461',
    'Schedule playlist',
    'published',
    '00000000-0000-4000-8000-000000000461',
    '00000000-0000-4000-8000-000000000461'
  ),
  (
    '50000000-0000-4000-8000-000000000462',
    '10000000-0000-4000-8000-000000000462',
    'Other schedule playlist',
    'published',
    '00000000-0000-4000-8000-000000000464',
    '00000000-0000-4000-8000-000000000464'
  );

insert into public.playlist_releases (
  id, tenant_id, playlist_id, version, manifest_hash, manifest_json,
  item_count, total_duration_seconds, total_bytes, published_by
)
values
  (
    '70000000-0000-4000-8000-000000000461',
    '10000000-0000-4000-8000-000000000461',
    '50000000-0000-4000-8000-000000000461',
    1, repeat('a', 64), '{"schemaVersion":1,"items":[]}'::jsonb,
    1, 10, 1024, '00000000-0000-4000-8000-000000000461'
  ),
  (
    '70000000-0000-4000-8000-000000000462',
    '10000000-0000-4000-8000-000000000462',
    '50000000-0000-4000-8000-000000000462',
    1, repeat('b', 64), '{"schemaVersion":1,"items":[]}'::jsonb,
    1, 10, 1024, '00000000-0000-4000-8000-000000000464'
  );

insert into public.screens (
  id, tenant_id, name, location, status, orientation, created_by
)
values
  (
    '60000000-0000-4000-8000-000000000461',
    '10000000-0000-4000-8000-000000000461',
    'Kantine', 'Begane grond', 'active', 'landscape',
    '00000000-0000-4000-8000-000000000461'
  ),
  (
    '60000000-0000-4000-8000-000000000462',
    '10000000-0000-4000-8000-000000000461',
    'Sponsorwand', 'Entree', 'active', 'landscape',
    '00000000-0000-4000-8000-000000000461'
  ),
  (
    '60000000-0000-4000-8000-000000000463',
    '10000000-0000-4000-8000-000000000462',
    'Other screen', 'Other', 'active', 'landscape',
    '00000000-0000-4000-8000-000000000464'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000461',
  true
);

select lives_ok(
  $$insert into public.screen_groups (
      id, tenant_id, name, description, default_playlist_id,
      default_release_id, created_by, updated_by
    ) values (
      '61000000-0000-4000-8000-000000000461',
      '10000000-0000-4000-8000-000000000461',
      'Kantine',
      'Alle schermen in de kantine',
      '50000000-0000-4000-8000-000000000461',
      '70000000-0000-4000-8000-000000000461',
      '00000000-0000-4000-8000-000000000461',
      '00000000-0000-4000-8000-000000000461'
    )$$,
  'tenant admin can create an own-tenant screen group'
);
select lives_ok(
  $$insert into public.screen_group_memberships (
      tenant_id, screen_group_id, screen_id, created_by
    ) values
      (
        '10000000-0000-4000-8000-000000000461',
        '61000000-0000-4000-8000-000000000461',
        '60000000-0000-4000-8000-000000000461',
        '00000000-0000-4000-8000-000000000461'
      ),
      (
        '10000000-0000-4000-8000-000000000461',
        '61000000-0000-4000-8000-000000000461',
        '60000000-0000-4000-8000-000000000462',
        '00000000-0000-4000-8000-000000000461'
      )$$,
  'tenant admin can add multiple own-tenant screens to a group'
);
select is(
  (
    select count(*)
    from public.screen_group_memberships
    where screen_group_id = '61000000-0000-4000-8000-000000000461'
  ),
  2::bigint,
  'screen groups support deterministic many-to-many membership'
);
select throws_ok(
  $$insert into public.screen_group_memberships (
      tenant_id, screen_group_id, screen_id
    ) values (
      '10000000-0000-4000-8000-000000000461',
      '61000000-0000-4000-8000-000000000461',
      '60000000-0000-4000-8000-000000000463'
    )$$,
  '23503',
  'insert or update on table "screen_group_memberships" violates foreign key constraint "screen_group_memberships_tenant_id_screen_id_fkey"',
  'composite tenant foreign keys reject cross-tenant group membership'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000462',
  true
);

select lives_ok(
  $$insert into public.content_schedules (
      id, tenant_id, name, target_kind, target_screen_group_id,
      playlist_id, release_id, timezone_name, schedule_kind,
      starts_at, ends_at, recurrence_json, priority, created_by, updated_by
    ) values (
      '62000000-0000-4000-8000-000000000461',
      '10000000-0000-4000-8000-000000000461',
      'Kantine lunch',
      'screen_group',
      '61000000-0000-4000-8000-000000000461',
      '50000000-0000-4000-8000-000000000461',
      '70000000-0000-4000-8000-000000000461',
      'Europe/Amsterdam',
      'weekly',
      '2026-08-01 10:00:00+02',
      '2026-12-31 14:00:00+01',
      '{"weekdays":[1,2,3,4,5],"startTime":"11:00","endTime":"14:00"}'::jsonb,
      200,
      '00000000-0000-4000-8000-000000000462',
      '00000000-0000-4000-8000-000000000462'
    )$$,
  'tenant editor can schedule an immutable release for a screen group'
);
select is(
  (
    select timezone_name
    from public.content_schedules
    where id = '62000000-0000-4000-8000-000000000461'
  ),
  'Europe/Amsterdam',
  'the schedule persists the tenant timezone explicitly'
);
select is(
  (
    select release_id
    from public.content_schedules
    where id = '62000000-0000-4000-8000-000000000461'
  ),
  '70000000-0000-4000-8000-000000000461'::uuid,
  'a schedule always points at an immutable release'
);
select throws_ok(
  $$insert into public.content_schedules (
      tenant_id, name, target_kind, target_screen_id, target_screen_group_id,
      playlist_id, release_id, timezone_name, starts_at
    ) values (
      '10000000-0000-4000-8000-000000000461',
      'Ambiguous target',
      'screen',
      '60000000-0000-4000-8000-000000000461',
      '61000000-0000-4000-8000-000000000461',
      '50000000-0000-4000-8000-000000000461',
      '70000000-0000-4000-8000-000000000461',
      'Europe/Amsterdam',
      now()
    )$$,
  '23514',
  'new row for relation "content_schedules" violates check constraint "content_schedules_check"',
  'a schedule cannot ambiguously target both a screen and group'
);

reset role;

insert into public.publisher_target_snapshots (
  id, tenant_id, release_id, schedule_id, source_kind, source_id,
  target_count, targets_json, snapshot_hash, resolved_by
)
values (
  '63000000-0000-4000-8000-000000000461',
  '10000000-0000-4000-8000-000000000461',
  '70000000-0000-4000-8000-000000000461',
  '62000000-0000-4000-8000-000000000461',
  'schedule',
  '62000000-0000-4000-8000-000000000461',
  2,
  '[
    "60000000-0000-4000-8000-000000000461",
    "60000000-0000-4000-8000-000000000462"
  ]'::jsonb,
  repeat('c', 64),
  '00000000-0000-4000-8000-000000000462'
);
insert into public.publisher_target_snapshot_screens (
  tenant_id, snapshot_id, screen_id, provenance_kind, provenance_id
)
values
  (
    '10000000-0000-4000-8000-000000000461',
    '63000000-0000-4000-8000-000000000461',
    '60000000-0000-4000-8000-000000000461',
    'screen_group',
    '61000000-0000-4000-8000-000000000461'
  ),
  (
    '10000000-0000-4000-8000-000000000461',
    '63000000-0000-4000-8000-000000000461',
    '60000000-0000-4000-8000-000000000462',
    'screen_group',
    '61000000-0000-4000-8000-000000000461'
  );
update public.content_schedules
set target_snapshot_id = '63000000-0000-4000-8000-000000000461'
where id = '62000000-0000-4000-8000-000000000461';

select is(
  (
    select target_count
    from public.publisher_target_snapshots
    where id = '63000000-0000-4000-8000-000000000461'
  ),
  2,
  'a resolved target snapshot records its exact target count'
);
select is(
  (
    select count(*)
    from public.publisher_target_snapshot_screens
    where snapshot_id = '63000000-0000-4000-8000-000000000461'
  ),
  2::bigint,
  'a target snapshot records exact screen provenance'
);
select throws_ok(
  $$update public.publisher_target_snapshots
    set target_count = 1
    where id = '63000000-0000-4000-8000-000000000461'$$,
  '23514',
  'publisher target snapshots are immutable',
  'resolved target snapshot metadata cannot be rewritten'
);
select throws_ok(
  $$delete from public.publisher_target_snapshot_screens
    where snapshot_id = '63000000-0000-4000-8000-000000000461'$$,
  '23514',
  'publisher target snapshots are immutable',
  'resolved target membership cannot be deleted'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000463',
  true
);

select is((select count(*) from public.screen_groups), 1::bigint, 'viewer can read own screen groups');
select is((select count(*) from public.content_schedules), 1::bigint, 'viewer can read own schedules');
select is((select count(*) from public.publisher_target_snapshots), 1::bigint, 'viewer can inspect own immutable targeting proof');
select throws_ok(
  $$insert into public.screen_groups (tenant_id, name)
    values ('10000000-0000-4000-8000-000000000461', 'Niet toegestaan')$$,
  '42501',
  'new row violates row-level security policy for table "screen_groups"',
  'viewer cannot create a screen group'
);
select throws_ok(
  $$insert into public.content_schedules (
      tenant_id, name, target_kind, target_screen_id, playlist_id,
      release_id, timezone_name, starts_at
    ) values (
      '10000000-0000-4000-8000-000000000461',
      'Niet toegestaan',
      'screen',
      '60000000-0000-4000-8000-000000000461',
      '50000000-0000-4000-8000-000000000461',
      '70000000-0000-4000-8000-000000000461',
      'Europe/Amsterdam',
      now()
    )$$,
  '42501',
  'new row violates row-level security policy for table "content_schedules"',
  'viewer cannot create a content schedule'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000464',
  true
);

select is((select count(*) from public.screen_groups), 0::bigint, 'another tenant cannot read screen groups');
select is((select count(*) from public.content_schedules), 0::bigint, 'another tenant cannot read schedules');
select is((select count(*) from public.publisher_target_snapshots), 0::bigint, 'another tenant cannot read target snapshots');

reset role;
set local role anon;
select throws_ok(
  $$select count(*) from public.screen_groups$$,
  '42501',
  'permission denied for table screen_groups',
  'anonymous callers cannot inspect screen groups'
);
select throws_ok(
  $$select count(*) from public.publisher_target_snapshots$$,
  '42501',
  'permission denied for table publisher_target_snapshots',
  'anonymous callers cannot inspect target provenance'
);

select * from finish();
rollback;
