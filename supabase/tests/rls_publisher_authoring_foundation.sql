begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(25);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  (
    '00000000-0000-4000-8000-000000000451',
    'authenticated', 'authenticated', 'publisher-editor@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000452',
    'authenticated', 'authenticated', 'publisher-viewer@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000453',
    'authenticated', 'authenticated', 'publisher-other@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  );

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000451', 'Publisher editor'),
  ('00000000-0000-4000-8000-000000000452', 'Publisher viewer'),
  ('00000000-0000-4000-8000-000000000453', 'Publisher other');

insert into public.tenants (id, name, slug)
values
  ('10000000-0000-4000-8000-000000000451', 'Publisher tenant', 'publisher-tenant'),
  ('10000000-0000-4000-8000-000000000452', 'Other publisher tenant', 'other-publisher-tenant');

insert into public.tenant_settings (
  tenant_id, timezone_name, default_transition, default_background_color
)
values (
  '10000000-0000-4000-8000-000000000451',
  'Europe/Amsterdam',
  'crossfade',
  '#0A0A0A'
);

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  (
    '10000000-0000-4000-8000-000000000451',
    '00000000-0000-4000-8000-000000000451',
    'tenant_editor'
  ),
  (
    '10000000-0000-4000-8000-000000000451',
    '00000000-0000-4000-8000-000000000452',
    'tenant_viewer'
  ),
  (
    '10000000-0000-4000-8000-000000000452',
    '00000000-0000-4000-8000-000000000453',
    'tenant_editor'
  );

insert into public.media_assets (
  id, tenant_id, created_by, kind, title, original_file_name, mime_type,
  status, storage_path, file_size_bytes, checksum_sha256, width, height,
  duration_seconds, processed_at
)
values
  (
    '20000000-0000-4000-8000-000000000451',
    '10000000-0000-4000-8000-000000000451',
    '00000000-0000-4000-8000-000000000451',
    'video', 'Publisher video', 'publisher.mp4', 'video/mp4', 'ready',
    'tenants/10000000-0000-4000-8000-000000000451/assets/20000000-0000-4000-8000-000000000451/original/publisher.mp4',
    4096, repeat('a', 64), 1920, 1080, 30, now()
  ),
  (
    '20000000-0000-4000-8000-000000000452',
    '10000000-0000-4000-8000-000000000452',
    '00000000-0000-4000-8000-000000000453',
    'image', 'Other publisher image', 'other.webp', 'image/webp', 'ready',
    'tenants/10000000-0000-4000-8000-000000000452/assets/20000000-0000-4000-8000-000000000452/original/other.webp',
    2048, repeat('b', 64), 1920, 1080, null, now()
  );

insert into public.playlists (
  id, tenant_id, name, created_by, updated_by,
  default_transition, default_background_color
)
values
  (
    '50000000-0000-4000-8000-000000000451',
    '10000000-0000-4000-8000-000000000451',
    'Publisher playlist',
    '00000000-0000-4000-8000-000000000451',
    '00000000-0000-4000-8000-000000000451',
    'crossfade',
    '#0A0A0A'
  ),
  (
    '50000000-0000-4000-8000-000000000452',
    '10000000-0000-4000-8000-000000000452',
    'Other publisher playlist',
    '00000000-0000-4000-8000-000000000453',
    '00000000-0000-4000-8000-000000000453',
    'cut',
    null
  );

select is(
  (
    select media_storage_limit_bytes
    from public.tenants
    where id = '10000000-0000-4000-8000-000000000451'
  ),
  null::bigint,
  'a tenant without an explicit storage allowance truthfully has no limit'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000451',
  true
);

select lives_ok(
  $$insert into public.playlist_sections (
      id, tenant_id, playlist_id, name, position_key, created_by
    ) values (
      '51000000-0000-4000-8000-000000000451',
      '10000000-0000-4000-8000-000000000451',
      '50000000-0000-4000-8000-000000000451',
      'Sponsors',
      1024,
      '00000000-0000-4000-8000-000000000451'
    )$$,
  'an editor can create a stable ordered section in the own tenant'
);

select lives_ok(
  $$insert into public.playlist_items (
      id, tenant_id, playlist_id, section_id, media_asset_id, sort_order,
      duration_seconds, fit_mode, muted, display_title, transition,
      crop_focus_x, crop_focus_y, background_color, volume_percent,
      trim_start_seconds, trim_end_seconds, visible_from, visible_until,
      enabled, accessibility_name, created_by
    ) values (
      '52000000-0000-4000-8000-000000000451',
      '10000000-0000-4000-8000-000000000451',
      '50000000-0000-4000-8000-000000000451',
      '51000000-0000-4000-8000-000000000451',
      '20000000-0000-4000-8000-000000000451',
      0, 20, 'cover', false, 'Sponsorvideo', 'wipe',
      0.25, 0.75, '#151719', 65,
      2, 22, now(), now() + interval '2 days',
      true, 'Sponsorvideo met clubactie',
      '00000000-0000-4000-8000-000000000451'
    )$$,
  'item-owned presentation, trim and visibility fields can be persisted'
);

select is(
  (
    select position_key
    from public.playlist_items
    where id = '52000000-0000-4000-8000-000000000451'
  ),
  1024::numeric,
  'legacy inserts receive a stable item position key'
);
select is(
  (
    select format(
      '%s|%s|%s|%s',
      display_title,
      transition,
      volume_percent,
      enabled
    )
    from public.playlist_items
    where id = '52000000-0000-4000-8000-000000000451'
  ),
  'Sponsorvideo|wipe|65|t',
  'item settings remain item-owned and queryable'
);
select is(
  (
    select title
    from public.media_assets
    where id = '20000000-0000-4000-8000-000000000451'
  ),
  'Publisher video',
  'an item display title never renames the reusable media asset'
);

select lives_ok(
  $$insert into public.media_folders (
      id, tenant_id, name, created_by
    ) values (
      '30000000-0000-4000-8000-000000000451',
      '10000000-0000-4000-8000-000000000451',
      'Sponsors',
      '00000000-0000-4000-8000-000000000451'
    )$$,
  'editor can organise media in an own-tenant folder'
);
select lives_ok(
  $$update public.media_assets
    set folder_id = '30000000-0000-4000-8000-000000000451'
    where id = '20000000-0000-4000-8000-000000000451'$$,
  'editor can place media in an own-tenant folder'
);
select lives_ok(
  $$insert into public.media_tags (
      id, tenant_id, name, color, created_by
    ) values (
      '31000000-0000-4000-8000-000000000451',
      '10000000-0000-4000-8000-000000000451',
      'Sponsor',
      '#FF5C20',
      '00000000-0000-4000-8000-000000000451'
    );
    insert into public.media_asset_tags (
      tenant_id, media_asset_id, tag_id, created_by
    ) values (
      '10000000-0000-4000-8000-000000000451',
      '20000000-0000-4000-8000-000000000451',
      '31000000-0000-4000-8000-000000000451',
      '00000000-0000-4000-8000-000000000451'
    )$$,
  'editor can tag media within the tenant boundary'
);
select lives_ok(
  $$insert into public.media_asset_favorites (
      tenant_id, media_asset_id, user_id
    ) values (
      '10000000-0000-4000-8000-000000000451',
      '20000000-0000-4000-8000-000000000451',
      '00000000-0000-4000-8000-000000000451'
    )$$,
  'a member can favorite media for the own account'
);
select lives_ok(
  $$insert into public.publisher_saved_views (
      id, tenant_id, user_id, resource_type, name, filter_json, is_default
    ) values (
      '32000000-0000-4000-8000-000000000451',
      '10000000-0000-4000-8000-000000000451',
      '00000000-0000-4000-8000-000000000451',
      'media',
      'Mijn sponsors',
      '{"tag":"Sponsor"}'::jsonb,
      true
    )$$,
  'a member can save a personal resource view'
);
select lives_ok(
  $$insert into public.tenant_playlist_templates (
      id, tenant_id, source_playlist_id, name, snapshot_json, snapshot_hash,
      created_by, updated_by
    ) values (
      '33000000-0000-4000-8000-000000000451',
      '10000000-0000-4000-8000-000000000451',
      '50000000-0000-4000-8000-000000000451',
      'Sponsorblok',
      '{"schemaVersion":1,"items":[]}'::jsonb,
      repeat('c', 64),
      '00000000-0000-4000-8000-000000000451',
      '00000000-0000-4000-8000-000000000451'
    )$$,
  'an editor can store a tenant-scoped reusable template'
);
select is(
  (select count(*) from public.media_asset_tags),
  1::bigint,
  'the tenant can read its media tag assignments'
);
select is(
  (
    select timezone_name
    from public.tenant_settings
    where tenant_id = '10000000-0000-4000-8000-000000000451'
  ),
  'Europe/Amsterdam',
  'tenant authoring settings expose an explicit timezone'
);

select throws_ok(
  $$insert into public.playlist_items (
      tenant_id, playlist_id, media_asset_id, sort_order,
      duration_seconds, fit_mode, muted, trim_start_seconds, trim_end_seconds
    ) values (
      '10000000-0000-4000-8000-000000000451',
      '50000000-0000-4000-8000-000000000451',
      '20000000-0000-4000-8000-000000000451',
      1, 10, 'contain', true, 20, 10
    )$$,
  '23514',
  'new row for relation "playlist_items" violates check constraint "playlist_items_trim_window_check"',
  'invalid trim windows are rejected by the database'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000452',
  true
);

select is(
  (select count(*) from public.playlist_sections),
  1::bigint,
  'a viewer can read authoring structure for its tenant'
);
select throws_ok(
  $$insert into public.media_tags (tenant_id, name)
    values (
      '10000000-0000-4000-8000-000000000451',
      'Niet toegestaan'
    )$$,
  '42501',
  'new row violates row-level security policy for table "media_tags"',
  'a viewer cannot mutate shared media organisation'
);
select is(
  (select count(*) from public.media_asset_favorites),
  0::bigint,
  'favorites remain private to their owner'
);
select is(
  (select count(*) from public.publisher_saved_views),
  0::bigint,
  'saved views remain private to their owner'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000453',
  true
);

select is(
  (select count(*) from public.playlist_sections),
  0::bigint,
  'another tenant cannot read playlist sections'
);
select is(
  (select count(*) from public.media_tags),
  0::bigint,
  'another tenant cannot read media tags'
);
select is(
  (select count(*) from public.tenant_playlist_templates),
  0::bigint,
  'another tenant cannot read tenant templates'
);
select throws_ok(
  $$insert into public.media_asset_tags (
      tenant_id, media_asset_id, tag_id
    ) values (
      '10000000-0000-4000-8000-000000000452',
      '20000000-0000-4000-8000-000000000452',
      '31000000-0000-4000-8000-000000000451'
    )$$,
  '23503',
  'insert or update on table "media_asset_tags" violates foreign key constraint "media_asset_tags_tenant_id_tag_id_fkey"',
  'composite tenant foreign keys reject a cross-tenant tag link'
);

reset role;
set local role anon;

select throws_ok(
  $$select count(*) from public.publisher_saved_views$$,
  '42501',
  'permission denied for table publisher_saved_views',
  'anonymous callers cannot inspect personal saved views'
);
select throws_ok(
  $$select count(*) from public.media_asset_favorites$$,
  '42501',
  'permission denied for table media_asset_favorites',
  'anonymous callers cannot inspect favorites'
);

select * from finish();
rollback;
