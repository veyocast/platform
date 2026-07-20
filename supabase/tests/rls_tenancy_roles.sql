begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

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
    'platform-admin@veyocast.test',
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
    'platform-viewer@veyocast.test',
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
    'tenant-a-admin@veyocast.test',
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
    'tenant-a-editor@veyocast.test',
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
    'tenant-a-viewer@veyocast.test',
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
    'tenant-b-admin@veyocast.test',
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
  (select count(*) from public.tenants),
  0::bigint,
  'anonymous sees no tenant data'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select is(
  (select count(*) from public.tenants where id = '10000000-0000-4000-8000-000000000001'),
  1::bigint,
  'tenant member can select own tenant'
);
select is(
  (select count(*) from public.tenants where id = '10000000-0000-4000-8000-000000000002'),
  0::bigint,
  'tenant member cannot select another tenant'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select cmp_ok(
  (select count(*) from public.tenants),
  '>=',
  2::bigint,
  'platform admin can list all test tenants alongside optional local seed tenants'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
insert into public.tenant_invitations (
  tenant_id,
  email,
  role,
  token_hash,
  expires_at,
  created_by
)
values (
  '10000000-0000-4000-8000-000000000001',
  'new-editor@veyocast.test',
  'tenant_editor',
  'tenant-a-admin-invite',
  now() + interval '7 days',
  '00000000-0000-4000-8000-000000000003'
);
select is(
  (
    select count(*)
    from public.tenant_invitations
    where tenant_id = '10000000-0000-4000-8000-000000000001'
      and email = 'new-editor@veyocast.test'
  ),
  1::bigint,
  'tenant admin can invite a member'
);

select throws_ok(
  $$
    insert into public.tenant_invitations (
      tenant_id,
      email,
      role,
      token_hash,
      expires_at,
      created_by
    )
    values (
      '10000000-0000-4000-8000-000000000002',
      'spoofed@veyocast.test',
      'tenant_editor',
      'tenant-a-admin-spoofed-tenant-b',
      now() + interval '7 days',
      '00000000-0000-4000-8000-000000000003'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "tenant_invitations"',
  'tenant A admin cannot write tenant B invitation by spoofing tenant_id'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select throws_ok(
  $$
    insert into public.tenant_invitations (
      tenant_id,
      email,
      role,
      token_hash,
      expires_at,
      created_by
    )
    values (
      '10000000-0000-4000-8000-000000000001',
      'editor-invite@veyocast.test',
      'tenant_viewer',
      'tenant-a-editor-invite',
      now() + interval '7 days',
      '00000000-0000-4000-8000-000000000004'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "tenant_invitations"',
  'tenant editor cannot invite users'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
select throws_ok(
  $$
    insert into public.tenant_invitations (
      tenant_id,
      email,
      role,
      token_hash,
      expires_at,
      created_by
    )
    values (
      '10000000-0000-4000-8000-000000000001',
      'viewer-invite@veyocast.test',
      'tenant_viewer',
      'tenant-a-viewer-invite',
      now() + interval '7 days',
      '00000000-0000-4000-8000-000000000005'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "tenant_invitations"',
  'tenant viewer cannot invite users'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
update public.tenants
set name = 'Tenant A renamed by viewer'
where id = '10000000-0000-4000-8000-000000000001';

reset role;
select is(
  (
    select name
    from public.tenants
    where id = '10000000-0000-4000-8000-000000000001'
  ),
  'Tenant A',
  'platform viewer cannot mutate tenants'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select ok(
  private.audit_event(
    '10000000-0000-4000-8000-000000000001',
    'tenant.invitation.created',
    'tenant_invitations',
    null,
    'success',
    '{"source":"rls-test"}'::jsonb
  ) is not null,
  'tenant member can append own tenant audit event through helper'
);

select is(
  (
    select count(*)
    from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000000001'
      and action = 'tenant.invitation.created'
  ),
  1::bigint,
  'tenant member can read own tenant audit event'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000006', true);
select is(
  (
    select count(*)
    from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000000001'
      and action = 'tenant.invitation.created'
  ),
  0::bigint,
  'tenant B cannot read tenant A audit event'
);

select throws_ok(
  $$
    select private.audit_event(
      '10000000-0000-4000-8000-000000000001',
      'tenant.spoofed',
      'tenants',
      '10000000-0000-4000-8000-000000000001',
      'success',
      '{}'::jsonb
    )
  $$,
  '42501',
  'actor cannot audit this tenant',
  'tenant B cannot append audit event for tenant A'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.aal', 'aal2', true);
with updated_tenants as (
  update public.tenants
  set name = 'Tenant A renamed by platform admin'
  where id = '10000000-0000-4000-8000-000000000001'
  returning 1
)
select is(
  (select count(*) from updated_tenants),
  1::bigint,
  'platform admin can mutate tenants'
);

select * from finish();

rollback;
