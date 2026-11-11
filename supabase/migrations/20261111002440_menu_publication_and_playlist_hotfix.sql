do $$
declare definition text;
begin
  select pg_get_functiondef('private.sites_configuration_is_valid_v1(jsonb)'::regprocedure) into definition;
  execute replace(definition,'FUNCTION private.sites_configuration_is_valid_v1(',
    'FUNCTION private.sites_configuration_before_hotfix_v1(');
end;
$$;
create or replace function private.sites_configuration_is_valid_v1(p_sites jsonb) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
begin
  return coalesce(case when p_sites ->> 'provider' = 'menu' then
    jsonb_typeof(p_sites -> 'rowsPerPage') = 'number'
    and (p_sites ->> 'rowsPerPage')::numeric >= 1
    and trunc((p_sites ->> 'rowsPerPage')::numeric) = (p_sites ->> 'rowsPerPage')::numeric
    and private.sites_configuration_before_hotfix_v1(jsonb_set(p_sites,'{rowsPerPage}','8'::jsonb))
  else private.sites_configuration_before_hotfix_v1(p_sites) end, false);
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end;
$$;
revoke all on function private.sites_configuration_is_valid_v1(jsonb),private.sites_configuration_before_hotfix_v1(jsonb) from public,anon,authenticated,service_role;

create or replace function private.finalize_dynamic_slide_version_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
declare version_id uuid;
begin
  if new.current_snapshot_id is null then return new; end if;
  select snapshot.dynamic_slide_version_id into version_id
  from public.dynamic_slide_snapshots snapshot
  join public.media_assets asset on asset.tenant_id = snapshot.tenant_id
    and asset.id = snapshot.output_media_asset_id and asset.status = 'ready' and asset.deleted_at is null
  where snapshot.id = new.current_snapshot_id and snapshot.tenant_id = new.tenant_id
    and snapshot.dynamic_slide_id = new.id and snapshot.status = 'ready'
    and exists (select 1 from public.media_variants variant where variant.tenant_id = asset.tenant_id
      and variant.asset_id = asset.id and variant.variant_type = 'original');
  if version_id is null or new.active_draft_version_id is distinct from version_id then return new; end if;
  update public.dynamic_slide_versions version
  set status = 'published', published_snapshot_id = new.current_snapshot_id,
      published_by = coalesce(version.published_by, new.updated_by),
      published_at = coalesce(version.published_at, now())
  where version.id = version_id and version.tenant_id = new.tenant_id and version.status = 'publishing';
  if found then
    update public.dynamic_slides slide
    set current_published_version_id = version_id, active_draft_version_id = null,
        menu_last_published_revision = case when slide.slide_type = 'price_list'
          then (slide.configuration_json ->> 'revision')::bigint else slide.menu_last_published_revision end
    where slide.id = new.id and slide.tenant_id = new.tenant_id;
  end if;
  return new;
end;
$$;
revoke all on function private.finalize_dynamic_slide_version_v1() from public, anon, authenticated, service_role;

do $$
declare definition text;
begin
  select pg_get_functiondef('public.publish_dynamic_slide_version_v1(uuid,uuid,bigint)'::regprocedure) into definition;
  execute replace(definition,'FUNCTION public.publish_dynamic_slide_version_v1(',
    'FUNCTION private.publish_dynamic_slide_version_before_hotfix_v1(');
end;
$$;
revoke all on function private.publish_dynamic_slide_version_before_hotfix_v1(uuid,uuid,bigint) from public,anon,authenticated,service_role;

