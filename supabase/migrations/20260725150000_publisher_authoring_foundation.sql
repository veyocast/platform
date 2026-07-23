-- S31-B: additive Publisher authoring, media organisation and personal views.
-- Existing manifest-v1 contracts and immutable release rows remain unchanged.

alter table public.tenants
  alter column media_storage_limit_bytes drop not null,
  alter column media_storage_limit_bytes drop default;

alter table public.tenant_settings
  add column timezone_name text not null default 'Europe/Amsterdam'
    check (length(timezone_name) between 3 and 64),
  add column default_transition text not null default 'cut'
    check (default_transition in ('cut', 'crossfade', 'wipe')),
  add column default_background_color text
    check (
      default_background_color is null
      or default_background_color ~ '^#[0-9A-Fa-f]{6}$'
    );

alter table public.playlists
  add column default_image_duration_seconds integer not null default 10
    check (default_image_duration_seconds between 5 and 3600),
  add column default_transition text not null default 'cut'
    check (default_transition in ('cut', 'crossfade', 'wipe')),
  add column default_fit_mode text not null default 'contain'
    check (default_fit_mode in ('contain', 'cover')),
  add column default_background_color text
    check (
      default_background_color is null
      or default_background_color ~ '^#[0-9A-Fa-f]{6}$'
    ),
  add column default_video_muted boolean not null default true,
  add column loop_enabled boolean not null default true;

update public.playlists playlist
set default_image_duration_seconds = settings.default_image_duration_seconds,
    default_fit_mode = settings.default_fit_mode,
    default_video_muted = settings.default_video_muted,
    default_transition = settings.default_transition,
    default_background_color = settings.default_background_color
from public.tenant_settings settings
where settings.tenant_id = playlist.tenant_id;

alter table public.playlist_items
  add column display_title text
    check (
      display_title is null
      or length(btrim(display_title)) between 2 and 120
    ),
  add column transition text not null default 'cut'
    check (transition in ('cut', 'crossfade', 'wipe')),
  add column crop_focus_x numeric(6, 5) not null default 0.5
    check (crop_focus_x between 0 and 1),
  add column crop_focus_y numeric(6, 5) not null default 0.5
    check (crop_focus_y between 0 and 1),
  add column background_color text
    check (
      background_color is null
      or background_color ~ '^#[0-9A-Fa-f]{6}$'
    ),
  add column volume_percent smallint not null default 100
    check (volume_percent between 0 and 100),
  add column trim_start_seconds numeric(10, 3) not null default 0
    check (trim_start_seconds >= 0 and trim_start_seconds <= 3600),
  add column trim_end_seconds numeric(10, 3)
    check (trim_end_seconds is null or trim_end_seconds > 0),
  add column visible_from timestamptz,
  add column visible_until timestamptz,
  add column enabled boolean not null default true,
  add column accessibility_name text
    check (
      accessibility_name is null
      or length(btrim(accessibility_name)) between 2 and 160
    ),
  add column position_key numeric(30, 10);

update public.playlist_items item
set position_key = (item.sort_order::numeric + 1) * 1024,
    transition = playlist.default_transition,
    background_color = playlist.default_background_color
from public.playlists playlist
where playlist.tenant_id = item.tenant_id
  and playlist.id = item.playlist_id;

alter table public.playlist_items
  alter column position_key set not null,
  add constraint playlist_items_trim_window_check check (
    trim_end_seconds is null or trim_end_seconds > trim_start_seconds
  ),
  add constraint playlist_items_visibility_window_check check (
    visible_until is null
    or visible_from is null
    or visible_until > visible_from
  ),
  add constraint playlist_items_tenant_playlist_position_key_uq
    unique (tenant_id, playlist_id, position_key)
    deferrable initially immediate;

create or replace function private.assign_playlist_item_position_key()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.position_key is null then
    select coalesce(max(item.position_key) + 1024, 1024)
    into new.position_key
    from public.playlist_items item
    where item.tenant_id = new.tenant_id
      and item.playlist_id = new.playlist_id;
  end if;
  return new;
end;
$$;

create trigger playlist_items_assign_position_key
before insert on public.playlist_items
for each row execute function private.assign_playlist_item_position_key();

