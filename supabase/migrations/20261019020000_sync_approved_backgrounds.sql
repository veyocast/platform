-- S238: the six approved photographs are background-only. The original
-- structural/tenant/privacy checks and YouTube/Engage wrappers are retained.
-- No public API, row, release, policy or asset is rewritten.
create or replace function private.assert_sync_slide_before_youtube_v1(p_tenant_id uuid,p_slide jsonb) returns void
language plpgsql stable security definer set search_path='' as $$
declare
 ref jsonb;
 asset_role text;
 link text;
 choices integer;
 manifest constant jsonb:=$sync_manifest${"/assets/brand-hero-1254.webp":"7badc69cca88b8bf9fbd770fb35e345108570318cf7d56e2f674813b8db5554a","/assets/brand-hero-480.webp":"fc6ff477c5ffaf8d220f2142d16b5e7a8e4cb5f88505ae03567b1678d052a007","/assets/brand-hero-800.webp":"f766151d506cd103fc83ab1597a73952be360f9040cc70b4dfa0a1f3b85ae656","/assets/brand-hero.png":"3997e2d0c033636cba036749d0f771112122488b8992b75177ebeb384a5fddc0","/assets/brand-icon.svg":"dc63b70f43d4f721c5f87d51c64f9f5660a6aa22c69f9245f3f4d711113c0fd3","/assets/clubmuur-wall.webp":"fccf75c498bc84ea4c8d3febafa1645e065be047f470ba66671cfb6a51517310","/assets/full-dark.svg":"bb6075cfa4436f1ed8f8b3f41c29b41f53e1c12bcc76b62f4f14420846236e43","/assets/full-light.svg":"877dac00409543e4699c39116b508ad5096e2f2fd3b361d32ae674044c9fef9e"}$sync_manifest$::jsonb;
 backgrounds constant jsonb:=$backgrounds${"/onzetrots/website-brush/de-wijk-wide-1672.webp":"d7198cf38780978b142c15c6cbc33f196afe1d77016582495438daf903c4234e","/onzetrots/website-brush/houtrust-wide-1672.webp":"4e654df31f432c922a44b1670f6bf8d64af3361d40645f410de0a4d696d46171","/onzetrots/website-brush/aan-zee-portrait-941.webp":"446eeeaa84b0e032d34fa6aac10615716d4927917bf9258d245ddad0ebc347d6","/onzetrots/website-brush/de-wijk-portrait-941.webp":"a9aab1cb20cbd4abcf92ed90463d8e50a2a67c4cf1637bd2cdeb55dbd265ae70","/onzetrots/website-brush/houtrust-portrait-941.webp":"e96a079d1a96f3ca75305329431065d2c61b7f3548735f48811bb57d34be4a14","/onzetrots/website-brush/aan-zee-wide-1672.webp":"ab1df0dd01e1f5ed768e099897377e12b92b85c2856eb80c48c7a06416ece3ae"}$backgrounds$::jsonb;
