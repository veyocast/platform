-- Filter on current verified member exports before pagination; load documents for only eight series.
create function public.list_publisher_studio_series_v1(p_tenant_id uuid,p_offset integer default 0,p_search text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can_read_studio(p_tenant_id) then raise exception 'actor cannot read Studio library'using errcode='42501';end if;
 if p_offset is null or p_offset not between 0 and 10000 or length(coalesce(p_search,''))>160 then raise exception 'library filters outside limits'using errcode='22023';end if;
 with matching as materialized(select series.id,series.name,series.revision,series.updated_at from public.studio_series series
   where series.tenant_id=p_tenant_id and series.status='active' and (nullif(btrim(p_search),'')is null or position(lower(btrim(p_search))in lower(series.name))>0)
   and exists(select 1 from public.studio_series_items member where member.tenant_id=p_tenant_id and member.series_id=series.id)
   and not exists(select 1 from public.studio_series_items member
     where member.tenant_id=p_tenant_id and member.series_id=series.id and not exists(
       select 1 from public.studio_projects project
       join public.studio_project_drafts draft on draft.tenant_id=project.tenant_id and draft.project_id=project.id
       join public.studio_revisions revision on revision.tenant_id=project.tenant_id and revision.project_id=project.id and revision.draft_revision=draft.draft_revision
       join public.studio_exports exported on exported.tenant_id=revision.tenant_id and exported.project_id=revision.project_id and exported.revision_id=revision.id
       join public.media_assets asset on asset.tenant_id=exported.tenant_id and asset.id=exported.media_asset_id and asset.status='ready' and asset.deleted_at is null
       join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id
         and variant.variant_type::text=case when asset.kind='video' then 'player_1080p' else 'original' end
         and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$' and variant.checksum_sha256=exported.checksum_sha256
       where project.tenant_id=member.tenant_id and project.id=member.project_id and project.status='active'
     ))),
 page as(select * from matching order by updated_at desc,id limit 8 offset p_offset),
 rows as(select page.*,coalesce((select jsonb_agg(jsonb_build_object('projectId',project.id,'name',project.name,'document',draft.document_json,
   'exportId',exported.id,'mediaAssetId',exported.media_asset_id,'outputKind',exported.output_kind,'durationSeconds',exported.duration_seconds)order by member.sort_order)
   from public.studio_series_items member
   join public.studio_projects project on project.tenant_id=member.tenant_id and project.id=member.project_id and project.status='active'
   join public.studio_project_drafts draft on draft.tenant_id=project.tenant_id and draft.project_id=project.id
   join lateral(select export.* from public.studio_revisions revision
     join public.studio_exports export on export.tenant_id=revision.tenant_id and export.project_id=revision.project_id and export.revision_id=revision.id
     join public.media_assets asset on asset.tenant_id=export.tenant_id and asset.id=export.media_asset_id and asset.status='ready' and asset.deleted_at is null
     join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.variant_type::text=case when asset.kind='video' then 'player_1080p' else 'original' end
       and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$' and variant.checksum_sha256=export.checksum_sha256
     where revision.tenant_id=project.tenant_id and revision.project_id=project.id and revision.draft_revision=draft.draft_revision
     order by export.created_at desc,export.id desc limit 1)exported on true
   where member.tenant_id=p_tenant_id and member.series_id=page.id),'[]'::jsonb)as members,
   (select count(*)from public.studio_series_items member where member.tenant_id=p_tenant_id and member.series_id=page.id)as member_count from page)
 select jsonb_build_object('total',(select count(*)from matching),'series',coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'revision',revision,'members',members)order by updated_at desc,id)
   filter(where member_count>0 and jsonb_array_length(members)=member_count),'[]'::jsonb))into result from rows;
 return result;
end $$;
revoke all on function public.list_publisher_studio_series_v1(uuid,integer,text)from public,anon,authenticated,service_role;
grant execute on function public.list_publisher_studio_series_v1(uuid,integer,text)to authenticated;

