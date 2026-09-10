-- S166: provider syncs must be content driven, and explicit playlist deletion
-- must clean its live pointers and immutable release dependants atomically.

create or replace function private.deduplicate_sportlink_source_revision_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  content_revision_hash text;
begin
  if new.kind <> 'sportlink'
    or new.revision is not distinct from old.revision
    or new.last_successful_sync_at is not distinct from old.last_successful_sync_at
  then
    return new;
  end if;

  select encode(
    extensions.digest(
      pg_catalog.convert_to(
        jsonb_build_object(
          'clubs', coalesce((select jsonb_agg(
            to_jsonb(row) - array['first_synced_at','last_synced_at']
            order by row.id
          ) from public.sports_clubs row
          where row.tenant_id = new.tenant_id
            and row.source_connection_id in (
              select connection.id from public.sportlink_connections connection
              where connection.tenant_id = new.tenant_id
                and connection.data_source_id = new.id
            )), '[]'::jsonb),
          'teams', coalesce((select jsonb_agg(
            to_jsonb(row) - array['first_synced_at','last_synced_at']
            order by row.id
          ) from public.sports_teams row
          where row.tenant_id = new.tenant_id
            and row.source_connection_id in (
              select connection.id from public.sportlink_connections connection
              where connection.tenant_id = new.tenant_id
                and connection.data_source_id = new.id
            )), '[]'::jsonb),
          'matches', coalesce((select jsonb_agg(
            to_jsonb(row) - array['first_synced_at','last_synced_at']
            order by row.id
          ) from public.sports_matches row
          where row.tenant_id = new.tenant_id
            and row.source_connection_id in (
              select connection.id from public.sportlink_connections connection
              where connection.tenant_id = new.tenant_id
                and connection.data_source_id = new.id
            )), '[]'::jsonb),
          'standings', coalesce((select jsonb_agg(
            to_jsonb(row) - array['first_synced_at','last_synced_at']
            order by row.id
          ) from public.sports_standings row
          where row.tenant_id = new.tenant_id
            and row.source_connection_id in (
              select connection.id from public.sportlink_connections connection
              where connection.tenant_id = new.tenant_id
                and connection.data_source_id = new.id
            )), '[]'::jsonb),
          'activities', coalesce((select jsonb_agg(
            to_jsonb(row) - array['first_synced_at','last_synced_at']
            order by row.id
          ) from public.sports_activities row
          where row.tenant_id = new.tenant_id
            and row.source_connection_id in (
              select connection.id from public.sportlink_connections connection
              where connection.tenant_id = new.tenant_id
                and connection.data_source_id = new.id
            )), '[]'::jsonb),
          'people', coalesce((select jsonb_agg(
            to_jsonb(row) - array['first_synced_at','last_synced_at']
            order by row.id
          ) from public.sports_public_people row
          where row.tenant_id = new.tenant_id
            and row.source_connection_id in (
              select connection.id from public.sportlink_connections connection
              where connection.tenant_id = new.tenant_id
                and connection.data_source_id = new.id
            )), '[]'::jsonb),
          'teamMembers', coalesce((select jsonb_agg(
            to_jsonb(row) - array['created_at','updated_at','last_synced_at']
            order by row.id
          ) from public.sportlink_team_members row
          where row.tenant_id = new.tenant_id
            and row.connection_id in (
              select connection.id from public.sportlink_connections connection
              where connection.tenant_id = new.tenant_id
                and connection.data_source_id = new.id
            )), '[]'::jsonb),
          'birthdays', coalesce((select jsonb_agg(
            to_jsonb(row) - array['created_at','updated_at','last_synced_at']
            order by row.id
          ) from public.sportlink_birthdays row
          where row.tenant_id = new.tenant_id
            and row.connection_id in (
              select connection.id from public.sportlink_connections connection
              where connection.tenant_id = new.tenant_id
                and connection.data_source_id = new.id
            )), '[]'::jsonb)
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ) into content_revision_hash;

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

revoke all on function private.deduplicate_sportlink_source_revision_v1()
  from public, anon, authenticated;

drop trigger if exists dynamic_sportlink_source_deduplicates_revision
  on public.dynamic_data_sources;
create trigger dynamic_sportlink_source_deduplicates_revision
before update of revision on public.dynamic_data_sources
for each row execute function private.deduplicate_sportlink_source_revision_v1();

-- The RSS dedup trigger predates QR media. Include every field that can alter
-- the released news payload, while still ignoring the sync run timestamp.
create or replace function private.deduplicate_rss_source_revision_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare content_revision_hash text;
begin
  if new.kind <> 'rss'
    or new.revision is not distinct from old.revision
    or new.last_successful_sync_at is not distinct from old.last_successful_sync_at
  then return new; end if;
  select encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object(
    'articles', coalesce((select jsonb_agg(jsonb_build_object(
      'externalId', article.external_id,
      'contentHash', article.content_hash,
      'heroMediaAssetId', article.hero_media_asset_id,
      'qrMediaAssetId', article.qr_media_asset_id
    ) order by article.external_id) from public.dynamic_news_articles article
      where article.tenant_id = new.tenant_id and article.data_source_id = new.id), '[]'::jsonb),
    'providerLogoMediaAssetId', new.config_json ->> 'providerLogoMediaAssetId'
  )::text, 'UTF8'), 'sha256'), 'hex') into content_revision_hash;
  new.config_json := jsonb_set(new.config_json, '{contentRevisionHash}', to_jsonb(content_revision_hash), true);
  if old.config_json ->> 'contentRevisionHash' = content_revision_hash then new.revision := old.revision; end if;
  return new;
