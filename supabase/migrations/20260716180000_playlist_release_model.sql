create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type public.playlist_status as enum (
    'draft',
    'published',
    'archived'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.media_variants
  add constraint media_variants_tenant_id_id_uq unique (tenant_id, id);

create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(btrim(name)) >= 2),
  description text,
  status public.playlist_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  check (
    status <> 'archived'::public.playlist_status
    or archived_at is not null
  )
);

create index playlists_tenant_id_status_idx on public.playlists(tenant_id, status);
create index playlists_tenant_id_created_at_idx on public.playlists(tenant_id, created_at desc);

create table public.playlist_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  playlist_id uuid not null,
  media_asset_id uuid not null,
  sort_order integer not null check (sort_order >= 0),
  duration_seconds integer not null default 10 check (
    duration_seconds >= 5
    and duration_seconds <= 3600
  ),
  fit_mode text not null default 'contain' check (fit_mode in ('contain', 'cover')),
  muted boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, playlist_id)
    references public.playlists(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, media_asset_id)
    references public.media_assets(tenant_id, id)
    on delete restrict,
  unique (tenant_id, playlist_id, sort_order)
);

create index playlist_items_tenant_playlist_idx on public.playlist_items(tenant_id, playlist_id, sort_order);
create index playlist_items_tenant_asset_idx on public.playlist_items(tenant_id, media_asset_id);

create table public.playlist_releases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  playlist_id uuid not null,
  version integer not null check (version > 0),
  release_notes text,
  manifest_hash text not null check (manifest_hash ~ '^[a-f0-9]{64}$'),
  manifest_json jsonb not null check (jsonb_typeof(manifest_json) = 'object'),
  item_count integer not null check (item_count > 0),
  total_duration_seconds integer not null check (total_duration_seconds > 0),
  total_bytes bigint not null check (total_bytes >= 0),
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default now(),
  foreign key (tenant_id, playlist_id)
    references public.playlists(tenant_id, id)
    on delete restrict,
  unique (tenant_id, id),
  unique (tenant_id, playlist_id, version)
);

create index playlist_releases_tenant_playlist_idx on public.playlist_releases(tenant_id, playlist_id, version desc);
create index playlist_releases_tenant_published_at_idx on public.playlist_releases(tenant_id, published_at desc);

create table public.playlist_release_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  playlist_id uuid not null,
  release_id uuid not null,
  source_item_id uuid,
  media_asset_id uuid not null,
  media_variant_id uuid not null,
  sort_order integer not null check (sort_order >= 0),
  duration_seconds integer not null check (
    duration_seconds >= 5
    and duration_seconds <= 3600
  ),
  fit_mode text not null check (fit_mode in ('contain', 'cover')),
  muted boolean not null,
  asset_kind public.media_asset_kind not null,
  asset_title text not null,
  storage_bucket text not null default 'tenant-media' check (storage_bucket = 'tenant-media'),
  storage_path text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  asset_duration_seconds numeric(10, 3) check (
    asset_duration_seconds is null
    or (asset_duration_seconds > 0 and asset_duration_seconds <= 300)
  ),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, playlist_id)
    references public.playlists(tenant_id, id)
    on delete restrict,
  foreign key (tenant_id, release_id)
    references public.playlist_releases(tenant_id, id)
    on delete restrict,
  foreign key (tenant_id, media_asset_id)
    references public.media_assets(tenant_id, id)
    on delete restrict,
  foreign key (tenant_id, media_variant_id)
    references public.media_variants(tenant_id, id)
    on delete restrict,
  unique (tenant_id, release_id, sort_order),
  check (
    storage_path like ('tenants/' || tenant_id::text || '/assets/' || media_asset_id::text || '/%')
  )
);

create index playlist_release_items_tenant_release_idx on public.playlist_release_items(tenant_id, release_id, sort_order);
create index playlist_release_items_tenant_asset_idx on public.playlist_release_items(tenant_id, media_asset_id);

create trigger playlists_set_updated_at
before update on public.playlists
for each row execute function private.set_updated_at();

create trigger playlist_items_set_updated_at
before update on public.playlist_items
for each row execute function private.set_updated_at();

