-- S100 follow-up: persist the official client-scoped Sportlink club logo as a
-- tenant-owned Player asset. A tenant Studio logo remains the preferred brand
-- asset; this imported logo is the safe Sportlink fallback.

create or replace function public.complete_sportlink_sync_v2(
  p_run_id uuid,
  p_worker_id text,
  p_club jsonb default '{}'::jsonb,
  p_club_logo jsonb default '{}'::jsonb,
  p_teams jsonb default '[]'::jsonb,
  p_matches jsonb default '[]'::jsonb,
  p_activities jsonb default '[]'::jsonb,
  p_standings jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sync_run public.sportlink_sync_runs%rowtype;
  media_asset_id uuid;
  media_checksum text;
  media_bytes bigint;
  media_width integer;
  media_height integer;
  media_title text;
  expected_storage_path text;
  sync_result jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  select *
  into sync_run
  from public.sportlink_sync_runs
  where id = p_run_id
  for update;

  if sync_run.id is null then
    raise exception 'sportlink_sync_run_not_found' using errcode = 'P0002';
  end if;
  if sync_run.status <> 'running'
    or sync_run.worker_id is distinct from nullif(btrim(p_worker_id), '')
  then
    raise exception 'sportlink_sync_lease_not_owned' using errcode = '42501';
  end if;

  if coalesce(p_club_logo, '{}'::jsonb) <> '{}'::jsonb then
    if sync_run.dataset_group <> 'club_profile'
      or jsonb_typeof(p_club_logo) <> 'object'
      or jsonb_typeof(p_club) <> 'object'
      or length(coalesce(p_club ->> 'externalId', '')) not between 1 and 512
      or length(btrim(coalesce(p_club ->> 'name', ''))) not between 1 and 200
      or coalesce(p_club_logo ->> 'assetId', '') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(p_club_logo ->> 'checksumSha256', '') !~ '^[a-f0-9]{64}$'
      or p_club_logo ->> 'mimeType' is distinct from 'image/webp'
      or p_club_logo ->> 'role' is distinct from 'club_logo'
      or coalesce(p_club_logo ->> 'fileSizeBytes', '') !~ '^[0-9]{1,8}$'
      or coalesce(p_club_logo ->> 'width', '') !~ '^[0-9]{1,4}$'
      or coalesce(p_club_logo ->> 'height', '') !~ '^[0-9]{1,4}$'
    then
      raise exception 'invalid Sportlink club logo payload'
        using errcode = '22023';
    end if;

    media_asset_id := (p_club_logo ->> 'assetId')::uuid;
    media_checksum := p_club_logo ->> 'checksumSha256';
    media_bytes := (p_club_logo ->> 'fileSizeBytes')::bigint;
    media_width := (p_club_logo ->> 'width')::integer;
    media_height := (p_club_logo ->> 'height')::integer;
    media_title := left(coalesce(
      nullif(btrim(p_club_logo ->> 'title'), ''),
      left(btrim(p_club ->> 'name'), 180) || ' clublogo'
    ), 200);
    expected_storage_path :=
      'tenants/' || sync_run.tenant_id::text ||
      '/assets/' || media_asset_id::text ||
      '/sportlink-club-logo.webp';

    if p_club_logo ->> 'storagePath' is distinct from expected_storage_path
      or media_bytes <= 0 or media_bytes > 2000000
      or media_width <= 0 or media_width > 512
      or media_height <= 0 or media_height > 512
    then
      raise exception 'Sportlink club logo metadata is invalid'
        using errcode = '23514';
    end if;

    insert into public.media_assets(
      id, tenant_id, created_by, kind, title, original_file_name,
      mime_type, status, storage_bucket, storage_path, file_size_bytes,
      checksum_sha256, width, height, processed_at
    ) values (
      media_asset_id, sync_run.tenant_id, null,
      'image'::public.media_asset_kind, media_title,
      'sportlink-club-logo.webp', 'image/webp',
      'ready'::public.media_asset_status, 'tenant-media',
      expected_storage_path, media_bytes, media_checksum,
      media_width, media_height, now()
    )
    on conflict (id) do nothing;

    if not exists (
      select 1
      from public.media_assets asset
      where asset.id = media_asset_id
        and asset.tenant_id = sync_run.tenant_id
        and asset.storage_path = expected_storage_path
        and asset.checksum_sha256 = media_checksum
        and asset.file_size_bytes = media_bytes
        and asset.status = 'ready'::public.media_asset_status
    ) then
      raise exception 'Sportlink club logo identity collision'
        using errcode = '23514';
    end if;

    insert into public.media_variants(
      tenant_id, asset_id, variant_type, storage_bucket, storage_path,
      mime_type, file_size_bytes, checksum_sha256, width, height
    ) values (
      sync_run.tenant_id, media_asset_id,
      'original'::public.media_variant_type, 'tenant-media',
      expected_storage_path, 'image/webp', media_bytes, media_checksum,
      media_width, media_height
    )
    on conflict (tenant_id, asset_id, variant_type) do nothing;

    if not exists (
      select 1
      from public.media_variants variant
      where variant.tenant_id = sync_run.tenant_id
        and variant.asset_id = media_asset_id
        and variant.variant_type = 'original'::public.media_variant_type
        and variant.storage_bucket = 'tenant-media'
        and variant.storage_path = expected_storage_path
        and variant.mime_type = 'image/webp'
        and variant.file_size_bytes = media_bytes
        and variant.checksum_sha256 = media_checksum
        and variant.width = media_width
        and variant.height = media_height
    ) then
      raise exception 'Sportlink club logo variant identity collision'
        using errcode = '23514';
    end if;

    -- Register the logo before record_sportlink_sync_v1 advances the source
    -- revision, so the synchronously queued snapshot sees the new asset.
    insert into public.sports_clubs(
      tenant_id,
      source_connection_id,
      external_id,
      name,
      logo_media_asset_id,
      last_synced_at,
      active
    ) values (
      sync_run.tenant_id,
      sync_run.connection_id,
      p_club ->> 'externalId',
      btrim(p_club ->> 'name'),
      media_asset_id,
      now(),
      true
    )
    on conflict (tenant_id, source_connection_id, external_id) do update
    set logo_media_asset_id = excluded.logo_media_asset_id,
        last_synced_at = now(),
        active = true;
  end if;

  sync_result := public.complete_sportlink_sync_v1(
    p_run_id,
    p_worker_id,
    coalesce(p_club, '{}'::jsonb),
    coalesce(p_teams, '[]'::jsonb),
    coalesce(p_matches, '[]'::jsonb),
    coalesce(p_activities, '[]'::jsonb),
    coalesce(p_standings, '[]'::jsonb)
  );

  return sync_result;
end;
$$;

revoke all on function public.complete_sportlink_sync_v2(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.complete_sportlink_sync_v2(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) to service_role;

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_sportlink_club_logo_v1;

create or replace function private.build_dynamic_snapshot_data(
  p_slide public.dynamic_slides
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  club_logo_media_asset_id uuid;
begin
  result :=
    private.build_dynamic_snapshot_data_before_sportlink_club_logo_v1(p_slide);

  if p_slide.slide_type not like 'sport\_%' escape '\'
    or nullif(result #>> '{brand,logoMediaAssetId}', '') is not null
  then
    return result;
  end if;

  select club.logo_media_asset_id
  into club_logo_media_asset_id
  from public.sports_clubs club
  join public.sportlink_connections connection
    on connection.id = club.source_connection_id
   and connection.tenant_id = club.tenant_id
  where club.tenant_id = p_slide.tenant_id
    and connection.data_source_id = p_slide.data_source_id
    and club.active
    and club.logo_media_asset_id is not null
  order by club.last_synced_at desc, club.id
  limit 1;

  if club_logo_media_asset_id is null then
    return result;
  end if;

  return coalesce(result, '{}'::jsonb) || jsonb_build_object(
    'brand',
    coalesce(result -> 'brand', '{}'::jsonb) || jsonb_build_object(
      'logoMediaAssetId', club_logo_media_asset_id
    )
  );
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated;
revoke all on function private.build_dynamic_snapshot_data_before_sportlink_club_logo_v1(
  public.dynamic_slides
) from public, anon, authenticated;
