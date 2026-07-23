begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(34);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  (
    '00000000-0000-4000-8000-000000000471',
    'authenticated', 'authenticated', 'publisher-command-editor@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000472',
    'authenticated', 'authenticated', 'publisher-command-viewer@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000473',
    'authenticated', 'authenticated', 'publisher-command-other@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  );

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000471', 'Publisher command editor'),
  ('00000000-0000-4000-8000-000000000472', 'Publisher command viewer'),
  ('00000000-0000-4000-8000-000000000473', 'Publisher command other');

insert into public.tenants (id, name, slug)
values
  ('10000000-0000-4000-8000-000000000471', 'Publisher command tenant', 'publisher-command-tenant'),
  ('10000000-0000-4000-8000-000000000472', 'Other command tenant', 'other-command-tenant');

insert into public.tenant_settings (tenant_id)
values
  ('10000000-0000-4000-8000-000000000471'),
  ('10000000-0000-4000-8000-000000000472');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  (
    '10000000-0000-4000-8000-000000000471',
    '00000000-0000-4000-8000-000000000471',
    'tenant_editor'
  ),
  (
    '10000000-0000-4000-8000-000000000471',
    '00000000-0000-4000-8000-000000000472',
    'tenant_viewer'
  ),
  (
    '10000000-0000-4000-8000-000000000472',
    '00000000-0000-4000-8000-000000000473',
    'tenant_editor'
  );

insert into public.media_assets (
  id, tenant_id, created_by, kind, title, original_file_name, mime_type,
  status, storage_path, file_size_bytes, checksum_sha256, width, height,
  duration_seconds, processed_at
)
values
  (
    '20000000-0000-4000-8000-000000000471',
    '10000000-0000-4000-8000-000000000471',
    '00000000-0000-4000-8000-000000000471',
    'video', 'Herbruikbare video', 'command.mp4', 'video/mp4', 'ready',
    'tenants/10000000-0000-4000-8000-000000000471/assets/20000000-0000-4000-8000-000000000471/original/command.mp4',
    4096, repeat('a', 64), 1920, 1080, 30, now()
  ),
  (
    '20000000-0000-4000-8000-000000000472',
    '10000000-0000-4000-8000-000000000471',
    '00000000-0000-4000-8000-000000000471',
    'image', 'Tweede asset', 'command.webp', 'image/webp', 'ready',
    'tenants/10000000-0000-4000-8000-000000000471/assets/20000000-0000-4000-8000-000000000472/original/command.webp',
    2048, repeat('b', 64), 1920, 1080, null, now()
  );

insert into public.playlists (
  id, tenant_id, name, description, created_by, updated_by
)
values (
  '50000000-0000-4000-8000-000000000471',
  '10000000-0000-4000-8000-000000000471',
  'Publisher command playlist',
  'Veilige commandbasis',
  '00000000-0000-4000-8000-000000000471',
  '00000000-0000-4000-8000-000000000471'
);

insert into public.playlist_items (
  id, tenant_id, playlist_id, media_asset_id, sort_order, position_key,
  duration_seconds, fit_mode, muted, created_by
)
values (
  '51000000-0000-4000-8000-000000000471',
  '10000000-0000-4000-8000-000000000471',
  '50000000-0000-4000-8000-000000000471',
  '20000000-0000-4000-8000-000000000471',
  0, 1024, 30, 'contain', true,
  '00000000-0000-4000-8000-000000000471'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000471',
  true
);

create temporary table item_mutation as
select public.mutate_playlist_draft_v2(
  '50000000-0000-4000-8000-000000000471',
  0,
  'update_item_presentation',
  '{
    "itemId":"51000000-0000-4000-8000-000000000471",
    "durationSeconds":25,
    "fitMode":"cover",
    "muted":false,
    "displayTitle":"Alleen deze plaatsing",
    "transition":"crossfade",
    "cropFocusX":0.25,
    "cropFocusY":0.75,
    "backgroundColor":"#151719",
    "volumePercent":65,
    "trimStartSeconds":2,
    "trimEndSeconds":27,
    "visibleFrom":"2026-08-01T10:00:00Z",
    "visibleUntil":"2026-08-02T10:00:00Z",
    "enabled":true,
    "accessibilityName":"Clubvideo"
  }'::jsonb,
  '90000000-0000-4000-8000-000000000471'
) as outcome;

