do $$
begin
  create type public.media_asset_kind as enum (
    'image',
    'video'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.media_asset_status as enum (
    'uploading',
    'processing',
    'ready',
    'validation_failed',
    'deleted'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.media_upload_session_status as enum (
    'pending',
    'uploaded',
    'expired',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.media_variant_type as enum (
    'original',
    'thumbnail',
    'player_1080p'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.media_processing_job_status as enum (
    'queued',
    'processing',
    'completed',
    'failed'
  );
exception
  when duplicate_object then null;
end $$;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'tenant-media',
  'tenant-media',
  false,
  524288000,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.storage_object_tenant_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if object_name is null
    or object_name !~* '^tenants/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/assets/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'
  then
    return null;
  end if;

  return split_part(object_name, '/', 2)::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function private.storage_object_asset_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if object_name is null
    or object_name !~* '^tenants/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/assets/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'
  then
    return null;
  end if;

  return split_part(object_name, '/', 4)::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  kind public.media_asset_kind not null,
  title text not null check (length(btrim(title)) >= 2),
  original_file_name text not null check (length(btrim(original_file_name)) > 0),
  mime_type text not null,
  status public.media_asset_status not null default 'uploading',
  storage_bucket text not null default 'tenant-media' check (storage_bucket = 'tenant-media'),
  storage_path text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 524288000),
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$'),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_seconds numeric(10, 3) check (
    duration_seconds is null
    or (duration_seconds > 0 and duration_seconds <= 300)
  ),
  validation_error text,
  processed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  check (
    storage_path like ('tenants/' || tenant_id::text || '/assets/' || id::text || '/%')
  ),
  check (
    (
      kind = 'image'::public.media_asset_kind
      and mime_type in ('image/jpeg', 'image/png', 'image/webp')
    )
    or (
      kind = 'video'::public.media_asset_kind
      and mime_type = 'video/mp4'
    )
  )
);

create index media_assets_tenant_id_status_idx on public.media_assets(tenant_id, status);
create index media_assets_tenant_id_created_at_idx on public.media_assets(tenant_id, created_at desc);

create table public.media_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  asset_id uuid not null,
  created_by uuid references public.profiles(id) on delete set null,
  status public.media_upload_session_status not null default 'pending',
  storage_bucket text not null default 'tenant-media' check (storage_bucket = 'tenant-media'),
  storage_path text not null,
  expected_mime_type text not null,
  expected_size_bytes bigint not null check (
    expected_size_bytes > 0
    and expected_size_bytes <= 524288000
  ),
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, asset_id)
    references public.media_assets(tenant_id, id)
    on delete cascade,
  check (
    storage_path like ('tenants/' || tenant_id::text || '/assets/' || asset_id::text || '/%')
  ),
  check (expires_at > created_at)
);

create index media_upload_sessions_tenant_asset_idx on public.media_upload_sessions(tenant_id, asset_id);
create index media_upload_sessions_status_expires_at_idx on public.media_upload_sessions(status, expires_at);

create table public.media_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  asset_id uuid not null,
  variant_type public.media_variant_type not null,
  storage_bucket text not null default 'tenant-media' check (storage_bucket = 'tenant-media'),
  storage_path text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_seconds numeric(10, 3) check (
    duration_seconds is null
    or (duration_seconds > 0 and duration_seconds <= 300)
  ),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, asset_id)
    references public.media_assets(tenant_id, id)
    on delete cascade,
  unique (tenant_id, asset_id, variant_type),
  check (
    storage_path like ('tenants/' || tenant_id::text || '/assets/' || asset_id::text || '/%')
  )
);

create index media_variants_tenant_id_idx on public.media_variants(tenant_id);

create table public.media_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  asset_id uuid not null,
  status public.media_processing_job_status not null default 'queued',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  requested_by uuid references public.profiles(id) on delete set null,
  locked_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, asset_id)
    references public.media_assets(tenant_id, id)
    on delete cascade
);

create index media_processing_jobs_status_created_at_idx on public.media_processing_jobs(status, created_at);
create index media_processing_jobs_tenant_asset_idx on public.media_processing_jobs(tenant_id, asset_id);

create trigger media_assets_set_updated_at
before update on public.media_assets
for each row execute function private.set_updated_at();

create trigger media_upload_sessions_set_updated_at
before update on public.media_upload_sessions
for each row execute function private.set_updated_at();

create trigger media_processing_jobs_set_updated_at
before update on public.media_processing_jobs
for each row execute function private.set_updated_at();

alter table public.media_assets enable row level security;
alter table public.media_upload_sessions enable row level security;
alter table public.media_variants enable row level security;
alter table public.media_processing_jobs enable row level security;

grant select on
  public.media_assets,
  public.media_upload_sessions,
  public.media_variants,
  public.media_processing_jobs
to anon, authenticated;

grant insert, update, delete on
  public.media_assets,
  public.media_upload_sessions,
  public.media_processing_jobs
to authenticated;

grant select on storage.buckets to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;

