begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(16);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-4000-8000-000000000401', 'authenticated', 'authenticated', 'demo-platform-owner@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000402', 'authenticated', 'authenticated', 'demo-platform-admin@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000403', 'authenticated', 'authenticated', 'demo-tenant-owner@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000401', 'Demo platform owner'),
  ('00000000-0000-4000-8000-000000000402', 'Demo platform admin'),
  ('00000000-0000-4000-8000-000000000403', 'Demo tenant owner');

insert into public.platform_memberships (user_id, role)
values
  ('00000000-0000-4000-8000-000000000401', 'platform_owner'),
  ('00000000-0000-4000-8000-000000000402', 'platform_admin');

insert into public.tenants (id, name, slug, screen_limit)
values
  ('10000000-0000-4000-8000-000000000401', 'Demo tenant', 'demo-review-tenant', 2),
  ('10000000-0000-4000-8000-000000000402', 'Paused demo tenant', 'paused-demo-review-tenant', 2);

insert into public.tenant_settings (tenant_id)
values
  ('10000000-0000-4000-8000-000000000401'),
  ('10000000-0000-4000-8000-000000000402');

insert into public.tenant_memberships (tenant_id, user_id, role)
values (
  '10000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000403',
  'tenant_owner'
);

insert into public.playlists (
  id, tenant_id, name, status, created_by
)
values
  (
    '20000000-0000-4000-8000-000000000401',
    '10000000-0000-4000-8000-000000000401',
    'Google Play review',
    'published',
    '00000000-0000-4000-8000-000000000403'
  ),
  (
    '20000000-0000-4000-8000-000000000402',
    '10000000-0000-4000-8000-000000000401',
    'Ongepubliceerde review',
    'draft',
    '00000000-0000-4000-8000-000000000403'
  ),
  (
    '20000000-0000-4000-8000-000000000403',
    '10000000-0000-4000-8000-000000000401',
    'Gearchiveerde review',
    'published',
    '00000000-0000-4000-8000-000000000403'
  ),
  (
    '20000000-0000-4000-8000-000000000404',
    '10000000-0000-4000-8000-000000000402',
    'Review van gepauzeerde tenant',
    'published',
    '00000000-0000-4000-8000-000000000403'
  );

insert into public.playlist_releases (
  id, tenant_id, playlist_id, version, manifest_hash, manifest_json,
  item_count, total_duration_seconds, total_bytes, published_by
)
values
  (
    '30000000-0000-4000-8000-000000000401',
    '10000000-0000-4000-8000-000000000401',
    '20000000-0000-4000-8000-000000000401',
    1,
    repeat('a', 64),
    '{}'::jsonb,
    1,
    10,
    1024,
    '00000000-0000-4000-8000-000000000403'
  ),
  (
    '30000000-0000-4000-8000-000000000402',
    '10000000-0000-4000-8000-000000000401',
    '20000000-0000-4000-8000-000000000403',
    1,
    repeat('b', 64),
    '{}'::jsonb,
    1,
    10,
    1024,
    '00000000-0000-4000-8000-000000000403'
  ),
  (
    '30000000-0000-4000-8000-000000000403',
    '10000000-0000-4000-8000-000000000402',
    '20000000-0000-4000-8000-000000000404',
    1,
    repeat('c', 64),
    '{}'::jsonb,
    1,
    10,
    1024,
    '00000000-0000-4000-8000-000000000403'
  );

update public.tenants
set status = 'paused'
where id = '10000000-0000-4000-8000-000000000402';

update public.playlists
set status = 'archived',
    archived_at = now()
where id = '20000000-0000-4000-8000-000000000403';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000401', true);
select set_config('request.jwt.claim.aal', 'aal1', true);

select throws_ok(
  $$select public.set_staging_player_demo_playlist('10000000-0000-4000-8000-000000000401', '20000000-0000-4000-8000-000000000401')$$,
  '42501',
  'sensitive platform mutations require aal2',
  'platform owner must confirm AAL2 before configuring the review playlist'
);

