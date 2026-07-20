alter table public.playlists
  add column revision bigint not null default 0 check (revision >= 0),
  add column updated_by uuid references public.profiles(id) on delete set null;

update public.playlists
set updated_by = created_by
where updated_by is null;

create index playlists_tenant_status_updated_idx
  on public.playlists(tenant_id, status, updated_at desc);

create or replace function private.can_write_playlist(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_tenant_role(p_tenant_id, array[
      'tenant_owner',
      'tenant_admin',
      'tenant_editor'
    ]::public.tenant_role[])
    or private.is_platform_member(array[
      'platform_owner',
      'platform_admin'
    ]::public.platform_role[]);
$$;

create or replace function public.mutate_playlist_draft_v1(
  p_playlist_id uuid,
  p_expected_revision bigint,
  p_operation text,
  p_payload jsonb default '{}'::jsonb
)
returns table (
  outcome text,
  actual_revision bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  playlist_record public.playlists%rowtype;
  asset_record public.media_assets%rowtype;
  item_record public.playlist_items%rowtype;
  target_record public.playlist_items%rowtype;
  settings_record public.tenant_settings%rowtype;
  normalized_name text;
  normalized_description text;
  item_id uuid;
  media_asset_id uuid;
  item_duration integer;
  item_fit text;
  item_muted boolean;
  item_direction text;
  target_order integer;
  temporary_order integer;
begin
  if actor_id is null then
    raise exception 'playlist mutation requires authentication' using errcode = '42501';
  end if;

  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'expected revision is required' using errcode = '23514';
  end if;

  if p_operation not in (
    'update_details',
    'add_item',
    'update_item',
    'move_item',
    'remove_item',
    'archive'
  ) then
    raise exception 'unsupported playlist operation' using errcode = '23514';
  end if;

  select playlist.*
  into playlist_record
  from public.playlists playlist
  where playlist.id = p_playlist_id
  for update;

  if not found then
    raise exception 'playlist not found' using errcode = 'P0002';
  end if;

  if not private.can_write_playlist(playlist_record.tenant_id) then
    raise exception 'actor cannot mutate this playlist' using errcode = '42501';
  end if;

  if playlist_record.revision <> p_expected_revision then
    return query select 'conflict'::text, playlist_record.revision;
    return;
  end if;

  if playlist_record.status = 'archived'::public.playlist_status
    and p_operation <> 'archive'
  then
    raise exception 'archived playlists cannot be changed' using errcode = '23514';
  end if;

  if p_operation = 'update_details' then
    normalized_name := nullif(btrim(p_payload->>'name'), '');
    normalized_description := nullif(btrim(p_payload->>'description'), '');

    if normalized_name is null or length(normalized_name) < 2 or length(normalized_name) > 120 then
      raise exception 'playlist name must contain 2 through 120 characters' using errcode = '23514';
    end if;

    if normalized_description is not null and length(normalized_description) > 500 then
      raise exception 'playlist description exceeds 500 characters' using errcode = '23514';
    end if;

    update public.playlists
    set name = normalized_name,
        description = normalized_description
    where id = playlist_record.id;

  elsif p_operation = 'add_item' then
    begin
      media_asset_id := (p_payload->>'mediaAssetId')::uuid;
    exception when invalid_text_representation then
      raise exception 'media asset id is invalid' using errcode = '23514';
    end;

    select asset.*
    into asset_record
    from public.media_assets asset
    where asset.id = media_asset_id
      and asset.tenant_id = playlist_record.tenant_id
      and asset.status = 'ready'::public.media_asset_status
      and asset.deleted_at is null;

    if not found then
      raise exception 'media asset is not ready in this tenant' using errcode = '23514';
    end if;

    select settings.*
    into settings_record
    from public.tenant_settings settings
    where settings.tenant_id = playlist_record.tenant_id;

    select coalesce(max(item.sort_order), -1) + 1
    into target_order
    from public.playlist_items item
    where item.tenant_id = playlist_record.tenant_id
      and item.playlist_id = playlist_record.id;

    insert into public.playlist_items (
      tenant_id,
      playlist_id,
      media_asset_id,
      sort_order,
      duration_seconds,
      fit_mode,
      muted,
      created_by
    )
    values (
      playlist_record.tenant_id,
      playlist_record.id,
      asset_record.id,
      target_order,
      case
        when asset_record.kind = 'video'::public.media_asset_kind then 10
        else coalesce(settings_record.default_image_duration_seconds, 10)
      end,
      coalesce(settings_record.default_fit_mode, 'contain'),
      coalesce(settings_record.default_video_muted, true),
      actor_id
    );

  elsif p_operation = 'update_item' then
    begin
      item_id := (p_payload->>'itemId')::uuid;
      item_duration := (p_payload->>'durationSeconds')::integer;
      item_muted := (p_payload->>'muted')::boolean;
    exception when invalid_text_representation then
      raise exception 'playlist item settings are invalid' using errcode = '23514';
    end;
    item_fit := p_payload->>'fitMode';

    if item_duration < 5 or item_duration > 3600 then
      raise exception 'playlist item duration is invalid' using errcode = '23514';
    end if;

    if item_fit not in ('contain', 'cover') then
      raise exception 'playlist item fit mode is invalid' using errcode = '23514';
    end if;

    update public.playlist_items item
    set duration_seconds = item_duration,
        fit_mode = item_fit,
        muted = item_muted
    where item.id = item_id
      and item.tenant_id = playlist_record.tenant_id
      and item.playlist_id = playlist_record.id;

    if not found then
      raise exception 'playlist item not found' using errcode = 'P0002';
    end if;

  elsif p_operation = 'remove_item' then
    begin
      item_id := (p_payload->>'itemId')::uuid;
    exception when invalid_text_representation then
      raise exception 'playlist item id is invalid' using errcode = '23514';
    end;

    delete from public.playlist_items item
    where item.id = item_id
      and item.tenant_id = playlist_record.tenant_id
      and item.playlist_id = playlist_record.id;

    if not found then
      raise exception 'playlist item not found' using errcode = 'P0002';
    end if;

  elsif p_operation = 'move_item' then
    begin
      item_id := (p_payload->>'itemId')::uuid;
    exception when invalid_text_representation then
      raise exception 'playlist item id is invalid' using errcode = '23514';
    end;
    item_direction := p_payload->>'direction';

    if item_direction not in ('up', 'down', 'start', 'end') then
      raise exception 'playlist item direction is invalid' using errcode = '23514';
    end if;

    select item.*
    into item_record
    from public.playlist_items item
    where item.id = item_id
      and item.tenant_id = playlist_record.tenant_id
      and item.playlist_id = playlist_record.id
    for update;

    if not found then
      raise exception 'playlist item not found' using errcode = 'P0002';
    end if;

    select item.*
    into target_record
    from public.playlist_items item
    where item.tenant_id = item_record.tenant_id
      and item.playlist_id = item_record.playlist_id
      and item.id <> item_record.id
      and (
        (item_direction = 'up' and item.sort_order < item_record.sort_order)
        or (item_direction = 'down' and item.sort_order > item_record.sort_order)
        or item_direction in ('start', 'end')
      )
    order by
      case when item_direction = 'up' then item.sort_order end desc,
      case when item_direction = 'down' then item.sort_order end asc,
      case when item_direction = 'start' then item.sort_order end asc,
      case when item_direction = 'end' then item.sort_order end desc
    limit 1
    for update;

    if found then
      select coalesce(max(item.sort_order), 0) + 1
      into temporary_order
      from public.playlist_items item
      where item.tenant_id = item_record.tenant_id
        and item.playlist_id = item_record.playlist_id;

      update public.playlist_items set sort_order = temporary_order where id = target_record.id;
      update public.playlist_items set sort_order = target_record.sort_order where id = item_record.id;
      update public.playlist_items set sort_order = item_record.sort_order where id = target_record.id;
    end if;

  elsif p_operation = 'archive' then
    if playlist_record.status = 'archived'::public.playlist_status then
      return query select 'applied'::text, playlist_record.revision;
      return;
    end if;

    if exists (
      select 1
      from public.screens screen
      where screen.tenant_id = playlist_record.tenant_id
        and screen.assigned_playlist_id = playlist_record.id
        and screen.status <> 'disabled'::public.screen_status
    ) then
      raise exception 'playlist is assigned to an active screen' using errcode = '23514';
    end if;

    update public.playlists
    set status = 'archived'::public.playlist_status,
        archived_at = now()
    where id = playlist_record.id;
  end if;

  update public.playlists
  set revision = revision + 1,
      status = case
        when p_operation = 'archive' then 'archived'::public.playlist_status
        else 'draft'::public.playlist_status
      end,
      updated_by = actor_id,
      updated_at = now()
  where id = playlist_record.id
  returning revision into actual_revision;

  perform private.audit_event(
    playlist_record.tenant_id,
    'playlist.draft.' || p_operation,
    'playlists',
    playlist_record.id,
    'success',
    jsonb_build_object(
      'expectedRevision', p_expected_revision,
      'actualRevision', actual_revision
    )
  );

  outcome := 'applied';
  return next;
end;
$$;

create or replace function public.publish_playlist_to_screens_v2(
  p_playlist_id uuid,
  p_expected_revision bigint,
  p_screen_ids uuid[],
  p_release_notes text default null
)
returns table (
  outcome text,
  actual_revision bigint,
  release_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  playlist_record public.playlists%rowtype;
begin
  select playlist.*
  into playlist_record
  from public.playlists playlist
  where playlist.id = p_playlist_id
  for update;

  if not found then
    raise exception 'playlist not found' using errcode = 'P0002';
  end if;

  if not private.can_write_playlist(playlist_record.tenant_id) then
    raise exception 'actor cannot publish this playlist' using errcode = '42501';
  end if;

  if playlist_record.revision <> p_expected_revision then
    return query select 'conflict'::text, playlist_record.revision, null::uuid;
    return;
  end if;

  release_id := public.publish_playlist_to_screens(
    p_playlist_id,
    p_screen_ids,
    p_release_notes
  );
  outcome := 'published';
  actual_revision := playlist_record.revision;
  return next;
end;
$$;

revoke all on function private.can_write_playlist(uuid) from public, anon, authenticated;
revoke all on function public.mutate_playlist_draft_v1(uuid, bigint, text, jsonb) from public, anon;
revoke all on function public.publish_playlist_to_screens_v2(uuid, bigint, uuid[], text) from public, anon;

grant execute on function public.mutate_playlist_draft_v1(uuid, bigint, text, jsonb) to authenticated;
grant execute on function public.publish_playlist_to_screens_v2(uuid, bigint, uuid[], text) to authenticated;
