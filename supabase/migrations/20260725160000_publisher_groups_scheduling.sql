-- S31-B/S32 foundation: tenant screen groups, timezone-aware schedules and
-- immutable target provenance. Scheduling always points at an immutable release.

create table public.screen_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 120),
  description text check (description is null or length(description) <= 500),
  status text not null default 'active' check (status in ('active', 'archived')),
  default_playlist_id uuid,
  default_release_id uuid,
  revision bigint not null default 0 check (revision >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, default_playlist_id)
    references public.playlists(tenant_id, id)
    on delete restrict,
  foreign key (tenant_id, default_playlist_id, default_release_id)
    references public.playlist_releases(tenant_id, playlist_id, id)
    on delete restrict,
  check (
    (default_playlist_id is null and default_release_id is null)
    or (default_playlist_id is not null and default_release_id is not null)
  ),
  check (
    (status = 'archived' and archived_at is not null)
    or status = 'active'
  )
);

create unique index screen_groups_tenant_name_active_uq
  on public.screen_groups(tenant_id, lower(name))
  where status = 'active';
create index screen_groups_tenant_status_updated_idx
  on public.screen_groups(tenant_id, status, updated_at desc);

create table public.screen_group_memberships (
  tenant_id uuid not null,
  screen_group_id uuid not null,
  screen_id uuid not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, screen_group_id, screen_id),
  foreign key (tenant_id, screen_group_id)
    references public.screen_groups(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, screen_id)
    references public.screens(tenant_id, id)
    on delete cascade
);

create index screen_group_memberships_tenant_screen_idx
  on public.screen_group_memberships(tenant_id, screen_id, screen_group_id);

create table public.content_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 120),
  target_kind text not null check (target_kind in ('screen', 'screen_group')),
  target_screen_id uuid,
  target_screen_group_id uuid,
  playlist_id uuid not null,
  release_id uuid not null,
  timezone_name text not null check (length(timezone_name) between 3 and 64),
  schedule_kind text not null default 'once'
    check (schedule_kind in ('once', 'daily', 'weekly', 'custom')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  recurrence_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(recurrence_json) = 'object'),
  priority integer not null default 100 check (priority between 0 and 1000),
  source text not null default 'publisher'
    check (source in ('publisher', 'override', 'fallback')),
  enabled boolean not null default true,
  revision bigint not null default 0 check (revision >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, target_screen_id)
    references public.screens(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, target_screen_group_id)
    references public.screen_groups(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, playlist_id, release_id)
    references public.playlist_releases(tenant_id, playlist_id, id)
    on delete restrict,
  check (
    (target_kind = 'screen' and target_screen_id is not null and target_screen_group_id is null)
    or (
      target_kind = 'screen_group'
      and target_screen_group_id is not null
      and target_screen_id is null
    )
  ),
  check (ends_at is null or ends_at > starts_at),
  check (
    schedule_kind <> 'once'
    or recurrence_json = '{}'::jsonb
  )
);

create index content_schedules_tenant_enabled_window_idx
  on public.content_schedules(tenant_id, enabled, starts_at, ends_at);
create index content_schedules_tenant_screen_window_idx
  on public.content_schedules(tenant_id, target_screen_id, starts_at, ends_at)
  where target_kind = 'screen';
create index content_schedules_tenant_group_window_idx
  on public.content_schedules(tenant_id, target_screen_group_id, starts_at, ends_at)
  where target_kind = 'screen_group';

create table public.publisher_target_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  release_id uuid not null,
  schedule_id uuid,
  source_kind text not null
    check (source_kind in ('direct', 'screen', 'screen_group', 'schedule', 'restore')),
  source_id uuid,
  target_count integer not null check (target_count > 0),
  targets_json jsonb not null check (jsonb_typeof(targets_json) = 'array'),
  snapshot_hash text not null check (snapshot_hash ~ '^[a-f0-9]{64}$'),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, release_id)
    references public.playlist_releases(tenant_id, id)
    on delete restrict,
  foreign key (tenant_id, schedule_id)
    references public.content_schedules(tenant_id, id)
    on delete restrict
);

create index publisher_target_snapshots_tenant_release_idx
  on public.publisher_target_snapshots(tenant_id, release_id, resolved_at desc);
create index publisher_target_snapshots_tenant_schedule_idx
  on public.publisher_target_snapshots(tenant_id, schedule_id, resolved_at desc)
  where schedule_id is not null;

create table public.publisher_target_snapshot_screens (
  tenant_id uuid not null,
  snapshot_id uuid not null,
  screen_id uuid not null,
  provenance_kind text not null
    check (provenance_kind in ('direct', 'screen', 'screen_group', 'schedule')),
  provenance_id uuid,
  created_at timestamptz not null default now(),
  primary key (tenant_id, snapshot_id, screen_id),
  foreign key (tenant_id, snapshot_id)
    references public.publisher_target_snapshots(tenant_id, id)
    on delete restrict,
  foreign key (tenant_id, screen_id)
    references public.screens(tenant_id, id)
    on delete restrict
);

create index publisher_target_snapshot_screens_tenant_screen_idx
  on public.publisher_target_snapshot_screens(tenant_id, screen_id, snapshot_id);

