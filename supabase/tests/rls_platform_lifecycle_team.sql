begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(33);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-4000-8000-000000000301', 'authenticated', 'authenticated', 's22-platform-owner@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000302', 'authenticated', 'authenticated', 's22-platform-admin@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000303', 'authenticated', 'authenticated', 's22-owner@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000304', 'authenticated', 'authenticated', 's22-second-owner@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000305', 'authenticated', 'authenticated', 's22-admin@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000306', 'authenticated', 'authenticated', 's22-editor@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000307', 'authenticated', 'authenticated', 's22-invitee@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000308', 'authenticated', 'authenticated', 's22-wrong-email@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000309', 'authenticated', 'authenticated', 's22-platform-target@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000301', 'S22 platform owner'),
  ('00000000-0000-4000-8000-000000000302', 'S22 platform admin'),
  ('00000000-0000-4000-8000-000000000303', 'S22 owner'),
  ('00000000-0000-4000-8000-000000000304', 'S22 second owner'),
  ('00000000-0000-4000-8000-000000000305', 'S22 admin'),
  ('00000000-0000-4000-8000-000000000306', 'S22 editor'),
  ('00000000-0000-4000-8000-000000000307', 'S22 invitee'),
  ('00000000-0000-4000-8000-000000000308', 'S22 wrong email'),
  ('00000000-0000-4000-8000-000000000309', 'S22 platform target');

insert into public.platform_memberships (user_id, role)
values
  ('00000000-0000-4000-8000-000000000301', 'platform_owner'),
  ('00000000-0000-4000-8000-000000000302', 'platform_admin');

insert into public.tenants (id, name, slug, screen_limit)
values
  ('10000000-0000-4000-8000-000000000301', 'S22 tenant A', 's22-tenant-a', 2),
  ('10000000-0000-4000-8000-000000000302', 'S22 tenant B', 's22-tenant-b', 1);

insert into public.tenant_settings (tenant_id)
values
  ('10000000-0000-4000-8000-000000000301'),
  ('10000000-0000-4000-8000-000000000302');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000303', 'tenant_owner'),
  ('10000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000304', 'tenant_owner'),
  ('10000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000305', 'tenant_admin'),
  ('10000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000306', 'tenant_editor'),
  ('10000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000304', 'tenant_owner');

insert into public.screens (tenant_id, name, created_by)
values
  ('10000000-0000-4000-8000-000000000301', 'S22 scherm 1', '00000000-0000-4000-8000-000000000303'),
  ('10000000-0000-4000-8000-000000000301', 'S22 scherm 2', '00000000-0000-4000-8000-000000000303');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000302', true);
select set_config('request.jwt.claim.aal', 'aal1', true);

select throws_ok(
  $$select public.provision_platform_tenant('S22 provisioned', 's22-provisioned', 4, 'new-owner@veyocast.test', 'nl-NL', 'Europe/Amsterdam', false, repeat('1', 64), 's22-provision-command', 'request-s22-provision')$$,
  '42501', 'sensitive platform mutations require aal2',
  'tenant provisioning requires AAL2'
);

select set_config('request.jwt.claim.aal', 'aal2', true);
select is(
  public.provision_platform_tenant('S22 provisioned', 's22-provisioned', 4, 'new-owner@veyocast.test', 'nl-NL', 'Europe/Amsterdam', false, repeat('1', 64), 's22-provision-command', 'request-s22-provision') ->> 'created',
  'true',
  'provisioning creates the tenant transactionally'
);

select is(
  (select count(*) from public.tenant_memberships membership join public.tenants tenant on tenant.id = membership.tenant_id where tenant.slug = 's22-provisioned' and membership.user_id = '00000000-0000-4000-8000-000000000302'),
  0::bigint,
  'the platform admin is not an automatic tenant owner'
);

select is(
  (select count(*) from public.tenant_invitations invitation join public.tenants tenant on tenant.id = invitation.tenant_id where tenant.slug = 's22-provisioned' and invitation.email = 'new-owner@veyocast.test' and invitation.role = 'tenant_owner'),
  1::bigint,
  'provisioning creates the requested owner invitation'
);

