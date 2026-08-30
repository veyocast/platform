-- S133: accept the canonical content-addressed provider asset path. The S111
-- implementation used two backslashes in a standard-conforming SQL string,
-- which makes PostgreSQL look for a literal backslash before `webp` and
-- rejects every valid club or team logo payload. Once that validation passes,
-- S111 also collides its `cache_id` PL/pgSQL variable with the identically
-- named upsert column. Keep the column and variable names unambiguous.

create or replace function public.complete_sportlink_sync_v4(
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
  provider_cache_id uuid;
  version_id uuid;
  club_version_id uuid;
  processed_standings jsonb := coalesce(p_standings, '[]'::jsonb);
  result jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  select * into sync_run
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
    raise exception 'invalid provider asset collection' using errcode = '22023';
  end if;

  for logo in
    select value
    from jsonb_array_elements(
      case when coalesce(p_club_logo, '{}'::jsonb) = '{}'::jsonb
        then '[]'::jsonb else jsonb_build_array(p_club_logo) end
      || coalesce(p_team_logos, '[]'::jsonb)
    )
  loop
    if jsonb_typeof(logo) <> 'object'
      or coalesce(logo ->> 'assetId', '') !~ '^[0-9a-f-]{36}$'
      or coalesce(logo ->> 'checksumSha256', '') !~ '^[a-f0-9]{64}$'
      or logo ->> 'mimeType' is distinct from 'image/webp'
      or logo ->> 'role' not in ('club_logo', 'team_logo')
      or length(coalesce(logo ->> 'externalId', '')) not between 1 and 512
      or coalesce(logo ->> 'storagePath', '') !~ '^providers/sportlink/(club_logo|team_logo)/[a-f0-9]{64}[.]webp$'
      or (logo ->> 'fileSizeBytes')::bigint not between 1 and 2000000
      or (logo ->> 'width')::integer not between 1 and 512
      or (logo ->> 'height')::integer not between 1 and 512
    then
      raise exception 'invalid Sportlink provider asset payload' using errcode = '22023';
    end if;

    insert into public.provider_asset_cache(
      provider, entity_type, external_entity_id, asset_role, source_url,
      etag, last_modified, last_checked_at, last_success_at,
      last_error_code, updated_at
    ) values (
      'sportlink',
      case when logo ->> 'role' = 'club_logo' then 'club' else 'team' end,
      logo ->> 'externalId', logo ->> 'role', nullif(logo ->> 'sourceUrl', ''),
      nullif(logo ->> 'etag', ''), nullif(logo ->> 'lastModified', ''),
      now(), now(), null, now()
    )
    on conflict (provider, entity_type, external_entity_id, asset_role)
    do update set
      source_url = coalesce(excluded.source_url, provider_asset_cache.source_url),
      etag = coalesce(excluded.etag, provider_asset_cache.etag),
      last_modified = coalesce(excluded.last_modified, provider_asset_cache.last_modified),
      last_checked_at = now(), last_success_at = now(),
      last_error_code = null, updated_at = now()
    returning id into provider_cache_id;

    version_id := (logo ->> 'assetId')::uuid;
    insert into public.provider_asset_versions(
      id, cache_id, checksum_sha256, storage_bucket, storage_path, mime_type,
      file_size_bytes, width, height
    ) values (
      version_id, provider_cache_id, logo ->> 'checksumSha256', 'provider-assets',
      logo ->> 'storagePath', 'image/webp',
      (logo ->> 'fileSizeBytes')::bigint,
      (logo ->> 'width')::integer, (logo ->> 'height')::integer
    )
    on conflict (cache_id, checksum_sha256) do update
      set checksum_sha256 = excluded.checksum_sha256
    returning id into version_id;

    update public.provider_asset_cache
    set current_version_id = version_id, updated_at = now()
    where id = provider_cache_id;

    if logo ->> 'role' = 'club_logo' then
      club_version_id := version_id;
    else
      select coalesce(jsonb_agg(
        standing || jsonb_build_object('rows', coalesce((
          select jsonb_agg(
            row || case when row ->> 'logoUrl' = logo ->> 'sourceUrl'
              then jsonb_build_object('logoMediaAssetId', version_id)
              else '{}'::jsonb end
          )
          from jsonb_array_elements(coalesce(standing -> 'rows', '[]'::jsonb)) row
        ), '[]'::jsonb))
      ), '[]'::jsonb)
      into processed_standings
      from jsonb_array_elements(processed_standings) standing;
    end if;
  end loop;

  select coalesce(jsonb_agg(
    standing || jsonb_build_object('rows', coalesce((
      select jsonb_agg(row - 'logoUrl')
      from jsonb_array_elements(coalesce(standing -> 'rows', '[]'::jsonb)) row
    ), '[]'::jsonb))
  ), '[]'::jsonb)
  into processed_standings
  from jsonb_array_elements(processed_standings) standing;

  result := public.complete_sportlink_sync_v1(
    p_run_id, p_worker_id, coalesce(p_club, '{}'::jsonb),
    coalesce(p_teams, '[]'::jsonb), coalesce(p_matches, '[]'::jsonb),
    coalesce(p_activities, '[]'::jsonb), processed_standings
  );

  if club_version_id is not null then
    update public.sports_clubs
    set logo_provider_asset_version_id = club_version_id,
        last_synced_at = now()
    where tenant_id = sync_run.tenant_id
      and source_connection_id = sync_run.connection_id
      and external_id = p_club ->> 'externalId';
  end if;
  return result;
end;
$$;

revoke all on function public.complete_sportlink_sync_v4(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.complete_sportlink_sync_v4(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) to service_role;
