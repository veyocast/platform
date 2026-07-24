-- S40: tenant-isolated Studio authoring, immutable render snapshots and
-- service-role-only rendering. Human mutations are RPC-only and idempotent.

create table public.studio_projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_user_id uuid references public.profiles(id) on delete set null,
  name text not null check (length(btrim(name)) between 2 and 120),
  project_kind text not null default 'design'
    check (project_kind in ('design', 'tenant_template')),
  orientation text not null check (orientation in ('landscape', 'portrait')),
  width integer not null,
  height integer not null,
  motion_enabled boolean not null default false,
  duration_ms integer not null default 10000
    check (duration_ms between 1000 and 30000),
  fps integer not null default 30 check (fps = 30),
  status text not null default 'active'
    check (status in ('active', 'archived', 'deleted')),
  revision bigint not null default 0 check (revision >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  check (
    (orientation = 'landscape' and width = 1920 and height = 1080)
    or (orientation = 'portrait' and width = 1080 and height = 1920)
  ),
  check (
    (status = 'active' and archived_at is null and deleted_at is null)
    or (status = 'archived' and archived_at is not null and deleted_at is null)
    or (status = 'deleted' and deleted_at is not null)
  )
);

create index studio_projects_tenant_status_updated_idx
  on public.studio_projects(tenant_id, status, updated_at desc);
create index studio_projects_owner_updated_idx
  on public.studio_projects(tenant_id, owner_user_id, updated_at desc);
create unique index studio_projects_active_template_name_uq
  on public.studio_projects(tenant_id, lower(name))
  where project_kind = 'tenant_template' and status = 'active';

create table public.studio_project_drafts (
  tenant_id uuid not null,
  project_id uuid not null,
  draft_revision bigint not null default 0 check (draft_revision >= 0),
  schema_version integer not null default 1 check (schema_version = 1),
  document_json jsonb not null check (jsonb_typeof(document_json) = 'object'),
  document_hash text not null check (document_hash ~ '^[a-f0-9]{64}$'),
  referenced_asset_ids uuid[] not null default '{}'::uuid[]
    check (cardinality(referenced_asset_ids) <= 100),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, project_id),
  foreign key (tenant_id, project_id)
    references public.studio_projects(tenant_id, id)
    on delete cascade
);

create index studio_project_drafts_updated_idx
  on public.studio_project_drafts(tenant_id, updated_at desc);

create table public.studio_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  project_id uuid not null,
  revision_number bigint not null check (revision_number > 0),
  draft_revision bigint not null check (draft_revision >= 0),
  schema_version integer not null default 1 check (schema_version = 1),
  document_json jsonb not null check (jsonb_typeof(document_json) = 'object'),
  document_hash text not null check (document_hash ~ '^[a-f0-9]{64}$'),
  reason text not null default 'render'
    check (reason in ('render', 'checkpoint', 'restore')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, project_id, id),
  unique (tenant_id, project_id, revision_number),
  foreign key (tenant_id, project_id)
    references public.studio_projects(tenant_id, id)
    on delete restrict
);

create index studio_revisions_project_created_idx
  on public.studio_revisions(tenant_id, project_id, created_at desc);

create table public.studio_revision_assets (
  tenant_id uuid not null,
  project_id uuid not null,
  revision_id uuid not null,
  media_asset_id uuid not null,
  usage_kind text not null default 'image' check (usage_kind = 'image'),
  created_at timestamptz not null default now(),
  primary key (tenant_id, revision_id, media_asset_id),
  foreign key (tenant_id, project_id, revision_id)
    references public.studio_revisions(tenant_id, project_id, id)
    on delete restrict,
  foreign key (tenant_id, media_asset_id)
    references public.media_assets(tenant_id, id)
    on delete restrict
);

create index studio_revision_assets_media_idx
  on public.studio_revision_assets(tenant_id, media_asset_id);

create table public.studio_render_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  project_id uuid not null,
  revision_id uuid not null,
  requested_by uuid references public.profiles(id) on delete set null,
  status text not null default 'queued'
    check (
      status in (
        'queued', 'preparing', 'rendering', 'encoding', 'uploading',
        'creating_media', 'completed', 'failed', 'cancelled'
      )
    ),
  output_kind text not null check (output_kind in ('png', 'mp4')),
  planned_media_asset_id uuid not null default gen_random_uuid(),
  request_idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  progress integer not null default 0 check (progress between 0 and 100),
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text check (
    locked_by is null
    or (
      length(locked_by) between 3 and 120
      and locked_by ~ '^[a-zA-Z0-9._:-]+$'
    )
  ),
  started_at timestamptz,
  finished_at timestamptz,
  error_code text check (
    error_code is null or error_code ~ '^[a-z0-9_]{3,80}$'
  ),
  error_detail text check (error_detail is null or length(error_detail) <= 500),
  cancel_requested_at timestamptz,
  media_asset_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, project_id, id),
  unique (tenant_id, requested_by, request_idempotency_key),
  unique (planned_media_asset_id),
  foreign key (tenant_id, project_id, revision_id)
    references public.studio_revisions(tenant_id, project_id, id)
    on delete restrict,
  foreign key (tenant_id, media_asset_id)
    references public.media_assets(tenant_id, id)
    on delete restrict,
  check (
    (status in ('queued', 'failed', 'cancelled', 'completed')
      and locked_at is null and locked_by is null)
    or (status in ('preparing', 'rendering', 'encoding', 'uploading', 'creating_media')
      and locked_at is not null and locked_by is not null)
  ),
  check (
    (status in ('completed', 'failed', 'cancelled') and finished_at is not null)
    or (status not in ('completed', 'failed', 'cancelled') and finished_at is null)
  ),
  check (
    (status = 'completed' and media_asset_id is not null and progress = 100)
    or (status <> 'completed' and media_asset_id is null)
  )
);

create index studio_render_jobs_queue_idx
  on public.studio_render_jobs(next_attempt_at, created_at, id)
  where status = 'queued';
create index studio_render_jobs_project_created_idx
  on public.studio_render_jobs(tenant_id, project_id, created_at desc);
create index studio_render_jobs_lease_idx
  on public.studio_render_jobs(status, locked_at)
  where status in ('preparing', 'rendering', 'encoding', 'uploading', 'creating_media');

create table public.studio_exports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  project_id uuid not null,
  revision_id uuid not null,
  render_job_id uuid not null,
  media_asset_id uuid not null,
  output_kind text not null check (output_kind in ('png', 'mp4')),
  width integer not null check (width in (1080, 1920)),
  height integer not null check (height in (1080, 1920)),
  duration_seconds numeric(10, 3)
    check (
      duration_seconds is null
      or (duration_seconds > 0 and duration_seconds <= 30)
    ),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, render_job_id),
  foreign key (tenant_id, project_id, revision_id)
    references public.studio_revisions(tenant_id, project_id, id)
    on delete restrict,
  foreign key (tenant_id, project_id, render_job_id)
    references public.studio_render_jobs(tenant_id, project_id, id)
    on delete restrict,
  foreign key (tenant_id, media_asset_id)
    references public.media_assets(tenant_id, id)
    on delete restrict,
  check (
    (output_kind = 'png' and duration_seconds is null)
    or (output_kind = 'mp4' and duration_seconds is not null)
  )
);

create index studio_exports_project_created_idx
  on public.studio_exports(tenant_id, project_id, created_at desc);

create table public.studio_command_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  idempotency_key uuid not null,
  command_type text not null check (length(btrim(command_type)) between 3 and 120),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  target_type text not null check (length(btrim(target_type)) between 2 and 120),
  target_id uuid,
  outcome_json jsonb not null check (jsonb_typeof(outcome_json) = 'object'),
  audit_event_id uuid not null references public.audit_events(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (tenant_id, actor_user_id, idempotency_key)
);

create index studio_command_receipts_actor_created_idx
  on public.studio_command_receipts(actor_user_id, created_at desc);
create index studio_command_receipts_target_created_idx
  on public.studio_command_receipts(tenant_id, target_type, target_id, created_at desc);

create trigger studio_projects_set_updated_at
before update on public.studio_projects
for each row execute function private.set_updated_at();

create trigger studio_project_drafts_set_updated_at
before update on public.studio_project_drafts
for each row execute function private.set_updated_at();

create trigger studio_render_jobs_set_updated_at
before update on public.studio_render_jobs
for each row execute function private.set_updated_at();

create or replace function private.reject_studio_immutable_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'immutable Studio record cannot be changed'
    using errcode = '55000';
end;
$$;

