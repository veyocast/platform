begin;

-- S223: retain force-sync until the requesting device acknowledges that exact request.
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
      sync_retry_requested_at = case
        when to_jsonb(sync_retry_requested_at) #>> '{}' = p_sync_detail ->> 'syncRetryAcknowledgedAt'
          then null
        else sync_retry_requested_at
      end
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


-- Device-authorized heartbeat and receipt delivery are one transaction. The
-- v2 API stays compatible, but no longer drops requests it did not acknowledge.
create function public.record_player_heartbeat_v3(
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
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare heartbeat_id uuid; requested_at timestamptz;
begin
  heartbeat_id := public.record_player_heartbeat_v2(
    p_token_hash, p_runtime_state, p_active_release_id, p_desired_release_id,
    p_storage_used_bytes, p_storage_quota_bytes, p_app_version, p_platform,
    p_capabilities, p_sync_phase, p_sync_detail
  );
  select device.sync_retry_requested_at into requested_at
  from public.player_heartbeats heartbeat
  join public.player_devices device
    on device.id = heartbeat.device_id and device.tenant_id = heartbeat.tenant_id
  where heartbeat.id = heartbeat_id;
  return jsonb_build_object('heartbeatId', heartbeat_id, 'syncRetryRequestedAt', requested_at);
end;
$$;
revoke all on function public.record_player_heartbeat_v3(text,text,uuid,uuid,bigint,bigint,text,text,jsonb,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.record_player_heartbeat_v3(text,text,uuid,uuid,bigint,bigint,text,text,jsonb,text,jsonb)
  to anon, authenticated, service_role;

commit;
