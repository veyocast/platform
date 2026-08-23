begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(4);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-4000-8000-000000001225', 'authenticated', 'authenticated', 'theme-admin@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001226', 'authenticated', 'authenticated', 'theme-editor@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001227', 'authenticated', 'authenticated', 'theme-owner@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles(id, display_name) values
  ('00000000-0000-4000-8000-000000001225', 'Theme admin'),
  ('00000000-0000-4000-8000-000000001226', 'Theme editor'),
  ('00000000-0000-4000-8000-000000001227', 'Theme owner');
insert into public.tenants(id, name, slug) values
  ('10000000-0000-4000-8000-000000001225', 'Theme permissions', 'theme-permissions'),
  ('10000000-0000-4000-8000-000000001227', 'Other theme tenant', 'other-theme-permissions');
insert into public.tenant_settings(tenant_id) values
  ('10000000-0000-4000-8000-000000001225'),
  ('10000000-0000-4000-8000-000000001227');
insert into public.tenant_memberships(tenant_id, user_id, role) values
  ('10000000-0000-4000-8000-000000001225', '00000000-0000-4000-8000-000000001225', 'tenant_admin'),
  ('10000000-0000-4000-8000-000000001225', '00000000-0000-4000-8000-000000001226', 'tenant_editor'),
  ('10000000-0000-4000-8000-000000001227', '00000000-0000-4000-8000-000000001227', 'tenant_owner');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001225', true);

select is(
  public.update_tenant_theme_settings_v1(
    '10000000-0000-4000-8000-000000001225', 0, 'atelier', '1.0.0',
    '{"kind":"fixed","mode":"light"}'::jsonb, null, null
  ) ->> 'outcome',
  'applied',
  'tenant admin can change the creation default theme'
);
select is(
  (select default_theme_id from public.tenant_settings
   where tenant_id = '10000000-0000-4000-8000-000000001225'),
  'atelier',
  'the explicit tenant default persists'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001226', true);
select throws_ok(
  $$select public.update_tenant_theme_settings_v1(
    '10000000-0000-4000-8000-000000001225', 1, 'obsidian', '1.0.0',
    '{"kind":"fixed","mode":"dark"}'::jsonb, null, null
  )$$,
  '42501',
  'actor cannot update tenant theme settings',
  'tenant editor cannot change the default without the settings capability'
);
select throws_ok(
  $$select public.update_tenant_theme_settings_v1(
    '10000000-0000-4000-8000-000000001227', 0, 'obsidian', '1.0.0',
    '{"kind":"fixed","mode":"dark"}'::jsonb, null, null
  )$$,
  '42501',
  'actor cannot update tenant theme settings',
  'cross-tenant default theme mutation remains impossible'
);

select * from finish();
rollback;
