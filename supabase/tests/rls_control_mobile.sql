begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(8);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-4000-8000-000000000651', 'authenticated', 'authenticated', 'mobile-a@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000652', 'authenticated', 'authenticated', 'mobile-b@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);
insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000651', 'Mobile A'),
  ('00000000-0000-4000-8000-000000000652', 'Mobile B');
insert into public.tenants (id, name, slug)
values
  ('10000000-0000-4000-8000-000000000651', 'Mobile tenant A', 'mobile-a'),
  ('10000000-0000-4000-8000-000000000652', 'Mobile tenant B', 'mobile-b');
insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000651', '00000000-0000-4000-8000-000000000651', 'tenant_owner'),
  ('10000000-0000-4000-8000-000000000652', '00000000-0000-4000-8000-000000000652', 'tenant_owner');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000651', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000651","aal":"aal2"}', true);

insert into public.mobile_notification_preferences (
  user_id, tenant_id, screen_offline
)
values (
  '00000000-0000-4000-8000-000000000651',
  '10000000-0000-4000-8000-000000000651',
  true
);
select is(
  (select count(*) from public.mobile_notification_preferences),
  1::bigint,
  'user can read its own tenant preference'
);
select throws_ok(
  $$insert into public.mobile_notification_preferences(user_id, tenant_id)
    values (
      '00000000-0000-4000-8000-000000000651',
      '10000000-0000-4000-8000-000000000652'
    )$$,
  '42501',
  null,
  'user cannot create a preference for another tenant'
);
select lives_ok(
  $$select public.register_mobile_control_device_v1(
    repeat('a', 64),
    decode(repeat('ab', 32), 'hex'),
    '1.0.0',
    'nl-NL',
    'Europe/Amsterdam',
    1
  )$$,
  'authenticated user can register an encrypted mobile device token'
);
select is(
  (select count(*) from public.mobile_control_devices),
  1::bigint,
  'user can read only its own registered device'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000652', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000652","aal":"aal2"}', true);

select is(
  (select count(*) from public.mobile_notification_preferences),
  0::bigint,
  'other tenant cannot read notification preferences'
);
select is(
  (select count(*) from public.mobile_control_devices),
  0::bigint,
  'other user cannot read registered devices'
);
update public.mobile_notification_preferences
set media_failed = false
where user_id = '00000000-0000-4000-8000-000000000651';
reset role;
select is(
  (
    select media_failed
    from public.mobile_notification_preferences
    where user_id = '00000000-0000-4000-8000-000000000651'
  ),
  true,
  'other user cannot mutate preference rows'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000652', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000652","aal":"aal2"}', true);
select is(
  public.revoke_mobile_control_device_v1(
    (select id from public.mobile_control_devices limit 1)
  ),
  false,
  'other user cannot revoke a hidden device'
);

select * from finish();
rollback;