create table public.playlist_sections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  playlist_id uuid not null,
  name text not null check (length(btrim(name)) between 2 and 120),
  position_key numeric(30, 10) not null check (position_key > 0),
  enabled boolean not null default true,
  default_duration_seconds integer
    check (default_duration_seconds is null or default_duration_seconds between 5 and 3600),
  default_transition text
    check (default_transition is null or default_transition in ('cut', 'crossfade', 'wipe')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, playlist_id)
    references public.playlists(tenant_id, id)
    on delete cascade,
  unique (tenant_id, id),
  unique (tenant_id, playlist_id, id),
  unique (tenant_id, playlist_id, position_key)
    deferrable initially immediate
);

create index playlist_sections_tenant_playlist_position_idx
  on public.playlist_sections(tenant_id, playlist_id, position_key);

alter table public.playlist_items
  add column section_id uuid,
  add constraint playlist_items_tenant_playlist_section_fkey
    foreign key (tenant_id, playlist_id, section_id)
    references public.playlist_sections(tenant_id, playlist_id, id)
    on delete set null (section_id);

create index playlist_items_tenant_section_position_idx
  on public.playlist_items(tenant_id, playlist_id, section_id, position_key);

create table public.tenant_playlist_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source_playlist_id uuid,
  name text not null check (length(btrim(name)) between 2 and 120),
  description text check (description is null or length(description) <= 500),
  snapshot_json jsonb not null check (jsonb_typeof(snapshot_json) = 'object'),
  snapshot_hash text not null check (snapshot_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'active' check (status in ('active', 'archived')),
  revision bigint not null default 0 check (revision >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, source_playlist_id)
    references public.playlists(tenant_id, id)
    on delete set null,
  check (
    (status = 'archived' and archived_at is not null)
    or status = 'active'
  )
);

create index tenant_playlist_templates_tenant_status_name_idx
  on public.tenant_playlist_templates(tenant_id, status, name);

create table public.media_folders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parent_folder_id uuid,
  name text not null check (length(btrim(name)) between 1 and 120),
  position_key numeric(30, 10) not null default 1024 check (position_key > 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, parent_folder_id)
    references public.media_folders(tenant_id, id)
    on delete cascade
);

create unique index media_folders_tenant_parent_name_uq
  on public.media_folders(
    tenant_id,
    coalesce(parent_folder_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  );
create index media_folders_tenant_parent_position_idx
  on public.media_folders(tenant_id, parent_folder_id, position_key);

alter table public.media_assets
  add column folder_id uuid,
  add constraint media_assets_tenant_folder_fkey
    foreign key (tenant_id, folder_id)
    references public.media_folders(tenant_id, id)
    on delete set null (folder_id);

create index media_assets_tenant_folder_created_idx
  on public.media_assets(tenant_id, folder_id, created_at desc);

create table public.media_tags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 48),
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create unique index media_tags_tenant_name_uq
  on public.media_tags(tenant_id, lower(name));

create table public.media_asset_tags (
  tenant_id uuid not null,
  media_asset_id uuid not null,
  tag_id uuid not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, media_asset_id, tag_id),
  foreign key (tenant_id, media_asset_id)
    references public.media_assets(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, tag_id)
    references public.media_tags(tenant_id, id)
    on delete cascade
);

create index media_asset_tags_tenant_tag_asset_idx
  on public.media_asset_tags(tenant_id, tag_id, media_asset_id);

create table public.media_asset_favorites (
  tenant_id uuid not null,
  media_asset_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenant_id, media_asset_id, user_id),
  foreign key (tenant_id, media_asset_id)
    references public.media_assets(tenant_id, id)
    on delete cascade
);

create index media_asset_favorites_user_tenant_idx
  on public.media_asset_favorites(user_id, tenant_id, created_at desc);

create table public.publisher_saved_views (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  resource_type text not null
    check (resource_type in ('media', 'playlists', 'screens', 'activity', 'planning')),
  name text not null check (length(btrim(name)) between 2 and 80),
  filter_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(filter_json) = 'object'),
  sort_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(sort_json) = 'array'),
  column_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(column_json) = 'array'),
  density text not null default 'comfortable'
    check (density in ('comfortable', 'compact')),
  is_default boolean not null default false,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, user_id, resource_type, name)
);