create trigger studio_revisions_reject_update
before update on public.studio_revisions
for each row execute function private.reject_studio_immutable_mutation();
create trigger studio_revisions_reject_delete
before delete on public.studio_revisions
for each row execute function private.reject_studio_immutable_mutation();
create trigger studio_revision_assets_reject_update
before update on public.studio_revision_assets
for each row execute function private.reject_studio_immutable_mutation();
create trigger studio_revision_assets_reject_delete
before delete on public.studio_revision_assets
for each row execute function private.reject_studio_immutable_mutation();
create trigger studio_exports_reject_update
before update on public.studio_exports
for each row execute function private.reject_studio_immutable_mutation();
create trigger studio_exports_reject_delete
before delete on public.studio_exports
for each row execute function private.reject_studio_immutable_mutation();
create trigger studio_command_receipts_reject_update
before update on public.studio_command_receipts
for each row execute function private.reject_studio_immutable_mutation();
create trigger studio_command_receipts_reject_delete
before delete on public.studio_command_receipts
for each row execute function private.reject_studio_immutable_mutation();

-- Extend the existing tenant custom-role contract with Studio capabilities.
alter table public.tenant_custom_roles
  drop constraint tenant_custom_roles_capabilities_check,
  add constraint tenant_custom_roles_capabilities_check check (
    capabilities <@ array[
      'tenant.media.write',
      'tenant.playlist.write',
      'tenant.playlist.publish',
      'tenant.screen.manage',
      'tenant.settings.manage',
      'tenant.audit.read',
      'tenant.support.export',
      'tenant.studio.read',
      'tenant.studio.create',
      'tenant.studio.edit_own',
      'tenant.studio.edit_all',
      'tenant.studio.archive',
      'tenant.studio.template.manage',
      'tenant.studio.motion.edit',
      'tenant.studio.render',
      'tenant.studio.job.manage'
    ]::text[]
    and (
      ('tenant.media.write' = any(capabilities))
      = ('tenant.playlist.write' = any(capabilities))
    )
  );

create or replace function private.builtin_tenant_capabilities(
  p_role public.tenant_role
)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'tenant_owner'::public.tenant_role then array[
      'tenant.overview.read', 'tenant.media.read', 'tenant.media.write',
      'tenant.playlist.read', 'tenant.playlist.write', 'tenant.playlist.archive',
      'tenant.playlist.publish', 'tenant.release.read', 'tenant.screen.read',
      'tenant.screen.manage', 'tenant.team.read', 'tenant.team.manage',
      'tenant.settings.read', 'tenant.settings.manage', 'tenant.audit.read',
      'tenant.support.export', 'tenant.studio.read', 'tenant.studio.create',
      'tenant.studio.edit_own', 'tenant.studio.edit_all', 'tenant.studio.archive',
      'tenant.studio.template.manage', 'tenant.studio.motion.edit',
      'tenant.studio.render', 'tenant.studio.job.manage'
    ]::text[]
    when 'tenant_admin'::public.tenant_role then array[
      'tenant.overview.read', 'tenant.media.read', 'tenant.media.write',
      'tenant.playlist.read', 'tenant.playlist.write', 'tenant.playlist.archive',
      'tenant.playlist.publish', 'tenant.release.read', 'tenant.screen.read',
      'tenant.screen.manage', 'tenant.team.read', 'tenant.team.manage',
      'tenant.settings.read', 'tenant.settings.manage', 'tenant.audit.read',
      'tenant.support.export', 'tenant.studio.read', 'tenant.studio.create',
      'tenant.studio.edit_own', 'tenant.studio.edit_all', 'tenant.studio.archive',
      'tenant.studio.template.manage', 'tenant.studio.motion.edit',
      'tenant.studio.render', 'tenant.studio.job.manage'
    ]::text[]
    when 'tenant_editor'::public.tenant_role then array[
      'tenant.overview.read', 'tenant.media.read', 'tenant.media.write',
      'tenant.playlist.read', 'tenant.playlist.write', 'tenant.release.read',
      'tenant.screen.read', 'tenant.team.read', 'tenant.settings.read',
      'tenant.studio.read', 'tenant.studio.create', 'tenant.studio.edit_own',
      'tenant.studio.edit_all', 'tenant.studio.motion.edit', 'tenant.studio.render'
    ]::text[]
    else array[
      'tenant.overview.read', 'tenant.media.read', 'tenant.playlist.read',
      'tenant.release.read', 'tenant.screen.read', 'tenant.team.read',
      'tenant.settings.read', 'tenant.studio.read'
    ]::text[]
  end;
$$;

create or replace function private.tenant_baseline_capabilities()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'tenant.overview.read', 'tenant.media.read', 'tenant.playlist.read',
    'tenant.release.read', 'tenant.screen.read', 'tenant.team.read',
    'tenant.settings.read', 'tenant.studio.read'
  ]::text[];
$$;

create or replace function private.normalize_custom_role_capabilities(
  p_capabilities text[]
)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized text[];
  allowed constant text[] := array[
    'tenant.media.write',
    'tenant.playlist.write',
    'tenant.playlist.publish',
    'tenant.screen.manage',
    'tenant.settings.manage',
    'tenant.audit.read',
    'tenant.support.export',
    'tenant.studio.read',
    'tenant.studio.create',
    'tenant.studio.edit_own',
    'tenant.studio.edit_all',
    'tenant.studio.archive',
    'tenant.studio.template.manage',
    'tenant.studio.motion.edit',
    'tenant.studio.render',
    'tenant.studio.job.manage'
  ]::text[];
begin
  select coalesce(array_agg(distinct capability order by capability), '{}'::text[])
  into normalized
  from unnest(coalesce(p_capabilities, '{}'::text[])) capability;

  if not normalized <@ allowed then
    raise exception 'custom role contains unsupported capabilities'
      using errcode = '23514';
  end if;
  if (
    ('tenant.media.write' = any(normalized))
    <> ('tenant.playlist.write' = any(normalized))
  ) then
    raise exception 'content editing requires media and playlist write together'
      using errcode = '23514';
  end if;
  return normalized;
end;
$$;