select is(
  (select outcome ->> 'outcome' from item_mutation),
  'applied',
  'v2 item presentation command applies at the expected revision'
);
select is(
  (
    select format(
      '%s|%s|%s|%s|%s',
      display_title,
      transition,
      volume_percent,
      trim_start_seconds,
      trim_end_seconds
    )
    from public.playlist_items
    where id = '51000000-0000-4000-8000-000000000471'
  ),
  'Alleen deze plaatsing|crossfade|65|2.000|27.000',
  'v2 persists item-owned display, transition, volume and trim'
);
select is(
  (
    select title from public.media_assets
    where id = '20000000-0000-4000-8000-000000000471'
  ),
  'Herbruikbare video',
  'v2 never renames the reusable media asset'
);
select is(
  (
    select revision from public.playlists
    where id = '50000000-0000-4000-8000-000000000471'
  ),
  1::bigint,
  'v2 mutation advances the shared draft revision once'
);
select is(
  (
    public.mutate_playlist_draft_v2(
      '50000000-0000-4000-8000-000000000471',
      0,
      'update_item_presentation',
      '{
        "itemId":"51000000-0000-4000-8000-000000000471",
        "durationSeconds":25,
        "fitMode":"cover",
        "muted":false,
        "displayTitle":"Alleen deze plaatsing",
        "transition":"crossfade",
        "cropFocusX":0.25,
        "cropFocusY":0.75,
        "backgroundColor":"#151719",
        "volumePercent":65,
        "trimStartSeconds":2,
        "trimEndSeconds":27,
        "visibleFrom":"2026-08-01T10:00:00Z",
        "visibleUntil":"2026-08-02T10:00:00Z",
        "enabled":true,
        "accessibilityName":"Clubvideo"
      }'::jsonb,
      '90000000-0000-4000-8000-000000000471'
    ) ->> 'actualRevision'
  ),
  '1',
  'an identical idempotency replay returns the stored outcome'
);
select is(
  (
    select revision from public.playlists
    where id = '50000000-0000-4000-8000-000000000471'
  ),
  1::bigint,
  'an idempotency replay does not apply the mutation twice'
);
select throws_ok(
  $$select public.mutate_playlist_draft_v2(
    '50000000-0000-4000-8000-000000000471',
    1,
    'update_playlist_defaults',
    '{"defaultImageDurationSeconds":10,"defaultTransition":"cut","defaultFitMode":"contain"}'::jsonb,
    '90000000-0000-4000-8000-000000000471'
  )$$,
  '23505',
  'idempotency key belongs to another publisher command',
  'an idempotency key cannot be reused for another command'
);
select is(
  (
    public.mutate_playlist_draft_v2(
      '50000000-0000-4000-8000-000000000471',
      0,
      'update_playlist_defaults',
      '{
        "defaultImageDurationSeconds":12,
        "defaultTransition":"wipe",
        "defaultFitMode":"cover",
        "defaultVideoMuted":true,
        "loopEnabled":true
      }'::jsonb,
      '90000000-0000-4000-8000-000000000472'
    ) ->> 'outcome'
  ),
  'conflict',
  'stale v2 mutations return a typed conflict'
);

create temporary table section_mutation as
select public.mutate_playlist_draft_v2(
  '50000000-0000-4000-8000-000000000471',
  1,
  'create_section',
  '{"name":"Sponsors","enabled":true,"defaultDurationSeconds":10,"defaultTransition":"cut"}'::jsonb,
  '90000000-0000-4000-8000-000000000473'
) as outcome;

select is(
  (select outcome ->> 'actualRevision' from section_mutation),
  '2',
  'section creation participates in playlist revision control'
);
select is(
  (
    select position_key from public.playlist_sections
    where id = ((select outcome ->> 'sectionId' from section_mutation))::uuid
  ),
  1024::numeric,
  'new sections receive stable spaced position keys'
);
select is(
  (
    public.mutate_playlist_draft_v2(
      '50000000-0000-4000-8000-000000000471',
      2,
      'assign_item_section',
      jsonb_build_object(
        'itemId', '51000000-0000-4000-8000-000000000471',
        'sectionId', (select outcome ->> 'sectionId' from section_mutation)
      ),
      '90000000-0000-4000-8000-000000000474'
    ) ->> 'actualRevision'
  ),
  '3',
  'item-to-section assignment is guarded by the shared revision'
);

