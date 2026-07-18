-- Live pilot vertical slice: secure device pairing, atomic assignment and telemetry.
-- PostgREST exposes the JWT subject in request.jwt.claims; pgTAP and older
-- runtimes may still set request.jwt.claim.sub directly.
create or replace function private.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    (
      nullif(current_setting('request.jwt.claims', true), '')::jsonb
      ->> 'sub'
    )::uuid
  );
$$;

-- These privileges are consumed only by server-only clients. RLS remains the
-- boundary for browser-authenticated users.
grant select, insert, update, delete on
  public.media_assets,
  public.media_variants
to service_role;

grant select on
  public.playlist_releases,
  public.playlist_release_items
to service_role;

alter table public.pairing_sessions
  add column pending_token_hash text
  check (
    pending_token_hash is null
    or pending_token_hash ~ '^[a-f0-9]{64}$'
  );

create table public.player_heartbeats (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  device_id uuid not null,
  screen_id uuid not null,
  active_release_id uuid,
  runtime_state text not null check (runtime_state in (
    'READY',
    'PLAYING',
    'DOWNLOADING',
    'VERIFYING',
    'SWITCH_PENDING',
    'OFFLINE_PLAYING',
    'ERROR_RECOVERABLE'
  )),
  storage_used_bytes bigint check (storage_used_bytes is null or storage_used_bytes >= 0),
  storage_quota_bytes bigint check (storage_quota_bytes is null or storage_quota_bytes >= 0),
  app_version text,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, device_id)
    references public.player_devices(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, screen_id)
    references public.screens(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, active_release_id)
    references public.playlist_releases(tenant_id, id)
    on delete restrict
);

create index player_heartbeats_tenant_device_created_idx
  on public.player_heartbeats(tenant_id, device_id, created_at desc);
create index player_heartbeats_tenant_screen_created_idx
  on public.player_heartbeats(tenant_id, screen_id, created_at desc);

create table public.player_sync_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  device_id uuid not null,
  screen_id uuid not null,
  release_id uuid,
  phase text not null check (phase in (
    'manifest_received',
    'downloading',
    'verifying',
    'switch_pending',
    'active',
    'failed'
  )),
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, device_id)
    references public.player_devices(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, screen_id)
    references public.screens(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, release_id)
    references public.playlist_releases(tenant_id, id)
    on delete restrict
);

create index player_sync_events_tenant_device_created_idx
  on public.player_sync_events(tenant_id, device_id, created_at desc);
create index player_sync_events_tenant_release_created_idx
  on public.player_sync_events(tenant_id, release_id, created_at desc);

alter table public.player_heartbeats enable row level security;
alter table public.player_sync_events enable row level security;

grant select on public.player_heartbeats, public.player_sync_events to authenticated;

create policy "player_heartbeats_select_by_scope"
on public.player_heartbeats
for select
to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner',
    'platform_admin',
    'platform_support'
  ]::public.platform_role[])
);

create policy "player_sync_events_select_by_scope"
on public.player_sync_events
for select
to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner',
    'platform_admin',
    'platform_support'
  ]::public.platform_role[])
);

