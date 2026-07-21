begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(20);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-4000-8000-000000000281', 'authenticated', 'authenticated', 'screen-admin@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000282', 'authenticated', 'authenticated', 'screen-viewer@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000283', 'authenticated', 'authenticated', 'other-admin@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000281', 'Screen admin'),
  ('00000000-0000-4000-8000-000000000282', 'Screen viewer'),
  ('00000000-0000-4000-8000-000000000283', 'Other admin');

insert into public.tenants (id, name, slug, screen_limit)
values
  ('10000000-0000-4000-8000-000000000281', 'Removal tenant', 'removal-tenant', 1),
  ('10000000-0000-4000-8000-000000000282', 'Other removal tenant', 'other-removal-tenant', 1);

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000281', '00000000-0000-4000-8000-000000000281', 'tenant_admin'),
  ('10000000-0000-4000-8000-000000000281', '00000000-0000-4000-8000-000000000282', 'tenant_viewer'),
  ('10000000-0000-4000-8000-000000000282', '00000000-0000-4000-8000-000000000283', 'tenant_admin');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000281', true);
select ok(
  public.create_screen_v1(
    '10000000-0000-4000-8000-000000000281', 'Kantinescherm', 'Kantine',
    'landscape', 1920, 1080, null
  ) is not null,
  'tenant admin creates the screen through the guarded command'
);

select throws_ok(
  $$select public.remove_screen_v1(
    '10000000-0000-4000-8000-000000000281',
    (select id from public.screens where tenant_id = '10000000-0000-4000-8000-000000000281'),
    'Kantinescherm'
  )$$,
  'P0003', 'screen must be disabled before removal',
  'an active screen cannot be removed'
);

reset role;
insert into public.player_devices (
  tenant_id, screen_id, device_name, token_hash, status
)
select
  '10000000-0000-4000-8000-000000000281', id, 'Kantine Player', repeat('8', 64), 'paired'
from public.screens
where tenant_id = '10000000-0000-4000-8000-000000000281';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000282', true);
select throws_ok(
  $$select public.deactivate_screen_v1(
    '10000000-0000-4000-8000-000000000281',
    (select id from public.screens where tenant_id = '10000000-0000-4000-8000-000000000281')
  )$$,
  '42501', 'actor cannot manage screens for this tenant',
  'tenant viewer cannot deactivate a screen'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000283', true);
select throws_ok(
  $$select public.deactivate_screen_v1(
    '10000000-0000-4000-8000-000000000281',
    (select id from public.screens where tenant_id = '10000000-0000-4000-8000-000000000281')
  )$$,
  '42501', 'actor cannot manage screens for this tenant',
  'another tenant cannot deactivate the screen'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000281', true);
select ok(
  public.deactivate_screen_v1(
    '10000000-0000-4000-8000-000000000281',
    (select id from public.screens where tenant_id = '10000000-0000-4000-8000-000000000281')
  ) is not null,
  'tenant admin deactivates the screen transactionally'
);
select is(
  (select status from public.screens where tenant_id = '10000000-0000-4000-8000-000000000281'),
  'disabled'::public.screen_status,
  'deactivation changes the lifecycle state'
);
select is(
  (select status from public.player_devices where tenant_id = '10000000-0000-4000-8000-000000000281'),
  'revoked'::public.player_device_status,
  'deactivation revokes the paired Player atomically'
);
select is(
  (select count(*) from public.audit_events where tenant_id = '10000000-0000-4000-8000-000000000281' and action = 'screen.deactivated'),
  1::bigint,
  'deactivation is audited once'
);

select throws_ok(
  $$select public.remove_screen_v1(
    '10000000-0000-4000-8000-000000000281',
    (select id from public.screens where tenant_id = '10000000-0000-4000-8000-000000000281'),
    'Verkeerde naam'
  )$$,
  'P0004', 'screen name confirmation does not match',
  'removal requires the exact screen name'
);

select ok(
  public.remove_screen_v1(
    '10000000-0000-4000-8000-000000000281',
    (select id from public.screens where tenant_id = '10000000-0000-4000-8000-000000000281'),
    'Kantinescherm'
  ) is not null,
  'disabled screen is logically removed through the guarded command'
);
select ok(
  (select deleted_at is not null and deleted_by = '00000000-0000-4000-8000-000000000281'
   from public.screens where tenant_id = '10000000-0000-4000-8000-000000000281'),
  'removal stores its tombstone and actor'
);
select is(
  (select name from public.screens where tenant_id = '10000000-0000-4000-8000-000000000281'),
  'Verwijderd scherm',
  'removal minimizes mutable screen metadata'
);
select is(
  (select count(*) from public.audit_events where tenant_id = '10000000-0000-4000-8000-000000000281' and action = 'screen.removed'),
  1::bigint,
  'removal keeps append-only audit evidence'
);
select throws_ok(
  $$select public.update_screen_v1(
    '10000000-0000-4000-8000-000000000281',
    (select id from public.screens where tenant_id = '10000000-0000-4000-8000-000000000281'),
    'Hersteld scherm', '', 'landscape', 1920, 1080, 'active'
  )$$,
  'P0002', 'screen not found',
  'a removed screen cannot be reactivated'
);
select ok(
  public.create_screen_v1(
    '10000000-0000-4000-8000-000000000281', 'Nieuw scherm', '',
    'portrait', 1080, 1920, null
  ) is not null,
  'a removed tombstone releases the tenant screen slot'
);
select is(
  (select count(*) from public.screens where tenant_id = '10000000-0000-4000-8000-000000000281' and deleted_at is null),
  1::bigint,
  'only the replacement counts as an operational screen'
);
select is(
  (select count(*) from public.screens where tenant_id = '10000000-0000-4000-8000-000000000281'),
  2::bigint,
  'the removed tombstone remains for referential history'
);
select ok(
  not has_table_privilege('authenticated', 'public.screens', 'DELETE'),
  'authenticated clients cannot bypass the removal command with hard delete'
);
select ok(
  not has_column_privilege('authenticated', 'public.screens', 'deleted_at', 'UPDATE'),
  'authenticated clients cannot forge a removal timestamp'
);
select ok(
  not has_column_privilege('authenticated', 'public.screens', 'deleted_by', 'INSERT'),
  'authenticated clients cannot create forged tombstones'
);

select * from finish();
rollback;