-- Extend established authoring snapshots rather than reconstructing their rich fields.
alter function private.build_playlist_authoring_snapshot(uuid)rename to build_playlist_authoring_snapshot_before_sites_v11;
create function private.build_playlist_authoring_snapshot(p_playlist_id uuid)returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_set(snapshot,'{items}',coalesce((select jsonb_agg(document||jsonb_build_object(
   'sitesConfiguration',item.sites_configuration_json,'dynamicSlideId',item.dynamic_slide_id,'dynamicSnapshotId',item.dynamic_snapshot_id,'dynamicSelectionMode',item.dynamic_selection_mode,
   'youtubeSourceId',item.youtube_source_id,'engageCampaignId',item.engage_campaign_id)order by ordinality)
   from jsonb_array_elements(snapshot->'items')with ordinality as documents(document,ordinality)
   join public.playlist_items item on item.playlist_id=p_playlist_id and item.id=(document->>'sourceItemId')::uuid),'[]'::jsonb))
 from(select private.build_playlist_authoring_snapshot_before_sites_v11(p_playlist_id)as snapshot)original;
$$;
revoke all on function private.build_playlist_authoring_snapshot(uuid),private.build_playlist_authoring_snapshot_before_sites_v11(uuid)from public,anon,authenticated,service_role;

alter function public.duplicate_playlist_draft_v1(uuid,text)rename to duplicate_playlist_draft_before_sites_v11;
create function public.duplicate_playlist_draft_v1(p_source_playlist_id uuid,p_name text default null)returns uuid
language plpgsql security definer set search_path='' as $$
declare copied uuid;source_tenant uuid;
begin
 select tenant_id into source_tenant from public.playlists where id=p_source_playlist_id for share;
 if not found or not private.can_write_playlist(source_tenant)then raise exception 'actor cannot duplicate this playlist'using errcode='42501';end if;
 perform private.require_active_tenant_command(source_tenant);
 copied:=public.duplicate_playlist_draft_before_sites_v11(p_source_playlist_id,p_name);
 update public.playlists target set default_image_duration_seconds=source.default_image_duration_seconds,default_transition=source.default_transition,
   default_fit_mode=source.default_fit_mode,default_background_color=source.default_background_color,default_video_muted=source.default_video_muted,loop_enabled=source.loop_enabled
 from public.playlists source where target.id=copied and source.id=p_source_playlist_id and source.tenant_id=target.tenant_id;
 insert into public.playlist_sections(tenant_id,playlist_id,name,position_key,enabled,default_duration_seconds,default_transition,created_by,updated_by)
 select tenant_id,copied,name,position_key,enabled,default_duration_seconds,default_transition,private.current_user_id(),private.current_user_id()
 from public.playlist_sections where tenant_id=source_tenant and playlist_id=p_source_playlist_id order by position_key;
 update public.playlist_items set position_key=position_key+(select coalesce(max(abs(position_key)),0)+1024 from public.playlist_items where playlist_id in(copied,p_source_playlist_id))where tenant_id=source_tenant and playlist_id=copied;
 update public.playlist_items target set position_key=source.position_key,section_id=target_section.id,display_title=source.display_title,transition=source.transition,
   crop_focus_x=source.crop_focus_x,crop_focus_y=source.crop_focus_y,background_color=source.background_color,volume_percent=source.volume_percent,
   trim_start_seconds=source.trim_start_seconds,trim_end_seconds=source.trim_end_seconds,visible_from=source.visible_from,visible_until=source.visible_until,
   enabled=source.enabled,accessibility_name=source.accessibility_name,sites_configuration_json=source.sites_configuration_json,
   dynamic_slide_id=source.dynamic_slide_id,dynamic_snapshot_id=source.dynamic_snapshot_id,dynamic_selection_mode=source.dynamic_selection_mode,
   youtube_source_id=source.youtube_source_id,engage_campaign_id=source.engage_campaign_id
 from public.playlist_items source
 left join public.playlist_sections source_section on source_section.tenant_id=source.tenant_id and source_section.playlist_id=source.playlist_id and source_section.id=source.section_id
 left join public.playlist_sections target_section on target_section.tenant_id=source.tenant_id and target_section.playlist_id=copied and target_section.position_key=source_section.position_key
 where source.playlist_id=p_source_playlist_id and target.playlist_id=copied and source.tenant_id=target.tenant_id and source.sort_order=target.sort_order;
 return copied;
end $$;
revoke all on function public.duplicate_playlist_draft_before_sites_v11(uuid,text),public.duplicate_playlist_draft_v1(uuid,text)from public,anon,authenticated,service_role;
grant execute on function public.duplicate_playlist_draft_v1(uuid,text)to authenticated;

