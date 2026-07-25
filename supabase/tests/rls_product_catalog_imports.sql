begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-4000-8000-000000000981', 'authenticated', 'authenticated', 'products-owner@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000982', 'authenticated', 'authenticated', 'products-viewer@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000983', 'authenticated', 'authenticated', 'products-other@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000981', 'Products owner'),
  ('00000000-0000-4000-8000-000000000982', 'Products viewer'),
  ('00000000-0000-4000-8000-000000000983', 'Products other');

insert into public.tenants (id, name, slug)
values
  ('10000000-0000-4000-8000-000000000981', 'Products tenant', 'products-tenant'),
  ('10000000-0000-4000-8000-000000000982', 'Other products tenant', 'other-products-tenant');

insert into public.tenant_settings (tenant_id)
values
  ('10000000-0000-4000-8000-000000000981'),
  ('10000000-0000-4000-8000-000000000982');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000981', '00000000-0000-4000-8000-000000000981', 'tenant_owner'),
  ('10000000-0000-4000-8000-000000000981', '00000000-0000-4000-8000-000000000982', 'tenant_viewer'),
  ('10000000-0000-4000-8000-000000000982', '00000000-0000-4000-8000-000000000983', 'tenant_owner');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000981', true);

select ok(
  'tenant.product.write' = any(
    public.get_my_tenant_capabilities_v1('10000000-0000-4000-8000-000000000981')
  ),
  'tenant owner receives product write capability'
);

select lives_ok(
  $$select public.stage_product_import_v1(
    '10000000-0000-4000-8000-000000000981',
    'twelve_excel',
    'Twelve export.xlsx',
    repeat('a', 64),
    'Producten',
    '["Artikelnummer","Naam","Prijs"]'::jsonb,
    '{"Artikelnummer":"external_id","Naam":"name","Prijs":"price"}'::jsonb,
    '[{
      "included":true,
      "source":{"Artikelnummer":"12","Naam":"Koffie","Prijs":"2,50"},
      "normalized":{
        "external_id":"12","name":"Koffie","description":null,
        "category":"Dranken","price_cents":250,"vat_rate":9,
        "unit":"stuk","barcode":null,"active":true,
        "slug":"12","custom_fields":{}
      },
      "errors":[]
    }]'::jsonb
  )$$,
  'tenant owner can stage a bounded product import'
);

select is(
  public.apply_product_import_v1(
    (select id from public.product_catalog_imports where tenant_id = '10000000-0000-4000-8000-000000000981'),
    'merge'
  ) ->> 'outcome',
  'applied',
  'a valid staged import becomes a catalog snapshot'
);

select is(
  (select price_cents from public.tenant_products where tenant_id = '10000000-0000-4000-8000-000000000981'),
  250,
  'normalized price is persisted as integer cents'
);

select throws_ok(
  $$insert into public.tenant_products (tenant_id, slug, name)
    values ('10000000-0000-4000-8000-000000000981', 'bypass', 'Bypass')$$,
  '42501',
  null,
  'direct catalog writes remain denied'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000982', true);

select is(
  (select count(*) from public.tenant_products),
  1::bigint,
  'tenant viewer can read its own catalog through baseline capability'
);

select throws_ok(
  $$select public.update_tenant_product_v1(
    (select id from public.tenant_products limit 1),
    0, 'Gewijzigd', null, null, 300, 9, null, null, true
  )$$,
  '42501',
  'actor cannot edit product',
  'tenant viewer cannot mutate products'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000983', true);

select is(
  (select count(*) from public.tenant_products),
  0::bigint,
  'another tenant cannot read product rows'
);

select is(
  (select count(*) from public.product_catalog_import_rows),
  0::bigint,
  'another tenant cannot read raw imported cells'
);

select * from finish();
rollback;
