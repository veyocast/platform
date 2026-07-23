-- S31-B: idempotent media lifecycle commands and an explicit archive view.

create or replace function public.mutate_media_asset_v1(
  p_tenant_id uuid,
  p_asset_id uuid,
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
  asset_record public.media_assets%rowtype;
  normalized_title text;
  request_json jsonb;
  replay jsonb;
  outcome jsonb;
begin
  if actor_id is null
    or p_asset_id is null
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or normalized_operation not in ('rename', 'archive', 'restore')
  then
    raise exception 'media asset command is invalid' using errcode = '22023';
  end if;
  if not private.can_write_playlist(p_tenant_id) then
    raise exception 'actor cannot manage media for this tenant' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  select asset.* into asset_record
  from public.media_assets asset
  where asset.tenant_id = p_tenant_id
    and asset.id = p_asset_id
  for update;
  if not found then
    raise exception 'media asset not found' using errcode = 'P0002';
  end if;

  normalized_title := nullif(btrim(coalesce(p_payload ->> 'title', '')), '');
  if normalized_operation = 'rename'
    and (
      asset_record.deleted_at is not null
      or normalized_title is null
      or length(normalized_title) not between 2 and 120
    )
  then
    raise exception 'media asset rename is invalid' using errcode = '23514';
  end if;
  if normalized_operation = 'archive' then
    if asset_record.deleted_at is not null then
      raise exception 'media asset is already archived' using errcode = '23514';
    end if;
    if exists (
      select 1
      from public.playlist_items item
      where item.tenant_id = p_tenant_id
        and item.media_asset_id = asset_record.id
    ) then
      raise exception 'media asset is still used by a draft playlist' using errcode = '23514';
    end if;
  end if;
  if normalized_operation = 'restore' and asset_record.deleted_at is null then
    raise exception 'media asset is not archived' using errcode = '23514';
  end if;

  request_json := jsonb_strip_nulls(jsonb_build_object(
    'tenantId', p_tenant_id,
    'assetId', p_asset_id,
    'operation', normalized_operation,
    'title', normalized_title
  ));
  replay := private.begin_publisher_command(
    p_tenant_id,
    'media.asset.' || normalized_operation,
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  if normalized_operation = 'rename' then
    update public.media_assets
    set title = normalized_title
    where id = asset_record.id;
  elsif normalized_operation = 'archive' then
    update public.media_assets
    set deleted_at = now()
    where id = asset_record.id;
  else
    update public.media_assets
    set deleted_at = null
    where id = asset_record.id;
  end if;

  outcome := jsonb_build_object(
    'outcome', 'applied',
    'assetId', asset_record.id,
    'operation', normalized_operation
  );
  return private.complete_publisher_command(
    p_tenant_id,
    'media.asset.' || normalized_operation,
    p_idempotency_key,
    request_json,
    'media_assets',
    asset_record.id,
    outcome,
    'publisher.media.' || normalized_operation
  );
end;
$$;

create or replace function public.list_publisher_archived_media_assets_v1(
  p_tenant_id uuid,
  p_page_size integer default 50,
  p_offset integer default 0,
  p_search text default null,
  p_kind public.media_asset_kind default null,
  p_folder_id uuid default null,
  p_root_only boolean default false,
  p_tag_id uuid default null,
  p_sort text default 'newest',
  p_created_from timestamptz default null,
  p_created_until timestamptz default null
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
    raise exception 'actor cannot list archived media for this tenant' using errcode = '42501';
  end if;
  if p_page_size not between 1 and 100
    or p_offset < 0
    or p_sort not in ('newest', 'oldest', 'name', 'size')
    or (p_root_only and p_folder_id is not null)
    or (
      p_created_from is not null
      and p_created_until is not null
      and p_created_until <= p_created_from
    )
  then
    raise exception 'archived media library query is invalid' using errcode = '22023';
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
        select 1
        from public.media_asset_favorites favorite
        where favorite.tenant_id = asset.tenant_id
          and favorite.media_asset_id = asset.id
          and favorite.user_id = actor_id
      ) as is_favorite,
      coalesce((
        select jsonb_agg(
          jsonb_build_object('id', tag.id, 'name', tag.name, 'color', tag.color)
          order by lower(tag.name), tag.id
        )
        from public.media_asset_tags asset_tag
        join public.media_tags tag
          on tag.tenant_id = asset_tag.tenant_id
          and tag.id = asset_tag.tag_id
        where asset_tag.tenant_id = asset.tenant_id
          and asset_tag.media_asset_id = asset.id
      ), '[]'::jsonb) as tags,
      (
        select count(distinct item.playlist_id)
        from public.playlist_items item
        where item.tenant_id = asset.tenant_id
          and item.media_asset_id = asset.id
      ) as draft_usage_count,
      (
        select count(distinct release_item.release_id)
        from public.playlist_release_items release_item
        where release_item.tenant_id = asset.tenant_id
          and release_item.media_asset_id = asset.id
      ) as release_usage_count,
      (
        select count(distinct screen.id)
        from public.screens screen
        join public.playlist_release_items release_item
          on release_item.tenant_id = screen.tenant_id
          and release_item.release_id = screen.assigned_release_id
          and release_item.media_asset_id = asset.id
        where screen.tenant_id = asset.tenant_id
          and screen.status <> 'disabled'::public.screen_status
      ) as screen_usage_count,
      asset.created_at,
      asset.updated_at
    from public.media_assets asset
    where asset.tenant_id = p_tenant_id
      and asset.deleted_at is not null
      and (
        normalized_search is null
        or asset.title ilike '%' || normalized_search || '%'
        or asset.original_file_name ilike '%' || normalized_search || '%'
      )
      and (p_kind is null or asset.kind = p_kind)
      and (p_created_from is null or asset.created_at >= p_created_from)
      and (p_created_until is null or asset.created_at < p_created_until)
      and (p_folder_id is null or asset.folder_id = p_folder_id)
      and (not p_root_only or asset.folder_id is null)
      and (
        p_tag_id is null
        or exists (
          select 1
          from public.media_asset_tags asset_tag
          where asset_tag.tenant_id = asset.tenant_id
            and asset_tag.media_asset_id = asset.id
            and asset_tag.tag_id = p_tag_id
        )
      )
  ),
  counted as (
    select filtered.*, count(*) over () as total_count
    from filtered
  )
  select
    counted.id,
    counted.title,
    counted.original_file_name,
    counted.kind,
    counted.mime_type,
    counted.status,
    counted.storage_path,
    counted.checksum_sha256,
    counted.validation_error,
    counted.file_size_bytes,
    counted.duration_seconds,
    counted.width,
    counted.height,
    counted.folder_id,
    counted.is_favorite,
    counted.tags,
    counted.draft_usage_count,
    counted.release_usage_count,
    counted.screen_usage_count,
    counted.created_at,
    counted.updated_at,
    counted.total_count
  from counted
  order by
    case when p_sort = 'newest' then counted.updated_at end desc,
    case when p_sort = 'oldest' then counted.updated_at end asc,
    case when p_sort = 'name' then lower(counted.title) end asc,
    case when p_sort = 'size' then counted.file_size_bytes end desc,
    counted.id
  limit p_page_size
  offset p_offset;
end;
$$;

revoke all on function public.mutate_media_asset_v1(
  uuid, uuid, text, jsonb, uuid
) from public, anon;
revoke all on function public.list_publisher_archived_media_assets_v1(
  uuid, integer, integer, text, public.media_asset_kind, uuid, boolean, uuid,
  text, timestamptz, timestamptz
) from public, anon;

grant execute on function public.mutate_media_asset_v1(
  uuid, uuid, text, jsonb, uuid
) to authenticated;
grant execute on function public.list_publisher_archived_media_assets_v1(
  uuid, integer, integer, text, public.media_asset_kind, uuid, boolean, uuid,
  text, timestamptz, timestamptz
) to authenticated;
