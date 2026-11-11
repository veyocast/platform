create or replace function private.assert_menu_dom_presentation_v2(
  p_snapshot public.dynamic_slide_snapshots,
  p_presentation jsonb
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  doc jsonb := p_snapshot.snapshot_data_json -> 'menuDocument';
  config jsonb;
  ref jsonb;
  asset_id uuid;
  seconds integer;
  pages integer;
begin
  config := coalesce(p_snapshot.snapshot_data_json -> 'sitesConfiguration', doc -> 'sitesConfiguration');
  if p_snapshot.snapshot_data_json -> 'syncPlaybackProtocol' is distinct from '2'::jsonb
    or p_snapshot.snapshot_data_json ? 'syncConfiguration'
    or doc ->> 'schemaVersion' is distinct from 'menu-document.v2'
    or p_presentation ->> 'kind' is distinct from 'dynamic'
    or config ->> 'provider' is distinct from 'menu'
    or config -> 'menuWidgets' is distinct from 'true'::jsonb
    or (p_presentation -> 'configuration' @> config) is not true
    or p_presentation #>> '{content,kind}' is distinct from 'kantine'
    or coalesce(p_presentation #>> '{configuration,rendererVersion}', '') not in ('sites-v11', 'sites-v17')
    or jsonb_typeof(p_presentation #> '{content,menuPages}') is distinct from 'array'
    or coalesce(config ->> 'seconds', '') !~ '^[0-9]{1,3}$'
  then
    raise exception 'invalid Menu DOM presentation' using errcode = '23514';
  end if;
  perform private.validate_menu_document_v2(p_snapshot.tenant_id, p_snapshot.data_source_id, doc);
  pages := jsonb_array_length(p_presentation #> '{content,menuPages}');
  seconds := (config ->> 'seconds')::integer;
  if pages not between 1 and 100 or seconds not between 3 and 120 or pages * seconds > 3600 then
    raise exception 'Menu DOM duration bounds' using errcode = '23514';
  end if;
  for ref in select value from jsonb_path_query(p_presentation, 'lax $.** ? (@.kind == "tenant")') value loop
    if coalesce(ref ->> 'mediaAssetId', '') !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
      or coalesce(ref ->> 'checksumSha256', '') !~ '^[a-f0-9]{64}$'
    then
      raise exception 'invalid Menu DOM asset' using errcode = '23514';
    end if;
    asset_id := (ref ->> 'mediaAssetId')::uuid;
    if not (
      exists (
        select 1 from public.media_assets asset
        where asset.tenant_id = p_snapshot.tenant_id and asset.id = asset_id
          and asset.kind = 'image' and asset.status = 'ready' and asset.deleted_at is null
          and exists (
            select 1 from public.media_variants variant
            where variant.tenant_id = asset.tenant_id and variant.asset_id = asset.id
              and variant.checksum_sha256 = ref ->> 'checksumSha256'
          )
      )
      or (
        coalesce(p_snapshot.snapshot_data_json #>> '{brand,logoMediaAssetId}', '') = asset_id::text
        and exists (
          select 1 from public.provider_asset_versions asset
          where asset.id = asset_id and asset.checksum_sha256 = ref ->> 'checksumSha256'
            and asset.mime_type like 'image/%'
        )
      )
    ) or not coalesce((
      asset_id in (select private.collect_menu_asset_ids_v2(doc))
      or config #>> '{background,mediaAssetId}' = asset_id::text
      or p_snapshot.snapshot_data_json #>> '{brand,logoMediaAssetId}' = asset_id::text
    ), false) then
      raise exception 'Menu DOM asset authority mismatch' using errcode = '23514';
    end if;
  end loop;
  return pages * seconds * 1000;
end;
$$;

revoke all on function private.assert_menu_dom_presentation_v2(public.dynamic_slide_snapshots,jsonb)
  from public,anon,authenticated,service_role;
