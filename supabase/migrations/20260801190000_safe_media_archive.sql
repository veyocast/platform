-- S79: archive media atomically while removing explicitly confirmed draft usage.

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
  remove_draft_references boolean := false;
  expected_draft_count integer;
  affected_draft_count integer := 0;
  affected_item_count integer := 0;
  affected_playlist_ids uuid[] := array[]::uuid[];
  affected_playlist_id uuid;
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
  if normalized_operation = 'archive' then
    if coalesce(p_payload ->> 'removeDraftReferences', '') not in ('', 'true', 'false')
      or (
        coalesce(p_payload ->> 'expectedDraftCount', '') <> ''
        and p_payload ->> 'expectedDraftCount' !~ '^[0-9]+$'
      )
    then
      raise exception 'media archive confirmation is invalid' using errcode = '22023';
    end if;
    remove_draft_references := coalesce(
      nullif(p_payload ->> 'removeDraftReferences', '')::boolean,
      false
    );
    expected_draft_count := nullif(
      p_payload ->> 'expectedDraftCount',
      ''
    )::integer;
  end if;

  request_json := jsonb_strip_nulls(jsonb_build_object(
    'tenantId', p_tenant_id,
    'assetId', p_asset_id,
    'operation', normalized_operation,
    'title', normalized_title,
    'removeDraftReferences', case
      when normalized_operation = 'archive' then remove_draft_references
      else null
    end,
    'expectedDraftCount', case
      when normalized_operation = 'archive' then expected_draft_count
      else null
    end
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

    select
      coalesce(
        array_agg(distinct item.playlist_id order by item.playlist_id),
        array[]::uuid[]
      ),
      count(distinct item.playlist_id)::integer,
      count(*)::integer
    into
      affected_playlist_ids,
      affected_draft_count,
      affected_item_count
    from public.playlist_items item
    where item.tenant_id = p_tenant_id
      and item.media_asset_id = asset_record.id;

    if affected_draft_count > 0 then
      perform 1
      from public.playlists playlist
      where playlist.tenant_id = p_tenant_id
        and playlist.id = any(affected_playlist_ids)
      order by playlist.id
      for update;

      select
        coalesce(
          array_agg(distinct item.playlist_id order by item.playlist_id),
          array[]::uuid[]
        ),
        count(distinct item.playlist_id)::integer,
        count(*)::integer
      into
        affected_playlist_ids,
        affected_draft_count,
        affected_item_count
      from public.playlist_items item
      where item.tenant_id = p_tenant_id
        and item.media_asset_id = asset_record.id;
    end if;

    if expected_draft_count is not null
      and expected_draft_count <> affected_draft_count
    then
      raise exception 'media draft usage changed during archive'
        using errcode = '40001';
    end if;
    if affected_draft_count > 0
      and (
        not remove_draft_references
        or expected_draft_count is null
      )
    then
      raise exception 'media asset is still used by a draft playlist'
        using errcode = '23514';
    end if;

    if affected_draft_count > 0 then
      delete from public.playlist_items item
      where item.tenant_id = p_tenant_id
        and item.media_asset_id = asset_record.id;

      update public.playlists playlist
      set revision = playlist.revision + 1,
          status = case
            when playlist.status = 'archived'::public.playlist_status
              then playlist.status
            else 'draft'::public.playlist_status
          end,
          updated_by = actor_id,
          updated_at = now()
      where playlist.tenant_id = p_tenant_id
        and playlist.id = any(affected_playlist_ids);

      foreach affected_playlist_id in array affected_playlist_ids
      loop
        perform private.audit_event(
          p_tenant_id,
          'publisher.playlist.media_removed',
          'playlists',
          affected_playlist_id,
          'success',
          jsonb_build_object('mediaAssetId', asset_record.id)
        );
      end loop;
    end if;
  end if;

  if normalized_operation = 'restore' and asset_record.deleted_at is null then
    raise exception 'media asset is not archived' using errcode = '23514';
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
    'operation', normalized_operation,
    'removedDraftPlaylists', affected_draft_count,
    'removedDraftItems', affected_item_count
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
