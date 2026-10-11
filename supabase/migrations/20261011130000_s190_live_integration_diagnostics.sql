-- S190: read-only operational evidence inside the existing service boundary.
-- Only explicit columns and known codes leave the database. No payload, name,
-- credential, URL, lease owner/token or arbitrary error detail is returned.
-- Rollback: drop the public RPC before its private formatting helper.
create function private.live_integration_safe_code_v1(p_code text)
returns text language sql immutable set search_path='' as $$
  select case when p_code is null then null when p_code = any(array[
    'SPORTLINK_CLIENT_ID_INVALID','SPORTLINK_ARTICLE_NOT_ALLOWED','SPORTLINK_ARGUMENT_INVALID',
    'SPORTLINK_NETWORK_ERROR','SPORTLINK_CONTENT_TYPE_INVALID','SPORTLINK_RESPONSE_INVALID',
    'SPORTLINK_TIMEOUT','SPORTLINK_CONDITION_ERROR','SPORTLINK_REQUIRED_ARGUMENT_MISSING',
    'SPORTLINK_TOKEN_INVALID','SPORTLINK_SCOPE_INSUFFICIENT','SPORTLINK_ARTICLE_NOT_FOUND',
    'SPORTLINK_SERVER_ERROR','SPORTLINK_RATE_LIMITED','SPORTLINK_RESPONSE_TOO_LARGE',
    'SPORTLINK_SYNC_CLAIM_FAILED','SPORTLINK_CONFIGURATION_UNAVAILABLE','SPORTLINK_CLUB_INVALID',
    'SPORTLINK_DATASET_DISABLED','SPORTLINK_BIRTHDAY_NORMALIZATION_EMPTY','SPORTLINK_WORKER_LEASE_LOST',
    'SPORTLINK_WORKER_LEASE_EXPIRED','SPORTLINK_POOL_LIMIT_EXCEEDED','SPORTLINK_SYNC_INTERNAL_ERROR',
    'SPORTLINK_MEDIA_UPLOAD_FAILED','SPORTLINK_SYNC_COMPLETE_57014','SPORTLINK_SYNC_COMPLETE_23514',
    'SPORTLINK_SYNC_COMPLETE_42501','SPORTLINK_SYNC_COMPLETE_P0001','SPORTLINK_SYNC_COMPLETE_P0002',
    'SPORTLINK_SYNC_COMPLETE_40P01','SPORTLINK_SYNC_COMPLETE_40001','SPORTLINK_SYNC_COMPLETE_INVALID_RESULT',
    'LEDSCORES_MESSAGE_INVALID','LEDSCORES_MESSAGE_TOO_LARGE','LEDSCORES_SLUG_INVALID',
    'ledscores_connect_timeout','ledscores_initial_message_timeout','ledscores_transport_error',
    'ledscores_endpoint_not_allowlisted','ledscores_lease_renew_failed','ledscores_state_record_failed',
    'ledscores_touch_failed','ledscores_goal_dispatch_failed','ledscores_goal_dispatch_invalid',
    'ledscores_player_sync_failed','ledscores_player_sync_invalid','ledscores_live_match_state_failed',
    'ledscores_lease_lost','ledscores_unavailable','worker_shutdown',
    'published_data_refresh_claim_failed','published_data_refresh_claim_invalid',
    'published_data_refresh_complete_failed','published_data_refresh_completion_invalid',
    'published_data_refresh_cancelled','published_data_refresh_wait_failed',
    'published_data_refresh_failed','PUBLISHED_DATA_REFRESH_FAILED',
    '57014','23514','42501','P0001','P0002','40P01','40001'
  ]::text[]) then p_code else 'UNKNOWN_ERROR' end
$$;
revoke all on function private.live_integration_safe_code_v1(text) from public,anon,authenticated,service_role;

