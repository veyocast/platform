begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(7);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-4000-8000-000000000961', 'authenticated', 'authenticated', 'template-editor@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000962', 'authenticated', 'authenticated', 'template-other@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000961', 'Template editor'),
  ('00000000-0000-4000-8000-000000000962', 'Template other');

insert into public.tenants (id, name, slug)
values
  ('10000000-0000-4000-8000-000000000961', 'Editable templates', 'editable-templates'),
  ('10000000-0000-4000-8000-000000000962', 'Other templates', 'other-templates');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000961', '00000000-0000-4000-8000-000000000961', 'tenant_editor'),
  ('10000000-0000-4000-8000-000000000962', '00000000-0000-4000-8000-000000000962', 'tenant_editor');

insert into public.media_assets (
  id, tenant_id, created_by, kind, title, original_file_name, mime_type,
  status, storage_path, file_size_bytes, checksum_sha256, width, height,
  processed_at
)
values (
  '20000000-0000-4000-8000-000000000961',
  '10000000-0000-4000-8000-000000000961',
  '00000000-0000-4000-8000-000000000961',
  'image',
  'Templatebeeld',
  'template.webp',
  'image/webp',
  'ready',
  'tenants/10000000-0000-4000-8000-000000000961/assets/20000000-0000-4000-8000-000000000961/original/template.webp',
  2048,
  repeat('9', 64),
  1920,
  1080,
  now()
);

insert into public.playlists (id, tenant_id, name, description, created_by, updated_by)
values (
  '50000000-0000-4000-8000-000000000961',
  '10000000-0000-4000-8000-000000000961',
  'Templatebron',
  'Eerste versie',
  '00000000-0000-4000-8000-000000000961',
  '00000000-0000-4000-8000-000000000961'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000961', true);

select ok(
  (public.create_tenant_playlist_template_v1(
    '50000000-0000-4000-8000-000000000961',
    'Clubavond',
    'Herbruikbaar concept',
    '90000000-0000-4000-8000-000000000961'
  ) ->> 'templateId')::uuid is not null,
  'an editor can create a safe playlist template snapshot'
);

select lives_ok(
  $$insert into public.playlist_items (
    tenant_id, playlist_id, media_asset_id, sort_order, duration_seconds,
    fit_mode, muted, display_title, created_by
  ) values (
    '10000000-0000-4000-8000-000000000961',
    '50000000-0000-4000-8000-000000000961',
    '20000000-0000-4000-8000-000000000961',
    0,
    12,
    'cover',
    true,
    'Welkom',
    '00000000-0000-4000-8000-000000000961'
  )$$,
  'the source concept remains independently editable in Playlist Studio'
);

select is(
  public.update_tenant_playlist_template_v1(
    (select id from public.tenant_playlist_templates where name = 'Clubavond'),
    0,
    '50000000-0000-4000-8000-000000000961',
    'Clubavond compleet',
    'Bijgewerkt vanuit het bronconcept',
    '90000000-0000-4000-8000-000000000962'
  ) ->> 'outcome',
  'updated',
  'template metadata and content can be refreshed atomically'
);

select is(
  (
    select jsonb_array_length(snapshot_json -> 'items')
    from public.tenant_playlist_templates
    where name = 'Clubavond compleet'
  ),
  1,
  'the refreshed template contains the current source items'
);

select is(
  (
    select revision
    from public.tenant_playlist_templates
    where name = 'Clubavond compleet'
  ),
  1::bigint,
  'template refresh advances the optimistic revision'
);

select is(
  public.update_tenant_playlist_template_v1(
    (select id from public.tenant_playlist_templates where name = 'Clubavond compleet'),
    0,
    '50000000-0000-4000-8000-000000000961',
    'Verouderd',
    null,
    '90000000-0000-4000-8000-000000000963'
  ) ->> 'outcome',
  'conflict',
  'a stale template editor cannot overwrite a newer snapshot'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000962', true);

select is(
  (
    select count(*)
    from public.tenant_playlist_templates
    where tenant_id = '10000000-0000-4000-8000-000000000961'
  ),
  0::bigint,
  'another tenant cannot read editable template snapshots'
);

select * from finish();
rollback;
