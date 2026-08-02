-- S86: expose dynamic slides to the playlist editor as first-class HTML/CSS
-- items. The immutable image remains attached only as a verified fallback.

create or replace function private.resolve_dynamic_playlist_item_provenance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_snapshot_id uuid;
  resolved_slide_id uuid;
  resolved_selection_mode text;
begin
  select
    snapshot.id,
    snapshot.dynamic_slide_id,
    slide.selection_mode
  into
    resolved_snapshot_id,
    resolved_slide_id,
    resolved_selection_mode
  from public.dynamic_slide_snapshots snapshot
  join public.dynamic_slides slide
    on slide.tenant_id = snapshot.tenant_id
    and slide.id = snapshot.dynamic_slide_id
  where snapshot.tenant_id = new.tenant_id
    and snapshot.output_media_asset_id = new.media_asset_id
    and snapshot.status = 'ready'
  order by
    (slide.current_snapshot_id = snapshot.id) desc,
    snapshot.completed_at desc nulls last,
    snapshot.created_at desc
  limit 1;

  if resolved_snapshot_id is not null then
    new.dynamic_slide_id := resolved_slide_id;
    new.dynamic_snapshot_id := resolved_snapshot_id;
    new.dynamic_selection_mode := resolved_selection_mode;
  else
    new.dynamic_slide_id := null;
    new.dynamic_snapshot_id := null;
    new.dynamic_selection_mode := null;
  end if;
  return new;
end;
$$;

drop trigger if exists playlist_items_resolve_dynamic_provenance
  on public.playlist_items;
create trigger playlist_items_resolve_dynamic_provenance
before insert or update of
  media_asset_id,
  dynamic_slide_id,
  dynamic_snapshot_id,
  dynamic_selection_mode
on public.playlist_items
for each row
execute function private.resolve_dynamic_playlist_item_provenance();

revoke all on function private.resolve_dynamic_playlist_item_provenance()
  from public, anon, authenticated;

