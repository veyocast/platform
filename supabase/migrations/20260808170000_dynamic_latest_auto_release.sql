-- S96: refresh RSS every five minutes, deduplicate unchanged provider data and
-- promote changed latest-mode snapshots through a new immutable release.

create or replace function private.deduplicate_rss_source_revision_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  content_revision_hash text;
begin
  if new.kind <> 'rss'
    or new.revision is not distinct from old.revision
    or new.last_successful_sync_at is not distinct from old.last_successful_sync_at
  then
    return new;
  end if;

  select encode(
    extensions.digest(
      pg_catalog.convert_to(
        jsonb_build_object(
          'articles', coalesce(jsonb_agg(
            jsonb_build_object(
              'externalId', article.external_id,
              'contentHash', article.content_hash,
              'heroMediaAssetId', article.hero_media_asset_id
            ) order by article.external_id
          ), '[]'::jsonb),
          'providerLogoMediaAssetId',
            new.config_json ->> 'providerLogoMediaAssetId'
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
  into content_revision_hash
  from public.dynamic_news_articles article
  where article.tenant_id = new.tenant_id
    and article.data_source_id = new.id;

  new.config_json := jsonb_set(
    new.config_json,
    '{contentRevisionHash}',
    to_jsonb(content_revision_hash),
    true
  );
  if old.config_json ->> 'contentRevisionHash' = content_revision_hash then
    new.revision := old.revision;
  end if;
  return new;
end;
$$;

revoke all on function private.deduplicate_rss_source_revision_v1()
  from public, anon, authenticated;

create or replace function private.default_rss_refresh_interval_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'rss' and not (new.config_json ? 'refreshMinutes') then
    new.config_json := jsonb_set(
      new.config_json,
      '{refreshMinutes}',
      '5'::jsonb,
      true
    );
  end if;
  return new;
end;
$$;

revoke all on function private.default_rss_refresh_interval_v1()
  from public, anon, authenticated;

drop trigger if exists dynamic_rss_source_defaults_refresh_interval
  on public.dynamic_data_sources;
create trigger dynamic_rss_source_defaults_refresh_interval
before insert on public.dynamic_data_sources
for each row execute function private.default_rss_refresh_interval_v1();

drop trigger if exists dynamic_rss_source_deduplicates_revision
  on public.dynamic_data_sources;
create trigger dynamic_rss_source_deduplicates_revision
before update of revision on public.dynamic_data_sources
for each row execute function private.deduplicate_rss_source_revision_v1();

update public.dynamic_data_sources source
set
  config_json = jsonb_set(source.config_json, '{refreshMinutes}', '5'::jsonb, true),
  next_sync_at = least(coalesce(source.next_sync_at, now()), now())
where source.kind = 'rss'
  and source.status = 'active';

create or replace function private.publish_latest_dynamic_snapshot_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  playlist_record public.playlists%rowtype;
  next_version integer;
  new_release_id uuid;
  release_published_at timestamptz;
  manifest_items jsonb;
  manifest_document jsonb;
  manifest_hash text;
  total_bytes bigint;
  active_screen_ids uuid[];
  target_snapshot_id uuid;
  replaced_item_count integer;
begin
  if new.selection_mode <> 'latest'
    or new.current_snapshot_id is null
    or new.current_snapshot_id is not distinct from old.current_snapshot_id
    or not exists (
      select 1
      from public.dynamic_slide_snapshots snapshot
      where snapshot.tenant_id = new.tenant_id
        and snapshot.id = new.current_snapshot_id
        and snapshot.status = 'ready'
        and snapshot.output_media_asset_id is not null
    )
  then
    return new;
  end if;

  for target in
    select distinct
      release.id,
      release.tenant_id,
      release.playlist_id,
      release.version,
      release.manifest_json,
      release.item_count,
      release.total_duration_seconds
    from public.screens screen
    join public.playlist_releases release
      on release.tenant_id = screen.tenant_id
      and release.id = screen.default_release_id
    join public.playlist_release_items release_item
      on release_item.tenant_id = release.tenant_id
      and release_item.release_id = release.id
    join public.dynamic_slide_snapshots released_snapshot
      on released_snapshot.tenant_id = release_item.tenant_id
      and released_snapshot.id = release_item.dynamic_snapshot_id
    join public.dynamic_slides slide
      on slide.tenant_id = released_snapshot.tenant_id
      and slide.id = released_snapshot.dynamic_slide_id
      and slide.selection_mode = 'latest'
    join public.tenants tenant
      on tenant.id = release.tenant_id
      and tenant.status = 'active'
    where screen.status <> 'disabled'
      and slide.id = new.id
  loop
    select playlist.* into playlist_record
    from public.playlists playlist
    where playlist.tenant_id = target.tenant_id
      and playlist.id = target.playlist_id
      and playlist.status <> 'archived'
    for update;
    if not found then
      continue;
    end if;

    if not exists (
      select 1
      from public.screens screen
      where screen.tenant_id = target.tenant_id
        and screen.default_playlist_id = target.playlist_id
        and screen.default_release_id = target.id
        and screen.status <> 'disabled'
    ) then
      continue;
    end if;

    if exists (
      select 1
      from public.playlist_release_items release_item
      join public.dynamic_slide_snapshots released_snapshot
        on released_snapshot.tenant_id = release_item.tenant_id
        and released_snapshot.id = release_item.dynamic_snapshot_id
      join public.dynamic_slides slide
        on slide.tenant_id = released_snapshot.tenant_id
        and slide.id = released_snapshot.dynamic_slide_id
        and slide.selection_mode = 'latest'
      join public.dynamic_slide_snapshots candidate_snapshot
        on candidate_snapshot.tenant_id = slide.tenant_id
        and candidate_snapshot.dynamic_slide_id = slide.id
      join public.dynamic_render_jobs render_job
        on render_job.tenant_id = candidate_snapshot.tenant_id
        and render_job.snapshot_id = candidate_snapshot.id
        and render_job.status in ('queued', 'rendering')
      where release_item.tenant_id = target.tenant_id
        and release_item.release_id = target.id
    ) then
      continue;
    end if;

    select count(*)::integer
    into replaced_item_count
    from public.playlist_release_items release_item
    join public.dynamic_slide_snapshots released_snapshot
      on released_snapshot.tenant_id = release_item.tenant_id
      and released_snapshot.id = release_item.dynamic_snapshot_id
    join public.dynamic_slides slide
      on slide.tenant_id = released_snapshot.tenant_id
      and slide.id = released_snapshot.dynamic_slide_id
      and slide.selection_mode = 'latest'
    join public.dynamic_slide_snapshots current_snapshot
      on current_snapshot.tenant_id = slide.tenant_id
      and current_snapshot.id = slide.current_snapshot_id
      and current_snapshot.status = 'ready'
      and current_snapshot.output_media_asset_id is not null
    where release_item.tenant_id = target.tenant_id
      and release_item.release_id = target.id
      and current_snapshot.id <> released_snapshot.id;
    if replaced_item_count = 0 then
      continue;
    end if;

    select
      jsonb_agg(
        case
          when current_snapshot.id is not null
            and current_snapshot.id <> released_snapshot.id
          then manifest_item.value || jsonb_build_object(
            'mediaAssetId', current_asset.id,
            'mediaVariantId', current_variant.id,
            'kind', current_asset.kind,
            'title', current_asset.title,
            'storage', jsonb_build_object(
              'bucket', current_variant.storage_bucket,
              'path', current_variant.storage_path,
              'mimeType', current_variant.mime_type,
              'bytes', current_variant.file_size_bytes,
              'checksumSha256', current_variant.checksum_sha256
            ),
            'metadata', coalesce(manifest_item.value -> 'metadata', '{}'::jsonb)
              || jsonb_strip_nulls(jsonb_build_object(
                'width', current_variant.width,
                'height', current_variant.height,
                'durationSeconds', current_variant.duration_seconds
              ))
          )
          else manifest_item.value
        end
        order by manifest_item.ordinality
      ),
      sum(
        case
          when current_snapshot.id is not null
            and current_snapshot.id <> released_snapshot.id
          then current_variant.file_size_bytes
          else release_item.file_size_bytes
        end
      )::bigint
    into manifest_items, total_bytes
    from jsonb_array_elements(target.manifest_json -> 'items')
      with ordinality as manifest_item(value, ordinality)
    join public.playlist_release_items release_item
      on release_item.tenant_id = target.tenant_id
      and release_item.release_id = target.id
      and release_item.sort_order = manifest_item.ordinality - 1
    left join public.dynamic_slide_snapshots released_snapshot
      on released_snapshot.tenant_id = release_item.tenant_id
      and released_snapshot.id = release_item.dynamic_snapshot_id
    left join public.dynamic_slides slide
      on slide.tenant_id = released_snapshot.tenant_id
      and slide.id = released_snapshot.dynamic_slide_id
      and slide.selection_mode = 'latest'
    left join public.dynamic_slide_snapshots current_snapshot
      on current_snapshot.tenant_id = slide.tenant_id
      and current_snapshot.id = slide.current_snapshot_id
      and current_snapshot.status = 'ready'
      and current_snapshot.output_media_asset_id is not null
    left join public.media_assets current_asset
      on current_asset.tenant_id = current_snapshot.tenant_id
      and current_asset.id = current_snapshot.output_media_asset_id
      and current_asset.status = 'ready'
      and current_asset.deleted_at is null
    left join public.media_variants current_variant
      on current_variant.tenant_id = current_asset.tenant_id
      and current_variant.asset_id = current_asset.id
      and current_variant.variant_type = 'original';

    if manifest_items is null or total_bytes is null then
      continue;
    end if;

    select coalesce(max(release.version), 0) + 1
    into next_version
    from public.playlist_releases release
    where release.tenant_id = target.tenant_id
      and release.playlist_id = target.playlist_id;
    release_published_at := now();
    manifest_document := target.manifest_json || jsonb_build_object(
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

    insert into public.playlist_releases (
      tenant_id, playlist_id, version, release_notes, manifest_hash,
      manifest_json, item_count, total_duration_seconds, total_bytes,
      published_by, published_at
    ) values (
      target.tenant_id, target.playlist_id, next_version,
      'Automatische dynamische vernieuwing', manifest_hash,
      manifest_document, target.item_count, target.total_duration_seconds,
      total_bytes, null, release_published_at
    ) returning id into new_release_id;

    insert into public.playlist_release_items (
      tenant_id, playlist_id, release_id, source_item_id,
      media_asset_id, media_variant_id, sort_order, duration_seconds,
      fit_mode, muted, asset_kind, asset_title, storage_bucket, storage_path,
      mime_type, file_size_bytes, checksum_sha256, width, height,
      asset_duration_seconds, dynamic_snapshot_id, display_title, transition,
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
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_asset.id else release_item.media_asset_id end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_variant.id else release_item.media_variant_id end,
      release_item.sort_order,
      release_item.duration_seconds,
      release_item.fit_mode,
      release_item.muted,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_asset.kind else release_item.asset_kind end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_asset.title else release_item.asset_title end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_variant.storage_bucket else release_item.storage_bucket end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_variant.storage_path else release_item.storage_path end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_variant.mime_type else release_item.mime_type end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_variant.file_size_bytes else release_item.file_size_bytes end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_variant.checksum_sha256 else release_item.checksum_sha256 end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_variant.width else release_item.width end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_variant.height else release_item.height end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_variant.duration_seconds
        else release_item.asset_duration_seconds end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_snapshot.id else release_item.dynamic_snapshot_id end,
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
    left join public.dynamic_slide_snapshots released_snapshot
      on released_snapshot.tenant_id = release_item.tenant_id
      and released_snapshot.id = release_item.dynamic_snapshot_id
    left join public.dynamic_slides slide
      on slide.tenant_id = released_snapshot.tenant_id
      and slide.id = released_snapshot.dynamic_slide_id
      and slide.selection_mode = 'latest'
    left join public.dynamic_slide_snapshots current_snapshot
      on current_snapshot.tenant_id = slide.tenant_id
      and current_snapshot.id = slide.current_snapshot_id
      and current_snapshot.status = 'ready'
      and current_snapshot.output_media_asset_id is not null
    left join public.media_assets current_asset
      on current_asset.tenant_id = current_snapshot.tenant_id
      and current_asset.id = current_snapshot.output_media_asset_id
      and current_asset.status = 'ready'
      and current_asset.deleted_at is null
    left join public.media_variants current_variant
      on current_variant.tenant_id = current_asset.tenant_id
      and current_variant.asset_id = current_asset.id
      and current_variant.variant_type = 'original'
    where release_item.tenant_id = target.tenant_id
      and release_item.release_id = target.id
    order by release_item.sort_order;

    insert into public.playlist_release_authoring_snapshots (
      tenant_id, playlist_id, release_id, snapshot_json, snapshot_hash
    )
    select
      snapshot.tenant_id, snapshot.playlist_id, new_release_id,
      snapshot.snapshot_json, snapshot.snapshot_hash
    from public.playlist_release_authoring_snapshots snapshot
    where snapshot.tenant_id = target.tenant_id
      and snapshot.release_id = target.id
    on conflict do nothing;

    select array_agg(screen.id order by screen.id)
    into active_screen_ids
    from public.screens screen
    where screen.tenant_id = target.tenant_id
      and screen.default_playlist_id = target.playlist_id
      and screen.default_release_id = target.id
      and screen.active_assignment_source = 'default'
      and screen.status <> 'disabled';

    update public.screens screen
    set default_release_id = new_release_id
    where screen.tenant_id = target.tenant_id
      and screen.default_playlist_id = target.playlist_id
      and screen.default_release_id = target.id
      and screen.status <> 'disabled';

    target_snapshot_id := null;
    if coalesce(array_length(active_screen_ids, 1), 0) > 0 then
      target_snapshot_id := private.create_publisher_target_snapshot(
        target.tenant_id,
        new_release_id,
        null,
        'direct',
        null,
        active_screen_ids,
        null
      );
      update public.screens screen
      set
        assigned_playlist_id = target.playlist_id,
        assigned_release_id = new_release_id,
        active_target_snapshot_id = target_snapshot_id
      where screen.tenant_id = target.tenant_id
        and screen.id = any(active_screen_ids);
      update public.player_devices device
      set desired_release_id = new_release_id
      where device.tenant_id = target.tenant_id
        and device.screen_id = any(active_screen_ids)
        and device.status = 'paired';
      insert into public.release_screen_assignments (
        tenant_id, release_id, screen_id, assignment_kind,
        assigned_by, target_snapshot_id
      )
      select
        target.tenant_id, new_release_id, screen_id, 'reassigned',
        null, target_snapshot_id
      from unnest(active_screen_ids) screen_id;
    end if;

    perform private.audit_event(
      target.tenant_id,
      'dynamic.release.auto_published',
      'playlist_releases',
      new_release_id,
      'success',
      jsonb_build_object(
        'systemExecuted', true,
        'playlistId', target.playlist_id,
        'baseReleaseId', target.id,
        'version', next_version,
        'replacedItemCount', replaced_item_count,
        'activeScreenCount', coalesce(array_length(active_screen_ids, 1), 0)
      )
    );
  end loop;
  return new;
end;
$$;

revoke all on function private.publish_latest_dynamic_snapshot_v1()
  from public, anon, authenticated;

drop trigger if exists dynamic_slide_auto_publishes_latest
  on public.dynamic_slides;
create trigger dynamic_slide_auto_publishes_latest
after update of current_snapshot_id on public.dynamic_slides
for each row execute function private.publish_latest_dynamic_snapshot_v1();

create or replace function public.poll_player_commands_v1(
  p_installation_credential_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_credential_hash text :=
    lower(nullif(btrim(p_installation_credential_hash), ''));
  installation_record public.player_installations%rowtype;
  command_record public.player_commands%rowtype;
  command_list jsonb := '[]'::jsonb;
begin
  if normalized_credential_hash is null
    or normalized_credential_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception 'invalid installation credential hash'
      using errcode = '23514';
  end if;

  select installation.*
  into installation_record
  from public.player_installations installation
  where installation.credential_hash = normalized_credential_hash
    and installation.status = 'active'
  for update;
  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_INSTALLATION_CREDENTIAL'
    );
  end if;

  update public.player_installations
  set last_seen_at = now()
  where id = installation_record.id;

  for command_record in
    update public.player_commands
    set failed_at = now(),
        failure_code = 'COMMAND_EXPIRED'
    where installation_id = installation_record.id
      and completed_at is null
      and failed_at is null
      and expires_at <= now()
    returning *
  loop
    perform private.audit_event(
      command_record.tenant_id,
      'player_command.expired',
      'screens',
      command_record.screen_id,
      'failed',
      jsonb_build_object(
        'commandId', command_record.id,
        'commandType', command_record.command_type
      )
    );
  end loop;

  for command_record in
    select command.*
    from public.player_commands command
    where command.installation_id = installation_record.id
      and command.completed_at is null
      and command.failed_at is null
      and command.created_at <= now()
      and command.expires_at > now()
    order by command.created_at
    limit 10
    for update skip locked
  loop
    if command_record.delivered_at is null then
      update public.player_commands
      set delivered_at = now()
      where id = command_record.id
      returning * into command_record;
      perform private.audit_event(
        command_record.tenant_id,
        'player_command.delivered',
        'screens',
        command_record.screen_id,
        'success',
        jsonb_build_object(
          'commandId', command_record.id,
          'commandType', command_record.command_type
        )
      );
    end if;

    command_list := command_list || jsonb_build_array(
      jsonb_build_object(
        'id', command_record.id,
        'nonce', command_record.nonce,
        'commandType', command_record.command_type,
        'payload', command_record.payload,
        'createdAt', command_record.created_at,
        'expiresAt', command_record.expires_at
      )
    );
  end loop;

  return jsonb_build_object('ok', true, 'commands', command_list);
end;
$$;

do $$
declare
  target record;
  command_id uuid;
begin
  for target in
    select
      installation.id as installation_id,
      device.id as device_id,
      device.tenant_id,
      device.screen_id
    from public.player_installations installation
    join public.player_devices device
      on device.id = installation.bound_device_id
      and device.status = 'paired'
    join public.screens screen
      on screen.tenant_id = device.tenant_id
      and screen.id = device.screen_id
      and screen.status <> 'disabled'
    join public.tenants tenant
      on tenant.id = device.tenant_id
      and tenant.status in ('active', 'paused')
    where installation.status = 'active'
      and coalesce(installation.last_seen_at, installation.updated_at)
        >= now() - interval '30 days'
      and not exists (
        select 1
        from public.player_commands command
        where command.installation_id = installation.id
          and command.command_type = 'RELOAD_PLAYER'
          and command.payload ->> 'reason' =
            'player-version-handshake-bootstrap'
          and command.completed_at is null
          and command.failed_at is null
      )
  loop
    insert into public.player_commands (
      tenant_id, installation_id, screen_id, device_id, command_type,
      payload, nonce, created_at, expires_at
    ) values (
      target.tenant_id,
      target.installation_id,
      target.screen_id,
      target.device_id,
      'RELOAD_PLAYER',
      '{"reason":"player-version-handshake-bootstrap"}'::jsonb,
      gen_random_uuid(),
      now() + interval '10 minutes',
      now() + interval '1 day 10 minutes'
    ) returning id into command_id;

    perform private.audit_event(
      target.tenant_id,
      'player_command.queued',
      'screens',
      target.screen_id,
      'success',
      jsonb_build_object(
        'commandId', command_id,
        'commandType', 'RELOAD_PLAYER',
        'systemExecuted', true,
        'reason', 'player-version-handshake-bootstrap',
        'notBefore', now() + interval '10 minutes'
      )
    );
  end loop;
end;
$$;
