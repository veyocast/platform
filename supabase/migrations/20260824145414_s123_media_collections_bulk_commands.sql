-- Vector v2 Media additions. Collections are curated memberships and do not
-- move or duplicate the underlying tenant media object.

create table public.media_collections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 80),
  description text check (description is null or length(btrim(description)) between 1 and 240),
  status text not null default 'active' check (status in ('active', 'archived')),
  revision bigint not null default 0 check (revision >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (tenant_id, id),
  check (
    (status = 'active' and archived_at is null)
    or (status = 'archived' and archived_at is not null)
  )
);

create unique index media_collections_tenant_active_name_uq
  on public.media_collections (tenant_id, lower(name))
  where status = 'active';
create index media_collections_tenant_status_updated_idx
  on public.media_collections (tenant_id, status, updated_at desc);

create table public.media_collection_items (
  tenant_id uuid not null,
  collection_id uuid not null,
  media_asset_id uuid not null,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, collection_id, media_asset_id),
  foreign key (tenant_id, collection_id)
    references public.media_collections(tenant_id, id) on delete cascade,
  foreign key (tenant_id, media_asset_id)
    references public.media_assets(tenant_id, id) on delete cascade
);

create index media_collection_items_tenant_asset_idx
  on public.media_collection_items (tenant_id, media_asset_id, collection_id);

create trigger media_collections_set_updated_at
before update on public.media_collections
for each row execute function private.set_updated_at();
create trigger media_collections_require_active_tenant
before insert or update or delete on public.media_collections
for each row execute function private.require_active_tenant_mutation('tenant_id');
create trigger media_collection_items_require_active_tenant
before insert or update or delete on public.media_collection_items
for each row execute function private.require_active_tenant_mutation('tenant_id');

alter table public.media_collections enable row level security;
alter table public.media_collections force row level security;
alter table public.media_collection_items enable row level security;
alter table public.media_collection_items force row level security;

revoke all on table public.media_collections from public, anon, authenticated;
revoke all on table public.media_collection_items from public, anon, authenticated;
grant select, insert, update, delete on table public.media_collections to authenticated;
grant select, insert, delete on table public.media_collection_items to authenticated;
grant select, insert, update, delete on table public.media_collections to service_role;
grant select, insert, update, delete on table public.media_collection_items to service_role;

create policy "media_collections_select_by_scope"
on public.media_collections for select to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);
create policy "media_collections_insert_by_writer"
on public.media_collections for insert to authenticated
with check (
  private.can_write_playlist(tenant_id)
  and (created_by is null or created_by = private.current_user_id())
);
create policy "media_collections_update_by_writer"
on public.media_collections for update to authenticated
using (private.can_write_playlist(tenant_id))
with check (private.can_write_playlist(tenant_id));
create policy "media_collections_delete_by_writer"
on public.media_collections for delete to authenticated
using (private.can_write_playlist(tenant_id));

create policy "media_collection_items_select_by_scope"
on public.media_collection_items for select to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);
create policy "media_collection_items_insert_by_writer"
on public.media_collection_items for insert to authenticated
with check (
  private.can_write_playlist(tenant_id)
  and (added_by is null or added_by = private.current_user_id())
);
create policy "media_collection_items_delete_by_writer"
on public.media_collection_items for delete to authenticated
using (private.can_write_playlist(tenant_id));

