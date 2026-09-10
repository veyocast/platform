-- S166 follow-up: delete playlist release dependants in FK-safe order.
-- Schedules and target snapshots reference each other, and release assignments
-- reference snapshots. Explicitly detach those links before deleting history.

create or replace function private.reject_publisher_target_snapshot_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.playlist_delete_context_v1() then
    if tg_op = 'DELETE' then
      return old;
    end if;
    -- Snapshots remain immutable to normal callers. The explicit playlist
    -- deletion transaction may only clear the nullable schedule back-reference
    -- needed to break the schedule <-> snapshot FK cycle.
    if tg_op = 'UPDATE' and tg_table_name = 'publisher_target_snapshots' then
      if old.schedule_id is not null
        and new.schedule_id is null
        and new.id = old.id
      then
        return new;
      end if;
    end if;
  end if;
  raise exception 'publisher target snapshots are immutable' using errcode = '23514';
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
  where release.tenant_id = target_tenant_id
    and release.playlist_id = any(p_playlist_ids);

  select coalesce(array_agg(snapshot.id), '{}'::uuid[])
  into target_snapshot_ids
  from public.publisher_target_snapshots snapshot
  where snapshot.tenant_id = target_tenant_id
    and snapshot.release_id = any(release_ids);

  perform set_config('veyocast.playlist_delete', 'on', true);

  -- Clear live pointers before deleting their referenced releases.
  update public.screens
  set assigned_playlist_id = null,
      assigned_release_id = null,
      default_playlist_id = null,
      default_release_id = null,
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
    and (screen_groups.default_playlist_id = any(p_playlist_ids)
      or screen_groups.default_release_id = any(release_ids));

  update public.player_devices
  set active_release_id = null, desired_release_id = null
  where player_devices.tenant_id = target_tenant_id
    and (player_devices.active_release_id = any(release_ids)
      or player_devices.desired_release_id = any(release_ids));

  delete from public.player_heartbeats
  where player_heartbeats.tenant_id = target_tenant_id
    and player_heartbeats.active_release_id = any(release_ids);
  delete from public.player_sync_events
  where player_sync_events.tenant_id = target_tenant_id
    and player_sync_events.release_id = any(release_ids);

  -- Schedule and target snapshot rows form a nullable reference cycle.
  -- Detach the snapshot -> schedule edge before removing schedules.
  update public.publisher_target_snapshots
  set schedule_id = null
  where publisher_target_snapshots.tenant_id = target_tenant_id
    and publisher_target_snapshots.id = any(target_snapshot_ids);
  delete from public.content_schedules
  where content_schedules.tenant_id = target_tenant_id
    and (content_schedules.playlist_id = any(p_playlist_ids)
      or content_schedules.release_id = any(release_ids));

  -- Assignments must go before their target snapshots due to RESTRICT FKs.
  delete from public.release_screen_assignments
  where release_screen_assignments.tenant_id = target_tenant_id
    and (release_screen_assignments.release_id = any(release_ids)
      or release_screen_assignments.target_snapshot_id = any(target_snapshot_ids));
  delete from public.publisher_target_snapshot_screens
  where publisher_target_snapshot_screens.tenant_id = target_tenant_id
    and publisher_target_snapshot_screens.snapshot_id = any(target_snapshot_ids);
  delete from public.publisher_target_snapshots
  where publisher_target_snapshots.tenant_id = target_tenant_id
    and publisher_target_snapshots.id = any(target_snapshot_ids);

  delete from private.tenant_theme_rollout_release_branches
  where tenant_theme_rollout_release_branches.tenant_id = target_tenant_id
    and (tenant_theme_rollout_release_branches.source_release_id = any(release_ids)
      or tenant_theme_rollout_release_branches.replacement_release_id = any(release_ids));
  delete from private.tenant_theme_rollout_releases
  where tenant_theme_rollout_releases.tenant_id = target_tenant_id
    and tenant_theme_rollout_releases.release_id = any(release_ids);
  delete from public.sponsor_play_events event
  using public.sponsor_plan_revisions plan
  where event.tenant_id = target_tenant_id
    and event.plan_revision_id = plan.id
    and plan.content_release_id = any(release_ids);
  delete from public.sponsor_plan_revisions
  where sponsor_plan_revisions.tenant_id = target_tenant_id
    and sponsor_plan_revisions.content_release_id = any(release_ids);
  delete from public.playlist_release_authoring_snapshots
  where playlist_release_authoring_snapshots.tenant_id = target_tenant_id
    and playlist_release_authoring_snapshots.release_id = any(release_ids);
  delete from public.playlist_release_items
  where playlist_release_items.tenant_id = target_tenant_id
    and playlist_release_items.release_id = any(release_ids);
  delete from public.playlist_releases
  where playlist_releases.tenant_id = target_tenant_id
    and playlist_releases.id = any(release_ids);
  delete from public.platform_player_demo_playlists
  where platform_player_demo_playlists.tenant_id = target_tenant_id
    and platform_player_demo_playlists.playlist_id = any(p_playlist_ids);
  delete from public.playlists
  where playlists.tenant_id = target_tenant_id
    and playlists.id = any(p_playlist_ids);
  get diagnostics deleted_count = row_count;
  if deleted_count <> requested_count then
    raise exception 'playlist delete did not remove the requested selection' using errcode = 'P0001';
  end if;
  return deleted_count;
end;
$$;

revoke all on function public.delete_playlists_v1(uuid[]) from public, anon, authenticated;
grant execute on function public.delete_playlists_v1(uuid[]) to authenticated;

-- Make the replacement RPC visible immediately to the PostgREST schema cache.
select pg_catalog.pg_notify('pgrst', 'reload schema');