create or replace function public.publish_dynamic_slide_version_v1(p_slide_id uuid,p_version_id uuid,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  slide public.dynamic_slides%rowtype;
  version public.dynamic_slide_versions%rowtype;
  snapshot public.dynamic_slide_snapshots%rowtype;
  result jsonb;
begin
  select * into slide from public.dynamic_slides where id = p_slide_id and status <> 'archived' for update;
  if slide.id is null or private.current_user_id() is null
    or not private.has_tenant_capability(slide.tenant_id,'tenant.dynamic_slide.write') then
    raise exception 'publication permission required' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(slide.tenant_id);
  select * into version from public.dynamic_slide_versions
  where id = p_version_id and tenant_id = slide.tenant_id and dynamic_slide_id = slide.id for update;
  if version.edit_revision is distinct from p_expected_revision then
    return jsonb_build_object('outcome','conflict','actualRevision',version.edit_revision);
  end if;
  if version.status = 'published' and slide.current_published_version_id = version.id then
    return jsonb_build_object('outcome','published','versionId',version.id,'snapshotId',version.published_snapshot_id);
  end if;
  result := private.publish_dynamic_slide_version_before_hotfix_v1(p_slide_id,p_version_id,p_expected_revision);
  if result ->> 'outcome' = 'conflict' then return result; end if;
  select * into snapshot from public.dynamic_slide_snapshots
  where tenant_id = slide.tenant_id and dynamic_slide_id = slide.id and dynamic_slide_version_id = version.id
    and not exists (select 1 from private.sync_dynamic_placement_variants placement
      where placement.tenant_id = slide.tenant_id and placement.snapshot_id = public.dynamic_slide_snapshots.id)
  order by snapshot_sequence desc, created_at desc limit 1;
  if snapshot.id is null or snapshot.status = 'failed' then
    result := result || public.refresh_dynamic_slide_v1(slide.id);
    return result || jsonb_build_object('versionId',version.id,'outcome','publishing');
  end if;
  if snapshot.status = 'ready' then
    update public.dynamic_slides set current_snapshot_id = snapshot.id, status = 'ready', last_error_code = null
    where id = slide.id and tenant_id = slide.tenant_id and active_draft_version_id = version.id;
  else
    update public.dynamic_render_jobs job
    set status = 'queued', attempt_count = 0, locked_at = null, locked_by = null, lease_token = null,
        started_at = null, finished_at = null, error_code = null, error_detail = null, updated_at = now()
    where job.tenant_id = slide.tenant_id and job.snapshot_id = snapshot.id
      and (job.status = 'failed' or (job.status = 'rendering' and job.locked_at < now() - interval '10 minutes'));
    if found then
      update public.dynamic_slide_snapshots set status = 'queued', error_code = null, error_detail = null, completed_at = null
      where id = snapshot.id and tenant_id = slide.tenant_id;
      update public.dynamic_slides set status = 'rendering', last_error_code = null
      where id = slide.id and tenant_id = slide.tenant_id and active_draft_version_id = version.id;
    end if;
  end if;
  select * into slide from public.dynamic_slides where id = p_slide_id;
  return result || jsonb_build_object('versionId',version.id,'snapshotId',snapshot.id,
    'outcome',case when slide.current_published_version_id = version.id and slide.active_draft_version_id is null then 'published' else 'publishing' end);
end;
$$;
revoke all on function public.publish_dynamic_slide_version_v1(uuid,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.publish_dynamic_slide_version_v1(uuid,uuid,bigint) to authenticated;

create function private.rebase_dynamic_placement_configuration_v1(p_previous jsonb,p_current jsonb,p_override jsonb)
returns jsonb language sql immutable security invoker set search_path = '' as $$
  select case when p_override is null or jsonb_typeof(p_previous) is distinct from 'object'
    or jsonb_typeof(p_current) is distinct from 'object' then p_override
  else p_current || coalesce((select jsonb_object_agg(setting.key,setting.value)
    from jsonb_each(p_override) setting
    where setting.key not in ('schemaVersion','rendererVersion','sourceRevision','orientation','provider','unifiedKind')
      and (setting.key = 'seconds' or setting.value is distinct from p_previous -> setting.key)), '{}'::jsonb) end;
$$;
revoke all on function private.rebase_dynamic_placement_configuration_v1(jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;

create or replace function private.clone_dynamic_publication_branch_v1(
  p_tenant_id uuid,
  p_version_id uuid,
  p_snapshot_id uuid,
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
    raise exception 'dynamic source release is unavailable' using errcode = 'P0002';
  end if;

  perform 1
  from public.playlists playlist
  where playlist.tenant_id = source_release.tenant_id
    and playlist.id = source_release.playlist_id
    and playlist.status <> 'archived'
  for update;
  if not found then
    return null;
  end if;

  if not exists (select 1 from public.playlist_publications publication
    where publication.tenant_id = p_tenant_id and publication.playlist_id = source_release.playlist_id
      and publication.release_id = source_release.id)
    or not exists (select 1 from public.dynamic_slides slide
      join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id = slide.tenant_id and snapshot.id = slide.current_snapshot_id
      where slide.tenant_id = p_tenant_id and slide.current_published_version_id = p_version_id
        and snapshot.id = p_snapshot_id and snapshot.status = 'ready') then return null; end if;

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

  select coalesce(jsonb_object_agg(item.sort_order::text,to_jsonb(p_snapshot_id)),'{}'::jsonb)
  into resolved_snapshot_by_sort_order
  from public.playlist_release_items item
  join public.dynamic_slide_snapshots previous on previous.id = item.dynamic_snapshot_id and previous.tenant_id = item.tenant_id
  join public.dynamic_slide_snapshots replacement on replacement.id = p_snapshot_id and replacement.tenant_id = item.tenant_id
    and replacement.dynamic_slide_id = previous.dynamic_slide_id
  where item.tenant_id = p_tenant_id and item.release_id = p_source_release_id
    and item.live_data_enabled and item.dynamic_snapshot_id <> p_snapshot_id
    and not exists (select 1 from private.sync_dynamic_placement_variants variant
      where variant.tenant_id = item.tenant_id and variant.snapshot_id = item.dynamic_snapshot_id);
  select count(*)::integer
  into replaced_item_count
  from public.playlist_release_items release_item
  where release_item.tenant_id = p_tenant_id
    and release_item.release_id = p_source_release_id
    and resolved_snapshot_by_sort_order ? release_item.sort_order::text;
  if replaced_item_count = 0 then return null; end if;

  if exists (
    select 1
    from public.playlist_release_items release_item
    left join public.dynamic_slide_snapshots replacement_snapshot
      on replacement_snapshot.tenant_id = release_item.tenant_id
     and replacement_snapshot.id = (resolved_snapshot_by_sort_order ->> release_item.sort_order::text)::uuid
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
      and resolved_snapshot_by_sort_order ? release_item.sort_order::text
      and (
        replacement_snapshot.id is null
        or replacement_asset.id is null
        or replacement_variant.id is null
      )
  ) then
    raise exception 'dynamic release replacement render is incomplete'
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
    raise exception 'dynamic release manifest could not be materialized'
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
    'Automatische update gepubliceerde slide',
    manifest_hash,
    manifest_document,
    source_release.item_count,
    source_release.total_duration_seconds,
    total_bytes,
    null,
    release_published_at
  ) returning id into new_release_id;

  insert into public.playlist_release_items
  select cloned.*
  from public.playlist_release_items release_item
  left join public.dynamic_slide_snapshots previous_snapshot
    on previous_snapshot.tenant_id = release_item.tenant_id and previous_snapshot.id = release_item.dynamic_snapshot_id
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
  cross join lateral jsonb_populate_record(null::public.playlist_release_items,
    to_jsonb(release_item) || jsonb_build_object(
      'id',gen_random_uuid(),'release_id',new_release_id,'source_item_id',null,'created_at',release_published_at,
      'media_asset_id',coalesce(replacement_asset.id,release_item.media_asset_id),
      'media_variant_id',coalesce(replacement_variant.id,release_item.media_variant_id),
      'asset_kind',coalesce(replacement_asset.kind,release_item.asset_kind),
      'asset_title',coalesce(replacement_asset.title,release_item.asset_title),
      'storage_bucket',coalesce(replacement_variant.storage_bucket,release_item.storage_bucket),
      'storage_path',coalesce(replacement_variant.storage_path,release_item.storage_path),
      'mime_type',coalesce(replacement_variant.mime_type,release_item.mime_type),
      'file_size_bytes',coalesce(replacement_variant.file_size_bytes,release_item.file_size_bytes),
      'checksum_sha256',coalesce(replacement_variant.checksum_sha256,release_item.checksum_sha256),
      'width',coalesce(replacement_variant.width,release_item.width),
      'height',coalesce(replacement_variant.height,release_item.height),
      'asset_duration_seconds',coalesce(replacement_variant.duration_seconds,release_item.asset_duration_seconds),
      'dynamic_snapshot_id',coalesce(replacement_snapshot.id,release_item.dynamic_snapshot_id),
      'sites_configuration_json',case when replacement_snapshot.id is null then release_item.sites_configuration_json
        else private.rebase_dynamic_placement_configuration_v1(
          coalesce(previous_snapshot.snapshot_data_json -> 'sitesConfiguration',
            previous_snapshot.snapshot_data_json #> '{menuDocument,sitesConfiguration}',
            previous_snapshot.snapshot_data_json #> '{priceList,menuDocument,sitesConfiguration}'),
          coalesce(replacement_snapshot.snapshot_data_json -> 'sitesConfiguration',
            replacement_snapshot.snapshot_data_json #> '{menuDocument,sitesConfiguration}',
            replacement_snapshot.snapshot_data_json #> '{priceList,menuDocument,sitesConfiguration}'),
          release_item.sites_configuration_json) end
    )) cloned
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

  insert into public.audit_events(tenant_id, action, target_type, target_id, result, metadata)
  values (
    p_tenant_id,
    'dynamic_slide.release_refreshed',
    'playlist_releases',
    new_release_id,
    'success',
    pg_catalog.jsonb_build_object(
      'systemExecuted', true,
      'versionId', p_version_id,
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
revoke all on function private.clone_dynamic_publication_branch_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function private.propagate_dynamic_publication_v1() returns trigger
language plpgsql security definer set search_path = '' as $$
declare publication record;
begin
  if new.current_published_version_id is null
    or new.current_published_version_id is not distinct from old.current_published_version_id then return new; end if;
  for publication in
    select current.release_id from public.playlist_publications current
    where current.tenant_id = new.tenant_id and exists (
      select 1 from public.playlist_release_items item
      join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id = item.tenant_id and snapshot.id = item.dynamic_snapshot_id
      where item.tenant_id = current.tenant_id and item.release_id = current.release_id
        and snapshot.dynamic_slide_id = new.id and item.live_data_enabled)
    order by current.playlist_id
  loop
    perform private.clone_dynamic_publication_branch_v1(new.tenant_id,new.current_published_version_id,new.current_snapshot_id,publication.release_id);
  end loop;
  return new;
end;
$$;
revoke all on function private.propagate_dynamic_publication_v1() from public,anon,authenticated,service_role;
create trigger dynamic_slides_propagate_publication after update of current_published_version_id on public.dynamic_slides
for each row execute function private.propagate_dynamic_publication_v1();

update public.dynamic_slides slide set current_snapshot_id = snapshot.id
from public.dynamic_slide_snapshots snapshot
join public.dynamic_slide_versions version on version.id = snapshot.dynamic_slide_version_id
  and version.tenant_id = snapshot.tenant_id and version.status = 'publishing'
join public.media_assets asset on asset.id = snapshot.output_media_asset_id and asset.tenant_id = snapshot.tenant_id
  and asset.status = 'ready' and asset.deleted_at is null
where slide.tenant_id = snapshot.tenant_id and slide.id = snapshot.dynamic_slide_id
  and slide.active_draft_version_id = version.id and slide.current_snapshot_id = snapshot.id
  and snapshot.status = 'ready';