alter function public.restore_playlist_release_to_draft_v1(uuid,bigint,uuid)rename to restore_playlist_release_to_draft_before_sites_v11;
create function public.restore_playlist_release_to_draft_v1(p_release_id uuid,p_expected_revision bigint,p_idempotency_key uuid)returns jsonb
language plpgsql security definer set search_path='' as $$
declare release public.playlist_releases%rowtype;result jsonb;request jsonb;replay jsonb;snapshot jsonb;
begin
 select * into release from public.playlist_releases where id=p_release_id;
 if not found or not private.can_write_playlist(release.tenant_id)then raise exception 'actor cannot restore this release'using errcode='42501';end if;
 perform private.require_active_tenant_command(release.tenant_id);
 perform 1 from public.playlists where tenant_id=release.tenant_id and id=release.playlist_id for update;
 request:=jsonb_build_object('releaseId',p_release_id,'expectedRevision',p_expected_revision);
 replay:=private.begin_publisher_command(release.tenant_id,'playlist.release.restore_sites_v1',p_idempotency_key,request);
 if replay is not null then return replay;end if;
 result:=public.restore_playlist_release_to_draft_before_sites_v11(p_release_id,p_expected_revision,md5(p_idempotency_key::text||':legacy-restore')::uuid);
 if result->>'outcome'='restored' then
   select snapshot_json into snapshot from public.playlist_release_authoring_snapshots where tenant_id=release.tenant_id and release_id=release.id;
   snapshot:=coalesce(snapshot,private.build_playlist_authoring_snapshot_before_sites_v11(release.playlist_id));
   update public.playlist_items target set sites_configuration_json=coalesce(nullif(document->'sitesConfiguration','null'::jsonb),frozen.sites_configuration_json),
     dynamic_slide_id=coalesce(nullif(document->>'dynamicSlideId','')::uuid,frozen_snapshot.dynamic_slide_id),dynamic_snapshot_id=coalesce(nullif(document->>'dynamicSnapshotId','')::uuid,frozen.dynamic_snapshot_id),
     dynamic_selection_mode=coalesce(nullif(document->>'dynamicSelectionMode',''),case when frozen_snapshot.dynamic_slide_id is not null then case when frozen.live_data_enabled then 'latest'else 'pinned'end end),
     youtube_source_id=coalesce(nullif(document->>'youtubeSourceId','')::uuid,frozen.youtube_source_id),engage_campaign_id=coalesce(nullif(document->>'engageCampaignId','')::uuid,frozen.engage_campaign_id)
   from jsonb_array_elements(coalesce(snapshot->'items','[]'::jsonb))document
   left join public.playlist_release_items frozen on frozen.tenant_id=release.tenant_id and frozen.release_id=release.id and frozen.sort_order=(document->>'sortOrder')::integer and frozen.media_asset_id=(document->>'mediaAssetId')::uuid
   left join public.dynamic_slide_snapshots frozen_snapshot on frozen_snapshot.tenant_id=frozen.tenant_id and frozen_snapshot.id=frozen.dynamic_snapshot_id
   where target.tenant_id=release.tenant_id and target.playlist_id=release.playlist_id and target.position_key=(document->>'positionKey')::numeric;
 end if;
 return private.complete_publisher_command(release.tenant_id,'playlist.release.restore_sites_v1',p_idempotency_key,request,'playlists',release.playlist_id,result,'publisher.playlist.sites_restore',case when result->>'outcome'='restored'then 'success'else 'failed'end);
end $$;
revoke all on function public.restore_playlist_release_to_draft_before_sites_v11(uuid,bigint,uuid),public.restore_playlist_release_to_draft_v1(uuid,bigint,uuid)from public,anon,authenticated,service_role;
grant execute on function public.restore_playlist_release_to_draft_v1(uuid,bigint,uuid)to authenticated;

