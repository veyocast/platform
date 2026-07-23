create or replace function private.enforce_playlist_item_video_duration()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  asset_kind public.media_asset_kind;
  source_duration numeric;
  usable_duration numeric;
  maximum_duration integer;
begin
  select asset.kind, asset.duration_seconds
  into asset_kind, source_duration
  from public.media_assets asset
  where asset.tenant_id = new.tenant_id
    and asset.id = new.media_asset_id;

  if asset_kind is distinct from 'video'::public.media_asset_kind
    or source_duration is null
  then
    return new;
  end if;

  if new.trim_end_seconds is not null
    and new.trim_end_seconds <= coalesce(new.trim_start_seconds, 0)
  then
    return new;
  end if;

  if coalesce(new.trim_start_seconds, 0) >= source_duration
    or coalesce(new.trim_end_seconds, source_duration) > source_duration
  then
    raise exception 'playlist video trim falls outside the source duration'
      using errcode = '23514';
  end if;

  usable_duration :=
    coalesce(new.trim_end_seconds, source_duration)
    - coalesce(new.trim_start_seconds, 0);
  maximum_duration := greatest(5, least(3600, ceil(usable_duration)::integer));

  if new.duration_seconds > maximum_duration then
    raise exception 'playlist video duration exceeds the available source duration'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists playlist_items_enforce_video_duration
  on public.playlist_items;
create trigger playlist_items_enforce_video_duration
before insert or update of media_asset_id, duration_seconds, trim_start_seconds, trim_end_seconds
on public.playlist_items
for each row
execute function private.enforce_playlist_item_video_duration();
