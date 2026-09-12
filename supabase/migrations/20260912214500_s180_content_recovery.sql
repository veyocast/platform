-- Explicit owner operation after a verified deployment. Reuse the existing
-- render queue, immutable rollout mappings, publisher and device assignment
-- machinery. No public RPC or service-role grant, no new tables, no automatic
-- tenant mutation during deployment. Old releases and unpublished drafts stay
-- intact. Rollback: stop invoking this operation; old playback remains valid.
create function private.start_tenant_content_recovery_v1(
  p_tenant_id uuid,
  p_expected_theme_revision bigint,
  p_deployment_sha text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rollout_id uuid;
  snapshot_total integer;
  release_total integer;
begin
  if p_deployment_sha is null or p_deployment_sha !~ '^[0-9a-f]{40}$'
    or p_reason is null or length(btrim(p_reason)) not between 10 and 240
  then
    raise exception 'content recovery provenance is invalid' using errcode = '22023';
  end if;
  perform 1 from public.tenants
  where id = p_tenant_id and status = 'active' for update;
  if not found then
    raise exception 'active recovery tenant is unavailable' using errcode = 'P0002';
  end if;
  perform 1 from public.tenant_theme_profiles
  where tenant_id = p_tenant_id and theme_id = 'fieldflow'
    and revision = p_expected_theme_revision for update;
  if not found then
    raise exception 'tenant theme revision changed' using errcode = '40001';
  end if;
  if exists (select 1 from public.tenant_theme_rollouts
    where tenant_id = p_tenant_id and status in ('queued', 'rendering')) then
    raise exception 'tenant already has an active rollout' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.dynamic_slides slide
    left join public.dynamic_slide_snapshots snapshot
      on snapshot.tenant_id = slide.tenant_id and snapshot.id = slide.current_snapshot_id
    where slide.tenant_id = p_tenant_id and slide.status <> 'archived'
      and slide.current_published_version_id is not null
      and (snapshot.id is null or snapshot.status <> 'ready' or snapshot.output_media_asset_id is null)
  ) then
    raise exception 'published slide has no ready recovery baseline' using errcode = '55000';
  end if;

  insert into public.tenant_theme_rollouts(tenant_id, theme_id, settings_revision, status)
  values (p_tenant_id, 'fieldflow', p_expected_theme_revision, 'queued')
  returning id into v_rollout_id;

  with source_ids as materialized (
    select slide.current_snapshot_id as old_snapshot_id, true as advance_current
    from public.dynamic_slides slide
    where slide.tenant_id = p_tenant_id and slide.status <> 'archived'
      and slide.current_published_version_id is not null
    union all
    select item.dynamic_snapshot_id, false
    from private.theme_rollout_active_release_ids_v1(p_tenant_id) active
    join public.playlist_release_items item
      on item.tenant_id = p_tenant_id and item.release_id = active.release_id
    where item.dynamic_snapshot_id is not null
  ), collapsed as materialized (
    select old_snapshot_id, bool_or(advance_current) as advance_current
    from source_ids group by old_snapshot_id
  ), source_rows as materialized (
    select snapshot.id as old_snapshot_id, collapsed.advance_current,
      version.id as version_id,
      -- A published version supplies every design field. A mirrored draft on
      -- dynamic_slides must never leak into the refreshed production snapshot.
      pg_catalog.jsonb_populate_record(slide, pg_catalog.jsonb_build_object(
        'name', version.name, 'slide_type', version.slide_type,
        'orientation', version.orientation, 'template_id', version.template_id,
        'template_version_id', version.template_version_id,
        'data_source_id', version.data_source_id,
        'selection_mode', version.selection_mode,
        'configuration_json', version.configuration_json
      )) as hash_slide
    from collapsed
    join public.dynamic_slide_snapshots snapshot
      on snapshot.tenant_id = p_tenant_id and snapshot.id = collapsed.old_snapshot_id
      and snapshot.status = 'ready'
    join public.dynamic_slides slide
      on slide.tenant_id = p_tenant_id and slide.id = snapshot.dynamic_slide_id
    join public.dynamic_slide_versions version
      on version.tenant_id = p_tenant_id and version.dynamic_slide_id = slide.id
      and version.id = case when slide.status <> 'archived'
        then slide.current_published_version_id else snapshot.dynamic_slide_version_id end
      and version.status in ('published', 'archived')
  ), prepared as materialized (
    select source.*,
      private.apply_tenant_theme_to_snapshot_v1(p_tenant_id,
        private.build_dynamic_snapshot_data(source.hash_slide), v_rollout_id)
        || pg_catalog.jsonb_build_object('_veyocastContentRecovery',
          pg_catalog.jsonb_build_object('sourceSnapshotId', source.old_snapshot_id,
            'deploymentSha', p_deployment_sha)) as snapshot_data
    from source_rows source
  ), hashed as materialized (
    select prepared.*,
      private.dynamic_snapshot_content_hash_v1(hash_slide, snapshot_data) as content_hash
    from prepared
  ), inserted as (
    insert into public.dynamic_slide_snapshots(
      tenant_id, dynamic_slide_id, dynamic_slide_version_id,
      template_version_id, data_source_id, source_revision_hash, snapshot_data_json
    )
    select p_tenant_id, (hash_slide).id, version_id,
      (hash_slide).template_version_id, (hash_slide).data_source_id,
      content_hash, snapshot_data
    from hashed order by (hash_slide).id, old_snapshot_id
    returning id, dynamic_slide_id, source_revision_hash
  ), mappings as (
    insert into private.tenant_theme_rollout_snapshots(
      tenant_id, rollout_id, dynamic_slide_id, old_snapshot_id, new_snapshot_id, advance_current
    )
    select p_tenant_id, v_rollout_id, inserted.dynamic_slide_id,
      hashed.old_snapshot_id, inserted.id, hashed.advance_current
    from hashed join inserted on inserted.dynamic_slide_id = (hashed.hash_slide).id
      and inserted.source_revision_hash = hashed.content_hash
    returning new_snapshot_id
  ), jobs as (
    insert into public.dynamic_render_jobs(tenant_id, snapshot_id)
    select p_tenant_id, new_snapshot_id from mappings returning snapshot_id
  ) select count(*)::integer into snapshot_total from jobs;

  if snapshot_total <> (select count(*) from (
    select current_snapshot_id from public.dynamic_slides
    where tenant_id = p_tenant_id and status <> 'archived' and current_published_version_id is not null
    union
    select item.dynamic_snapshot_id
    from private.theme_rollout_active_release_ids_v1(p_tenant_id) active
    join public.playlist_release_items item on item.tenant_id = p_tenant_id and item.release_id = active.release_id
    where item.dynamic_snapshot_id is not null
  ) expected) then
    raise exception 'content recovery source is incomplete' using errcode = '55000';
  end if;

  insert into private.tenant_theme_rollout_release_branches(
    tenant_id, rollout_id, source_release_id
  ) select p_tenant_id, v_rollout_id, release_id
    from private.theme_rollout_active_release_ids_v1(p_tenant_id);
  get diagnostics release_total = row_count;

  update public.tenant_theme_rollouts set snapshot_count = snapshot_total,
    release_target_count = release_total, status = 'rendering'
  where tenant_id = p_tenant_id and id = v_rollout_id;
  insert into public.audit_events(tenant_id, action, target_type, target_id, result, metadata)
  values (p_tenant_id, 'tenant.content.recovery_queued',
    'tenant_theme_rollouts', v_rollout_id, 'success',
    pg_catalog.jsonb_build_object('systemExecuted', true,
      'deploymentSha', p_deployment_sha, 'reason', btrim(p_reason),
      'snapshotCount', snapshot_total, 'releaseTargetCount', release_total));
  -- No-image playlists also need an immutable successor on an explicit full
  -- recovery. If there are render jobs, the existing completion trigger waits
  -- for all of them before materializing the frozen release branches.
  if snapshot_total = 0 then
    perform private.process_theme_rollout_release_branches_v1(p_tenant_id, v_rollout_id);
  end if;
  return v_rollout_id;
