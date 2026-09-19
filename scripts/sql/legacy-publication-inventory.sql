-- Read-only baseline on the existing production schema, before S185 migration.
with used as materialized (
 select assigned_playlist_id playlist_id from public.screens where tenant_id=__TENANT_ID__ and deleted_at is null and status<>'disabled'
 union select default_playlist_id from public.screens where tenant_id=__TENANT_ID__ and deleted_at is null and status<>'disabled'
 union select default_playlist_id from public.screen_groups where tenant_id=__TENANT_ID__ and status='active'
 union select playlist_id from public.content_schedules where tenant_id=__TENANT_ID__ and enabled and (ends_at is null or ends_at>now())
)
select jsonb_build_object(
 'publicationContract','legacy',
 'tenant',(select jsonb_build_object('id',id,'name',name,'status',status) from public.tenants where id=__TENANT_ID__),
 'theme',(select jsonb_build_object('timezone',timezone_name,'policy',theme_mode_policy,'themeId',default_theme_id) from public.tenant_settings where tenant_id=__TENANT_ID__),
 'playlists',(select coalesce(jsonb_agg(jsonb_build_object('id',playlist.id,'name',playlist.name,'draftRevision',playlist.revision,
   'releaseId',latest.id,'configRevision',latest.version,'publishedAt',latest.published_at,'releaseCount',(select count(*) from public.playlist_releases where tenant_id=__TENANT_ID__ and playlist_id=playlist.id))),'[]')
   from public.playlists playlist join used on used.playlist_id=playlist.id left join lateral
    (select id,version,published_at from public.playlist_releases where tenant_id=__TENANT_ID__ and playlist_id=playlist.id order by version desc limit 1) latest on true),
 'screens',(select coalesce(jsonb_agg(jsonb_build_object('id',screen.id,'name',screen.name,'orientation',screen.orientation,'status',screen.status,
   'assignmentSource',screen.active_assignment_source,'scheduleId',screen.active_schedule_id,'targetSnapshotId',screen.active_target_snapshot_id,
   'defaultPlaylistId',screen.default_playlist_id,'defaultReleaseId',screen.default_release_id,'desiredReleaseId',screen.assigned_release_id,
   'devices',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'platform',platform,'runtimeVersion',app_version,'activeReleaseId',active_release_id,
     'desiredReleaseId',desired_release_id,'lastSeenAt',last_seen_at,'lastErrorCode',last_error_code,'lastErrorAt',last_error_at)),'[]')
     from public.player_devices where tenant_id=__TENANT_ID__ and screen_id=screen.id and status='paired'))),'[]')
   from public.screens screen where tenant_id=__TENANT_ID__ and deleted_at is null),
 'legacyPending',(select count(*) from private.dynamic_release_refresh_queue where tenant_id=__TENANT_ID__ and pending),
 'otherTenantsWithRecentDynamicPlayers',(select count(distinct device.tenant_id) from public.player_devices device
   join public.playlist_release_items item on item.tenant_id=device.tenant_id and item.release_id=device.active_release_id
   where device.tenant_id<>__TENANT_ID__ and device.status='paired' and device.last_seen_at>now()-interval '30 days' and item.dynamic_snapshot_id is not null),
 'retention',jsonb_build_object('totalReleases',(select count(*) from public.playlist_releases where tenant_id=__TENANT_ID__),
   'deletedRecords',0,'deletedAssets',0),
 'observedAt',clock_timestamp()
) report;
