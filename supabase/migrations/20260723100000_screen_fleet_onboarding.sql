-- S27: transactional screen lifecycle, bounded pairing and device operations.

alter table public.player_devices
  add column last_error_code text
    check (last_error_code is null or last_error_code ~ '^[A-Za-z0-9_-]{1,100}$'),
  add column last_error_at timestamptz,
  add column sync_retry_requested_at timestamptz;

create table private.pairing_creation_attempts (
  id bigint generated always as identity primary key,
  fingerprint_hash text not null check (fingerprint_hash ~ '^[a-f0-9]{64}$'),
  outcome text not null check (outcome in ('created', 'rate_limited')),
  attempted_at timestamptz not null default now()
);

create index pairing_creation_attempts_fingerprint_time_idx
  on private.pairing_creation_attempts(fingerprint_hash, attempted_at desc);
create index pairing_creation_attempts_time_idx
  on private.pairing_creation_attempts(attempted_at desc);

create table private.pairing_claim_attempts (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  outcome text not null check (outcome in (
    'paired', 'invalid', 'expired', 'screen_unavailable', 'rate_limited'
  )),
  attempted_at timestamptz not null default now()
);

create index pairing_claim_attempts_actor_time_idx
  on private.pairing_claim_attempts(actor_user_id, attempted_at desc);

revoke all on private.pairing_creation_attempts from public, anon, authenticated;
revoke all on private.pairing_claim_attempts from public, anon, authenticated;

create or replace function private.can_manage_screens(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_tenant_role(p_tenant_id, array[
    'tenant_owner', 'tenant_admin'
  ]::public.tenant_role[])
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin'
  ]::public.platform_role[]);
$$;

create or replace function private.require_active_tenant_command(p_tenant_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.tenants tenant
    where tenant.id = p_tenant_id
      and tenant.status = 'active'::public.tenant_status
  ) then
    raise exception 'tenant mutations require an active tenant' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.create_screen_v1(
  p_tenant_id uuid,
  p_name text,
  p_location text,
  p_orientation text,
  p_resolution_width integer,
  p_resolution_height integer,
  p_initial_release_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  tenant_record public.tenants%rowtype;
  release_record public.playlist_releases%rowtype;
  current_screen_count integer;
  screen_id uuid;
begin
  if actor_id is null or not private.can_manage_screens(p_tenant_id) then
    raise exception 'actor cannot manage screens for this tenant' using errcode = '42501';
  end if;

  select tenant.* into tenant_record
  from public.tenants tenant
  where tenant.id = p_tenant_id
  for update;

  if not found then
    raise exception 'tenant not found' using errcode = 'P0002';
  end if;

  perform private.require_active_tenant_command(p_tenant_id);

  select count(*)::integer into current_screen_count
  from public.screens screen
  where screen.tenant_id = p_tenant_id;

  if current_screen_count >= tenant_record.screen_limit then
    raise exception 'tenant screen limit reached' using errcode = 'P0001';
  end if;

  if length(btrim(coalesce(p_name, ''))) not between 2 and 120 then
    raise exception 'screen name length is invalid' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_location, ''))) > 160 then
    raise exception 'screen location length is invalid' using errcode = '23514';
  end if;
  if p_orientation not in ('landscape', 'portrait') then
    raise exception 'screen orientation is invalid' using errcode = '23514';
  end if;
  if p_resolution_width not between 320 and 7680
    or p_resolution_height not between 240 and 4320
  then
    raise exception 'screen resolution is invalid' using errcode = '23514';
  end if;

  if p_initial_release_id is not null then
    select release.* into release_record
    from public.playlist_releases release
    where release.tenant_id = p_tenant_id
      and release.id = p_initial_release_id;
    if not found then
      raise exception 'initial release is unavailable' using errcode = '23514';
    end if;
  end if;

  insert into public.screens (
    tenant_id, name, location, orientation, resolution_width,
    resolution_height, assigned_playlist_id, assigned_release_id, created_by
  ) values (
    p_tenant_id,
    btrim(p_name),
    nullif(btrim(coalesce(p_location, '')), ''),
    p_orientation,
    p_resolution_width,
    p_resolution_height,
    release_record.playlist_id,
    p_initial_release_id,
    actor_id
  ) returning id into screen_id;

  perform private.audit_event(
    p_tenant_id,
    'screen.created',
    'screens',
    screen_id,
    'success',
    jsonb_build_object(
      'orientation', p_orientation,
      'resolutionWidth', p_resolution_width,
      'resolutionHeight', p_resolution_height,
      'initialReleaseId', p_initial_release_id
    )
  );

  return screen_id;
