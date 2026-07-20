begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values (
  '00000000-0000-4000-8000-000000000211',
  'authenticated',
  'authenticated',
  'status-admin@veyocast.test',
  'test',
  now(),
  now(),
  now(),
  '{}'::jsonb,
  '{}'::jsonb
);

insert into public.profiles (id, display_name)
values ('00000000-0000-4000-8000-000000000211', 'Status admin');

insert into public.tenants (id, name, slug)
values
  ('10000000-0000-4000-8000-000000000211', 'Paused tenant', 'paused-tenant'),
  ('10000000-0000-4000-8000-000000000212', 'Archived tenant', 'archived-tenant');

insert into public.platform_memberships (user_id, role)
values ('00000000-0000-4000-8000-000000000211', 'platform_admin');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000211', 'tenant_admin'),
  ('10000000-0000-4000-8000-000000000212', '00000000-0000-4000-8000-000000000211', 'tenant_admin');

insert into public.playlists (id, tenant_id, name, created_by)
values
  ('40000000-0000-4000-8000-000000000211', '10000000-0000-4000-8000-000000000211', 'Paused playlist', '00000000-0000-4000-8000-000000000211'),
  ('40000000-0000-4000-8000-000000000212', '10000000-0000-4000-8000-000000000212', 'Archived playlist', '00000000-0000-4000-8000-000000000211');

insert into public.screens (id, tenant_id, name, created_by)
values
  ('30000000-0000-4000-8000-000000000211', '10000000-0000-4000-8000-000000000211', 'Paused screen', '00000000-0000-4000-8000-000000000211'),
  ('30000000-0000-4000-8000-000000000213', '10000000-0000-4000-8000-000000000211', 'Unpaired paused screen', '00000000-0000-4000-8000-000000000211'),
  ('30000000-0000-4000-8000-000000000212', '10000000-0000-4000-8000-000000000212', 'Archived screen', '00000000-0000-4000-8000-000000000211');

insert into public.player_devices (id, tenant_id, screen_id, device_name, token_hash)
values
  ('20000000-0000-4000-8000-000000000211', '10000000-0000-4000-8000-000000000211', '30000000-0000-4000-8000-000000000211', 'Paused player', repeat('c', 64)),
  ('20000000-0000-4000-8000-000000000212', '10000000-0000-4000-8000-000000000212', '30000000-0000-4000-8000-000000000212', 'Archived player', repeat('d', 64));

insert into public.pairing_sessions (code_hash, expires_at)
values (repeat('a', 64), now() + interval '10 minutes');

update public.tenants set status = 'paused' where id = '10000000-0000-4000-8000-000000000211';
update public.tenants set status = 'archived' where id = '10000000-0000-4000-8000-000000000212';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000211', true);
select set_config('request.jwt.claim.aal', 'aal2', true);

select is(
  (select count(*) from public.playlists where tenant_id = '10000000-0000-4000-8000-000000000211'),
  1::bigint,
  'paused tenants remain readable'
);

select throws_ok(
  $$insert into public.playlists (tenant_id, name, created_by) values ('10000000-0000-4000-8000-000000000211', 'Blocked paused mutation', '00000000-0000-4000-8000-000000000211')$$,
  '42501',
  'tenant mutations require an active tenant',
  'paused tenants reject content mutations'
);

select throws_ok(
  $$update public.tenants set name = 'Blocked paused rename' where id = '10000000-0000-4000-8000-000000000211'$$,
  '42501',
  'tenant mutations require an active tenant',
  'paused tenants reject direct tenant mutations'
);

select throws_ok(
  $$select public.claim_pairing_session(repeat('a', 64), '10000000-0000-4000-8000-000000000211', '30000000-0000-4000-8000-000000000213', 'Blocked player', repeat('b', 64))$$,
  '42501',
  'tenant mutations require an active tenant',
  'paused tenants reject new player pairing'
);

select throws_ok(
  $$update public.playlists set name = 'Blocked archived mutation' where id = '40000000-0000-4000-8000-000000000212'$$,
  '42501',
  'tenant mutations require an active tenant',
  'archived tenants reject normal mutations'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select count(*) from public.get_player_device_bootstrap(repeat('c', 64))),
  1::bigint,
  'paused tenant playback bootstrap remains available'
);

select is(
  (select count(*) from public.get_player_device_bootstrap(repeat('d', 64))),
  1::bigint,
  'archived tenant last-known player bootstrap remains available'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000211', true);
select set_config('request.jwt.claim.aal', 'aal1', true);

select throws_ok(
  $$update public.tenants set status = 'active' where id = '10000000-0000-4000-8000-000000000211'$$,
  '42501',
  'sensitive platform mutations require aal2',
  'AAL1 cannot change tenant lifecycle status'
);

select set_config('request.jwt.claim.aal', 'aal2', true);
select lives_ok(
  $$update public.tenants set status = 'active' where id = '10000000-0000-4000-8000-000000000211'$$,
  'AAL2 platform admin can restore a tenant'
);

select * from finish();

rollback;