create temporary table template_creation as
select public.create_tenant_playlist_template_v1(
  '50000000-0000-4000-8000-000000000471',
  'Sponsorblok',
  'Herbruikbaar sponsorblok',
  '90000000-0000-4000-8000-000000000475'
) as outcome;

select is(
  (select outcome ->> 'outcome' from template_creation),
  'created',
  'editor can snapshot a playlist as a tenant template'
);
select is(
  (
    select jsonb_array_length(snapshot_json -> 'items')
    from public.tenant_playlist_templates
    where id = ((select outcome ->> 'templateId' from template_creation))::uuid
  ),
  1,
  'tenant template stores the complete authoring item snapshot'
);

create temporary table template_instance as
select public.instantiate_tenant_playlist_template_v1(
  ((select outcome ->> 'templateId' from template_creation))::uuid,
  'Nieuw uit template',
  '90000000-0000-4000-8000-000000000476'
) as outcome;

select is(
  (select outcome ->> 'outcome' from template_instance),
  'created',
  'tenant template creates a fresh playlist concept'
);
select is(
  (
    select revision from public.playlists
    where id = ((select outcome ->> 'playlistId' from template_instance))::uuid
  ),
  0::bigint,
  'template-derived playlist starts at revision zero'
);
select is(
  (
    select display_title from public.playlist_items
    where playlist_id = ((select outcome ->> 'playlistId' from template_instance))::uuid
  ),
  'Alleen deze plaatsing',
  'template instantiation preserves item-owned presentation'
);
select is(
  (
    select count(*) from public.playlist_releases
    where playlist_id = ((select outcome ->> 'playlistId' from template_instance))::uuid
  ),
  0::bigint,
  'template instantiation never copies release history'
);

create temporary table folder_creation as
select public.mutate_media_organization_v1(
  '10000000-0000-4000-8000-000000000471',
  'create_folder',
  '{"name":"Sponsors"}'::jsonb,
  '90000000-0000-4000-8000-000000000477'
) as outcome;
select is(
  (select outcome ->> 'outcome' from folder_creation),
  'applied',
  'media folder creation uses the guarded command'
);
select is(
  (
    public.mutate_media_organization_v1(
      '10000000-0000-4000-8000-000000000471',
      'move_asset',
      jsonb_build_object(
        'assetId', '20000000-0000-4000-8000-000000000471',
        'folderId', (select outcome ->> 'targetId' from folder_creation)
      ),
      '90000000-0000-4000-8000-000000000478'
    ) ->> 'outcome'
  ),
  'applied',
  'asset can be moved to an own-tenant folder through the command'
);