create or replace function private.can_read_studio(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_tenant_capability(p_tenant_id, 'tenant.studio.read')
    or private.is_platform_member(array[
      'platform_owner', 'platform_admin', 'platform_support'
    ]::public.platform_role[]);
$$;

create or replace function private.can_create_studio(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_tenant_capability(p_tenant_id, 'tenant.studio.create');
$$;

create or replace function private.can_edit_studio_project(
  p_tenant_id uuid,
  p_owner_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_tenant_capability(p_tenant_id, 'tenant.studio.edit_all')
    or (
      p_owner_user_id = private.current_user_id()
      and private.has_tenant_capability(p_tenant_id, 'tenant.studio.edit_own')
    );
$$;

create or replace function private.can_manage_studio_jobs(
  p_tenant_id uuid,
  p_requested_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_tenant_capability(p_tenant_id, 'tenant.studio.job.manage')
    or (
      p_requested_by = private.current_user_id()
      and private.has_tenant_capability(p_tenant_id, 'tenant.studio.render')
    );
$$;

alter table public.studio_projects enable row level security;
alter table public.studio_projects force row level security;
alter table public.studio_project_drafts enable row level security;
alter table public.studio_project_drafts force row level security;
alter table public.studio_revisions enable row level security;
alter table public.studio_revisions force row level security;
alter table public.studio_revision_assets enable row level security;
alter table public.studio_revision_assets force row level security;
alter table public.studio_render_jobs enable row level security;
alter table public.studio_render_jobs force row level security;
alter table public.studio_exports enable row level security;
alter table public.studio_exports force row level security;
alter table public.studio_command_receipts enable row level security;
alter table public.studio_command_receipts force row level security;

revoke all on
  public.studio_projects,
  public.studio_project_drafts,
  public.studio_revisions,
  public.studio_revision_assets,
  public.studio_render_jobs,
  public.studio_exports,
  public.studio_command_receipts
from public, anon, authenticated;

grant select on
  public.studio_projects,
  public.studio_project_drafts,
  public.studio_revisions,
  public.studio_revision_assets,
  public.studio_render_jobs,
  public.studio_exports,
  public.studio_command_receipts
to authenticated;

create policy "studio_projects_select_by_scope"
on public.studio_projects for select to authenticated
using (private.can_read_studio(tenant_id));

create policy "studio_project_drafts_select_by_scope"
on public.studio_project_drafts for select to authenticated
using (private.can_read_studio(tenant_id));

create policy "studio_revisions_select_by_scope"
on public.studio_revisions for select to authenticated
using (private.can_read_studio(tenant_id));

create policy "studio_revision_assets_select_by_scope"
on public.studio_revision_assets for select to authenticated
using (private.can_read_studio(tenant_id));

create policy "studio_render_jobs_select_by_scope"
on public.studio_render_jobs for select to authenticated
using (private.can_read_studio(tenant_id));

create policy "studio_exports_select_by_scope"
on public.studio_exports for select to authenticated
using (private.can_read_studio(tenant_id));

create policy "studio_command_receipts_select_own"
on public.studio_command_receipts for select to authenticated
using (
  actor_user_id = private.current_user_id()
  and (
    private.is_tenant_member(tenant_id)
    or private.is_platform_member(array[
      'platform_owner', 'platform_admin'
    ]::public.platform_role[])
  )
);

create or replace function private.studio_document_hash(p_document jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(
    extensions.digest(
      pg_catalog.convert_to(p_document::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function private.normalize_studio_asset_ids(p_asset_ids uuid[])
returns uuid[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    array_agg(distinct asset_id order by asset_id),
    '{}'::uuid[]
  )
  from unnest(coalesce(p_asset_ids, '{}'::uuid[])) asset_id
  where asset_id is not null;
$$;

create or replace function private.assert_studio_document(
  p_tenant_id uuid,
  p_orientation text,
  p_width integer,
  p_height integer,
  p_document jsonb,
  p_referenced_asset_ids uuid[]
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_asset_ids uuid[] :=
    private.normalize_studio_asset_ids(p_referenced_asset_ids);
  document_asset_ids uuid[];
  expected_asset_count integer := cardinality(normalized_asset_ids);
  element_count integer;
  schema_version_text text;
  duration_text text;
  fps_text text;
  document_width_text text;
  document_height_text text;
  motion_enabled_text text;
begin
  if p_document is null or jsonb_typeof(p_document) <> 'object'
    or jsonb_typeof(p_document -> 'artboard') <> 'object'
    or jsonb_typeof(p_document -> 'motion') <> 'object'
    or jsonb_typeof(p_document -> 'elements') <> 'array'
    or jsonb_typeof(p_document -> 'metadata') <> 'object'
  then
    raise exception 'Studio document structure is invalid' using errcode = '23514';
  end if;

  schema_version_text := p_document ->> 'schemaVersion';
  document_width_text := p_document #>> '{artboard,width}';
  document_height_text := p_document #>> '{artboard,height}';
  duration_text := p_document #>> '{motion,durationMs}';
  fps_text := p_document #>> '{motion,fps}';
  motion_enabled_text := p_document #>> '{motion,enabled}';
  element_count := jsonb_array_length(p_document -> 'elements');

  if schema_version_text is null or schema_version_text !~ '^[0-9]+$'
    or schema_version_text::integer <> 1
    or document_width_text is null or document_width_text !~ '^[0-9]+$'
    or document_height_text is null or document_height_text !~ '^[0-9]+$'
    or duration_text is null or duration_text !~ '^[0-9]+$'
    or fps_text is null or fps_text !~ '^[0-9]+$'
    or motion_enabled_text not in ('true', 'false')
    or p_document #>> '{artboard,orientation}' is distinct from p_orientation
    or document_width_text::integer <> p_width
    or document_height_text::integer <> p_height
    or duration_text::integer not between 1000 and 30000
    or fps_text::integer <> 30
    or element_count > 200
    or expected_asset_count > 100
    or not (
      (p_orientation = 'landscape' and p_width = 1920 and p_height = 1080)
      or (p_orientation = 'portrait' and p_width = 1080 and p_height = 1920)
    )
  then
    raise exception 'Studio document is outside supported limits'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_document -> 'elements') element
    where element ->> 'type' = 'image'
      and (
        element ->> 'mediaAssetId' is null
        or element ->> 'mediaAssetId' !~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      )
  ) then
    raise exception 'Studio image element contains an invalid media asset id'
      using errcode = '23514';
  end if;

  select coalesce(
    array_agg(distinct media_asset_id order by media_asset_id),
    '{}'::uuid[]
  )
  into document_asset_ids
  from (
    select (element ->> 'mediaAssetId')::uuid as media_asset_id
    from jsonb_array_elements(p_document -> 'elements') element
    where element ->> 'type' = 'image'
  ) image_assets;

  if document_asset_ids is distinct from normalized_asset_ids then
    raise exception 'Studio document media manifest does not match its image elements'
      using errcode = '23514';
  end if;

  if (
    select count(*)::integer
    from public.media_assets asset
    where asset.tenant_id = p_tenant_id
      and asset.id = any(normalized_asset_ids)
      and asset.kind = 'image'::public.media_asset_kind
      and asset.status = 'ready'::public.media_asset_status
      and asset.deleted_at is null
      and exists (
        select 1
        from public.media_variants variant
        where variant.tenant_id = asset.tenant_id
          and variant.asset_id = asset.id
          and variant.variant_type = 'original'::public.media_variant_type
          and variant.mime_type in ('image/jpeg', 'image/png', 'image/webp')
          and variant.checksum_sha256 ~ '^[a-f0-9]{64}$'
      )
  ) <> expected_asset_count then
    raise exception 'Studio document references unavailable tenant media'
      using errcode = '23514';
  end if;
end;
$$;

create or replace function private.begin_studio_command(
  p_tenant_id uuid,
  p_command_type text,
  p_idempotency_key uuid,
  p_request_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_command text := btrim(coalesce(p_command_type, ''));
  request_hash text;
  receipt public.studio_command_receipts%rowtype;
begin
  if actor_id is null or p_idempotency_key is null then
    raise exception 'authenticated idempotent Studio command required'
      using errcode = '42501';
  end if;
  if length(normalized_command) not between 3 and 120
    or p_request_json is null
    or jsonb_typeof(p_request_json) <> 'object'
  then
    raise exception 'Studio command is invalid' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_id::text || ':' || p_idempotency_key::text, 43)
  );
  request_hash := private.studio_document_hash(p_request_json);

  select command_receipt.*
  into receipt
  from public.studio_command_receipts command_receipt
  where command_receipt.tenant_id = p_tenant_id
    and command_receipt.actor_user_id = actor_id
    and command_receipt.idempotency_key = p_idempotency_key;

  if not found then
    return null;
  end if;
  if receipt.command_type is distinct from normalized_command
    or receipt.request_hash is distinct from request_hash
  then
    raise exception 'idempotency key belongs to another Studio command'
      using errcode = '23505';
  end if;
  return receipt.outcome_json;
end;
$$;

create or replace function private.complete_studio_command(
  p_tenant_id uuid,
  p_command_type text,
  p_idempotency_key uuid,
  p_request_json jsonb,
  p_target_type text,
  p_target_id uuid,
  p_outcome_json jsonb,
  p_audit_action text,
  p_audit_result text default 'success'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  audit_id uuid;
begin
  if actor_id is null
    or p_idempotency_key is null
    or p_outcome_json is null
    or jsonb_typeof(p_outcome_json) <> 'object'
  then
    raise exception 'Studio command completion is invalid' using errcode = '22023';
  end if;

  audit_id := private.audit_event(
    p_tenant_id,
    p_audit_action,
    p_target_type,
    p_target_id,
    p_audit_result,
    jsonb_build_object(
      'commandType', p_command_type,
      'idempotencyKey', p_idempotency_key,
      'outcome', p_outcome_json
    )
  );

  insert into public.studio_command_receipts (
    tenant_id,
    actor_user_id,
    idempotency_key,
    command_type,
    request_hash,
    target_type,
    target_id,
    outcome_json,
    audit_event_id
  )
  values (
    p_tenant_id,
    actor_id,
    p_idempotency_key,
    btrim(p_command_type),
    private.studio_document_hash(p_request_json),
    btrim(p_target_type),
    p_target_id,
    p_outcome_json,
    audit_id
  );
  return p_outcome_json;
end;
$$;

create or replace function public.create_studio_project_v1(
  p_tenant_id uuid,
  p_name text,
  p_orientation text,
  p_document jsonb,
  p_referenced_asset_ids uuid[],
  p_project_kind text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_name text := nullif(btrim(p_name), '');
  normalized_kind text := coalesce(nullif(btrim(p_project_kind), ''), 'design');
  normalized_asset_ids uuid[] :=
    private.normalize_studio_asset_ids(p_referenced_asset_ids);
  project_width integer;
  project_height integer;
  next_motion_enabled boolean;
  next_duration_ms integer;
  next_document_hash text;
  request_json jsonb;
  replay jsonb;
  project_id uuid;
  outcome jsonb;
begin
  if actor_id is null or not private.can_create_studio(p_tenant_id) then
    raise exception 'actor cannot create Studio projects' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if normalized_name is null or length(normalized_name) not between 2 and 120
    or normalized_kind not in ('design', 'tenant_template')
    or p_orientation not in ('landscape', 'portrait')
  then
    raise exception 'Studio project details are invalid' using errcode = '23514';
  end if;
  if normalized_kind = 'tenant_template'
    and not private.has_tenant_capability(
      p_tenant_id,
      'tenant.studio.template.manage'
    )
  then
    raise exception 'actor cannot manage Studio templates' using errcode = '42501';
  end if;

  project_width := case when p_orientation = 'landscape' then 1920 else 1080 end;
  project_height := case when p_orientation = 'landscape' then 1080 else 1920 end;
  perform private.assert_studio_document(
    p_tenant_id,
    p_orientation,
    project_width,
    project_height,
    p_document,
    normalized_asset_ids
  );
  next_motion_enabled := (p_document #>> '{motion,enabled}')::boolean;
  next_duration_ms := (p_document #>> '{motion,durationMs}')::integer;
  if next_motion_enabled
    and not private.has_tenant_capability(
      p_tenant_id,
      'tenant.studio.motion.edit'
    )
  then
    raise exception 'actor cannot create motion Studio projects'
      using errcode = '42501';
  end if;

  next_document_hash := private.studio_document_hash(p_document);
  request_json := jsonb_build_object(
    'tenantId', p_tenant_id,
    'name', normalized_name,
    'orientation', p_orientation,
    'projectKind', normalized_kind,
    'documentHash', next_document_hash,
    'referencedAssetIds', to_jsonb(normalized_asset_ids)
  );
  replay := private.begin_studio_command(
    p_tenant_id,
    'studio.project.create',
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  insert into public.studio_projects (
    tenant_id,
    owner_user_id,
    name,
    project_kind,
    orientation,
    width,
    height,
    motion_enabled,
    duration_ms,
    created_by,
    updated_by
  )
  values (
    p_tenant_id,
    actor_id,
    normalized_name,
    normalized_kind,
    p_orientation,
    project_width,
    project_height,
    next_motion_enabled,
    next_duration_ms,
    actor_id,
    actor_id
  )
  returning id into project_id;

  insert into public.studio_project_drafts (
    tenant_id,
    project_id,
    draft_revision,
    document_json,
    document_hash,
    referenced_asset_ids,
    updated_by
  )
  values (
    p_tenant_id,
    project_id,
    0,
    p_document,
    next_document_hash,
    normalized_asset_ids,
    actor_id
  );

  outcome := jsonb_build_object(
    'outcome', 'created',
    'projectId', project_id,
    'projectRevision', 0,
    'draftRevision', 0
  );
  return private.complete_studio_command(
    p_tenant_id,
    'studio.project.create',
    p_idempotency_key,
    request_json,
    'studio_projects',
    project_id,
    outcome,
    'studio.project.created'
  );
end;
$$;

create or replace function public.save_studio_draft_v1(
  p_project_id uuid,
  p_expected_revision bigint,
  p_document jsonb,
  p_referenced_asset_ids uuid[],
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  project_record public.studio_projects%rowtype;
  draft_record public.studio_project_drafts%rowtype;
  normalized_asset_ids uuid[] :=
    private.normalize_studio_asset_ids(p_referenced_asset_ids);
  next_motion_enabled boolean;
  next_duration_ms integer;
  next_document_hash text;
  request_json jsonb;
  replay jsonb;
  outcome jsonb;
begin
  select project.*
  into project_record
  from public.studio_projects project
  where project.id = p_project_id;

  if not found then
    raise exception 'Studio project not found' using errcode = 'P0002';
  end if;
  if actor_id is null
    or not private.can_edit_studio_project(
      project_record.tenant_id,
      project_record.owner_user_id
    )
  then
    raise exception 'actor cannot edit Studio project' using errcode = '42501';
  end if;
  if project_record.project_kind = 'tenant_template'
    and not private.has_tenant_capability(
      project_record.tenant_id,
      'tenant.studio.template.manage'
    )
  then
    raise exception 'actor cannot edit Studio templates' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(project_record.tenant_id);
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'expected Studio revision is invalid' using errcode = '23514';
  end if;
  perform private.assert_studio_document(
    project_record.tenant_id,
    project_record.orientation,
    project_record.width,
    project_record.height,
    p_document,
    normalized_asset_ids
  );
  next_motion_enabled := (p_document #>> '{motion,enabled}')::boolean;
  next_duration_ms := (p_document #>> '{motion,durationMs}')::integer;
  if next_motion_enabled
    and not private.has_tenant_capability(
      project_record.tenant_id,
      'tenant.studio.motion.edit'
    )
  then
    raise exception 'actor cannot edit Studio motion' using errcode = '42501';
  end if;

  next_document_hash := private.studio_document_hash(p_document);
  request_json := jsonb_build_object(
    'projectId', p_project_id,
    'expectedRevision', p_expected_revision,
    'documentHash', next_document_hash,
    'referencedAssetIds', to_jsonb(normalized_asset_ids)
  );
  replay := private.begin_studio_command(
    project_record.tenant_id,
    'studio.draft.save',
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  select project.*
  into project_record
  from public.studio_projects project
  where project.id = p_project_id
  for update;

  select draft.*
  into draft_record
  from public.studio_project_drafts draft
  where draft.tenant_id = project_record.tenant_id
    and draft.project_id = project_record.id
  for update;

  if not found then
    raise exception 'Studio draft not found' using errcode = 'P0002';
  end if;
  if project_record.status <> 'active' then
    raise exception 'Studio project is not editable' using errcode = '55000';
  end if;
  if draft_record.draft_revision <> p_expected_revision then
    outcome := jsonb_build_object(
      'outcome', 'conflict',
      'projectId', project_record.id,
      'actualRevision', draft_record.draft_revision
    );
    return private.complete_studio_command(
      project_record.tenant_id,
      'studio.draft.save',
      p_idempotency_key,
      request_json,
      'studio_projects',
      project_record.id,
      outcome,
      'studio.draft.conflict',
      'failed'
    );
  end if;

  update public.studio_project_drafts
  set
    draft_revision = draft_revision + 1,
    document_json = p_document,
    document_hash = next_document_hash,
    referenced_asset_ids = normalized_asset_ids,
    updated_by = actor_id
  where tenant_id = project_record.tenant_id
    and project_id = project_record.id
  returning draft_revision into draft_record.draft_revision;

  update public.studio_projects
  set
    motion_enabled = next_motion_enabled,
    duration_ms = next_duration_ms,
    revision = revision + 1,
    updated_by = actor_id
  where tenant_id = project_record.tenant_id
    and id = project_record.id
  returning revision into project_record.revision;

  outcome := jsonb_build_object(
    'outcome', 'saved',
    'projectId', project_record.id,
    'projectRevision', project_record.revision,
    'draftRevision', draft_record.draft_revision
  );
  return private.complete_studio_command(
    project_record.tenant_id,
    'studio.draft.save',
    p_idempotency_key,
    request_json,
    'studio_projects',
    project_record.id,
    outcome,
    'studio.draft.saved'
  );
end;
$$;

create or replace function public.mutate_studio_project_v1(
  p_project_id uuid,
  p_expected_revision bigint,
  p_operation text,
  p_payload jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  project_record public.studio_projects%rowtype;
  draft_record public.studio_project_drafts%rowtype;
  normalized_operation text := lower(btrim(coalesce(p_operation, '')));
  normalized_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  normalized_name text;
  request_json jsonb;
  replay jsonb;
  outcome jsonb;
  duplicate_id uuid;
begin
  select project.*
  into project_record
  from public.studio_projects project
  where project.id = p_project_id;

  if not found then
    raise exception 'Studio project not found' using errcode = 'P0002';
  end if;
  if actor_id is null
    or not private.can_edit_studio_project(
      project_record.tenant_id,
      project_record.owner_user_id
    )
  then
    raise exception 'actor cannot mutate Studio project' using errcode = '42501';
  end if;
  if project_record.project_kind = 'tenant_template'
    and normalized_operation <> 'duplicate'
    and not private.has_tenant_capability(
      project_record.tenant_id,
      'tenant.studio.template.manage'
    )
  then
    raise exception 'actor cannot manage Studio templates' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(project_record.tenant_id);
  if normalized_operation not in (
      'rename', 'archive', 'delete', 'restore', 'duplicate'
    )
    or jsonb_typeof(normalized_payload) <> 'object'
    or p_expected_revision is null
    or p_expected_revision < 0
  then
    raise exception 'Studio project mutation is invalid' using errcode = '23514';
  end if;
  if normalized_operation in ('archive', 'delete', 'restore')
    and not private.has_tenant_capability(
      project_record.tenant_id,
      'tenant.studio.archive'
    )
  then
    raise exception 'actor cannot archive Studio projects' using errcode = '42501';
  end if;
  if normalized_operation = 'duplicate'
    and not private.can_create_studio(project_record.tenant_id)
  then
    raise exception 'actor cannot duplicate Studio projects' using errcode = '42501';
  end if;

  request_json := jsonb_build_object(
    'projectId', p_project_id,
    'expectedRevision', p_expected_revision,
    'operation', normalized_operation,
    'payload', normalized_payload
  );
  replay := private.begin_studio_command(
    project_record.tenant_id,
    'studio.project.' || normalized_operation,
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  select project.*
  into project_record
  from public.studio_projects project
  where project.id = p_project_id
  for update;
  if project_record.revision <> p_expected_revision then
    outcome := jsonb_build_object(
      'outcome', 'conflict',
      'projectId', project_record.id,
      'actualRevision', project_record.revision
    );
    return private.complete_studio_command(
      project_record.tenant_id,
      'studio.project.' || normalized_operation,
      p_idempotency_key,
      request_json,
      'studio_projects',
      project_record.id,
      outcome,
      'studio.project.conflict',
      'failed'
    );
  end if;

  if normalized_operation = 'duplicate' then
    select draft.*
    into draft_record
    from public.studio_project_drafts draft
    where draft.tenant_id = project_record.tenant_id
      and draft.project_id = project_record.id
    for share;
    if not found then
      raise exception 'Studio draft not found' using errcode = 'P0002';
    end if;

    normalized_name := nullif(btrim(normalized_payload ->> 'name'), '');
    if normalized_name is null then
      normalized_name := left(project_record.name, 114) || ' kopie';
    end if;
    if length(normalized_name) not between 2 and 120 then
      raise exception 'duplicate Studio project name is invalid'
        using errcode = '23514';
    end if;

    insert into public.studio_projects (
      tenant_id,
      owner_user_id,
      name,
      project_kind,
      orientation,
      width,
      height,
      motion_enabled,
      duration_ms,
      fps,
      created_by,
      updated_by
    )
    values (
      project_record.tenant_id,
      actor_id,
      normalized_name,
      'design',
      project_record.orientation,
      project_record.width,
      project_record.height,
      project_record.motion_enabled,
      project_record.duration_ms,
      project_record.fps,
      actor_id,
      actor_id
    )
    returning id into duplicate_id;

    insert into public.studio_project_drafts (
      tenant_id,
      project_id,
      draft_revision,
      schema_version,
      document_json,
      document_hash,
      referenced_asset_ids,
      updated_by
    )
    values (
      project_record.tenant_id,
      duplicate_id,
      0,
      draft_record.schema_version,
      draft_record.document_json,
      draft_record.document_hash,
      draft_record.referenced_asset_ids,
      actor_id
    );

    outcome := jsonb_build_object(
      'outcome', 'created',
      'projectId', duplicate_id,
      'sourceProjectId', project_record.id,
      'projectRevision', 0,
      'draftRevision', 0
    );
    return private.complete_studio_command(
      project_record.tenant_id,
      'studio.project.duplicate',
      p_idempotency_key,
      request_json,
      'studio_projects',
      duplicate_id,
      outcome,
      'studio.project.duplicated'
    );
  end if;

  if normalized_operation = 'rename' then
    normalized_name := nullif(btrim(normalized_payload ->> 'name'), '');
    if normalized_name is null or length(normalized_name) not between 2 and 120 then
      raise exception 'Studio project name is invalid' using errcode = '23514';
    end if;
    update public.studio_projects
    set
      name = normalized_name,
      revision = revision + 1,
      updated_by = actor_id
    where tenant_id = project_record.tenant_id and id = project_record.id
    returning * into project_record;
  elsif normalized_operation = 'archive' then
    update public.studio_projects
    set
      status = 'archived',
      archived_at = now(),
      deleted_at = null,
      revision = revision + 1,
      updated_by = actor_id
    where tenant_id = project_record.tenant_id and id = project_record.id
    returning * into project_record;
  elsif normalized_operation = 'delete' then
    update public.studio_projects
    set
      status = 'deleted',
      deleted_at = now(),
      revision = revision + 1,
      updated_by = actor_id
    where tenant_id = project_record.tenant_id and id = project_record.id
    returning * into project_record;
  else
    update public.studio_projects
    set
      status = 'active',
      archived_at = null,
      deleted_at = null,
      revision = revision + 1,
      updated_by = actor_id
    where tenant_id = project_record.tenant_id and id = project_record.id
    returning * into project_record;
  end if;

  if normalized_operation in ('archive', 'delete') then
    update public.studio_render_jobs
    set
      status = 'cancelled',
      cancel_requested_at = now(),
      finished_at = now(),
      error_code = 'render_cancelled',
      error_detail = 'Project is niet langer actief.'
    where tenant_id = project_record.tenant_id
      and project_id = project_record.id
      and status = 'queued';

    update public.studio_render_jobs
    set cancel_requested_at = coalesce(cancel_requested_at, now())
    where tenant_id = project_record.tenant_id
      and project_id = project_record.id
      and status in (
        'preparing', 'rendering', 'encoding', 'uploading', 'creating_media'
      );
  end if;

  outcome := jsonb_build_object(
    'outcome', 'applied',
    'projectId', project_record.id,
    'projectRevision', project_record.revision,
    'status', project_record.status
  );
  return private.complete_studio_command(
    project_record.tenant_id,
    'studio.project.' || normalized_operation,
    p_idempotency_key,
    request_json,
    'studio_projects',
    project_record.id,
    outcome,
    'studio.project.' || normalized_operation
  );
end;
$$;

create or replace function public.request_studio_render_v1(
  p_project_id uuid,
  p_expected_draft_revision bigint,
  p_output_kind text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  project_record public.studio_projects%rowtype;
  draft_record public.studio_project_drafts%rowtype;
  normalized_output_kind text := lower(btrim(coalesce(p_output_kind, '')));
  request_json jsonb;
  request_hash text;
  replay jsonb;
  outcome jsonb;
  revision_id uuid;
  revision_number bigint;
  render_job_id uuid;
  planned_asset_id uuid := gen_random_uuid();
begin
  select project.*
  into project_record
  from public.studio_projects project
  where project.id = p_project_id;

  if not found then
    raise exception 'Studio project not found' using errcode = 'P0002';
  end if;
  if actor_id is null
    or not private.can_edit_studio_project(
      project_record.tenant_id,
      project_record.owner_user_id
    )
    or not private.has_tenant_capability(
      project_record.tenant_id,
      'tenant.studio.render'
    )
  then
    raise exception 'actor cannot render Studio project' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(project_record.tenant_id);
  if p_expected_draft_revision is null or p_expected_draft_revision < 0
    or normalized_output_kind not in ('png', 'mp4')
    or (
      project_record.motion_enabled
      and normalized_output_kind <> 'mp4'
    )
    or (
      not project_record.motion_enabled
      and normalized_output_kind <> 'png'
    )
  then
    raise exception 'Studio render request is invalid' using errcode = '23514';
  end if;

  select draft.*
  into draft_record
  from public.studio_project_drafts draft
  where draft.tenant_id = project_record.tenant_id
    and draft.project_id = project_record.id;
  if not found then
    raise exception 'Studio draft not found' using errcode = 'P0002';
  end if;

  request_json := jsonb_build_object(
    'projectId', p_project_id,
    'expectedDraftRevision', p_expected_draft_revision,
    'outputKind', normalized_output_kind,
    'documentHash', draft_record.document_hash
  );
  request_hash := private.studio_document_hash(request_json);
  replay := private.begin_studio_command(
    project_record.tenant_id,
    'studio.render.request',
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  select project.*
  into project_record
  from public.studio_projects project
  where project.id = p_project_id
  for update;
  select draft.*
  into draft_record
  from public.studio_project_drafts draft
  where draft.tenant_id = project_record.tenant_id
    and draft.project_id = project_record.id
  for update;

  if project_record.status <> 'active' then
    raise exception 'Studio project is not renderable' using errcode = '55000';
  end if;
  if draft_record.draft_revision <> p_expected_draft_revision then
    outcome := jsonb_build_object(
      'outcome', 'conflict',
      'projectId', project_record.id,
      'actualRevision', draft_record.draft_revision
    );
    return private.complete_studio_command(
      project_record.tenant_id,
      'studio.render.request',
      p_idempotency_key,
      request_json,
      'studio_projects',
      project_record.id,
      outcome,
      'studio.render.conflict',
      'failed'
    );
  end if;

  perform private.assert_studio_document(
    project_record.tenant_id,
    project_record.orientation,
    project_record.width,
    project_record.height,
    draft_record.document_json,
    draft_record.referenced_asset_ids
  );

  select coalesce(max(revision.revision_number), 0) + 1
  into revision_number
  from public.studio_revisions revision
  where revision.tenant_id = project_record.tenant_id
    and revision.project_id = project_record.id;

  insert into public.studio_revisions (
    tenant_id,
    project_id,
    revision_number,
    draft_revision,
    schema_version,
    document_json,
    document_hash,
    reason,
    created_by
  )
  values (
    project_record.tenant_id,
    project_record.id,
    revision_number,
    draft_record.draft_revision,
    draft_record.schema_version,
    draft_record.document_json,
    draft_record.document_hash,
    'render',
    actor_id
  )
  returning id into revision_id;

  insert into public.studio_revision_assets (
    tenant_id,
    project_id,
    revision_id,
    media_asset_id
  )
  select
    project_record.tenant_id,
    project_record.id,
    revision_id,
    asset_id
  from unnest(draft_record.referenced_asset_ids) asset_id;

  insert into public.studio_render_jobs (
    tenant_id,
    project_id,
    revision_id,
    requested_by,
    output_kind,
    planned_media_asset_id,
    request_idempotency_key,
    request_hash
  )
  values (
    project_record.tenant_id,
    project_record.id,
    revision_id,
    actor_id,
    normalized_output_kind,
    planned_asset_id,
    p_idempotency_key,
    request_hash
  )
  returning id into render_job_id;

  outcome := jsonb_build_object(
    'outcome', 'queued',
    'projectId', project_record.id,
    'revisionId', revision_id,
    'revisionNumber', revision_number,
    'renderJobId', render_job_id,
    'mediaAssetId', planned_asset_id,
    'status', 'queued',
    'outputKind', normalized_output_kind
  );
  return private.complete_studio_command(
    project_record.tenant_id,
    'studio.render.request',
    p_idempotency_key,
    request_json,
    'studio_render_jobs',
    render_job_id,
    outcome,
    'studio.render.queued'
  );
end;
$$;

create or replace function public.retry_studio_render_v1(
  p_render_job_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  job_record public.studio_render_jobs%rowtype;
  request_json jsonb;
  replay jsonb;
  outcome jsonb;
begin
  select job.*
  into job_record
  from public.studio_render_jobs job
  where job.id = p_render_job_id;
  if not found then
    raise exception 'Studio render job not found' using errcode = 'P0002';
  end if;
  if actor_id is null
    or not private.can_manage_studio_jobs(
      job_record.tenant_id,
      job_record.requested_by
    )
    or not private.has_tenant_capability(
      job_record.tenant_id,
      'tenant.studio.render'
    )
  then
    raise exception 'actor cannot retry Studio render job' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(job_record.tenant_id);

  request_json := jsonb_build_object(
    'renderJobId', p_render_job_id,
    'operation', 'retry'
  );
  replay := private.begin_studio_command(
    job_record.tenant_id,
    'studio.render.retry',
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  select job.*
  into job_record
  from public.studio_render_jobs job
  where job.id = p_render_job_id
  for update;

  if job_record.status = 'failed' and job_record.attempt_count < 10 then
    update public.studio_render_jobs
    set
      status = 'queued',
      progress = 0,
      max_attempts = least(10, greatest(max_attempts, attempt_count + 1)),
      next_attempt_at = now(),
      started_at = null,
      finished_at = null,
      error_code = null,
      error_detail = null
    where id = job_record.id
    returning * into job_record;
    outcome := jsonb_build_object(
      'outcome', 'queued',
      'renderJobId', job_record.id,
      'status', job_record.status
    );
  else
    outcome := jsonb_build_object(
      'outcome', 'unchanged',
      'renderJobId', job_record.id,
      'status', job_record.status
    );
  end if;

  return private.complete_studio_command(
    job_record.tenant_id,
    'studio.render.retry',
    p_idempotency_key,
    request_json,
    'studio_render_jobs',
    job_record.id,
    outcome,
    'studio.render.retry_requested'
  );
end;
$$;

create or replace function public.cancel_studio_render_v1(
  p_render_job_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  job_record public.studio_render_jobs%rowtype;
  request_json jsonb;
  replay jsonb;
  outcome jsonb;
begin
  select job.*
  into job_record
  from public.studio_render_jobs job
  where job.id = p_render_job_id;
  if not found then
    raise exception 'Studio render job not found' using errcode = 'P0002';
  end if;
  if actor_id is null
    or not private.can_manage_studio_jobs(
      job_record.tenant_id,
      job_record.requested_by
    )
  then
    raise exception 'actor cannot cancel Studio render job' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(job_record.tenant_id);

  request_json := jsonb_build_object(
    'renderJobId', p_render_job_id,
    'operation', 'cancel'
  );
  replay := private.begin_studio_command(
    job_record.tenant_id,
    'studio.render.cancel',
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  select job.*
  into job_record
  from public.studio_render_jobs job
  where job.id = p_render_job_id
  for update;

  if job_record.status = 'queued' then
    update public.studio_render_jobs
    set
      status = 'cancelled',
      cancel_requested_at = now(),
      finished_at = now()
    where id = job_record.id
    returning * into job_record;
    outcome := jsonb_build_object(
      'outcome', 'cancelled',
      'renderJobId', job_record.id,
      'status', job_record.status
    );
  elsif job_record.status in (
    'preparing', 'rendering', 'encoding', 'uploading', 'creating_media'
  ) then
    update public.studio_render_jobs
    set cancel_requested_at = coalesce(cancel_requested_at, now())
    where id = job_record.id
    returning * into job_record;
    outcome := jsonb_build_object(
      'outcome', 'cancel_requested',
      'renderJobId', job_record.id,
      'status', job_record.status
    );
  else
    outcome := jsonb_build_object(
      'outcome', 'unchanged',
      'renderJobId', job_record.id,
      'status', job_record.status
    );
  end if;

  return private.complete_studio_command(
    job_record.tenant_id,
    'studio.render.cancel',
    p_idempotency_key,
    request_json,
    'studio_render_jobs',
    job_record.id,
    outcome,
    'studio.render.cancel_requested'
  );
end;
$$;

create or replace function public.claim_studio_render_job_v1(
  p_worker_id text,
  p_lock_timeout_seconds integer default 900,
  p_max_attempts integer default 3
)
returns table (
  job_id uuid,
  tenant_id uuid,
  project_id uuid,
  revision_id uuid,
  output_kind text,
  planned_media_asset_id uuid,
  attempt_count integer,
  document_json jsonb,
  assets_json jsonb,
  width integer,
  height integer,
  duration_ms integer,
  fps integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_worker_id text := nullif(btrim(p_worker_id), '');
begin
  if normalized_worker_id is null
    or length(normalized_worker_id) not between 3 and 120
    or normalized_worker_id !~ '^[a-zA-Z0-9._:-]+$'
  then
    raise exception 'Studio worker id is invalid' using errcode = '22023';
  end if;
  if p_lock_timeout_seconds not between 60 and 3600
    or p_max_attempts not between 1 and 10
  then
    raise exception 'Studio worker limits are invalid' using errcode = '22023';
  end if;

  -- A crashed worker must not resurrect work that a human already cancelled.
  update public.studio_render_jobs job
  set
    status = 'cancelled',
    locked_at = null,
    locked_by = null,
    finished_at = now(),
    error_code = 'render_cancelled',
    error_detail = 'Render geannuleerd na verlopen workerlease.'
  where job.status in (
      'preparing', 'rendering', 'encoding', 'uploading', 'creating_media'
    )
    and job.cancel_requested_at is not null
    and job.locked_at < now() - make_interval(secs => p_lock_timeout_seconds);

  with exhausted as (
    update public.studio_render_jobs job
    set
      status = 'failed',
      locked_at = null,
      locked_by = null,
      finished_at = now(),
      error_code = 'render_attempts_exhausted',
      error_detail = 'Maximaal aantal renderpogingen bereikt.'
    where job.status in (
        'preparing', 'rendering', 'encoding', 'uploading', 'creating_media'
      )
      and job.cancel_requested_at is null
      and job.attempt_count >= least(job.max_attempts, p_max_attempts)
      and job.locked_at < now() - make_interval(secs => p_lock_timeout_seconds)
    returning job.*
  )
  insert into public.audit_events (
    tenant_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    result,
    metadata
  )
  select
    exhausted.tenant_id,
    exhausted.requested_by,
    'studio.render.failed',
    'studio_render_jobs',
    exhausted.id,
    'failed',
    jsonb_build_object(
      'systemExecuted', true,
      'errorCode', exhausted.error_code,
      'attemptCount', exhausted.attempt_count
    )
  from exhausted;

  return query
  with candidate as (
    select render_job.id
    from public.studio_render_jobs render_job
    where render_job.attempt_count < least(render_job.max_attempts, p_max_attempts)
      and render_job.cancel_requested_at is null
      and (
        (
          render_job.status = 'queued'
          and render_job.next_attempt_at <= now()
        )
        or (
          render_job.status in (
            'preparing', 'rendering', 'encoding', 'uploading', 'creating_media'
          )
          and render_job.locked_at <
            now() - make_interval(secs => p_lock_timeout_seconds)
        )
      )
    order by render_job.next_attempt_at, render_job.created_at, render_job.id
    for update of render_job skip locked
    limit 1
  ), claimed as (
    update public.studio_render_jobs render_job
    set
      status = 'preparing',
      attempt_count = render_job.attempt_count + 1,
      progress = greatest(render_job.progress, 1),
      next_attempt_at = now(),
      locked_at = now(),
      locked_by = normalized_worker_id,
      started_at = coalesce(render_job.started_at, now()),
      error_code = null,
      error_detail = null
    from candidate
    where render_job.id = candidate.id
    returning render_job.*
  )
  select
    claimed.id,
    claimed.tenant_id,
    claimed.project_id,
    claimed.revision_id,
    claimed.output_kind,
    claimed.planned_media_asset_id,
    claimed.attempt_count,
    revision.document_json,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'assetId', asset.id,
          'bucket', variant.storage_bucket,
          'path', variant.storage_path,
          'mimeType', variant.mime_type,
          'checksumSha256', variant.checksum_sha256,
          'width', variant.width,
          'height', variant.height,
          'durationSeconds', variant.duration_seconds
        )
        order by asset.id
      )
      from public.studio_revision_assets revision_asset
      join public.media_assets asset
        on asset.tenant_id = revision_asset.tenant_id
        and asset.id = revision_asset.media_asset_id
      join public.media_variants variant
        on variant.tenant_id = asset.tenant_id
        and variant.asset_id = asset.id
        and variant.variant_type = 'original'::public.media_variant_type
      where revision_asset.tenant_id = claimed.tenant_id
        and revision_asset.revision_id = claimed.revision_id
        and asset.kind = 'image'::public.media_asset_kind
        and asset.status = 'ready'::public.media_asset_status
        and asset.deleted_at is null
    ), '[]'::jsonb),
    project.width,
    project.height,
    project.duration_ms,
    project.fps
  from claimed
  join public.studio_revisions revision
    on revision.tenant_id = claimed.tenant_id
    and revision.id = claimed.revision_id
  join public.studio_projects project
    on project.tenant_id = claimed.tenant_id
    and project.id = claimed.project_id;
end;
$$;

create or replace function public.update_studio_render_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_status text,
  p_progress integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_worker_id text := nullif(btrim(p_worker_id), '');
  normalized_status text := lower(btrim(coalesce(p_status, '')));
  job_record public.studio_render_jobs%rowtype;
  transition_allowed boolean;
begin
  if normalized_worker_id is null
    or normalized_worker_id !~ '^[a-zA-Z0-9._:-]{3,120}$'
    or normalized_status not in (
      'preparing', 'rendering', 'encoding', 'uploading', 'creating_media'
    )
    or p_progress not between 0 and 99
  then
    raise exception 'Studio render progress is invalid' using errcode = '22023';
  end if;

  select job.*
  into job_record
  from public.studio_render_jobs job
  where job.id = p_job_id
  for update;

  if not found
    or job_record.status not in (
      'preparing', 'rendering', 'encoding', 'uploading', 'creating_media'
    )
    or job_record.locked_by is distinct from normalized_worker_id
  then
    raise exception 'Studio render lease is not owned by this worker'
      using errcode = '42501';
  end if;

  if job_record.cancel_requested_at is not null then
    update public.studio_render_jobs
    set locked_at = now()
    where id = job_record.id;
    return jsonb_build_object(
      'outcome', 'updated',
      'renderJobId', job_record.id,
      'status', job_record.status,
      'progress', job_record.progress,
      'leaseValid', true,
      'cancelRequested', true
    );
  end if;

  transition_allowed :=
    normalized_status = job_record.status
    or (job_record.status = 'preparing' and normalized_status = 'rendering')
    or (job_record.status = 'rendering' and normalized_status in ('encoding', 'uploading'))
    or (job_record.status = 'encoding' and normalized_status = 'uploading')
    or (job_record.status = 'uploading' and normalized_status = 'creating_media');

  if not transition_allowed or p_progress < job_record.progress then
    raise exception 'Studio render transition is not monotonic'
      using errcode = '23514';
  end if;

  update public.studio_render_jobs
  set
    status = normalized_status,
    progress = p_progress,
    locked_at = now()
  where id = job_record.id
  returning * into job_record;

  return jsonb_build_object(
    'outcome', 'updated',
    'renderJobId', job_record.id,
    'status', job_record.status,
    'progress', job_record.progress,
    'leaseValid', true,
    'cancelRequested', false
  );
end;
$$;

create or replace function public.complete_studio_render_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_storage_path text,
  p_poster_storage_path text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_checksum_sha256 text,
  p_poster_file_size_bytes bigint,
  p_poster_checksum_sha256 text,
  p_width integer,
  p_height integer,
  p_duration_seconds numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_worker_id text := nullif(btrim(p_worker_id), '');
  job_record public.studio_render_jobs%rowtype;
  project_record public.studio_projects%rowtype;
  revision_record public.studio_revisions%rowtype;
  output_object storage.objects%rowtype;
  poster_object storage.objects%rowtype;
  expected_output_path text;
  expected_poster_path text;
  expected_mime_type text;
  expected_duration_seconds numeric;
  output_size_text text;
  output_mime_type text;
  poster_size_text text;
  poster_mime_type text;
  media_kind public.media_asset_kind;
  audit_id uuid;
begin
  if normalized_worker_id is null
    or normalized_worker_id !~ '^[a-zA-Z0-9._:-]{3,120}$'
    or p_checksum_sha256 !~ '^[a-f0-9]{64}$'
    or p_poster_checksum_sha256 !~ '^[a-f0-9]{64}$'
    or p_file_size_bytes <= 0
    or p_poster_file_size_bytes <= 0
  then
    raise exception 'Studio render completion metadata is invalid'
      using errcode = '23514';
  end if;

  select job.*
  into job_record
  from public.studio_render_jobs job
  where job.id = p_job_id
  for update;

  if not found then
    raise exception 'Studio render job not found' using errcode = 'P0002';
  end if;
  if job_record.status = 'completed' and job_record.media_asset_id is not null then
    return jsonb_build_object(
      'outcome', 'completed',
      'renderJobId', job_record.id,
      'mediaAssetId', job_record.media_asset_id,
      'status', job_record.status
    );
  end if;
  if job_record.status <> 'creating_media'
    or job_record.locked_by is distinct from normalized_worker_id
    or job_record.cancel_requested_at is not null
  then
    raise exception 'Studio render completion lease is invalid'
      using errcode = '42501';
  end if;

  select project.*
  into project_record
  from public.studio_projects project
  where project.tenant_id = job_record.tenant_id
    and project.id = job_record.project_id;
  select revision.*
  into revision_record
  from public.studio_revisions revision
  where revision.tenant_id = job_record.tenant_id
    and revision.id = job_record.revision_id;

  expected_mime_type :=
    case when job_record.output_kind = 'png' then 'image/png' else 'video/mp4' end;
  media_kind :=
    case
      when job_record.output_kind = 'png' then 'image'::public.media_asset_kind
      else 'video'::public.media_asset_kind
    end;
  expected_output_path :=
    'tenants/' || job_record.tenant_id::text ||
    '/assets/' || job_record.planned_media_asset_id::text ||
    case
      when job_record.output_kind = 'png'
        then '/original/studio-output.png'
      else '/variants/player-1080p.mp4'
    end;
  expected_poster_path :=
    'tenants/' || job_record.tenant_id::text ||
    '/assets/' || job_record.planned_media_asset_id::text ||
    '/variants/studio-poster.png';
  expected_duration_seconds := project_record.duration_ms::numeric / 1000;

  if p_storage_path is distinct from expected_output_path
    or p_poster_storage_path is distinct from expected_poster_path
    or p_mime_type is distinct from expected_mime_type
    or p_width <> project_record.width
    or p_height <> project_record.height
    or (
      job_record.output_kind = 'png'
      and p_duration_seconds is not null
    )
    or (
      job_record.output_kind = 'mp4'
      and (
        p_duration_seconds is null
        or abs(p_duration_seconds - expected_duration_seconds) > 0.05
      )
    )
  then
    raise exception 'Studio render output does not match immutable revision'
      using errcode = '23514';
  end if;

  select object.*
  into output_object
  from storage.objects object
  where object.bucket_id = 'tenant-media'
    and object.name = expected_output_path;
  select object.*
  into poster_object
  from storage.objects object
  where object.bucket_id = 'tenant-media'
    and object.name = expected_poster_path;
  if output_object.id is null or poster_object.id is null then
    raise exception 'Studio render storage objects were not found'
      using errcode = 'P0002';
  end if;

  output_size_text := output_object.metadata ->> 'size';
  output_mime_type := coalesce(
    output_object.metadata ->> 'mimetype',
    output_object.metadata ->> 'contentType'
  );
  poster_size_text := poster_object.metadata ->> 'size';
  poster_mime_type := coalesce(
    poster_object.metadata ->> 'mimetype',
    poster_object.metadata ->> 'contentType'
  );
  if output_size_text is null or output_size_text !~ '^[0-9]+$'
    or output_size_text::bigint <> p_file_size_bytes
    or output_mime_type is distinct from expected_mime_type
    or poster_size_text is null or poster_size_text !~ '^[0-9]+$'
    or poster_size_text::bigint <> p_poster_file_size_bytes
    or poster_mime_type is distinct from 'image/png'
  then
    raise exception 'Studio render storage metadata does not match completion'
      using errcode = '23514';
  end if;

  insert into public.media_assets (
    id,
    tenant_id,
    created_by,
    kind,
    title,
    original_file_name,
    mime_type,
    status,
    storage_bucket,
    storage_path,
    file_size_bytes,
    checksum_sha256,
    width,
    height,
    duration_seconds,
    processed_at
  )
  values (
    job_record.planned_media_asset_id,
    job_record.tenant_id,
    job_record.requested_by,
    media_kind,
    project_record.name,
    'studio-' || project_record.id::text || '.' || job_record.output_kind,
    expected_mime_type,
    'ready'::public.media_asset_status,
    'tenant-media',
    expected_output_path,
    p_file_size_bytes,
    p_checksum_sha256,
    p_width,
    p_height,
    p_duration_seconds,
    now()
  );

  insert into public.media_variants (
    tenant_id,
    asset_id,
    variant_type,
    storage_bucket,
    storage_path,
    mime_type,
    file_size_bytes,
    checksum_sha256,
    width,
    height,
    duration_seconds
  )
  values (
    job_record.tenant_id,
    job_record.planned_media_asset_id,
    'original'::public.media_variant_type,
    'tenant-media',
    expected_output_path,
    expected_mime_type,
    p_file_size_bytes,
    p_checksum_sha256,
    p_width,
    p_height,
    p_duration_seconds
  );

  if job_record.output_kind = 'mp4' then
    insert into public.media_variants (
      tenant_id,
      asset_id,
      variant_type,
      storage_bucket,
      storage_path,
      mime_type,
      file_size_bytes,
      checksum_sha256,
      width,
      height,
      duration_seconds
    )
    values (
      job_record.tenant_id,
      job_record.planned_media_asset_id,
      'player_1080p'::public.media_variant_type,
      'tenant-media',
      expected_output_path,
      expected_mime_type,
      p_file_size_bytes,
      p_checksum_sha256,
      p_width,
      p_height,
      p_duration_seconds
    );
  end if;

  insert into public.media_variants (
    tenant_id,
    asset_id,
    variant_type,
    storage_bucket,
    storage_path,
    mime_type,
    file_size_bytes,
    checksum_sha256,
    width,
    height,
    duration_seconds
  )
  values (
    job_record.tenant_id,
    job_record.planned_media_asset_id,
    'thumbnail'::public.media_variant_type,
    'tenant-media',
    expected_poster_path,
    'image/png',
    p_poster_file_size_bytes,
    p_poster_checksum_sha256,
    p_width,
    p_height,
    null
  );

  insert into public.studio_exports (
    tenant_id,
    project_id,
    revision_id,
    render_job_id,
    media_asset_id,
    output_kind,
    width,
    height,
    duration_seconds,
    checksum_sha256
  )
  values (
    job_record.tenant_id,
    job_record.project_id,
    job_record.revision_id,
    job_record.id,
    job_record.planned_media_asset_id,
    job_record.output_kind,
    p_width,
    p_height,
    p_duration_seconds,
    p_checksum_sha256
  );

  update public.studio_render_jobs
  set
    status = 'completed',
    progress = 100,
    locked_at = null,
    locked_by = null,
    finished_at = now(),
    media_asset_id = planned_media_asset_id,
    error_code = null,
    error_detail = null
  where id = job_record.id
  returning * into job_record;

  insert into public.audit_events (
    tenant_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    result,
    metadata
  )
  values (
    job_record.tenant_id,
    job_record.requested_by,
    'studio.render.completed',
    'studio_render_jobs',
    job_record.id,
    'success',
    jsonb_build_object(
      'systemExecuted', true,
      'outputKind', job_record.output_kind,
      'mediaAssetId', job_record.media_asset_id,
      'revisionId', revision_record.id
    )
  )
  returning id into audit_id;

  return jsonb_build_object(
    'outcome', 'completed',
    'renderJobId', job_record.id,
    'mediaAssetId', job_record.media_asset_id,
    'status', job_record.status
  );
end;
$$;

create or replace function public.fail_studio_render_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_error_code text,
  p_error_detail text,
  p_retryable boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_worker_id text := nullif(btrim(p_worker_id), '');
  normalized_error_code text := lower(nullif(btrim(p_error_code), ''));
  normalized_error_detail text := nullif(substring(
    regexp_replace(coalesce(p_error_detail, ''), '[[:cntrl:]]', ' ', 'g')
    from 1 for 500
  ), '');
  job_record public.studio_render_jobs%rowtype;
  next_status text;
  backoff_seconds integer;
begin
  if normalized_worker_id is null
    or normalized_worker_id !~ '^[a-zA-Z0-9._:-]{3,120}$'
    or normalized_error_code is null
    or normalized_error_code !~ '^[a-z0-9_]{3,80}$'
  then
    raise exception 'Studio render failure metadata is invalid'
      using errcode = '22023';
  end if;

  select job.*
  into job_record
  from public.studio_render_jobs job
  where job.id = p_job_id
  for update;
  if not found
    or job_record.status not in (
      'preparing', 'rendering', 'encoding', 'uploading', 'creating_media'
    )
    or job_record.locked_by is distinct from normalized_worker_id
  then
    raise exception 'Studio render failure lease is invalid'
      using errcode = '42501';
  end if;

  next_status := case
    when normalized_error_code = 'render_cancelled'
      or job_record.cancel_requested_at is not null
      then 'cancelled'
    when coalesce(p_retryable, false)
      and job_record.attempt_count < job_record.max_attempts
      then 'queued'
    else 'failed'
  end;
  backoff_seconds := least(
    300,
    (5 * power(2, greatest(job_record.attempt_count - 1, 0)))::integer
  );

  update public.studio_render_jobs
  set
    status = next_status,
    locked_at = null,
    locked_by = null,
    next_attempt_at = case
      when next_status = 'queued'
        then now() + make_interval(secs => backoff_seconds)
      else next_attempt_at
    end,
    finished_at = case
      when next_status in ('failed', 'cancelled') then now()
      else null
    end,
    error_code = case
      when next_status = 'cancelled' then 'render_cancelled'
      else normalized_error_code
    end,
    error_detail = normalized_error_detail
  where id = job_record.id
  returning * into job_record;

  insert into public.audit_events (
    tenant_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    result,
    metadata
  )
  values (
    job_record.tenant_id,
    job_record.requested_by,
    case
      when job_record.status = 'queued' then 'studio.render.retry_scheduled'
      when job_record.status = 'cancelled' then 'studio.render.cancelled'
      else 'studio.render.failed'
    end,
    'studio_render_jobs',
    job_record.id,
    case when job_record.status = 'cancelled' then 'success' else 'failed' end,
    jsonb_build_object(
      'systemExecuted', true,
      'errorCode', job_record.error_code,
      'attemptCount', job_record.attempt_count,
      'nextAttemptAt', case
        when job_record.status = 'queued' then job_record.next_attempt_at
        else null
      end
    )
  );

  return jsonb_build_object(
    'outcome', job_record.status,
    'renderJobId', job_record.id,
    'status', job_record.status,
    'nextAttemptAt', case
      when job_record.status = 'queued' then job_record.next_attempt_at
      else null
    end
  );
end;
$$;

revoke all on function private.reject_studio_immutable_mutation()
  from public, anon, authenticated;
revoke all on function private.studio_document_hash(jsonb)
  from public, anon, authenticated;
revoke all on function private.normalize_studio_asset_ids(uuid[])
  from public, anon, authenticated;
revoke all on function private.assert_studio_document(
  uuid, text, integer, integer, jsonb, uuid[]
) from public, anon, authenticated;
revoke all on function private.begin_studio_command(uuid, text, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function private.complete_studio_command(
  uuid, text, uuid, jsonb, text, uuid, jsonb, text, text
) from public, anon, authenticated;

revoke all on function public.create_studio_project_v1(
  uuid, text, text, jsonb, uuid[], text, uuid
) from public, anon;
revoke all on function public.save_studio_draft_v1(
  uuid, bigint, jsonb, uuid[], uuid
) from public, anon;
revoke all on function public.mutate_studio_project_v1(
  uuid, bigint, text, jsonb, uuid
) from public, anon;
revoke all on function public.request_studio_render_v1(
  uuid, bigint, text, uuid
) from public, anon;
revoke all on function public.retry_studio_render_v1(uuid, uuid)
  from public, anon;
revoke all on function public.cancel_studio_render_v1(uuid, uuid)
  from public, anon;

grant execute on function public.create_studio_project_v1(
  uuid, text, text, jsonb, uuid[], text, uuid
) to authenticated;
grant execute on function public.save_studio_draft_v1(
  uuid, bigint, jsonb, uuid[], uuid
) to authenticated;
grant execute on function public.mutate_studio_project_v1(
  uuid, bigint, text, jsonb, uuid
) to authenticated;
grant execute on function public.request_studio_render_v1(
  uuid, bigint, text, uuid
) to authenticated;
grant execute on function public.retry_studio_render_v1(uuid, uuid)
  to authenticated;
grant execute on function public.cancel_studio_render_v1(uuid, uuid)
  to authenticated;

revoke all on function public.claim_studio_render_job_v1(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.update_studio_render_job_v1(
  uuid, text, text, integer
) from public, anon, authenticated;
revoke all on function public.complete_studio_render_job_v1(
  uuid, text, text, text, text, bigint, text, bigint, text,
  integer, integer, numeric
) from public, anon, authenticated;
revoke all on function public.fail_studio_render_job_v1(
  uuid, text, text, text, boolean
) from public, anon, authenticated;

grant execute on function public.claim_studio_render_job_v1(
  text, integer, integer
) to service_role;
grant execute on function public.update_studio_render_job_v1(
  uuid, text, text, integer
) to service_role;
grant execute on function public.complete_studio_render_job_v1(
  uuid, text, text, text, text, bigint, text, bigint, text,
  integer, integer, numeric
) to service_role;
grant execute on function public.fail_studio_render_job_v1(
  uuid, text, text, text, boolean
) to service_role;
