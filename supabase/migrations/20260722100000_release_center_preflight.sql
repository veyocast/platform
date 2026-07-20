-- S26: append-only deployment history, safe reassignment and truthful Player telemetry.

create table public.release_screen_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  release_id uuid not null,
  screen_id uuid not null,
  assignment_kind text not null check (assignment_kind in ('published', 'reassigned')),
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  foreign key (tenant_id, release_id)
    references public.playlist_releases(tenant_id, id)
    on delete restrict,
  foreign key (tenant_id, screen_id)
    references public.screens(tenant_id, id)
    on delete restrict
);

create index release_screen_assignments_tenant_release_idx
  on public.release_screen_assignments(tenant_id, release_id, assigned_at desc);
create index release_screen_assignments_tenant_screen_idx
  on public.release_screen_assignments(tenant_id, screen_id, assigned_at desc);

create trigger release_screen_assignments_reject_update
before update on public.release_screen_assignments
for each row execute function private.reject_playlist_release_mutation();

create trigger release_screen_assignments_reject_delete
before delete on public.release_screen_assignments
for each row execute function private.reject_playlist_release_mutation();

alter table public.release_screen_assignments enable row level security;

grant select on public.release_screen_assignments to authenticated, service_role;

create policy "release_screen_assignments_select_by_scope"
on public.release_screen_assignments
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

insert into public.release_screen_assignments (
  tenant_id,
  release_id,
  screen_id,
  assignment_kind,
  assigned_by,
  assigned_at
)
select
  screen.tenant_id,
  screen.assigned_release_id,
  screen.id,
  'published',
  release.published_by,
  release.published_at
from public.screens screen
join public.playlist_releases release
  on release.tenant_id = screen.tenant_id
  and release.id = screen.assigned_release_id
where screen.assigned_release_id is not null;

create or replace function public.publish_playlist_to_screens_v2(
  p_playlist_id uuid,
  p_expected_revision bigint,
  p_screen_ids uuid[],
  p_release_notes text default null
)
returns table (
  outcome text,
  actual_revision bigint,
  release_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  playlist_record public.playlists%rowtype;
begin
  select playlist.*
  into playlist_record
  from public.playlists playlist
  where playlist.id = p_playlist_id
  for update;

  if not found then
    raise exception 'playlist not found' using errcode = 'P0002';
  end if;

  if not private.can_write_playlist(playlist_record.tenant_id) then
    raise exception 'actor cannot publish this playlist' using errcode = '42501';
  end if;

  if playlist_record.revision <> p_expected_revision then
    return query select 'conflict'::text, playlist_record.revision, null::uuid;
    return;
  end if;

  release_id := public.publish_playlist_to_screens(
    p_playlist_id,
    p_screen_ids,
    p_release_notes
  );

  insert into public.release_screen_assignments (
    tenant_id,
    release_id,
    screen_id,
    assignment_kind,
    assigned_by
  )
  select
    playlist_record.tenant_id,
    release_id,
    screen_id,
    'published',
    private.current_user_id()
  from unnest(p_screen_ids) as screen_id;

  outcome := 'published';
  actual_revision := playlist_record.revision;
  return next;
end;
$$;

create or replace function public.reassign_playlist_release(
  p_release_id uuid,
  p_screen_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  release_record public.playlist_releases%rowtype;
  target_count integer;
begin
  select release.*
  into release_record
  from public.playlist_releases release
  where release.id = p_release_id;

  if not found then
    raise exception 'release not found' using errcode = 'P0002';
  end if;

  if not private.can_write_playlist(release_record.tenant_id) then
    raise exception 'actor cannot reassign this release' using errcode = '42501';
  end if;

  if coalesce(array_length(p_screen_ids, 1), 0) = 0 then
    raise exception 'at least one target screen is required' using errcode = '23514';
  end if;

  select count(*)::integer
  into target_count
  from public.screens screen
  where screen.tenant_id = release_record.tenant_id
    and screen.id = any(p_screen_ids)
    and screen.status <> 'disabled'::public.screen_status;

  if target_count <> (
    select count(distinct screen_id)::integer from unnest(p_screen_ids) as screen_id
  ) or target_count <> array_length(p_screen_ids, 1) then
    raise exception 'one or more target screens are unavailable' using errcode = '23514';
  end if;

  update public.screens
  set
    assigned_playlist_id = release_record.playlist_id,
    assigned_release_id = release_record.id
  where tenant_id = release_record.tenant_id
    and id = any(p_screen_ids);

  update public.player_devices
  set desired_release_id = release_record.id
  where tenant_id = release_record.tenant_id
    and screen_id = any(p_screen_ids)
    and status = 'paired'::public.player_device_status;

  insert into public.release_screen_assignments (
    tenant_id,
    release_id,
    screen_id,
    assignment_kind,
    assigned_by
  )
  select
    release_record.tenant_id,
    release_record.id,
    screen_id,
    'reassigned',
    private.current_user_id()
  from unnest(p_screen_ids) as screen_id;

  perform private.audit_event(
    release_record.tenant_id,
    'playlist.release.reassigned',
    'playlist_releases',
    release_record.id,
    'success',
    jsonb_build_object(
      'playlistId', release_record.playlist_id,
      'screenIds', p_screen_ids
    )
  );

  return target_count;
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
begin
  if p_capabilities is null or jsonb_typeof(p_capabilities) <> 'object' then
    raise exception 'capabilities must be an object' using errcode = '23514';
  end if;

  heartbeat_id := public.record_player_heartbeat(
    p_token_hash,
    p_runtime_state,
    p_active_release_id,
    p_storage_used_bytes,
    p_storage_quota_bytes,
    p_app_version,
    null,
    p_sync_detail
  );

  select heartbeat.*
  into heartbeat_record
  from public.player_heartbeats heartbeat
  where heartbeat.id = heartbeat_id;

  select device.*
  into device_record
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
  set
    capabilities = p_capabilities,
    platform = coalesce(nullif(btrim(p_platform), ''), platform)
  where id = device_record.id;

  if p_sync_phase is not null then
    sync_release_id := case
      when p_sync_phase = 'active' then p_active_release_id
      else coalesce(p_desired_release_id, p_active_release_id)
    end;

    insert into public.player_sync_events (
      tenant_id,
      device_id,
      screen_id,
      release_id,
      phase,
      detail
    )
    values (
      heartbeat_record.tenant_id,
      heartbeat_record.device_id,
      heartbeat_record.screen_id,
      sync_release_id,
      p_sync_phase,
      coalesce(p_sync_detail, '{}'::jsonb)
    );
  end if;

  return heartbeat_id;
end;
$$;

revoke all on table public.release_screen_assignments from anon;
revoke insert, update, delete on table public.release_screen_assignments from authenticated;
revoke all on function public.reassign_playlist_release(uuid, uuid[]) from public, anon;
revoke all on function public.record_player_heartbeat_v2(text, text, uuid, uuid, bigint, bigint, text, text, jsonb, text, jsonb) from public;

grant execute on function public.reassign_playlist_release(uuid, uuid[]) to authenticated;
grant execute on function public.record_player_heartbeat_v2(text, text, uuid, uuid, bigint, bigint, text, text, jsonb, text, jsonb) to anon, authenticated;
