begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  (
    '00000000-0000-4000-8000-000000000511',
    'authenticated', 'authenticated', 'item-editor@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000512',
    'authenticated', 'authenticated', 'item-outsider@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  );

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000511', 'Item editor'),
  ('00000000-0000-4000-8000-000000000512', 'Item outsider');

insert into public.tenants (id, name, slug)
values
  (
    '10000000-0000-4000-8000-000000000511',
    'Item tenant',
    'item-tenant'
  ),
  (
    '10000000-0000-4000-8000-000000000512',
    'Outside tenant',
    'outside-item-tenant'
  );

insert into public.tenant_settings (tenant_id)
values
  ('10000000-0000-4000-8000-000000000511'),
  ('10000000-0000-4000-8000-000000000512');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  (
    '10000000-0000-4000-8000-000000000511',
    '00000000-0000-4000-8000-000000000511',
    'tenant_editor'
  ),
  (
    '10000000-0000-4000-8000-000000000512',
    '00000000-0000-4000-8000-000000000512',
    'tenant_editor'
  );

insert into public.media_assets (
  id, tenant_id, created_by, kind, title, original_file_name, mime_type,
  status, storage_path, file_size_bytes, checksum_sha256, width, height,
  duration_seconds, processed_at
)
values
  (
    '20000000-0000-4000-8000-000000000511',
    '10000000-0000-4000-8000-000000000511',
    '00000000-0000-4000-8000-000000000511',
    'image', 'Sponsor A', 'sponsor-a.webp', 'image/webp', 'ready',
    'tenants/10000000-0000-4000-8000-000000000511/assets/20000000-0000-4000-8000-000000000511/original/sponsor-a.webp',
    1024, repeat('a', 64), 1920, 1080, null, now()
  ),
  (
    '20000000-0000-4000-8000-000000000512',
    '10000000-0000-4000-8000-000000000511',
    '00000000-0000-4000-8000-000000000511',
    'image', 'Sponsor B', 'sponsor-b.webp', 'image/webp', 'ready',
    'tenants/10000000-0000-4000-8000-000000000511/assets/20000000-0000-4000-8000-000000000512/original/sponsor-b.webp',
    2048, repeat('b', 64), 1920, 1080, null, now()
  );

insert into public.playlists (
  id, tenant_id, name, created_by, updated_by
)
values (
  '50000000-0000-4000-8000-000000000511',
  '10000000-0000-4000-8000-000000000511',
  'Sponsorloop',
  '00000000-0000-4000-8000-000000000511',
  '00000000-0000-4000-8000-000000000511'
);

insert into public.playlist_items (
  id, tenant_id, playlist_id, media_asset_id, sort_order, position_key,
  duration_seconds, fit_mode, muted, display_title, transition,
  crop_focus_x, crop_focus_y, volume_percent, enabled, created_by
)
values (
  '51000000-0000-4000-8000-000000000511',
  '10000000-0000-4000-8000-000000000511',
  '50000000-0000-4000-8000-000000000511',
  '20000000-0000-4000-8000-000000000511',
  0, 1024, 12, 'cover', true, 'Sponsorplaatsing', 'crossfade',
  0.25, 0.75, 80, true,
  '00000000-0000-4000-8000-000000000511'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000511',
  true
);

create temporary table duplicate_result as
select public.mutate_playlist_draft_v2(
  '50000000-0000-4000-8000-000000000511',
  0,
  'duplicate_item',
  '{"itemId":"51000000-0000-4000-8000-000000000511"}'::jsonb,
  '90000000-0000-4000-8000-000000000511'
) as outcome;

select is(
  (select outcome ->> 'outcome' from duplicate_result),
  'applied',
  'an editor can duplicate one placement atomically'
);
select is(
  (
    select revision from public.playlists
    where id = '50000000-0000-4000-8000-000000000511'
  ),
  1::bigint,
  'duplicate advances the shared playlist revision once'
);
select is(
  (
    select count(*) from public.playlist_items
    where playlist_id = '50000000-0000-4000-8000-000000000511'
  ),
  2::bigint,
  'duplicate creates exactly one additional item'
);
select is(
  (
    select format(
      '%s|%s|%s|%s|%s',
      display_title,
      duration_seconds,
      fit_mode,
      transition,
      volume_percent
    )
    from public.playlist_items
    where id = (
      select (outcome ->> 'itemId')::uuid from duplicate_result
    )
  ),
  'Sponsorplaatsing|12|cover|crossfade|80',
  'duplicate preserves item-owned presentation settings'
);
select is(
  (
    public.mutate_playlist_draft_v2(
      '50000000-0000-4000-8000-000000000511',
      0,
      'duplicate_item',
      '{"itemId":"51000000-0000-4000-8000-000000000511"}'::jsonb,
      '90000000-0000-4000-8000-000000000511'
    ) ->> 'actualRevision'
  ),
  '1',
  'an identical duplicate command replays its stored outcome'
);

create temporary table replace_result as
select public.mutate_playlist_draft_v2(
  '50000000-0000-4000-8000-000000000511',
  1,
  'replace_item',
  jsonb_build_object(
    'itemId', (select outcome ->> 'itemId' from duplicate_result),
    'mediaAssetId', '20000000-0000-4000-8000-000000000512'
  ),
  '90000000-0000-4000-8000-000000000512'
) as outcome;

select is(
  (select outcome ->> 'actualRevision' from replace_result),
  '2',
  'replacement is revision-guarded and atomic'
);
select is(
  (
    select media_asset_id
    from public.playlist_items
    where id = (select (outcome ->> 'itemId')::uuid from duplicate_result)
  ),
  '20000000-0000-4000-8000-000000000512'::uuid,
  'replacement changes only the selected placement media reference'
);
select is(
  (
    select media_asset_id
    from public.playlist_items
    where id = '51000000-0000-4000-8000-000000000511'
  ),
  '20000000-0000-4000-8000-000000000511'::uuid,
  'replacement leaves the source placement and reusable media untouched'
);

select * from finish();
rollback;
