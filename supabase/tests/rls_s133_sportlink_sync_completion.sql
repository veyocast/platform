begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(7);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-4000-8000-000000001331', 'authenticated',
  'authenticated', 's133-owner@test.invalid', 'x', now(), now(), now(),
  '{}', '{}'
);
insert into public.profiles(id, display_name) values
  ('00000000-0000-4000-8000-000000001331', 'S133 owner');
insert into public.tenants(id, name, slug) values
  ('10000000-0000-4000-8000-000000001331', 'S133 tenant', 's133-tenant');
insert into public.tenant_settings(tenant_id) values
  ('10000000-0000-4000-8000-000000001331');
insert into public.tenant_memberships(tenant_id, user_id, role) values (
  '10000000-0000-4000-8000-000000001331',
  '00000000-0000-4000-8000-000000001331',
  'tenant_owner'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001331',
  true
);
select lives_ok(
  $$select public.upsert_sportlink_connection_v1(
    '10000000-0000-4000-8000-000000001331',
    'Sportlink · S133',
    'S133 SV',
    '1234',
    'encrypted-value',
    'initialization-vector',
    'authentication-tag'
  )$$,
  'tenant owner can create the encrypted Sportlink connection'
);

reset role;
insert into public.sportlink_sync_runs(
  id, tenant_id, connection_id, dataset_group, status, worker_id, locked_at
) values (
  '40000000-0000-4000-8000-000000001331',
  '10000000-0000-4000-8000-000000001331',
  (select id from public.sportlink_connections
   where tenant_id = '10000000-0000-4000-8000-000000001331'),
  'club_profile',
  'running',
  'worker:s133-provider-asset',
  now()
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select lives_ok(
  $$select public.complete_sportlink_sync_v4(
    '40000000-0000-4000-8000-000000001331',
    'worker:s133-provider-asset',
    '{"externalId":"club-s133","name":"S133 SV"}'::jsonb,
    jsonb_build_object(
      'assetId', '50000000-0000-5000-8000-000000001331',
      'checksumSha256', repeat('a', 64),
      'externalId', 'club-s133',
      'fileSizeBytes', 12345,
      'height', 398,
      'mimeType', 'image/webp',
      'role', 'club_logo',
      'storagePath', 'providers/sportlink/club_logo/' || repeat('a', 64) || '.webp',
      'title', 'S133 SV clublogo',
      'width', 512
    ),
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
  )$$,
  'v4 accepts and completes a canonical content-addressed provider asset'
);

reset role;
select is(
  (select status from public.sportlink_sync_runs
   where id = '40000000-0000-4000-8000-000000001331'),
  'succeeded',
  'the provider sync run completes successfully'
);
select is(
  (select external_entity_id from public.provider_asset_cache
   where provider = 'sportlink' and asset_role = 'club_logo'),
  'club-s133',
  'the canonical club provider identity is cached'
);
select is(
  (select storage_path from public.provider_asset_versions
   where id = '50000000-0000-5000-8000-000000001331'),
  'providers/sportlink/club_logo/' || repeat('a', 64) || '.webp',
  'the immutable provider version keeps the canonical storage path'
);
select is(
  (select logo_provider_asset_version_id from public.sports_clubs
   where tenant_id = '10000000-0000-4000-8000-000000001331'
     and external_id = 'club-s133'),
  '50000000-0000-5000-8000-000000001331'::uuid,
  'the normalized club references the immutable provider version'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.complete_sportlink_sync_v4(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'execute'
  ) and has_function_privilege(
    'service_role',
    'public.complete_sportlink_sync_v4(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'execute'
  ),
  'completion remains unavailable to browser roles and executable by service_role'
);

select * from finish();
rollback;
