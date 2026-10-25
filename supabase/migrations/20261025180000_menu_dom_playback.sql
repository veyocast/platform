begin;
-- Menu Studio keeps its real MenuDocument/widget renderer and approved prices.
-- Only new preparations in an explicitly enabled tenant adopt protocol 2.
alter function private.build_dynamic_snapshot_data(public.dynamic_slides)rename to build_dynamic_snapshot_before_menu_dom_v2;
create function private.build_dynamic_snapshot_data(p_slide public.dynamic_slides)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;doc jsonb;
begin
 result:=private.build_dynamic_snapshot_before_menu_dom_v2(p_slide);doc:=result->'menuDocument';
 if not(result?'syncConfiguration')and doc->>'schemaVersion'='menu-document.v2'and doc#>'{sitesConfiguration,menuWidgets}'='true'::jsonb
  and exists(select 1 from private.sync_dom_rollouts where tenant_id=p_slide.tenant_id and enabled)then
  result:=result||jsonb_build_object('syncPlaybackProtocol',2);
 end if;
 return result;
end;$$;
revoke all on function private.build_dynamic_snapshot_before_menu_dom_v2(public.dynamic_slides),private.build_dynamic_snapshot_data(public.dynamic_slides)from public,anon,authenticated,service_role;
-- Producer toggles never reinterpret an already published historical contract.
do $migration$
declare definition text;marker text:='      hash:=private.published_data_hash_v1(dataset);';
begin
 definition:=pg_get_functiondef('private.complete_published_data_before_binary_v1(uuid,uuid,uuid)'::regprocedure);
 if position(marker in definition)=0 then raise exception 'Menu DOM data predecessor mismatch';end if;
 execute replace(definition,marker,$m$      if frozen.snapshot_data_json?'menuDocument'and not(frozen.snapshot_data_json?'syncConfiguration')then
        if frozen.snapshot_data_json->'syncPlaybackProtocol'='2'::jsonb then dataset:=dataset||jsonb_build_object('syncPlaybackProtocol',2);else dataset:=dataset-'syncPlaybackProtocol';end if;
      end if;
$m$||marker);
end;$migration$;
create function private.assert_menu_dom_presentation_v2(p_snapshot public.dynamic_slide_snapshots,p_presentation jsonb)returns integer
language plpgsql stable security definer set search_path='' as $$
declare doc jsonb:=p_snapshot.snapshot_data_json->'menuDocument';config jsonb;ref jsonb;asset_id uuid;seconds integer;pages integer;
begin
 config:=coalesce(p_snapshot.snapshot_data_json->'sitesConfiguration',doc->'sitesConfiguration');
 if p_snapshot.snapshot_data_json->'syncPlaybackProtocol'is distinct from'2'::jsonb or p_snapshot.snapshot_data_json?'syncConfiguration'
  or doc->>'schemaVersion'is distinct from'menu-document.v2' or p_presentation->>'kind'is distinct from'dynamic'
  or config->>'provider'is distinct from'menu'or config->'menuWidgets'is distinct from'true'::jsonb
  or(p_presentation->'configuration'@>config)is not true or p_presentation#>>'{content,kind}'is distinct from'kantine'
  or coalesce(p_presentation#>>'{configuration,rendererVersion}','')not in('sites-v11','sites-v17')
  or jsonb_typeof(p_presentation#>'{content,menuPages}')is distinct from'array'
  or coalesce(config->>'seconds','')!~'^[0-9]{1,3}$'then raise exception 'invalid Menu DOM presentation'using errcode='23514';end if;
 perform private.validate_menu_document_v2(p_snapshot.tenant_id,p_snapshot.data_source_id,doc);
 pages:=jsonb_array_length(p_presentation#>'{content,menuPages}');seconds:=(config->>'seconds')::integer;
 if pages not between 1 and 100 or seconds not between 3 and 120 or pages*seconds>3600 then raise exception 'Menu DOM duration bounds'using errcode='23514';end if;
 for ref in select value from jsonb_path_query(p_presentation,'lax $.** ? (@.kind == "tenant")')value loop
  if coalesce(ref->>'mediaAssetId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'or coalesce(ref->>'checksumSha256','')!~'^[a-f0-9]{64}$'then raise exception 'invalid Menu DOM asset'using errcode='23514';end if;
  asset_id:=(ref->>'mediaAssetId')::uuid;
  if not exists(select 1 from public.media_assets asset where asset.tenant_id=p_snapshot.tenant_id and asset.id=asset_id and asset.kind='image'and asset.status='ready'and asset.deleted_at is null and exists(select 1 from public.media_variants variant where variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.checksum_sha256=ref->>'checksumSha256'))
   or not coalesce((asset_id in(select private.collect_menu_asset_ids_v2(doc))or config#>>'{background,mediaAssetId}'=asset_id::text or p_snapshot.snapshot_data_json#>>'{brand,logoMediaAssetId}'=asset_id::text),false)then raise exception 'Menu DOM asset authority mismatch'using errcode='23514';end if;
 end loop;
 return pages*seconds*1000;
end;$$;
revoke all on function private.assert_menu_dom_presentation_v2(public.dynamic_slide_snapshots,jsonb)from public,anon,authenticated,service_role;
-- Reuse the complete fenced job/immutable snapshot/variant transaction. The
-- Source validator is retained byte-for-byte on its original RPC.
do $migration$
declare definition text;first_marker text;last_marker text;first_at integer;last_at integer;
begin
 definition:=pg_get_functiondef('public.complete_dynamic_dom_job_v2(uuid,text,uuid,jsonb)'::regprocedure);
 definition:=replace(definition,'FUNCTION public.complete_dynamic_dom_job_v2(','FUNCTION public.complete_menu_dom_job_v2(');
 first_marker:=' perform private.assert_sync_dynamic_render_presentation_v1(snapshot_record,presentation);';last_marker:=' select *into slide_record';
 first_at:=position(first_marker in definition);last_at:=position(last_marker in definition);
 if first_at=0 or last_at<=first_at then raise exception 'Menu DOM completion predecessor mismatch';end if;
 definition:=left(definition,first_at-1)||$m$
 duration_ms:=private.assert_menu_dom_presentation_v2(snapshot_record,presentation);pages:=jsonb_array_length(presentation#>'{content,menuPages}');
 bytes:=(p_artifact->>'byteLength')::bigint;render_width:=(p_artifact->>'width')::integer;render_height:=(p_artifact->>'height')::integer;
 if bytes not between 1 and 550000 or(p_artifact->>'durationMs')::integer<>duration_ms
  or render_width<>(case when presentation#>>'{configuration,orientation}'='portrait'then 1080 else 1920 end)
  or render_height<>(case when presentation#>>'{configuration,orientation}'='portrait'then 1920 else 1080 end)
  or path is distinct from'tenants/'||job_record.tenant_id::text||'/assets/'||job_record.output_media_asset_id::text||'/sync-dom/'||sha||'.json'then raise exception 'incomplete Menu DOM receipt'using errcode='23514';end if;
$m$||substring(definition from last_at);
 definition:=replace(definition,$m$presentation->>'name'$m$,$m$coalesce(nullif(presentation#>>'{configuration,title}',''),slide_record.name)$m$);
 definition:=replace(definition,$m$presentation->>'rendererVersion'$m$,$m$presentation#>>'{configuration,rendererVersion}'$m$);
 -- Menu durations retain the general publication limit, independently of Source.
 definition:=replace(definition,$m$'^[0-9]{1,6}$'$m$,$m$'^[0-9]{1,7}$'$m$);
 execute definition;
end;$migration$;
revoke all on function public.complete_menu_dom_job_v2(uuid,text,uuid,jsonb)from public,anon,authenticated,service_role;
grant execute on function public.complete_menu_dom_job_v2(uuid,text,uuid,jsonb)to service_role;
-- The same three-slot export cache, demand TTL, leases and cleanup budgets serve
-- Menu's genuine legacy PNG. No second unbounded output/version queue is added.
do $migration$
declare definition text;proc text;marker text;
begin
 definition:=pg_get_functiondef('private.enqueue_sync_binary_before_dom_v2(uuid,uuid)'::regprocedure);
 marker:=$m$not(frozen.snapshot_data_json?'syncConfiguration')$m$;
 if position(marker in definition)=0 then raise exception 'Menu binary enqueue predecessor mismatch';end if;
 definition:=replace(definition,marker,$m$(not(frozen.snapshot_data_json?'syncConfiguration')and not(frozen.snapshot_data_json->'syncPlaybackProtocol'='2'::jsonb and frozen.snapshot_data_json?'menuDocument'))$m$);
 execute definition;
 foreach proc in array array['public.claim_dynamic_render_job_v3(text,integer,integer)','public.claim_dynamic_render_job_v4(text,integer,integer)']loop
  definition:=pg_get_functiondef(proc::regprocedure);
  marker:=$m$work.binary_data_json#>>'{syncConfiguration,seed,name}'$m$;
  if position(marker in definition)=0 then raise exception 'Menu binary claim predecessor mismatch';end if;
  definition:=replace(definition,marker,$m$coalesce(work.binary_data_json#>>'{syncConfiguration,seed,name}',work.binary_data_json#>>'{menuDocument,title}','Menu')$m$);
  definition:=replace(definition,$m$work.binary_data_json#>>'{syncConfiguration,seed,orientation}'$m$,$m$coalesce(work.binary_data_json#>>'{syncConfiguration,seed,orientation}',work.binary_data_json#>>'{menuDocument,sitesConfiguration,orientation}')$m$);
  execute definition;
 end loop;
 definition:=pg_get_functiondef('public.complete_sync_binary_render_v1(uuid,uuid,text,uuid,jsonb)'::regprocedure);
 definition:=replace(definition,'FUNCTION public.complete_sync_binary_render_v1(','FUNCTION public.complete_menu_binary_render_v2(');
 marker:=' if p_artifact is null';
 if position(marker in definition)=0 or position(' update private.sync_published_binary_state set'in definition)=0 then raise exception 'Menu binary completion predecessor mismatch';end if;
 definition:=left(definition,position(marker in definition)-1)||$m$
 if p_artifact is null or jsonb_typeof(p_artifact)<>'object'or pg_column_size(p_artifact)>550000 or(select count(*)from jsonb_object_keys(p_artifact))<>9
  or p_artifact->'schemaVersion'is distinct from'2'::jsonb or mime is distinct from'image/png'or coalesce(sha,'')!~'^[a-f0-9]{64}$'
  or coalesce(p_artifact->>'byteLength','')!~'^[0-9]{1,8}$'or coalesce(p_artifact->>'durationMs','')!~'^[0-9]{1,7}$'
  or coalesce(p_artifact->>'width','')!~'^[0-9]{1,4}$'or coalesce(p_artifact->>'height','')!~'^[0-9]{1,4}$'then raise exception 'invalid Menu export receipt'using errcode='23514';end if;
 duration_ms:=private.assert_menu_dom_presentation_v2(snapshot_record,presentation);bytes:=(p_artifact->>'byteLength')::bigint;
 if bytes not between 1 and 67108864 or(p_artifact->>'durationMs')::integer<>duration_ms
  or(p_artifact->>'width')::integer<>(case when presentation#>>'{configuration,orientation}'='portrait'then 1080 else 1920 end)
  or(p_artifact->>'height')::integer<>(case when presentation#>>'{configuration,orientation}'='portrait'then 1920 else 1080 end)
  or path is distinct from'tenants/'||p_tenant_id::text||'/assets/'||job_record.output_media_asset_id::text||'/sync-dynamic/'||p_lease_token::text||'-'||sha||'.png'then raise exception 'incomplete Menu export receipt'using errcode='23514';end if;
$m$||substring(definition from position(' update private.sync_published_binary_state set'in definition));
 execute definition;
 -- Explicit export reads include only this authorized frozen Menu definition.
 definition:=pg_get_functiondef('public.read_sync_export_v2(uuid,uuid)'::regprocedure);
 marker:=$m$'configuration',frozen.snapshot_data_json->'syncConfiguration',$m$;
 if position(marker in definition)=0 then raise exception 'Menu export read predecessor mismatch';end if;
 execute replace(definition,marker,marker||$m$'menuData',case when frozen.snapshot_data_json?'menuDocument'and not(frozen.snapshot_data_json?'syncConfiguration')then frozen.snapshot_data_json else null end,$m$);
end;$migration$;
revoke all on function public.complete_menu_binary_render_v2(uuid,uuid,text,uuid,jsonb)from public,anon,authenticated,service_role;
grant execute on function public.complete_menu_binary_render_v2(uuid,uuid,text,uuid,jsonb)to service_role;
notify pgrst,'reload schema';
commit;