-- An existing template keeps its complete stored authoring contract on instantiation.
alter function public.instantiate_tenant_playlist_template_v1(uuid,text,uuid)rename to instantiate_tenant_playlist_template_before_sites_v11;
create function public.instantiate_tenant_playlist_template_v1(p_template_id uuid,p_name text,p_idempotency_key uuid)returns jsonb
language plpgsql security definer set search_path='' as $$
declare template public.tenant_playlist_templates%rowtype;result jsonb;request jsonb;replay jsonb;copied uuid;
begin
 select *into template from public.tenant_playlist_templates where id=p_template_id and status='active';
 if not found or not private.can_write_playlist(template.tenant_id)then raise exception 'actor cannot instantiate tenant templates'using errcode='42501';end if;
 perform private.require_active_tenant_command(template.tenant_id);
 request:=jsonb_build_object('templateId',p_template_id,'name',p_name);
 replay:=private.begin_publisher_command(template.tenant_id,'tenant_template.instantiate_sites_v1',p_idempotency_key,request);if replay is not null then return replay;end if;
 result:=public.instantiate_tenant_playlist_template_before_sites_v11(p_template_id,p_name,md5(p_idempotency_key::text||':legacy-template')::uuid);
 if result->>'outcome'='created'then
   copied:=(result->>'playlistId')::uuid;
   update public.playlist_items target set sites_configuration_json=nullif(document->'sitesConfiguration','null'::jsonb),
     dynamic_slide_id=nullif(document->>'dynamicSlideId','')::uuid,dynamic_snapshot_id=nullif(document->>'dynamicSnapshotId','')::uuid,
     dynamic_selection_mode=nullif(document->>'dynamicSelectionMode',''),
     youtube_source_id=nullif(document->>'youtubeSourceId','')::uuid,engage_campaign_id=nullif(document->>'engageCampaignId','')::uuid
   from jsonb_array_elements(template.snapshot_json->'items')document
   where target.tenant_id=template.tenant_id and target.playlist_id=copied and target.position_key=(document->>'positionKey')::numeric;
 end if;
 return private.complete_publisher_command(template.tenant_id,'tenant_template.instantiate_sites_v1',p_idempotency_key,request,'playlists',copied,result,'publisher.template.sites_instantiated','success');
end $$;
revoke all on function public.instantiate_tenant_playlist_template_before_sites_v11(uuid,text,uuid),public.instantiate_tenant_playlist_template_v1(uuid,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.instantiate_tenant_playlist_template_v1(uuid,text,uuid)to authenticated;

create or replace function private.resolve_dynamic_playlist_item_provenance()returns trigger
language plpgsql security definer set search_path='' as $$
declare resolved record;explicit_binding boolean;
begin
 explicit_binding:=new.dynamic_slide_id is not null or new.dynamic_snapshot_id is not null or new.dynamic_selection_mode is not null;
 if tg_op='UPDATE'then
   if new.media_asset_id is distinct from old.media_asset_id and new.dynamic_slide_id is not distinct from old.dynamic_slide_id and new.dynamic_snapshot_id is not distinct from old.dynamic_snapshot_id and new.dynamic_selection_mode is not distinct from old.dynamic_selection_mode then explicit_binding:=false;end if;
 end if;
 if explicit_binding then
   perform 1 from public.dynamic_slide_snapshots snapshot where snapshot.tenant_id=new.tenant_id and snapshot.id=new.dynamic_snapshot_id and snapshot.dynamic_slide_id=new.dynamic_slide_id and snapshot.output_media_asset_id=new.media_asset_id and snapshot.status='ready';
   if not found or new.dynamic_selection_mode is null or new.dynamic_selection_mode not in('latest','pinned')then raise exception 'reviewed dynamic placement provenance is invalid'using errcode='23514';end if;
   return new;
 end if;
 select snapshot.id,snapshot.dynamic_slide_id,slide.selection_mode into resolved
 from public.dynamic_slide_snapshots snapshot join public.dynamic_slides slide on slide.tenant_id=snapshot.tenant_id and slide.id=snapshot.dynamic_slide_id
 where snapshot.tenant_id=new.tenant_id and snapshot.output_media_asset_id=new.media_asset_id and snapshot.status='ready'
 order by(slide.current_snapshot_id=snapshot.id)desc,snapshot.completed_at desc nulls last,snapshot.created_at desc,snapshot.id desc limit 1;
 new.dynamic_slide_id:=resolved.dynamic_slide_id;new.dynamic_snapshot_id:=resolved.id;new.dynamic_selection_mode:=resolved.selection_mode;
 return new;
end $$;
revoke all on function private.resolve_dynamic_playlist_item_provenance()from public,anon,authenticated,service_role;
