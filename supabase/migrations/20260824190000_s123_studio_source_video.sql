-- S123 Vector v2: first-class, tenant-safe Studio source video backgrounds.

alter table public.studio_revision_assets
  drop constraint studio_revision_assets_usage_kind_check;

alter table public.studio_revision_assets
  add constraint studio_revision_assets_usage_kind_check
  check (usage_kind in ('image', 'video'));

create or replace function private.set_studio_revision_asset_usage_kind()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  asset_kind public.media_asset_kind;
begin
  select asset.kind
  into asset_kind
  from public.media_assets asset
  where asset.tenant_id = new.tenant_id
    and asset.id = new.media_asset_id
    and asset.deleted_at is null;

  if asset_kind not in (
    'image'::public.media_asset_kind,
    'video'::public.media_asset_kind
  ) then
    raise exception 'Studio revision source must be image or video'
      using errcode = '23514';
  end if;

  new.usage_kind := asset_kind::text;
  return new;
end;
$$;

revoke all on function private.set_studio_revision_asset_usage_kind() from public;
revoke all on function private.set_studio_revision_asset_usage_kind() from anon;
revoke all on function private.set_studio_revision_asset_usage_kind() from authenticated;

create trigger studio_revision_assets_set_usage_kind
before insert on public.studio_revision_assets
for each row execute function private.set_studio_revision_asset_usage_kind();

create or replace function private.assert_studio_document(
  p_tenant_id uuid,
  p_orientation text,
  p_width integer,
  p_height integer,
  p_document jsonb,
  p_referenced_asset_ids uuid[]
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_asset_ids uuid[] :=
    private.normalize_studio_asset_ids(p_referenced_asset_ids);
  document_asset_ids uuid[];
  expected_asset_count integer := cardinality(normalized_asset_ids);
  element_count integer;
  schema_version_text text;
  duration_text text;
  fps_text text;
  document_width_text text;
  document_height_text text;
  motion_enabled_text text;
begin
  if p_document is null or jsonb_typeof(p_document) <> 'object'
    or jsonb_typeof(p_document -> 'artboard') <> 'object'
    or jsonb_typeof(p_document -> 'motion') <> 'object'
    or jsonb_typeof(p_document -> 'elements') <> 'array'
    or jsonb_typeof(p_document -> 'metadata') <> 'object'
  then
    raise exception 'Studio document structure is invalid' using errcode = '23514';
  end if;

  schema_version_text := p_document ->> 'schemaVersion';
  document_width_text := p_document #>> '{artboard,width}';
  document_height_text := p_document #>> '{artboard,height}';
  duration_text := p_document #>> '{motion,durationMs}';
  fps_text := p_document #>> '{motion,fps}';
  motion_enabled_text := p_document #>> '{motion,enabled}';
  element_count := jsonb_array_length(p_document -> 'elements');

  if schema_version_text is null or schema_version_text !~ '^[0-9]+$'
    or schema_version_text::integer <> 1
    or document_width_text is null or document_width_text !~ '^[0-9]+$'
    or document_height_text is null or document_height_text !~ '^[0-9]+$'
    or duration_text is null or duration_text !~ '^[0-9]+$'
    or fps_text is null or fps_text !~ '^[0-9]+$'
    or motion_enabled_text not in ('true', 'false')
    or p_document #>> '{artboard,orientation}' is distinct from p_orientation
    or document_width_text::integer <> p_width
    or document_height_text::integer <> p_height
    or duration_text::integer not between 1000 and 30000
    or fps_text::integer <> 30
    or element_count > 200
    or expected_asset_count > 100
    or not (
      (p_orientation = 'landscape' and p_width = 1920 and p_height = 1080)
      or (p_orientation = 'portrait' and p_width = 1080 and p_height = 1920)
    )
  then
    raise exception 'Studio document is outside supported limits'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_document -> 'elements') element
    where element ->> 'type' in ('image', 'video')
      and (
        element ->> 'mediaAssetId' is null
        or element ->> 'mediaAssetId' !~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      )
  ) then
    raise exception 'Studio media element contains an invalid media asset id'
      using errcode = '23514';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_document -> 'elements') element
    where element ->> 'type' = 'video'
  ) > 1 or exists (
    select 1
    from jsonb_array_elements(p_document -> 'elements') element
    where element ->> 'type' = 'video'
      and (
        element ->> 'variant' is distinct from 'player_1080p'
        or element ->> 'objectFit' not in ('cover', 'contain')
        or element ->> 'muted' is distinct from 'true'
        or element ->> 'loop' is distinct from 'true'
        or element ->> 'locked' is distinct from 'true'
        or element ->> 'x' is distinct from '0'
        or element ->> 'y' is distinct from '0'
        or element ->> 'rotation' is distinct from '0'
        or element ->> 'zIndex' is distinct from '0'
        or element ->> 'width' is distinct from p_width::text
        or element ->> 'height' is distinct from p_height::text
        or p_document #>> '{artboard,background,kind}' is distinct from 'transparent'
      )
  ) then
    raise exception 'Studio video must be the locked full-canvas background'
      using errcode = '23514';
  end if;

  select coalesce(
    array_agg(distinct media_asset_id order by media_asset_id),
    '{}'::uuid[]
  )
  into document_asset_ids
  from (
    select (element ->> 'mediaAssetId')::uuid as media_asset_id
    from jsonb_array_elements(p_document -> 'elements') element
    where element ->> 'type' in ('image', 'video')
  ) document_assets;

  if document_asset_ids is distinct from normalized_asset_ids then
    raise exception 'Studio document media manifest does not match its media elements'
      using errcode = '23514';
  end if;

  if (
    select count(*)::integer
    from public.media_assets asset
    where asset.tenant_id = p_tenant_id
      and asset.id = any(normalized_asset_ids)
      and asset.kind in (
        'image'::public.media_asset_kind,
        'video'::public.media_asset_kind
      )
      and asset.status = 'ready'::public.media_asset_status
      and asset.deleted_at is null
      and exists (
        select 1
        from public.media_variants variant
        where variant.tenant_id = asset.tenant_id
          and variant.asset_id = asset.id
          and (
            (
              asset.kind = 'image'::public.media_asset_kind
              and variant.variant_type = 'original'::public.media_variant_type
              and variant.mime_type in ('image/jpeg', 'image/png', 'image/webp')
            )
            or (
              asset.kind = 'video'::public.media_asset_kind
              and variant.variant_type = 'player_1080p'::public.media_variant_type
              and variant.mime_type = 'video/mp4'
              and variant.duration_seconds > 0
              and variant.width > 0
              and variant.height > 0
            )
          )
          and variant.checksum_sha256 ~ '^[a-f0-9]{64}$'
      )
  ) <> expected_asset_count then
    raise exception 'Studio document references unavailable tenant media'
      using errcode = '23514';
  end if;
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
      and job.attempt_count >= least(job.max_attempts, p_max_attempts)
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
    where render_job.attempt_count < least(render_job.max_attempts, p_max_attempts)
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
    project.width,
    project.height,
    project.duration_ms,
    project.fps
  from claimed
  join public.studio_revisions revision
    on revision.tenant_id = claimed.tenant_id
    and revision.id = claimed.revision_id
  join public.studio_projects project
    on project.tenant_id = claimed.tenant_id
    and project.id = claimed.project_id;
end;
$$;

comment on function private.assert_studio_document(uuid, text, integer, integer, jsonb, uuid[])
  is 'Validates deterministic Studio v1 documents and tenant-owned image/video source variants.';
