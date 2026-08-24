begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(26);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-4000-8000-000000001231', 'authenticated', 'authenticated', 'vector-media-editor@veyocast.test', 'test', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-4000-8000-000000001232', 'authenticated', 'authenticated', 'vector-media-viewer@veyocast.test', 'test', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-4000-8000-000000001233', 'authenticated', 'authenticated', 'vector-media-other@veyocast.test', 'test', now(), now(), now(), '{}', '{}');

insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-000000001231', 'Vector media-editor'),
  ('00000000-0000-4000-8000-000000001232', 'Vector media-lezer'),
  ('00000000-0000-4000-8000-000000001233', 'Andere tenanteditor');

insert into public.tenants (id, name, slug) values
  ('10000000-0000-4000-8000-000000001231', 'Vector media A', 'vector-media-a'),
  ('10000000-0000-4000-8000-000000001232', 'Vector media B', 'vector-media-b');

insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('10000000-0000-4000-8000-000000001231', '00000000-0000-4000-8000-000000001231', 'tenant_editor'),
  ('10000000-0000-4000-8000-000000001231', '00000000-0000-4000-8000-000000001232', 'tenant_viewer'),
  ('10000000-0000-4000-8000-000000001232', '00000000-0000-4000-8000-000000001233', 'tenant_editor');

insert into public.media_assets (
  id, tenant_id, created_by, kind, title, original_file_name, mime_type,
  status, storage_path, file_size_bytes, checksum_sha256, width, height,
  processed_at, source_kind
) values
  ('20000000-0000-4000-8000-000000001231', '10000000-0000-4000-8000-000000001231', '00000000-0000-4000-8000-000000001231', 'image', 'Welkom', 'welkom.webp', 'image/webp', 'ready', 'tenants/10000000-0000-4000-8000-000000001231/assets/20000000-0000-4000-8000-000000001231/original/welkom.webp', 2048, repeat('a', 64), 1920, 1080, now(), 'user'),
  ('20000000-0000-4000-8000-000000001232', '10000000-0000-4000-8000-000000001231', '00000000-0000-4000-8000-000000001231', 'image', 'Sponsor', 'sponsor.webp', 'image/webp', 'ready', 'tenants/10000000-0000-4000-8000-000000001231/assets/20000000-0000-4000-8000-000000001232/original/sponsor.webp', 2048, repeat('b', 64), 1920, 1080, now(), 'user'),
  ('20000000-0000-4000-8000-000000001233', '10000000-0000-4000-8000-000000001231', '00000000-0000-4000-8000-000000001231', 'image', 'Technische output', 'dynamic-slide.png', 'image/png', 'ready', 'tenants/10000000-0000-4000-8000-000000001231/assets/20000000-0000-4000-8000-000000001233/original/dynamic-slide.png', 2048, repeat('c', 64), 1920, 1080, now(), 'generated'),
  ('20000000-0000-4000-8000-000000001234', '10000000-0000-4000-8000-000000001232', '00000000-0000-4000-8000-000000001233', 'image', 'Andere tenant', 'ander.webp', 'image/webp', 'ready', 'tenants/10000000-0000-4000-8000-000000001232/assets/20000000-0000-4000-8000-000000001234/original/ander.webp', 2048, repeat('d', 64), 1920, 1080, now(), 'user');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001231', true);

create temporary table vector_collection_result on commit drop as
select public.mutate_media_collection_v1(
  '10000000-0000-4000-8000-000000001231', null, 0, 'create',
  '{"name":"Wedstrijddag","description":"Gedeelde wedstrijdcollectie"}'::jsonb,
  '30000000-0000-4000-8000-000000001231'
) as result;

select is((select result ->> 'outcome' from vector_collection_result), 'applied', 'editor creates a collection through the guarded command');
select is((select count(*) from public.media_collections where tenant_id = '10000000-0000-4000-8000-000000001231'), 1::bigint, 'collection is persisted once');
select is(
  public.mutate_media_collection_v1(
    '10000000-0000-4000-8000-000000001231', null, 0, 'create',
    '{"name":"Wedstrijddag","description":"Gedeelde wedstrijdcollectie"}'::jsonb,
    '30000000-0000-4000-8000-000000001231'
  ) ->> 'collectionId',
  (select result ->> 'collectionId' from vector_collection_result),
  'collection create replay returns the same identity'
);
select is((select count(*) from public.audit_events where action = 'publisher.media_collection.create'), 1::bigint, 'idempotent create writes one audit event');

create temporary table vector_bulk_result on commit drop as
select public.bulk_organize_media_assets_v1(
  '10000000-0000-4000-8000-000000001231',
  array['20000000-0000-4000-8000-000000001231'::uuid, '20000000-0000-4000-8000-000000001232'::uuid],
  'add_collection',
  (select (result ->> 'collectionId')::uuid from vector_collection_result),
  '30000000-0000-4000-8000-000000001232'
) as result;

