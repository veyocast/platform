begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  (
    '00000000-0000-4000-8000-000000000271',
    'authenticated', 'authenticated', 'duplicate-editor@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000272',
    'authenticated', 'authenticated', 'duplicate-outsider@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  );

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000271', 'Duplicate editor'),
  ('00000000-0000-4000-8000-000000000272', 'Duplicate outsider');

insert into public.tenants (id, name, slug)
values
  ('10000000-0000-4000-8000-000000000271', 'Duplicate tenant', 'duplicate-tenant'),
  ('10000000-0000-4000-8000-000000000272', 'Other duplicate tenant', 'other-duplicate-tenant');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  (
    '10000000-0000-4000-8000-000000000271',
    '00000000-0000-4000-8000-000000000271',
    'tenant_editor'
  ),
  (
    '10000000-0000-4000-8000-000000000272',
    '00000000-0000-4000-8000-000000000272',
    'tenant_editor'
  );

insert into public.media_assets (
  id, tenant_id, created_by, kind, title, original_file_name, mime_type,
  status, storage_path, file_size_bytes, checksum_sha256, width, height, processed_at
)
values (
  '20000000-0000-4000-8000-000000000271',
  '10000000-0000-4000-8000-000000000271',
  '00000000-0000-4000-8000-000000000271',
  'image', 'Dupliceerbaar beeld', 'duplicate.webp', 'image/webp', 'ready',
  'tenants/10000000-0000-4000-8000-000000000271/assets/20000000-0000-4000-8000-000000000271/original/duplicate.webp',
  2048, repeat('d', 64), 1920, 1080, now()
);

insert into public.playlists (
  id, tenant_id, name, description, status, created_by, updated_by, revision
)
values (
  '50000000-0000-4000-8000-000000000271',
  '10000000-0000-4000-8000-000000000271',
  'Bronplaylist',
  'Beschrijving blijft behouden',
  'draft',
  '00000000-0000-4000-8000-000000000271',
  '00000000-0000-4000-8000-000000000271',
  4
);

insert into public.playlist_items (
  id, tenant_id, playlist_id, media_asset_id, sort_order,
  duration_seconds, fit_mode, muted, created_by
)
values (
  '51000000-0000-4000-8000-000000000271',
  '10000000-0000-4000-8000-000000000271',
  '50000000-0000-4000-8000-000000000271',
  '20000000-0000-4000-8000-000000000271',
  0, 17, 'cover', false,
  '00000000-0000-4000-8000-000000000271'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000271',
  true
);

create temporary table duplicated_playlist as
select public.duplicate_playlist_draft_v1(
  '50000000-0000-4000-8000-000000000271',
  'Nieuwe kopie'
) as id;

select is(
  (select name from public.playlists where id = (select id from duplicated_playlist)),
  'Nieuwe kopie',
  'writer can duplicate a playlist under a chosen name'
);
select is(
  (select status::text from public.playlists where id = (select id from duplicated_playlist)),
  'draft',
  'duplicate always starts as a draft'
);
select is(
  (select revision from public.playlists where id = (select id from duplicated_playlist)),
  0::bigint,
  'duplicate starts with a fresh revision'
);
select is(
  (select description from public.playlists where id = (select id from duplicated_playlist)),
  'Beschrijving blijft behouden',
  'duplicate keeps the useful source description'
);
select is(
  (
    select format('%s|%s|%s', duration_seconds, fit_mode, muted)
    from public.playlist_items
    where playlist_id = (select id from duplicated_playlist)
  ),
  '17|cover|f',
  'duplicate copies draft item settings and order'
);
select is(
  (
    select count(*)
    from public.playlist_releases
    where playlist_id = (select id from duplicated_playlist)
  ),
  0::bigint,
  'duplicate never inherits immutable release history'
);
select is(
  (
    select count(*)
    from public.audit_events
    where target_id = (select id from duplicated_playlist)
      and action = 'playlist.draft.duplicate'
  ),
  1::bigint,
  'successful duplication is audited'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000272',
  true
);

select throws_ok(
  $$select public.duplicate_playlist_draft_v1(
    '50000000-0000-4000-8000-000000000271',
    'Onbevoegde kopie'
  )$$,
  '42501',
  'actor cannot duplicate this playlist',
  'another tenant cannot duplicate the source playlist'
);

reset role;
select ok(
  not has_function_privilege(
    'anon',
    'public.duplicate_playlist_draft_v1(uuid,text)',
    'EXECUTE'
  ),
  'anonymous users cannot duplicate playlists'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.duplicate_playlist_draft_v1(uuid,text)',
    'EXECUTE'
  ),
  'authenticated users can reach the permission-checked command boundary'
);

select * from finish();
rollback;
