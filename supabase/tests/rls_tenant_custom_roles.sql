begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(18);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-4000-8000-000000000951', 'authenticated', 'authenticated', 'roles-owner@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000952', 'authenticated', 'authenticated', 'roles-member@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000953', 'authenticated', 'authenticated', 'roles-other@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000951', 'Roles owner'),
  ('00000000-0000-4000-8000-000000000952', 'Roles member'),
  ('00000000-0000-4000-8000-000000000953', 'Roles other');

insert into public.tenants (id, name, slug)
values
  ('10000000-0000-4000-8000-000000000951', 'Roles tenant', 'roles-tenant'),
  ('10000000-0000-4000-8000-000000000952', 'Other roles tenant', 'other-roles-tenant');

insert into public.tenant_settings (tenant_id)
values
  ('10000000-0000-4000-8000-000000000951'),
  ('10000000-0000-4000-8000-000000000952');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000951', '00000000-0000-4000-8000-000000000951', 'tenant_owner'),
  ('10000000-0000-4000-8000-000000000951', '00000000-0000-4000-8000-000000000952', 'tenant_viewer'),
  ('10000000-0000-4000-8000-000000000952', '00000000-0000-4000-8000-000000000953', 'tenant_owner');

insert into public.playlists (id, tenant_id, name, created_by, updated_by)
values (
  '50000000-0000-4000-8000-000000000951',
  '10000000-0000-4000-8000-000000000951',
  'Custom role concept',
  '00000000-0000-4000-8000-000000000951',
  '00000000-0000-4000-8000-000000000951'
);

insert into public.audit_events (
  tenant_id, actor_user_id, action, target_type, target_id, result
)
values (
  '10000000-0000-4000-8000-000000000951',
  '00000000-0000-4000-8000-000000000951',
  'roles.seeded',
  'tenant_custom_roles',
  '10000000-0000-4000-8000-000000000951',
  'success'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000951', true);

select ok(
  public.create_tenant_custom_role_v1(
    '10000000-0000-4000-8000-000000000951',
    'Contentmaker',
    'Beheert conceptcontent en instellingen',
    array[
      'tenant.media.write',
      'tenant.playlist.write',
      'tenant.settings.manage'
    ]::text[]
  ) is not null,
  'tenant owner can create a tenant-scoped custom role'
);

select throws_ok(
  $$select public.create_tenant_custom_role_v1(
    '10000000-0000-4000-8000-000000000951',
    'Onvolledig',
    null,
    array['tenant.media.write']::text[]
  )$$,
  '23514',
  'content editing requires media and playlist write together',
  'media and playlist authoring cannot be split across an unsafe legacy boundary'
);

select lives_ok(
  $$select public.set_tenant_member_custom_role_v1(
    '10000000-0000-4000-8000-000000000951',
    '00000000-0000-4000-8000-000000000952',
    (select id from public.tenant_custom_roles where name = 'Contentmaker')
  )$$,
  'owner can assign a custom role to another tenant member'
);

select is(
  (
    select role::text
    from public.tenant_memberships
    where tenant_id = '10000000-0000-4000-8000-000000000951'
      and user_id = '00000000-0000-4000-8000-000000000952'
  ),
  'tenant_editor',
  'content-capable custom roles use the bounded editor database baseline'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000952', true);

select ok(
  public.get_my_tenant_capabilities_v1('10000000-0000-4000-8000-000000000951')
    @> array[
      'tenant.overview.read',
      'tenant.media.write',
      'tenant.playlist.write',
      'tenant.playlist.archive',
      'tenant.settings.manage'
    ]::text[],
  'effective capabilities combine shared read access with configured work rights'
);

select ok(
  not (
    'tenant.playlist.publish' = any(
      public.get_my_tenant_capabilities_v1('10000000-0000-4000-8000-000000000951')
    )
  ),
  'an unassigned publish capability is denied'
);

select lives_ok(
  $$select * from public.mutate_playlist_draft_v1(
    '50000000-0000-4000-8000-000000000951',
    0,
    'update_details',
    '{"name":"Aangepast door custom rol","description":"veilig"}'::jsonb
  )$$,
  'configured content rights authorize the guarded playlist mutation'
);

select lives_ok(
  $$select public.update_tenant_control_settings_v2(
    '10000000-0000-4000-8000-000000000951',
    'Roles tenant bijgewerkt',
    10,
    'contain',
    true,
    'landscape',
    1920,
    1080,
    'Europe/Amsterdam',
    'cut',
    '#000000'
  )$$,
  'configured settings rights authorize the server-side settings command'
);

select throws_ok(
  $$select public.create_screen_v1(
    '10000000-0000-4000-8000-000000000951',
    'Niet toegestaan',
    '',
    'landscape',
    1920,
    1080,
    null
  )$$,
  '42501',
  'actor cannot manage screens for this tenant',
  'an unassigned screen capability is denied by the database command'
);

select is(
  (
    select count(*)
    from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000000951'
      and actor_user_id <> '00000000-0000-4000-8000-000000000952'
  ),
  0::bigint,
  'without audit permission the member cannot read other actors audit events'
);

select is(
  (
    select count(*)
    from public.tenant_custom_roles
    where tenant_id = '10000000-0000-4000-8000-000000000952'
  ),
  0::bigint,
  'custom role rows remain isolated from another tenant'
);

select throws_ok(
  $$select public.create_tenant_custom_role_v1(
    '10000000-0000-4000-8000-000000000951',
    'Escalatie',
    null,
    array['tenant.screen.manage']::text[]
  )$$,
  '42501',
  'tenant owner capability required',
  'a custom role holder cannot create or escalate custom roles'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000951', true);

select is(
  public.update_tenant_custom_role_v1(
    '10000000-0000-4000-8000-000000000951',
    (select id from public.tenant_custom_roles where name = 'Contentmaker'),
    0,
    'Contentmaker',
    'Beheert conceptcontent, instellingen en audit',
    array[
      'tenant.media.write',
      'tenant.playlist.write',
      'tenant.settings.manage',
      'tenant.audit.read'
    ]::text[]
  ) ->> 'outcome',
  'updated',
  'owner can revise a custom role with optimistic concurrency'
);

select is(
  public.update_tenant_custom_role_v1(
    '10000000-0000-4000-8000-000000000951',
    (select id from public.tenant_custom_roles where name = 'Contentmaker'),
    0,
    'Verouderde wijziging',
    null,
    array[
      'tenant.media.write',
      'tenant.playlist.write'
    ]::text[]
  ) ->> 'outcome',
  'conflict',
  'stale custom role changes fail with a conflict outcome'
);

select throws_ok(
  $$select public.archive_tenant_custom_role_v1(
    '10000000-0000-4000-8000-000000000951',
    (select id from public.tenant_custom_roles where name = 'Contentmaker'),
    1
  )$$,
  '23514',
  'custom role is still assigned',
  'an assigned custom role cannot be archived'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000952', true);

select ok(
  'tenant.audit.read' = any(
    public.get_my_tenant_capabilities_v1('10000000-0000-4000-8000-000000000951')
  ),
  'role revisions take effect in the next server request without changing membership'
);

select ok(
  (
    select count(*)
    from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000000951'
      and actor_user_id = '00000000-0000-4000-8000-000000000951'
  ) > 0,
  'audit permission exposes tenant audit history through RLS'
);

select is(
  public.get_my_tenant_capabilities_v1('10000000-0000-4000-8000-000000000952'),
  '{}'::text[],
  'capabilities cannot be requested for a tenant without membership'
);

select * from finish();
rollback;