select set_config('request.jwt.claim.aal', 'aal2', true);

select lives_ok(
  $$select public.set_staging_player_demo_playlist('10000000-0000-4000-8000-000000000401', '20000000-0000-4000-8000-000000000401')$$,
  'platform owner can configure a published review playlist at AAL2'
);

select is(
  (select playlist_id from public.platform_player_demo_playlists where environment = 'staging'),
  '20000000-0000-4000-8000-000000000401'::uuid,
  'the staging review playlist is stored'
);

select is(
  (select updated_by from public.platform_player_demo_playlists where environment = 'staging'),
  '00000000-0000-4000-8000-000000000401'::uuid,
  'the platform owner remains attributable'
);

select is(
  (select count(*) from public.audit_events where action = 'platform.player_demo_playlist.configured'),
  1::bigint,
  'the configuration change is audited'
);

select throws_ok(
  $$select public.set_staging_player_demo_playlist('10000000-0000-4000-8000-000000000401', '20000000-0000-4000-8000-000000000402')$$,
  '23514',
  'demo playlist requires a published release',
  'a playlist without an immutable release is rejected'
);

select throws_ok(
  $$select public.set_staging_player_demo_playlist('10000000-0000-4000-8000-000000000401', '20000000-0000-4000-8000-000000000403')$$,
  '23514',
  'demo playlist is unavailable',
  'an archived playlist cannot become review content'
);

select throws_ok(
  $$select public.set_staging_player_demo_playlist('10000000-0000-4000-8000-000000000402', '20000000-0000-4000-8000-000000000404')$$,
  '23514',
  'demo playlist is unavailable',
  'a paused tenant cannot expose review content'
);

select throws_ok(
  $$select public.set_staging_player_demo_playlist('10000000-0000-4000-8000-000000000402', '20000000-0000-4000-8000-000000000401')$$,
  '23514',
  'demo playlist is unavailable',
  'a tenant and playlist mismatch is rejected'
);

select throws_ok(
  $$insert into public.platform_player_demo_playlists (environment, tenant_id, playlist_id, updated_by)
    values ('staging', '10000000-0000-4000-8000-000000000401', '20000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000401')$$,
  '42501',
  'permission denied for table platform_player_demo_playlists',
  'even a platform owner cannot bypass the guarded command with a direct insert'
);

select throws_ok(
  $$update public.platform_player_demo_playlists
    set playlist_id = '20000000-0000-4000-8000-000000000403'
    where environment = 'staging'$$,
  '42501',
  'permission denied for table platform_player_demo_playlists',
  'even a platform owner cannot directly rewrite review configuration'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000402', true);
select set_config('request.jwt.claim.aal', 'aal2', true);

select throws_ok(
  $$select public.set_staging_player_demo_playlist('10000000-0000-4000-8000-000000000401', '20000000-0000-4000-8000-000000000401')$$,
  '42501',
  'platform owner capability required',
  'platform admin cannot replace the review playlist'
);

select is(
  (select count(*) from public.platform_player_demo_playlists),
  0::bigint,
  'platform admin cannot read the owner-only configuration row'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000403', true);
select set_config('request.jwt.claim.aal', 'aal2', true);

select throws_ok(
  $$select public.set_staging_player_demo_playlist('10000000-0000-4000-8000-000000000401', '20000000-0000-4000-8000-000000000401')$$,
  '42501',
  'platform owner capability required',
  'tenant owner cannot configure the platform review playlist'
);

select is(
  (select count(*) from public.platform_player_demo_playlists),
  0::bigint,
  'tenant owner cannot read the owner-only configuration row'
);

reset role;
set local role anon;

select throws_ok(
  $$select count(*) from public.platform_player_demo_playlists$$,
  '42501',
  'permission denied for table platform_player_demo_playlists',
  'anonymous clients cannot inspect review configuration'
);

select * from finish();
rollback;