create unique index publisher_saved_views_one_default_uq
  on public.publisher_saved_views(tenant_id, user_id, resource_type)
  where is_default;
create index publisher_saved_views_user_resource_idx
  on public.publisher_saved_views(user_id, tenant_id, resource_type, updated_at desc);

create trigger playlist_sections_set_updated_at
before update on public.playlist_sections
for each row execute function private.set_updated_at();
create trigger tenant_playlist_templates_set_updated_at
before update on public.tenant_playlist_templates
for each row execute function private.set_updated_at();
create trigger media_folders_set_updated_at
before update on public.media_folders
for each row execute function private.set_updated_at();
create trigger media_tags_set_updated_at
before update on public.media_tags
for each row execute function private.set_updated_at();
create trigger publisher_saved_views_set_updated_at
before update on public.publisher_saved_views
for each row execute function private.set_updated_at();

alter table public.playlist_sections enable row level security;
alter table public.playlist_sections force row level security;
alter table public.tenant_playlist_templates enable row level security;
alter table public.tenant_playlist_templates force row level security;
alter table public.media_folders enable row level security;
alter table public.media_folders force row level security;
alter table public.media_tags enable row level security;
alter table public.media_tags force row level security;
alter table public.media_asset_tags enable row level security;
alter table public.media_asset_tags force row level security;
alter table public.media_asset_favorites enable row level security;
alter table public.media_asset_favorites force row level security;
alter table public.publisher_saved_views enable row level security;
alter table public.publisher_saved_views force row level security;

revoke all on
  public.playlist_sections,
  public.tenant_playlist_templates,
  public.media_folders,
  public.media_tags,
  public.media_asset_tags,
  public.media_asset_favorites,
  public.publisher_saved_views
from public, anon, authenticated;

grant select on
  public.playlist_sections,
  public.tenant_playlist_templates,
  public.media_folders,
  public.media_tags,
  public.media_asset_tags
to authenticated;

grant insert, update, delete on
  public.playlist_sections,
  public.tenant_playlist_templates,
  public.media_folders,
  public.media_tags,
  public.media_asset_tags
to authenticated;

grant select, insert, delete on public.media_asset_favorites to authenticated;
grant select, insert, update, delete on public.publisher_saved_views to authenticated;
grant execute on function private.can_write_playlist(uuid)
to authenticated, service_role;

create policy "playlist_sections_select_by_scope"
on public.playlist_sections for select to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);
create policy "playlist_sections_insert_by_writer"
on public.playlist_sections for insert to authenticated
with check (
  private.can_write_playlist(tenant_id)
  and (created_by is null or created_by = private.current_user_id())
  and exists (
    select 1 from public.playlists playlist
    where playlist.tenant_id = playlist_sections.tenant_id
      and playlist.id = playlist_sections.playlist_id
      and playlist.status <> 'archived'::public.playlist_status
  )
);
create policy "playlist_sections_update_by_writer"
on public.playlist_sections for update to authenticated
using (private.can_write_playlist(tenant_id))
with check (private.can_write_playlist(tenant_id));
create policy "playlist_sections_delete_by_writer"
on public.playlist_sections for delete to authenticated
using (private.can_write_playlist(tenant_id));

create policy "tenant_playlist_templates_select_by_scope"
on public.tenant_playlist_templates for select to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);
create policy "tenant_playlist_templates_insert_by_writer"
on public.tenant_playlist_templates for insert to authenticated
with check (
  private.can_write_playlist(tenant_id)
  and (created_by is null or created_by = private.current_user_id())
);
create policy "tenant_playlist_templates_update_by_writer"
on public.tenant_playlist_templates for update to authenticated
using (private.can_write_playlist(tenant_id))
with check (private.can_write_playlist(tenant_id));
create policy "tenant_playlist_templates_delete_by_admin"
on public.tenant_playlist_templates for delete to authenticated
using (
  private.has_tenant_role(tenant_id, array[
    'tenant_owner', 'tenant_admin'
  ]::public.tenant_role[])
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin'
  ]::public.platform_role[])
);

