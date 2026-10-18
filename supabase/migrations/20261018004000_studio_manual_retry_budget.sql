-- Retain lifetime attempt counts and the automatic worker cap. Only the existing
-- authorised retry writer can admit one extra attempt, at most ten in total.
-- Static copies of the S191 retry and current S123 claim writer keep auth, audit, locking and fencing intact.
-- Capture dimensions/timing come from the immutable render revision, even if the
-- mutable project has changed before a worker claims its existing job.
alter table public.studio_render_jobs add column manual_retry_through_attempt integer not null default 0
 check (manual_retry_through_attempt between 0 and 10);
comment on column public.studio_render_jobs.manual_retry_through_attempt is
 'Highest lifetime attempt explicitly authorised by the existing manual retry command; not an automatic budget increase.';

create or replace function public.retry_studio_render_v1(
  p_render_job_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  job_record public.studio_render_jobs%rowtype;
  request_json jsonb;
  replay jsonb;
  outcome jsonb;
begin
  select job.*
  into job_record
  from public.studio_render_jobs job
  where job.id = p_render_job_id;
  if not found then
    raise exception 'Studio render job not found' using errcode = 'P0002';
  end if;
  if actor_id is null
    or not private.can_manage_studio_jobs(
      job_record.tenant_id,
      job_record.requested_by
    )
    or not private.has_tenant_capability(
      job_record.tenant_id,
      'tenant.studio.render'
    )
  then
    raise exception 'actor cannot retry Studio render job' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(job_record.tenant_id);

  request_json := jsonb_build_object(
    'renderJobId', p_render_job_id,
    'operation', 'retry'
  );
  replay := private.begin_studio_command(
    job_record.tenant_id,
    'studio.render.retry',
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  select job.*
  into job_record
  from public.studio_render_jobs job
  where job.id = p_render_job_id
  for update;

  if job_record.status = 'failed' and job_record.attempt_count < 10 then
    update public.studio_render_jobs
    set
      status = 'queued',
      progress = 0,
      max_attempts = least(10, greatest(max_attempts, attempt_count + 1)),
      manual_retry_through_attempt = attempt_count + 1,
      next_attempt_at = now(),
      started_at = null,
      finished_at = null,
      error_code = null,
      error_detail = null
    where id = job_record.id
    returning * into job_record;
    outcome := jsonb_build_object(
      'outcome', 'queued',
      'renderJobId', job_record.id,
      'status', job_record.status
    );
  else
    outcome := jsonb_build_object(
      'outcome', 'unchanged',
      'renderJobId', job_record.id,
      'status', job_record.status
    );
  end if;

  return private.complete_studio_command(
    job_record.tenant_id,
    'studio.render.retry',
    p_idempotency_key,
    request_json,
    'studio_render_jobs',
    job_record.id,
    outcome,
    'studio.render.retry_requested'
  );
end;
$$;

create or replace function public.claim_studio_render_job_v1(
  p_worker_id text,
  p_lock_timeout_seconds integer default 900,
  p_max_attempts integer default 3
)
returns table (
  job_id uuid,
  tenant_id uuid,
  project_id uuid,
  revision_id uuid,
  output_kind text,
  planned_media_asset_id uuid,
  attempt_count integer,
  document_json jsonb,
  assets_json jsonb,
  width integer,
  height integer,
  duration_ms integer,
  fps integer
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
    raise exception 'Studio worker id is invalid' using errcode = '22023';
  end if;
  if p_lock_timeout_seconds not between 60 and 3600
    or p_max_attempts not between 1 and 10
  then
    raise exception 'Studio worker limits are invalid' using errcode = '22023';
  end if;

  update public.studio_render_jobs job
  set
    status = 'cancelled',
    locked_at = null,
    locked_by = null,
    finished_at = now(),
    error_code = 'render_cancelled',
    error_detail = 'Render geannuleerd na verlopen workerlease.'
  where job.status in (
      'preparing', 'rendering', 'encoding', 'uploading', 'creating_media'
    )
    and job.cancel_requested_at is not null
    and job.locked_at < now() - make_interval(secs => p_lock_timeout_seconds);

  with exhausted as (
    update public.studio_render_jobs job
    set
      status = 'failed',
      locked_at = null,
      locked_by = null,
      finished_at = now(),
      error_code = 'render_attempts_exhausted',
      error_detail = 'Maximaal aantal renderpogingen bereikt.'
    where job.status in (
        'preparing', 'rendering', 'encoding', 'uploading', 'creating_media'
      )
      and job.cancel_requested_at is null
      and job.attempt_count >= least(job.max_attempts, greatest(p_max_attempts, job.manual_retry_through_attempt))
      and job.locked_at < now() - make_interval(secs => p_lock_timeout_seconds)
    returning job.*
  )
  insert into public.audit_events (
    tenant_id, actor_user_id, action, target_type, target_id, result, metadata
  )
  select
    exhausted.tenant_id,
    exhausted.requested_by,
    'studio.render.failed',
    'studio_render_jobs',
    exhausted.id,
    'failed',
    jsonb_build_object(
      'systemExecuted', true,
      'errorCode', exhausted.error_code,
      'attemptCount', exhausted.attempt_count
    )
  from exhausted;

  return query
  with candidate as (
    select render_job.id
    from public.studio_render_jobs render_job
    where render_job.attempt_count < least(render_job.max_attempts, greatest(p_max_attempts, render_job.manual_retry_through_attempt))
      and render_job.cancel_requested_at is null
      and (
        (render_job.status = 'queued' and render_job.next_attempt_at <= now())
        or (
          render_job.status in (
            'preparing', 'rendering', 'encoding', 'uploading', 'creating_media'
          )
          and render_job.locked_at <
            now() - make_interval(secs => p_lock_timeout_seconds)
        )
      )
    order by render_job.next_attempt_at, render_job.created_at, render_job.id
    for update of render_job skip locked
    limit 1
  ), claimed as (
    update public.studio_render_jobs render_job
    set
      status = 'preparing',
      attempt_count = render_job.attempt_count + 1,
      progress = greatest(render_job.progress, 1),
      next_attempt_at = now(),
      locked_at = now(),
      locked_by = normalized_worker_id,
      started_at = coalesce(render_job.started_at, now()),
      error_code = null,
      error_detail = null
    from candidate
    where render_job.id = candidate.id
    returning render_job.*
  )
  select
    claimed.id,
    claimed.tenant_id,
    claimed.project_id,
    claimed.revision_id,
    claimed.output_kind,
    claimed.planned_media_asset_id,
    claimed.attempt_count,
    revision.document_json,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'assetId', asset.id,
          'bucket', variant.storage_bucket,
          'path', variant.storage_path,
          'mimeType', variant.mime_type,
          'checksumSha256', variant.checksum_sha256,
          'width', variant.width,
          'height', variant.height,
          'durationSeconds', variant.duration_seconds
        )
        order by asset.id
      )
      from public.studio_revision_assets revision_asset
      join public.media_assets asset
        on asset.tenant_id = revision_asset.tenant_id
        and asset.id = revision_asset.media_asset_id
      join lateral (
        select source_variant.*
        from public.media_variants source_variant
        where source_variant.tenant_id = asset.tenant_id
          and source_variant.asset_id = asset.id
          and source_variant.variant_type = case
            when asset.kind = 'video'::public.media_asset_kind
              then 'player_1080p'::public.media_variant_type
            else 'original'::public.media_variant_type
          end
        limit 1
      ) variant on true
      where revision_asset.tenant_id = claimed.tenant_id
        and revision_asset.revision_id = claimed.revision_id
        and asset.kind in (
          'image'::public.media_asset_kind,
          'video'::public.media_asset_kind
        )
        and asset.status = 'ready'::public.media_asset_status
        and asset.deleted_at is null
    ), '[]'::jsonb),
    (revision.document_json#>>'{artboard,width}')::integer,
    (revision.document_json#>>'{artboard,height}')::integer,
    (revision.document_json#>>'{motion,durationMs}')::integer,
    (revision.document_json#>>'{motion,fps}')::integer
  from claimed
  join public.studio_revisions revision
    on revision.tenant_id = claimed.tenant_id
    and revision.id = claimed.revision_id
  join public.studio_projects project
    on project.tenant_id = claimed.tenant_id
    and project.id = claimed.project_id;
end;
$$;
