-- Bound to one verified tenant by scripts/current-publication-maintenance.mjs.
with used as materialized (select playlist_id from private.used_playlist_ids_v1(__TENANT_ID__)),
referenced as materialized (
 select release_id from public.playlist_publications where tenant_id=__TENANT_ID__
 union select assigned_release_id from public.screens where tenant_id=__TENANT_ID__ and deleted_at is null
 union select default_release_id from public.screens where tenant_id=__TENANT_ID__ and deleted_at is null
 union select default_release_id from public.screen_groups where tenant_id=__TENANT_ID__ and status='active'
 union select release_id from public.content_schedules where tenant_id=__TENANT_ID__ and enabled and (ends_at is null or ends_at>now())
 union select active_release_id from public.player_devices where tenant_id=__TENANT_ID__ and status='paired' and coalesce(last_seen_at,paired_at)>now()-interval '30 days'
 union select desired_release_id from public.player_devices where tenant_id=__TENANT_ID__ and status='paired'
), obsolete as materialized (
 select release.id,release.total_bytes from public.playlist_releases release where release.tenant_id=__TENANT_ID__
 and release.published_at<now()-interval '30 days' and not exists(select 1 from referenced where release_id=release.id)
)
select jsonb_build_object(
 'tenant',(select jsonb_build_object('id',id,'name',name,'status',status) from public.tenants where id=__TENANT_ID__),
 'theme',(select jsonb_build_object('timezone',timezone_name,'policy',theme_mode_policy,'themeId',default_theme_id) from public.tenant_settings where tenant_id=__TENANT_ID__),
 'profiles',(select coalesce(jsonb_agg(jsonb_build_object('themeId',theme_id,'revision',revision,'selection',selection_json)),'[]') from public.tenant_theme_profiles where tenant_id=__TENANT_ID__),
 'playlists',(select coalesce(jsonb_agg(jsonb_build_object('id',playlist.id,'name',playlist.name,'draftRevision',playlist.revision,
  'publicationId',current.playlist_id,'configRevision',current.config_revision,'releaseId',current.release_id,'publishedAt',current.published_at,
  'publishedItems',(select count(*) from public.playlist_release_items where tenant_id=__TENANT_ID__ and release_id=current.release_id),
  'liveItems',(select count(*) from public.playlist_release_items where tenant_id=__TENANT_ID__ and release_id=current.release_id and live_data_enabled)) order by playlist.name),'[]')
  from public.playlists playlist join used on used.playlist_id=playlist.id left join public.playlist_publications current on current.tenant_id=playlist.tenant_id and current.playlist_id=playlist.id where playlist.tenant_id=__TENANT_ID__),
 'screens',(select coalesce(jsonb_agg(jsonb_build_object('id',screen.id,'name',screen.name,'orientation',screen.orientation,'status',screen.status,
  'assignmentSource',screen.active_assignment_source,'scheduleId',screen.active_schedule_id,'targetSnapshotId',screen.active_target_snapshot_id,'defaultPlaylistId',screen.default_playlist_id,'defaultReleaseId',screen.default_release_id,
  'targetRevision',screen.target_revision,'targetChangedAt',screen.target_changed_at,'desiredReleaseId',screen.assigned_release_id,'publicationId',release.playlist_id,'configRevision',release.version,
  'devices',(select coalesce(jsonb_agg(jsonb_build_object('id',device.id,'status',device.status,'platform',device.platform,'runtimeVersion',device.app_version,
    'capabilities',device.capabilities->'goalVideo','activeReleaseId',device.active_release_id,'activeConfigRevision',active.version,'activePublicationId',active.playlist_id,
    'desiredReleaseId',device.desired_release_id,'lastSeenAt',device.last_seen_at,'lastErrorCode',device.last_error_code,'lastErrorAt',device.last_error_at,
    'syncPhase',device.current_sync_phase,'publicationTrace',device.current_sync_detail->'publicationTrace','acknowledgedAt',device.current_sync_detail->'acknowledgedAt')),'[]')
    from public.player_devices device left join public.playlist_releases active on active.tenant_id=device.tenant_id and active.id=device.active_release_id where device.tenant_id=screen.tenant_id and device.screen_id=screen.id and device.status='paired')) order by screen.name),'[]')
   from public.screens screen left join public.playlist_releases release on release.tenant_id=screen.tenant_id and release.id=screen.assigned_release_id where screen.tenant_id=__TENANT_ID__ and screen.deleted_at is null),
 'groups',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'revision',revision,'defaultPlaylistId',default_playlist_id,'defaultReleaseId',default_release_id)),'[]')
   from public.screen_groups where tenant_id=__TENANT_ID__ and status='active'),
 'schedules',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'revision',revision,'playlistId',playlist_id,'releaseId',release_id,'targetSnapshotId',target_snapshot_id,
   'targetKind',target_kind,'screenId',target_screen_id,'groupId',target_screen_group_id,'enabled',enabled,'startsAt',starts_at,'endsAt',ends_at,'timezone',timezone_name,'priority',priority,'source',source)),'[]')
   from public.content_schedules where tenant_id=__TENANT_ID__ and playlist_id in(select playlist_id from used)),
 'sources',(select coalesce(jsonb_agg(jsonb_build_object('id',source.id,'kind',source.kind,'status',source.status,'revision',source.revision,
   'lastSuccessfulSyncAt',source.last_successful_sync_at,'lastAttemptAt',source.last_attempt_at,'lastErrorCode',source.last_error_code,'nextSyncAt',source.next_sync_at)),'[]')
   from public.dynamic_data_sources source where source.tenant_id=__TENANT_ID__ and exists(select 1 from public.playlist_items item join used on used.playlist_id=item.playlist_id join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id=item.tenant_id and snapshot.id=item.dynamic_snapshot_id where item.tenant_id=source.tenant_id and snapshot.data_source_id=source.id)),
 'data',(select coalesce(jsonb_agg(jsonb_build_object('snapshotId',snapshot_id,'dataRevision',data_revision,'checkedAt',checked_at,'changedAt',changed_at,'lastErrorCode',last_error_code)),'[]') from public.published_dynamic_data where tenant_id=__TENANT_ID__),
 'legacyPending',(select count(*) from private.dynamic_release_refresh_queue where tenant_id=__TENANT_ID__ and pending),
 'retention',jsonb_build_object('graceDays',30,'totalReleases',(select count(*) from public.playlist_releases where tenant_id=__TENANT_ID__),
   'mediaPolicy',(select jsonb_build_object('enforcement',enforcement,'days',retention_days,'approvedAt',approved_at) from public.retention_policies where data_class='deleted_media'),
   'referencedReleases',(select count(distinct release_id) from referenced),'unreferencedPastGrace',(select count(*) from obsolete),
   'releaseByteUpperBound',(select coalesce(sum(total_bytes),0) from obsolete),
   'provenanceReferences',(select count(*) from public.publisher_target_snapshots where tenant_id=__TENANT_ID__ and release_id in(select id from obsolete)),
   'retainedReferences',jsonb_build_object(
     'deviceReports',(select count(*) from public.player_devices where tenant_id=__TENANT_ID__ and active_release_id in(select id from obsolete)),
     'heartbeats',(select count(*) from public.player_heartbeats where tenant_id=__TENANT_ID__ and active_release_id in(select id from obsolete)),
     'syncEvents',(select count(*) from public.player_sync_events where tenant_id=__TENANT_ID__ and release_id in(select id from obsolete)),
     'historicalSchedules',(select count(*) from public.content_schedules where tenant_id=__TENANT_ID__ and release_id in(select id from obsolete)),
     'sponsorRevisions',(select count(*) from public.sponsor_plan_revisions where tenant_id=__TENANT_ID__ and content_release_id in(select id from obsolete))),
   'deletedRecords',0,'deletedAssets',0,'note','Dry run; shared media and provenance require separate reachability verification before deletion.'),
 'observedAt',clock_timestamp()
) as report;
