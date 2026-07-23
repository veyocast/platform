begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(6);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  (
    '00000000-0000-4000-8000-000000000521',
    'authenticated', 'authenticated', 'screen-admin@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000522',
    'authenticated', 'authenticated', 'screen-viewer@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  );

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000521', 'Screen admin'),
  ('00000000-0000-4000-8000-000000000522', 'Screen viewer');

insert into public.tenants (id, name, slug, screen_limit)
values (
  '10000000-0000-4000-8000-000000000521',
  'Screen bulk tenant',
  'screen-bulk-tenant',
  5
);
insert into public.tenant_settings (tenant_id)
values ('10000000-0000-4000-8000-000000000521');
insert into public.tenant_memberships (tenant_id, user_id, role)
values
  (
    '10000000-0000-4000-8000-000000000521',
    '00000000-0000-4000-8000-000000000521',
    'tenant_admin'
  ),
  (
    '10000000-0000-4000-8000-000000000521',
    '00000000-0000-4000-8000-000000000522',
    'tenant_viewer'
  );

insert into public.screens (id, tenant_id, name, status, created_by)
values
  (
    '60000000-0000-4000-8000-000000000521',
    '10000000-0000-4000-8000-000000000521',
    'Kantine',
    'active',
    '00000000-0000-4000-8000-000000000521'
  ),
  (
    '60000000-0000-4000-8000-000000000522',
    '10000000-0000-4000-8000-000000000521',
    'Sponsorwand',
    'active',
    '00000000-0000-4000-8000-000000000521'
  );

insert into public.player_devices (
  id, tenant_id, screen_id, device_name, token_hash, status
)
values
  (
    '70000000-0000-4000-8000-000000000521',
    '10000000-0000-4000-8000-000000000521',
    '60000000-0000-4000-8000-000000000521',
    'Kantine Player',
    repeat('a', 64),
    'paired'
  ),
  (
    '70000000-0000-4000-8000-000000000522',
    '10000000-0000-4000-8000-000000000521',
    '60000000-0000-4000-8000-000000000522',
    'Sponsorwand Player',
    repeat('b', 64),
    'paired'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000521',
  true
);

select is(
  (
    public.request_screen_sync_retries_v2(
      '10000000-0000-4000-8000-000000000521',
      array[
        '60000000-0000-4000-8000-000000000522'::uuid,
        '60000000-0000-4000-8000-000000000521'::uuid,
        '60000000-0000-4000-8000-000000000521'::uuid
      ],
      '90000000-0000-4000-8000-000000000521'
    ) ->> 'targetCount'
  ),
  '2',
  'bulk retry normalizes duplicate screen targets'
);
select is(
  (
    select count(*) from public.player_devices
    where tenant_id = '10000000-0000-4000-8000-000000000521'
      and sync_retry_requested_at is not null
  ),
  2::bigint,
  'bulk retry updates every selected paired player atomically'
);
select is(
  (
    select count(*) from public.publisher_command_receipts
    where command_type = 'screens.sync_retry.bulk'
  ),
  1::bigint,
  'bulk retry stores one idempotency receipt'
);
select is(
  (
    public.request_screen_sync_retries_v2(
      '10000000-0000-4000-8000-000000000521',
      array[
        '60000000-0000-4000-8000-000000000521'::uuid,
        '60000000-0000-4000-8000-000000000522'::uuid
      ],
      '90000000-0000-4000-8000-000000000521'
    ) ->> 'deviceCount'
  ),
  '2',
  'an equivalent target set replays the stored bulk outcome'
);
select is(
  (
    select count(*) from public.audit_events
    where action = 'publisher.screens.sync_retry_requested'
  ),
  1::bigint,
  'bulk impact is represented by one server-authored audit event'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000522',
  true
);
select throws_ok(
  $$select public.request_screen_sync_retries_v2(
    '10000000-0000-4000-8000-000000000521',
    array['60000000-0000-4000-8000-000000000521'::uuid],
    '90000000-0000-4000-8000-000000000522'
  )$$,
  '42501',
  'actor cannot manage screens for this tenant',
  'a viewer cannot execute a bulk device command'
);

select * from finish();
rollback;