select is((select (result ->> 'succeededCount')::integer from vector_bulk_result), 2, 'bulk collection command reports both successes');
select is((select count(*) from public.media_collection_items), 2::bigint, 'bulk collection command stores both memberships');
select is(
  (select count(*) from public.list_publisher_media_assets_v2(
    p_tenant_id => '10000000-0000-4000-8000-000000001231',
    p_collection_id => (select (result ->> 'collectionId')::uuid from vector_collection_result)
  )),
  2::bigint,
  'v2 listing filters by an active collection server-side'
);
select is(
  (select jsonb_array_length(collections) from public.list_publisher_media_assets_v2(
    p_tenant_id => '10000000-0000-4000-8000-000000001231', p_search => 'Welkom'
  )),
  1,
  'v2 listing returns collection metadata for the inspector'
);
select is(
  (select count(*) from public.list_publisher_media_assets_v2(
    p_tenant_id => '10000000-0000-4000-8000-000000001231'
  )),
  2::bigint,
  'generated output remains outside the user media library'
);

create temporary table vector_partial_result on commit drop as
select public.bulk_organize_media_assets_v1(
  '10000000-0000-4000-8000-000000001231',
  array['20000000-0000-4000-8000-000000001231'::uuid, '20000000-0000-4000-8000-000000001234'::uuid, '20000000-0000-4000-8000-000000001233'::uuid],
  'favorite', null,
  '30000000-0000-4000-8000-000000001233'
) as result;

select is((select result ->> 'outcome' from vector_partial_result), 'partial', 'bulk result explicitly reports partial success');
select is((select (result ->> 'succeededCount')::integer from vector_partial_result), 1, 'only tenant user media succeeds');
select is((select (result ->> 'failedCount')::integer from vector_partial_result), 2, 'cross-tenant and generated assets fail closed');
select is((select count(*) from public.media_asset_favorites), 1::bigint, 'partial command mutates only the valid local asset');
select is((select count(*) from public.media_asset_favorites where media_asset_id = '20000000-0000-4000-8000-000000001234'), 0::bigint, 'cross-tenant asset is unchanged');
select is(
  public.bulk_organize_media_assets_v1(
    '10000000-0000-4000-8000-000000001231',
    array['20000000-0000-4000-8000-000000001231'::uuid, '20000000-0000-4000-8000-000000001234'::uuid, '20000000-0000-4000-8000-000000001233'::uuid],
    'favorite', null,
    '30000000-0000-4000-8000-000000001233'
  ) ->> 'outcome',
  'partial',
  'bulk replay is idempotent'
);
select throws_ok(
  $$select public.bulk_organize_media_assets_v1(
    '10000000-0000-4000-8000-000000001231',
    array['20000000-0000-4000-8000-000000001232'::uuid],
    'favorite', null,
    '30000000-0000-4000-8000-000000001233'
  )$$,
  '23505', 'idempotency key belongs to another publisher command',
  'changed bulk replay is rejected'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001232', true);
select is((select count(*) from public.media_collections), 1::bigint, 'tenant viewer can read local collections');
select throws_ok(
  $$select public.mutate_media_collection_v1(
    '10000000-0000-4000-8000-000000001231', null, 0, 'create',
    '{"name":"Niet toegestaan"}'::jsonb,
    '30000000-0000-4000-8000-000000001234'
  )$$,
  '42501', 'actor cannot mutate media collections for this tenant',
  'tenant viewer cannot mutate collections'
);
select throws_ok(
  $$select public.bulk_organize_media_assets_v1(
    '10000000-0000-4000-8000-000000001231',
    array['20000000-0000-4000-8000-000000001231'::uuid],
    'favorite', null,
    '30000000-0000-4000-8000-000000001235'
  )$$,
  '42501', 'actor cannot organize media for this tenant',
  'tenant viewer cannot run bulk organization'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001233', true);
select is((select count(*) from public.media_collections), 0::bigint, 'other tenant cannot read local collections');
select is((select count(*) from public.media_collection_items), 0::bigint, 'other tenant cannot read collection memberships');
select throws_ok(
  $$select count(*) from public.list_publisher_media_assets_v2(
    p_tenant_id => '10000000-0000-4000-8000-000000001231'
  )$$,
  '42501', 'actor cannot list media for this tenant',
  'other tenant cannot invoke the guarded media listing'
);
select throws_ok(
  $$insert into public.media_collections (tenant_id, name, created_by)
    values (
      '10000000-0000-4000-8000-000000001231', 'RLS-aanval',
      '00000000-0000-4000-8000-000000001233'
    )$$,
  '42501', 'new row violates row-level security policy for table "media_collections"',
  'direct cross-tenant collection insert fails RLS'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001231', true);
select is(
  public.mutate_media_collection_v1(
    '10000000-0000-4000-8000-000000001231',
    (select (result ->> 'collectionId')::uuid from vector_collection_result),
    0, 'archive', '{}'::jsonb,
    '30000000-0000-4000-8000-000000001236'
  ) ->> 'outcome',
  'applied',
  'collection archives through an immutable audited command'
);
select is((select count(*) from public.media_collections where status = 'active'), 0::bigint, 'archived collection leaves the active collection set');
select is((select count(*) from public.media_collection_items), 2::bigint, 'archiving preserves collection membership history');

select * from finish();
rollback;
