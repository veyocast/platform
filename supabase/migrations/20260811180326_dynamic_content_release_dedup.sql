-- S99: content-driven dynamic refreshes. Provider checks may run frequently,
-- but immutable snapshots, fallback assets and playlist releases advance only
-- when the bounded Player payload really changes.

create or replace function private.dynamic_snapshot_content_hash_v1(
  p_slide public.dynamic_slides,
  p_snapshot_data jsonb
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(
    extensions.digest(
      pg_catalog.convert_to(
        jsonb_build_object(
          'templateVersionId', p_slide.template_version_id,
          'configuration', p_slide.configuration_json,
          'data',
            coalesce(p_snapshot_data, '{}'::jsonb)
              #- '{menu,generatedAt}'
              #- '{news,generatedAt}'
              #- '{sport,generatedAt}'
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
$$;

revoke all on function private.dynamic_snapshot_content_hash_v1(
  public.dynamic_slides,
  jsonb
) from public, anon, authenticated;

create or replace function private.dynamic_fallback_asset_id_v1(
  p_tenant_id uuid,
  p_snapshot_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  snapshot_record public.dynamic_slide_snapshots%rowtype;
  digest_hex text;
begin
  select snapshot.*
  into snapshot_record
  from public.dynamic_slide_snapshots snapshot
  where snapshot.tenant_id = p_tenant_id
    and snapshot.id = p_snapshot_id;
  if not found then
    raise exception 'dynamic snapshot not found' using errcode = 'P0002';
  end if;

  digest_hex := encode(
    extensions.digest(
      pg_catalog.convert_to(
        p_tenant_id::text || chr(31) ||
        snapshot_record.template_version_id::text || chr(31) ||
        snapshot_record.source_revision_hash,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
  return (
    substr(digest_hex, 1, 8) || '-' ||
    substr(digest_hex, 9, 4) || '-' ||
    '5' || substr(digest_hex, 14, 3) || '-' ||
    '8' || substr(digest_hex, 18, 3) || '-' ||
    substr(digest_hex, 21, 12)
  )::uuid;
end;
$$;

revoke all on function private.dynamic_fallback_asset_id_v1(uuid, uuid)
  from public, anon, authenticated;

create or replace function private.assign_dynamic_fallback_asset_id_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.output_media_asset_id := private.dynamic_fallback_asset_id_v1(
    new.tenant_id,
    new.snapshot_id
  );
  return new;
end;
$$;

revoke all on function private.assign_dynamic_fallback_asset_id_v1()
  from public, anon, authenticated;

drop trigger if exists dynamic_render_jobs_assign_fallback_asset
  on public.dynamic_render_jobs;
create trigger dynamic_render_jobs_assign_fallback_asset
before insert on public.dynamic_render_jobs
for each row execute function private.assign_dynamic_fallback_asset_id_v1();

create or replace function private.queue_latest_dynamic_snapshots_v2(
  p_tenant_id uuid,
  p_data_source_id uuid,
  p_slide_types text[] default null,
  p_reason text default 'source_content_changed'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  slide_record public.dynamic_slides%rowtype;
  snapshot_data jsonb;
  content_hash text;
  new_snapshot_id uuid;
  queued_count integer := 0;
begin
  for slide_record in
    select slide.*
    from public.dynamic_slides slide
    where slide.tenant_id = p_tenant_id
      and slide.data_source_id = p_data_source_id
      and slide.selection_mode = 'latest'
      and slide.status <> 'archived'
      and (
        p_slide_types is null
        or slide.slide_type = any(p_slide_types)
      )
    order by slide.id
  loop
    snapshot_data := private.build_dynamic_snapshot_data(slide_record);
    content_hash := private.dynamic_snapshot_content_hash_v1(
      slide_record,
      snapshot_data
    );
    new_snapshot_id := null;

    -- Deploying this hash must not create a one-off replacement for a
    -- current snapshot whose old hash still included generatedAt. Compare
    -- the canonical payload itself before inserting the new stable hash.
    if exists (
      select 1
      from public.dynamic_slide_snapshots current_snapshot
      where current_snapshot.id = slide_record.current_snapshot_id
        and current_snapshot.dynamic_slide_id = slide_record.id
        and current_snapshot.template_version_id = slide_record.template_version_id
        and private.dynamic_snapshot_content_hash_v1(
          slide_record,
          current_snapshot.snapshot_data_json
        ) = content_hash
    ) then
      continue;
    end if;

    insert into public.dynamic_slide_snapshots(
      tenant_id,
      dynamic_slide_id,
      template_version_id,
      data_source_id,
      source_revision_hash,
      snapshot_data_json
    ) values (
      slide_record.tenant_id,
      slide_record.id,
      slide_record.template_version_id,
      slide_record.data_source_id,
      content_hash,
      snapshot_data
    )
    on conflict (
      dynamic_slide_id,
      source_revision_hash,
      template_version_id
    ) do nothing
    returning id into new_snapshot_id;

    if new_snapshot_id is not null then
      insert into public.dynamic_render_jobs(tenant_id, snapshot_id)
      values (slide_record.tenant_id, new_snapshot_id);
      update public.dynamic_slides
      set status = 'rendering',
          last_error_code = null
      where id = slide_record.id;
      queued_count := queued_count + 1;
    end if;
  end loop;

  if queued_count > 0 then
    insert into public.audit_events(
      tenant_id,
      action,
      target_type,
      target_id,
      result,
      metadata
    ) values (
      p_tenant_id,
      'dynamic.snapshot.auto_queued',
      'dynamic_data_sources',
      p_data_source_id,
      'success',
      jsonb_build_object(
        'systemExecuted', true,
        'reason', left(coalesce(p_reason, 'source_content_changed'), 120),
        'queuedCount', queued_count
      )
    );
  end if;

  return queued_count;
end;
$$;

revoke all on function private.queue_latest_dynamic_snapshots_v2(
  uuid,
  uuid,
  text[],
  text
) from public, anon, authenticated;

create or replace function private.queue_latest_dynamic_snapshots_after_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.revision is not distinct from old.revision then
    return new;
  end if;
  perform private.queue_latest_dynamic_snapshots_v2(
    new.tenant_id,
    new.id,
    null,
    new.kind || '_content_changed'
  );
  return new;
end;
$$;

revoke all on function private.queue_latest_dynamic_snapshots_after_sync()
  from public, anon, authenticated;

-- record_sportlink_sync_v1 already advances the source once after its
-- normalized rows are written. The old run-status trigger advanced it a
-- second time. Keep the status timestamp update, but leave revisioning to the
-- single canonical source update above.
create or replace function private.refresh_sportlink_source_after_dataset_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'succeeded' or old.status is not distinct from new.status then
    return new;
  end if;

  update public.dynamic_data_sources source
  set provider_status = 'ready',
      last_attempt_at = coalesce(new.finished_at, now()),
      last_successful_sync_at = coalesce(new.finished_at, now()),
      last_error_code = null,
      last_error_detail = null
  from public.sportlink_connections connection
  where connection.id = new.connection_id
    and connection.tenant_id = new.tenant_id
    and source.id = connection.data_source_id
    and source.tenant_id = new.tenant_id
    and source.kind = 'sportlink'
    and source.status = 'active';
  return new;
end;
$$;

revoke all on function private.refresh_sportlink_source_after_dataset_sync()
  from public, anon, authenticated;

create or replace function public.refresh_dynamic_slide_v1(
  p_slide_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  slide_record public.dynamic_slides%rowtype;
  snapshot_data jsonb;
  content_hash text;
  target_snapshot_id uuid;
  snapshot_status text;
  job_id uuid;
  created_snapshot boolean := false;
begin
  select * into slide_record
  from public.dynamic_slides
  where id = p_slide_id
    and status <> 'archived';
  if not found then
    raise exception 'dynamic slide not found' using errcode = 'P0002';
  end if;
  if actor_id is null or not private.has_tenant_capability(
    slide_record.tenant_id,
    'tenant.dynamic_slide.write'
  ) then
    raise exception 'actor cannot refresh dynamic slide' using errcode = '42501';
  end if;

  snapshot_data := private.build_dynamic_snapshot_data(slide_record);
  if snapshot_data = '{}'::jsonb
    or (
      slide_record.slide_type = 'menu'
      and jsonb_array_length(snapshot_data #> '{menu,products}') = 0
    )
    or (
      slide_record.slide_type = 'news'
      and jsonb_array_length(snapshot_data #> '{news,articles}') = 0
    )
  then
    raise exception 'data source has no renderable content' using errcode = '23514';
  end if;

  content_hash := private.dynamic_snapshot_content_hash_v1(
    slide_record,
    snapshot_data
  );

  -- Prefer the current immutable snapshot when its canonical content is
  -- unchanged. This also bridges snapshots made before stable hashing.
  select snapshot.id, snapshot.status
  into target_snapshot_id, snapshot_status
  from public.dynamic_slide_snapshots snapshot
  where snapshot.id = slide_record.current_snapshot_id
    and snapshot.dynamic_slide_id = slide_record.id
    and snapshot.template_version_id = slide_record.template_version_id
    and private.dynamic_snapshot_content_hash_v1(
      slide_record,
      snapshot.snapshot_data_json
    ) = content_hash;

  if target_snapshot_id is null then
    select snapshot.id, snapshot.status
    into target_snapshot_id, snapshot_status
    from public.dynamic_slide_snapshots snapshot
    where snapshot.dynamic_slide_id = slide_record.id
      and snapshot.template_version_id = slide_record.template_version_id
      and snapshot.source_revision_hash = content_hash;
  end if;

  if target_snapshot_id is null then
    insert into public.dynamic_slide_snapshots(
      tenant_id,
      dynamic_slide_id,
      template_version_id,
      data_source_id,
      source_revision_hash,
      snapshot_data_json,
      created_by
    ) values (
      slide_record.tenant_id,
      slide_record.id,
      slide_record.template_version_id,
      slide_record.data_source_id,
      content_hash,
      snapshot_data,
      actor_id
    )
    returning id, status into target_snapshot_id, snapshot_status;
    insert into public.dynamic_render_jobs(tenant_id, snapshot_id)
    values (slide_record.tenant_id, target_snapshot_id)
    returning id into job_id;
    created_snapshot := true;
    update public.dynamic_slides
    set status = 'rendering',
        last_error_code = null,
        revision = revision + 1,
        updated_by = actor_id
    where id = slide_record.id;
    perform private.audit_event(
      slide_record.tenant_id,
      'dynamic.snapshot.created',
      'dynamic_slide_snapshots',
      target_snapshot_id,
      'success',
      jsonb_build_object('slideId', slide_record.id, 'jobId', job_id)
    );
  else
    select job.id into job_id
    from public.dynamic_render_jobs job
    where job.snapshot_id = target_snapshot_id;
  end if;

  return jsonb_build_object(
    'slideId', slide_record.id,
    'snapshotId', target_snapshot_id,
    'jobId', job_id,
    'status', case when created_snapshot then 'rendering' else snapshot_status end,
    'changed', created_snapshot
  );
end;
$$;

revoke all on function public.refresh_dynamic_slide_v1(uuid)
  from public, anon;
grant execute on function public.refresh_dynamic_slide_v1(uuid)
  to authenticated;

create or replace function public.complete_dynamic_render_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_storage_path text,
  p_file_size_bytes bigint,
  p_checksum_sha256 text,
  p_width integer,
  p_height integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.dynamic_render_jobs%rowtype;
  snapshot_record public.dynamic_slide_snapshots%rowtype;
  slide_record public.dynamic_slides%rowtype;
  expected_path text;
begin
  select * into job_record
  from public.dynamic_render_jobs
  where id = p_job_id
    and status = 'rendering'
    and locked_by = left(p_worker_id, 120)
  for update;
  if not found then
    raise exception 'dynamic render lease lost' using errcode = '55000';
  end if;
  select * into snapshot_record
  from public.dynamic_slide_snapshots
  where id = job_record.snapshot_id;
  select * into slide_record
  from public.dynamic_slides
  where id = snapshot_record.dynamic_slide_id;

  expected_path := 'tenants/' || job_record.tenant_id::text || '/assets/' ||
    job_record.output_media_asset_id::text || '/dynamic-slide.png';
  if p_storage_path <> expected_path
    or p_file_size_bytes not between 1 and 524288000
    or p_checksum_sha256 !~ '^[a-f0-9]{64}$'
    or p_width not between 360 and 7680
    or p_height not between 360 and 4320
  then
    raise exception 'invalid dynamic render artifact' using errcode = '22023';
  end if;

  insert into public.media_assets(
    id,
    tenant_id,
    created_by,
    kind,
    title,
    original_file_name,
    mime_type,
    status,
    storage_bucket,
    storage_path,
    file_size_bytes,
    checksum_sha256,
    width,
    height,
    processed_at
  ) values (
    job_record.output_media_asset_id,
    job_record.tenant_id,
    snapshot_record.created_by,
    'image',
    slide_record.name,
    'dynamic-slide.png',
    'image/png',
    'ready',
    'tenant-media',
    p_storage_path,
    p_file_size_bytes,
    p_checksum_sha256,
    p_width,
    p_height,
    now()
  ) on conflict (id) do nothing;

  if not exists (
    select 1
    from public.media_assets asset
    where asset.id = job_record.output_media_asset_id
      and asset.tenant_id = job_record.tenant_id
      and asset.kind = 'image'
      and asset.status = 'ready'
      and asset.storage_bucket = 'tenant-media'
      and asset.storage_path = p_storage_path
      and asset.mime_type = 'image/png'
      and asset.file_size_bytes = p_file_size_bytes
      and asset.checksum_sha256 = p_checksum_sha256
      and asset.width = p_width
      and asset.height = p_height
  ) then
    raise exception 'dynamic fallback identity collision' using errcode = '23514';
  end if;

  insert into public.media_variants(
    tenant_id,
    asset_id,
    variant_type,
    storage_bucket,
    storage_path,
    mime_type,
    file_size_bytes,
    checksum_sha256,
    width,
    height
  ) values (
    job_record.tenant_id,
    job_record.output_media_asset_id,
    'original',
    'tenant-media',
    p_storage_path,
    'image/png',
    p_file_size_bytes,
    p_checksum_sha256,
    p_width,
    p_height
  ) on conflict (tenant_id, asset_id, variant_type) do nothing;

  if not exists (
    select 1
    from public.media_variants variant
    where variant.tenant_id = job_record.tenant_id
      and variant.asset_id = job_record.output_media_asset_id
      and variant.variant_type = 'original'
      and variant.storage_bucket = 'tenant-media'
      and variant.storage_path = p_storage_path
      and variant.mime_type = 'image/png'
      and variant.file_size_bytes = p_file_size_bytes
      and variant.checksum_sha256 = p_checksum_sha256
      and variant.width = p_width
      and variant.height = p_height
  ) then
    raise exception 'dynamic fallback variant collision' using errcode = '23514';
  end if;

  update public.dynamic_slide_snapshots
  set status = 'ready',
      output_media_asset_id = job_record.output_media_asset_id,
      completed_at = now()
  where id = snapshot_record.id;
  update public.dynamic_render_jobs
  set status = 'completed',
      finished_at = now(),
      locked_at = null,
      locked_by = null
  where id = job_record.id;
  update public.dynamic_slides
  set status = 'ready',
      current_snapshot_id = snapshot_record.id,
      last_error_code = null
  where id = slide_record.id
    and (
      current_snapshot_id is null
      or selection_mode = 'latest'
      or current_snapshot_id = snapshot_record.id
    );
  insert into public.audit_events(
    tenant_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    result,
    metadata
  ) values (
    job_record.tenant_id,
    snapshot_record.created_by,
    'dynamic.render.completed',
    'dynamic_slide_snapshots',
    snapshot_record.id,
    'success',
    jsonb_build_object(
      'systemExecuted', true,
      'jobId', job_record.id,
      'mediaAssetId', job_record.output_media_asset_id,
      'checksum', p_checksum_sha256,
      'contentAddressed', true
    )
  );
  return job_record.output_media_asset_id;
end;
$$;

revoke all on function public.complete_dynamic_render_job_v1(
  uuid,
  text,
  text,
  bigint,
  text,
  integer,
  integer
) from public, anon, authenticated;
grant execute on function public.complete_dynamic_render_job_v1(
  uuid,
  text,
  text,
  bigint,
  text,
  integer,
  integer
) to service_role;
