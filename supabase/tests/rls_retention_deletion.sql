begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(6);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-4000-8000-000000000991', 'authenticated', 'authenticated', 'delete-owner@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000992', 'authenticated', 'authenticated', 'delete-other@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);
insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000991', 'Delete owner'),
  ('00000000-0000-4000-8000-000000000992', 'Delete other');
insert into public.tenants (id, name, slug)
values
  ('10000000-0000-4000-8000-000000000991', 'Delete tenant', 'delete-tenant'),
  ('10000000-0000-4000-8000-000000000992', 'Other delete tenant', 'other-delete-tenant');
insert into public.tenant_settings (tenant_id)
values
  ('10000000-0000-4000-8000-000000000991'),
  ('10000000-0000-4000-8000-000000000992');
insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000991', '00000000-0000-4000-8000-000000000991', 'tenant_owner'),
  ('10000000-0000-4000-8000-000000000992', '00000000-0000-4000-8000-000000000992', 'tenant_owner');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000991', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000991","aal":"aal2"}', true);

select is(
  public.request_data_deletion_v1(
    'tenant',
    '10000000-0000-4000-8000-000000000991',
    'Tenant wil de dienstverlening beëindigen.'
  ) ->> 'outcome',
  'requested',
  'AAL2 tenant owner can register a formal tenant deletion request'
);
select is(
  (select count(*) from public.data_deletion_requests),
  1::bigint,
  'requester can read its own deletion request'
);
select throws_ok(
  $$select public.run_retention_maintenance_v1(false)$$,
  '42501',
  null,
  'authenticated tenants cannot execute service retention'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000992', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000992","aal":"aal2"}', true);

select is(
  (select count(*) from public.data_deletion_requests),
  0::bigint,
  'another tenant cannot inspect deletion requests'
);
select is(
  (select count(*) from public.retention_policies),
  0::bigint,
  'tenant users cannot inspect platform retention governance'
);
select throws_ok(
  $$select public.request_data_deletion_v1(
    'tenant',
    '10000000-0000-4000-8000-000000000991',
    'Cross tenant'
  )$$,
  '42501',
  'tenant settings capability required',
  'a tenant cannot request deletion of another tenant'
);

select * from finish();
rollback;
