-- Tenant-safe screen deactivation and logical removal.
-- A removed screen remains as a tombstone so immutable release assignments,
-- device history and append-only audit evidence stay referentially intact.

alter table public.screens
  add column deleted_at timestamptz,
  add column deleted_by uuid,
  add constraint screens_removal_state_check check (
    (deleted_at is null and deleted_by is null)
    or (
      deleted_at is not null
      and status = 'disabled'::public.screen_status
    )
  );

create index screens_tenant_live_status_idx
  on public.screens(tenant_id, status, created_at desc)
  where deleted_at is null;

create or replace function private.reject_removed_screen_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.deleted_at is not null then
    raise exception 'screen not found' using errcode = 'P0002';
  end if;
  return new;
end;
$$;

create trigger screens_reject_removed_mutation
before update on public.screens
for each row execute function private.reject_removed_screen_mutation();

create or replace function private.enforce_tenant_screen_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  actor_may_create boolean;
  allowed_screens integer;
  current_screens integer;
begin
  if actor_id is not null then
    select
      exists (
        select 1
        from public.tenant_memberships membership
        where membership.tenant_id = new.tenant_id
          and membership.user_id = actor_id
          and membership.role in ('tenant_owner', 'tenant_admin')
      )
      or exists (
        select 1
        from public.platform_memberships membership
        where membership.user_id = actor_id
          and membership.role in ('platform_owner', 'platform_admin')
      )
    into actor_may_create;

    if not coalesce(actor_may_create, false) then
      return new;
    end if;
  end if;

  select tenant.screen_limit into allowed_screens
  from public.tenants tenant
  where tenant.id = new.tenant_id
  for update;

  if allowed_screens is null then
    raise exception 'tenant not found' using errcode = 'P0002';
  end if;

  select count(*) into current_screens
  from public.screens screen
  where screen.tenant_id = new.tenant_id
    and screen.deleted_at is null;

  if current_screens >= allowed_screens then
    raise exception 'tenant screen limit reached' using errcode = '23514';
  end if;
  return new;
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
  where screen.tenant_id = p_tenant_id
    and screen.deleted_at is null;

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

