alter table public.media_processing_jobs
  add column locked_by text
  check (
    locked_by is null
    or (
      length(locked_by) between 3 and 120
      and locked_by ~ '^[a-zA-Z0-9._:-]+$'
    )
  );

create or replace function public.claim_media_processing_job(
  p_worker_id text,
  p_lock_timeout_seconds integer default 900,
  p_max_attempts integer default 3
)
returns table (
  job_id uuid,
  tenant_id uuid,
  asset_id uuid,
  attempt_count integer,
  storage_bucket text,
  storage_path text,
  original_file_name text,
  mime_type text,
  file_size_bytes bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_worker_id text := nullif(btrim(p_worker_id), '');
begin
  if normalized_worker_id is null
    or length(normalized_worker_id) not between 3 and 120
    or normalized_worker_id !~ '^[a-zA-Z0-9._:-]+$'
  then
    raise exception 'worker id is invalid' using errcode = '22023';
  end if;

  if p_lock_timeout_seconds not between 60 and 3600 then
    raise exception 'lock timeout must be between 60 and 3600 seconds' using errcode = '22023';
  end if;

  if p_max_attempts not between 1 and 10 then
    raise exception 'max attempts must be between 1 and 10' using errcode = '22023';
  end if;

  return query
  with candidate as (
    select processing_job.id
    from public.media_processing_jobs processing_job
    join public.media_assets media_asset
      on media_asset.tenant_id = processing_job.tenant_id
      and media_asset.id = processing_job.asset_id
    where processing_job.attempt_count < p_max_attempts
      and media_asset.kind = 'video'::public.media_asset_kind
      and media_asset.status in (
        'uploading'::public.media_asset_status,
        'processing'::public.media_asset_status
      )
      and (
        processing_job.status = 'queued'::public.media_processing_job_status
        or (
          processing_job.status = 'processing'::public.media_processing_job_status
          and (
            processing_job.locked_at is null
            or processing_job.locked_at < now() - make_interval(secs => p_lock_timeout_seconds)
          )
        )
      )
    order by processing_job.created_at, processing_job.id
    for update of processing_job skip locked
    limit 1
  ), claimed as (
    update public.media_processing_jobs processing_job
    set
      status = 'processing'::public.media_processing_job_status,
      attempt_count = processing_job.attempt_count + 1,
      locked_at = now(),
      locked_by = normalized_worker_id,
      started_at = coalesce(processing_job.started_at, now()),
      finished_at = null,
      error_code = null,
      error_message = null
    from candidate
    where processing_job.id = candidate.id
    returning processing_job.*
  ), mark_asset_processing as (
    update public.media_assets media_asset
    set
      status = 'processing'::public.media_asset_status,
      validation_error = null
    from claimed
    where media_asset.tenant_id = claimed.tenant_id
      and media_asset.id = claimed.asset_id
    returning media_asset.id
  )
  select
    claimed.id,
    claimed.tenant_id,
    claimed.asset_id,
    claimed.attempt_count,
    media_asset.storage_bucket,
    media_asset.storage_path,
    media_asset.original_file_name,
    media_asset.mime_type,
    media_asset.file_size_bytes
  from claimed
  join public.media_assets media_asset
    on media_asset.tenant_id = claimed.tenant_id
    and media_asset.id = claimed.asset_id
  cross join mark_asset_processing;
end;
$$;

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
    or p_width <= 0 or p_width > 1920
    or p_height <= 0 or p_height > 1080
    or p_duration_seconds <= 0 or p_duration_seconds > 300
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

create or replace function public.fail_media_processing_job(
  p_job_id uuid,
  p_worker_id text,
  p_error_code text,
  p_error_message text,
  p_retryable boolean default true,
  p_max_attempts integer default 3
)
returns public.media_processing_job_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  processing_job public.media_processing_jobs%rowtype;
  next_status public.media_processing_job_status;
  normalized_error_code text := lower(nullif(btrim(p_error_code), ''));
  normalized_error_message text := substring(
    regexp_replace(coalesce(p_error_message, ''), '[[:cntrl:]]', ' ', 'g')
    from 1 for 500
  );
begin
  if p_max_attempts not between 1 and 10
    or normalized_error_code is null
    or normalized_error_code !~ '^[a-z0-9_]{3,80}$'
  then
    raise exception 'failure metadata is invalid' using errcode = '22023';
  end if;

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

  next_status := case
    when p_retryable and processing_job.attempt_count < p_max_attempts
      then 'queued'::public.media_processing_job_status
    else 'failed'::public.media_processing_job_status
  end;

  update public.media_processing_jobs
  set
    status = next_status,
    locked_at = null,
    locked_by = null,
    finished_at = case when next_status = 'failed' then now() else null end,
    error_code = normalized_error_code,
    error_message = nullif(normalized_error_message, '')
  where id = processing_job.id;

  update public.media_assets
  set
    status = case
      when next_status = 'failed'
        then 'validation_failed'::public.media_asset_status
      else 'processing'::public.media_asset_status
    end,
    validation_error = case
      when next_status = 'failed' then normalized_error_code
      else null
    end
  where tenant_id = processing_job.tenant_id
    and id = processing_job.asset_id;

  return next_status;
end;
$$;

create or replace function public.finalize_media_video_upload(
  p_upload_session_id uuid
)
returns table(asset_id uuid, job_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  upload_session public.media_upload_sessions%rowtype;
  media_asset public.media_assets%rowtype;
  storage_object storage.objects%rowtype;
  processing_job_id uuid;
  storage_size_text text;
  storage_mime_type text;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  select session.*
  into upload_session
  from public.media_upload_sessions session
  where session.id = p_upload_session_id
  for update;

  if not found then
    raise exception 'upload session was not found' using errcode = 'P0002';
  end if;

  if not (
    private.has_tenant_role(upload_session.tenant_id, array[
      'tenant_owner',
      'tenant_admin',
      'tenant_editor'
    ]::public.tenant_role[])
    or private.is_platform_member(array[
      'platform_owner',
      'platform_admin'
    ]::public.platform_role[])
  ) then
    raise exception 'upload session is outside the writable tenant scope'
      using errcode = '42501';
  end if;

  select asset.*
  into media_asset
  from public.media_assets asset
  where asset.tenant_id = upload_session.tenant_id
    and asset.id = upload_session.asset_id
  for update;

  if not found
    or media_asset.kind <> 'video'::public.media_asset_kind
    or media_asset.mime_type <> 'video/mp4'
  then
    raise exception 'upload session does not reference an MP4 video'
      using errcode = '22023';
  end if;

  if upload_session.status = 'uploaded'::public.media_upload_session_status then
    select job.id
    into processing_job_id
    from public.media_processing_jobs job
    where job.tenant_id = upload_session.tenant_id
      and job.asset_id = upload_session.asset_id
      and job.status in (
        'queued'::public.media_processing_job_status,
        'processing'::public.media_processing_job_status
      )
    order by job.created_at desc
    limit 1;

    if processing_job_id is null then
      raise exception 'finalized upload has no active processing job'
        using errcode = '55000';
    end if;

    return query select upload_session.asset_id, processing_job_id;
    return;
  end if;

  if upload_session.status <> 'pending'::public.media_upload_session_status
    or upload_session.expires_at <= now()
    or media_asset.status <> 'uploading'::public.media_asset_status
  then
    raise exception 'upload session is no longer pending'
      using errcode = '55000';
  end if;

  select object.*
  into storage_object
  from storage.objects object
  where object.bucket_id = upload_session.storage_bucket
    and object.name = upload_session.storage_path;

  if not found then
    raise exception 'uploaded storage object was not found'
      using errcode = 'P0002';
  end if;

  storage_size_text := storage_object.metadata ->> 'size';
  storage_mime_type := coalesce(
    storage_object.metadata ->> 'mimetype',
    storage_object.metadata ->> 'contentType'
  );

  if storage_size_text is null
    or storage_size_text !~ '^[0-9]+$'
    or storage_size_text::bigint <> upload_session.expected_size_bytes
    or storage_size_text::bigint <> media_asset.file_size_bytes
    or storage_mime_type is distinct from upload_session.expected_mime_type
    or storage_mime_type is distinct from media_asset.mime_type
  then
    raise exception 'uploaded storage metadata does not match the session'
      using errcode = '22023';
  end if;

  update public.media_upload_sessions
  set
    status = 'uploaded'::public.media_upload_session_status,
    completed_at = now()
  where id = upload_session.id;

  update public.media_assets
  set
    status = 'processing'::public.media_asset_status,
    validation_error = null
  where tenant_id = upload_session.tenant_id
    and id = upload_session.asset_id;

  insert into public.media_processing_jobs (
    tenant_id,
    asset_id,
    requested_by
  )
  values (
    upload_session.tenant_id,
    upload_session.asset_id,
    current_user_id
  )
  returning id into processing_job_id;

  return query select upload_session.asset_id, processing_job_id;
end;
$$;

revoke all on function public.claim_media_processing_job(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.complete_media_processing_job(
  uuid, text, text, text, text, bigint, integer, integer, numeric
) from public, anon, authenticated;
revoke all on function public.fail_media_processing_job(
  uuid, text, text, text, boolean, integer
) from public, anon, authenticated;
revoke all on function public.finalize_media_video_upload(uuid)
  from public, anon;

grant execute on function public.claim_media_processing_job(text, integer, integer)
  to service_role;
grant execute on function public.complete_media_processing_job(
  uuid, text, text, text, text, bigint, integer, integer, numeric
) to service_role;
grant execute on function public.fail_media_processing_job(
  uuid, text, text, text, boolean, integer
) to service_role;
grant execute on function public.finalize_media_video_upload(uuid)
  to authenticated;
