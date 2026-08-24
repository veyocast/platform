-- S123 Vector v2: canonical tenant feature rollout and Venue Twin foundation.
-- Venue Twin remains disabled by default and requires an explicit, audited
-- platform cohort decision. Flags never grant capabilities or bypass RLS.

create table public.tenant_feature_flags (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  flag_key text not null check (flag_key in (
    'vector_v2_design_system', 'vector_v2_marketing',
    'vector_v2_control_shell', 'vector_v2_mobile_shell',
    'vector_v2_player_shell', 'unified_resource_picker',
    'unified_filter_dock', 'venue_twin', 'screen_health_view',
    'engage', 'youtube_integration', 'billing_engine_enabled',
    'billing_collect_recurring', 'billing_proration_enabled',
    'billing_dunning_worker', 'billing_enforce_entitlements',
    'billing_player_warning_chip', 'billing_player_restriction_splash',
    'billing_mollie_nextgen_webhooks', 'billing_mollie_sales_invoices',
    'billing_reconciliation_worker', 'billing_support_overrides',
    'billing_mollie_fixed_subscription_adapter'
  )),
  enabled boolean not null default false,
  rollout_reason text not null check (length(btrim(rollout_reason)) between 8 and 500),
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, flag_key)
);

create index tenant_feature_flags_enabled_idx
  on public.tenant_feature_flags(flag_key, tenant_id)
  where enabled;

create trigger tenant_feature_flags_set_updated_at
before update on public.tenant_feature_flags
for each row execute function private.set_updated_at();

alter table public.tenant_feature_flags enable row level security;
alter table public.tenant_feature_flags force row level security;
revoke all on public.tenant_feature_flags from public, anon, authenticated;
grant select on public.tenant_feature_flags to authenticated;
grant select, insert, update on public.tenant_feature_flags to service_role;

create policy tenant_feature_flags_select_by_scope
on public.tenant_feature_flags for select to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);

create or replace function private.tenant_feature_enabled_v1(
  p_tenant_id uuid,
  p_flag_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    private.is_tenant_member(p_tenant_id)
    or private.is_platform_member(array[
      'platform_owner', 'platform_admin', 'platform_support'
    ]::public.platform_role[])
  ) and coalesce((
      select flag.enabled
      from public.tenant_feature_flags flag
      where flag.tenant_id = p_tenant_id
        and flag.flag_key = p_flag_key
    ), false);
$$;

revoke all on function private.tenant_feature_enabled_v1(uuid, text)
  from public, anon;
grant execute on function private.tenant_feature_enabled_v1(uuid, text)
  to authenticated, service_role;

create or replace function public.set_tenant_feature_flag_v1(
  p_tenant_id uuid,
  p_flag_key text,
  p_enabled boolean,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  previous_value boolean := false;
  normalized_reason text := btrim(p_reason);
begin
  if actor_id is null or not private.is_platform_member(array[
    'platform_owner', 'platform_admin'
  ]::public.platform_role[]) then
    raise exception 'platform feature rollout permission required' using errcode = '42501';
  end if;
  perform private.require_aal2_command();
  if p_flag_key not in (
    'vector_v2_design_system', 'vector_v2_marketing',
    'vector_v2_control_shell', 'vector_v2_mobile_shell',
    'vector_v2_player_shell', 'unified_resource_picker',
    'unified_filter_dock', 'venue_twin', 'screen_health_view',
    'engage', 'youtube_integration', 'billing_engine_enabled',
    'billing_collect_recurring', 'billing_proration_enabled',
    'billing_dunning_worker', 'billing_enforce_entitlements',
    'billing_player_warning_chip', 'billing_player_restriction_splash',
    'billing_mollie_nextgen_webhooks', 'billing_mollie_sales_invoices',
    'billing_reconciliation_worker', 'billing_support_overrides',
    'billing_mollie_fixed_subscription_adapter'
  ) or normalized_reason is null or length(normalized_reason) not between 8 and 500 then
    raise exception 'feature rollout input is invalid' using errcode = '23514';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id) then
    raise exception 'tenant not found' using errcode = 'P0002';
  end if;

  select enabled into previous_value
  from public.tenant_feature_flags
  where tenant_id = p_tenant_id and flag_key = p_flag_key;
  previous_value := coalesce(previous_value, false);

  insert into public.tenant_feature_flags (
    tenant_id, flag_key, enabled, rollout_reason, changed_by
  ) values (
    p_tenant_id, p_flag_key, p_enabled, normalized_reason, actor_id
  )
  on conflict (tenant_id, flag_key) do update
  set enabled = excluded.enabled,
      rollout_reason = excluded.rollout_reason,
      changed_by = excluded.changed_by;

  perform private.audit_event(
    p_tenant_id,
    'tenant.feature_flag.changed',
    'tenant_feature_flags',
    null,
    'success',
    jsonb_build_object(
      'flagKey', p_flag_key,
      'environment', coalesce(current_setting('app.environment', true), 'unknown'),
      'subject', p_tenant_id,
      'oldValue', previous_value,
      'newValue', p_enabled,
      'actor', actor_id,
      'reason', normalized_reason,
      'changedAt', now()
    )
  );