create or replace function public.mutate_media_collection_v1(
  p_tenant_id uuid,
  p_collection_id uuid,
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
  normalized_operation text := btrim(coalesce(p_operation, ''));
  request_json jsonb;
  replay jsonb;
  outcome jsonb;
  collection_record public.media_collections%rowtype;
  collection_id uuid := p_collection_id;
  actual_revision bigint;
  normalized_name text := btrim(coalesce(p_payload ->> 'name', ''));
  normalized_description text := nullif(btrim(coalesce(p_payload ->> 'description', '')), '');
begin
  if actor_id is null
    or not private.can_write_playlist(p_tenant_id)
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or normalized_operation not in ('create', 'update', 'archive')
  then
    raise exception 'actor cannot mutate media collections for this tenant'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  if normalized_operation in ('create', 'update') and (
    length(normalized_name) not between 2 and 80
    or (normalized_description is not null and length(normalized_description) > 240)
  ) then
    raise exception 'media collection content is invalid' using errcode = '23514';
  end if;

  request_json := jsonb_build_object(
    'tenantId', p_tenant_id,
    'collectionId', p_collection_id,
    'expectedRevision', p_expected_revision,
    'operation', normalized_operation,
    'payload', p_payload
  );
  replay := private.begin_publisher_command(
    p_tenant_id,
    'media.collection.' || normalized_operation,
    p_idempotency_key,
    request_json
  );
  if replay is not null then return replay; end if;

  if normalized_operation = 'create' then
    if p_collection_id is not null or p_expected_revision <> 0 then
      raise exception 'new media collection has invalid identity' using errcode = '22023';
    end if;
    insert into public.media_collections (
      tenant_id, name, description, created_by, updated_by
    ) values (
      p_tenant_id, normalized_name, normalized_description, actor_id, actor_id
    ) returning id, revision into collection_id, actual_revision;
  else
    select collection.* into collection_record
    from public.media_collections collection
    where collection.tenant_id = p_tenant_id
      and collection.id = p_collection_id
      and collection.status = 'active'
    for update;
    if not found then
      raise exception 'media collection not found' using errcode = 'P0002';
    end if;
    if collection_record.revision <> p_expected_revision then
      outcome := jsonb_build_object(
        'outcome', 'conflict',
        'collectionId', collection_record.id,
        'actualRevision', collection_record.revision
      );
      return private.complete_publisher_command(
        p_tenant_id,
        'media.collection.' || normalized_operation,
        p_idempotency_key,
        request_json,
        'media_collections',
        collection_record.id,
        outcome,
        'publisher.media_collection.conflict',
        'failed'
      );
    end if;
    if normalized_operation = 'update' then
      update public.media_collections
      set name = normalized_name,
          description = normalized_description,
          revision = revision + 1,
          updated_by = actor_id
      where id = collection_record.id
      returning revision into actual_revision;
    else
      update public.media_collections
      set status = 'archived',
          archived_at = now(),
          revision = revision + 1,
          updated_by = actor_id
      where id = collection_record.id
      returning revision into actual_revision;
    end if;
  end if;

  outcome := jsonb_build_object(
    'outcome', 'applied',
    'collectionId', collection_id,
    'actualRevision', actual_revision
  );
  return private.complete_publisher_command(
    p_tenant_id,
    'media.collection.' || normalized_operation,
    p_idempotency_key,
    request_json,
    'media_collections',
    collection_id,
    outcome,
    'publisher.media_collection.' || normalized_operation
  );
end;
$$;

create or replace function public.bulk_organize_media_assets_v1(
  p_tenant_id uuid,
  p_asset_ids uuid[],
  p_operation text,
  p_target_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_operation text := btrim(coalesce(p_operation, ''));
  requested_ids uuid[];
  request_json jsonb;
  replay jsonb;
  outcome jsonb;
  current_asset_id uuid;
  succeeded integer := 0;
  failed integer := 0;
  results jsonb := '[]'::jsonb;
begin
  select array_agg(distinct requested_id order by requested_id)
  into requested_ids
  from unnest(coalesce(p_asset_ids, '{}'::uuid[])) requested_id;

  if actor_id is null or not private.can_write_playlist(p_tenant_id) then
    raise exception 'actor cannot organize media for this tenant' using errcode = '42501';
  end if;
  if coalesce(array_length(requested_ids, 1), 0) not between 1 and 100
    or normalized_operation not in (
      'move', 'assign_tag', 'remove_tag', 'favorite', 'unfavorite',
      'add_collection', 'remove_collection'
    )
    or (
      normalized_operation in ('assign_tag', 'remove_tag', 'add_collection', 'remove_collection')
      and p_target_id is null
    )
  then
    raise exception 'bulk media organization command is invalid' using errcode = '22023';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  if normalized_operation = 'move' and p_target_id is not null and not exists (
    select 1 from public.media_folders folder
    where folder.tenant_id = p_tenant_id and folder.id = p_target_id
  ) then
    raise exception 'target media folder is unavailable' using errcode = 'P0002';
  end if;
  if normalized_operation in ('assign_tag', 'remove_tag') and not exists (
    select 1 from public.media_tags tag
    where tag.tenant_id = p_tenant_id and tag.id = p_target_id
  ) then
    raise exception 'target media tag is unavailable' using errcode = 'P0002';
  end if;
  if normalized_operation in ('add_collection', 'remove_collection') and not exists (
    select 1 from public.media_collections collection
    where collection.tenant_id = p_tenant_id
      and collection.id = p_target_id
      and collection.status = 'active'
  ) then
    raise exception 'target media collection is unavailable' using errcode = 'P0002';
  end if;

  request_json := jsonb_build_object(
    'tenantId', p_tenant_id,
    'assetIds', to_jsonb(requested_ids),
    'operation', normalized_operation,
    'targetId', p_target_id
  );
  replay := private.begin_publisher_command(
    p_tenant_id,
    'media.bulk.' || normalized_operation,
    p_idempotency_key,
    request_json
  );
  if replay is not null then return replay; end if;

  foreach current_asset_id in array requested_ids loop
    if not exists (
      select 1 from public.media_assets asset
      where asset.tenant_id = p_tenant_id
        and asset.id = current_asset_id
        and asset.source_kind = 'user'
        and asset.deleted_at is null
        and asset.status <> 'deleted'::public.media_asset_status
    ) then
      failed := failed + 1;
      results := results || jsonb_build_array(jsonb_build_object(
        'assetId', current_asset_id,
        'outcome', 'unavailable'
      ));
      continue;
    end if;

    if normalized_operation = 'move' then
      update public.media_assets set folder_id = p_target_id
      where tenant_id = p_tenant_id and id = current_asset_id;
    elsif normalized_operation = 'assign_tag' then
      insert into public.media_asset_tags (tenant_id, media_asset_id, tag_id, created_by)
      values (p_tenant_id, current_asset_id, p_target_id, actor_id)
      on conflict do nothing;
    elsif normalized_operation = 'remove_tag' then
      delete from public.media_asset_tags
      where tenant_id = p_tenant_id
        and media_asset_id = current_asset_id
        and tag_id = p_target_id;
    elsif normalized_operation = 'favorite' then
      insert into public.media_asset_favorites (tenant_id, media_asset_id, user_id)
      values (p_tenant_id, current_asset_id, actor_id)
      on conflict do nothing;
    elsif normalized_operation = 'unfavorite' then
      delete from public.media_asset_favorites
      where tenant_id = p_tenant_id
        and media_asset_id = current_asset_id
        and user_id = actor_id;
    elsif normalized_operation = 'add_collection' then
      insert into public.media_collection_items (
        tenant_id, collection_id, media_asset_id, added_by
      ) values (p_tenant_id, p_target_id, current_asset_id, actor_id)
      on conflict do nothing;
    else
      delete from public.media_collection_items
      where tenant_id = p_tenant_id
        and collection_id = p_target_id
        and media_asset_id = current_asset_id;
    end if;

    succeeded := succeeded + 1;
    results := results || jsonb_build_array(jsonb_build_object(
      'assetId', current_asset_id,
      'outcome', 'applied'
    ));
  end loop;

  outcome := jsonb_build_object(
    'outcome', case when failed > 0 then 'partial' else 'applied' end,
    'succeededCount', succeeded,
    'failedCount', failed,
    'results', results
  );
  return private.complete_publisher_command(
    p_tenant_id,
    'media.bulk.' || normalized_operation,
    p_idempotency_key,
    request_json,
    'media_assets_bulk',
    requested_ids[1],
    outcome,
    'publisher.media.bulk_' || normalized_operation,
    'success'
  );
end;
$$;

create or replace function public.list_publisher_media_assets_v2(
  p_tenant_id uuid,
  p_page_size integer default 50,
  p_offset integer default 0,
  p_search text default null,
  p_kind public.media_asset_kind default null,
  p_status public.media_asset_status default null,
  p_folder_id uuid default null,
  p_root_only boolean default false,
  p_tag_id uuid default null,
  p_collection_id uuid default null,
  p_favorites_only boolean default false,
  p_sort text default 'newest',
  p_created_from timestamptz default null,
  p_created_until timestamptz default null,
  p_usage text default 'all'
)
returns table (
  asset_id uuid,
  title text,
  original_file_name text,
  kind public.media_asset_kind,
  mime_type text,
  status public.media_asset_status,
  storage_path text,
  checksum_sha256 text,
  validation_error text,
  file_size_bytes bigint,
  duration_seconds numeric,
  width integer,
  height integer,
  folder_id uuid,
  is_favorite boolean,
  tags jsonb,
  collections jsonb,
  draft_usage_count bigint,
  release_usage_count bigint,
  screen_usage_count bigint,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_search text := nullif(btrim(p_search), '');
begin
  if actor_id is null or not (
    private.is_tenant_member(p_tenant_id)
    or private.is_platform_member(array[
      'platform_owner', 'platform_admin', 'platform_support'
    ]::public.platform_role[])
  ) then
    raise exception 'actor cannot list media for this tenant' using errcode = '42501';
  end if;
  if p_page_size not between 1 and 100
    or p_offset < 0
    or p_sort not in ('newest', 'oldest', 'name', 'size')
    or p_usage not in ('all', 'used', 'unused')
    or (p_root_only and p_folder_id is not null)
    or (
      p_created_from is not null and p_created_until is not null
      and p_created_until <= p_created_from
    )
  then
    raise exception 'media library query is invalid' using errcode = '22023';
  end if;

  return query
  with filtered as (
    select
      asset.id,
      asset.title,
      asset.original_file_name,
      asset.kind,
      asset.mime_type,
      asset.status,
      asset.storage_path,
      asset.checksum_sha256,
      asset.validation_error,
      asset.file_size_bytes,
      asset.duration_seconds,
      asset.width,
      asset.height,
      asset.folder_id,
      exists (
        select 1 from public.media_asset_favorites favorite
        where favorite.tenant_id = asset.tenant_id
          and favorite.media_asset_id = asset.id
          and favorite.user_id = actor_id
      ) as is_favorite,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', tag.id, 'name', tag.name, 'color', tag.color
        ) order by lower(tag.name), tag.id)
        from public.media_asset_tags asset_tag
        join public.media_tags tag
          on tag.tenant_id = asset_tag.tenant_id and tag.id = asset_tag.tag_id
        where asset_tag.tenant_id = asset.tenant_id
          and asset_tag.media_asset_id = asset.id
      ), '[]'::jsonb) as tags,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', collection.id, 'name', collection.name
        ) order by lower(collection.name), collection.id)
        from public.media_collection_items collection_item
        join public.media_collections collection
          on collection.tenant_id = collection_item.tenant_id
          and collection.id = collection_item.collection_id
          and collection.status = 'active'
        where collection_item.tenant_id = asset.tenant_id
          and collection_item.media_asset_id = asset.id
      ), '[]'::jsonb) as collections,
      (select count(distinct item.playlist_id) from public.playlist_items item
        where item.tenant_id = asset.tenant_id and item.media_asset_id = asset.id) as draft_usage_count,
      (select count(distinct release_item.release_id) from public.playlist_release_items release_item
        where release_item.tenant_id = asset.tenant_id and release_item.media_asset_id = asset.id) as release_usage_count,
      (select count(distinct screen.id)
        from public.screens screen
        join public.playlist_release_items release_item
          on release_item.tenant_id = screen.tenant_id
          and release_item.release_id = screen.assigned_release_id
          and release_item.media_asset_id = asset.id
        where screen.tenant_id = asset.tenant_id
          and screen.status <> 'disabled'::public.screen_status) as screen_usage_count,
      asset.created_at,
      asset.updated_at
    from public.media_assets asset
    where asset.tenant_id = p_tenant_id
      and asset.deleted_at is null
      and asset.source_kind = 'user'
      and (
        normalized_search is null
        or asset.title ilike '%' || normalized_search || '%'
        or asset.original_file_name ilike '%' || normalized_search || '%'
        or exists (
          select 1 from public.media_asset_tags search_asset_tag
          join public.media_tags search_tag
            on search_tag.tenant_id = search_asset_tag.tenant_id
            and search_tag.id = search_asset_tag.tag_id
          where search_asset_tag.tenant_id = asset.tenant_id
            and search_asset_tag.media_asset_id = asset.id
            and search_tag.name ilike '%' || normalized_search || '%'
        )
      )
      and (p_kind is null or asset.kind = p_kind)
      and (p_status is null or asset.status = p_status)
      and (p_created_from is null or asset.created_at >= p_created_from)
      and (p_created_until is null or asset.created_at < p_created_until)
      and (p_folder_id is null or asset.folder_id = p_folder_id)
      and (not p_root_only or asset.folder_id is null)
      and (p_tag_id is null or exists (
        select 1 from public.media_asset_tags asset_tag
        where asset_tag.tenant_id = asset.tenant_id
          and asset_tag.media_asset_id = asset.id
          and asset_tag.tag_id = p_tag_id
      ))
      and (p_collection_id is null or exists (
        select 1 from public.media_collection_items collection_item
        join public.media_collections collection
          on collection.tenant_id = collection_item.tenant_id
          and collection.id = collection_item.collection_id
          and collection.status = 'active'
        where collection_item.tenant_id = asset.tenant_id
          and collection_item.media_asset_id = asset.id
          and collection_item.collection_id = p_collection_id
      ))
      and (not p_favorites_only or exists (
        select 1 from public.media_asset_favorites favorite
        where favorite.tenant_id = asset.tenant_id
          and favorite.media_asset_id = asset.id
          and favorite.user_id = actor_id
      ))
      and (
        p_usage = 'all'
        or (p_usage = 'used' and (
          exists (select 1 from public.playlist_items item
            where item.tenant_id = asset.tenant_id and item.media_asset_id = asset.id)
          or exists (select 1 from public.playlist_release_items release_item
            where release_item.tenant_id = asset.tenant_id and release_item.media_asset_id = asset.id)
        ))
        or (p_usage = 'unused'
          and not exists (select 1 from public.playlist_items item
            where item.tenant_id = asset.tenant_id and item.media_asset_id = asset.id)
          and not exists (select 1 from public.playlist_release_items release_item
            where release_item.tenant_id = asset.tenant_id and release_item.media_asset_id = asset.id)
        )
      )
  ), counted as (
    select filtered.*, count(*) over () as total_count from filtered
  )
  select
    counted.id, counted.title, counted.original_file_name, counted.kind,
    counted.mime_type, counted.status, counted.storage_path,
    counted.checksum_sha256, counted.validation_error, counted.file_size_bytes,
    counted.duration_seconds, counted.width, counted.height, counted.folder_id,
    counted.is_favorite, counted.tags, counted.collections,
    counted.draft_usage_count, counted.release_usage_count,
    counted.screen_usage_count, counted.created_at, counted.updated_at,
    counted.total_count
  from counted
  order by
    case when p_sort = 'newest' then counted.created_at end desc,
    case when p_sort = 'oldest' then counted.created_at end asc,
    case when p_sort = 'name' then lower(counted.title) end asc,
    case when p_sort = 'size' then counted.file_size_bytes end desc,
    counted.id
  limit p_page_size offset p_offset;
end;
$$;

revoke all on function public.mutate_media_collection_v1(
  uuid, uuid, bigint, text, jsonb, uuid
) from public, anon;
revoke all on function public.bulk_organize_media_assets_v1(
  uuid, uuid[], text, uuid, uuid
) from public, anon;
revoke all on function public.list_publisher_media_assets_v2(
  uuid, integer, integer, text, public.media_asset_kind,
  public.media_asset_status, uuid, boolean, uuid, uuid, boolean, text,
  timestamptz, timestamptz, text
) from public, anon;
grant execute on function public.mutate_media_collection_v1(
  uuid, uuid, bigint, text, jsonb, uuid
) to authenticated;
grant execute on function public.bulk_organize_media_assets_v1(
  uuid, uuid[], text, uuid, uuid
) to authenticated;
grant execute on function public.list_publisher_media_assets_v2(
  uuid, integer, integer, text, public.media_asset_kind,
  public.media_asset_status, uuid, boolean, uuid, uuid, boolean, text,
  timestamptz, timestamptz, text
) to authenticated;
