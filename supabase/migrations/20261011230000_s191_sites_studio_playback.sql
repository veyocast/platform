-- Freeze trusted Studio content from the immutable export revision at publication.
-- Existing releases keep their original PNG/MP4 playback; no data refresh writes here.
alter table public.playlist_release_items
 add column sites_studio_presentation_json jsonb;
alter table public.playlist_release_items
 add constraint playlist_release_items_sites_studio_presentation_check check (
  sites_studio_presentation_json is null or (
   jsonb_typeof(sites_studio_presentation_json)='object'
   and sites_studio_presentation_json->>'kind'='studio'
   and sites_studio_presentation_json->>'schemaVersion'='1'
   and sites_studio_presentation_json->>'rendererVersion'='sites-v11'
   and sites_studio_presentation_json->>'sourceRevision'='b1cae899af19fc39908217253094c5240d7359fc'
   and pg_catalog.pg_column_size(sites_studio_presentation_json)<=524288
  )
 );
create index studio_exports_tenant_media_lookup_idx
 on public.studio_exports(tenant_id,media_asset_id);

create function private.freeze_sites_studio_release_item_v1()
 returns trigger language plpgsql security definer set search_path='' as $$
declare source_document jsonb;source_checksum text;source_count integer;
begin
 -- Never trust a supplied JSON document. It is derived from the verified export.
 new.sites_studio_presentation_json:=null;
 select count(*) into source_count from public.studio_exports export
 where export.tenant_id=new.tenant_id and export.media_asset_id=new.media_asset_id;
 if source_count=0 then return new;end if;
 if source_count<>1 then
  raise exception 'Studio export identity is ambiguous' using errcode='23514';
 end if;
 select revision.document_json,export.checksum_sha256
 into source_document,source_checksum
 from public.studio_exports export
 join public.studio_revisions revision on revision.tenant_id=export.tenant_id
  and revision.project_id=export.project_id and revision.id=export.revision_id
 where export.tenant_id=new.tenant_id and export.media_asset_id=new.media_asset_id;
 if source_document is null or source_checksum is distinct from new.checksum_sha256 then
  raise exception 'Studio export checksum does not match the release' using errcode='23514';
 end if;
 if source_document?'sitesPresentation' then
  perform private.assert_sites_studio_v1(new.tenant_id,source_document);
  new.sites_studio_presentation_json:=source_document->'sitesPresentation';
 end if;
 return new;
end;$$;
revoke all on function private.freeze_sites_studio_release_item_v1()
 from public,anon,authenticated,service_role;
create trigger playlist_release_items_freeze_sites_studio
 before insert on public.playlist_release_items
 for each row execute function private.freeze_sites_studio_release_item_v1();
comment on column public.playlist_release_items.sites_studio_presentation_json is
 'S191 canonical Sites Studio presentation frozen from the tenant-scoped immutable export revision, never a mutable project or supplied HTML. Tenant image UUID/SHA identities remain frozen; Players verify the complete asset union before activation.';
