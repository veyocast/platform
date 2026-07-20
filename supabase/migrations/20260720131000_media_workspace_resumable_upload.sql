alter table public.tenants
  add column media_storage_limit_bytes bigint not null default 10737418240
  check (media_storage_limit_bytes between 524288000 and 1099511627776);

alter table public.media_upload_sessions
  add column upload_protocol text not null default 'tus'
    check (upload_protocol in ('tus', 'single')),
  add column idempotency_key uuid not null default gen_random_uuid(),
  add column cancelled_at timestamptz,
  add column last_progress_bytes bigint not null default 0
    check (last_progress_bytes >= 0 and last_progress_bytes <= expected_size_bytes),
  add constraint media_upload_sessions_tenant_creator_idempotency_uq
    unique (tenant_id, created_by, idempotency_key);

update public.media_upload_sessions
set cancelled_at = coalesce(completed_at, updated_at, now())
where status = 'cancelled'::public.media_upload_session_status
  and cancelled_at is null;

alter table public.media_upload_sessions
  add constraint media_upload_sessions_terminal_timestamp_check check (
    (status = 'cancelled'::public.media_upload_session_status and cancelled_at is not null)
    or status <> 'cancelled'::public.media_upload_session_status
  );

create index media_upload_sessions_tenant_pending_idx
  on public.media_upload_sessions(tenant_id, created_by, expires_at)
  where status = 'pending'::public.media_upload_session_status;

