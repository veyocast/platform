begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(20);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'platform-admin@castivo.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'platform-viewer@castivo.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'tenant-a-admin@castivo.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'tenant-a-editor@castivo.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000005',
    'authenticated',
    'authenticated',
    'tenant-a-viewer@castivo.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000006',
    'authenticated',
    'authenticated',
    'tenant-b-admin@castivo.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  );

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000001', 'Platform admin'),
  ('00000000-0000-4000-8000-000000000002', 'Platform viewer'),
  ('00000000-0000-4000-8000-000000000003', 'Tenant A admin'),
  ('00000000-0000-4000-8000-000000000004', 'Tenant A editor'),
  ('00000000-0000-4000-8000-000000000005', 'Tenant A viewer'),
  ('00000000-0000-4000-8000-000000000006', 'Tenant B admin');

insert into public.tenants (id, name, slug)
values
  ('10000000-0000-4000-8000-000000000001', 'Tenant A', 'tenant-a'),
  ('10000000-0000-4000-8000-000000000002', 'Tenant B', 'tenant-b');

insert into public.platform_memberships (user_id, role)
values
  ('00000000-0000-4000-8000-000000000001', 'platform_admin'),
  ('00000000-0000-4000-8000-000000000002', 'platform_viewer');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000003',
    'tenant_admin'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000004',
    'tenant_editor'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000005',
    'tenant_viewer'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000006',
    'tenant_admin'
  );

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is(
  (select count(*) from public.screens),
  0::bigint,
  'anonymous sees no screen rows'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
insert into public.screens (
  id,
  tenant_id,
  name,
  location,
  orientation,
  resolution_width,
  resolution_height,
  created_by
)
values (
  '60000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Entree links',
  'Clubhuis entree',
  'landscape',
  1920,
  1080,
  '00000000-0000-4000-8000-000000000003'
);

select is(
  (
    select count(*)
    from public.screens
    where tenant_id = '10000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'tenant admin can create own tenant screen'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
select is(
  (
    select count(*)
    from public.screens
    where id = '60000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'tenant viewer can read own tenant screen'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000006', true);
select is(
  (
    select count(*)
    from public.screens
    where id = '60000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'tenant B cannot read tenant A screen'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
select throws_ok(
  $$
    insert into public.screens (
      id,
      tenant_id,
      name,
      created_by
    )
    values (
      '60000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000001',
      'Viewer screen',
      '00000000-0000-4000-8000-000000000005'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "screens"',
  'tenant viewer cannot create screens'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$
    insert into public.screens (
      id,
      tenant_id,
      name,
      created_by
    )
    values (
      '60000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000002',
      'Spoofed screen',
      '00000000-0000-4000-8000-000000000003'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "screens"',
  'tenant A admin cannot create tenant B screen by spoofing tenant_id'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select ok(
  public.create_pairing_session(repeat('1', 64), repeat('2', 64)) is not null,
  'anonymous player can create a hashed pairing session'
);

select is(
  (
    select count(*)
    from public.pairing_sessions
    where code_hash = repeat('1', 64)
  ),
  0::bigint,
  'anonymous player cannot select pairing session rows'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select ok(
  public.claim_pairing_session(
    repeat('1', 64),
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    'Entree player',
    repeat('3', 64)
  ) is not null,
  'tenant admin can claim pairing session for own screen'
);

select is(
  (
    select count(*)
    from public.player_devices
    where screen_id = '60000000-0000-4000-8000-000000000001'
      and status = 'paired'
  ),
  1::bigint,
  'claiming pairing session creates paired player device'
);

select is(
  (
    select count(*)
    from public.pairing_sessions
    where code_hash = repeat('1', 64)
      and status = 'claimed'
      and claimed_screen_id = '60000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'claimed pairing session is scoped to the screen and tenant'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select ok(
  public.create_pairing_session(repeat('4', 64), null) is not null,
  'anonymous player can create second pairing session for negative checks'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
select throws_ok(
  $$
    select public.claim_pairing_session(
      repeat('4', 64),
      '10000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      'Viewer player',
      repeat('5', 64)
    )
  $$,
  '42501',
  'actor cannot pair devices for this tenant',
  'tenant viewer cannot claim pairing sessions'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select ok(
  public.create_pairing_session(repeat('6', 64), null) is not null,
  'anonymous player can create third pairing session for cross-tenant check'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000006', true);
select throws_ok(
  $$
    select public.claim_pairing_session(
      repeat('6', 64),
      '10000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      'Tenant B player',
      repeat('7', 64)
    )
  $$,
  '42501',
  'actor cannot pair devices for this tenant',
  'tenant B admin cannot claim tenant A screen'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$
    insert into public.player_devices (
      tenant_id,
      screen_id,
      token_hash
    )
    values (
      '10000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      repeat('8', 64)
    )
  $$,
  '42501',
  'permission denied for table player_devices',
  'tenant admin cannot insert player devices directly'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
update public.player_devices
set status = 'disabled'
where screen_id = '60000000-0000-4000-8000-000000000001';

reset role;
select is(
  (
    select status
    from public.player_devices
    where screen_id = '60000000-0000-4000-8000-000000000001'
  ),
  'paired'::public.player_device_status,
  'platform viewer cannot mutate player devices'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is(
  (
    select screen_id
    from public.get_player_device_bootstrap(repeat('3', 64))
  ),
  '60000000-0000-4000-8000-000000000001'::uuid,
  'player bootstrap returns only the screen for the matching device token'
);

select is(
  (
    select count(*)
    from public.get_player_device_bootstrap(repeat('9', 64))
  ),
  0::bigint,
  'player bootstrap returns no rows for an unknown device token'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000006', true);
select is(
  (
    select count(*)
    from public.pairing_sessions
    where claimed_tenant_id = '10000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'tenant B cannot read tenant A pairing sessions'
);

select * from finish();

rollback;