end;
$$;

revoke all on function private.deduplicate_rss_source_revision_v1()
  from public, anon, authenticated;

-- Immutable history remains protected for normal commands. The explicit
-- delete RPC sets this transaction-local marker and is the only path allowed
-- to remove a playlist's complete release history.
create or replace function private.playlist_delete_context_v1()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select current_setting('veyocast.playlist_delete', true) = 'on'
$$;

revoke all on function private.playlist_delete_context_v1()
  from public, anon, authenticated;

create or replace function private.reject_playlist_release_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and private.playlist_delete_context_v1() then
    return old;
  end if;
  raise exception 'playlist releases are immutable' using errcode = '23514';
end;
$$;

create or replace function private.reject_publisher_target_snapshot_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and private.playlist_delete_context_v1() then
    return old;
  end if;
  raise exception 'publisher target snapshots are immutable' using errcode = '23514';
end;
$$;

create or replace function private.reject_sponsor_immutable_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and private.playlist_delete_context_v1() then
    return old;
  end if;
  raise exception using errcode = '55000', message = 'immutable sponsor record cannot be changed';
end;
$$;

create or replace function public.delete_playlists_v1(p_playlist_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  target_tenant_id uuid;
  requested_count integer := coalesce(cardinality(p_playlist_ids), 0);
  found_count integer;
  deleted_count integer := 0;
  release_ids uuid[] := '{}'::uuid[];
  target_snapshot_ids uuid[] := '{}'::uuid[];
begin
  if requested_count < 1 or requested_count > 100 then
    raise exception 'playlist selection is invalid' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_playlist_ids) id where id is null) then
    raise exception 'playlist selection is invalid' using errcode = '22023';
  end if;
  select playlist.tenant_id
  into target_tenant_id
  from public.playlists playlist
  where playlist.id = any(p_playlist_ids)
  order by playlist.id
  limit 1;
  select count(*)::integer
  into found_count
  from public.playlists playlist
  where playlist.id = any(p_playlist_ids);
  if found_count <> requested_count or target_tenant_id is null then
    raise exception 'playlist not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.playlists playlist
    where playlist.id = any(p_playlist_ids) and playlist.tenant_id <> target_tenant_id
  ) or actor_id is null or not private.has_tenant_capability(
    target_tenant_id, 'tenant.playlist.archive'
  ) then
    raise exception 'playlist delete permission required' using errcode = '42501';
  end if;

  select coalesce(array_agg(release.id), '{}'::uuid[])
  into release_ids
  from public.playlist_releases release
  where release.tenant_id = target_tenant_id and release.playlist_id = any(p_playlist_ids);
  select coalesce(array_agg(snapshot.id), '{}'::uuid[])
  into target_snapshot_ids
  from public.publisher_target_snapshots snapshot
  where snapshot.tenant_id = target_tenant_id and snapshot.release_id = any(release_ids);

  perform set_config('veyocast.playlist_delete', 'on', true);

  -- Clear all live pointers before deleting their referenced releases.
  update public.screens
  set assigned_playlist_id = null, assigned_release_id = null,
      default_playlist_id = null, default_release_id = null,
      active_target_snapshot_id = null
  where screens.tenant_id = target_tenant_id
    and (screens.assigned_playlist_id = any(p_playlist_ids)
      or screens.default_playlist_id = any(p_playlist_ids)
      or screens.assigned_release_id = any(release_ids)
      or screens.default_release_id = any(release_ids)
      or screens.active_target_snapshot_id = any(target_snapshot_ids));
  update public.screen_groups
  set default_playlist_id = null, default_release_id = null
  where screen_groups.tenant_id = target_tenant_id
    and (screen_groups.default_playlist_id = any(p_playlist_ids) or screen_groups.default_release_id = any(release_ids));
  update public.player_devices
  set active_release_id = null, desired_release_id = null
  where player_devices.tenant_id = target_tenant_id
    and (player_devices.active_release_id = any(release_ids) or player_devices.desired_release_id = any(release_ids));

  delete from public.player_heartbeats
  where player_heartbeats.tenant_id = target_tenant_id and player_heartbeats.active_release_id = any(release_ids);
  delete from public.player_sync_events
  where player_sync_events.tenant_id = target_tenant_id and player_sync_events.release_id = any(release_ids);
  delete from public.content_schedules
  where content_schedules.tenant_id = target_tenant_id
    and (content_schedules.playlist_id = any(p_playlist_ids) or content_schedules.release_id = any(release_ids));
  delete from public.publisher_target_snapshot_screens
  where publisher_target_snapshot_screens.tenant_id = target_tenant_id and publisher_target_snapshot_screens.snapshot_id = any(target_snapshot_ids);
  delete from public.publisher_target_snapshots
  where publisher_target_snapshots.tenant_id = target_tenant_id and publisher_target_snapshots.id = any(target_snapshot_ids);
  delete from public.release_screen_assignments
  where release_screen_assignments.tenant_id = target_tenant_id and release_screen_assignments.release_id = any(release_ids);
  delete from private.tenant_theme_rollout_release_branches
  where tenant_theme_rollout_release_branches.tenant_id = target_tenant_id
    and (tenant_theme_rollout_release_branches.source_release_id = any(release_ids) or tenant_theme_rollout_release_branches.replacement_release_id = any(release_ids));
  delete from private.tenant_theme_rollout_releases
  where tenant_theme_rollout_releases.tenant_id = target_tenant_id and tenant_theme_rollout_releases.release_id = any(release_ids);
  delete from public.sponsor_play_events event
  using public.sponsor_plan_revisions plan
  where event.tenant_id = target_tenant_id and event.plan_revision_id = plan.id
    and plan.content_release_id = any(release_ids);
  delete from public.sponsor_plan_revisions
  where sponsor_plan_revisions.tenant_id = target_tenant_id and sponsor_plan_revisions.content_release_id = any(release_ids);
  delete from public.playlist_release_authoring_snapshots
  where playlist_release_authoring_snapshots.tenant_id = target_tenant_id and playlist_release_authoring_snapshots.release_id = any(release_ids);
  delete from public.playlist_release_items
  where playlist_release_items.tenant_id = target_tenant_id and playlist_release_items.release_id = any(release_ids);
  delete from public.playlist_releases
  where playlist_releases.tenant_id = target_tenant_id and playlist_releases.id = any(release_ids);
  delete from public.platform_player_demo_playlists
  where platform_player_demo_playlists.tenant_id = target_tenant_id and platform_player_demo_playlists.playlist_id = any(p_playlist_ids);
  delete from public.playlists
  where playlists.tenant_id = target_tenant_id and playlists.id = any(p_playlist_ids);
  get diagnostics deleted_count = row_count;
  if deleted_count <> requested_count then
    raise exception 'playlist delete did not remove the requested selection' using errcode = 'P0001';
  end if;
  return deleted_count;
end;
$$;

revoke all on function public.delete_playlists_v1(uuid[]) from public, anon, authenticated;
grant execute on function public.delete_playlists_v1(uuid[]) to authenticated;