select is(
  public.provision_platform_tenant('S22 provisioned', 's22-provisioned', 4, 'new-owner@veyocast.test', 'nl-NL', 'Europe/Amsterdam', false, repeat('1', 64), 's22-provision-command', 'request-s22-provision-retry') ->> 'created',
  'false',
  'the same idempotency key returns the existing result'
);

select is(
  (select count(*) from public.tenants where slug = 's22-provisioned'),
  1::bigint,
  'idempotent provisioning creates no duplicate tenant'
);

select throws_ok(
  $$select public.provision_platform_tenant('Changed payload', 's22-other', 4, 'new-owner@veyocast.test', 'nl-NL', 'Europe/Amsterdam', false, repeat('2', 64), 's22-provision-command', 'request-s22-conflict')$$,
  '22023', 'idempotency key was reused with a different payload',
  'idempotency key reuse with another payload fails closed'
);

select is(
  (select count(*) from public.audit_events event join public.tenants tenant on tenant.id = event.tenant_id where tenant.slug = 's22-provisioned' and event.action = 'tenant.provisioned'),
  1::bigint,
  'provisioning writes one attributable audit event'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000303', true);
select throws_ok(
  $$insert into public.screens (tenant_id, name, created_by) values ('10000000-0000-4000-8000-000000000301', 'S22 scherm boven limiet', '00000000-0000-4000-8000-000000000303')$$,
  '23514', 'tenant screen limit reached',
  'screen creation enforces the tenant limit under row lock'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000302', true);
select set_config('request.jwt.claim.aal', 'aal2', true);
select throws_ok(
  $$select public.update_platform_tenant_screen_limit('10000000-0000-4000-8000-000000000301', 1)$$,
  '23514', 'screen limit cannot be lower than current screen usage',
  'screen limit cannot be lowered below current usage'
);

select lives_ok(
  $$select public.update_platform_tenant_screen_limit('10000000-0000-4000-8000-000000000301', 5)$$,
  'a valid screen limit change succeeds'
);

select is((select screen_limit from public.tenants where id = '10000000-0000-4000-8000-000000000301'), 5, 'screen limit is persisted');

select lives_ok(
  $$select public.update_platform_tenant_lifecycle('10000000-0000-4000-8000-000000000301', 'paused')$$,
  'platform admin can pause a tenant at AAL2'
);
select lives_ok(
  $$select public.update_platform_tenant_lifecycle('10000000-0000-4000-8000-000000000301', 'active')$$,
  'platform admin can reactivate a tenant at AAL2'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000303', true);
select set_config('request.jwt.claim.aal', 'aal2', true);

select ok(
  public.create_tenant_invitation('10000000-0000-4000-8000-000000000301', 's22-invitee@veyocast.test', 'tenant_editor', repeat('3', 64)) is not null,
  'tenant owner can create an invitation'
);

select throws_ok(
  $$select public.create_tenant_invitation('10000000-0000-4000-8000-000000000301', 's22-invitee@veyocast.test', 'tenant_viewer', repeat('4', 64))$$,
  '23505', 'a pending invitation already exists for this email',
  'only one pending invitation per tenant and email is allowed'
);

select lives_ok(
  $$select public.mark_tenant_invitation_delivery((select id from public.tenant_invitations where tenant_id = '10000000-0000-4000-8000-000000000301' and email = 's22-invitee@veyocast.test' and status = 'pending'), true, null)$$,
  'delivery status can be marked without exposing provider details'
);

select ok(
  public.rotate_tenant_invitation((select id from public.tenant_invitations where tenant_id = '10000000-0000-4000-8000-000000000301' and email = 's22-invitee@veyocast.test' and status = 'pending'), repeat('5', 64)) is not null,
  'resend rotates to a new invitation token'
);

select is(
  (select count(*) from public.tenant_invitations where tenant_id = '10000000-0000-4000-8000-000000000301' and email = 's22-invitee@veyocast.test' and status = 'revoked'),
  1::bigint,
  'resend revokes the previous invitation'
);

reset role;
update public.tenant_invitations
set id = '50000000-0000-4000-8000-000000000301'
where tenant_id = '10000000-0000-4000-8000-000000000301'
  and email = 's22-invitee@veyocast.test'
  and status = 'pending';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000308', true);

select throws_ok(
  $$select public.accept_tenant_invitation('50000000-0000-4000-8000-000000000301', '10000000-0000-4000-8000-000000000301', repeat('5', 64))$$,
  '42501', 'invitation email does not match authenticated user',
  'an invitation cannot be accepted by another email'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000307', true);

select throws_ok(
  $$select public.accept_tenant_invitation('50000000-0000-4000-8000-000000000301', '10000000-0000-4000-8000-000000000302', repeat('5', 64))$$,
  '42501', 'invitation does not match tenant',
  'an invitation cannot be replayed against another tenant'
);

select is(
  public.accept_tenant_invitation('50000000-0000-4000-8000-000000000301', '10000000-0000-4000-8000-000000000301', repeat('5', 64)),
  '10000000-0000-4000-8000-000000000301'::uuid,
  'the invited email can accept the invitation once'
);

select is(
  (select role::text from public.tenant_memberships where tenant_id = '10000000-0000-4000-8000-000000000301' and user_id = '00000000-0000-4000-8000-000000000307'),
  'tenant_editor',
  'acceptance creates the intended tenant role'
);

select throws_ok(
  $$select public.accept_tenant_invitation('50000000-0000-4000-8000-000000000301', '10000000-0000-4000-8000-000000000301', repeat('5', 64))$$,
  '23514', 'invitation is no longer pending',
  'accepted invitations cannot be replayed'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000303', true);

select lives_ok(
  $$select public.set_tenant_member_role('10000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000306', 'tenant_admin')$$,
  'tenant owner can change another member role'
);

select throws_ok(
  $$select public.set_tenant_member_role('10000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000303', 'tenant_admin')$$,
  '42501', 'self lockout is not allowed',
  'tenant owners cannot demote themselves'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000305', true);
select throws_ok(
  $$select public.set_tenant_member_role('10000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000304', 'tenant_admin')$$,
  '42501', 'tenant admins cannot manage owners',
  'tenant admins cannot demote owners'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000302', true);
select set_config('request.jwt.claim.aal', 'aal2', true);
select throws_ok(
  $$select public.remove_tenant_member('10000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000304')$$,
  '23514', 'last tenant owner cannot be removed',
  'the final tenant owner cannot be removed'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000301', true);
select set_config('request.jwt.claim.aal', 'aal1', true);
select throws_ok(
  $$select public.set_platform_user_role('s22-platform-target@veyocast.test', 'platform_viewer')$$,
  '42501', 'sensitive platform mutations require aal2',
  'platform role changes require AAL2'
);

select set_config('request.jwt.claim.aal', 'aal2', true);
select is(
  public.set_platform_user_role('s22-platform-target@veyocast.test', 'platform_viewer'),
  '00000000-0000-4000-8000-000000000309'::uuid,
  'platform owner can assign a separate platform role'
);

select throws_ok(
  $$select public.remove_platform_user_access('00000000-0000-4000-8000-000000000301')$$,
  '42501', 'self lockout is not allowed',
  'platform owners cannot remove their own access'
);

select ok(
  not has_table_privilege('authenticated', 'public.tenant_memberships', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.tenant_invitations', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.platform_memberships', 'INSERT,UPDATE,DELETE'),
  'identity mutations are only reachable through guarded commands'
);

select is(
  (select count(*) from public.audit_events where action in ('tenant.provisioned', 'tenant.screen_limit.changed', 'tenant.lifecycle.changed', 'tenant.invitation.created', 'tenant.invitation.delivered', 'tenant.invitation.resent', 'tenant.invitation.accepted', 'tenant.member.role_changed', 'platform.member.role_set')),
  10::bigint,
  'every successful S22 mutation appends a privacy-safe audit event'
);

select * from finish();
rollback;
