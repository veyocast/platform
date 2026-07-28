begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000251', 'authenticated', 'authenticated', 'studio-editor@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000252', 'authenticated', 'authenticated', 'studio-viewer@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000253', 'authenticated', 'authenticated', 'other-editor@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000251', 'Studio editor'),
  ('00000000-0000-4000-8000-000000000252', 'Studio viewer'),
  ('00000000-0000-4000-8000-000000000253', 'Other editor');

insert into public.tenants (id, name, slug)
values
  ('10000000-0000-4000-8000-000000000251', 'Studio tenant', 'studio-tenant'),
  ('10000000-0000-4000-8000-000000000252', 'Other studio tenant', 'other-studio-tenant');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000251', '00000000-0000-4000-8000-000000000251', 'tenant_editor'),
  ('10000000-0000-4000-8000-000000000251', '00000000-0000-4000-8000-000000000252', 'tenant_viewer'),
  ('10000000-0000-4000-8000-000000000252', '00000000-0000-4000-8000-000000000253', 'tenant_editor');

insert into public.media_assets (
  id, tenant_id, created_by, kind, title, original_file_name, mime_type,
  status, storage_path, file_size_bytes, checksum_sha256, width, height, processed_at
)
values
  (
    '20000000-0000-4000-8000-000000000251',
    '10000000-0000-4000-8000-000000000251',
    '00000000-0000-4000-8000-000000000251',
    'image', 'Studio beeld', 'studio.webp', 'image/webp', 'ready',
    'tenants/10000000-0000-4000-8000-000000000251/assets/20000000-0000-4000-8000-000000000251/original/studio.webp',
    2048, repeat('a', 64), 1920, 1080, now()
  ),
  (
    '20000000-0000-4000-8000-000000000252',
    '10000000-0000-4000-8000-000000000252',
    '00000000-0000-4000-8000-000000000253',
    'image', 'Ander beeld', 'ander.webp', 'image/webp', 'ready',
    'tenants/10000000-0000-4000-8000-000000000252/assets/20000000-0000-4000-8000-000000000252/original/ander.webp',
    2048, repeat('b', 64), 1920, 1080, now()
  );

insert into public.media_variants (
  id, tenant_id, asset_id, variant_type, storage_path, mime_type,
  file_size_bytes, checksum_sha256, width, height
)
values (
  '21000000-0000-4000-8000-000000000251',
  '10000000-0000-4000-8000-000000000251',
  '20000000-0000-4000-8000-000000000251',
  'original',
  'tenants/10000000-0000-4000-8000-000000000251/assets/20000000-0000-4000-8000-000000000251/original/studio.webp',
  'image/webp', 2048, repeat('a', 64), 1920, 1080
);

insert into public.playlists (id, tenant_id, name, created_by, updated_by)
values (
  '50000000-0000-4000-8000-000000000251',
  '10000000-0000-4000-8000-000000000251',
  'Studio concept',
  '00000000-0000-4000-8000-000000000251',
  '00000000-0000-4000-8000-000000000251'
);