create or replace function public.deactivate_screen_v1(
  p_tenant_id uuid,
  p_screen_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  screen_record public.screens%rowtype;
  revoked_device_count integer := 0;
begin
  if private.current_user_id() is null or not private.can_manage_screens(p_tenant_id) then
    raise exception 'actor cannot manage screens for this tenant' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  select screen.* into screen_record
  from public.screens screen
  where screen.tenant_id = p_tenant_id
    and screen.id = p_screen_id
    and screen.deleted_at is null
  for update;
  if not found then
    raise exception 'screen not found' using errcode = 'P0002';
  end if;

  if screen_record.status = 'disabled'::public.screen_status then
    return p_screen_id;
  end if;

  update public.player_devices
  set status = 'revoked'::public.player_device_status,
      revoked_at = coalesce(revoked_at, now())
  where tenant_id = p_tenant_id
    and screen_id = p_screen_id
    and status = 'paired'::public.player_device_status;
  get diagnostics revoked_device_count = row_count;

  update public.screens
  set status = 'disabled'::public.screen_status
  where tenant_id = p_tenant_id and id = p_screen_id;

  perform private.audit_event(
    p_tenant_id,
    'screen.deactivated',
    'screens',
    p_screen_id,
    'success',
    jsonb_build_object(
      'fromStatus', screen_record.status,
      'revokedDeviceCount', revoked_device_count,
      'offlineEnforcementPending', revoked_device_count > 0
    )
  );
  return p_screen_id;
end;
$$;

create or replace function public.remove_screen_v1(
  p_tenant_id uuid,
  p_screen_id uuid,
  p_confirmation_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  screen_record public.screens%rowtype;
begin
  if actor_id is null or not private.can_manage_screens(p_tenant_id) then
    raise exception 'actor cannot manage screens for this tenant' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  select screen.* into screen_record
  from public.screens screen
  where screen.tenant_id = p_tenant_id
    and screen.id = p_screen_id
    and screen.deleted_at is null
  for update;
  if not found then
    raise exception 'screen not found' using errcode = 'P0002';
  end if;
  if screen_record.status <> 'disabled'::public.screen_status then
    raise exception 'screen must be disabled before removal' using errcode = 'P0003';
  end if;
  if p_confirmation_name is null or btrim(p_confirmation_name) <> screen_record.name then
    raise exception 'screen name confirmation does not match' using errcode = 'P0004';
  end if;

  update public.player_devices
  set status = 'revoked'::public.player_device_status,
      revoked_at = coalesce(revoked_at, now())
  where tenant_id = p_tenant_id
    and screen_id = p_screen_id
    and status = 'paired'::public.player_device_status;

  update public.screens
  set status = 'disabled'::public.screen_status,
      name = 'Verwijderd scherm',
      location = null,
      resolution_width = null,
      resolution_height = null,
      assigned_playlist_id = null,
      assigned_release_id = null,
      created_by = null,
      deleted_at = now(),
      deleted_by = actor_id
  where tenant_id = p_tenant_id and id = p_screen_id;

  perform private.audit_event(
    p_tenant_id,
    'screen.removed',
    'screens',
    p_screen_id,
    'success',
    jsonb_build_object(
      'previousReleaseId', screen_record.assigned_release_id,
      'historyRetained', true
    )
  );
  return p_screen_id;
end;
$$;

-- Screen removal must always pass the guarded command boundary. Existing
-- direct insert/update privileges stay column-scoped so deletion metadata
-- cannot be forged through PostgREST.
drop policy if exists "screens_delete_by_admin" on public.screens;
revoke delete on public.screens from authenticated;
revoke insert, update on public.screens from authenticated;
grant insert (
  id, tenant_id, name, location, orientation, resolution_width,
  resolution_height, status, assigned_playlist_id, assigned_release_id,
  created_by, created_at, updated_at
) on public.screens to authenticated;
grant update (
  name, location, orientation, resolution_width, resolution_height, status,
  assigned_playlist_id, assigned_release_id
) on public.screens to authenticated;

revoke all on function public.deactivate_screen_v1(uuid, uuid) from public;
revoke all on function public.remove_screen_v1(uuid, uuid, text) from public;
grant execute on function public.deactivate_screen_v1(uuid, uuid) to authenticated;
grant execute on function public.remove_screen_v1(uuid, uuid, text) to authenticated;

-- Removed tombstones no longer consume a tenant's operational screen limit.
create or replace function public.update_platform_tenant_screen_limit(
  p_tenant_id uuid,
  p_screen_limit integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_limit integer;
  current_screen_count integer;
begin
  perform private.require_platform_lifecycle_aal2();
  if p_screen_limit is null or p_screen_limit not between 1 and 10000 then
    raise exception 'tenant screen limit must be between 1 and 10000' using errcode = '23514';
  end if;

  select tenant.screen_limit into current_limit
  from public.tenants tenant where tenant.id = p_tenant_id for update;
  if not found then raise exception 'tenant not found' using errcode = 'P0002'; end if;

  select count(*) into current_screen_count
  from public.screens screen
  where screen.tenant_id = p_tenant_id and screen.deleted_at is null;
  if p_screen_limit < current_screen_count then
    raise exception 'screen limit cannot be lower than current screen usage' using errcode = '23514';
  end if;
  if current_limit = p_screen_limit then return; end if;

  update public.tenants set screen_limit = p_screen_limit where id = p_tenant_id;
  perform private.audit_event(
    p_tenant_id,
    'tenant.screen_limit.changed',
    'tenants',
    p_tenant_id,
    'success',
    jsonb_build_object('fromLimit', current_limit, 'toLimit', p_screen_limit)
  );
end;
$$;
