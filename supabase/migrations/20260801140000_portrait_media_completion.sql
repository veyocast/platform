create or replace function public.complete_media_processing_job(
  p_job_id uuid,
  p_worker_id text,
  p_original_checksum_sha256 text,
  p_player_storage_path text,
  p_player_checksum_sha256 text,
  p_player_file_size_bytes bigint,
  p_width integer,
  p_height integer,
  p_duration_seconds numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  processing_job public.media_processing_jobs%rowtype;
  media_asset public.media_assets%rowtype;
  expected_player_path text;
begin
  select job.*
  into processing_job
  from public.media_processing_jobs job
  where job.id = p_job_id
  for update;

  if not found
    or processing_job.status <> 'processing'::public.media_processing_job_status
    or processing_job.locked_by is distinct from nullif(btrim(p_worker_id), '')
  then
    raise exception 'processing job is not owned by this worker' using errcode = '42501';
  end if;

  select asset.*
  into media_asset
  from public.media_assets asset
  where asset.tenant_id = processing_job.tenant_id
    and asset.id = processing_job.asset_id
    and asset.kind = 'video'::public.media_asset_kind
    and asset.status = 'processing'::public.media_asset_status
  for update;

  if not found then
    raise exception 'processing asset is unavailable' using errcode = '23514';
  end if;

  expected_player_path :=
    'tenants/' || processing_job.tenant_id::text ||
    '/assets/' || processing_job.asset_id::text ||
    '/variants/player-1080p.mp4';

  if p_original_checksum_sha256 !~ '^[a-f0-9]{64}$'
    or p_player_checksum_sha256 !~ '^[a-f0-9]{64}$'
    or p_player_storage_path is distinct from expected_player_path
    or p_player_file_size_bytes <= 0
    or p_width <= 0
    or p_height <= 0
    or greatest(p_width, p_height) > 1920
    or least(p_width, p_height) > 1080
    or p_duration_seconds <= 0
    or p_duration_seconds > 300
  then
    raise exception 'processed variant metadata is invalid' using errcode = '23514';
  end if;

  insert into public.media_variants (
    tenant_id,
    asset_id,
    variant_type,
    storage_bucket,
    storage_path,
    mime_type,
    file_size_bytes,
    checksum_sha256,
    width,
    height,
    duration_seconds
  )
  values
    (
      processing_job.tenant_id,
      processing_job.asset_id,
      'original'::public.media_variant_type,
      media_asset.storage_bucket,
      media_asset.storage_path,
      media_asset.mime_type,
      media_asset.file_size_bytes,
      p_original_checksum_sha256,
      null,
      null,
      p_duration_seconds
    ),
    (
      processing_job.tenant_id,
      processing_job.asset_id,
      'player_1080p'::public.media_variant_type,
      media_asset.storage_bucket,
      p_player_storage_path,
      'video/mp4',
      p_player_file_size_bytes,
      p_player_checksum_sha256,
      p_width,
      p_height,
      p_duration_seconds
    )
  on conflict (tenant_id, asset_id, variant_type)
  do update set
    storage_bucket = excluded.storage_bucket,
    storage_path = excluded.storage_path,
    mime_type = excluded.mime_type,
    file_size_bytes = excluded.file_size_bytes,
    checksum_sha256 = excluded.checksum_sha256,
    width = excluded.width,
    height = excluded.height,
    duration_seconds = excluded.duration_seconds;

  update public.media_assets
  set
    checksum_sha256 = p_original_checksum_sha256,
    width = p_width,
    height = p_height,
    duration_seconds = p_duration_seconds,
    status = 'ready'::public.media_asset_status,
    validation_error = null,
    processed_at = now()
  where tenant_id = processing_job.tenant_id
    and id = processing_job.asset_id;

  update public.media_processing_jobs
  set
    status = 'completed'::public.media_processing_job_status,
    locked_at = null,
    locked_by = null,
    finished_at = now(),
    error_code = null,
    error_message = null
  where id = processing_job.id;
end;
$$;

revoke all on function public.complete_media_processing_job(
  uuid, text, text, text, text, bigint, integer, integer, numeric
) from public, anon, authenticated;
grant execute on function public.complete_media_processing_job(
  uuid, text, text, text, text, bigint, integer, integer, numeric
) to service_role;
