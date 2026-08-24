-- S123 Vector v2: immutable YouTube release binding with a verified local
-- fallback. Online video metadata never enters the Player asset cache.

alter table public.playlist_items
  add column youtube_source_id uuid,
  add constraint playlist_items_youtube_source_fk
    foreign key (tenant_id, youtube_source_id)
    references public.youtube_sources(tenant_id, id) on delete restrict,
  add constraint playlist_items_single_dynamic_binding_check check (
    youtube_source_id is null or dynamic_slide_id is null
  );

create index playlist_items_youtube_source_idx
  on public.playlist_items(tenant_id, youtube_source_id)
  where youtube_source_id is not null;

alter table public.playlist_release_items
  add column youtube_source_id uuid,
  add column youtube_video_id text,
  add column youtube_title text,
  add column youtube_online_only boolean,
  add constraint playlist_release_items_youtube_source_fk
    foreign key (tenant_id, youtube_source_id)
    references public.youtube_sources(tenant_id, id) on delete restrict,
  add constraint playlist_release_items_youtube_snapshot_check check (
    (youtube_source_id is null and youtube_video_id is null
      and youtube_title is null and youtube_online_only is null)
    or
    (youtube_source_id is not null
      and youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'
      and length(btrim(youtube_title)) between 2 and 160
      and youtube_online_only is true)
  );

create index playlist_release_items_youtube_source_idx
  on public.playlist_release_items(tenant_id, youtube_source_id)
  where youtube_source_id is not null;

create function private.materialize_youtube_release_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  previous_item public.playlist_release_items%rowtype;
begin
  if new.source_item_id is not null then
    select item.youtube_source_id into new.youtube_source_id
    from public.playlist_items item
    where item.tenant_id = new.tenant_id and item.id = new.source_item_id;
  elsif new.youtube_source_id is null then
    -- Dynamic latest-refresh releases intentionally have no source_item_id.
    -- Carry the already immutable online snapshot forward by stable position
    -- and fallback asset rather than re-reading mutable provider metadata.
    select release_item.* into previous_item
    from public.playlist_release_items release_item
    join public.playlist_releases release
      on release.tenant_id = release_item.tenant_id
      and release.id = release_item.release_id
    where release_item.tenant_id = new.tenant_id
      and release_item.playlist_id = new.playlist_id
      and release_item.release_id <> new.release_id
      and release_item.sort_order = new.sort_order
      and release_item.media_asset_id = new.media_asset_id
    order by release.version desc
    limit 1;
    if found then
      new.youtube_source_id := previous_item.youtube_source_id;
      new.youtube_video_id := previous_item.youtube_video_id;
      new.youtube_title := previous_item.youtube_title;
      new.youtube_online_only := previous_item.youtube_online_only;
      return new;
    end if;
  end if;

  if new.youtube_source_id is not null then
    select source.video_id, source.title, source.online_only
    into new.youtube_video_id, new.youtube_title, new.youtube_online_only
    from public.youtube_sources source
    where source.tenant_id = new.tenant_id
      and source.id = new.youtube_source_id
      and source.status = 'active'
      and source.validation_status = 'verified'
      and source.embeddable is true;
    if not found then
      raise exception 'youtube source is not verified for playback'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger playlist_release_items_materialize_youtube
before insert on public.playlist_release_items
for each row execute function private.materialize_youtube_release_v1();

create function public.add_youtube_source_to_playlist_v1(
  p_playlist_id uuid,
  p_youtube_source_id uuid,
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
  source_record public.youtube_sources%rowtype;
  request_json jsonb;
  replay jsonb;
  outcome jsonb;
  item_id uuid;
  next_sort integer;
  actual_revision bigint;
begin
  if p_expected_revision is null or p_expected_revision < 0
    or p_duration_seconds not between 5 and 3600
    or p_idempotency_key is null then
    raise exception 'youtube playlist command is invalid' using errcode = '22023';
  end if;

  select playlist.* into playlist_record
  from public.playlists playlist
  where playlist.id = p_playlist_id
  for update;
  if not found then raise exception 'playlist not found' using errcode = 'P0002'; end if;
  if actor_id is null or not private.can_write_playlist(playlist_record.tenant_id)
    or not private.tenant_feature_enabled_v1(playlist_record.tenant_id, 'youtube_integration') then
    raise exception 'youtube rollout and playlist write capability required' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(playlist_record.tenant_id);
  if playlist_record.status = 'archived'::public.playlist_status then
    raise exception 'archived playlists cannot be changed' using errcode = '23514';
  end if;

  select source.* into source_record
  from public.youtube_sources source
  join public.media_assets fallback
    on fallback.tenant_id = source.tenant_id
    and fallback.id = source.fallback_media_asset_id
  where source.tenant_id = playlist_record.tenant_id
    and source.id = p_youtube_source_id
    and source.status = 'active'
    and source.validation_status = 'verified'
    and source.embeddable is true
    and fallback.status = 'ready'
    and fallback.deleted_at is null
  for share of source;
  if not found then
    raise exception 'youtube source is not publishable' using errcode = '23514';
  end if;

  request_json := jsonb_build_object(
    'playlistId', playlist_record.id,
    'youtubeSourceId', source_record.id,
    'expectedRevision', p_expected_revision,
    'durationSeconds', p_duration_seconds
  );
  replay := private.begin_publisher_command(
    playlist_record.tenant_id, 'playlist.youtube.add', p_idempotency_key, request_json
  );
  if replay is not null then return replay; end if;

  if playlist_record.revision <> p_expected_revision then
    outcome := jsonb_build_object('outcome','conflict','actualRevision',playlist_record.revision);
    return private.complete_publisher_command(
      playlist_record.tenant_id, 'playlist.youtube.add', p_idempotency_key,
      request_json, 'playlists', playlist_record.id, outcome,
      'publisher.playlist.conflict', 'failed'
    );
  end if;

  select coalesce(max(item.sort_order), -1) + 1 into next_sort
  from public.playlist_items item
  where item.tenant_id = playlist_record.tenant_id
    and item.playlist_id = playlist_record.id;

  insert into public.playlist_items(
    tenant_id, playlist_id, media_asset_id, youtube_source_id, sort_order,
    duration_seconds, fit_mode, muted, display_title, accessibility_name, created_by
  ) values (
    playlist_record.tenant_id, playlist_record.id,
    source_record.fallback_media_asset_id, source_record.id, next_sort,
    p_duration_seconds, 'cover', true, source_record.title,
    source_record.title || ', online video met lokale fallback', actor_id
  ) returning id into item_id;

  update public.playlists
  set revision = revision + 1, status = 'draft'::public.playlist_status,
      updated_by = actor_id, updated_at = now()
  where id = playlist_record.id
  returning revision into actual_revision;

  outcome := jsonb_build_object(
    'outcome','applied','actualRevision',actual_revision,'itemId',item_id,
    'youtubeSourceId',source_record.id,'onlineOnly',true,'fallbackMediaAssetId',source_record.fallback_media_asset_id
  );
  return private.complete_publisher_command(
    playlist_record.tenant_id, 'playlist.youtube.add', p_idempotency_key,
    request_json, 'playlist_items', item_id, outcome, 'youtube.source.added_to_playlist'
  );
end;
$$;

revoke all on function private.materialize_youtube_release_v1() from public, anon, authenticated;
revoke all on function public.add_youtube_source_to_playlist_v1(uuid,uuid,bigint,integer,uuid)
  from public, anon;
grant execute on function public.add_youtube_source_to_playlist_v1(uuid,uuid,bigint,integer,uuid)
  to authenticated;