end;
$$;

revoke all on function public.set_tenant_feature_flag_v1(uuid, text, boolean, text)
  from public, anon;
grant execute on function public.set_tenant_feature_flag_v1(uuid, text, boolean, text)
  to authenticated, service_role;

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 120),
  address_label text check (address_label is null or length(btrim(address_label)) between 2 and 240),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create index venues_tenant_status_name_idx on public.venues(tenant_id, status, name);
create trigger venues_set_updated_at before update on public.venues
for each row execute function private.set_updated_at();

create table public.venue_floorplans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  venue_id uuid not null,
  media_asset_id uuid,
  name text not null check (length(btrim(name)) between 2 and 120),
  width integer not null check (width between 320 and 16000),
  height integer not null check (height between 240 and 16000),
  revision bigint not null default 1 check (revision >= 1),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, venue_id, id),
  foreign key (tenant_id, venue_id)
    references public.venues(tenant_id, id) on delete restrict,
  foreign key (tenant_id, media_asset_id)
    references public.media_assets(tenant_id, id) on delete restrict
);

create index venue_floorplans_tenant_venue_idx
  on public.venue_floorplans(tenant_id, venue_id, status);
create trigger venue_floorplans_set_updated_at before update on public.venue_floorplans
for each row execute function private.set_updated_at();

create table public.venue_zones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  venue_id uuid not null,
  floorplan_id uuid,
  name text not null check (length(btrim(name)) between 2 and 120),
  description text check (description is null or length(description) <= 500),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, venue_id, id),
  foreign key (tenant_id, venue_id)
    references public.venues(tenant_id, id) on delete restrict,
  foreign key (tenant_id, venue_id, floorplan_id)
    references public.venue_floorplans(tenant_id, venue_id, id) on delete restrict
);

create index venue_zones_tenant_venue_idx
  on public.venue_zones(tenant_id, venue_id, status, name);
create trigger venue_zones_set_updated_at before update on public.venue_zones
for each row execute function private.set_updated_at();

create table public.venue_screen_placements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  screen_id uuid not null,
  venue_id uuid not null,
  floorplan_id uuid,
  zone_id uuid,
  x_normalized numeric(8, 7) not null check (x_normalized between 0 and 1),
  y_normalized numeric(8, 7) not null check (y_normalized between 0 and 1),
  orientation text not null check (orientation in ('landscape', 'portrait')),
  wall_angle_degrees numeric(6, 2) check (
    wall_angle_degrees is null or wall_angle_degrees between -180 and 180
  ),
  revision bigint not null default 1 check (revision >= 1),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, screen_id),
  foreign key (tenant_id, screen_id)
    references public.screens(tenant_id, id) on delete cascade,
  foreign key (tenant_id, venue_id)
    references public.venues(tenant_id, id) on delete restrict,
  foreign key (tenant_id, venue_id, floorplan_id)
    references public.venue_floorplans(tenant_id, venue_id, id) on delete restrict,
  foreign key (tenant_id, venue_id, zone_id)
    references public.venue_zones(tenant_id, venue_id, id) on delete restrict
);

