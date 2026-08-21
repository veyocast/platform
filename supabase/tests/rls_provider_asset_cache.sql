begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

select ok(
  (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class
   where oid = 'public.provider_asset_cache'::regclass),
  'provider cache forces RLS'
);

select ok(
  (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class
   where oid = 'public.provider_asset_versions'::regclass),
  'provider versions force RLS'
);

select ok(
  not has_table_privilege('anon', 'public.provider_asset_cache', 'SELECT')
  and not has_table_privilege('authenticated', 'public.provider_asset_cache', 'SELECT')
  and has_table_privilege('service_role', 'public.provider_asset_cache', 'SELECT'),
  'only trusted service processes can read provider identities'
);

select ok(
  not has_table_privilege('anon', 'public.provider_asset_versions', 'SELECT')
  and not has_table_privilege('authenticated', 'public.provider_asset_versions', 'SELECT')
  and has_table_privilege('service_role', 'public.provider_asset_versions', 'INSERT'),
  'only trusted service processes can write immutable provider versions'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.complete_sportlink_sync_v4(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'EXECUTE'
  ) and has_function_privilege(
    'service_role',
    'public.complete_sportlink_sync_v4(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'EXECUTE'
  ),
  'Sportlink cache completion is service-role only'
);

select has_column(
  'public', 'media_assets', 'source_kind',
  'media assets expose an explicit product-origin boundary'
);

select has_column(
  'public', 'sports_clubs', 'logo_provider_asset_version_id',
  'clubs can reference a global immutable provider version'
);

select is(
  (select public from storage.buckets where id = 'provider-assets'),
  false,
  'provider asset storage is private'
);

select * from finish();
rollback;