create temporary table tag_creation as
select public.mutate_media_organization_v1(
  '10000000-0000-4000-8000-000000000471',
  'create_tag',
  '{"name":"Sponsor","color":"#FF5C20"}'::jsonb,
  '90000000-0000-4000-8000-000000000479'
) as outcome;
select is(
  (
    public.mutate_media_organization_v1(
      '10000000-0000-4000-8000-000000000471',
      'assign_tag',
      jsonb_build_object(
        'assetId', '20000000-0000-4000-8000-000000000471',
        'tagId', (select outcome ->> 'targetId' from tag_creation)
      ),
      '90000000-0000-4000-8000-000000000480'
    ) ->> 'outcome'
  ),
  'applied',
  'asset tags are assigned through a tenant-validated command'
);
select is(
  (
    public.mutate_media_organization_v1(
      '10000000-0000-4000-8000-000000000471',
      'set_favorite',
      '{"assetId":"20000000-0000-4000-8000-000000000471","favorite":true}'::jsonb,
      '90000000-0000-4000-8000-000000000481'
    ) ->> 'outcome'
  ),
  'applied',
  'favorites are set through a current-user command'
);
select is(
  (
    select count(*) from public.list_publisher_media_assets_v1(
      '10000000-0000-4000-8000-000000000471',
      50, 0, null, null, null,
      ((select outcome ->> 'targetId' from folder_creation))::uuid,
      false,
      ((select outcome ->> 'targetId' from tag_creation))::uuid,
      true,
      'newest'
    )
  ),
  1::bigint,
  'publisher media query composes folder, tag and favorite filters'
);
select is(
  (
    select total_count from public.list_publisher_media_assets_v1(
      '10000000-0000-4000-8000-000000000471',
      1, 0, null, null, null, null, false, null, false, 'newest'
    ) limit 1
  ),
  2::bigint,
  'publisher media query returns server-side total count before pagination'
);
select is(
  (
    select jsonb_array_length(tags)
    from public.list_publisher_media_assets_v1(
      '10000000-0000-4000-8000-000000000471',
      50, 0, 'Herbruikbare', null, null, null, false, null, false, 'name'
    )
  ),
  1,
  'publisher media rows include their tenant-scoped tags'
);
select is(
  (
    select count(*) from public.list_publisher_media_assets_v1(
      '10000000-0000-4000-8000-000000000471',
      50, 0, null, null, null, null, false, null, false, 'newest',
      now() - interval '1 day', now() + interval '1 day', 'all'
    )
  ),
  2::bigint,
  'publisher media queries apply an explicit half-open creation window'
);
select is(
  (
    select asset_id from public.list_publisher_media_assets_v1(
      '10000000-0000-4000-8000-000000000471',
      50, 0, null, null, null, null, false, null, false, 'newest',
      null, null, 'used'
    )
  ),
  '20000000-0000-4000-8000-000000000471'::uuid,
  'used media filtering is derived from server-side draft and release usage'
);
select is(
  (
    select format(
      '%s|%s|%s|%s',
      original_file_name,
      checksum_sha256,
      draft_usage_count,
      release_usage_count
    )
    from public.list_publisher_media_assets_v1(
      '10000000-0000-4000-8000-000000000471',
      50, 0, null, null, null, null, false, null, false, 'newest',
      null, null, 'unused'
    )
  ),
  'command.webp|' || repeat('b', 64) || '|0|0',
  'unused media rows retain inspector metadata and truthful usage counts'
);
select is(
  (
    select count(*) from public.publisher_command_receipts
    where tenant_id = '10000000-0000-4000-8000-000000000471'
  ),
  11::bigint,
  'server-authoritative command receipts cover applied and conflict outcomes'
);
select is(
  (
    select count(*) from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000000471'
      and action like 'publisher.%'
  ),
  11::bigint,
  'every command receipt points to a server-authored audit event'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000472',
  true
);
select is(
  (
    public.mutate_media_organization_v1(
      '10000000-0000-4000-8000-000000000471',
      'set_favorite',
      '{"assetId":"20000000-0000-4000-8000-000000000472","favorite":true}'::jsonb,
      '90000000-0000-4000-8000-000000000482'
    ) ->> 'outcome'
  ),
  'applied',
  'viewer can manage only personal favorites'
);
select throws_ok(
  $$select public.mutate_media_organization_v1(
    '10000000-0000-4000-8000-000000000471',
    'create_tag',
    '{"name":"Niet toegestaan"}'::jsonb,
    '90000000-0000-4000-8000-000000000483'
  )$$,
  '42501',
  'actor cannot organize media for this tenant',
  'viewer cannot mutate shared media organization'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000473',
  true
);
select throws_ok(
  $$select public.mutate_playlist_draft_v2(
    '50000000-0000-4000-8000-000000000471',
    3,
    'update_playlist_defaults',
    '{"defaultImageDurationSeconds":10,"defaultTransition":"cut","defaultFitMode":"contain"}'::jsonb,
    '90000000-0000-4000-8000-000000000484'
  )$$,
  '42501',
  'actor cannot mutate this playlist',
  'another tenant cannot mutate the playlist'
);
select throws_ok(
  $$select * from public.list_publisher_media_assets_v1(
    '10000000-0000-4000-8000-000000000471'
  )$$,
  '42501',
  'actor cannot list media for this tenant',
  'another tenant cannot query the media library'
);

reset role;
select ok(
  not has_function_privilege(
    'anon',
    'public.mutate_playlist_draft_v2(uuid,bigint,text,jsonb,uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute Publisher draft commands'
);

select * from finish();
rollback;