alter table public.content_schedules
  add column target_snapshot_id uuid,
  add constraint content_schedules_tenant_target_snapshot_fkey
    foreign key (tenant_id, target_snapshot_id)
    references public.publisher_target_snapshots(tenant_id, id)
    on delete restrict;

alter table public.release_screen_assignments
  add column target_snapshot_id uuid,
  add constraint release_screen_assignments_tenant_target_snapshot_fkey
    foreign key (tenant_id, target_snapshot_id)
    references public.publisher_target_snapshots(tenant_id, id)
    on delete restrict;

create or replace function private.reject_publisher_target_snapshot_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'publisher target snapshots are immutable' using errcode = '23514';
end;
$$;

create trigger publisher_target_snapshots_reject_update
before update on public.publisher_target_snapshots
for each row execute function private.reject_publisher_target_snapshot_mutation();
create trigger publisher_target_snapshots_reject_delete
before delete on public.publisher_target_snapshots
for each row execute function private.reject_publisher_target_snapshot_mutation();
create trigger publisher_target_snapshot_screens_reject_update
before update on public.publisher_target_snapshot_screens
for each row execute function private.reject_publisher_target_snapshot_mutation();
create trigger publisher_target_snapshot_screens_reject_delete
before delete on public.publisher_target_snapshot_screens
for each row execute function private.reject_publisher_target_snapshot_mutation();

create trigger screen_groups_set_updated_at
before update on public.screen_groups
for each row execute function private.set_updated_at();
create trigger content_schedules_set_updated_at
before update on public.content_schedules
for each row execute function private.set_updated_at();

alter table public.screen_groups enable row level security;
alter table public.screen_groups force row level security;
alter table public.screen_group_memberships enable row level security;
alter table public.screen_group_memberships force row level security;
alter table public.content_schedules enable row level security;
alter table public.content_schedules force row level security;
alter table public.publisher_target_snapshots enable row level security;
alter table public.publisher_target_snapshots force row level security;
alter table public.publisher_target_snapshot_screens enable row level security;
alter table public.publisher_target_snapshot_screens force row level security;

revoke all on
  public.screen_groups,
  public.screen_group_memberships,
  public.content_schedules,
  public.publisher_target_snapshots,
  public.publisher_target_snapshot_screens
from public, anon, authenticated;

grant select, insert, update, delete on
  public.screen_groups,
  public.screen_group_memberships,
  public.content_schedules
to authenticated;
grant select on
  public.publisher_target_snapshots,
  public.publisher_target_snapshot_screens
to authenticated;
grant select, insert on
  public.publisher_target_snapshots,
  public.publisher_target_snapshot_screens
to service_role;
grant execute on function private.can_manage_screens(uuid)
to authenticated, service_role;

create policy "screen_groups_select_by_scope"
on public.screen_groups for select to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);
create policy "screen_groups_insert_by_manager"
on public.screen_groups for insert to authenticated
with check (
  private.can_manage_screens(tenant_id)
  and (created_by is null or created_by = private.current_user_id())
);
create policy "screen_groups_update_by_manager"
on public.screen_groups for update to authenticated
using (private.can_manage_screens(tenant_id))
with check (private.can_manage_screens(tenant_id));
create policy "screen_groups_delete_by_manager"
on public.screen_groups for delete to authenticated
using (private.can_manage_screens(tenant_id));

create policy "screen_group_memberships_select_by_scope"
on public.screen_group_memberships for select to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);
create policy "screen_group_memberships_insert_by_manager"
on public.screen_group_memberships for insert to authenticated
with check (
  private.can_manage_screens(tenant_id)
  and (created_by is null or created_by = private.current_user_id())
);
create policy "screen_group_memberships_delete_by_manager"
on public.screen_group_memberships for delete to authenticated
using (private.can_manage_screens(tenant_id));

create policy "content_schedules_select_by_scope"
on public.content_schedules for select to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);
create policy "content_schedules_insert_by_publisher"
on public.content_schedules for insert to authenticated
with check (
  private.can_write_playlist(tenant_id)
  and (created_by is null or created_by = private.current_user_id())
);
create policy "content_schedules_update_by_publisher"
on public.content_schedules for update to authenticated
using (private.can_write_playlist(tenant_id))
with check (private.can_write_playlist(tenant_id));
create policy "content_schedules_delete_by_publisher"
on public.content_schedules for delete to authenticated
using (private.can_write_playlist(tenant_id));

create policy "publisher_target_snapshots_select_by_scope"
on public.publisher_target_snapshots for select to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);
create policy "publisher_target_snapshot_screens_select_by_scope"
on public.publisher_target_snapshot_screens for select to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);

create trigger screen_groups_require_active_tenant
before insert or update or delete on public.screen_groups
for each row execute function private.require_active_tenant_mutation('tenant_id');
create trigger screen_group_memberships_require_active_tenant
before insert or update or delete on public.screen_group_memberships
for each row execute function private.require_active_tenant_mutation('tenant_id');
create trigger content_schedules_require_active_tenant
before insert or update or delete on public.content_schedules
for each row execute function private.require_active_tenant_mutation('tenant_id');

revoke all on function private.reject_publisher_target_snapshot_mutation()
from public, anon, authenticated;
