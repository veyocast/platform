-- Source YouTube uses only an existing verified, active tenant source. Its
-- canonical URL is a binding, never proof of provider validation by itself.
create function private.sync_youtube_source_id_v1(p_tenant_id uuid,p_url text)returns uuid
language sql stable security definer set search_path='' as $$
 select source.id from public.youtube_sources source where source.tenant_id=p_tenant_id
  and source.status='active'and source.validation_status='verified'and source.embeddable
  and private.tenant_feature_enabled_v1(p_tenant_id,'youtube_integration')
  and p_url=case when source.playlist_id is null then'https://www.youtube.com/watch?v='||source.video_id
   else'https://www.youtube.com/playlist?list='||source.playlist_id end;
$$;
alter function private.assert_sync_slide_v1(uuid,jsonb)rename to assert_sync_slide_before_youtube_v1;
create function private.assert_sync_slide_v1(p_tenant_id uuid,p_slide jsonb)returns void
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.assert_sync_slide_before_youtube_v1(p_tenant_id,p_slide);
 if p_slide->>'family'='youtube'and p_slide?'youtubeUrl'and private.sync_youtube_source_id_v1(p_tenant_id,p_slide->>'youtubeUrl')is null
 then raise exception 'Source video requires an active verified own YouTube source'using errcode='42501';end if;
end;$$;
revoke all on function private.sync_youtube_source_id_v1(uuid,text),private.assert_sync_slide_before_youtube_v1(uuid,jsonb),private.assert_sync_slide_v1(uuid,jsonb)from public,anon,authenticated,service_role;

create function private.assert_sync_youtube_release_binding_v1()returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.sync_studio_presentation_json->>'family'='youtube'and new.sync_studio_presentation_json?'youtubeUrl'and(
  new.youtube_source_id is null or(new.sync_studio_presentation_json->>'youtubeUrl')is distinct from
   case when new.youtube_playlist_id is null then'https://www.youtube.com/watch?v='||new.youtube_video_id
    else'https://www.youtube.com/playlist?list='||new.youtube_playlist_id end)
 then raise exception 'Source export does not match its immutable YouTube binding'using errcode='23514';end if;
 return new;
end;$$;
revoke all on function private.assert_sync_youtube_release_binding_v1()from public,anon,authenticated,service_role;
create trigger zzzz_sync_youtube_release_binding before insert on public.playlist_release_items
 for each row execute function private.assert_sync_youtube_release_binding_v1();

-- Reuse the existing atomic batch and child receipt. The existing image path
-- remains valid; video is admitted only for a verified Source YouTube export.
-- Source fallback belongs to the placement and never overwrites the source.
do $migration$
declare definition text;old_branch text:=$old$      perform 1 from public.media_assets asset join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.variant_type='original'and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$'
      where asset.tenant_id=playlist.tenant_id and asset.id=(operation->>'mediaAssetId')::uuid and asset.kind='image'and asset.status='ready'and asset.deleted_at is null
        and not exists(select 1 from public.dynamic_slide_snapshots snapshot where snapshot.tenant_id=asset.tenant_id and snapshot.output_media_asset_id=asset.id and snapshot.status='ready');
$old$;new_branch text:=$new$      perform 1 from public.media_assets asset join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id
       and variant.variant_type::text=case when asset.kind='video' then 'player_1080p' else 'original' end
       and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$'
      where asset.tenant_id=playlist.tenant_id and asset.id=(operation->>'mediaAssetId')::uuid and asset.status='ready'and asset.deleted_at is null
       and(asset.kind='image'or(asset.kind='video'and exists(
        select 1 from public.studio_exports source_export join public.studio_revisions revision on revision.tenant_id=source_export.tenant_id and revision.id=source_export.revision_id
        where source_export.tenant_id=asset.tenant_id and source_export.media_asset_id=asset.id and source_export.output_kind='mp4'
         and source_export.checksum_sha256=variant.checksum_sha256 and revision.document_json#>>'{syncPresentation,family}'='youtube'
         and revision.document_json#>>'{syncPresentation,rendererVersion}'='sync-v1')))
       and not exists(select 1 from public.dynamic_slide_snapshots snapshot where snapshot.tenant_id=asset.tenant_id and snapshot.output_media_asset_id=asset.id and snapshot.status='ready');
$new$;
begin
 select pg_get_functiondef('public.mutate_playlist_batch_v1(uuid,bigint,jsonb,uuid)'::regprocedure)into definition;
 if(length(definition)-length(replace(definition,old_branch,'')))/length(old_branch)<>1
 then raise exception 'Source YouTube fallback precondition failed';end if;
 execute replace(definition,old_branch,new_branch);
end;$migration$;
notify pgrst,'reload schema';
