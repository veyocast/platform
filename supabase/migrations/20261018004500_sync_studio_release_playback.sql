-- Independent Sync Source identity. Historical Sites columns and released rows
-- remain unchanged; the verified PNG/MP4 remains a complete fallback for old clients.
alter table public.playlist_release_items
 add column sync_studio_presentation_json jsonb,
 add column sync_studio_duration_ms integer;
alter table public.playlist_release_items add constraint playlist_release_items_sync_studio_check check (
 (sync_studio_presentation_json is null and sync_studio_duration_ms is null) or
 (sync_studio_presentation_json is not null and sync_studio_duration_ms is not null
  and sites_studio_presentation_json is null
  and sync_studio_duration_ms between 3000 and 120000
  and jsonb_typeof(sync_studio_presentation_json)='object'
  and sync_studio_presentation_json->>'schemaVersion'='1'
  and sync_studio_presentation_json->>'rendererVersion'='sync-v1'
  and sync_studio_presentation_json->>'sourceRevision'='8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a'
  and pg_catalog.pg_column_size(sync_studio_presentation_json)<=524288)
);

create function private.freeze_sync_studio_release_item_v1()
 returns trigger language plpgsql security definer set search_path='' as $$
declare source_document jsonb;source_checksum text;source_count integer;
 saved_duration integer;page_count integer;
begin
 -- Caller-provided presentation/timing is never trusted or persisted.
 new.sync_studio_presentation_json:=null;new.sync_studio_duration_ms:=null;
 select count(*) into source_count from public.studio_exports export
 where export.tenant_id=new.tenant_id and export.media_asset_id=new.media_asset_id;
 if source_count=0 then return new;end if;
 if source_count<>1 then raise exception 'Studio export identity is ambiguous' using errcode='23514';end if;
 select revision.document_json,export.checksum_sha256 into source_document,source_checksum
 from public.studio_exports export join public.studio_revisions revision
  on revision.tenant_id=export.tenant_id and revision.project_id=export.project_id and revision.id=export.revision_id
 where export.tenant_id=new.tenant_id and export.media_asset_id=new.media_asset_id;
 if source_document is null or source_checksum is distinct from new.checksum_sha256 then
  raise exception 'Studio export checksum does not match the release' using errcode='23514';end if;
 if not(source_document?'syncPresentation') then return new;end if;
 perform private.assert_sync_slide_v1(new.tenant_id,source_document->'syncPresentation');
 if source_document?'sitesPresentation' then raise exception 'Sync document composition invalid' using errcode='23514';end if;
 saved_duration:=(source_document#>>'{motion,durationMs}')::integer;
 page_count:=case when source_document#>>'{syncPresentation,family}'='rss'
  then greatest(1,jsonb_array_length(source_document#>'{syncPresentation,news}'))
  else greatest(1,ceil(jsonb_array_length(source_document#>'{syncPresentation,rows}')::numeric/(source_document#>>'{syncPresentation,rowsPerPage}')::integer)::integer) end;
 if saved_duration is null or saved_duration not between 3000 and 120000 or saved_duration < 3000*page_count
  or new.duration_seconds*1000 < saved_duration then
  raise exception 'Sync release duration does not cover every saved page' using errcode='23514';end if;
 if new.trim_start_seconds>0 or (new.trim_end_seconds is not null and new.trim_end_seconds*1000<saved_duration) then
  raise exception 'Sync release trim does not cover every saved page' using errcode='23514';end if;
 new.sync_studio_presentation_json:=source_document->'syncPresentation';
 new.sync_studio_duration_ms:=saved_duration;
 return new;
end;$$;
revoke all on function private.freeze_sync_studio_release_item_v1() from public,anon,authenticated,service_role;
create trigger playlist_release_items_freeze_sync_studio before insert on public.playlist_release_items
 for each row execute function private.freeze_sync_studio_release_item_v1();
comment on column public.playlist_release_items.sync_studio_presentation_json is
 'S226 independent Sync V1 presentation frozen from the same tenant-scoped immutable export as its verified complete raster/video fallback. Never supplied markup or a mutable draft.';
comment on column public.playlist_release_items.sync_studio_duration_ms is
 'Original immutable Source loop duration. Placement may extend but cannot shorten the complete saved page sequence.';
