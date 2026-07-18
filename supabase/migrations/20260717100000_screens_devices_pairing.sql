do $$
begin
  create type public.screen_status as enum (
    'active',
    'maintenance',
    'disabled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.player_device_status as enum (
    'paired',
    'revoked',
    'disabled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.pairing_session_status as enum (
    'pending',
    'claimed',
    'expired',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.playlist_releases
  add constraint playlist_releases_tenant_playlist_id_uq unique (tenant_id, playlist_id, id);

create table public.screens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(btrim(name)) >= 2),
  location text,
  orientation text not null default 'landscape' check (orientation in ('landscape', 'portrait')),
  resolution_width integer check (resolution_width is null or resolution_width > 0),
  resolution_height integer check (resolution_height is null or resolution_height > 0),
  status public.screen_status not null default 'active',
  assigned_playlist_id uuid,
  assigned_release_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, assigned_playlist_id)
    references public.playlists(tenant_id, id)
    on delete restrict,
  foreign key (tenant_id, assigned_playlist_id, assigned_release_id)
    references public.playlist_releases(tenant_id, playlist_id, id)
    on delete restrict,
  check (
    (assigned_release_id is null and assigned_playlist_id is null)
    or assigned_playlist_id is not null
  )
);

create index screens_tenant_status_idx on public.screens(tenant_id, status);
create index screens_tenant_created_at_idx on public.screens(tenant_id, created_at desc);

create table public.player_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  screen_id uuid not null,
  device_name text,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  status public.player_device_status not null default 'paired',
  app_version text,
  platform text,
  user_agent_summary text,
  capabilities jsonb not null default '{}'::jsonb check (jsonb_typeof(capabilities) = 'object'),
  storage_quota_bytes bigint check (storage_quota_bytes is null or storage_quota_bytes >= 0),
  storage_used_bytes bigint check (storage_used_bytes is null or storage_used_bytes >= 0),
  active_release_id uuid,
  desired_release_id uuid,
  last_seen_at timestamptz,
  paired_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, screen_id)
    references public.screens(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, active_release_id)
    references public.playlist_releases(tenant_id, id)
    on delete restrict,
  foreign key (tenant_id, desired_release_id)
    references public.playlist_releases(tenant_id, id)
    on delete restrict,
  check (
    status <> 'revoked'::public.player_device_status
    or revoked_at is not null
  )
);

create unique index player_devices_token_hash_uq on public.player_devices(token_hash);
create unique index player_devices_one_paired_per_screen_uq
  on public.player_devices(tenant_id, screen_id)
  where status = 'paired'::public.player_device_status;
create index player_devices_tenant_screen_idx on public.player_devices(tenant_id, screen_id);
create index player_devices_tenant_status_idx on public.player_devices(tenant_id, status);

create table public.pairing_sessions (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  device_fingerprint_hash text check (
    device_fingerprint_hash is null
    or device_fingerprint_hash ~ '^[a-f0-9]{64}$'
  ),
  status public.pairing_session_status not null default 'pending',
  expires_at timestamptz not null,
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_tenant_id uuid,
  claimed_screen_id uuid,
  paired_device_id uuid,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (claimed_tenant_id, claimed_screen_id)
    references public.screens(tenant_id, id)
    on delete set null,
  foreign key (claimed_tenant_id, paired_device_id)
    references public.player_devices(tenant_id, id)
    on delete set null,
  check (expires_at > created_at),
  check (
    status <> 'claimed'::public.pairing_session_status
    or (
      claimed_by is not null
      and claimed_tenant_id is not null
      and claimed_screen_id is not null
      and paired_device_id is not null
      and claimed_at is not null
    )
  )
);

create index pairing_sessions_status_expires_at_idx on public.pairing_sessions(status, expires_at);
create index pairing_sessions_claimed_tenant_idx on public.pairing_sessions(claimed_tenant_id, claimed_at desc);

alter table public.audit_events
  add constraint audit_events_actor_device_id_fkey
  foreign key (actor_device_id)
  references public.player_devices(id)
  on delete set null;

create trigger screens_set_updated_at
before update on public.screens
for each row execute function private.set_updated_at();

create trigger player_devices_set_updated_at
before update on public.player_devices
for each row execute function private.set_updated_at();

create trigger pairing_sessions_set_updated_at
before update on public.pairing_sessions
for each row execute function private.set_updated_at();

