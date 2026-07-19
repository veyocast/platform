begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(13);

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
    '00000000-0000-4000-8000-000000000201',
    'authenticated',
    'authenticated',
    'tenant-creator@veyocast.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    'authenticated',
    'authenticated',
    'platform-viewer-create@veyocast.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000203',
    'authenticated',
    'authenticated',
    'tenant-admin-create@veyocast.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  );

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000201', 'Tenant creator'),
  ('00000000-0000-4000-8000-000000000202', 'Platform viewer'),
  ('00000000-0000-4000-8000-000000000203', 'Tenant admin');

insert into public.platform_memberships (user_id, role)
values
  ('00000000-0000-4000-8000-000000000201', 'platform_admin'),
  ('00000000-0000-4000-8000-000000000202', 'platform_viewer');

insert into public.tenants (id, name, slug)
values (
  '10000000-0000-4000-8000-000000000203',
  'Bestaande tenant',
  'bestaande-tenant-voor-aanmaaktest'
);

insert into public.tenant_memberships (tenant_id, user_id, role)
values (
  '10000000-0000-4000-8000-000000000203',
  '00000000-0000-4000-8000-000000000203',
  'tenant_admin'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000201',
  true
);

select lives_ok(
  $$select public.create_platform_tenant('Nieuwe vereniging', 'nieuwe-vereniging', 24)$$,
  'platform admin can create a complete tenant'
);

select is(
  (
    select count(*)
    from public.tenants
    where slug = 'nieuwe-vereniging'
      and name = 'Nieuwe vereniging'
      and status = 'active'
      and screen_limit = 24
  ),
  1::bigint,
  'tenant is created with the requested safe values'
);

select is(
  (
    select count(*)
    from public.tenant_settings settings
    join public.tenants tenant on tenant.id = settings.tenant_id
    where tenant.slug = 'nieuwe-vereniging'
      and settings.default_video_muted = true
      and settings.default_resolution_width = 1920
      and settings.default_resolution_height = 1080
  ),
  1::bigint,
  'tenant receives safe playback and screen defaults'
);

select is(
  (
    select membership.role::text
    from public.tenant_memberships membership
    join public.tenants tenant on tenant.id = membership.tenant_id
    where tenant.slug = 'nieuwe-vereniging'
      and membership.user_id = '00000000-0000-4000-8000-000000000201'
  ),
  'tenant_owner',
  'creating platform admin becomes the first tenant owner'
);

select is(
  (
    select count(*)
    from public.audit_events event
    join public.tenants tenant on tenant.id = event.tenant_id
    where tenant.slug = 'nieuwe-vereniging'
      and event.action = 'tenant.created'
      and event.actor_user_id = '00000000-0000-4000-8000-000000000201'
  ),
  1::bigint,
  'tenant creation appends an attributable audit event'
);

select throws_ok(
  $$select public.create_platform_tenant('X', 'geldige-slug', 4)$$,
  '23514',
  'tenant name must contain 2 to 120 characters',
  'tenant creation rejects an invalid name'
);

select throws_ok(
  $$select public.create_platform_tenant('Geldige naam', 'Ongeldige slug', 4)$$,
  '23514',
  'tenant slug must contain 3 to 64 lowercase characters',
  'tenant creation rejects an invalid slug'
);

select throws_ok(
  $$select public.create_platform_tenant('Geldige naam', 'geldige-slug', 0)$$,
  '23514',
  'tenant screen limit must be between 1 and 10000',
  'tenant creation rejects an invalid screen limit'
);

select throws_ok(
  $$select public.create_platform_tenant('Andere vereniging', 'nieuwe-vereniging', 4)$$,
  '23505',
  'tenant slug already exists',
  'tenant creation rejects a duplicate slug without partial data'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000202',
  true
);

select throws_ok(
  $$select public.create_platform_tenant('Viewer tenant', 'viewer-tenant', 4)$$,
  '42501',
  'actor cannot create tenants',
  'platform viewer cannot create tenants'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000203',
  true
);

select throws_ok(
  $$select public.create_platform_tenant('Tenantadmin tenant', 'tenantadmin-tenant', 4)$$,
  '42501',
  'actor cannot create tenants',
  'tenant admin without a platform role cannot create tenants'
);

reset role;

select ok(
  not has_function_privilege(
    'anon',
    'public.create_platform_tenant(text,text,integer)',
    'EXECUTE'
  ),
  'anonymous users cannot execute tenant creation'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_platform_tenant(text,text,integer)',
    'EXECUTE'
  ),
  'authenticated sessions can reach the role-checking tenant creation boundary'
);

select * from finish();
rollback;