end;
$$;
revoke all on function private.start_tenant_content_recovery_v1(uuid, bigint, text, text)
  from public, anon, authenticated, service_role;

-- Existing S153 materializer: extend the zero-replacement guard and write its
-- verified system audit directly, as other asynchronous publishers already do.
-- The user-only audit helper cannot run from a render-worker completion trigger.
create or replace function private.clone_theme_release_branch_v1(
  p_tenant_id uuid,
  p_rollout_id uuid,
  p_source_release_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_default_screen_ids uuid[];
  manifest_document jsonb;
  manifest_hash text;
  manifest_items jsonb;
  new_release_id uuid;
  next_version integer;
  new_target_snapshot_id uuid;
  release_published_at timestamptz := clock_timestamp();
  replaced_item_count integer;
  resolved_snapshot_by_sort_order jsonb;
  schedule_record public.content_schedules%rowtype;
  source_release public.playlist_releases%rowtype;
  switched_schedule_screen_ids uuid[];
  total_bytes bigint;
begin
  select * into source_release
  from public.playlist_releases release
  where release.tenant_id = p_tenant_id
    and release.id = p_source_release_id;
  if not found then
    raise exception 'theme source release is unavailable' using errcode = 'P0002';
  end if;

  -- Match manual Publisher ordering before deriving the next immutable version.
  perform 1
  from public.playlists playlist
  where playlist.tenant_id = source_release.tenant_id
    and playlist.id = source_release.playlist_id
    and playlist.status <> 'archived'
  for update;
  if not found then
    return null;
  end if;

  perform 1
  from public.screens screen
  where screen.tenant_id = p_tenant_id
    and screen.status <> 'disabled'
    and screen.deleted_at is null
    and (
      screen.assigned_release_id = p_source_release_id
      or screen.default_release_id = p_source_release_id
    )
  order by screen.id
  for update;
  perform 1
  from public.player_devices device
  join public.screens screen
    on screen.tenant_id = device.tenant_id
   and screen.id = device.screen_id
  where screen.tenant_id = p_tenant_id
    and screen.status <> 'disabled'
    and screen.deleted_at is null
    and screen.assigned_release_id = p_source_release_id
    and device.status = 'paired'
  order by device.id
  for update of device;
  perform 1
  from public.screen_groups screen_group
  where screen_group.tenant_id = p_tenant_id
    and screen_group.status = 'active'
    and screen_group.default_release_id = p_source_release_id
  order by screen_group.id
  for update;
  perform 1
  from public.content_schedules schedule
  where schedule.tenant_id = p_tenant_id
    and schedule.release_id = p_source_release_id
    and (
      (
        schedule.enabled
        and (
          schedule.ends_at is null
          or schedule.ends_at >= statement_timestamp()
        )
      )
      or exists (
        select 1
        from public.screens active_screen
        where active_screen.tenant_id = schedule.tenant_id
          and active_screen.active_schedule_id = schedule.id
          and active_screen.status <> 'disabled'
          and active_screen.deleted_at is null
      )
    )
  order by schedule.id
  for update;

  if not exists (
    select 1
    from private.theme_rollout_active_release_ids_v1(p_tenant_id) active_release
    where active_release.release_id = p_source_release_id
  ) then
    return null;
  end if;

  select coalesce(
    pg_catalog.jsonb_object_agg(
      release_item.sort_order::text,
      pg_catalog.to_jsonb(mapping.new_snapshot_id)
    ),
    '{}'::jsonb
  )
  into resolved_snapshot_by_sort_order
  from public.playlist_release_items release_item
  join private.tenant_theme_rollout_snapshots mapping
    on mapping.tenant_id = release_item.tenant_id
   and mapping.rollout_id = p_rollout_id
   and mapping.old_snapshot_id = release_item.dynamic_snapshot_id
  where release_item.tenant_id = p_tenant_id
    and release_item.release_id = p_source_release_id;

  select count(*)::integer
  into replaced_item_count
  from public.playlist_release_items release_item
  where release_item.tenant_id = p_tenant_id
    and release_item.release_id = p_source_release_id
    and resolved_snapshot_by_sort_order ? release_item.sort_order::text;
  -- Normal theme changes still skip an unchanged branch. Only an explicitly
  -- audited owner recovery may clone an asset-only release. A missing mapping
  -- on a dynamic release remains an error/no-op, never an incomplete publish.
  if replaced_item_count = 0 and not (
    not exists (select 1 from public.playlist_release_items item
      where item.tenant_id = p_tenant_id and item.release_id = p_source_release_id
        and item.dynamic_snapshot_id is not null)
    and exists (select 1 from private.tenant_theme_rollout_release_branches branch
      join public.audit_events audit on audit.tenant_id = branch.tenant_id
        and audit.target_id = branch.rollout_id
        and audit.action = 'tenant.content.recovery_queued'
      where branch.tenant_id = p_tenant_id and branch.rollout_id = p_rollout_id
        and branch.source_release_id = p_source_release_id)
  ) then
    return null;
  end if;

  if exists (
    select 1
    from public.playlist_release_items release_item
    join private.tenant_theme_rollout_snapshots mapping
      on mapping.tenant_id = release_item.tenant_id
     and mapping.rollout_id = p_rollout_id
     and mapping.old_snapshot_id = release_item.dynamic_snapshot_id
    left join public.dynamic_slide_snapshots replacement_snapshot
      on replacement_snapshot.tenant_id = mapping.tenant_id
     and replacement_snapshot.id = mapping.new_snapshot_id
     and replacement_snapshot.status = 'ready'
     and replacement_snapshot.output_media_asset_id is not null
    left join public.media_assets replacement_asset
      on replacement_asset.tenant_id = replacement_snapshot.tenant_id
     and replacement_asset.id = replacement_snapshot.output_media_asset_id
     and replacement_asset.status = 'ready'
     and replacement_asset.deleted_at is null
    left join public.media_variants replacement_variant
      on replacement_variant.tenant_id = replacement_asset.tenant_id
     and replacement_variant.asset_id = replacement_asset.id
     and replacement_variant.variant_type = 'original'
    where release_item.tenant_id = p_tenant_id
      and release_item.release_id = p_source_release_id
      and (
        replacement_snapshot.id is null
        or replacement_asset.id is null
        or replacement_variant.id is null
      )
  ) then
    raise exception 'theme release replacement render is incomplete'
      using errcode = '55000';
  end if;

  select
    pg_catalog.jsonb_agg(
      case
        when replacement_snapshot.id is not null
        then manifest_item.value || pg_catalog.jsonb_build_object(
          'mediaAssetId', replacement_asset.id,
          'mediaVariantId', replacement_variant.id,
          'kind', replacement_asset.kind,
          'title', replacement_asset.title,
          'storage', pg_catalog.jsonb_build_object(
            'bucket', replacement_variant.storage_bucket,
            'path', replacement_variant.storage_path,
            'mimeType', replacement_variant.mime_type,
            'bytes', replacement_variant.file_size_bytes,
            'checksumSha256', replacement_variant.checksum_sha256
          ),
          'metadata', coalesce(
            manifest_item.value -> 'metadata', '{}'::jsonb
          ) || pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
            'width', replacement_variant.width,
            'height', replacement_variant.height,
            'durationSeconds', replacement_variant.duration_seconds
          ))
        )
        else manifest_item.value
      end
      order by manifest_item.ordinality
    ),
    sum(
      case when replacement_snapshot.id is not null
        then replacement_variant.file_size_bytes
        else release_item.file_size_bytes
      end
    )::bigint
  into manifest_items, total_bytes
  from pg_catalog.jsonb_array_elements(source_release.manifest_json -> 'items')
    with ordinality as manifest_item(value, ordinality)
  join public.playlist_release_items release_item
    on release_item.tenant_id = source_release.tenant_id
   and release_item.release_id = source_release.id
   and release_item.sort_order = manifest_item.ordinality - 1
  left join public.dynamic_slide_snapshots replacement_snapshot
    on replacement_snapshot.tenant_id = release_item.tenant_id
   and replacement_snapshot.id = (
     resolved_snapshot_by_sort_order ->> release_item.sort_order::text
   )::uuid
   and replacement_snapshot.status = 'ready'
  left join public.media_assets replacement_asset
    on replacement_asset.tenant_id = replacement_snapshot.tenant_id
   and replacement_asset.id = replacement_snapshot.output_media_asset_id
   and replacement_asset.status = 'ready'
   and replacement_asset.deleted_at is null
  left join public.media_variants replacement_variant
    on replacement_variant.tenant_id = replacement_asset.tenant_id
   and replacement_variant.asset_id = replacement_asset.id
   and replacement_variant.variant_type = 'original';
  if manifest_items is null or total_bytes is null then
    raise exception 'theme release manifest could not be materialized'
      using errcode = '55000';
  end if;

  select coalesce(max(release.version), 0) + 1
  into next_version
  from public.playlist_releases release
  where release.tenant_id = source_release.tenant_id
    and release.playlist_id = source_release.playlist_id;
  manifest_document := source_release.manifest_json || pg_catalog.jsonb_build_object(
    'version', next_version,
    'publishedAt', release_published_at,
    'totalBytes', total_bytes,
    'items', manifest_items
  );
  manifest_hash := encode(
    extensions.digest(
      pg_catalog.convert_to(manifest_document::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  insert into public.playlist_releases(
    tenant_id, playlist_id, version, release_notes, manifest_hash,
    manifest_json, item_count, total_duration_seconds, total_bytes,
    published_by, published_at
  ) values (
    source_release.tenant_id,
    source_release.playlist_id,
    next_version,
    'Geforceerde FieldFlow-thema-uitrol',
    manifest_hash,
    manifest_document,
    source_release.item_count,
    source_release.total_duration_seconds,
    total_bytes,
    null,
    release_published_at
  ) returning id into new_release_id;

  insert into public.playlist_release_items(
    tenant_id, playlist_id, release_id, source_item_id,
    media_asset_id, media_variant_id, sort_order, duration_seconds,
    fit_mode, muted, asset_kind, asset_title, storage_bucket, storage_path,
    mime_type, file_size_bytes, checksum_sha256, width, height,
    asset_duration_seconds, dynamic_snapshot_id,
    youtube_source_id, youtube_video_id, youtube_title, youtube_online_only,
    engage_campaign_id, engage_public_id, engage_title, engage_question,
    display_title, transition,
    crop_focus_x, crop_focus_y, background_color, volume_percent,
    trim_start_seconds, trim_end_seconds, visible_from, visible_until,
    enabled, accessibility_name, section_source_id, section_name,
    section_position_key
  )
  select
    release_item.tenant_id,
    release_item.playlist_id,
    new_release_id,
    null,
    coalesce(replacement_asset.id, release_item.media_asset_id),
    coalesce(replacement_variant.id, release_item.media_variant_id),
    release_item.sort_order,
    release_item.duration_seconds,
    release_item.fit_mode,
    release_item.muted,
    coalesce(replacement_asset.kind, release_item.asset_kind),
    coalesce(replacement_asset.title, release_item.asset_title),
    coalesce(replacement_variant.storage_bucket, release_item.storage_bucket),
    coalesce(replacement_variant.storage_path, release_item.storage_path),
    coalesce(replacement_variant.mime_type, release_item.mime_type),
    coalesce(replacement_variant.file_size_bytes, release_item.file_size_bytes),
    coalesce(replacement_variant.checksum_sha256, release_item.checksum_sha256),
    coalesce(replacement_variant.width, release_item.width),
    coalesce(replacement_variant.height, release_item.height),
    coalesce(
      replacement_variant.duration_seconds,
      release_item.asset_duration_seconds
    ),
    coalesce(replacement_snapshot.id, release_item.dynamic_snapshot_id),
    release_item.youtube_source_id,
    release_item.youtube_video_id,
    release_item.youtube_title,
    release_item.youtube_online_only,
    release_item.engage_campaign_id,
    release_item.engage_public_id,
    release_item.engage_title,
    release_item.engage_question,
    release_item.display_title,
    release_item.transition,
    release_item.crop_focus_x,
    release_item.crop_focus_y,
    release_item.background_color,
    release_item.volume_percent,
    release_item.trim_start_seconds,
    release_item.trim_end_seconds,
    release_item.visible_from,
    release_item.visible_until,
    release_item.enabled,
    release_item.accessibility_name,
    release_item.section_source_id,
    release_item.section_name,
    release_item.section_position_key
  from public.playlist_release_items release_item
  left join public.dynamic_slide_snapshots replacement_snapshot
    on replacement_snapshot.tenant_id = release_item.tenant_id
   and replacement_snapshot.id = (
     resolved_snapshot_by_sort_order ->> release_item.sort_order::text
   )::uuid
   and replacement_snapshot.status = 'ready'
  left join public.media_assets replacement_asset
    on replacement_asset.tenant_id = replacement_snapshot.tenant_id
   and replacement_asset.id = replacement_snapshot.output_media_asset_id
   and replacement_asset.status = 'ready'
   and replacement_asset.deleted_at is null
  left join public.media_variants replacement_variant
    on replacement_variant.tenant_id = replacement_asset.tenant_id
   and replacement_variant.asset_id = replacement_asset.id
   and replacement_variant.variant_type = 'original'
  where release_item.tenant_id = source_release.tenant_id
    and release_item.release_id = source_release.id
  order by release_item.sort_order;

  insert into public.playlist_release_authoring_snapshots(
    tenant_id, playlist_id, release_id, snapshot_json, snapshot_hash
  )
  select
    snapshot.tenant_id,
    snapshot.playlist_id,
    new_release_id,
    snapshot.snapshot_json,
    snapshot.snapshot_hash
  from public.playlist_release_authoring_snapshots snapshot
  where snapshot.tenant_id = source_release.tenant_id
    and snapshot.release_id = source_release.id
  on conflict do nothing;

  -- Defaults are independent from a currently active schedule assignment.
  update public.screens screen
  set default_release_id = new_release_id
  where screen.tenant_id = p_tenant_id
    and screen.default_playlist_id = source_release.playlist_id
    and screen.default_release_id = source_release.id
    and screen.status <> 'disabled'
    and screen.deleted_at is null;
  update public.screen_groups screen_group
  set default_release_id = new_release_id,
      revision = screen_group.revision + 1,
      updated_at = now()
  where screen_group.tenant_id = p_tenant_id
    and screen_group.default_playlist_id = source_release.playlist_id
    and screen_group.default_release_id = source_release.id
    and screen_group.status = 'active';

  -- A schedule keeps its exact immutable target set and provenance. Only its
  -- immutable release pointer and target snapshot are superseded.
  for schedule_record in
    select schedule.*
    from public.content_schedules schedule
    where schedule.tenant_id = p_tenant_id
      and schedule.release_id = source_release.id
      and (
        (
          schedule.enabled
          and (
            schedule.ends_at is null
            or schedule.ends_at >= statement_timestamp()
          )
        )
        or exists (
          select 1
          from public.screens active_screen
          where active_screen.tenant_id = schedule.tenant_id
            and active_screen.active_schedule_id = schedule.id
            and active_screen.status <> 'disabled'
            and active_screen.deleted_at is null
        )
      )
    order by schedule.id
    for update
  loop
    if schedule_record.target_snapshot_id is null then
      raise exception 'active schedule target snapshot is unavailable'
        using errcode = '55000';
    end if;
    new_target_snapshot_id := private.clone_theme_target_snapshot_v1(
      p_tenant_id,
      schedule_record.target_snapshot_id,
      new_release_id
    );
    update public.content_schedules schedule
    set playlist_id = source_release.playlist_id,
        release_id = new_release_id,
        target_snapshot_id = new_target_snapshot_id,
        revision = schedule.revision + 1,
        updated_at = now()
    where schedule.tenant_id = p_tenant_id
      and schedule.id = schedule_record.id
      and schedule.release_id = source_release.id
      and schedule.target_snapshot_id = schedule_record.target_snapshot_id;

    select pg_catalog.array_agg(screen.id order by screen.id)
    into switched_schedule_screen_ids
    from public.screens screen
    where screen.tenant_id = p_tenant_id
      and screen.active_schedule_id = schedule_record.id
      and screen.assigned_release_id = source_release.id
      and screen.status <> 'disabled'
      and screen.deleted_at is null;
    if coalesce(pg_catalog.array_length(switched_schedule_screen_ids, 1), 0) > 0
    then
      update public.screens screen
      set assigned_playlist_id = source_release.playlist_id,
          assigned_release_id = new_release_id,
          active_target_snapshot_id = new_target_snapshot_id
      where screen.tenant_id = p_tenant_id
        and screen.id = any(switched_schedule_screen_ids)
        and screen.active_schedule_id = schedule_record.id
        and screen.assigned_release_id = source_release.id;
      update public.player_devices device
      set desired_release_id = new_release_id
      where device.tenant_id = p_tenant_id
        and device.screen_id = any(switched_schedule_screen_ids)
        and device.status = 'paired'
        and device.desired_release_id = source_release.id;
      insert into public.release_screen_assignments(
        tenant_id, release_id, screen_id, assignment_kind,
        assigned_by, target_snapshot_id
      )
      select
        p_tenant_id,
        new_release_id,
        screen_id,
        'scheduled',
        null,
        new_target_snapshot_id
      from unnest(switched_schedule_screen_ids) screen_id;
    end if;
  end loop;

  select pg_catalog.array_agg(screen.id order by screen.id)
  into active_default_screen_ids
  from public.screens screen
  where screen.tenant_id = p_tenant_id
    and screen.assigned_release_id = source_release.id
    and screen.active_assignment_source = 'default'
    and screen.active_schedule_id is null
    and screen.status <> 'disabled'
    and screen.deleted_at is null;
  if coalesce(pg_catalog.array_length(active_default_screen_ids, 1), 0) > 0 then
    new_target_snapshot_id := private.create_publisher_target_snapshot(
      p_tenant_id,
      new_release_id,
      null,
      'direct',
      null,
      active_default_screen_ids,
      null
    );
    update public.screens screen
    set assigned_playlist_id = source_release.playlist_id,
        assigned_release_id = new_release_id,
        active_target_snapshot_id = new_target_snapshot_id
    where screen.tenant_id = p_tenant_id
      and screen.id = any(active_default_screen_ids)
      and screen.assigned_release_id = source_release.id
      and screen.active_assignment_source = 'default'
      and screen.active_schedule_id is null;
    update public.player_devices device
    set desired_release_id = new_release_id
    where device.tenant_id = p_tenant_id
      and device.screen_id = any(active_default_screen_ids)
      and device.status = 'paired'
      and device.desired_release_id = source_release.id;
    insert into public.release_screen_assignments(
      tenant_id, release_id, screen_id, assignment_kind,
      assigned_by, target_snapshot_id
    )
    select
      p_tenant_id,
      new_release_id,
      screen_id,
      'reassigned',
      null,
      new_target_snapshot_id
    from unnest(active_default_screen_ids) screen_id;
  end if;

  insert into private.tenant_theme_rollout_releases(
    tenant_id, rollout_id, release_id
  ) values (p_tenant_id, p_rollout_id, new_release_id)
  on conflict do nothing;

  insert into public.audit_events(tenant_id, action, target_type, target_id, result, metadata)
  values (
    p_tenant_id,
    'tenant.theme.release_cloned',
    'playlist_releases',
    new_release_id,
    'success',
    pg_catalog.jsonb_build_object(
      'systemExecuted', true,
      'rolloutId', p_rollout_id,
      'sourceReleaseId', source_release.id,
      'playlistId', source_release.playlist_id,
      'version', next_version,
      'replacedItemCount', replaced_item_count,
      'activeReleasePreserved', true
    )
  );
  return new_release_id;
end;
$$;

revoke all on function private.clone_theme_release_branch_v1(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;

-- A real database-owner diagnostic can exercise the existing synthetic event
-- pipeline without impersonating a tenant user or borrowing a connector lease.
-- PostgREST sessions (authenticator), SET ROLE and all JWT roles are excluded.
-- Public/worker dispatch permissions and every validation/rate limit stay intact.
do $migration$
declare definition text; needle text := $needle$  elsif p_event_kind = 'synthetic_test' then
    perform private.require_ledscores_capability($needle$;
begin
  select pg_get_functiondef('private.dispatch_ledscores_goal_v2(uuid,text,text,text,text,text,text,integer,integer,integer,integer,text,text,text,timestamptz,text,uuid,text,text,uuid,uuid,text,text)'::regprocedure)
    into definition;
  if position(needle in definition) = 0 then
    raise exception 'unexpected goal dispatcher authorization definition';
  end if;
  definition := replace(definition, needle, $replacement$  elsif p_event_kind = 'synthetic_test'
    and session_user = 'postgres'
    and coalesce(current_setting('role', true), 'none') in ('none', 'postgres')
    and coalesce(auth.role(), '') = ''
    and p_worker_id ~ '^operator-test:[0-9a-f]{40}$'
    and p_alert_id is not null and p_test_group_id is not null
  then
    -- Scope is checked again here, including calls outside the owner wrapper.
    if not exists (
      select 1 from public.ledscores_goal_alerts a
      join public.ledscores_goal_overlay_version_teams t
        on t.tenant_id = a.tenant_id and t.alert_version_id = a.current_published_version_id
      join public.ledscores_goal_alert_version_groups g
        on g.tenant_id = a.tenant_id and g.alert_version_id = a.current_published_version_id
      where a.tenant_id = connection_record.tenant_id and a.id = p_alert_id
        and a.status = 'published' and a.is_central_goal_overlay
        and exists (select 1 from public.tenants tenant where tenant.id = a.tenant_id and tenant.status = 'active')
        and t.connection_id = p_connection_id and t.provider_team_key = resolved_scoring_team_key
        and t.selected and g.screen_group_id = p_test_group_id
    ) then
      raise exception 'operator test team or group not published' using errcode = '23514';
    end if;
  elsif p_event_kind = 'synthetic_test' then
    perform private.require_ledscores_capability($replacement$);
  execute definition;
end;
$migration$;

-- Historical configurations omit this option; new values must be explicit booleans.
do $migration$
declare definition text; needle text := '  foreach key in array array[''showScorer''';
begin
  select pg_get_functiondef('private.validate_goal_overlay_v2(uuid,jsonb)'::regprocedure) into definition;
  if position(needle in definition) = 0 then raise exception 'unexpected goal validator'; end if;
  execute replace(definition, needle, $validation$  if p_config ? 'introAllowOrientationFallback'
    and jsonb_typeof(p_config->'introAllowOrientationFallback') is distinct from 'boolean' then
    raise exception 'invalid goal orientation fallback' using errcode = '23514';
  end if;
  foreach key in array array['showScorer'$validation$);
end;
$migration$;

create function private.run_ledscores_operator_test_v1(
  p_tenant_id uuid, p_alert_id uuid, p_connection_id uuid, p_team_key text,
  p_group_id uuid, p_deployment_sha text, p_reason text, p_side text default 'home'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare team_name text; outcome jsonb;
begin
  if session_user <> 'postgres'
    or coalesce(current_setting('role', true), 'none') not in ('none', 'postgres')
    or coalesce(auth.role(), '') <> '' then
    raise exception 'direct database owner required' using errcode = '42501';
  end if;
  if p_deployment_sha is null or p_deployment_sha !~ '^[0-9a-f]{40}$'
    or p_reason is null or length(btrim(p_reason)) not between 10 and 240
    or p_side is null or p_side not in ('home', 'away') then
    raise exception 'invalid operator test provenance' using errcode = '22023';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id and status = 'active') then
    raise exception 'active operator test tenant unavailable' using errcode = 'P0002';
  end if;
  select t.team_name into team_name
  from public.ledscores_goal_alerts a
  join public.ledscores_goal_overlay_version_teams t
    on t.tenant_id = a.tenant_id and t.alert_version_id = a.current_published_version_id
  join public.ledscores_goal_alert_version_groups g
    on g.tenant_id = a.tenant_id and g.alert_version_id = a.current_published_version_id
  where a.tenant_id = p_tenant_id and a.id = p_alert_id
    and a.status = 'published' and a.is_central_goal_overlay
    and t.connection_id = p_connection_id and t.provider_team_key = p_team_key
    and t.selected and g.screen_group_id = p_group_id;
  if not found then
    raise exception 'operator test team or group not published' using errcode = '23514';
  end if;
  outcome := private.dispatch_ledscores_goal_v2(
    p_connection_id, 'operator-test:' || p_deployment_sha,
    encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'),
    'operator-test:' || p_deployment_sha, gen_random_uuid()::text,
    case when p_side = 'home' then team_name else 'Testtegenstander' end,
    case when p_side = 'away' then team_name else 'Testtegenstander' end,
    1, 1, case when p_side = 'home' then 2 else 1 end,
    case when p_side = 'away' then 2 else 1 end, 'own', 'Videotest', '67',
    clock_timestamp(), 'synthetic_test', p_alert_id, p_side, p_team_key, p_group_id
  );
  insert into public.audit_events(tenant_id, action, target_type, target_id, result, metadata)
  values (p_tenant_id, 'ledscores.operator.synthetic_test', 'ledscores_goal_events',
    (outcome ->> 'eventId')::uuid, 'success', jsonb_build_object(
      'systemExecuted', true, 'deploymentSha', p_deployment_sha, 'reason', btrim(p_reason),
      'alertId', p_alert_id, 'groupId', p_group_id, 'deliveryCount', outcome -> 'deliveryCount'));
  return outcome;
end;
$$;
revoke all on function private.run_ledscores_operator_test_v1(uuid,uuid,uuid,text,uuid,text,text,text)
  from public, anon, authenticated, service_role;