create or replace function private.reject_playlist_release_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'playlist releases are immutable' using errcode = '23514';
end;
$$;

create trigger playlist_releases_reject_update
before update on public.playlist_releases
for each row execute function private.reject_playlist_release_mutation();

create trigger playlist_releases_reject_delete
before delete on public.playlist_releases
for each row execute function private.reject_playlist_release_mutation();

create trigger playlist_release_items_reject_update
before update on public.playlist_release_items
for each row execute function private.reject_playlist_release_mutation();

create trigger playlist_release_items_reject_delete
before delete on public.playlist_release_items
for each row execute function private.reject_playlist_release_mutation();

create or replace function public.review_playlist_publish(p_playlist_id uuid)
returns table (
  playlist_id uuid,
  tenant_id uuid,
  item_count integer,
  publishable_item_count integer,
  invalid_item_count integer,
  total_duration_seconds integer,
  total_bytes bigint,
  can_publish boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  playlist_record public.playlists%rowtype;
begin
  select playlist.*
  into playlist_record
  from public.playlists playlist
  where playlist.id = p_playlist_id;

  if not found then
    return;
  end if;

  if not (
    private.is_tenant_member(playlist_record.tenant_id)
    or private.is_platform_member(array[
      'platform_owner',
      'platform_admin',
      'platform_support'
    ]::public.platform_role[])
  ) then
    raise exception 'actor cannot review this playlist' using errcode = '42501';
  end if;

  return query
  with draft_items as (
    select item.*
    from public.playlist_items item
    where item.tenant_id = playlist_record.tenant_id
      and item.playlist_id = playlist_record.id
  ),
  publishable_items as (
    select
      item.id,
      item.duration_seconds,
      variant.file_size_bytes
    from draft_items item
    join public.media_assets asset
      on asset.tenant_id = item.tenant_id
      and asset.id = item.media_asset_id
      and asset.status = 'ready'::public.media_asset_status
      and asset.deleted_at is null
    join public.media_variants variant
      on variant.tenant_id = item.tenant_id
      and variant.asset_id = item.media_asset_id
      and variant.variant_type = case
        when asset.kind = 'video'::public.media_asset_kind
          then 'player_1080p'::public.media_variant_type
        else 'original'::public.media_variant_type
      end
  )
  select
    playlist_record.id,
    playlist_record.tenant_id,
    count(draft_items.id)::integer,
    count(publishable_items.id)::integer,
    (count(draft_items.id) - count(publishable_items.id))::integer,
    coalesce(sum(publishable_items.duration_seconds), 0)::integer,
    coalesce(sum(publishable_items.file_size_bytes), 0)::bigint,
    (
      playlist_record.status <> 'archived'::public.playlist_status
      and count(draft_items.id) > 0
      and count(draft_items.id) = count(publishable_items.id)
    )
  from draft_items
  left join publishable_items on publishable_items.id = draft_items.id;
end;
$$;

create or replace function public.publish_playlist(
  p_playlist_id uuid,
  p_release_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  playlist_record public.playlists%rowtype;
  draft_item_count integer;
  publishable_item_count integer;
  next_version integer;
  release_id uuid;
  release_published_at timestamptz := now();
  manifest_items jsonb;
  manifest_document jsonb;
  manifest_hash text;
  total_duration integer;
  total_bytes bigint;
begin
  if actor_id is null then
    raise exception 'publish_playlist requires an authenticated user' using errcode = '42501';
  end if;

  select playlist.*
  into playlist_record
  from public.playlists playlist
  where playlist.id = p_playlist_id
  for update;

  if not found then
    raise exception 'playlist not found' using errcode = 'P0002';
  end if;

  if playlist_record.status = 'archived'::public.playlist_status then
    raise exception 'archived playlists cannot be published' using errcode = '23514';
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

  select count(*)::integer
  into draft_item_count
  from public.playlist_items item
  where item.tenant_id = playlist_record.tenant_id
    and item.playlist_id = playlist_record.id;

  if draft_item_count = 0 then
    raise exception 'playlist has no items to publish' using errcode = '23514';
  end if;

  select
    count(*)::integer,
    coalesce(sum(item.duration_seconds), 0)::integer,
    coalesce(sum(variant.file_size_bytes), 0)::bigint,
    jsonb_agg(
      jsonb_build_object(
        'itemId', item.id,
        'mediaAssetId', asset.id,
        'mediaVariantId', variant.id,
        'kind', asset.kind,
        'title', asset.title,
        'durationSeconds', item.duration_seconds,
        'fitMode', item.fit_mode,
        'muted', item.muted,
        'storage', jsonb_build_object(
          'bucket', variant.storage_bucket,
          'path', variant.storage_path,
          'mimeType', variant.mime_type,
          'bytes', variant.file_size_bytes,
          'checksumSha256', variant.checksum_sha256
        ),
        'metadata', jsonb_build_object(
          'width', variant.width,
          'height', variant.height,
          'durationSeconds', variant.duration_seconds
        )
      )
      order by item.sort_order
    )
  into
    publishable_item_count,
    total_duration,
    total_bytes,
    manifest_items
  from public.playlist_items item
  join public.media_assets asset
    on asset.tenant_id = item.tenant_id
    and asset.id = item.media_asset_id
    and asset.status = 'ready'::public.media_asset_status
    and asset.deleted_at is null
  join public.media_variants variant
    on variant.tenant_id = item.tenant_id
    and variant.asset_id = item.media_asset_id
    and variant.variant_type = case
      when asset.kind = 'video'::public.media_asset_kind
        then 'player_1080p'::public.media_variant_type
      else 'original'::public.media_variant_type
    end
  where item.tenant_id = playlist_record.tenant_id
    and item.playlist_id = playlist_record.id;

  if publishable_item_count <> draft_item_count then
    raise exception 'playlist contains items without ready player variants' using errcode = '23514';
  end if;

  select coalesce(max(release.version), 0) + 1
  into next_version
  from public.playlist_releases release
  where release.tenant_id = playlist_record.tenant_id
    and release.playlist_id = playlist_record.id;

  manifest_document := jsonb_build_object(
    'schemaVersion', 1,
    'playlistId', playlist_record.id,
    'tenantId', playlist_record.tenant_id,
    'version', next_version,
    'publishedAt', release_published_at,
    'totalDurationSeconds', total_duration,
    'totalBytes', total_bytes,
    'items', manifest_items
  );

  manifest_hash := encode(
    extensions.digest(pg_catalog.convert_to(manifest_document::text, 'UTF8'), 'sha256'),
    'hex'
  );

  insert into public.playlist_releases (
    tenant_id,
    playlist_id,
    version,
    release_notes,
    manifest_hash,
    manifest_json,
    item_count,
    total_duration_seconds,
    total_bytes,
    published_by,
    published_at
  )
  values (
    playlist_record.tenant_id,
    playlist_record.id,
    next_version,
    nullif(btrim(p_release_notes), ''),
    manifest_hash,
    manifest_document,
    publishable_item_count,
    total_duration,
    total_bytes,
    actor_id,
    release_published_at
  )
  returning id into release_id;

  insert into public.playlist_release_items (
    tenant_id,
    playlist_id,
    release_id,
    source_item_id,
    media_asset_id,
    media_variant_id,
    sort_order,
    duration_seconds,
    fit_mode,
    muted,
    asset_kind,
    asset_title,
    storage_bucket,
    storage_path,
    mime_type,
    file_size_bytes,
    checksum_sha256,
    width,
    height,
    asset_duration_seconds
  )
  select
    playlist_record.tenant_id,
    playlist_record.id,
    release_id,
    item.id,
    asset.id,
    variant.id,
    item.sort_order,
    item.duration_seconds,
    item.fit_mode,
    item.muted,
    asset.kind,
    asset.title,
    variant.storage_bucket,
    variant.storage_path,
    variant.mime_type,
    variant.file_size_bytes,
    variant.checksum_sha256,
    variant.width,
    variant.height,
    variant.duration_seconds
  from public.playlist_items item
  join public.media_assets asset
    on asset.tenant_id = item.tenant_id
    and asset.id = item.media_asset_id
    and asset.status = 'ready'::public.media_asset_status
    and asset.deleted_at is null
  join public.media_variants variant
    on variant.tenant_id = item.tenant_id
    and variant.asset_id = item.media_asset_id
    and variant.variant_type = case
      when asset.kind = 'video'::public.media_asset_kind
        then 'player_1080p'::public.media_variant_type
      else 'original'::public.media_variant_type
    end
  where item.tenant_id = playlist_record.tenant_id
    and item.playlist_id = playlist_record.id
  order by item.sort_order;

  update public.playlists
  set status = 'published'::public.playlist_status
  where id = playlist_record.id;

  perform private.audit_event(
    playlist_record.tenant_id,
    'playlist.release.published',
    'playlist_releases',
    release_id,
    'success',
    jsonb_build_object(
      'playlistId', playlist_record.id,
      'version', next_version,
      'itemCount', publishable_item_count,
      'manifestHash', manifest_hash
    )
  );

  return release_id;
end;
$$;

alter table public.playlists enable row level security;
alter table public.playlist_items enable row level security;
alter table public.playlist_releases enable row level security;
alter table public.playlist_release_items enable row level security;

grant select on
  public.playlists,
  public.playlist_items,
  public.playlist_releases,
  public.playlist_release_items
to anon, authenticated;

grant insert, update, delete on
  public.playlists,
  public.playlist_items
to authenticated;

revoke all on function public.review_playlist_publish(uuid) from public, anon;
revoke all on function public.publish_playlist(uuid, text) from public, anon;
grant execute on function public.review_playlist_publish(uuid) to authenticated;
grant execute on function public.publish_playlist(uuid, text) to authenticated;

create policy "playlists_select_by_scope"
on public.playlists
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

create policy "playlists_insert_by_writer"
on public.playlists
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

create policy "playlists_update_by_writer"
on public.playlists
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

create policy "playlists_delete_draft_by_admin"
on public.playlists
for delete
to authenticated
using (
  status = 'draft'::public.playlist_status
  and (
    private.has_tenant_role(tenant_id, array[
      'tenant_owner',
      'tenant_admin'
    ]::public.tenant_role[])
    or private.is_platform_member(array[
      'platform_owner',
      'platform_admin'
    ]::public.platform_role[])
  )
);

create policy "playlist_items_select_by_scope"
on public.playlist_items
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

create policy "playlist_items_insert_by_writer"
on public.playlist_items
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
  and exists (
    select 1
    from public.playlists playlist
    where playlist.tenant_id = playlist_items.tenant_id
      and playlist.id = playlist_items.playlist_id
      and playlist.status <> 'archived'::public.playlist_status
  )
  and exists (
    select 1
    from public.media_assets asset
    where asset.tenant_id = playlist_items.tenant_id
      and asset.id = playlist_items.media_asset_id
      and asset.status = 'ready'::public.media_asset_status
      and asset.deleted_at is null
  )
);

create policy "playlist_items_update_by_writer"
on public.playlist_items
for update
to authenticated
using (
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
  and exists (
    select 1
    from public.playlists playlist
    where playlist.tenant_id = playlist_items.tenant_id
      and playlist.id = playlist_items.playlist_id
      and playlist.status <> 'archived'::public.playlist_status
  )
)
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
  and exists (
    select 1
    from public.playlists playlist
    where playlist.tenant_id = playlist_items.tenant_id
      and playlist.id = playlist_items.playlist_id
      and playlist.status <> 'archived'::public.playlist_status
  )
  and exists (
    select 1
    from public.media_assets asset
    where asset.tenant_id = playlist_items.tenant_id
      and asset.id = playlist_items.media_asset_id
      and asset.status = 'ready'::public.media_asset_status
      and asset.deleted_at is null
  )
);

create policy "playlist_items_delete_by_writer"
on public.playlist_items
for delete
to authenticated
using (
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
  and exists (
    select 1
    from public.playlists playlist
    where playlist.tenant_id = playlist_items.tenant_id
      and playlist.id = playlist_items.playlist_id
      and playlist.status <> 'archived'::public.playlist_status
  )
);

create policy "playlist_releases_select_by_scope"
on public.playlist_releases
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

create policy "playlist_release_items_select_by_scope"
on public.playlist_release_items
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