insert into public.screens (id, tenant_id, name, location, status, orientation, created_by)
values (
  '60000000-0000-4000-8000-000000000251',
  '10000000-0000-4000-8000-000000000251',
  'Studio scherm', 'Kantine', 'active', 'landscape',
  '00000000-0000-4000-8000-000000000251'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000251', true);

select is(
  (select outcome from public.mutate_playlist_draft_v1(
    '50000000-0000-4000-8000-000000000251', 0, 'update_details',
    '{"name":"Nieuw studio concept","description":"Veilig gewijzigd"}'::jsonb
  )),
  'applied',
  'first editor applies a mutation at the expected revision'
);

select is((select revision from public.playlists where id = '50000000-0000-4000-8000-000000000251'), 1::bigint, 'successful mutation increments revision exactly once');
select is((select updated_by from public.playlists where id = '50000000-0000-4000-8000-000000000251'), '00000000-0000-4000-8000-000000000251'::uuid, 'successful mutation records the last editor');

select is(
  (select outcome from public.mutate_playlist_draft_v1(
    '50000000-0000-4000-8000-000000000251', 0, 'update_details',
    '{"name":"Stale overschrijving"}'::jsonb
  )),
  'conflict',
  'a stale editor receives a typed conflict outcome'
);
select is((select name from public.playlists where id = '50000000-0000-4000-8000-000000000251'), 'Nieuw studio concept', 'stale mutation never overwrites current content');
select is(
  (select actual_revision from public.mutate_playlist_draft_v1(
    '50000000-0000-4000-8000-000000000251', 0, 'update_details',
    '{"name":"Nogmaals stale"}'::jsonb
  )),
  1::bigint,
  'conflict outcome returns the current revision for recovery'
);

select is(
  (select outcome from public.mutate_playlist_draft_v1(
    '50000000-0000-4000-8000-000000000251', 1, 'add_item',
    '{"mediaAssetId":"20000000-0000-4000-8000-000000000251"}'::jsonb
  )),
  'applied',
  'current editor can add own ready media'
);
select is((select revision from public.playlists where id = '50000000-0000-4000-8000-000000000251'), 2::bigint, 'add item advances the shared revision');

select throws_ok(
  $$select * from public.mutate_playlist_draft_v1(
    '50000000-0000-4000-8000-000000000251', 2, 'add_item',
    '{"mediaAssetId":"20000000-0000-4000-8000-000000000252"}'::jsonb
  )$$,
  '23514',
  'media asset is not ready in this tenant',
  'cross-tenant media cannot enter a draft through the command boundary'
);

reset role;
update public.tenant_memberships
set role = 'tenant_admin'
where tenant_id = '10000000-0000-4000-8000-000000000251'
  and user_id = '00000000-0000-4000-8000-000000000251';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000251', true);

select is(
  public.publish_playlist_to_targets_v3(
    '50000000-0000-4000-8000-000000000251', 1,
    array['60000000-0000-4000-8000-000000000251'::uuid], null,
    '01000000-0000-4000-8000-000000000251'
  ) ->> 'outcome',
  'conflict',
  'stale publish is rejected before a release is created'
);
select is((select count(*) from public.playlist_releases where playlist_id = '50000000-0000-4000-8000-000000000251'), 0::bigint, 'stale publish creates no release');

select is(
  public.publish_playlist_to_targets_v3(
    '50000000-0000-4000-8000-000000000251', 2,
    array['60000000-0000-4000-8000-000000000251'::uuid], 'Studio release',
    '01000000-0000-4000-8000-000000000252'
  ) ->> 'outcome',
  'published',
  'current revision publishes atomically for a tenant manager'
);
select is((select count(*) from public.playlist_releases where playlist_id = '50000000-0000-4000-8000-000000000251'), 1::bigint, 'successful publish creates one immutable release');

select is(
  public.mutate_playlist_draft_mobile_v1(
    '50000000-0000-4000-8000-000000000251',
    2,
    'move_item',
    jsonb_build_object(
      'direction', 'start',
      'itemId', (
        select id
        from public.playlist_items
        where playlist_id = '50000000-0000-4000-8000-000000000251'
        limit 1
      )
    ),
    '01000000-0000-4000-8000-000000000253'
  ) ->> 'outcome',
  'applied',
  'mobile wrapper applies an allowed draft mutation'
);
select is(
  (select revision from public.playlists where id = '50000000-0000-4000-8000-000000000251'),
  3::bigint,
  'mobile mutation advances the revision once'
);
select is(
  public.mutate_playlist_draft_mobile_v1(
    '50000000-0000-4000-8000-000000000251',
    2,
    'move_item',
    jsonb_build_object(
      'direction', 'start',
      'itemId', (
        select id
        from public.playlist_items
        where playlist_id = '50000000-0000-4000-8000-000000000251'
        limit 1
      )
    ),
    '01000000-0000-4000-8000-000000000253'
  ) ->> 'actualRevision',
  '3',
  'replayed mobile mutation returns the original result'
);
select is(
  (select revision from public.playlists where id = '50000000-0000-4000-8000-000000000251'),
  3::bigint,
  'replayed mobile mutation does not apply twice'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000252', true);
select throws_ok(
  $$select * from public.mutate_playlist_draft_v1(
    '50000000-0000-4000-8000-000000000251', 2, 'update_details',
    '{"name":"Viewer wijziging"}'::jsonb
  )$$,
  '42501',
  'actor cannot mutate this playlist',
  'tenant viewer cannot mutate a playlist through the command boundary'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000253', true);
select throws_ok(
  $$select * from public.mutate_playlist_draft_v1(
    '50000000-0000-4000-8000-000000000251', 2, 'update_details',
    '{"name":"Cross tenant wijziging"}'::jsonb
  )$$,
  '42501',
  'actor cannot mutate this playlist',
  'another tenant cannot mutate the playlist'
);

reset role;
select ok(not has_function_privilege('anon', 'public.mutate_playlist_draft_v1(uuid,bigint,text,jsonb)', 'EXECUTE'), 'anonymous cannot execute draft mutations');
select ok(not has_function_privilege('anon', 'public.publish_playlist_to_targets_v3(uuid,bigint,uuid[],text,uuid)', 'EXECUTE'), 'anonymous cannot execute revision-aware publish');
select is((select count(*) from public.audit_events where action like 'playlist.draft.%' and tenant_id = '10000000-0000-4000-8000-000000000251'), 3::bigint, 'only applied draft mutations create audit events');

select * from finish();
rollback;