create or replace function public.add_dynamic_slide_to_playlist_v2(
  p_playlist_id uuid,
  p_dynamic_slide_id uuid,
  p_expected_revision bigint,
  p_duration_seconds integer,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  playlist_record public.playlists%rowtype;
  slide_record public.dynamic_slides%rowtype;
  snapshot_record public.dynamic_slide_snapshots%rowtype;
  request_json jsonb;
  replay jsonb;
  outcome jsonb;
  item_id uuid;
  next_sort integer;
  resolved_duration integer;
  news_page_count integer;
  seconds_per_slide integer;
  actual_revision bigint;
begin
  if p_expected_revision is null
    or p_expected_revision < 0
    or p_duration_seconds is null
    or p_duration_seconds not between 5 and 3600
    or p_idempotency_key is null
  then
    raise exception 'dynamic playlist command is invalid'
      using errcode = '22023';
  end if;

  select playlist.*
  into playlist_record
  from public.playlists playlist
  where playlist.id = p_playlist_id
  for update;
  if not found then
    raise exception 'playlist not found' using errcode = 'P0002';
  end if;
  if actor_id is null
    or not private.can_write_playlist(playlist_record.tenant_id)
  then
    raise exception 'actor cannot change playlist' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(playlist_record.tenant_id);
  if playlist_record.status = 'archived'::public.playlist_status then
    raise exception 'archived playlists cannot be changed'
      using errcode = '23514';
  end if;

  select slide.*
  into slide_record
  from public.dynamic_slides slide
  where slide.id = p_dynamic_slide_id
    and slide.tenant_id = playlist_record.tenant_id
    and slide.status = 'ready'
  for share;
  if not found then
    raise exception 'dynamic slide not found' using errcode = 'P0002';
  end if;

  select snapshot.*
  into snapshot_record
  from public.dynamic_slide_snapshots snapshot
  join public.media_assets asset
    on asset.tenant_id = snapshot.tenant_id
    and asset.id = snapshot.output_media_asset_id
  where snapshot.id = slide_record.current_snapshot_id
    and snapshot.tenant_id = playlist_record.tenant_id
    and snapshot.dynamic_slide_id = slide_record.id
    and snapshot.status = 'ready'
    and snapshot.output_media_asset_id is not null
    and asset.status = 'ready'
    and asset.deleted_at is null;
  if not found then
    raise exception 'dynamic slide has no ready snapshot'
      using errcode = '23514';
  end if;

  request_json := jsonb_build_object(
    'playlistId', playlist_record.id,
    'dynamicSlideId', slide_record.id,
    'dynamicSnapshotId', snapshot_record.id,
    'expectedRevision', p_expected_revision,
    'durationSeconds', p_duration_seconds
  );
  replay := private.begin_publisher_command(
    playlist_record.tenant_id,
    'playlist.dynamic_slide.add',
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  if playlist_record.revision <> p_expected_revision then
    outcome := jsonb_build_object(
      'outcome', 'conflict',
      'actualRevision', playlist_record.revision
    );
    return private.complete_publisher_command(
      playlist_record.tenant_id,
      'playlist.dynamic_slide.add',
      p_idempotency_key,
      request_json,
      'playlists',
      playlist_record.id,
      outcome,
      'publisher.playlist.conflict',
      'failed'
    );
  end if;

  resolved_duration := least(greatest(p_duration_seconds, 5), 3600);
  if slide_record.slide_type = 'news' then
    news_page_count := greatest(
      jsonb_array_length(coalesce(
        snapshot_record.snapshot_data_json #> '{news,articles}',
        '[]'::jsonb
      )),
      1
    );
    seconds_per_slide := least(greatest(
      case
        when coalesce(
          snapshot_record.snapshot_data_json #>> '{news,secondsPerSlide}',
          ''
        ) ~ '^[0-9]{1,3}$'
          then (
            snapshot_record.snapshot_data_json #>>
              '{news,secondsPerSlide}'
          )::integer
        else 5
      end,
      5
    ), 120);
    resolved_duration := least(news_page_count * seconds_per_slide, 3600);
  end if;

  select coalesce(max(item.sort_order), -1) + 1
  into next_sort
  from public.playlist_items item
  where item.tenant_id = playlist_record.tenant_id
    and item.playlist_id = playlist_record.id;

  insert into public.playlist_items(
    tenant_id,
    playlist_id,
    media_asset_id,
    sort_order,
    duration_seconds,
    fit_mode,
    muted,
    created_by,
    dynamic_slide_id,
    dynamic_snapshot_id,
    dynamic_selection_mode
  )
  values (
    playlist_record.tenant_id,
    playlist_record.id,
    snapshot_record.output_media_asset_id,
    next_sort,
    resolved_duration,
    'contain',
    true,
    actor_id,
    slide_record.id,
    snapshot_record.id,
    slide_record.selection_mode
  )
  returning id into item_id;

  update public.playlists
  set revision = revision + 1,
      status = 'draft'::public.playlist_status,
      updated_by = actor_id,
      updated_at = now()
  where id = playlist_record.id
  returning revision into actual_revision;

  outcome := jsonb_build_object(
    'outcome', 'applied',
    'actualRevision', actual_revision,
    'itemId', item_id,
    'dynamicSlideId', slide_record.id,
    'dynamicSnapshotId', snapshot_record.id,
    'durationSeconds', resolved_duration,
    'renderMode', 'html_css'
  );
  return private.complete_publisher_command(
    playlist_record.tenant_id,
    'playlist.dynamic_slide.add',
    p_idempotency_key,
    request_json,
    'playlist_items',
    item_id,
    outcome,
    'dynamic.slide.added_to_playlist'
  );
end;
$$;

revoke all on function public.add_dynamic_slide_to_playlist_v2(
  uuid,
  uuid,
  bigint,
  integer,
  uuid
) from public, anon;
grant execute on function public.add_dynamic_slide_to_playlist_v2(
  uuid,
  uuid,
  bigint,
  integer,
  uuid
) to authenticated;
