begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(11);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-4000-8000-000000001261', 'authenticated', 'authenticated', 'logo-owner@veyocast.test', 'test', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-4000-8000-000000001262', 'authenticated', 'authenticated', 'logo-viewer@veyocast.test', 'test', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-4000-8000-000000001263', 'authenticated', 'authenticated', 'logo-other@veyocast.test', 'test', now(), now(), now(), '{}', '{}');

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000001261', 'Logo owner'),
  ('00000000-0000-4000-8000-000000001262', 'Logo viewer'),
  ('00000000-0000-4000-8000-000000001263', 'Logo other');

insert into public.tenants (id, name, slug)
values
  ('10000000-0000-4000-8000-000000001261', 'Logo tenant', 'logo-tenant'),
  ('10000000-0000-4000-8000-000000001263', 'Other logo tenant', 'other-logo-tenant');

insert into public.tenant_settings (tenant_id)
values
  ('10000000-0000-4000-8000-000000001261'),
  ('10000000-0000-4000-8000-000000001263');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000001261', '00000000-0000-4000-8000-000000001261', 'tenant_owner'),
  ('10000000-0000-4000-8000-000000001261', '00000000-0000-4000-8000-000000001262', 'tenant_viewer'),
  ('10000000-0000-4000-8000-000000001263', '00000000-0000-4000-8000-000000001263', 'tenant_owner');

insert into public.tenant_products (id, tenant_id, slug, name)
values
  ('30000000-0000-4000-8000-000000001261', '10000000-0000-4000-8000-000000001261', 'koffie', 'Koffie');

insert into public.media_assets (
  id, tenant_id, created_by, kind, title, original_file_name, mime_type,
  status, storage_bucket, storage_path, file_size_bytes, checksum_sha256,
  width, height, processed_at
)
values
  ('20000000-0000-4000-8000-000000001261', '10000000-0000-4000-8000-000000001261', '00000000-0000-4000-8000-000000001261', 'image', 'Koffielogo', 'koffie.png', 'image/png', 'ready', 'tenant-media', 'tenants/10000000-0000-4000-8000-000000001261/assets/20000000-0000-4000-8000-000000001261/original/koffie.png', 1024, repeat('a', 64), 512, 512, now()),
  ('20000000-0000-4000-8000-000000001262', '10000000-0000-4000-8000-000000001261', '00000000-0000-4000-8000-000000001261', 'video', 'Animatie', 'animatie.mp4', 'video/mp4', 'ready', 'tenant-media', 'tenants/10000000-0000-4000-8000-000000001261/assets/20000000-0000-4000-8000-000000001262/player/animatie.mp4', 1024, repeat('b', 64), 512, 512, now()),
  ('20000000-0000-4000-8000-000000001263', '10000000-0000-4000-8000-000000001263', '00000000-0000-4000-8000-000000001263', 'image', 'Vreemd logo', 'vreemd.png', 'image/png', 'ready', 'tenant-media', 'tenants/10000000-0000-4000-8000-000000001263/assets/20000000-0000-4000-8000-000000001263/original/vreemd.png', 1024, repeat('c', 64), 512, 512, now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001261', true);

select is(
  public.set_tenant_product_logo_v1(
    '30000000-0000-4000-8000-000000001261', 0,
    '20000000-0000-4000-8000-000000001261'
  ) ->> 'outcome',
  'updated',
  'product writer links a ready same-tenant image'
);
select is(
  (select image_media_asset_id from public.tenant_products where id = '30000000-0000-4000-8000-000000001261'),
  '20000000-0000-4000-8000-000000001261'::uuid,
  'product stores the logo media reference'
);
select is(
  (select revision from public.tenant_products where id = '30000000-0000-4000-8000-000000001261'),
  1::bigint,
  'logo mutation advances the product revision'
);
select ok(
  exists (
    select 1 from public.audit_events
    where target_id = '30000000-0000-4000-8000-000000001261'
      and action = 'product.logo.updated'
  ),
  'logo mutation is audited'
);
select is(
  public.set_tenant_product_logo_v1(
    '30000000-0000-4000-8000-000000001261', 0,
    '20000000-0000-4000-8000-000000001261'
  ) ->> 'outcome',
  'conflict',
  'stale revision cannot overwrite a newer product'
);
select throws_ok(
  $$select public.set_tenant_product_logo_v1(
    '30000000-0000-4000-8000-000000001261', 1,
    '20000000-0000-4000-8000-000000001263'
  )$$,
  '23514', 'product logo asset is unavailable',
  'cross-tenant image cannot become a product logo'
);
select throws_ok(
  $$select public.set_tenant_product_logo_v1(
    '30000000-0000-4000-8000-000000001261', 1,
    '20000000-0000-4000-8000-000000001262'
  )$$,
  '23514', 'product logo asset is unavailable',
  'video cannot become a product logo'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001262', true);
select throws_ok(
  $$select public.set_tenant_product_logo_v1(
    '30000000-0000-4000-8000-000000001261', 1, null
  )$$,
  '42501', 'actor cannot edit product logo',
  'tenant viewer cannot change a product logo'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001263', true);
select throws_ok(
  $$select public.set_tenant_product_logo_v1(
    '30000000-0000-4000-8000-000000001261', 1, null
  )$$,
  '42501', 'actor cannot edit product logo',
  'another tenant cannot change the product logo'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001261', true);
select is(
  public.set_tenant_product_logo_v1(
    '30000000-0000-4000-8000-000000001261', 1, null
  ) ->> 'outcome',
  'updated',
  'product writer can remove the mutable logo reference'
);

reset role;
set local role anon;
select throws_ok(
  $$select public.set_tenant_product_logo_v1(
    '30000000-0000-4000-8000-000000001261', 2, null
  )$$,
  '42501',
  'permission denied for function set_tenant_product_logo_v1',
  'anonymous actors cannot execute the logo command'
);

select * from finish();
rollback;