create index venue_screen_placements_tenant_venue_idx
  on public.venue_screen_placements(tenant_id, venue_id, zone_id);
create trigger venue_screen_placements_set_updated_at
before update on public.venue_screen_placements
for each row execute function private.set_updated_at();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'venues', 'venue_floorplans', 'venue_zones', 'venue_screen_placements'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
    execute format('grant select, insert, update on public.%I to service_role', table_name);
  end loop;
end;
$$;

create policy venues_tenant_read on public.venues for select to authenticated
using (
  private.tenant_feature_enabled_v1(tenant_id, 'venue_twin')
  and private.has_tenant_capability(tenant_id, 'tenant.screen.read')
);
create policy venue_floorplans_tenant_read on public.venue_floorplans for select to authenticated
using (
  private.tenant_feature_enabled_v1(tenant_id, 'venue_twin')
  and private.has_tenant_capability(tenant_id, 'tenant.screen.read')
);
create policy venue_zones_tenant_read on public.venue_zones for select to authenticated
using (
  private.tenant_feature_enabled_v1(tenant_id, 'venue_twin')
  and private.has_tenant_capability(tenant_id, 'tenant.screen.read')
);
create policy venue_screen_placements_tenant_read
on public.venue_screen_placements for select to authenticated
using (
  private.tenant_feature_enabled_v1(tenant_id, 'venue_twin')
  and private.has_tenant_capability(tenant_id, 'tenant.screen.read')
);