begin
 if p_slide is null or pg_catalog.pg_column_size(p_slide)>524288
  or not extensions.jsonb_matches_schema(private.sync_slide_schema_v1(),p_slide)
 then raise exception 'Sync slide structure invalid' using errcode='23514';end if;

 -- Reuse the established ready/original/checksum/tenant validation, without
 -- broadening its frozen Sites system-image allowlist.
 for asset_role,ref in select item.role,item.asset from(values
  ('background',p_slide#>'{style,backgroundAsset}'),
  ('logo',p_slide#>'{club,logo}'),('logo',p_slide#>'{home,logo}'),('logo',p_slide#>'{away,logo}')
 )item(role,asset)where item.asset is not null loop
  if ref->>'kind'='system' then
   if manifest->>(ref->>'path') is distinct from ref->>'checksumSha256'
    and (asset_role<>'background'or p_slide#>>'{style,background}'<>'photo'or backgrounds->>(ref->>'path') is distinct from ref->>'checksumSha256')
   then raise exception 'Sync system asset identity invalid' using errcode='23514';end if;
  else perform private.assert_sites_assets_v1(p_tenant_id,ref);end if;
 end loop;
 if p_slide#>>'{style,background}'='photo' and not(p_slide->'style'?'backgroundAsset')
 then raise exception 'Sync photo background missing' using errcode='23514';end if;
 if exists(select 1 from pg_catalog.jsonb_array_elements_text(p_slide->'ownRowIndexes') item where item.value::integer>=pg_catalog.jsonb_array_length(p_slide->'rows'))
 then raise exception 'Sync own row missing' using errcode='23514';end if;
 if p_slide?'poll' and p_slide->>'family'<>'engage'
 then raise exception 'Sync poll family invalid' using errcode='23514';end if;

 -- JSON Schema cannot express the canonical URL and poll-privacy refinements.
 for link in
  select item->>'url' from pg_catalog.jsonb_array_elements(p_slide->'news') item where item?'url'
  union all select p_slide#>>'{poll,publicUrl}' where p_slide#>'{poll,publicUrl}' is not null
  union all select p_slide->>'youtubeUrl' where p_slide?'youtubeUrl'
 loop
  if link!~*'^https://[^/?#[:space:]@]+([/?#][^[:space:]]*)?$'
  then raise exception 'Sync public URL invalid' using errcode='23514';end if;
 end loop;
 if p_slide?'youtubeUrl' and p_slide->>'youtubeUrl'!~*'^https://(www\.)?(youtube\.com|youtu\.be)(:443)?([/?#]|$)'
 then raise exception 'Sync video origin invalid' using errcode='23514';end if;
 if p_slide?'poll' then
  select count(distinct(item->>'id')::uuid) into choices from pg_catalog.jsonb_array_elements(p_slide#>'{poll,options}') item;
  if choices<>pg_catalog.jsonb_array_length(p_slide#>'{poll,options}')
  then raise exception 'Sync poll choice identity repeated' using errcode='23514';end if;
  if not((p_slide#>>'{poll,visibility}'='live' and p_slide#>>'{poll,status}' in('live','closed','archived')) or(p_slide#>>'{poll,status}' in('closed','archived') and p_slide#>>'{poll,visibility}'='after_close'))
   and exists(select 1 from pg_catalog.jsonb_array_elements(p_slide#>'{poll,options}') item where(item->>'votes')::bigint<>0)
  then raise exception 'Sync nonpublic votes forbidden' using errcode='23514';end if;
 end if;
end;$$;


create or replace function private.assert_sync_dynamic_render_presentation_v1(p_snapshot public.dynamic_slide_snapshots,p_presentation jsonb)returns void
language plpgsql stable security definer set search_path='' as $$
declare
 seed jsonb:=p_snapshot.snapshot_data_json#>'{syncConfiguration,seed}';
 clean jsonb:=p_presentation#-'{club,logo}'#-'{home,logo}'#-'{away,logo}'#-'{style,backgroundAsset}';
 ref jsonb;reference_asset_id uuid;asset_role text;
begin
 if p_presentation is null or pg_column_size(p_presentation)>524288
  or not extensions.jsonb_matches_schema(private.sync_slide_schema_v1(),p_presentation)
  or (p_presentation-array['rows','news','ownRowIndexes','home','away','match','state','club'])
   is distinct from(seed-array['rows','news','ownRowIndexes','home','away','match','state','club'])
  or p_presentation#>>'{club,tagline}' is distinct from seed#>>'{club,tagline}'
  then raise exception 'Source render presentation invalid'using errcode='23514';end if;
 -- Validate URL, privacy and structural refinements without treating immutable
 -- global provider-cache IDs as tenant Media IDs.
 if clean#>>'{style,background}'='photo'then clean:=jsonb_set(clean,'{style,background}','"gradient"');end if;
 perform private.assert_sync_slide_v1(p_snapshot.tenant_id,clean);
 for asset_role,ref in select item.role,item.asset from(values
  ('background',p_presentation#>'{style,backgroundAsset}'),
  ('logo',p_presentation#>'{club,logo}'),('logo',p_presentation#>'{home,logo}'),('logo',p_presentation#>'{away,logo}')
 )item(role,asset)where item.asset is not null loop
  if ref->>'kind'='system'then
   if asset_role='background'then
    perform private.assert_sync_slide_v1(p_snapshot.tenant_id,jsonb_set(jsonb_set(clean,'{style,background}',p_presentation#>'{style,background}'),'{style,backgroundAsset}',ref));
   else
    perform private.assert_sync_slide_v1(p_snapshot.tenant_id,jsonb_set(clean,'{club,logo}',ref));
   end if;
  else
   reference_asset_id:=(ref->>'mediaAssetId')::uuid;
   -- Only typed canonical asset fields or the validated frozen static seed
   -- authorize an image. A UUID in arbitrary copy is not an asset authority.
   if not exists(select 1 from private.sites_json_nodes_v1(p_snapshot.snapshot_data_json)node
    where (node.value->>'kind'='tenant'and node.value->>'mediaAssetId'=reference_asset_id::text)
     or exists(select 1 from jsonb_each(case when jsonb_typeof(node.value)='object'then node.value else '{}'::jsonb end)pair
      where pair.key in('logoMediaAssetId','homeLogoMediaAssetId','awayLogoMediaAssetId','photoMediaAssetId','imageMediaAssetId','heroMediaAssetId','providerLogoMediaAssetId','backgroundMediaAssetId','sponsorMediaAssetId')and pair.value=to_jsonb(reference_asset_id::text)))
    or not(exists(select 1 from public.media_assets asset join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.variant_type='original'
      where asset.tenant_id=p_snapshot.tenant_id and asset.id=reference_asset_id and asset.kind='image'and asset.status='ready'and asset.deleted_at is null and variant.checksum_sha256=ref->>'checksumSha256')
     or exists(select 1 from public.provider_asset_versions asset where asset.id=reference_asset_id and asset.checksum_sha256=ref->>'checksumSha256'and asset.mime_type like'image/%'))
    then raise exception 'Source render image authority invalid'using errcode='23514';end if;
  end if;
 end loop;
end;$$;


revoke all on function private.assert_sync_slide_before_youtube_v1(uuid,jsonb),
 private.assert_sync_dynamic_render_presentation_v1(public.dynamic_slide_snapshots,jsonb)
 from public,anon,authenticated,service_role;