grant execute on function private.storage_object_tenant_id(text) to authenticated, service_role;
grant execute on function private.storage_object_asset_id(text) to authenticated, service_role;

create policy "media_assets_select_by_scope"
on public.media_assets
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

create policy "media_assets_insert_by_writer"
on public.media_assets
for insert
to authenticated
with check (
  (
    private.has_tenant_role(tenant_id, array[
      'tenant_owner',
      'tenant_admin',
      'tenant_editor'
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

create policy "media_assets_update_by_writer"
on public.media_assets
for update
to authenticated
using (
  private.has_tenant_role(tenant_id, array[
    'tenant_owner',
    'tenant_admin',
    'tenant_editor'
  ]::public.tenant_role[])
  or private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[])
)
with check (
  private.has_tenant_role(tenant_id, array[
    'tenant_owner',
    'tenant_admin',
    'tenant_editor'
  ]::public.tenant_role[])
  or private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[])
);

create policy "media_assets_delete_by_admin"
on public.media_assets
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

create policy "media_upload_sessions_select_by_scope"
on public.media_upload_sessions
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

create policy "media_upload_sessions_insert_by_writer"
on public.media_upload_sessions
for insert
to authenticated
with check (
  (
    private.has_tenant_role(tenant_id, array[
      'tenant_owner',
      'tenant_admin',
      'tenant_editor'
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

create policy "media_upload_sessions_update_by_writer"
on public.media_upload_sessions
for update
to authenticated
using (
  private.has_tenant_role(tenant_id, array[
    'tenant_owner',
    'tenant_admin',
    'tenant_editor'
  ]::public.tenant_role[])
  or private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[])
)
with check (
  private.has_tenant_role(tenant_id, array[
    'tenant_owner',
    'tenant_admin',
    'tenant_editor'
  ]::public.tenant_role[])
  or private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[])
);

create policy "media_upload_sessions_delete_by_admin"
on public.media_upload_sessions
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

create policy "media_variants_select_by_scope"
on public.media_variants
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

create policy "media_processing_jobs_select_by_scope"
on public.media_processing_jobs
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

create policy "media_processing_jobs_insert_by_writer"
on public.media_processing_jobs
for insert
to authenticated
with check (
  (
    private.has_tenant_role(tenant_id, array[
      'tenant_owner',
      'tenant_admin',
      'tenant_editor'
    ]::public.tenant_role[])
    or private.is_platform_member(array[
      'platform_owner',
      'platform_admin'
    ]::public.platform_role[])
  )
  and (
    requested_by is null
    or requested_by = private.current_user_id()
  )
);

create policy "tenant_media_storage_select_by_scope"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'tenant-media'
  and (
    private.is_tenant_member(private.storage_object_tenant_id(name))
    or private.is_platform_member(array[
      'platform_owner',
      'platform_admin',
      'platform_support'
    ]::public.platform_role[])
  )
);

create policy "tenant_media_storage_insert_by_writer"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'tenant-media'
  and exists (
    select 1
    from public.media_assets asset
    where asset.tenant_id = private.storage_object_tenant_id(name)
      and asset.id = private.storage_object_asset_id(name)
      and (
        private.has_tenant_role(asset.tenant_id, array[
          'tenant_owner',
          'tenant_admin',
          'tenant_editor'
        ]::public.tenant_role[])
        or private.is_platform_member(array[
          'platform_owner',
          'platform_admin'
        ]::public.platform_role[])
      )
  )
);

create policy "tenant_media_storage_update_by_writer"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'tenant-media'
  and exists (
    select 1
    from public.media_assets asset
    where asset.tenant_id = private.storage_object_tenant_id(name)
      and asset.id = private.storage_object_asset_id(name)
      and (
        private.has_tenant_role(asset.tenant_id, array[
          'tenant_owner',
          'tenant_admin',
          'tenant_editor'
        ]::public.tenant_role[])
        or private.is_platform_member(array[
          'platform_owner',
          'platform_admin'
        ]::public.platform_role[])
      )
  )
)
with check (
  bucket_id = 'tenant-media'
  and exists (
    select 1
    from public.media_assets asset
    where asset.tenant_id = private.storage_object_tenant_id(name)
      and asset.id = private.storage_object_asset_id(name)
      and (
        private.has_tenant_role(asset.tenant_id, array[
          'tenant_owner',
          'tenant_admin',
          'tenant_editor'
        ]::public.tenant_role[])
        or private.is_platform_member(array[
          'platform_owner',
          'platform_admin'
        ]::public.platform_role[])
      )
  )
);

create policy "tenant_media_storage_delete_by_admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'tenant-media'
  and exists (
    select 1
    from public.media_assets asset
    where asset.tenant_id = private.storage_object_tenant_id(name)
      and asset.id = private.storage_object_asset_id(name)
      and (
        private.has_tenant_role(asset.tenant_id, array[
          'tenant_owner',
          'tenant_admin'
        ]::public.tenant_role[])
        or private.is_platform_member(array[
          'platform_owner',
          'platform_admin'
        ]::public.platform_role[])
      )
  )
);
