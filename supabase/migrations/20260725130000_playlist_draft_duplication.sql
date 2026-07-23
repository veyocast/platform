create or replace function public.duplicate_playlist_draft_v1(
  p_source_playlist_id uuid,
  p_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  source_playlist public.playlists%rowtype;
  duplicate_id uuid;
  duplicate_name text;
  copied_item_count integer;
begin
  if actor_id is null then
    raise exception 'playlist duplication requires authentication' using errcode = '42501';
  end if;

  select playlist.*
  into source_playlist
  from public.playlists playlist
  where playlist.id = p_source_playlist_id;

  if not found then
    raise exception 'source playlist not found' using errcode = 'P0002';
  end if;

  if not private.can_write_playlist(source_playlist.tenant_id) then
    raise exception 'actor cannot duplicate this playlist' using errcode = '42501';
  end if;

  duplicate_name := nullif(btrim(p_name), '');
  if duplicate_name is null then
    duplicate_name := left('Kopie van ' || source_playlist.name, 120);
  end if;

  if length(duplicate_name) < 2 or length(duplicate_name) > 120 then
    raise exception 'playlist name must contain 2 through 120 characters' using errcode = '23514';
  end if;

  insert into public.playlists (
    tenant_id,
    name,
    description,
    status,
    created_by,
    updated_by,
    revision
  )
  values (
    source_playlist.tenant_id,
    duplicate_name,
    source_playlist.description,
    'draft'::public.playlist_status,
    actor_id,
    actor_id,
    0
  )
  returning id into duplicate_id;

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
  select
    source_item.tenant_id,
    duplicate_id,
    source_item.media_asset_id,
    source_item.sort_order,
    source_item.duration_seconds,
    source_item.fit_mode,
    source_item.muted,
    actor_id
  from public.playlist_items source_item
  where source_item.tenant_id = source_playlist.tenant_id
    and source_item.playlist_id = source_playlist.id
  order by source_item.sort_order;

  get diagnostics copied_item_count = row_count;

  perform private.audit_event(
    source_playlist.tenant_id,
    'playlist.draft.duplicate',
    'playlists',
    duplicate_id,
    'success',
    jsonb_build_object(
      'sourcePlaylistId', source_playlist.id,
      'copiedItemCount', copied_item_count
    )
  );

  return duplicate_id;
end;
$$;

revoke all on function public.duplicate_playlist_draft_v1(uuid, text)
from public, anon;
grant execute on function public.duplicate_playlist_draft_v1(uuid, text)
to authenticated;
