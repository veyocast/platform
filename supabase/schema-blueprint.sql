-- Castivo schema blueprint. Convert into timestamped migrations.

create schema if not exists private;

create type public.platform_role as enum ('platform_owner','platform_admin','platform_support','platform_viewer');
create type public.tenant_role as enum ('tenant_owner','tenant_admin','tenant_editor','tenant_viewer');
create type public.tenant_status as enum ('active','paused','archived');
create type public.media_asset_kind as enum ('image','video');
create type public.media_asset_status as enum ('uploading','processing','ready','validation_failed','deleted');
create type public.media_upload_session_status as enum ('pending','uploaded','expired','cancelled');
create type public.media_variant_type as enum ('original','thumbnail','player_1080p');
create type public.media_processing_job_status as enum ('queued','processing','completed','failed');
create type public.screen_status as enum ('active','maintenance','disabled');
create type public.player_device_status as enum ('paired','revoked','disabled');
create type public.playlist_status as enum ('draft','published','archived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status public.tenant_status not null default 'active',
  screen_limit integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_memberships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.platform_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.tenant_memberships (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.tenant_role not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index tenant_memberships_user_id_idx on public.tenant_memberships(user_id);

create table public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role public.tenant_role not null,
  token_hash text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index tenant_invitations_tenant_id_idx on public.tenant_invitations(tenant_id);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid references public.profiles(id),
  kind text not null check (kind in ('image','video')),
  title text not null,
  original_filename text not null,
  mime_type text not null,
  status public.media_asset_status not null default 'uploading',
  storage_path text not null,
  byte_size bigint not null default 0,
  checksum_sha256 text,
  width integer,
  height integer,
  duration_ms integer,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index media_assets_tenant_id_idx on public.media_assets(tenant_id);

create table public.media_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  media_asset_id uuid not null,
  status public.media_upload_session_status not null default 'pending',
  storage_path text not null,
  expected_mime_type text not null,
  expected_size_bytes bigint not null,
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, media_asset_id) references public.media_assets(tenant_id, id) on delete cascade
);

create table public.media_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  media_asset_id uuid not null,
  variant_type public.media_variant_type not null,
  storage_path text not null,
  mime_type text not null,
  byte_size bigint not null,
  checksum_sha256 text not null,
  width integer,
  height integer,
  duration_ms integer,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, media_asset_id) references public.media_assets(tenant_id, id) on delete cascade
);
create unique index media_assets_tenant_id_id_uq on public.media_assets(tenant_id, id);
create index media_variants_tenant_id_idx on public.media_variants(tenant_id);

create table public.media_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  media_asset_id uuid not null,
  status public.media_processing_job_status not null default 'queued',
  attempt_count integer not null default 0,
  requested_by uuid references public.profiles(id),
  locked_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, media_asset_id) references public.media_assets(tenant_id, id) on delete cascade
);

create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  status public.playlist_status not null default 'draft',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index playlists_tenant_id_id_uq on public.playlists(tenant_id, id);
create index playlists_tenant_id_idx on public.playlists(tenant_id);

create table public.playlist_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  playlist_id uuid not null,
  media_asset_id uuid not null,
  sort_order integer not null,
  duration_seconds integer not null default 10 check (duration_seconds >= 5),
  fit_mode text not null default 'contain' check (fit_mode in ('contain','cover')),
  muted boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, playlist_id) references public.playlists(tenant_id, id) on delete cascade,
  foreign key (tenant_id, media_asset_id) references public.media_assets(tenant_id, id)
);
create index playlist_items_tenant_playlist_idx on public.playlist_items(tenant_id, playlist_id, sort_order);

create table public.playlist_releases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  playlist_id uuid not null,
  version integer not null,
  manifest_hash text not null,
  manifest_json jsonb not null,
  total_bytes bigint not null default 0,
  published_by uuid references public.profiles(id),
  published_at timestamptz not null default now(),
  foreign key (tenant_id, playlist_id) references public.playlists(tenant_id, id),
  unique (tenant_id, playlist_id, version)
);
create unique index playlist_releases_tenant_id_id_uq on public.playlist_releases(tenant_id, id);

create table public.screens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  location text,
  orientation text not null default 'landscape' check (orientation in ('landscape','portrait')),
  resolution_width integer,
  resolution_height integer,
  status public.screen_status not null default 'active',
  assigned_playlist_id uuid,
  assigned_release_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, assigned_playlist_id) references public.playlists(tenant_id, id),
  foreign key (tenant_id, assigned_release_id) references public.playlist_releases(tenant_id, id)
);
create unique index screens_tenant_id_id_uq on public.screens(tenant_id, id);
create index screens_tenant_id_idx on public.screens(tenant_id);

create table public.player_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  screen_id uuid not null,
  device_name text,
  token_hash text not null,
  status public.player_device_status not null default 'paired',
  app_version text,
  platform text,
  user_agent_summary text,
  capabilities jsonb not null default '{}'::jsonb,
  storage_quota_bytes bigint,
  storage_used_bytes bigint,
  active_release_id uuid,
  desired_release_id uuid,
  last_seen_at timestamptz,
  paired_at timestamptz not null default now(),
  revoked_at timestamptz,
  foreign key (tenant_id, screen_id) references public.screens(tenant_id, id) on delete cascade,
  foreign key (tenant_id, active_release_id) references public.playlist_releases(tenant_id, id),
  foreign key (tenant_id, desired_release_id) references public.playlist_releases(tenant_id, id)
);
create index player_devices_tenant_screen_idx on public.player_devices(tenant_id, screen_id);

create table public.pairing_sessions (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null,
  expires_at timestamptz not null,
  claimed_by uuid references public.profiles(id),
  claimed_screen_id uuid,
  claimed_tenant_id uuid,
  paired_device_id uuid references public.player_devices(id),
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_device_id uuid references public.player_devices(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  result text not null default 'success',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_tenant_id_created_at_idx on public.audit_events(tenant_id, created_at desc);

-- Enable RLS. Policies are intentionally not fully expanded in this blueprint.
alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.platform_memberships enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.tenant_invitations enable row level security;
alter table public.media_assets enable row level security;
alter table public.media_upload_sessions enable row level security;
alter table public.media_variants enable row level security;
alter table public.media_processing_jobs enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_items enable row level security;
alter table public.playlist_releases enable row level security;
alter table public.screens enable row level security;
alter table public.player_devices enable row level security;
alter table public.pairing_sessions enable row level security;
alter table public.audit_events enable row level security;
