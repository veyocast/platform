-- S123 Vector v2: bind a campaign configuration to an immutable release while
-- keeping changing vote totals in the bounded runtime projection.

alter table public.playlist_items
  add column engage_campaign_id uuid,
  add constraint playlist_items_engage_campaign_fk
    foreign key (tenant_id, engage_campaign_id)
    references public.engage_campaigns(tenant_id, id) on delete restrict,
  add constraint playlist_items_single_engage_binding_check check (
    engage_campaign_id is null
    or (dynamic_slide_id is null and youtube_source_id is null)
  );

create index playlist_items_engage_campaign_idx
  on public.playlist_items(tenant_id, engage_campaign_id)
  where engage_campaign_id is not null;

alter table public.playlist_release_items
  add column engage_campaign_id uuid,
  add column engage_public_id uuid,
  add column engage_title text,
  add column engage_question text,
  add constraint playlist_release_items_engage_campaign_fk
    foreign key (tenant_id, engage_campaign_id)
    references public.engage_campaigns(tenant_id, id) on delete restrict,
  add constraint playlist_release_items_engage_snapshot_check check (
    (engage_campaign_id is null and engage_public_id is null
      and engage_title is null and engage_question is null)
    or
    (engage_campaign_id is not null and engage_public_id is not null
      and length(btrim(engage_title)) between 2 and 160
      and length(btrim(engage_question)) between 2 and 160)
  );

create function private.materialize_engage_release_v1()
returns trigger language plpgsql set search_path = '' as $$
declare previous_item public.playlist_release_items%rowtype;
begin
  if new.source_item_id is not null then
    select item.engage_campaign_id into new.engage_campaign_id
    from public.playlist_items item
    where item.tenant_id=new.tenant_id and item.id=new.source_item_id;
  elsif new.engage_campaign_id is null then
    select release_item.* into previous_item
    from public.playlist_release_items release_item
    join public.playlist_releases release
      on release.tenant_id=release_item.tenant_id and release.id=release_item.release_id
    where release_item.tenant_id=new.tenant_id
      and release_item.playlist_id=new.playlist_id
      and release_item.release_id<>new.release_id
      and release_item.sort_order=new.sort_order
      and release_item.media_asset_id=new.media_asset_id
    order by release.version desc limit 1;
    if found then
      new.engage_campaign_id:=previous_item.engage_campaign_id;
      new.engage_public_id:=previous_item.engage_public_id;
      new.engage_title:=previous_item.engage_title;
      new.engage_question:=previous_item.engage_question;
      return new;
    end if;
  end if;
  if new.engage_campaign_id is not null then
    select campaign.public_id,campaign.title,campaign.question
    into new.engage_public_id,new.engage_title,new.engage_question
    from public.engage_campaigns campaign
    where campaign.tenant_id=new.tenant_id and campaign.id=new.engage_campaign_id
      and campaign.status in ('scheduled','live','closed');
    if not found then
      raise exception 'engage campaign is not publishable' using errcode='23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger playlist_release_items_materialize_engage
before insert on public.playlist_release_items
for each row execute function private.materialize_engage_release_v1();

create function public.add_engage_campaign_to_playlist_v1(
  p_playlist_id uuid,
  p_campaign_id uuid,
  p_fallback_media_asset_id uuid,
  p_expected_revision bigint,
  p_duration_seconds integer,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor_id uuid:=private.current_user_id();
  playlist_record public.playlists%rowtype;
  campaign_record public.engage_campaigns%rowtype;
  request_json jsonb; replay jsonb; outcome jsonb;
  item_id uuid; next_sort integer; actual_revision bigint;
begin
  if p_expected_revision is null or p_expected_revision<0
    or p_duration_seconds not between 5 and 3600 or p_idempotency_key is null then
    raise exception 'engage playlist command is invalid' using errcode='22023';
  end if;
  select playlist.* into playlist_record from public.playlists playlist
  where playlist.id=p_playlist_id for update;
  if not found then raise exception 'playlist not found' using errcode='P0002'; end if;
  if actor_id is null or not private.can_write_playlist(playlist_record.tenant_id)
    or not private.tenant_feature_enabled_v1(playlist_record.tenant_id,'engage') then
    raise exception 'engage rollout and playlist write capability required' using errcode='42501';
  end if;
  perform private.require_active_tenant_command(playlist_record.tenant_id);
  select campaign.* into campaign_record from public.engage_campaigns campaign
  where campaign.tenant_id=playlist_record.tenant_id and campaign.id=p_campaign_id
    and campaign.status in ('scheduled','live','closed') for share;
  if not found or not exists(select 1 from public.media_assets asset
    where asset.tenant_id=playlist_record.tenant_id and asset.id=p_fallback_media_asset_id
      and asset.status='ready' and asset.deleted_at is null) then
    raise exception 'engage campaign or fallback is not publishable' using errcode='23514';
  end if;
  request_json:=jsonb_build_object('playlistId',playlist_record.id,'campaignId',campaign_record.id,
    'fallbackMediaAssetId',p_fallback_media_asset_id,'expectedRevision',p_expected_revision,
    'durationSeconds',p_duration_seconds);
  replay:=private.begin_publisher_command(playlist_record.tenant_id,'playlist.engage.add',p_idempotency_key,request_json);
  if replay is not null then return replay; end if;
  if playlist_record.revision<>p_expected_revision then
    outcome:=jsonb_build_object('outcome','conflict','actualRevision',playlist_record.revision);
    return private.complete_publisher_command(playlist_record.tenant_id,'playlist.engage.add',p_idempotency_key,
      request_json,'playlists',playlist_record.id,outcome,'publisher.playlist.conflict','failed');
  end if;
  select coalesce(max(item.sort_order),-1)+1 into next_sort from public.playlist_items item
  where item.tenant_id=playlist_record.tenant_id and item.playlist_id=playlist_record.id;
  insert into public.playlist_items(tenant_id,playlist_id,media_asset_id,engage_campaign_id,
    sort_order,duration_seconds,fit_mode,muted,display_title,accessibility_name,created_by)
  values(playlist_record.tenant_id,playlist_record.id,p_fallback_media_asset_id,campaign_record.id,
    next_sort,p_duration_seconds,'cover',true,campaign_record.title,
    campaign_record.title||', live publieksactie',actor_id) returning id into item_id;
  update public.playlists set revision=revision+1,status='draft',updated_by=actor_id,updated_at=now()
  where id=playlist_record.id returning revision into actual_revision;
  outcome:=jsonb_build_object('outcome','applied','actualRevision',actual_revision,'itemId',item_id,
    'campaignId',campaign_record.id,'runtimeData','live','fallbackMediaAssetId',p_fallback_media_asset_id);
  return private.complete_publisher_command(playlist_record.tenant_id,'playlist.engage.add',p_idempotency_key,
    request_json,'playlist_items',item_id,outcome,'engage.campaign.added_to_playlist');
end;
$$;

revoke all on function private.materialize_engage_release_v1() from public,anon,authenticated;
revoke all on function public.add_engage_campaign_to_playlist_v1(uuid,uuid,uuid,bigint,integer,uuid) from public,anon;
grant execute on function public.add_engage_campaign_to_playlist_v1(uuid,uuid,uuid,bigint,integer,uuid) to authenticated;
