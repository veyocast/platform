begin;

-- Control loads the latest sync history by tenant and screen. Without this
-- exact access path, ten rows forced a full scan of the high-churn event table.
create index player_sync_events_tenant_screen_created_idx
  on public.player_sync_events (tenant_id, screen_id, created_at desc);

-- These append-heavy diagnostic tables are pruned in bounded batches. Keep
-- vacuum/analyze responsive after a prune instead of leaving a large dead heap
-- for every later read and index build.
alter table public.player_heartbeats set (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 5000,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_analyze_threshold = 5000
);
alter table public.player_sync_events set (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 5000,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_analyze_threshold = 5000
);

-- A worker keeps its already-open websocket connection in memory. Excluding
-- those IDs prevents every claim poll from rewriting the same lease row; the
-- dedicated renewal RPC remains the sole authority for an active socket.
create function public.claim_ledscores_connections_v2(
  p_worker_id text,
  p_lease_seconds integer default 45,
  p_limit integer default 10,
  p_exclude_connection_ids uuid[] default '{}'::uuid[]
)
returns table (
  connection_id uuid,
  tenant_id uuid,
  club_slug text,
  endpoint_url text,
  mappings jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_worker_id !~ '^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,127}$'
    or p_lease_seconds not between 15 and 120
    or p_limit not between 1 and 50
    or coalesce(cardinality(p_exclude_connection_ids), 0) > 50
    or array_position(p_exclude_connection_ids, null) is not null
  then
    raise exception 'invalid LED Scores lease request' using errcode = '23514';
  end if;

  return query
  with candidates as (
    select connection.id
    from public.ledscores_connections connection
    where connection.status = 'active'
      and private.ledscores_feature_enabled(connection.tenant_id)
      and not (connection.id = any(coalesce(p_exclude_connection_ids, '{}'::uuid[])))
      and (
        connection.lease_expires_at is null
        or connection.lease_expires_at <= clock_timestamp()
        or connection.lease_owner = p_worker_id
      )
    order by connection.last_source_message_at nulls first, connection.updated_at, connection.id
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.ledscores_connections connection set
      lease_owner = p_worker_id,
      lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
      health_status = case
        when connection.health_status = 'connected' then 'connected'
        else 'reconnecting'
      end,
      updated_at = now()
    from candidates
    where connection.id = candidates.id
    returning connection.id, connection.tenant_id, connection.club_slug
  )
  select
    claimed.id,
    claimed.tenant_id,
    claimed.club_slug,
    'wss://wss.ledscores.score.tel/clubs/' || claimed.club_slug || '/scores/',
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'teamKey', mapping.provider_team_key,
        'teamName', mapping.provider_team_name,
        'side', mapping.scoring_side
      ) order by mapping.provider_team_key)
      from public.ledscores_team_mappings mapping
      where mapping.tenant_id = claimed.tenant_id
        and mapping.connection_id = claimed.id
    ), '[]'::jsonb)
  from claimed;
end;
$$;

revoke all on function public.claim_ledscores_connections_v2(text,integer,integer,uuid[])
  from public, anon, authenticated;
grant execute on function public.claim_ledscores_connections_v2(text,integer,integer,uuid[])
  to service_role;

-- Heartbeats remain the periodic liveness record. Sync events are transition
-- history, so volatile acknowledgement time, current item and goal telemetry
-- must not manufacture a second history row every thirty seconds.
create or replace function public.record_player_heartbeat_v2(
  p_token_hash text,
  p_runtime_state text,
  p_active_release_id uuid default null,
  p_desired_release_id uuid default null,
  p_storage_used_bytes bigint default null,
  p_storage_quota_bytes bigint default null,
  p_app_version text default null,
  p_platform text default null,
  p_capabilities jsonb default '{}'::jsonb,
  p_sync_phase text default null,
  p_sync_detail jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  heartbeat_id uuid;
  heartbeat_record public.player_heartbeats%rowtype;
  device_record public.player_devices%rowtype;
  sync_release_id uuid;
  reported_error_code text;
  previous_sync_event public.player_sync_events%rowtype;
  stable_sync_detail jsonb;
begin
  if p_capabilities is null or jsonb_typeof(p_capabilities) <> 'object'
    or p_sync_detail is null or jsonb_typeof(p_sync_detail) <> 'object'
  then
    raise exception 'heartbeat capabilities and detail must be objects' using errcode = '23514';
  end if;
  reported_error_code := nullif(btrim(p_sync_detail #>> '{lastPlaybackError,code}'), '');
  if reported_error_code is not null and reported_error_code !~ '^[A-Za-z0-9_-]{1,100}$' then
    reported_error_code := 'PLAYER_ERROR_REDACTED';
  end if;

  heartbeat_id := public.record_player_heartbeat(
    p_token_hash, p_runtime_state, p_active_release_id,
    p_storage_used_bytes, p_storage_quota_bytes, p_app_version, null, p_sync_detail
  );
  select heartbeat.* into heartbeat_record
  from public.player_heartbeats heartbeat where heartbeat.id = heartbeat_id;
  select device.* into device_record
  from public.player_devices device
  where device.tenant_id = heartbeat_record.tenant_id
    and device.id = heartbeat_record.device_id
  for update;

  if p_desired_release_id is not null
    and p_desired_release_id is distinct from device_record.desired_release_id
    and p_desired_release_id is distinct from p_active_release_id
  then
    raise exception 'reported desired release does not match device assignment' using errcode = '23514';
  end if;

  update public.player_devices
  set current_sync_phase = p_sync_phase,
      current_sync_detail = p_sync_detail,
      capabilities = p_capabilities,
      platform = coalesce(nullif(btrim(p_platform), ''), platform),
      last_error_code = reported_error_code,
      last_error_at = case when reported_error_code is null then null else now() end,
      sync_retry_requested_at = null
  where id = device_record.id;

  if p_sync_phase is not null then
    sync_release_id := case when p_sync_phase = 'active' then p_active_release_id
      else coalesce(p_desired_release_id, p_active_release_id) end;
    stable_sync_detail := p_sync_detail
      - 'acknowledgedAt'
      - 'currentItemId'
      - 'goalVideoDiagnostics';

    select event.* into previous_sync_event
    from public.player_sync_events event
    where event.tenant_id = heartbeat_record.tenant_id
      and event.device_id = heartbeat_record.device_id
    order by event.created_at desc, event.id desc
    limit 1;

    if previous_sync_event.id is null
      or previous_sync_event.phase is distinct from p_sync_phase
      or previous_sync_event.release_id is distinct from sync_release_id
      or previous_sync_event.screen_id is distinct from heartbeat_record.screen_id
      or (previous_sync_event.detail
        - 'acknowledgedAt'
        - 'currentItemId'
        - 'goalVideoDiagnostics') is distinct from stable_sync_detail
    then
      insert into public.player_sync_events (
        tenant_id, device_id, screen_id, release_id, phase, detail
      ) values (
        heartbeat_record.tenant_id, heartbeat_record.device_id,
        heartbeat_record.screen_id, sync_release_id, p_sync_phase,
        p_sync_detail
      );
    end if;
  end if;
  return heartbeat_id;
end;
$$;

commit;