create function public.get_live_integration_diagnostics_v1(p_tenant_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode='42501';
  end if;
  if not exists(select 1 from public.tenants where id=p_tenant_id and status='active') then
    raise exception 'active tenant required' using errcode='42501';
  end if;
  with used_releases as (
    select release_id from private.referenced_publication_releases_v1(p_tenant_id)
  ), live_bindings as (
    select data.*,coalesce(version.slide_type,slide.slide_type) as slide_type,
      (select count(*) from public.playlist_release_items item join used_releases used on used.release_id=item.release_id
       where item.tenant_id=p_tenant_id and item.dynamic_snapshot_id=data.snapshot_id and item.live_data_enabled) as live_references
    from public.published_dynamic_data data
    join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id=p_tenant_id and snapshot.id=data.snapshot_id
    join public.dynamic_slides slide on slide.tenant_id=p_tenant_id and slide.id=snapshot.dynamic_slide_id
    left join public.dynamic_slide_versions version on version.tenant_id=p_tenant_id and version.id=snapshot.dynamic_slide_version_id
    where data.tenant_id=p_tenant_id
  )
  select jsonb_build_object(
    'schemaVersion',1,'tenantId',p_tenant_id,'observedAt',statement_timestamp(),
    'sources',coalesce((select jsonb_agg(jsonb_build_object(
      'sourceId',id,'sourceKind',kind,'status',status,'providerStatus',provider_status,
      'revision',revision,'lastAttemptAt',last_attempt_at,'lastSuccessAt',last_successful_sync_at,
      'errorCode',private.live_integration_safe_code_v1(last_error_code)) order by id)
      from (select * from public.dynamic_data_sources where tenant_id=p_tenant_id and kind in ('sportlink','ledscores') order by id limit 100) source),'[]'::jsonb),
    'ledScores',coalesce((select jsonb_agg(jsonb_build_object(
      'connectionId',connection.id,'status',connection.status,'health',connection.health_status,'revision',connection.revision,
      'lastValidMessageAt',connection.last_source_message_at,'lastConnectedAt',connection.last_connected_at,
      'lastDisconnectedAt',connection.last_disconnected_at,'leaseActive',connection.lease_expires_at>statement_timestamp(),
      'leaseExpiresAt',connection.lease_expires_at,'reconnectCount',connection.reconnect_count,
      'invalidMessageCount',connection.invalid_message_count,'lastTestAt',connection.last_test_at,'lastTestStatus',connection.last_test_status,
      'lastHealthCode',private.live_integration_safe_code_v1(connection.health_detail),
      'lastEventAt',(select max(occurred_at) from public.ledscores_connector_events where tenant_id=p_tenant_id and connection_id=connection.id),
      'persistedMessageEventCount24h',(select count(*) from public.ledscores_connector_events where tenant_id=p_tenant_id and connection_id=connection.id
        and occurred_at>=statement_timestamp()-interval '24 hours' and event_type in ('connected','reconnected','baseline_established','invalid_message')),
      'goalCount24h',(select count(*) from public.ledscores_goal_events where tenant_id=p_tenant_id and connection_id=connection.id
        and event_kind='live' and detected_at>=statement_timestamp()-interval '24 hours'),
      'lastGoalAt',(select max(detected_at) from public.ledscores_goal_events where tenant_id=p_tenant_id and connection_id=connection.id and event_kind='live'),
      'liveStateSequence',state.state_sequence,'liveStateObservedAt',state.source_observed_at,'liveStateSourceUpdatedAt',state.source_updated_at)
      order by connection.id) from (select * from public.ledscores_connections where tenant_id=p_tenant_id order by id limit 100) connection
      left join public.ledscores_live_match_states state on state.tenant_id=p_tenant_id and state.connection_id=connection.id),'[]'::jsonb),
    'messageCountsIncludePersistedEventsOnly',true,
    'sportlink',coalesce((select jsonb_agg(jsonb_build_object(
      'connectionId',connection.id,'sourceId',connection.data_source_id,'status',connection.status,
      'lastAttemptAt',connection.last_attempt_at,'lastSuccessAt',connection.last_success_at,'nextSyncAt',connection.next_sync_at,
      'staleAfter',connection.stale_after,'stale',connection.stale_after is not null and connection.stale_after<=statement_timestamp(),
      'errorCode',private.live_integration_safe_code_v1(connection.last_error_code),
      'birthdayModuleEnabled',connection.privacy_birthdays_enabled,
      'birthdayProbeAllowed',connection.status='active' and connection.privacy_birthdays_enabled
        and exists(select 1 from public.tenant_feature_flags where tenant_id=p_tenant_id and flag_key='sportlink_birthdays' and enabled)
        and exists(select 1 from public.sportlink_sync_policies where tenant_id=p_tenant_id and connection_id=connection.id and dataset_group='public_people' and enabled),
      'activeBirthdayCount',(select count(*) from public.sportlink_birthdays where tenant_id=p_tenant_id and connection_id=connection.id and active),
      'datasets',coalesce((select jsonb_agg(jsonb_build_object(
        'datasetGroup',policy.dataset_group,'enabled',policy.enabled,'frequency',policy.frequency,
        'nextSyncAt',policy.next_sync_at,'due',policy.enabled and policy.next_sync_at<=statement_timestamp(),
        'lastAttemptAt',policy.last_attempt_at,'lastSuccessAt',policy.last_success_at,
        'freshness',case when not policy.enabled then 'disabled' when policy.last_success_at is null then 'never_synced'
          when policy.next_sync_at<=statement_timestamp() then 'due' else 'current' end,
        'latestRunStatus',run.status,'latestRunStartedAt',run.started_at,'latestRunFinishedAt',run.finished_at,
        'readCount',run.read_count,'changedCount',run.changed_count,'skippedCount',run.skipped_count,
        'errorCode',private.live_integration_safe_code_v1(run.error_code)) order by policy.dataset_group)
        from public.sportlink_sync_policies policy left join lateral (select * from public.sportlink_sync_runs
          where tenant_id=p_tenant_id and connection_id=connection.id and dataset_group=policy.dataset_group order by started_at desc,id desc limit 1) run on true
        where policy.tenant_id=p_tenant_id and policy.connection_id=connection.id),'[]'::jsonb)) order by connection.id)
      from (select * from public.sportlink_connections where tenant_id=p_tenant_id order by id limit 100) connection),'[]'::jsonb),
    'publishedBindings',coalesce((select jsonb_agg(jsonb_build_object(
      'snapshotId',binding.snapshot_id,'sourceId',binding.data_source_id,
      'slideType',case when binding.slide_type in (
        'menu','price_list','news','ledscores_live_match','sport_program','sport_results','sport_standing',
        'sport_period_standing','sport_match_of_the_day','sport_next_match','sport_cancellations','sport_dressing_rooms',
        'sport_officials','sport_team','sport_sponsor','sport_activities','sport_trainings','sport_volunteers',
        'sport_birthdays','sport_visitor_arrivals','sport_referee_arrivals') then binding.slide_type else 'unknown' end,
      'dataRevision',binding.data_revision,'sourceRevision',binding.source_revision,
      'checkedAt',binding.checked_at,'changedAt',binding.changed_at,'liveReferenceCount',binding.live_references,
      'liveItemCount',case when jsonb_typeof(binding.data_json#>'{sport,items}')='array' then jsonb_array_length(binding.data_json#>'{sport,items}') else 0 end,
      'errorCode',private.live_integration_safe_code_v1(binding.last_error_code),
      'refreshQueued',queue.snapshot_id is not null,'refreshDue',coalesce(queue.next_attempt_at<=statement_timestamp(),false),
      'refreshLeased',coalesce(queue.lease_until>statement_timestamp(),false),'refreshAttemptCount',coalesce(queue.attempt_count,0),
      'refreshErrorCode',private.live_integration_safe_code_v1(queue.last_error_code)) order by binding.snapshot_id)
      from (select * from live_bindings order by snapshot_id limit 500) binding
      left join private.published_data_refresh_queue queue on queue.tenant_id=p_tenant_id and queue.snapshot_id=binding.snapshot_id),'[]'::jsonb),
    'queues',jsonb_build_object(
      'publishedData', (select jsonb_build_object('count',count(*),'dueCount',count(*) filter(where next_attempt_at<=statement_timestamp()),
        'leasedCount',count(*) filter(where lease_until>statement_timestamp()),'errorCount',count(*) filter(where last_error_code is not null),
        'oldestRequestedAt',min(requested_at)) from private.published_data_refresh_queue where tenant_id=p_tenant_id),
      'versionPrune',(select jsonb_build_object('count',count(*),'pendingCount',count(*) filter(where pending),
        'dueCount',count(*) filter(where pending and not_before<=statement_timestamp()),'oldestRequestedAt',min(requested_at))
        from private.publication_version_prune_queue where tenant_id=p_tenant_id)),
    'counts',jsonb_build_object(
      'playlistReleases',(select count(*) from public.playlist_releases where tenant_id=p_tenant_id),
      'playlistPublications',(select count(*) from public.playlist_publications where tenant_id=p_tenant_id),
      'slideVersions',(select count(*) from public.dynamic_slide_versions where tenant_id=p_tenant_id),
      'snapshots',(select count(*) from public.dynamic_slide_snapshots where tenant_id=p_tenant_id),
      'renderJobs',(select count(*) from public.dynamic_render_jobs where tenant_id=p_tenant_id),
      'queuedRenderJobs',(select count(*) from public.dynamic_render_jobs where tenant_id=p_tenant_id and status='queued'),
      'failedRenderJobs',(select count(*) from public.dynamic_render_jobs where tenant_id=p_tenant_id and status='failed'),
      'publishedBindings',(select count(*) from live_bindings),'liveBindings',(select count(*) from live_bindings where live_references>0)),
    -- Current Players do not acknowledge per-binding data revisions. These
    -- database revisions must not be misrepresented as visible-frame evidence.
    'players',jsonb_build_object('dataRevisionReportingAvailable',false,'dataRevisionReports','[]'::jsonb,
      'reports',coalesce((select jsonb_agg(jsonb_build_object(
        'deviceId',id,'screenId',screen_id,'status',status,'lastSeenAt',last_seen_at,
        'activeReleaseId',active_release_id,'desiredReleaseId',desired_release_id,
        'targetRevision',case when current_sync_detail#>>'{publicationTrace,targetRevision}' ~ '^[1-9][0-9]{0,18}$'
          then current_sync_detail#>>'{publicationTrace,targetRevision}' else null end,
        'configRevision',case when current_sync_detail#>>'{publicationTrace,configRevision}' ~ '^[1-9][0-9]{0,18}$'
          then current_sync_detail#>>'{publicationTrace,configRevision}' else null end) order by id)
        from (select * from public.player_devices where tenant_id=p_tenant_id order by id limit 500) device),'[]'::jsonb))
  ) into result;
  return result;
end $$;
revoke all on function public.get_live_integration_diagnostics_v1(uuid) from public,anon,authenticated;
grant execute on function public.get_live_integration_diagnostics_v1(uuid) to service_role;
comment on function public.get_live_integration_diagnostics_v1(uuid) is
  'Service-only, read-only active-tenant counters and safe revision diagnostics. No source payload or credentials.';
notify pgrst,'reload schema';
