-- S191: bounded, revision-guarded mixed playlist editing in one transaction.
-- Rendering/source workers do not call this authoring command.
alter table public.playlist_items drop constraint playlist_items_duration_seconds_check,
  add constraint playlist_items_duration_seconds_check check(duration_seconds between 3 and 3600),
  add column sites_configuration_json jsonb check(sites_configuration_json is null or jsonb_typeof(sites_configuration_json)='object');
alter table public.playlist_release_items drop constraint playlist_release_items_duration_seconds_check,
  add constraint playlist_release_items_duration_seconds_check check(duration_seconds between 3 and 3600),
  add column sites_configuration_json jsonb check(sites_configuration_json is null or jsonb_typeof(sites_configuration_json)='object');

create function private.freeze_playlist_sites_configuration_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.source_item_id is not null then
    select sites_configuration_json into new.sites_configuration_json from public.playlist_items
      where tenant_id=new.tenant_id and playlist_id=new.playlist_id and id=new.source_item_id;
  end if;
  return new;
end $$;
revoke all on function private.freeze_playlist_sites_configuration_v1() from public,anon,authenticated,service_role;
create trigger zz_release_item_sites_configuration before insert on public.playlist_release_items
for each row execute function private.freeze_playlist_sites_configuration_v1();

create function public.mutate_playlist_batch_v1(p_playlist_id uuid,p_expected_revision bigint,p_operations jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  playlist public.playlists%rowtype; item public.playlist_items%rowtype;
  operation jsonb; patch jsonb; payload jsonb; request jsonb; replay jsonb; result jsonb;
  mapping jsonb:='{}'; child_ids jsonb; before_ids uuid[]; ordered_ids uuid[];
  actor uuid:=private.current_user_id(); item_id uuid; client_id uuid; child_key uuid;
  current_revision bigint; ordinal integer:=0; next_sort integer; next_position numeric;
  series_item record; exported record; series_revision bigint; duration integer;series_index integer;
begin
  if p_expected_revision is null or p_expected_revision<0 or p_idempotency_key is null
    or jsonb_typeof(p_operations) is distinct from 'array' or jsonb_array_length(p_operations) not between 1 and 200
    or octet_length(p_operations::text)>262144 then raise exception 'playlist batch exceeds limits' using errcode='22023';end if;
  select * into playlist from public.playlists where id=p_playlist_id for update;
  if not found or actor is null or not private.can_write_playlist(playlist.tenant_id) then raise exception 'actor cannot edit playlist' using errcode='42501';end if;
  perform private.require_active_tenant_command(playlist.tenant_id);
  if playlist.status='archived' then raise exception 'archived playlist cannot be edited' using errcode='23514';end if;
  request:=jsonb_build_object('playlistId',p_playlist_id,'expectedRevision',p_expected_revision,'operations',p_operations);
  replay:=private.begin_publisher_command(playlist.tenant_id,'playlist.batch.v1',p_idempotency_key,request);
  if replay is not null then return replay;end if;
  if playlist.revision<>p_expected_revision then
    return private.complete_publisher_command(playlist.tenant_id,'playlist.batch.v1',p_idempotency_key,request,'playlists',playlist.id,
      jsonb_build_object('outcome','conflict','actualRevision',playlist.revision),'publisher.playlist.conflict','failed');
  end if;
  current_revision:=playlist.revision;
  for operation in select * from jsonb_array_elements(p_operations) loop
    ordinal:=ordinal+1;
    child_key:=md5(p_idempotency_key::text||':playlist-batch:'||ordinal)::uuid;
    if operation?'clientId' then
      client_id:=(operation->>'clientId')::uuid;
      if mapping?client_id::text or exists(select 1 from public.playlist_items where id=client_id) then raise exception 'duplicate command-local item identity' using errcode='23514';end if;
    else client_id:=null;end if;
    result:=null;
    if operation->>'operation' in('add_media','add_dynamic','add_youtube','add_engage')then
      duration:=(operation->>'durationSeconds')::integer;
      if duration is null or duration not between 3 and 3600 then raise exception 'duration outside limits'using errcode='23514';end if;
      if client_id is null then raise exception 'new placement requires command identity'using errcode='23514';end if;
    end if;
    item_id:=coalesce(nullif(mapping->>(operation->>'itemId'),'')::uuid,nullif(operation->>'itemId','')::uuid);
    select coalesce(array_agg(id),'{}'::uuid[]) into before_ids from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id;

    if operation->>'operation'='add_media' then
      duration:=(operation->>'durationSeconds')::integer;
      if duration not between 3 and 3600 then raise exception 'duration outside limits' using errcode='23514';end if;
      perform 1 from public.media_assets asset join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.variant_type::text=case when asset.kind='video' then 'player_1080p' else 'original' end
        where asset.tenant_id=playlist.tenant_id and asset.id=(operation->>'mediaAssetId')::uuid and asset.status='ready' and asset.deleted_at is null and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$';
      if not found then raise exception 'media has no verified playback variant' using errcode='23514';end if;
      select to_jsonb(command) into result from public.mutate_playlist_draft_v1(playlist.id,current_revision,'add_item',
        jsonb_build_object('mediaAssetId',operation->>'mediaAssetId','durationSeconds',greatest(5,duration),'fitMode',playlist.default_fit_mode,'muted',playlist.default_video_muted)) command;
      select id into strict item_id from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and not(id=any(before_ids));
      update public.playlist_items set duration_seconds=duration,fit_mode=playlist.default_fit_mode,muted=playlist.default_video_muted,transition=playlist.default_transition,background_color=playlist.default_background_color where id=item_id;
      mapping:=mapping||jsonb_build_object(client_id::text,item_id);
    elsif operation->>'operation'='add_dynamic' then
      -- The library selection names the immutable snapshot the user reviewed.
      perform 1 from public.dynamic_slides where tenant_id=playlist.tenant_id and id=(operation->>'dynamicSlideId')::uuid and current_snapshot_id=(operation->>'expectedSnapshotId')::uuid for share;
      if not found then raise exception 'dynamic selection changed; reload library' using errcode='40001';end if;
      perform 1 from public.dynamic_slide_snapshots snapshot
        join public.media_assets asset on asset.tenant_id=snapshot.tenant_id and asset.id=snapshot.output_media_asset_id and asset.status='ready' and asset.deleted_at is null
        join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.variant_type='original' and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$'
        where snapshot.tenant_id=playlist.tenant_id and snapshot.dynamic_slide_id=(operation->>'dynamicSlideId')::uuid and snapshot.id=(operation->>'expectedSnapshotId')::uuid and snapshot.status='ready';
      if not found then raise exception 'dynamic selection has no verified output; nothing added'using errcode='23514';end if;
      result:=public.add_dynamic_slide_to_playlist_v2(playlist.id,(operation->>'dynamicSlideId')::uuid,current_revision,greatest(5,duration),child_key);
      select id into strict item_id from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and not(id=any(before_ids));
      update public.playlist_items set duration_seconds=duration where id=item_id;
      mapping:=mapping||jsonb_build_object(client_id::text,item_id);
    elsif operation->>'operation'='add_youtube' then
      result:=public.add_youtube_source_to_playlist_v1(playlist.id,(operation->>'sourceId')::uuid,current_revision,greatest(5,duration),child_key);
      select id into strict item_id from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and not(id=any(before_ids));
      update public.playlist_items set duration_seconds=duration where id=item_id;
      mapping:=mapping||jsonb_build_object(client_id::text,item_id);
    elsif operation->>'operation'='add_engage' then
      result:=public.add_engage_campaign_to_playlist_v1(playlist.id,(operation->>'campaignId')::uuid,(operation->>'fallbackAssetId')::uuid,current_revision,greatest(5,duration),child_key);
      select id into strict item_id from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and not(id=any(before_ids));
      update public.playlist_items set duration_seconds=duration where id=item_id;
      mapping:=mapping||jsonb_build_object(client_id::text,item_id);
    elsif operation->>'operation'='add_studio_series' then
      select revision into series_revision from public.studio_series where tenant_id=playlist.tenant_id and id=(operation->>'seriesId')::uuid and status='active' for share;
      if series_revision is distinct from (operation->>'expectedSeriesRevision')::bigint then raise exception 'Studio series changed; reload library' using errcode='40001';end if;
      perform project.id from public.studio_series_items member join public.studio_projects project on project.tenant_id=member.tenant_id and project.id=member.project_id join public.studio_project_drafts draft on draft.tenant_id=project.tenant_id and draft.project_id=project.id where member.tenant_id=playlist.tenant_id and member.series_id=(operation->>'seriesId')::uuid order by project.id for share of project,draft;
      child_ids:='[]';series_index:=0;
      if jsonb_typeof(operation->'clientItemIds')is distinct from 'array' or jsonb_array_length(operation->'clientItemIds')not between 1 and 20 or(select count(distinct value)from jsonb_array_elements_text(operation->'clientItemIds'))<>jsonb_array_length(operation->'clientItemIds') then raise exception 'invalid series command identities'using errcode='23514';end if;
      for series_item in select project_id from public.studio_series_items where tenant_id=playlist.tenant_id and series_id=(operation->>'seriesId')::uuid order by sort_order loop
        select export.media_asset_id,coalesce(export.duration_seconds,project.duration_ms/1000.0) as duration_seconds into exported
          from public.studio_projects project join public.studio_project_drafts draft on draft.tenant_id=project.tenant_id and draft.project_id=project.id
          join public.studio_revisions revision on revision.tenant_id=project.tenant_id and revision.project_id=project.id and revision.draft_revision=draft.draft_revision
          join public.studio_exports export on export.tenant_id=revision.tenant_id and export.project_id=revision.project_id and export.revision_id=revision.id
          join public.media_assets asset on asset.tenant_id=export.tenant_id and asset.id=export.media_asset_id
          join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.variant_type::text=case when asset.kind='video' then 'player_1080p' else 'original' end and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$' and variant.checksum_sha256=export.checksum_sha256
          where project.tenant_id=playlist.tenant_id and project.id=series_item.project_id and project.status='active' and asset.status='ready' and asset.deleted_at is null
          order by export.created_at desc limit 1;
        if not found then raise exception 'Studio series has an incomplete current export; nothing added' using errcode='23514';end if;
        select coalesce(array_agg(id),'{}'::uuid[]) into before_ids from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id;
        select to_jsonb(command) into result from public.mutate_playlist_draft_v1(playlist.id,current_revision,'add_item',jsonb_build_object('mediaAssetId',exported.media_asset_id,'durationSeconds',greatest(5,ceil(exported.duration_seconds)::integer),'fitMode','contain','muted',true)) command;
        select id into strict item_id from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and not(id=any(before_ids));
        update public.playlist_items set duration_seconds=greatest(3,ceil(exported.duration_seconds)::integer),fit_mode='contain',muted=true,transition=playlist.default_transition,background_color=playlist.default_background_color where id=item_id;
        client_id:=(operation#>>array['clientItemIds',series_index::text])::uuid;
        if client_id is null or mapping?client_id::text or exists(select 1 from public.playlist_items where id=client_id)then raise exception 'duplicate series command identity'using errcode='23514';end if;
        mapping:=mapping||jsonb_build_object(client_id::text,item_id);series_index:=series_index+1;
        child_ids:=child_ids||jsonb_build_array(item_id);
        select revision into current_revision from public.playlists where id=playlist.id;
      end loop;
      if jsonb_array_length(child_ids)=0 or series_index<>jsonb_array_length(operation->'clientItemIds') then raise exception 'Studio series count changed' using errcode='40001';end if;
    elsif operation->>'operation'='duplicate' then
      result:=public.mutate_playlist_draft_v2(playlist.id,current_revision,'duplicate_item',jsonb_build_object('itemId',item_id),child_key);
      select * into strict item from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and id=item_id;
      select id into strict item_id from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and not(id=any(before_ids));
      -- The established command copies presentation; retain the later source contracts too.
      update public.playlist_items set sites_configuration_json=item.sites_configuration_json,
        dynamic_slide_id=item.dynamic_slide_id,dynamic_snapshot_id=item.dynamic_snapshot_id,dynamic_selection_mode=item.dynamic_selection_mode,
        youtube_source_id=item.youtube_source_id,engage_campaign_id=item.engage_campaign_id where id=item_id;
      mapping:=mapping||jsonb_build_object(client_id::text,item_id);
    elsif operation->>'operation'='replace_media' then
      -- The established guarded replacement preserves every presentation field.
      select * into strict item from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and id=item_id for update;
      if item.dynamic_slide_id is not null or item.youtube_source_id is not null or item.engage_campaign_id is not null then raise exception 'a live binding cannot be replaced by a static render' using errcode='23514';end if;
      perform 1 from public.media_assets asset join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.variant_type::text=case when asset.kind='video' then 'player_1080p' else 'original' end
        where asset.tenant_id=playlist.tenant_id and asset.id=(operation->>'mediaAssetId')::uuid and asset.status='ready' and asset.deleted_at is null and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$';
      if not found then raise exception 'replacement has no verified playback variant' using errcode='23514';end if;
      result:=public.mutate_playlist_draft_v2(playlist.id,current_revision,'replace_item',jsonb_build_object('itemId',item_id,'mediaAssetId',operation->>'mediaAssetId'),child_key);
    elsif operation->>'operation'='replace_fallback' then
      select *into strict item from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and id=item_id for update;
      if ((operation->>'sourceKind'='youtube'and item.youtube_source_id=(operation->>'sourceId')::uuid)or(operation->>'sourceKind'='engage'and item.engage_campaign_id=(operation->>'sourceId')::uuid))is distinct from true or item.dynamic_slide_id is not null then raise exception 'fallback source binding changed'using errcode='23514';end if;
      perform 1 from public.media_assets asset join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.variant_type='original'and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$'
      where asset.tenant_id=playlist.tenant_id and asset.id=(operation->>'mediaAssetId')::uuid and asset.kind='image'and asset.status='ready'and asset.deleted_at is null
        and not exists(select 1 from public.dynamic_slide_snapshots snapshot where snapshot.tenant_id=asset.tenant_id and snapshot.output_media_asset_id=asset.id and snapshot.status='ready');
      if not found then raise exception 'fallback image has no verified playback variant'using errcode='23514';end if;
      result:=public.mutate_playlist_draft_v2(playlist.id,current_revision,'replace_item',jsonb_build_object('itemId',item_id,'mediaAssetId',operation->>'mediaAssetId'),child_key);
    elsif operation->>'operation'='refresh_dynamic' then
      -- This is an explicit authoring choice. Background data refresh never calls it.
      select * into strict item from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and id=item_id for update;
      perform 1 from public.dynamic_slides slide join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id=slide.tenant_id and snapshot.dynamic_slide_id=slide.id and snapshot.id=slide.current_snapshot_id
        join public.media_assets asset on asset.tenant_id=snapshot.tenant_id and asset.id=snapshot.output_media_asset_id and asset.status='ready' and asset.deleted_at is null
        join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.variant_type='original' and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$'
        where slide.tenant_id=playlist.tenant_id and slide.id=item.dynamic_slide_id and slide.status='ready' and snapshot.status='ready' and snapshot.id=(operation->>'expectedSnapshotId')::uuid for share of slide,snapshot;
      if not found then raise exception 'dynamic selection changed; reload library' using errcode='40001';end if;
      update public.playlist_items target set dynamic_snapshot_id=snapshot.id,media_asset_id=snapshot.output_media_asset_id from public.dynamic_slide_snapshots snapshot where target.id=item.id and snapshot.tenant_id=playlist.tenant_id and snapshot.id=(operation->>'expectedSnapshotId')::uuid;
      update public.playlists set status='draft',revision=revision+1,updated_by=actor,updated_at=now() where id=playlist.id;
    elsif operation->>'operation'='remove' then
      select to_jsonb(command) into result from public.mutate_playlist_draft_v1(playlist.id,current_revision,'remove_item',jsonb_build_object('itemId',item_id)) command;
    elsif operation->>'operation'='patch' then
      select * into strict item from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and id=item_id for update;
      patch:=operation->'patch';
      if jsonb_typeof(patch) is distinct from 'object' or patch='{}'::jsonb or exists(select 1 from jsonb_object_keys(patch) key where key not in('durationSeconds','displayTitle','accessibilityName','enabled','muted','fitMode','transition','cropFocusX','cropFocusY','backgroundColor','volumePercent','trimStartSeconds','trimEndSeconds','visibleFrom','visibleUntil','sitesConfiguration')) then raise exception 'unsupported partial item patch' using errcode='22023';end if;
      payload:=jsonb_build_object('itemId',item.id,'durationSeconds',item.duration_seconds,'displayTitle',item.display_title,'accessibilityName',item.accessibility_name,'enabled',item.enabled,'muted',item.muted,'fitMode',item.fit_mode,'transition',item.transition,'cropFocusX',item.crop_focus_x,'cropFocusY',item.crop_focus_y,'backgroundColor',item.background_color,'volumePercent',item.volume_percent,'trimStartSeconds',item.trim_start_seconds,'trimEndSeconds',item.trim_end_seconds,'visibleFrom',item.visible_from,'visibleUntil',item.visible_until)||(patch-'sitesConfiguration');
      duration:=(payload->>'durationSeconds')::integer;
      if duration not between 3 and 3600 then raise exception 'duration outside limits' using errcode='23514';end if;
      result:=public.mutate_playlist_draft_v2(playlist.id,current_revision,'update_item_presentation',jsonb_set(payload,'{durationSeconds}',to_jsonb(greatest(5,duration))),child_key);
      if patch?'sitesConfiguration' and patch->'sitesConfiguration'<>'null'::jsonb then
        if not private.sites_configuration_is_valid_v1(patch->'sitesConfiguration') then raise exception 'placement configuration invalid'using errcode='23514';end if;
        if patch#>>'{sitesConfiguration,schemaVersion}' is distinct from '1' or patch#>>'{sitesConfiguration,rendererVersion}' is distinct from 'sites-v11' or patch#>>'{sitesConfiguration,sourceRevision}' is distinct from 'b1cae899af19fc39908217253094c5240d7359fc' or patch#>>'{sitesConfiguration,themeId}' not in('fieldflow','onzetrots-tv') then raise exception 'placement configuration identity invalid' using errcode='23514';end if;
        perform private.assert_sites_assets_v1(playlist.tenant_id,patch->'sitesConfiguration');
      end if;
      update public.playlist_items set duration_seconds=duration,
        sites_configuration_json=case when patch?'sitesConfiguration' then nullif(patch->'sitesConfiguration','null'::jsonb) else sites_configuration_json end where id=item.id;
    elsif operation->>'operation'='reorder' then
      select coalesce(array_agg(coalesce(nullif(mapping->>value,'')::uuid,value::uuid) order by ordinality),'{}'::uuid[]) into ordered_ids from jsonb_array_elements_text(operation->'itemIds') with ordinality;
      if cardinality(ordered_ids)<>cardinality(before_ids) or cardinality(ordered_ids)<>(select count(distinct id) from unnest(ordered_ids) id) or not(ordered_ids @> before_ids and ordered_ids <@ before_ids) then raise exception 'order must contain each current item exactly once' using errcode='23514';end if;
      select coalesce(max(sort_order),0)+cardinality(ordered_ids)+1 into next_sort from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id;
      update public.playlist_items set sort_order=sort_order+next_sort where tenant_id=playlist.tenant_id and playlist_id=playlist.id;
      update public.playlist_items target set sort_order=ordering.ordinality-1,position_key=ordering.ordinality*1024 from unnest(ordered_ids) with ordinality ordering(id,ordinality) where target.tenant_id=playlist.tenant_id and target.playlist_id=playlist.id and target.id=ordering.id;
      update public.playlists set status='draft',revision=revision+1,updated_by=actor,updated_at=now() where id=playlist.id;
    elsif operation->>'operation'='details' then
      if length(btrim(operation->>'name')) not between 2 and 120 or length(coalesce(operation->>'description',''))>500 then raise exception 'playlist details outside limits' using errcode='23514';end if;
      update public.playlists set name=btrim(operation->>'name'),description=nullif(btrim(operation->>'description'),''),status='draft',revision=revision+1,updated_by=actor,updated_at=now() where id=playlist.id;
    else raise exception 'unsupported playlist batch operation' using errcode='22023';end if;
    if result->>'outcome'='conflict' then raise exception 'playlist batch revision changed; all changes rolled back' using errcode='40001';end if;
    select revision into current_revision from public.playlists where id=playlist.id;
    if (select count(*) from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id)>1000 then raise exception 'playlist item limit exceeded' using errcode='23514';end if;
  end loop;
  return private.complete_publisher_command(playlist.tenant_id,'playlist.batch.v1',p_idempotency_key,request,'playlists',playlist.id,jsonb_build_object('outcome','applied','actualRevision',current_revision,'itemIds',mapping),'publisher.playlist.batch.saved','success');
end $$;
revoke all on function public.mutate_playlist_batch_v1(uuid,bigint,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.mutate_playlist_batch_v1(uuid,bigint,jsonb,uuid) to authenticated;
