-- Reproduceerbare lokale pilotidentiteit. Nooit voor productie gebruiken.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000101',
  'authenticated',
  'authenticated',
  'pilot-admin@veyocast.test',
  extensions.crypt('veyocast-local', extensions.gen_salt('bf')),
  now(),
  '', '', '', '',
  now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Pilot beheerder"}'::jsonb
)
on conflict (id) do update
set
  instance_id = excluded.instance_id,
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  confirmation_token = excluded.confirmation_token,
  recovery_token = excluded.recovery_token,
  email_change_token_new = excluded.email_change_token_new,
  email_change = excluded.email_change,
  updated_at = now();

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
values (
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000101',
  jsonb_build_object(
    'sub', '00000000-0000-4000-8000-000000000101',
    'email', 'pilot-admin@veyocast.test'
  ),
  'email', now(), now(), now()
)
on conflict (provider_id, provider) do update
set identity_data = excluded.identity_data, updated_at = now();

insert into public.profiles (id, display_name)
values ('00000000-0000-4000-8000-000000000101', 'Pilot beheerder')
on conflict (id) do update set display_name = excluded.display_name;

insert into public.tenants (id, name, slug, status, screen_limit)
values (
  '10000000-0000-4000-8000-000000000101',
  'VeyoCast pilotvereniging',
  'veyocast-pilot',
  'active',
  4
)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  status = excluded.status,
  screen_limit = excluded.screen_limit;

insert into public.tenant_memberships (tenant_id, user_id, role, created_by)
values (
  '10000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000101',
  'tenant_owner',
  '00000000-0000-4000-8000-000000000101'
)
on conflict (tenant_id, user_id) do update set role = excluded.role;

delete from public.platform_memberships
where user_id = '00000000-0000-4000-8000-000000000101';

insert into public.platform_memberships (user_id, role, created_by)
values (
  '00000000-0000-4000-8000-000000000101',
  'platform_owner',
  '00000000-0000-4000-8000-000000000101'
)
on conflict (user_id, role) do nothing;

insert into public.screens (
  id, tenant_id, name, location, orientation,
  resolution_width, resolution_height, created_by
)
values (
  '40000000-0000-4000-8000-000000000101',
  '10000000-0000-4000-8000-000000000101',
  'Pilot hoofdscherm',
  'Clubhuis entree',
  'landscape',
  1920,
  1080,
  '00000000-0000-4000-8000-000000000101'
)
on conflict (id) do update
set name = excluded.name, location = excluded.location, status = 'active';