end;
$$;

create or replace function public.update_screen_v1(
  p_tenant_id uuid,
  p_screen_id uuid,
  p_name text,
  p_location text,
  p_orientation text,
  p_resolution_width integer,
  p_resolution_height integer,
  p_status public.screen_status
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  screen_record public.screens%rowtype;
begin
  if private.current_user_id() is null or not private.can_manage_screens(p_tenant_id) then
    raise exception 'actor cannot manage screens for this tenant' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  select screen.* into screen_record
  from public.screens screen
  where screen.tenant_id = p_tenant_id and screen.id = p_screen_id
  for update;
  if not found then
    raise exception 'screen not found' using errcode = 'P0002';
  end if;

  if length(btrim(coalesce(p_name, ''))) not between 2 and 120
    or length(btrim(coalesce(p_location, ''))) > 160
    or p_orientation not in ('landscape', 'portrait')
    or p_resolution_width not between 320 and 7680
    or p_resolution_height not between 240 and 4320
  then
    raise exception 'screen details are invalid' using errcode = '23514';
  end if;

  update public.screens
  set name = btrim(p_name),
      location = nullif(btrim(coalesce(p_location, '')), ''),
      orientation = p_orientation,
      resolution_width = p_resolution_width,
      resolution_height = p_resolution_height,
      status = p_status
  where tenant_id = p_tenant_id and id = p_screen_id;

  if p_status = 'disabled'::public.screen_status then
    update public.player_devices
    set status = 'revoked'::public.player_device_status,
        revoked_at = now()
    where tenant_id = p_tenant_id
      and screen_id = p_screen_id
      and status = 'paired'::public.player_device_status;
  end if;

  perform private.audit_event(
    p_tenant_id,
    'screen.updated',
    'screens',
    p_screen_id,
    'success',
    jsonb_build_object(
      'fromStatus', screen_record.status,
      'toStatus', p_status,
      'deviceRevoked', p_status = 'disabled'::public.screen_status
    )
  );
  return p_screen_id;
end;
$$;

create or replace function public.rename_player_device_v1(
  p_tenant_id uuid,
  p_device_id uuid,
  p_device_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  device_record public.player_devices%rowtype;
begin
  if private.current_user_id() is null or not private.can_manage_screens(p_tenant_id) then
    raise exception 'actor cannot manage devices for this tenant' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if length(btrim(coalesce(p_device_name, ''))) not between 2 and 120 then
    raise exception 'device name length is invalid' using errcode = '23514';
  end if;

  select device.* into device_record
  from public.player_devices device
  where device.tenant_id = p_tenant_id and device.id = p_device_id
  for update;
  if not found then
    raise exception 'device not found' using errcode = 'P0002';
  end if;

  update public.player_devices set device_name = btrim(p_device_name)
  where tenant_id = p_tenant_id and id = p_device_id;
  perform private.audit_event(
    p_tenant_id, 'player_device.renamed', 'player_devices', p_device_id,
    'success', jsonb_build_object('screenId', device_record.screen_id)
  );
  return p_device_id;
end;
$$;

create or replace function public.revoke_player_device_v1(
  p_tenant_id uuid,
  p_device_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  device_record public.player_devices%rowtype;
begin
  if private.current_user_id() is null or not private.can_manage_screens(p_tenant_id) then
    raise exception 'actor cannot manage devices for this tenant' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  select device.* into device_record
  from public.player_devices device
  where device.tenant_id = p_tenant_id and device.id = p_device_id
  for update;
  if not found then
    raise exception 'device not found' using errcode = 'P0002';
  end if;

  update public.player_devices
  set status = 'revoked'::public.player_device_status,
      revoked_at = coalesce(revoked_at, now())
  where tenant_id = p_tenant_id and id = p_device_id;
  perform private.audit_event(
    p_tenant_id, 'player_device.revoked', 'player_devices', p_device_id,
    'success', jsonb_build_object('screenId', device_record.screen_id)
  );
  return p_device_id;
end;
$$;

create or replace function public.request_screen_sync_retry_v1(
  p_tenant_id uuid,
  p_screen_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  device_record public.player_devices%rowtype;
begin
  if private.current_user_id() is null or not private.can_manage_screens(p_tenant_id) then
    raise exception 'actor cannot manage devices for this tenant' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  select device.* into device_record
  from public.player_devices device
  join public.screens screen
    on screen.tenant_id = device.tenant_id and screen.id = device.screen_id
  where device.tenant_id = p_tenant_id
    and device.screen_id = p_screen_id
    and device.status = 'paired'::public.player_device_status
    and screen.status = 'active'::public.screen_status
  for update of device;
  if not found then
    raise exception 'active paired device not found' using errcode = 'P0002';
  end if;

  update public.player_devices set sync_retry_requested_at = now()
  where id = device_record.id;
  perform private.audit_event(
    p_tenant_id, 'player_device.sync_retry_requested', 'player_devices',
    device_record.id, 'success', jsonb_build_object('screenId', p_screen_id)
  );
  return device_record.id;
end;
$$;

create or replace function public.create_pairing_session_v3(
  p_code_hash text,
  p_token_hash text,
  p_device_fingerprint_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_code_hash text := lower(nullif(btrim(p_code_hash), ''));
  normalized_token_hash text := lower(nullif(btrim(p_token_hash), ''));
  normalized_fingerprint_hash text := lower(nullif(btrim(p_device_fingerprint_hash), ''));
  expires_at timestamptz := now() + interval '10 minutes';
  fingerprint_attempts integer;
  global_attempts integer;
begin
  if normalized_code_hash is null or normalized_code_hash !~ '^[a-f0-9]{64}$'
    or normalized_token_hash is null or normalized_token_hash !~ '^[a-f0-9]{64}$'
    or normalized_fingerprint_hash is null or normalized_fingerprint_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception 'pairing hashes must be sha256' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(normalized_fingerprint_hash, 27));
  delete from private.pairing_creation_attempts where attempted_at < now() - interval '1 day';
  select count(*)::integer into fingerprint_attempts
  from private.pairing_creation_attempts
  where fingerprint_hash = normalized_fingerprint_hash
    and attempted_at >= now() - interval '10 minutes';
  select count(*)::integer into global_attempts
  from private.pairing_creation_attempts
  where attempted_at >= now() - interval '1 minute';

  if fingerprint_attempts >= 5 or global_attempts >= 300 then
    insert into private.pairing_creation_attempts(fingerprint_hash, outcome)
    values (normalized_fingerprint_hash, 'rate_limited');
    return jsonb_build_object('ok', false, 'code', 'RATE_LIMITED');
  end if;

  update public.pairing_sessions
  set status = 'cancelled'::public.pairing_session_status
  where device_fingerprint_hash = normalized_fingerprint_hash
    and status = 'pending'::public.pairing_session_status;

  insert into public.pairing_sessions (
    code_hash, pending_token_hash, device_fingerprint_hash, expires_at
  ) values (
    normalized_code_hash, normalized_token_hash, normalized_fingerprint_hash, expires_at
  );
  insert into private.pairing_creation_attempts(fingerprint_hash, outcome)
  values (normalized_fingerprint_hash, 'created');
  return jsonb_build_object('ok', true, 'expiresAt', expires_at);
end;
$$;

create or replace function public.claim_pairing_session_v3(
  p_code_hash text,
  p_tenant_id uuid,
  p_screen_id uuid,
  p_device_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_code_hash text := lower(nullif(btrim(p_code_hash), ''));
  pairing_record public.pairing_sessions%rowtype;
  screen_record public.screens%rowtype;
  recent_attempts integer;
  device_id uuid;
begin
  if actor_id is null or not private.can_manage_screens(p_tenant_id) then
    raise exception 'actor cannot pair devices for this tenant' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if normalized_code_hash is null or normalized_code_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'pairing code hash must be sha256' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor_id::text, 28));
  delete from private.pairing_claim_attempts where attempted_at < now() - interval '1 day';
  select count(*)::integer into recent_attempts
  from private.pairing_claim_attempts
  where actor_user_id = actor_id and attempted_at >= now() - interval '5 minutes';
  if recent_attempts >= 10 then
    insert into private.pairing_claim_attempts(actor_user_id, outcome)
    values (actor_id, 'rate_limited');
    return jsonb_build_object('ok', false, 'code', 'RATE_LIMITED');
  end if;

  select pairing.* into pairing_record
  from public.pairing_sessions pairing
  where pairing.code_hash = normalized_code_hash
    and pairing.status = 'pending'::public.pairing_session_status
  for update;
  if not found then
    insert into private.pairing_claim_attempts(actor_user_id, outcome)
    values (actor_id, 'invalid');
    return jsonb_build_object('ok', false, 'code', 'INVALID_OR_REPLAYED');
  end if;
  if pairing_record.expires_at <= now() then
    update public.pairing_sessions set status = 'expired'::public.pairing_session_status
    where id = pairing_record.id;
    insert into private.pairing_claim_attempts(actor_user_id, outcome)
    values (actor_id, 'expired');
    return jsonb_build_object('ok', false, 'code', 'EXPIRED');
  end if;
  if pairing_record.pending_token_hash is null then
    insert into private.pairing_claim_attempts(actor_user_id, outcome)
    values (actor_id, 'invalid');
    return jsonb_build_object('ok', false, 'code', 'INVALID_OR_REPLAYED');
  end if;

  select screen.* into screen_record
  from public.screens screen
  where screen.tenant_id = p_tenant_id
    and screen.id = p_screen_id
    and screen.status = 'active'::public.screen_status
  for update;
  if not found then
    insert into private.pairing_claim_attempts(actor_user_id, outcome)
    values (actor_id, 'screen_unavailable');
    return jsonb_build_object('ok', false, 'code', 'SCREEN_UNAVAILABLE');
  end if;

  update public.player_devices
  set status = 'revoked'::public.player_device_status, revoked_at = now()
  where tenant_id = p_tenant_id and screen_id = p_screen_id
    and status = 'paired'::public.player_device_status;
  insert into public.player_devices (
    tenant_id, screen_id, device_name, token_hash, desired_release_id
  ) values (
    p_tenant_id, p_screen_id,
    coalesce(nullif(btrim(p_device_name), ''), 'VeyoCast player'),
    pairing_record.pending_token_hash, screen_record.assigned_release_id
  ) returning id into device_id;
  update public.pairing_sessions
  set status = 'claimed'::public.pairing_session_status,
      claimed_by = actor_id,
      claimed_tenant_id = p_tenant_id,
      claimed_screen_id = p_screen_id,
      paired_device_id = device_id,
      claimed_at = now(),
      pending_token_hash = null
  where id = pairing_record.id;
  insert into private.pairing_claim_attempts(actor_user_id, outcome)
  values (actor_id, 'paired');
  perform private.audit_event(
    p_tenant_id, 'player_device.paired', 'player_devices', device_id,
    'success', jsonb_build_object(
      'screenId', p_screen_id, 'pairingSessionId', pairing_record.id
    )
  );
  return jsonb_build_object('ok', true, 'deviceId', device_id);
end;
$$;

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
  set capabilities = p_capabilities,
      platform = coalesce(nullif(btrim(p_platform), ''), platform),
      last_error_code = reported_error_code,
      last_error_at = case when reported_error_code is null then null else now() end,
      sync_retry_requested_at = null
  where id = device_record.id;

  if p_sync_phase is not null then
    sync_release_id := case when p_sync_phase = 'active' then p_active_release_id
      else coalesce(p_desired_release_id, p_active_release_id) end;
    insert into public.player_sync_events (
      tenant_id, device_id, screen_id, release_id, phase, detail
    ) values (
      heartbeat_record.tenant_id, heartbeat_record.device_id,
      heartbeat_record.screen_id, sync_release_id, p_sync_phase,
      coalesce(p_sync_detail, '{}'::jsonb)
    );
  end if;
  return heartbeat_id;
end;
$$;

revoke all on function private.can_manage_screens(uuid) from public, anon, authenticated;
revoke all on function private.require_active_tenant_command(uuid) from public, anon, authenticated;
revoke all on function public.create_screen_v1(uuid, text, text, text, integer, integer, uuid) from public, anon;
revoke all on function public.update_screen_v1(uuid, uuid, text, text, text, integer, integer, public.screen_status) from public, anon;
revoke all on function public.rename_player_device_v1(uuid, uuid, text) from public, anon;
revoke all on function public.revoke_player_device_v1(uuid, uuid) from public, anon;
revoke all on function public.request_screen_sync_retry_v1(uuid, uuid) from public, anon;
revoke all on function public.create_pairing_session_v3(text, text, text) from public;
revoke all on function public.claim_pairing_session_v3(text, uuid, uuid, text) from public, anon;

grant execute on function public.create_screen_v1(uuid, text, text, text, integer, integer, uuid) to authenticated;
grant execute on function public.update_screen_v1(uuid, uuid, text, text, text, integer, integer, public.screen_status) to authenticated;
grant execute on function public.rename_player_device_v1(uuid, uuid, text) to authenticated;
grant execute on function public.revoke_player_device_v1(uuid, uuid) to authenticated;
grant execute on function public.request_screen_sync_retry_v1(uuid, uuid) to authenticated;
grant execute on function public.create_pairing_session_v3(text, text, text) to anon, authenticated;
grant execute on function public.claim_pairing_session_v3(text, uuid, uuid, text) to authenticated;