create policy "media_folders_select_by_scope"
on public.media_folders for select to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);
create policy "media_folders_insert_by_writer"
on public.media_folders for insert to authenticated
with check (
  private.can_write_playlist(tenant_id)
  and (created_by is null or created_by = private.current_user_id())
);
create policy "media_folders_update_by_writer"
on public.media_folders for update to authenticated
using (private.can_write_playlist(tenant_id))
with check (private.can_write_playlist(tenant_id));
create policy "media_folders_delete_by_writer"
on public.media_folders for delete to authenticated
using (private.can_write_playlist(tenant_id));

create policy "media_tags_select_by_scope"
on public.media_tags for select to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);
create policy "media_tags_insert_by_writer"
on public.media_tags for insert to authenticated
with check (
  private.can_write_playlist(tenant_id)
  and (created_by is null or created_by = private.current_user_id())
);
create policy "media_tags_update_by_writer"
on public.media_tags for update to authenticated
using (private.can_write_playlist(tenant_id))
with check (private.can_write_playlist(tenant_id));
create policy "media_tags_delete_by_writer"
on public.media_tags for delete to authenticated
using (private.can_write_playlist(tenant_id));

create policy "media_asset_tags_select_by_scope"
on public.media_asset_tags for select to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);
create policy "media_asset_tags_insert_by_writer"
on public.media_asset_tags for insert to authenticated
with check (
  private.can_write_playlist(tenant_id)
  and (created_by is null or created_by = private.current_user_id())
);
create policy "media_asset_tags_delete_by_writer"
on public.media_asset_tags for delete to authenticated
using (private.can_write_playlist(tenant_id));

create policy "media_asset_favorites_select_own"
on public.media_asset_favorites for select to authenticated
using (
  user_id = private.current_user_id()
  and private.is_tenant_member(tenant_id)
);
create policy "media_asset_favorites_insert_own"
on public.media_asset_favorites for insert to authenticated
with check (
  user_id = private.current_user_id()
  and private.is_tenant_member(tenant_id)
);
create policy "media_asset_favorites_delete_own"
on public.media_asset_favorites for delete to authenticated
using (
  user_id = private.current_user_id()
  and private.is_tenant_member(tenant_id)
);

create policy "publisher_saved_views_select_own"
on public.publisher_saved_views for select to authenticated
using (
  user_id = private.current_user_id()
  and private.is_tenant_member(tenant_id)
);
create policy "publisher_saved_views_insert_own"
on public.publisher_saved_views for insert to authenticated
with check (
  user_id = private.current_user_id()
  and private.is_tenant_member(tenant_id)
);
create policy "publisher_saved_views_update_own"
on public.publisher_saved_views for update to authenticated
using (
  user_id = private.current_user_id()
  and private.is_tenant_member(tenant_id)
)
with check (
  user_id = private.current_user_id()
  and private.is_tenant_member(tenant_id)
);
create policy "publisher_saved_views_delete_own"
on public.publisher_saved_views for delete to authenticated
using (
  user_id = private.current_user_id()
  and private.is_tenant_member(tenant_id)
);

create trigger playlist_sections_require_active_tenant
before insert or update or delete on public.playlist_sections
for each row execute function private.require_active_tenant_mutation('tenant_id');
create trigger tenant_playlist_templates_require_active_tenant
before insert or update or delete on public.tenant_playlist_templates
for each row execute function private.require_active_tenant_mutation('tenant_id');
create trigger media_folders_require_active_tenant
before insert or update or delete on public.media_folders
for each row execute function private.require_active_tenant_mutation('tenant_id');
create trigger media_tags_require_active_tenant
before insert or update or delete on public.media_tags
for each row execute function private.require_active_tenant_mutation('tenant_id');
create trigger media_asset_tags_require_active_tenant
before insert or update or delete on public.media_asset_tags
for each row execute function private.require_active_tenant_mutation('tenant_id');
create trigger media_asset_favorites_require_active_tenant
before insert or update or delete on public.media_asset_favorites
for each row execute function private.require_active_tenant_mutation('tenant_id');
create trigger publisher_saved_views_require_active_tenant
before insert or update or delete on public.publisher_saved_views
for each row execute function private.require_active_tenant_mutation('tenant_id');

revoke all on function private.assign_playlist_item_position_key()
from public, anon, authenticated;
