-- Store Sportlink standing logos as immutable tenant assets. Provider URLs are
-- consumed only by the media worker and never reach the Player release.

create or replace function public.complete_sportlink_sync_v3(
  p_run_id uuid,
  p_worker_id text,
  p_club jsonb default '{}'::jsonb,
  p_club_logo jsonb default '{}'::jsonb,
  p_team_logos jsonb default '[]'::jsonb,
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
  logo jsonb;
  processed_standings jsonb := coalesce(p_standings, '[]'::jsonb);
  media_asset_id uuid;
  media_checksum text;
  media_bytes bigint;
  media_width integer;
  media_height integer;
  media_title text;
  source_url text;
  expected_storage_path text;
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
  if jsonb_typeof(processed_standings) <> 'array'
    or jsonb_typeof(coalesce(p_team_logos, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_team_logos, '[]'::jsonb)) > 100
  then
    raise exception 'invalid Sportlink standing logo collection'
      using errcode = '22023';
  end if;
  if coalesce(p_team_logos, '[]'::jsonb) <> '[]'::jsonb
    and sync_run.dataset_group <> 'competitions'
  then
    raise exception 'Sportlink team logos require a competitions sync'
      using errcode = '22023';
  end if;

  for logo in
    select value from jsonb_array_elements(coalesce(p_team_logos, '[]'::jsonb))
  loop
    if jsonb_typeof(logo) <> 'object'
      or coalesce(logo ->> 'assetId', '') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(logo ->> 'checksumSha256', '') !~ '^[a-f0-9]{64}$'
      or logo ->> 'mimeType' is distinct from 'image/webp'
      or logo ->> 'role' is distinct from 'team_logo'
      or coalesce(logo ->> 'fileSizeBytes', '') !~ '^[0-9]{1,8}$'
      or coalesce(logo ->> 'width', '') !~ '^[0-9]{1,4}$'
      or coalesce(logo ->> 'height', '') !~ '^[0-9]{1,4}$'
      or length(coalesce(logo ->> 'sourceUrl', '')) not between 8 and 2048
    then
      raise exception 'invalid Sportlink team logo payload'
        using errcode = '22023';
    end if;

    media_asset_id := (logo ->> 'assetId')::uuid;
    media_checksum := logo ->> 'checksumSha256';
    media_bytes := (logo ->> 'fileSizeBytes')::bigint;
    media_width := (logo ->> 'width')::integer;
    media_height := (logo ->> 'height')::integer;
    media_title := left(coalesce(
      nullif(btrim(logo ->> 'title'), ''),
      'Sportlink teamlogo'
    ), 200);
    source_url := logo ->> 'sourceUrl';
    expected_storage_path :=
      'tenants/' || sync_run.tenant_id::text ||
      '/assets/' || media_asset_id::text ||
      '/sportlink-team-logo.webp';

    if logo ->> 'storagePath' is distinct from expected_storage_path
      or media_bytes <= 0 or media_bytes > 2000000
      or media_width <= 0 or media_width > 512
      or media_height <= 0 or media_height > 512
    then
      raise exception 'Sportlink team logo metadata is invalid'
        using errcode = '23514';
    end if;

    insert into public.media_assets(
      id, tenant_id, created_by, kind, title, original_file_name,
      mime_type, status, storage_bucket, storage_path, file_size_bytes,
      checksum_sha256, width, height, processed_at
    ) values (
      media_asset_id, sync_run.tenant_id, null,
      'image'::public.media_asset_kind, media_title,
      'sportlink-team-logo.webp', 'image/webp',
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
      raise exception 'Sportlink team logo identity collision'
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
        and variant.storage_path = expected_storage_path
        and variant.checksum_sha256 = media_checksum
    ) then
      raise exception 'Sportlink team logo variant identity collision'
        using errcode = '23514';
    end if;

    select coalesce(jsonb_agg(
      standing || jsonb_build_object(
        'rows', coalesce((
          select jsonb_agg(
            row || case
              when row ->> 'logoUrl' = source_url
                then jsonb_build_object('logoMediaAssetId', media_asset_id)
              else '{}'::jsonb
            end
          )
          from jsonb_array_elements(
            case
              when jsonb_typeof(standing -> 'rows') = 'array'
                then standing -> 'rows'
              else '[]'::jsonb
            end
          ) row
        ), '[]'::jsonb)
      )
    ), '[]'::jsonb)
    into processed_standings
    from jsonb_array_elements(processed_standings) standing;
  end loop;

  -- Provider URLs remain a worker concern. Persist only canonical asset IDs.
  select coalesce(jsonb_agg(
    standing || jsonb_build_object(
      'rows', coalesce((
        select jsonb_agg(row - 'logoUrl')
        from jsonb_array_elements(
          case
            when jsonb_typeof(standing -> 'rows') = 'array'
              then standing -> 'rows'
            else '[]'::jsonb
          end
        ) row
      ), '[]'::jsonb)
    )
  ), '[]'::jsonb)
  into processed_standings
  from jsonb_array_elements(processed_standings) standing;

  return public.complete_sportlink_sync_v2(
    p_run_id,
    p_worker_id,
    coalesce(p_club, '{}'::jsonb),
    coalesce(p_club_logo, '{}'::jsonb),
    coalesce(p_teams, '[]'::jsonb),
    coalesce(p_matches, '[]'::jsonb),
    coalesce(p_activities, '[]'::jsonb),
    processed_standings
  );
end;
$$;

revoke all on function public.complete_sportlink_sync_v3(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.complete_sportlink_sync_v3(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) to service_role;

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_standing_team_logos_v1;

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
  items jsonb;
  selected_logo_media_asset_id text;
  tenant_club_logo_media_asset_id uuid;
begin
  result :=
    private.build_dynamic_snapshot_data_before_standing_team_logos_v1(p_slide);

  -- Studio remains authoritative. If no tenant override exists, reuse the
  -- latest official Sportlink club logo for every Editorial Arena slide,
  -- including RSS news and menus that have a different data source.
  if nullif(result #>> '{brand,logoMediaAssetId}', '') is null then
    select club.logo_media_asset_id
    into tenant_club_logo_media_asset_id
    from public.sports_clubs club
    where club.tenant_id = p_slide.tenant_id
      and club.active
      and club.logo_media_asset_id is not null
    order by club.last_synced_at desc, club.id
    limit 1;

    if tenant_club_logo_media_asset_id is not null then
      result := coalesce(result, '{}'::jsonb) || jsonb_build_object(
        'brand',
        coalesce(result -> 'brand', '{}'::jsonb) || jsonb_build_object(
          'logoMediaAssetId', tenant_club_logo_media_asset_id
        )
      );
    end if;
  end if;

  if p_slide.slide_type not in ('sport_standing', 'sport_period_standing')
    or jsonb_typeof(result #> '{sport,items}') <> 'array'
  then
    return result;
  end if;

  select coalesce(jsonb_agg(jsonb_strip_nulls(
    item || jsonb_build_object(
      'logoMediaAssetId', (
        select row ->> 'logoMediaAssetId'
        from public.sports_standings standing
        join public.sportlink_connections connection
          on connection.id = standing.source_connection_id
         and connection.tenant_id = standing.tenant_id
        cross join lateral jsonb_array_elements(
          coalesce(standing.rows_json, '[]'::jsonb)
        ) row
        where standing.tenant_id = p_slide.tenant_id
          and connection.data_source_id = p_slide.data_source_id
          and standing.active
          and row ->> 'externalId' = item ->> 'id'
          and nullif(row ->> 'logoMediaAssetId', '') is not null
          and (
            nullif(result #>> '{sport,season}', '') is null
            or standing.season_key = result #>> '{sport,season}'
          )
          and (
            nullif(result #>> '{sport,pool,externalId}', '') is null
            or standing.pool_external_id =
              result #>> '{sport,pool,externalId}'
          )
        order by standing.last_synced_at desc
        limit 1
      )
    )
  )), '[]'::jsonb)
  into items
  from jsonb_array_elements(result #> '{sport,items}') item;

  result := jsonb_set(result, '{sport,items}', items, true);

  if nullif(result #>> '{brand,logoMediaAssetId}', '') is null then
    select item ->> 'logoMediaAssetId'
    into selected_logo_media_asset_id
    from jsonb_array_elements(items) item
    where item ->> 'selected' = 'true'
      and nullif(item ->> 'logoMediaAssetId', '') is not null
    limit 1;

    if selected_logo_media_asset_id is not null then
      result := coalesce(result, '{}'::jsonb) || jsonb_build_object(
        'brand',
        coalesce(result -> 'brand', '{}'::jsonb) || jsonb_build_object(
          'logoMediaAssetId', selected_logo_media_asset_id
        )
      );
    end if;
  end if;

  return result;
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated;
revoke all on function private.build_dynamic_snapshot_data_before_standing_team_logos_v1(
  public.dynamic_slides
) from public, anon, authenticated;

-- Existing connections receive the asset-enriched data without waiting for a
-- weekly club-profile run. The normal claim/lease machinery still bounds work.
update public.sportlink_sync_policies
set next_sync_at = least(next_sync_at, now())
where enabled
  and dataset_group in ('club_profile', 'competitions');
