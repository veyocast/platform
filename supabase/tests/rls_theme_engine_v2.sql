begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-4000-8000-000000001091', 'authenticated', 'authenticated', 'theme-a@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001092', 'authenticated', 'authenticated', 'theme-b@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-000000001091', 'Theme owner A'),
  ('00000000-0000-4000-8000-000000001092', 'Theme owner B');

insert into public.tenants (id, name, slug) values
  ('10000000-0000-4000-8000-000000001091', 'Theme tenant A', 'theme-tenant-a'),
  ('10000000-0000-4000-8000-000000001092', 'Theme tenant B', 'theme-tenant-b');

insert into public.tenant_settings (tenant_id) values
  ('10000000-0000-4000-8000-000000001091'),
  ('10000000-0000-4000-8000-000000001092');

insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('10000000-0000-4000-8000-000000001091', '00000000-0000-4000-8000-000000001091', 'tenant_owner'),
  ('10000000-0000-4000-8000-000000001092', '00000000-0000-4000-8000-000000001092', 'tenant_owner');

select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_catalog.pg_class
   where oid = 'public.tenant_theme_category_overrides'::regclass),
  'theme category overrides force RLS'
);

select ok(
  not has_table_privilege('anon', 'public.tenant_theme_category_overrides', 'SELECT')
  and not has_table_privilege('authenticated', 'public.tenant_theme_category_overrides', 'INSERT')
  and has_table_privilege('authenticated', 'public.tenant_theme_category_overrides', 'SELECT'),
  'Data API grants are read-only and authenticated'
);

select ok(
  not has_function_privilege('anon', 'public.update_tenant_theme_settings_v1(uuid,bigint,text,text,jsonb,text,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.update_tenant_theme_settings_v1(uuid,bigint,text,text,jsonb,text,text)', 'EXECUTE'),
  'tenant theme command is unavailable to anon'
);

select is(
  private.resolve_theme_mode_v1(
    '{"kind":"schedule","fallback":"light","entries":[{"days":[4],"start":"18:00","end":"23:00","mode":"dark"}]}'::jsonb,
    'Europe/Amsterdam',
    '2026-08-20T18:30:00Z'::timestamptz
  ),
  'dark',
  'schedule mode is resolved deterministically in tenant local time'
);

insert into public.tenant_products (
  tenant_id, source, slug, name, category, price_cents
) values
  ('10000000-0000-4000-8000-000000001091', 'manual', 'cola-a', 'Cola A', 'Dranken', 250),
  ('10000000-0000-4000-8000-000000001091', 'manual', 'cola-b', 'Cola B', 'Dranken', 275),
  ('10000000-0000-4000-8000-000000001092', 'manual', 'cola-c', 'Cola C', 'Dranken', 300);

select is(
  (select min(source_category_id) from public.tenant_products
   where tenant_id = '10000000-0000-4000-8000-000000001091'),
  (select max(source_category_id) from public.tenant_products
   where tenant_id = '10000000-0000-4000-8000-000000001091'),
  'products in one tenant/source category share a stable source category id'
);

select isnt(
  (select source_category_id from public.tenant_products where slug = 'cola-a'),
  (select source_category_id from public.tenant_products where slug = 'cola-c'),
  'equal source category names in different tenants never share identity'
);

update public.tenant_products set category = 'Frisdranken' where slug = 'cola-a';
select is(
  (select source_category_id from public.tenant_products where slug = 'cola-a'),
  (select source_category_id from public.tenant_products where slug = 'cola-b'),
  'a later source category rename preserves product category identity'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001091', true);

select is(
  public.update_tenant_theme_settings_v1(
    '10000000-0000-4000-8000-000000001091', 0, 'obsidian', '1.0.0',
    '{"kind":"fixed","mode":"dark"}'::jsonb, '#315CFF', null
  ) ->> 'outcome',
  'applied',
  'tenant owner updates the own tenant theme with expected revision'
);

select is(
  (select default_theme_id from public.tenant_settings
   where tenant_id = '10000000-0000-4000-8000-000000001091'),
  'obsidian',
  'theme setting is persisted on the correct tenant'
);

select throws_ok(
  $$select public.update_tenant_theme_settings_v1(
    '10000000-0000-4000-8000-000000001092', 0, 'atelier', '1.0.0',
    '{"kind":"fixed","mode":"light"}'::jsonb, null, null
  )$$,
  '42501',
  'actor cannot update tenant theme settings',
  'tenant A cannot update tenant B theme settings'
);

create temporary table theme_test_source (id uuid not null);
insert into theme_test_source values (
  public.create_dynamic_data_source_v1(
    '10000000-0000-4000-8000-000000001091',
    'Twelve bron',
    'twelve_excel',
    '{}'::jsonb
  )
);

select is(
  public.upsert_tenant_theme_category_override_v1(
    '10000000-0000-4000-8000-000000001091',
    (select id from theme_test_source),
    'source-category-drinks',
    0,
    'Dranken',
    'left',
    0
  ) ->> 'outcome',
  'applied',
  'owner stores a stable source-category override'
);

select is(
  public.upsert_tenant_theme_category_override_v1(
    '10000000-0000-4000-8000-000000001091',
    (select id from theme_test_source),
    'source-category-drinks',
    0,
    'Nieuwe naam',
    'right',
    1
  ) ->> 'outcome',
  'conflict',
  'stale category override revision is rejected before mutation'
);

select is(
  (select count(*) from public.tenant_theme_category_overrides),
  1::bigint,
  'tenant A sees its own category override'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001092', true);

select is(
  (select count(*) from public.tenant_theme_category_overrides),
  0::bigint,
  'tenant B cannot read tenant A category overrides'
);

select * from finish();
rollback;