create or replace function public.create_pairing_session(
  p_code_hash text,
  p_device_fingerprint_hash text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_code_hash text := lower(nullif(btrim(p_code_hash), ''));
  normalized_fingerprint_hash text := lower(nullif(btrim(p_device_fingerprint_hash), ''));
  session_id uuid;
begin
  if normalized_code_hash is null
    or normalized_code_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception 'pairing code hash must be sha256' using errcode = '23514';
  end if;

  if normalized_fingerprint_hash is not null
    and normalized_fingerprint_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception 'device fingerprint hash must be sha256' using errcode = '23514';
  end if;

  insert into public.pairing_sessions (
    code_hash,
    device_fingerprint_hash,
    expires_at
  )
  values (
    normalized_code_hash,
    normalized_fingerprint_hash,
    now() + interval '10 minutes'
  )
  returning id into session_id;

  return session_id;
end;
$$;

create or replace function public.claim_pairing_session(
  p_code_hash text,
  p_tenant_id uuid,
  p_screen_id uuid,
  p_device_name text,
  p_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_code_hash text := lower(nullif(btrim(p_code_hash), ''));
  normalized_token_hash text := lower(nullif(btrim(p_token_hash), ''));
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

  if normalized_token_hash is null
    or normalized_token_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception 'device token hash must be sha256' using errcode = '23514';
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

  select screen.*
  into screen_record
  from public.screens screen
  where screen.tenant_id = p_tenant_id
    and screen.id = p_screen_id
    and screen.status <> 'disabled'::public.screen_status;

  if not found then
    raise exception 'screen not found or disabled' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.player_devices device
    where device.tenant_id = p_tenant_id
      and device.screen_id = p_screen_id
      and device.status = 'paired'::public.player_device_status
  ) then
    raise exception 'screen already has a paired device' using errcode = '23505';
  end if;

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
    normalized_token_hash,
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
    claimed_at = now()
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

create or replace function public.get_player_device_bootstrap(p_token_hash text)
returns table (
  device_id uuid,
  tenant_id uuid,
  screen_id uuid,
  screen_name text,
  screen_status public.screen_status,
  device_status public.player_device_status,
  active_release_id uuid,
  desired_release_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_token_hash text := lower(nullif(btrim(p_token_hash), ''));
begin
  if normalized_token_hash is null
    or normalized_token_hash !~ '^[a-f0-9]{64}$'
  then
    return;
  end if;

  return query
  select
    device.id,
    device.tenant_id,
    screen.id,
    screen.name,
    screen.status,
    device.status,
    device.active_release_id,
    device.desired_release_id
  from public.player_devices device
  join public.screens screen
    on screen.tenant_id = device.tenant_id
    and screen.id = device.screen_id
  where device.token_hash = normalized_token_hash
    and device.status = 'paired'::public.player_device_status
    and screen.status = 'active'::public.screen_status;
end;
$$;

alter table public.screens enable row level security;
alter table public.player_devices enable row level security;
alter table public.pairing_sessions enable row level security;

grant select on
  public.screens,
  public.player_devices,
  public.pairing_sessions
to anon, authenticated;

grant insert, update, delete on public.screens to authenticated;
grant update, delete on public.player_devices to authenticated;
grant update, delete on public.pairing_sessions to authenticated;

revoke all on function public.create_pairing_session(text, text) from public;
revoke all on function public.claim_pairing_session(text, uuid, uuid, text, text) from public;
revoke all on function public.get_player_device_bootstrap(text) from public;
grant execute on function public.create_pairing_session(text, text) to anon, authenticated;
grant execute on function public.claim_pairing_session(text, uuid, uuid, text, text) to authenticated;
grant execute on function public.get_player_device_bootstrap(text) to anon, authenticated;

create policy "screens_select_by_scope"
on public.screens
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

create policy "screens_insert_by_admin"
on public.screens
for insert
to authenticated
with check (
  (
    private.has_tenant_role(tenant_id, array[
      'tenant_owner',
      'tenant_admin'
    ]::public.tenant_role[])
    or private.is_platform_member(array[
      'platform_owner',
      'platform_admin'
    ]::public.platform_role[])
  )
  and (
    created_by is null
    or created_by = private.current_user_id()
  )
);

create policy "screens_update_by_admin"
on public.screens
for update
to authenticated
using (
  private.has_tenant_role(tenant_id, array[
    'tenant_owner',
    'tenant_admin'
  ]::public.tenant_role[])
  or private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[])
)
with check (
  private.has_tenant_role(tenant_id, array[
    'tenant_owner',
    'tenant_admin'
  ]::public.tenant_role[])
  or private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[])
);

create policy "screens_delete_by_admin"
on public.screens
for delete
to authenticated
using (
  private.has_tenant_role(tenant_id, array[
    'tenant_owner',
    'tenant_admin'
  ]::public.tenant_role[])
  or private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[])
);

create policy "player_devices_select_by_scope"
on public.player_devices
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

create policy "player_devices_update_by_admin"
on public.player_devices
for update
to authenticated
using (
  private.has_tenant_role(tenant_id, array[
    'tenant_owner',
    'tenant_admin'
  ]::public.tenant_role[])
  or private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[])
)
with check (
  private.has_tenant_role(tenant_id, array[
    'tenant_owner',
    'tenant_admin'
  ]::public.tenant_role[])
  or private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[])
);

create policy "player_devices_delete_by_admin"
on public.player_devices
for delete
to authenticated
using (
  private.has_tenant_role(tenant_id, array[
    'tenant_owner',
    'tenant_admin'
  ]::public.tenant_role[])
  or private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[])
);

create policy "pairing_sessions_select_by_claimed_scope"
on public.pairing_sessions
for select
to authenticated
using (
  (
    claimed_tenant_id is not null
    and private.is_tenant_member(claimed_tenant_id)
  )
  or private.is_platform_member(array[
    'platform_owner',
    'platform_admin',
    'platform_support'
  ]::public.platform_role[])
);

create policy "pairing_sessions_update_by_claimed_admin"
on public.pairing_sessions
for update
to authenticated
using (
  claimed_tenant_id is not null
  and (
    private.has_tenant_role(claimed_tenant_id, array[
      'tenant_owner',
      'tenant_admin'
    ]::public.tenant_role[])
    or private.is_platform_member(array[
      'platform_owner',
      'platform_admin'
    ]::public.platform_role[])
  )
)
with check (
  claimed_tenant_id is not null
  and (
    private.has_tenant_role(claimed_tenant_id, array[
      'tenant_owner',
      'tenant_admin'
    ]::public.tenant_role[])
    or private.is_platform_member(array[
      'platform_owner',
      'platform_admin'
    ]::public.platform_role[])
  )
);

create policy "pairing_sessions_delete_by_claimed_admin"
on public.pairing_sessions
for delete
to authenticated
using (
  claimed_tenant_id is not null
  and (
    private.has_tenant_role(claimed_tenant_id, array[
      'tenant_owner',
      'tenant_admin'
    ]::public.tenant_role[])
    or private.is_platform_member(array[
      'platform_owner',
      'platform_admin'
    ]::public.platform_role[])
  )
);