create or replace function private.require_venue_twin_manager_v1(p_tenant_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
begin
  if actor_id is null
    or not private.has_tenant_capability(p_tenant_id, 'tenant.screen.manage')
    or not private.tenant_feature_enabled_v1(p_tenant_id, 'venue_twin') then
    raise exception 'venue twin management capability and rollout required' using errcode = '42501';
  end if;
  return actor_id;
end;
$$;

revoke all on function private.require_venue_twin_manager_v1(uuid)
  from public, anon, authenticated;

create or replace function public.save_venue_v1(
  p_tenant_id uuid,
  p_venue_id uuid,
  p_name text,
  p_address_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_venue_twin_manager_v1(p_tenant_id);
  saved_id uuid := coalesce(p_venue_id, gen_random_uuid());
begin
  if length(btrim(p_name)) not between 2 and 120
    or (p_address_label is not null and length(btrim(p_address_label)) not between 2 and 240) then
    raise exception 'venue input is invalid' using errcode = '23514';
  end if;
  if p_venue_id is not null and not exists (
    select 1 from public.venues where tenant_id = p_tenant_id and id = p_venue_id
  ) then
    raise exception 'venue not found' using errcode = 'P0002';
  end if;

  insert into public.venues (
    id, tenant_id, name, address_label, created_by, updated_by
  ) values (
    saved_id, p_tenant_id, btrim(p_name), nullif(btrim(p_address_label), ''), actor_id, actor_id
  )
  on conflict (id) do update
  set name = excluded.name,
      address_label = excluded.address_label,
      updated_by = actor_id;

  perform private.audit_event(
    p_tenant_id,
    case when p_venue_id is null then 'venue.created' else 'venue.updated' end,
    'venues', saved_id, 'success',
    jsonb_build_object('name', btrim(p_name))
  );
  return saved_id;
end;
$$;

create or replace function public.save_venue_floorplan_v1(
  p_tenant_id uuid,
  p_venue_id uuid,
  p_floorplan_id uuid,
  p_media_asset_id uuid,
  p_name text,
  p_width integer,
  p_height integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_venue_twin_manager_v1(p_tenant_id);
  saved_id uuid := coalesce(p_floorplan_id, gen_random_uuid());
  next_revision bigint := 1;
begin
  if not exists (
    select 1 from public.venues
    where tenant_id = p_tenant_id and id = p_venue_id and status = 'active'
  ) or length(btrim(p_name)) not between 2 and 120
    or p_width not between 320 and 16000 or p_height not between 240 and 16000 then
    raise exception 'floorplan input is invalid' using errcode = '23514';
  end if;
  if p_media_asset_id is not null and not exists (
    select 1 from public.media_assets
    where tenant_id = p_tenant_id and id = p_media_asset_id
      and kind = 'image' and status = 'ready' and deleted_at is null
  ) then
    raise exception 'floorplan image is unavailable' using errcode = '23514';
  end if;
  if p_floorplan_id is not null then
    select revision + 1 into next_revision
    from public.venue_floorplans
    where tenant_id = p_tenant_id and venue_id = p_venue_id and id = p_floorplan_id;
    if next_revision is null then raise exception 'floorplan not found' using errcode = 'P0002'; end if;
  end if;

  insert into public.venue_floorplans (
    id, tenant_id, venue_id, media_asset_id, name, width, height,
    revision, created_by, updated_by
  ) values (
    saved_id, p_tenant_id, p_venue_id, p_media_asset_id, btrim(p_name),
    p_width, p_height, next_revision, actor_id, actor_id
  )
  on conflict (id) do update
  set media_asset_id = excluded.media_asset_id,
      name = excluded.name,
      width = excluded.width,
      height = excluded.height,
      revision = excluded.revision,
      updated_by = actor_id;

  perform private.audit_event(
    p_tenant_id, 'venue.floorplan.saved', 'venue_floorplans', saved_id,
    'success', jsonb_build_object('venueId', p_venue_id, 'revision', next_revision)
  );
  return saved_id;
end;
$$;

create or replace function public.save_venue_zone_v1(
  p_tenant_id uuid,
  p_venue_id uuid,
  p_zone_id uuid,
  p_floorplan_id uuid,
  p_name text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_venue_twin_manager_v1(p_tenant_id);
  saved_id uuid := coalesce(p_zone_id, gen_random_uuid());
begin
  if not exists (
    select 1 from public.venues
    where tenant_id = p_tenant_id and id = p_venue_id and status = 'active'
  ) or length(btrim(p_name)) not between 2 and 120
    or (p_description is not null and length(p_description) > 500) then
    raise exception 'venue zone input is invalid' using errcode = '23514';
  end if;
  if p_floorplan_id is not null and not exists (
    select 1 from public.venue_floorplans
    where tenant_id = p_tenant_id and venue_id = p_venue_id
      and id = p_floorplan_id and status = 'active'
  ) then
    raise exception 'floorplan not found' using errcode = 'P0002';
  end if;
  if p_zone_id is not null and not exists (
    select 1 from public.venue_zones
    where tenant_id = p_tenant_id and venue_id = p_venue_id and id = p_zone_id
  ) then
    raise exception 'venue zone not found' using errcode = 'P0002';
  end if;

  insert into public.venue_zones (
    id, tenant_id, venue_id, floorplan_id, name, description, created_by, updated_by
  ) values (
    saved_id, p_tenant_id, p_venue_id, p_floorplan_id, btrim(p_name),
    nullif(btrim(p_description), ''), actor_id, actor_id
  )
  on conflict (id) do update
  set floorplan_id = excluded.floorplan_id,
      name = excluded.name,
      description = excluded.description,
      updated_by = actor_id;

  perform private.audit_event(
    p_tenant_id, 'venue.zone.saved', 'venue_zones', saved_id,
    'success', jsonb_build_object('venueId', p_venue_id, 'floorplanId', p_floorplan_id)
  );
  return saved_id;
end;
$$;

create or replace function public.save_venue_screen_placement_v1(
  p_tenant_id uuid,
  p_screen_id uuid,
  p_venue_id uuid,
  p_floorplan_id uuid,
  p_zone_id uuid,
  p_x_normalized numeric,
  p_y_normalized numeric,
  p_orientation text,
  p_wall_angle_degrees numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_venue_twin_manager_v1(p_tenant_id);
  saved_id uuid := gen_random_uuid();
  next_revision bigint := 1;
begin
  if p_x_normalized not between 0 and 1
    or p_y_normalized not between 0 and 1
    or p_orientation not in ('landscape', 'portrait')
    or (p_wall_angle_degrees is not null and p_wall_angle_degrees not between -180 and 180)
    or not exists (
      select 1 from public.screens
      where tenant_id = p_tenant_id and id = p_screen_id and deleted_at is null
    )
    or not exists (
      select 1 from public.venues
      where tenant_id = p_tenant_id and id = p_venue_id and status = 'active'
    ) then
    raise exception 'screen placement input is invalid' using errcode = '23514';
  end if;
  if p_floorplan_id is not null and not exists (
    select 1 from public.venue_floorplans
    where tenant_id = p_tenant_id and venue_id = p_venue_id
      and id = p_floorplan_id and status = 'active'
  ) then raise exception 'floorplan not found' using errcode = 'P0002'; end if;
  if p_zone_id is not null and not exists (
    select 1 from public.venue_zones
    where tenant_id = p_tenant_id and venue_id = p_venue_id
      and id = p_zone_id and status = 'active'
  ) then raise exception 'venue zone not found' using errcode = 'P0002'; end if;

  select id, revision + 1 into saved_id, next_revision
  from public.venue_screen_placements
  where tenant_id = p_tenant_id and screen_id = p_screen_id;
  saved_id := coalesce(saved_id, gen_random_uuid());
  next_revision := coalesce(next_revision, 1);

  insert into public.venue_screen_placements (
    id, tenant_id, screen_id, venue_id, floorplan_id, zone_id,
    x_normalized, y_normalized, orientation, wall_angle_degrees,
    revision, created_by, updated_by
  ) values (
    saved_id, p_tenant_id, p_screen_id, p_venue_id, p_floorplan_id, p_zone_id,
    p_x_normalized, p_y_normalized, p_orientation, p_wall_angle_degrees,
    next_revision, actor_id, actor_id
  )
  on conflict (tenant_id, screen_id) do update
  set venue_id = excluded.venue_id,
      floorplan_id = excluded.floorplan_id,
      zone_id = excluded.zone_id,
      x_normalized = excluded.x_normalized,
      y_normalized = excluded.y_normalized,
      orientation = excluded.orientation,
      wall_angle_degrees = excluded.wall_angle_degrees,
      revision = excluded.revision,
      updated_by = actor_id;

  perform private.audit_event(
    p_tenant_id, 'venue.screen_placement.saved',
    'venue_screen_placements', saved_id, 'success',
    jsonb_build_object(
      'screenId', p_screen_id, 'venueId', p_venue_id,
      'zoneId', p_zone_id, 'floorplanId', p_floorplan_id,
      'revision', next_revision
    )
  );
  return saved_id;
end;
$$;

do $$
declare
  signature text;
begin
  foreach signature in array array[
    'public.save_venue_v1(uuid, uuid, text, text)',
    'public.save_venue_floorplan_v1(uuid, uuid, uuid, uuid, text, integer, integer)',
    'public.save_venue_zone_v1(uuid, uuid, uuid, uuid, text, text)',
    'public.save_venue_screen_placement_v1(uuid, uuid, uuid, uuid, uuid, numeric, numeric, text, numeric)'
  ] loop
    execute format('revoke all on function %s from public, anon', signature);
    execute format('grant execute on function %s to authenticated, service_role', signature);
  end loop;
end;
$$;

comment on table public.tenant_feature_flags is
  'Audited tenant rollout state. Flags control discovery only and never grant authorization.';
comment on table public.venue_screen_placements is
  'Current normalized screen position. Every change increments revision and writes an audit event.';
