-- S185 operational boundary: DB-owner only, explicit tenant scope and audit.
-- No JWT impersonation, grants to service_role, or tenant mutation on deployment.
CREATE OR REPLACE FUNCTION private.materialize_publication_configuration_v1(p_playlist_id uuid, p_release_notes text, p_system_context jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := private.current_user_id();
  playlist_record public.playlists%rowtype;
  draft_item_count integer;
  publishable_item_count integer;
  next_version integer;
  release_id uuid;
  release_published_at timestamptz := now();
  manifest_items jsonb;
  manifest_document jsonb;
  manifest_hash text;
  total_duration integer;
  total_bytes bigint;
begin
  if p_system_context is not null and (session_user not in ('postgres','supabase_admin')
    or coalesce(p_system_context->>'operator','') !~ '^github:[A-Za-z0-9-]{1,39}$'
    or coalesce(p_system_context->>'deploymentSha','') !~ '^[0-9a-f]{40}$'
    or length(coalesce(p_system_context->>'reason','')) not between 10 and 240) then
    raise exception 'system publication provenance is invalid' using errcode='42501';
  end if;
  if p_system_context is null and actor_id is null then
    raise exception 'publish_playlist requires an authenticated user'
      using errcode = '42501';
  end if;

  select playlist.* into playlist_record
  from public.playlists playlist
  where playlist.id = p_playlist_id
  for update;
  if not found then
    raise exception 'playlist not found' using errcode = 'P0002';
  end if;
  if playlist_record.status = 'archived'::public.playlist_status then
    raise exception 'archived playlists cannot be published' using errcode = '23514';
  end if;
  if p_system_context is null and not private.can_publish_playlist(playlist_record.tenant_id) then
    raise exception 'actor cannot publish this playlist' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(playlist_record.tenant_id);

  select count(*)::integer into draft_item_count
  from public.playlist_items item
  left join public.playlist_sections section
    on section.tenant_id = item.tenant_id
    and section.playlist_id = item.playlist_id
    and section.id = item.section_id
  where item.tenant_id = playlist_record.tenant_id
    and item.playlist_id = playlist_record.id
    and item.enabled
    and coalesce(section.enabled, true);
  if draft_item_count = 0 then
    raise exception 'playlist has no enabled items to publish' using errcode = '23514';
  end if;

  select
    count(*)::integer,
    coalesce(sum(item.duration_seconds), 0)::integer,
    coalesce(sum(variant.file_size_bytes), 0)::bigint,
    jsonb_agg(
      jsonb_build_object(
        'itemId', item.id,
        'mediaAssetId', asset.id,
        'mediaVariantId', variant.id,
        'kind', asset.kind,
        'title', asset.title,
        'durationSeconds', item.duration_seconds,
        'fitMode', item.fit_mode,
        'muted', item.muted,
        'storage', jsonb_build_object(
          'bucket', variant.storage_bucket,
          'path', variant.storage_path,
          'mimeType', variant.mime_type,
          'bytes', variant.file_size_bytes,
          'checksumSha256', variant.checksum_sha256
        ),
        'metadata', jsonb_build_object(
          'width', variant.width,
          'height', variant.height,
          'durationSeconds', variant.duration_seconds
        )
      )
      || jsonb_strip_nulls(jsonb_build_object(
        'displayTitle', item.display_title,
        'transition', item.transition,
        'cropFocus', jsonb_build_object(
          'x', item.crop_focus_x,
          'y', item.crop_focus_y
        ),
        'backgroundColor', item.background_color,
        'volumePercent', item.volume_percent,
        'trim', jsonb_strip_nulls(jsonb_build_object(
          'startSeconds', item.trim_start_seconds,
          'endSeconds', item.trim_end_seconds
        )),
        'visibility', jsonb_strip_nulls(jsonb_build_object(
          'from', item.visible_from,
          'until', item.visible_until
        )),
        'enabled', item.enabled,
        'accessibilityName', item.accessibility_name,
        'section', case
          when section.id is null then null
          else jsonb_build_object(
            'sourceSectionId', section.id,
            'name', section.name,
            'positionKey', section.position_key
          )
        end
      ))
      order by
        case when section.id is null then 0 else 1 end,
        section.position_key,
        item.position_key,
        item.id
    )
  into
    publishable_item_count,
    total_duration,
    total_bytes,
    manifest_items
  from public.playlist_items item
  join public.media_assets asset
    on asset.tenant_id = item.tenant_id
    and asset.id = item.media_asset_id
    and asset.status = 'ready'::public.media_asset_status
    and asset.deleted_at is null
  join public.media_variants variant
    on variant.tenant_id = item.tenant_id
    and variant.asset_id = item.media_asset_id
    and variant.variant_type = case
      when asset.kind = 'video'::public.media_asset_kind
        then 'player_1080p'::public.media_variant_type
      else 'original'::public.media_variant_type
    end
  left join public.playlist_sections section
    on section.tenant_id = item.tenant_id
    and section.playlist_id = item.playlist_id
    and section.id = item.section_id
  where item.tenant_id = playlist_record.tenant_id
    and item.playlist_id = playlist_record.id
    and item.enabled
    and coalesce(section.enabled, true);

  if publishable_item_count <> draft_item_count then
    raise exception 'playlist contains items without ready player variants'
      using errcode = '23514';
  end if;

  select coalesce(max(release.version), 0) + 1 into next_version
  from public.playlist_releases release
  where release.tenant_id = playlist_record.tenant_id
    and release.playlist_id = playlist_record.id;

  manifest_document := jsonb_build_object(
    'schemaVersion', 1,
    'playlistId', playlist_record.id,
    'tenantId', playlist_record.tenant_id,
    'version', next_version,
    'publishedAt', release_published_at,
    'totalDurationSeconds', total_duration,
    'totalBytes', total_bytes,
    'presentationDefaults', jsonb_strip_nulls(jsonb_build_object(
      'imageDurationSeconds', playlist_record.default_image_duration_seconds,
      'transition', playlist_record.default_transition,
      'fitMode', playlist_record.default_fit_mode,
      'backgroundColor', playlist_record.default_background_color,
      'videoMuted', playlist_record.default_video_muted,
      'loopEnabled', playlist_record.loop_enabled
    )),
    'items', manifest_items
  );
  manifest_hash := encode(
    extensions.digest(
      pg_catalog.convert_to(manifest_document::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  insert into public.playlist_releases (
    tenant_id,
    playlist_id,
    version,
    release_notes,
    manifest_hash,
    manifest_json,
    item_count,
    total_duration_seconds,
    total_bytes,
    published_by,
    published_at
  )
  values (
    playlist_record.tenant_id,
    playlist_record.id,
    next_version,
    nullif(btrim(p_release_notes), ''),
    manifest_hash,
    manifest_document,
    publishable_item_count,
    total_duration,
    total_bytes,
    actor_id,
    release_published_at
  )
  returning id into release_id;

  insert into public.playlist_release_items (
    tenant_id,
    playlist_id,
    release_id,
    source_item_id,
    media_asset_id,
    media_variant_id,
    sort_order,
    duration_seconds,
    fit_mode,
    muted,
    asset_kind,
    asset_title,
    storage_bucket,
    storage_path,
    mime_type,
    file_size_bytes,
    checksum_sha256,
    width,
    height,
    asset_duration_seconds
  )
  select
    playlist_record.tenant_id,
    playlist_record.id,
    release_id,
    item.id,
    asset.id,
    variant.id,
    (
      row_number() over (
        order by
          case when section.id is null then 0 else 1 end,
          section.position_key,
          item.position_key,
          item.id
      ) - 1
    )::integer,
    item.duration_seconds,
    item.fit_mode,
    item.muted,
    asset.kind,
    asset.title,
    variant.storage_bucket,
    variant.storage_path,
    variant.mime_type,
    variant.file_size_bytes,
    variant.checksum_sha256,
    variant.width,
    variant.height,
    variant.duration_seconds
  from public.playlist_items item
  join public.media_assets asset
    on asset.tenant_id = item.tenant_id
    and asset.id = item.media_asset_id
    and asset.status = 'ready'::public.media_asset_status
    and asset.deleted_at is null
  join public.media_variants variant
    on variant.tenant_id = item.tenant_id
    and variant.asset_id = item.media_asset_id
    and variant.variant_type = case
      when asset.kind = 'video'::public.media_asset_kind
        then 'player_1080p'::public.media_variant_type
      else 'original'::public.media_variant_type
    end
  left join public.playlist_sections section
    on section.tenant_id = item.tenant_id
    and section.playlist_id = item.playlist_id
    and section.id = item.section_id
  where item.tenant_id = playlist_record.tenant_id
    and item.playlist_id = playlist_record.id
    and item.enabled
    and coalesce(section.enabled, true)
  order by
    case when section.id is null then 0 else 1 end,
    section.position_key,
    item.position_key,
    item.id;

  update public.playlists
  set status = 'published'::public.playlist_status
  where id = playlist_record.id;

  if p_system_context is null then
  perform private.audit_event(
    playlist_record.tenant_id,
    'playlist.release.published',
    'playlist_releases',
    release_id,
    'success',
    jsonb_build_object(
      'playlistId', playlist_record.id,
      'version', next_version,
      'itemCount', publishable_item_count,
      'manifestHash', manifest_hash
    )
  );
  else
    insert into public.audit_events(tenant_id,action,target_type,target_id,result,metadata)
    values(playlist_record.tenant_id,'playlist.publication.system','playlist_releases',release_id,'success',
      p_system_context || jsonb_build_object('playlistId',playlist_record.id,'configRevision',next_version,
        'manifestHash',manifest_hash,'systemExecuted',true));
  end if;
  return release_id;
end;
$function$;

revoke all on function private.materialize_publication_configuration_v1(uuid,text,jsonb) from public,anon,authenticated,service_role;
-- The human path retains exactly its original authorization and audit contract.
create or replace function private.materialize_playlist_configuration_s185(p_playlist_id uuid,p_release_notes text default null)
returns uuid language sql security definer set search_path='' as $$
  select private.materialize_publication_configuration_v1(p_playlist_id,p_release_notes,null)
$$;
revoke all on function private.materialize_playlist_configuration_s185(uuid,text) from public,anon,authenticated,service_role;

create function private.used_playlist_ids_v1(p_tenant_id uuid)
returns table(playlist_id uuid) language sql stable security invoker set search_path='' as $$
  select screen.assigned_playlist_id from public.screens screen where screen.tenant_id=p_tenant_id and screen.deleted_at is null and screen.status<>'disabled'
  union select screen.default_playlist_id from public.screens screen where screen.tenant_id=p_tenant_id and screen.deleted_at is null and screen.status<>'disabled'
  union select screen_group.default_playlist_id from public.screen_groups screen_group where screen_group.tenant_id=p_tenant_id and screen_group.status='active'
  union select schedule.playlist_id from public.content_schedules schedule where schedule.tenant_id=p_tenant_id and
    ((schedule.enabled and (schedule.ends_at is null or schedule.ends_at>statement_timestamp())) or exists
      (select 1 from public.screens screen where screen.tenant_id=p_tenant_id and screen.active_schedule_id=schedule.id and screen.deleted_at is null))
$$;
revoke all on function private.used_playlist_ids_v1(uuid) from public,anon,authenticated,service_role;

create function private.cutover_current_publication_v1(p_tenant_id uuid,p_playlist_id uuid,
  p_expected_revision bigint,p_deployment_sha text,p_reason text,p_operator text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  playlist public.playlists%rowtype;
  publication public.playlist_publications%rowtype;
  hash text;
  new_release_id uuid;
  new_target_snapshot_id uuid;
  selected_screens uuid[];
  schedule public.content_schedules%rowtype;
  changed_screens integer:=0;
  changed_scheduled_screens integer:=0;
  affected_screens integer:=0;
  system_context jsonb:=jsonb_build_object('operator',p_operator,'reason',p_reason,'deploymentSha',p_deployment_sha);
begin
  if session_user not in ('postgres','supabase_admin') or p_operator is null or p_operator !~ '^github:[A-Za-z0-9-]{1,39}$'
    or p_deployment_sha is null or p_deployment_sha !~ '^[0-9a-f]{40}$' or length(coalesce(p_reason,'')) not between 10 and 240 then
    raise exception 'owner publication provenance required' using errcode='42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  select * into strict playlist from public.playlists where tenant_id=p_tenant_id and id=p_playlist_id for update;
  if playlist.revision<>p_expected_revision then raise exception 'draft changed during cutover' using errcode='40001'; end if;
  if not exists(select 1 from private.used_playlist_ids_v1(p_tenant_id) used where used.playlist_id=p_playlist_id) then
    raise exception 'playlist is outside the used target scope' using errcode='42501'; end if;
  if exists(select 1 from public.tenant_theme_rollouts where tenant_id=p_tenant_id and status in ('queued','rendering')) then
    raise exception 'wait for the active theme rollout' using errcode='55000'; end if;

  update public.playlist_items item set dynamic_snapshot_id=snapshot.id,media_asset_id=snapshot.output_media_asset_id
  from public.dynamic_slides slide join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id=slide.tenant_id and snapshot.id=slide.current_snapshot_id
  join public.dynamic_slide_versions version on version.tenant_id=snapshot.tenant_id and version.id=snapshot.dynamic_slide_version_id
  where item.tenant_id=p_tenant_id and item.playlist_id=p_playlist_id and item.dynamic_slide_id=slide.id and item.tenant_id=slide.tenant_id
    and item.dynamic_selection_mode='latest' and slide.selection_mode='latest' and version.status='published'
    and version.id=slide.current_published_version_id and snapshot.status='ready' and snapshot.output_media_asset_id is not null
    and item.dynamic_snapshot_id is distinct from snapshot.id;
  hash:=private.playlist_configuration_hash_v1(p_playlist_id);
  select * into publication from public.playlist_publications where tenant_id=p_tenant_id and playlist_id=p_playlist_id;
  if publication.definition_hash=hash then new_release_id:=publication.release_id;
  else
    new_release_id:=private.materialize_publication_configuration_v1(p_playlist_id,'Migratie naar actuele publicatie',system_context);
    update public.playlist_publications set definition_hash=hash where tenant_id=p_tenant_id and playlist_id=p_playlist_id;
    insert into public.playlist_release_authoring_snapshots(tenant_id,playlist_id,release_id,snapshot_json,snapshot_hash)
    select p_tenant_id,p_playlist_id,new_release_id,definition,
      encode(extensions.digest(convert_to(definition::text,'UTF8'),'sha256'),'hex')
    from (select private.build_playlist_authoring_snapshot(p_playlist_id) definition) authoring;
  end if;

  -- Lock before deriving any assignment, including the schedule/default pair.
  perform 1 from public.screens screen where screen.tenant_id=p_tenant_id and screen.deleted_at is null
    and (screen.default_playlist_id=p_playlist_id or screen.assigned_playlist_id=p_playlist_id)
    order by screen.id for update;
  update public.screens set default_release_id=new_release_id where tenant_id=p_tenant_id
    and default_playlist_id=p_playlist_id and deleted_at is null and status<>'disabled'
    and default_release_id is distinct from new_release_id;
  update public.screen_groups set default_release_id=new_release_id,revision=revision+1,updated_at=now()
    where tenant_id=p_tenant_id and default_playlist_id=p_playlist_id and status='active'
      and default_release_id is distinct from new_release_id;

  for schedule in select candidate.* from public.content_schedules candidate where candidate.tenant_id=p_tenant_id
    and candidate.playlist_id=p_playlist_id and candidate.release_id is distinct from new_release_id
    and ((candidate.enabled and (candidate.ends_at is null or candidate.ends_at>statement_timestamp())) or exists
      (select 1 from public.screens screen where screen.tenant_id=p_tenant_id and screen.active_schedule_id=candidate.id and screen.deleted_at is null))
    order by candidate.id for update
  loop
    if schedule.target_snapshot_id is null then raise exception 'schedule provenance unavailable' using errcode='55000'; end if;
    new_target_snapshot_id:=private.clone_theme_target_snapshot_v1(p_tenant_id,schedule.target_snapshot_id,new_release_id);
    update public.content_schedules set release_id=new_release_id,target_snapshot_id=new_target_snapshot_id,
      revision=revision+1,updated_at=now() where tenant_id=p_tenant_id and id=schedule.id;
    update public.screens set assigned_release_id=new_release_id,active_target_snapshot_id=new_target_snapshot_id
      where tenant_id=p_tenant_id and active_schedule_id=schedule.id and assigned_release_id=schedule.release_id and deleted_at is null;
    get diagnostics affected_screens=row_count;
    changed_scheduled_screens:=changed_scheduled_screens+affected_screens;
  end loop;

  select array_agg(screen.id order by screen.id) into selected_screens from public.screens screen
    where screen.tenant_id=p_tenant_id and screen.default_playlist_id=p_playlist_id
      and screen.active_assignment_source='default' and screen.active_schedule_id is null
      and screen.deleted_at is null and screen.status<>'disabled' and screen.assigned_release_id is distinct from new_release_id;
  if coalesce(array_length(selected_screens,1),0)>0 then
    new_target_snapshot_id:=private.create_publisher_target_snapshot(p_tenant_id,new_release_id,null,'direct',null,selected_screens,null);
    update public.screens set assigned_playlist_id=p_playlist_id,assigned_release_id=new_release_id,active_target_snapshot_id=new_target_snapshot_id
      where tenant_id=p_tenant_id and id=any(selected_screens);
    get diagnostics changed_screens=row_count;
    insert into public.release_screen_assignments(tenant_id,release_id,screen_id,assignment_kind,assigned_by,target_snapshot_id)
      select p_tenant_id,new_release_id,id,'published',null,new_target_snapshot_id from unnest(selected_screens) id;
  end if;
  changed_screens:=changed_screens+changed_scheduled_screens;
  update public.player_devices device set desired_release_id=screen.assigned_release_id
    from public.screens screen where screen.tenant_id=p_tenant_id and device.tenant_id=screen.tenant_id and device.screen_id=screen.id
      and device.status='paired' and screen.deleted_at is null and (screen.default_playlist_id=p_playlist_id or screen.assigned_playlist_id=p_playlist_id)
      and device.desired_release_id is distinct from screen.assigned_release_id;
  insert into public.audit_events(tenant_id,action,target_type,target_id,result,metadata)
    values(p_tenant_id,'playlist.publication.cutover','playlists',p_playlist_id,'success',system_context || jsonb_build_object(
      'previousReleaseId',publication.release_id,'releaseId',new_release_id,'changedScreenCount',changed_screens,'systemExecuted',true));
  return jsonb_build_object('playlistId',p_playlist_id,'previousReleaseId',publication.release_id,'releaseId',new_release_id,
    'configurationChanged',new_release_id is distinct from publication.release_id,'changedScreenCount',changed_screens);
end $$;
revoke all on function private.cutover_current_publication_v1(uuid,uuid,bigint,text,text,text) from public,anon,authenticated,service_role;

-- Operational requests use the existing leased source workers. No external
-- request, render, publication or invented user identity occurs in this call.
create function private.refresh_used_publication_sources_v1(p_tenant_id uuid,p_deployment_sha text,p_reason text,p_operator text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  source_ids uuid[];
  rss_count integer;
  policy_count integer;
begin
  if session_user not in ('postgres','supabase_admin') or coalesce(p_operator,'') !~ '^github:[A-Za-z0-9-]{1,39}$'
    or coalesce(p_deployment_sha,'') !~ '^[0-9a-f]{40}$' or length(coalesce(p_reason,'')) not between 10 and 240 then
    raise exception 'owner source refresh provenance required' using errcode='42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  select array_agg(distinct snapshot.data_source_id) into source_ids
  from public.dynamic_slide_snapshots snapshot where snapshot.tenant_id=p_tenant_id and (
    exists(select 1 from public.playlist_items item join private.used_playlist_ids_v1(p_tenant_id) used on used.playlist_id=item.playlist_id
      where item.tenant_id=p_tenant_id and item.dynamic_snapshot_id=snapshot.id)
    or exists(select 1 from public.playlist_release_items item join private.referenced_publication_releases_v1(p_tenant_id) referenced on referenced.release_id=item.release_id
      where item.tenant_id=p_tenant_id and item.dynamic_snapshot_id=snapshot.id));
  update public.dynamic_data_sources set next_sync_at=now()
    where tenant_id=p_tenant_id and id=any(source_ids) and kind='rss' and status='active'
      and provider_status<>'syncing' and (last_attempt_at is null or last_attempt_at<=now()-interval '15 minutes');
  get diagnostics rss_count=row_count;
  update public.sportlink_sync_policies policy set next_sync_at=now(),manual_cooldown_until=now()+interval '15 minutes'
    from public.sportlink_connections connection where policy.tenant_id=p_tenant_id and connection.tenant_id=policy.tenant_id
      and connection.id=policy.connection_id and connection.data_source_id=any(source_ids) and connection.status='active'
      and policy.enabled and (policy.manual_cooldown_until is null or policy.manual_cooldown_until<=now());
  get diagnostics policy_count=row_count;
  insert into public.audit_events(tenant_id,action,target_type,target_id,result,metadata)
    values(p_tenant_id,'publication.sources.refresh_requested','tenants',p_tenant_id,'success',jsonb_build_object(
      'deploymentSha',p_deployment_sha,'reason',p_reason,'operator',p_operator,'systemExecuted',true,
      'rssSources',rss_count,'sportlinkPolicies',policy_count));
  return jsonb_build_object('rssSources',rss_count,'sportlinkPolicies',policy_count,
    'note','Existing workers retain leases, cooldowns and last valid data; manual products and Twelve Excel retain their explicit import flow.');
end $$;
revoke all on function private.refresh_used_publication_sources_v1(uuid,text,text,text) from public,anon,authenticated,service_role;