create or replace function public.create_pairing_session_v2(
  p_code_hash text,
  p_token_hash text,
  p_device_fingerprint_hash text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_code_hash text := lower(nullif(btrim(p_code_hash), ''));
  normalized_token_hash text := lower(nullif(btrim(p_token_hash), ''));
  normalized_fingerprint_hash text := lower(nullif(btrim(p_device_fingerprint_hash), ''));
  session_id uuid;
begin
  if normalized_code_hash is null
    or normalized_code_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception 'pairing code hash must be sha256' using errcode = '23514';
  end if;

  if normalized_token_hash is null
    or normalized_token_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception 'device token hash must be sha256' using errcode = '23514';
  end if;

  if normalized_fingerprint_hash is not null
    and normalized_fingerprint_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception 'device fingerprint hash must be sha256' using errcode = '23514';
  end if;

  update public.pairing_sessions
  set status = 'expired'::public.pairing_session_status
  where status = 'pending'::public.pairing_session_status
    and expires_at <= now();

  insert into public.pairing_sessions (
    code_hash,
    pending_token_hash,
    device_fingerprint_hash,
    expires_at
  )
  values (
    normalized_code_hash,
    normalized_token_hash,
    normalized_fingerprint_hash,
    now() + interval '10 minutes'
  )
  returning id into session_id;

  return session_id;
end;
$$;

create or replace function public.claim_pairing_session_v2(
  p_code_hash text,
  p_tenant_id uuid,
  p_screen_id uuid,
  p_device_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_code_hash text := lower(nullif(btrim(p_code_hash), ''));
  pairing_record public.pairing_sessions%rowtype;
  screen_record public.screens%rowtype;
  device_id uuid;
begin
  if actor_id is null then
    raise exception 'claim_pairing_session requires an authenticated user' using errcode = '42501';
  end if;

  if normalized_code_hash is null
    or normalized_code_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception 'pairing code hash must be sha256' using errcode = '23514';
  end if;

  if not (
    private.has_tenant_role(p_tenant_id, array[
      'tenant_owner',
      'tenant_admin'
    ]::public.tenant_role[])
    or private.is_platform_member(array[
      'platform_owner',
      'platform_admin'
    ]::public.platform_role[])
  ) then
    raise exception 'actor cannot pair devices for this tenant' using errcode = '42501';
  end if;

  select pairing.*
  into pairing_record
  from public.pairing_sessions pairing
  where pairing.code_hash = normalized_code_hash
    and pairing.status = 'pending'::public.pairing_session_status
  for update;

  if not found then
    raise exception 'pairing session not found or unavailable' using errcode = 'P0002';
  end if;

  if pairing_record.expires_at <= now() then
    update public.pairing_sessions
    set status = 'expired'::public.pairing_session_status
    where id = pairing_record.id;

    raise exception 'pairing session expired' using errcode = '23514';
  end if;

  if pairing_record.pending_token_hash is null then
    raise exception 'pairing session has no device token' using errcode = '23514';
  end if;

  select screen.*
  into screen_record
  from public.screens screen
  where screen.tenant_id = p_tenant_id
    and screen.id = p_screen_id
    and screen.status <> 'disabled'::public.screen_status;

  if not found then
    raise exception 'screen not found or disabled' using errcode = 'P0002';
  end if;

  update public.player_devices
  set
    status = 'revoked'::public.player_device_status,
    revoked_at = now()
  where tenant_id = p_tenant_id
    and screen_id = p_screen_id
    and status = 'paired'::public.player_device_status;

  insert into public.player_devices (
    tenant_id,
    screen_id,
    device_name,
    token_hash,
    desired_release_id
  )
  values (
    p_tenant_id,
    p_screen_id,
    coalesce(nullif(btrim(p_device_name), ''), 'VeyoCast player'),
    pairing_record.pending_token_hash,
    screen_record.assigned_release_id
  )
  returning id into device_id;

  update public.pairing_sessions
  set
    status = 'claimed'::public.pairing_session_status,
    claimed_by = actor_id,
    claimed_tenant_id = p_tenant_id,
    claimed_screen_id = p_screen_id,
    paired_device_id = device_id,
    claimed_at = now(),
    pending_token_hash = null
  where id = pairing_record.id;

  perform private.audit_event(
    p_tenant_id,
    'player_device.paired',
    'player_devices',
    device_id,
    'success',
    jsonb_build_object(
      'screenId', p_screen_id,
      'pairingSessionId', pairing_record.id
    )
  );

  return device_id;
end;
$$;

create or replace function public.publish_playlist_to_screens(
  p_playlist_id uuid,
  p_screen_ids uuid[],
  p_release_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  playlist_record public.playlists%rowtype;
  release_id uuid;
  target_count integer;
begin
  select playlist.*
  into playlist_record
  from public.playlists playlist
  where playlist.id = p_playlist_id;

  if not found then
    raise exception 'playlist not found' using errcode = 'P0002';
  end if;

  if not (
    private.has_tenant_role(playlist_record.tenant_id, array[
      'tenant_owner',
      'tenant_admin',
      'tenant_editor'
    ]::public.tenant_role[])
    or private.is_platform_member(array[
      'platform_owner',
      'platform_admin'
    ]::public.platform_role[])
  ) then
    raise exception 'actor cannot publish this playlist' using errcode = '42501';
  end if;

  if coalesce(array_length(p_screen_ids, 1), 0) = 0 then
    raise exception 'at least one target screen is required' using errcode = '23514';
  end if;

  select count(*)::integer
  into target_count
  from public.screens screen
  where screen.tenant_id = playlist_record.tenant_id
    and screen.id = any(p_screen_ids)
    and screen.status <> 'disabled'::public.screen_status;

  if target_count <> array_length(p_screen_ids, 1) then
    raise exception 'one or more target screens are unavailable' using errcode = '23514';
  end if;

  release_id := public.publish_playlist(p_playlist_id, p_release_notes);

  update public.screens
  set
    assigned_playlist_id = p_playlist_id,
    assigned_release_id = release_id
  where tenant_id = playlist_record.tenant_id
    and id = any(p_screen_ids);

  update public.player_devices
  set desired_release_id = release_id
  where tenant_id = playlist_record.tenant_id
    and screen_id = any(p_screen_ids)
    and status = 'paired'::public.player_device_status;

  perform private.audit_event(
    playlist_record.tenant_id,
    'playlist.release.assigned',
    'playlist_releases',
    release_id,
    'success',
    jsonb_build_object(
      'playlistId', p_playlist_id,
      'screenIds', p_screen_ids
    )
  );

  return release_id;
end;
$$;

create or replace function public.record_player_heartbeat(
  p_token_hash text,
  p_runtime_state text,
  p_active_release_id uuid default null,
  p_storage_used_bytes bigint default null,
  p_storage_quota_bytes bigint default null,
  p_app_version text default null,
  p_sync_phase text default null,
  p_sync_detail jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_token_hash text := lower(nullif(btrim(p_token_hash), ''));
  device_record public.player_devices%rowtype;
  heartbeat_id uuid;
begin
  if normalized_token_hash is null
    or normalized_token_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception 'device token hash must be sha256' using errcode = '23514';
  end if;

  select device.*
  into device_record
  from public.player_devices device
  join public.screens screen
    on screen.tenant_id = device.tenant_id
    and screen.id = device.screen_id
  where device.token_hash = normalized_token_hash
    and device.status = 'paired'::public.player_device_status
    and screen.status = 'active'::public.screen_status
  for update of device;

  if not found then
    raise exception 'active device not found' using errcode = 'P0002';
  end if;

  if p_active_release_id is not null
    and not exists (
      select 1
      from public.playlist_releases release
      where release.tenant_id = device_record.tenant_id
        and release.id = p_active_release_id
    )
  then
    raise exception 'active release does not belong to device tenant' using errcode = '23514';
  end if;

  update public.player_devices
  set
    active_release_id = coalesce(p_active_release_id, active_release_id),
    app_version = coalesce(nullif(btrim(p_app_version), ''), app_version),
    storage_used_bytes = coalesce(p_storage_used_bytes, storage_used_bytes),
    storage_quota_bytes = coalesce(p_storage_quota_bytes, storage_quota_bytes),
    last_seen_at = now()
  where id = device_record.id;

  insert into public.player_heartbeats (
    tenant_id,
    device_id,
    screen_id,
    active_release_id,
    runtime_state,
    storage_used_bytes,
    storage_quota_bytes,
    app_version
  )
  values (
    device_record.tenant_id,
    device_record.id,
    device_record.screen_id,
    p_active_release_id,
    p_runtime_state,
    p_storage_used_bytes,
    p_storage_quota_bytes,
    nullif(btrim(p_app_version), '')
  )
  returning id into heartbeat_id;

  if p_sync_phase is not null then
    insert into public.player_sync_events (
      tenant_id,
      device_id,
      screen_id,
      release_id,
      phase,
      detail
    )
    values (
      device_record.tenant_id,
      device_record.id,
      device_record.screen_id,
      p_active_release_id,
      p_sync_phase,
      coalesce(p_sync_detail, '{}'::jsonb)
    );
  end if;

  return heartbeat_id;
end;
$$;

revoke all on function public.create_pairing_session_v2(text, text, text) from public;
revoke all on function public.claim_pairing_session_v2(text, uuid, uuid, text) from public;
revoke all on function public.publish_playlist_to_screens(uuid, uuid[], text) from public;
revoke all on function public.record_player_heartbeat(text, text, uuid, bigint, bigint, text, text, jsonb) from public;

grant execute on function public.create_pairing_session_v2(text, text, text) to anon, authenticated;
grant execute on function public.claim_pairing_session_v2(text, uuid, uuid, text) to authenticated;
grant execute on function public.publish_playlist_to_screens(uuid, uuid[], text) to authenticated;
grant execute on function public.record_player_heartbeat(text, text, uuid, bigint, bigint, text, text, jsonb) to anon, authenticated;