create or replace function public.create_media_video_upload_intent(
  p_tenant_id uuid,
  p_title text,
  p_original_file_name text,
  p_expected_mime_type text,
  p_expected_size_bytes bigint,
  p_idempotency_key uuid
)
returns table(
  asset_id uuid,
  upload_session_id uuid,
  storage_bucket text,
  storage_path text,
  expires_at timestamptz,
  resumed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_tenant_id uuid := p_tenant_id;
  normalized_title text := btrim(coalesce(p_title, ''));
  normalized_file_name text := lower(btrim(coalesce(p_original_file_name, '')));
  existing_session public.media_upload_sessions%rowtype;
  existing_asset public.media_assets%rowtype;
  new_asset_id uuid := gen_random_uuid();
  new_session_id uuid := gen_random_uuid();
  new_path text;
  tenant_limit bigint;
  reserved_bytes bigint;
  pending_intent_count integer;
  intent_expires_at timestamptz := now() + interval '23 hours';
begin
  if current_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  if target_tenant_id is null or not exists (
    select 1 from public.tenants tenant
    where tenant.id = target_tenant_id
      and tenant.status = 'active'::public.tenant_status
  ) or not (
    private.has_tenant_role(target_tenant_id, array[
      'tenant_owner', 'tenant_admin', 'tenant_editor'
    ]::public.tenant_role[])
    or private.is_platform_member(array[
      'platform_owner', 'platform_admin'
    ]::public.platform_role[])
  ) then
    raise exception 'an active writable tenant is required' using errcode = '42501';
  end if;

  if p_idempotency_key is null
    or length(normalized_title) not between 2 and 120
    or p_expected_mime_type is distinct from 'video/mp4'
    or p_expected_size_bytes is null
    or p_expected_size_bytes not between 1 and 524288000
    or normalized_file_name !~ '^[a-z0-9][a-z0-9_-]{0,79}\.mp4$'
  then
    raise exception 'video upload intent is invalid' using errcode = '22023';
  end if;

  select session.*
  into existing_session
  from public.media_upload_sessions session
  where session.tenant_id = target_tenant_id
    and session.created_by = current_user_id
    and session.idempotency_key = p_idempotency_key
  for update;

  if found then
    select asset.* into existing_asset
    from public.media_assets asset
    where asset.tenant_id = existing_session.tenant_id
      and asset.id = existing_session.asset_id;

    if existing_session.status <> 'pending'::public.media_upload_session_status
      or existing_session.expires_at <= now()
      or existing_session.expected_mime_type is distinct from p_expected_mime_type
      or existing_session.expected_size_bytes is distinct from p_expected_size_bytes
      or existing_asset.original_file_name is distinct from normalized_file_name
      or existing_asset.title is distinct from normalized_title
    then
      raise exception 'idempotency key belongs to another or expired upload intent'
        using errcode = '23505';
    end if;

    return query select
      existing_session.asset_id,
      existing_session.id,
      existing_session.storage_bucket,
      existing_session.storage_path,
      existing_session.expires_at,
      true;
    return;
  end if;

  select tenant.media_storage_limit_bytes
  into tenant_limit
  from public.tenants tenant
  where tenant.id = target_tenant_id
  for update;

  select count(*)::integer into pending_intent_count
  from public.media_upload_sessions session
  where session.tenant_id = target_tenant_id
    and session.created_by = current_user_id
    and session.status = 'pending'::public.media_upload_session_status
    and session.expires_at > now();

  if pending_intent_count >= 5 then
    raise exception 'actor has too many pending media upload intents' using errcode = '54000';
  end if;

  select coalesce(sum(asset.file_size_bytes), 0)::bigint
  into reserved_bytes
  from public.media_assets asset
  where asset.tenant_id = target_tenant_id
    and asset.deleted_at is null
    and asset.status <> 'deleted'::public.media_asset_status;

  if reserved_bytes + p_expected_size_bytes > tenant_limit then
    raise exception 'tenant media storage quota would be exceeded' using errcode = '53100';
  end if;

  new_path :=
    'tenants/' || target_tenant_id::text ||
    '/assets/' || new_asset_id::text ||
    '/original/' || normalized_file_name;

  insert into public.media_assets (
    id, tenant_id, created_by, kind, title, original_file_name, mime_type,
    status, storage_bucket, storage_path, file_size_bytes
  ) values (
    new_asset_id, target_tenant_id, current_user_id, 'video', normalized_title,
    normalized_file_name, 'video/mp4', 'uploading', 'tenant-media', new_path,
    p_expected_size_bytes
  );

  insert into public.media_upload_sessions (
    id, tenant_id, asset_id, created_by, status, storage_bucket, storage_path,
    expected_mime_type, expected_size_bytes, expires_at, upload_protocol,
    idempotency_key
  ) values (
    new_session_id, target_tenant_id, new_asset_id, current_user_id, 'pending',
    'tenant-media', new_path, 'video/mp4', p_expected_size_bytes,
    intent_expires_at, 'tus', p_idempotency_key
  );

  perform private.audit_event(
    target_tenant_id,
    'media.upload.intent_created',
    'media_assets',
    new_asset_id,
    'success',
    jsonb_build_object(
      'assetId', new_asset_id,
      'protocol', 'tus',
      'expectedSizeBytes', p_expected_size_bytes
    )
  );

  return query select
    new_asset_id,
    new_session_id,
    'tenant-media'::text,
    new_path,
    intent_expires_at,
    false;
end;
$$;

create or replace function public.cancel_media_video_upload(
  p_upload_session_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  upload_session public.media_upload_sessions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  select session.* into upload_session
  from public.media_upload_sessions session
  where session.id = p_upload_session_id
  for update;

  if not found then
    return false;
  end if;

  if not (
    private.has_tenant_role(upload_session.tenant_id, array[
      'tenant_owner', 'tenant_admin', 'tenant_editor'
    ]::public.tenant_role[])
    or private.is_platform_member(array[
      'platform_owner', 'platform_admin'
    ]::public.platform_role[])
  ) then
    raise exception 'upload session is outside the writable tenant scope'
      using errcode = '42501';
  end if;

  if upload_session.status in (
    'cancelled'::public.media_upload_session_status,
    'expired'::public.media_upload_session_status
  ) then
    return true;
  end if;

  if upload_session.status <> 'pending'::public.media_upload_session_status then
    return false;
  end if;

  update public.media_upload_sessions
  set status = 'cancelled', cancelled_at = now()
  where id = upload_session.id;

  update public.media_assets
  set
    status = 'deleted',
    deleted_at = now(),
    validation_error = 'upload_cancelled'
  where tenant_id = upload_session.tenant_id
    and id = upload_session.asset_id
    and status = 'uploading';

  perform private.audit_event(
    upload_session.tenant_id,
    'media.upload.cancelled',
    'media_upload_sessions',
    upload_session.id,
    'success',
    jsonb_build_object('assetId', upload_session.asset_id)
  );

  return true;
end;
$$;

create or replace function public.quarantine_media_video_upload(
  p_upload_session_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  upload_session public.media_upload_sessions%rowtype;
  normalized_reason text := lower(btrim(coalesce(p_reason, '')));
begin
  if auth.uid() is null or normalized_reason not in (
    'storage_metadata_mismatch', 'content_signature_mismatch'
  ) then
    raise exception 'quarantine request is invalid' using errcode = '22023';
  end if;

  select session.* into upload_session
  from public.media_upload_sessions session
  where session.id = p_upload_session_id
  for update;

  if not found or not (
    private.has_tenant_role(upload_session.tenant_id, array[
      'tenant_owner', 'tenant_admin', 'tenant_editor'
    ]::public.tenant_role[])
    or private.is_platform_member(array[
      'platform_owner', 'platform_admin'
    ]::public.platform_role[])
  ) then
    raise exception 'upload session is outside the writable tenant scope'
      using errcode = '42501';
  end if;

  if upload_session.status <> 'pending'::public.media_upload_session_status then
    return false;
  end if;

  update public.media_upload_sessions
  set status = 'cancelled', cancelled_at = now()
  where id = upload_session.id;

  update public.media_assets
  set status = 'quarantined', validation_error = normalized_reason
  where tenant_id = upload_session.tenant_id
    and id = upload_session.asset_id
    and status = 'uploading';

  perform private.audit_event(
    upload_session.tenant_id,
    'media.upload.quarantined',
    'media_assets',
    upload_session.asset_id,
    'success',
    jsonb_build_object('reason', normalized_reason, 'uploadSessionId', upload_session.id)
  );
  return true;
end;
$$;

create or replace function public.finalize_media_video_upload_v2(
  p_upload_session_id uuid
)
returns table(asset_id uuid, job_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  upload_session public.media_upload_sessions%rowtype;
  processing_job_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  select session.* into upload_session
  from public.media_upload_sessions session
  where session.id = p_upload_session_id;

  if not found then
    raise exception 'upload session was not found' using errcode = 'P0002';
  end if;

  if not (
    private.has_tenant_role(upload_session.tenant_id, array[
      'tenant_owner', 'tenant_admin', 'tenant_editor'
    ]::public.tenant_role[])
    or private.is_platform_member(array[
      'platform_owner', 'platform_admin'
    ]::public.platform_role[])
  ) then
    raise exception 'upload session is outside the writable tenant scope'
      using errcode = '42501';
  end if;

  if upload_session.status = 'uploaded'::public.media_upload_session_status then
    select job.id into processing_job_id
    from public.media_processing_jobs job
    where job.tenant_id = upload_session.tenant_id
      and job.asset_id = upload_session.asset_id
    order by job.created_at desc
    limit 1;

    if processing_job_id is null then
      raise exception 'finalized upload has no processing job' using errcode = '55000';
    end if;

    return query select upload_session.asset_id, processing_job_id;
    return;
  end if;

  return query
  select finalized.asset_id, finalized.job_id
  from public.finalize_media_video_upload(p_upload_session_id) finalized;
end;
$$;

create or replace function public.list_media_assets(
  p_tenant_id uuid,
  p_page integer default 1,
  p_page_size integer default 20,
  p_query text default null,
  p_kind public.media_asset_kind default null,
  p_status public.media_asset_status default null,
  p_usage text default null,
  p_created_from timestamptz default null,
  p_created_until timestamptz default null
)
returns table(
  id uuid,
  title text,
  original_file_name text,
  kind public.media_asset_kind,
  mime_type text,
  status public.media_asset_status,
  storage_path text,
  file_size_bytes bigint,
  checksum_sha256 text,
  width integer,
  height integer,
  duration_seconds numeric,
  validation_error text,
  created_at timestamptz,
  draft_count bigint,
  release_count bigint,
  screen_count bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (
    private.is_tenant_member(p_tenant_id)
    or private.is_platform_member(array[
      'platform_owner', 'platform_admin', 'platform_support'
    ]::public.platform_role[])
  ) then
    raise exception 'tenant media is outside the readable scope' using errcode = '42501';
  end if;

  if p_page not between 1 and 100000
    or p_page_size not between 1 and 100
    or coalesce(p_usage, 'all') not in ('all', 'used', 'unused')
  then
    raise exception 'media list filters are invalid' using errcode = '22023';
  end if;

  return query
  with draft_usage as (
    select item.media_asset_id, count(distinct item.playlist_id)::bigint as count
    from public.playlist_items item
    where item.tenant_id = p_tenant_id
    group by item.media_asset_id
  ), release_usage as (
    select item.media_asset_id, count(distinct item.release_id)::bigint as count
    from public.playlist_release_items item
    where item.tenant_id = p_tenant_id
    group by item.media_asset_id
  ), screen_usage as (
    select item.media_asset_id, count(distinct screen.id)::bigint as count
    from public.playlist_release_items item
    join public.screens screen
      on screen.tenant_id = item.tenant_id
      and screen.assigned_release_id = item.release_id
    where item.tenant_id = p_tenant_id
    group by item.media_asset_id
  ), filtered as (
    select
      asset.*,
      coalesce(draft.count, 0)::bigint as draft_count,
      coalesce(release.count, 0)::bigint as release_count,
      coalesce(screen.count, 0)::bigint as screen_count
    from public.media_assets asset
    left join draft_usage draft on draft.media_asset_id = asset.id
    left join release_usage release on release.media_asset_id = asset.id
    left join screen_usage screen on screen.media_asset_id = asset.id
    where asset.tenant_id = p_tenant_id
      and asset.deleted_at is null
      and (nullif(btrim(p_query), '') is null or
        asset.title ilike '%' || btrim(p_query) || '%' or
        asset.original_file_name ilike '%' || btrim(p_query) || '%')
      and (p_kind is null or asset.kind = p_kind)
      and (p_status is null or asset.status = p_status)
      and (p_created_from is null or asset.created_at >= p_created_from)
      and (p_created_until is null or asset.created_at < p_created_until)
      and (
        coalesce(p_usage, 'all') = 'all'
        or (p_usage = 'used' and (
          coalesce(draft.count, 0) + coalesce(release.count, 0) + coalesce(screen.count, 0)
        ) > 0)
        or (p_usage = 'unused' and (
          coalesce(draft.count, 0) + coalesce(release.count, 0) + coalesce(screen.count, 0)
        ) = 0)
      )
  )
  select
    filtered.id,
    filtered.title,
    filtered.original_file_name,
    filtered.kind,
    filtered.mime_type,
    filtered.status,
    filtered.storage_path,
    filtered.file_size_bytes,
    filtered.checksum_sha256,
    filtered.width,
    filtered.height,
    filtered.duration_seconds,
    filtered.validation_error,
    filtered.created_at,
    filtered.draft_count,
    filtered.release_count,
    filtered.screen_count,
    count(*) over()::bigint as total_count
  from filtered
  order by filtered.created_at desc, filtered.id
  limit p_page_size
  offset ((p_page - 1) * p_page_size);
end;
$$;

create or replace function public.get_media_asset_usage(
  p_asset_id uuid
)
returns table(
  usage_type text,
  resource_id uuid,
  resource_name text,
  playlist_id uuid,
  release_version integer,
  screen_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_tenant_id uuid;
begin
  select asset.tenant_id into target_tenant_id
  from public.media_assets asset
  where asset.id = p_asset_id
    and asset.deleted_at is null;

  if target_tenant_id is null or not (
    private.is_tenant_member(target_tenant_id)
    or private.is_platform_member(array[
      'platform_owner', 'platform_admin', 'platform_support'
    ]::public.platform_role[])
  ) then
    raise exception 'media asset is outside the readable scope' using errcode = '42501';
  end if;

  return query
  select
    'draft'::text,
    playlist.id,
    playlist.name,
    playlist.id,
    null::integer,
    0::bigint
  from public.playlist_items item
  join public.playlists playlist
    on playlist.tenant_id = item.tenant_id and playlist.id = item.playlist_id
  where item.tenant_id = target_tenant_id
    and item.media_asset_id = p_asset_id
  group by playlist.id, playlist.name

  union all

  select
    'release'::text,
    release.id,
    playlist.name,
    release.playlist_id,
    release.version,
    count(distinct screen.id)::bigint
  from public.playlist_release_items item
  join public.playlist_releases release
    on release.tenant_id = item.tenant_id and release.id = item.release_id
  join public.playlists playlist
    on playlist.tenant_id = release.tenant_id and playlist.id = release.playlist_id
  left join public.screens screen
    on screen.tenant_id = release.tenant_id and screen.assigned_release_id = release.id
  where item.tenant_id = target_tenant_id
    and item.media_asset_id = p_asset_id
  group by release.id, playlist.name, release.playlist_id, release.version

  union all

  select
    'screen'::text,
    screen.id,
    screen.name,
    release.playlist_id,
    release.version,
    1::bigint
  from public.playlist_release_items item
  join public.playlist_releases release
    on release.tenant_id = item.tenant_id and release.id = item.release_id
  join public.screens screen
    on screen.tenant_id = release.tenant_id and screen.assigned_release_id = release.id
  where item.tenant_id = target_tenant_id
    and item.media_asset_id = p_asset_id
  group by screen.id, screen.name, release.playlist_id, release.version
  order by 1, 3;
end;
$$;

create or replace function public.get_media_storage_usage(
  p_tenant_id uuid
)
returns table(used_bytes bigint, limit_bytes bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (
    private.is_tenant_member(p_tenant_id)
    or private.is_platform_member(array[
      'platform_owner', 'platform_admin', 'platform_support'
    ]::public.platform_role[])
  ) then
    raise exception 'tenant media usage is outside the readable scope' using errcode = '42501';
  end if;

  return query
  select
    coalesce(sum(asset.file_size_bytes) filter (
      where asset.deleted_at is null
        and asset.status <> 'deleted'::public.media_asset_status
    ), 0)::bigint,
    tenant.media_storage_limit_bytes
  from public.tenants tenant
  left join public.media_assets asset on asset.tenant_id = tenant.id
  where tenant.id = p_tenant_id
  group by tenant.media_storage_limit_bytes;
end;
$$;

drop policy if exists "tenant_media_storage_insert_by_writer" on storage.objects;
create policy "tenant_media_storage_insert_by_writer"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'tenant-media'
  and exists (
    select 1
    from public.media_upload_sessions session
    where session.tenant_id = private.storage_object_tenant_id(name)
      and session.asset_id = private.storage_object_asset_id(name)
      and session.storage_bucket = bucket_id
      and session.storage_path = name
      and session.status = 'pending'::public.media_upload_session_status
      and session.expires_at > now()
      and session.created_by = private.current_user_id()
      and (
        private.has_tenant_role(session.tenant_id, array[
          'tenant_owner', 'tenant_admin', 'tenant_editor'
        ]::public.tenant_role[])
        or private.is_platform_member(array[
          'platform_owner', 'platform_admin'
        ]::public.platform_role[])
      )
  )
);

drop policy if exists "tenant_media_storage_update_by_writer" on storage.objects;
create policy "tenant_media_storage_update_by_writer"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'tenant-media'
  and exists (
    select 1 from public.media_upload_sessions session
    where session.storage_bucket = bucket_id
      and session.storage_path = name
      and session.status = 'pending'::public.media_upload_session_status
      and session.expires_at > now()
      and session.created_by = private.current_user_id()
  )
)
with check (
  bucket_id = 'tenant-media'
  and exists (
    select 1 from public.media_upload_sessions session
    where session.storage_bucket = bucket_id
      and session.storage_path = name
      and session.status = 'pending'::public.media_upload_session_status
      and session.expires_at > now()
      and session.created_by = private.current_user_id()
  )
);

create policy "tenant_media_storage_delete_pending_by_creator"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'tenant-media'
  and exists (
    select 1 from public.media_upload_sessions session
    where session.storage_bucket = bucket_id
      and session.storage_path = name
      and session.status = 'pending'::public.media_upload_session_status
      and session.created_by = private.current_user_id()
  )
);

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
  quarantine_failure boolean;
begin
  if p_max_attempts not between 1 and 10
    or normalized_error_code is null
    or normalized_error_code !~ '^[a-z0-9_]{3,80}$'
  then
    raise exception 'failure metadata is invalid' using errcode = '22023';
  end if;

  select job.* into processing_job
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
  quarantine_failure := not p_retryable and normalized_error_code in (
    'invalid_probe',
    'source_size_mismatch',
    'unsupported_input',
    'unsupported_mime_type'
  );

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
      when next_status = 'failed' and quarantine_failure
        then 'quarantined'::public.media_asset_status
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

revoke all on function public.create_media_video_upload_intent(uuid, text, text, text, bigint, uuid)
  from public, anon;
revoke all on function public.cancel_media_video_upload(uuid) from public, anon;
revoke all on function public.quarantine_media_video_upload(uuid, text) from public, anon;
revoke all on function public.finalize_media_video_upload_v2(uuid) from public, anon;
revoke all on function public.list_media_assets(uuid, integer, integer, text, public.media_asset_kind, public.media_asset_status, text, timestamptz, timestamptz)
  from public, anon;
revoke all on function public.get_media_asset_usage(uuid) from public, anon;
revoke all on function public.get_media_storage_usage(uuid) from public, anon;

grant execute on function public.create_media_video_upload_intent(uuid, text, text, text, bigint, uuid)
  to authenticated;
grant execute on function public.cancel_media_video_upload(uuid) to authenticated;
grant execute on function public.quarantine_media_video_upload(uuid, text) to authenticated;
grant execute on function public.finalize_media_video_upload_v2(uuid) to authenticated;
grant execute on function public.list_media_assets(uuid, integer, integer, text, public.media_asset_kind, public.media_asset_status, text, timestamptz, timestamptz)
  to authenticated;
grant execute on function public.get_media_asset_usage(uuid) to authenticated;
grant execute on function public.get_media_storage_usage(uuid) to authenticated;

revoke all on function public.fail_media_processing_job(
  uuid, text, text, text, boolean, integer
) from public, anon, authenticated;
grant execute on function public.fail_media_processing_job(
  uuid, text, text, text, boolean, integer
) to service_role;
