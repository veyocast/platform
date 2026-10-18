-- Complete Source output belongs to the existing immutable snapshot. The new
-- service command fences every attempt and publishes only full PNG/MP4 results.
alter table public.dynamic_slide_snapshots add column sync_render_result_json jsonb
 check(sync_render_result_json is null or jsonb_typeof(sync_render_result_json)='object');

create function private.assert_sync_dynamic_render_presentation_v1(p_snapshot public.dynamic_slide_snapshots,p_presentation jsonb)returns void
language plpgsql stable security definer set search_path='' as $$
declare
 seed jsonb:=p_snapshot.snapshot_data_json#>'{syncConfiguration,seed}';
 clean jsonb:=p_presentation#-'{club,logo}'#-'{home,logo}'#-'{away,logo}'#-'{style,backgroundAsset}';
 ref jsonb;reference_asset_id uuid;
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
 for ref in select *from private.sites_asset_references_v1(p_presentation)loop
  if ref->>'kind'='system'then
   perform private.assert_sync_slide_v1(p_snapshot.tenant_id,jsonb_set(clean,'{club,logo}',ref));
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

create function public.complete_dynamic_render_job_v2(p_job_id uuid,p_worker_id text,p_lease_token uuid,p_artifact jsonb)returns uuid
language plpgsql security definer set search_path='' as $$
declare
 job_record public.dynamic_render_jobs%rowtype;snapshot_record public.dynamic_slide_snapshots%rowtype;slide_record public.dynamic_slides%rowtype;
 presentation jsonb:=p_artifact->'presentation';poster jsonb:=p_artifact->'poster';
 mime text:=p_artifact->>'mimeType';sha text:=p_artifact->>'checksumSha256';path text:=p_artifact->>'storagePath';
 bytes bigint;render_width integer;render_height integer;duration_ms integer;pages integer;is_video boolean;prefix text;variant_record record;
begin
 select *into job_record from public.dynamic_render_jobs where id=p_job_id and status='rendering'and locked_by=left(p_worker_id,120)and lease_token=p_lease_token for update;
 if not found then raise exception 'dynamic render lease lost'using errcode='55000';end if;
 select *into snapshot_record from public.dynamic_slide_snapshots where tenant_id=job_record.tenant_id and id=job_record.snapshot_id for update;
 if not(snapshot_record.snapshot_data_json?'syncConfiguration')then
  return private.complete_dynamic_render_before_sync_v1(p_job_id,p_worker_id,path,(p_artifact->>'byteLength')::bigint,sha,(p_artifact->>'width')::integer,(p_artifact->>'height')::integer);
 end if;
 if p_artifact is null or jsonb_typeof(p_artifact)<>'object'or pg_column_size(p_artifact)>550000
  or mime is null or mime not in('image/png','video/mp4')or sha is null or sha!~'^[a-f0-9]{64}$'
  or coalesce(p_artifact->>'byteLength','')!~'^[0-9]{1,9}$'or coalesce(p_artifact->>'width','')!~'^[0-9]{1,4}$'or coalesce(p_artifact->>'height','')!~'^[0-9]{1,4}$'
  or coalesce(p_artifact->>'durationMs','')!~'^[0-9]{1,6}$'
  or coalesce(poster->>'byteLength','')!~'^[0-9]{1,8}$'or coalesce(poster->>'checksumSha256','')!~'^[a-f0-9]{64}$'
  then raise exception 'invalid complete Source artifact'using errcode='22023';end if;
 bytes:=(p_artifact->>'byteLength')::bigint;render_width:=(p_artifact->>'width')::integer;render_height:=(p_artifact->>'height')::integer;duration_ms:=(p_artifact->>'durationMs')::integer;
 perform private.assert_sync_dynamic_render_presentation_v1(snapshot_record,presentation);
 pages:=case when presentation->>'family'='rss'then greatest(1,jsonb_array_length(presentation->'news'))else greatest(1,ceil(jsonb_array_length(presentation->'rows')::numeric/(presentation->>'rowsPerPage')::integer)::integer)end;
 is_video:=pages>1 or coalesce(presentation#>>'{style,motion}'in('rustig','dynamisch'),false);
 prefix:='tenants/'||job_record.tenant_id::text||'/assets/'||job_record.output_media_asset_id::text||'/sync-dynamic/';
 if bytes not between 1 and 524288000 or(poster->>'byteLength')::bigint not between 1 and 25165824
  or render_width<>(case when presentation->>'orientation'='portrait'then 1080 else 1920 end)
  or render_height<>(case when presentation->>'orientation'='portrait'then 1920 else 1080 end)
  or duration_ms not between 3000 and 120000 or duration_ms<>pages*(snapshot_record.snapshot_data_json#>>'{syncConfiguration,secondsPerPage}')::integer*1000
  or mime is distinct from(case when is_video then'video/mp4'else'image/png'end)
  or path is distinct from prefix||sha||(case when is_video then'.mp4'else'.png'end)
  or poster->>'storagePath'is distinct from prefix||(poster->>'checksumSha256')||'.png'
  or(not is_video and (poster->>'checksumSha256'is distinct from sha or(poster->>'byteLength')::bigint<>bytes))
  then raise exception 'incomplete or inconsistent Source artifact'using errcode='23514';end if;
 select *into slide_record from public.dynamic_slides where tenant_id=job_record.tenant_id and id=snapshot_record.dynamic_slide_id;
 insert into public.media_assets(id,tenant_id,created_by,kind,title,original_file_name,mime_type,status,storage_bucket,storage_path,file_size_bytes,checksum_sha256,width,height,duration_seconds,processed_at)
 values(job_record.output_media_asset_id,job_record.tenant_id,snapshot_record.created_by,case when is_video then'video'::public.media_asset_kind else'image'::public.media_asset_kind end,presentation->>'name',case when is_video then'complete-source.mp4'else'complete-source.png'end,mime,'ready','tenant-media',path,bytes,sha,render_width,render_height,duration_ms::numeric/1000,now())on conflict(id)do nothing;
 if not exists(select 1 from public.media_assets asset where asset.id=job_record.output_media_asset_id and asset.tenant_id=job_record.tenant_id and asset.kind::text=case when is_video then'video'else'image'end and asset.status='ready'and asset.deleted_at is null and asset.storage_bucket='tenant-media'and asset.storage_path=path and asset.mime_type=mime and asset.file_size_bytes=bytes and asset.checksum_sha256=sha and asset.width=render_width and asset.height=render_height and asset.duration_seconds=duration_ms::numeric/1000)
  then raise exception 'Source fallback identity collision'using errcode='23514';end if;
 for variant_record in select'original'as kind,path as path,mime as mime,bytes as bytes,sha as sha,duration_ms::numeric/1000 as duration
  union all select'player_1080p',path,mime,bytes,sha,duration_ms::numeric/1000 where is_video
  union all select'thumbnail',poster->>'storagePath','image/png',(poster->>'byteLength')::bigint,poster->>'checksumSha256',null::numeric where is_video
 loop
  insert into public.media_variants(tenant_id,asset_id,variant_type,storage_bucket,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height,duration_seconds)
   values(job_record.tenant_id,job_record.output_media_asset_id,variant_record.kind::public.media_variant_type,'tenant-media',variant_record.path,variant_record.mime,variant_record.bytes,variant_record.sha,render_width,render_height,variant_record.duration)on conflict(tenant_id,asset_id,variant_type)do nothing;
  if not exists(select 1 from public.media_variants variant where variant.tenant_id=job_record.tenant_id and variant.asset_id=job_record.output_media_asset_id and variant.variant_type::text=variant_record.kind and variant.storage_bucket='tenant-media'and variant.storage_path=variant_record.path and variant.mime_type=variant_record.mime and variant.file_size_bytes=variant_record.bytes and variant.checksum_sha256=variant_record.sha and variant.width=render_width and variant.height=render_height and variant.duration_seconds is not distinct from variant_record.duration)
   then raise exception 'Source fallback variant collision'using errcode='23514';end if;
 end loop;
 update public.dynamic_slide_snapshots set sync_render_result_json=p_artifact,status='ready',output_media_asset_id=job_record.output_media_asset_id,completed_at=now()where id=snapshot_record.id;
 update public.dynamic_render_jobs set status='completed',finished_at=now(),locked_at=null,locked_by=null where id=job_record.id;
  update public.dynamic_slides slide
  set status = 'ready',
      current_snapshot_id = snapshot_record.id,
      last_error_code = null
  where slide.id = slide_record.id
    and (
      slide.current_snapshot_id is null
      or slide.current_snapshot_id = snapshot_record.id
      or (
        slide.selection_mode = 'latest'
        and not exists (
          select 1
          from public.dynamic_slide_snapshots current_snapshot
          where current_snapshot.tenant_id = slide.tenant_id
            and current_snapshot.id = slide.current_snapshot_id
            and current_snapshot.status = 'ready'
            and current_snapshot.output_media_asset_id is not null
            and (
              (
                current_snapshot.snapshot_sequence is not null
                and snapshot_record.snapshot_sequence is not null
                and current_snapshot.snapshot_sequence >
                  snapshot_record.snapshot_sequence
              )
              or (
                current_snapshot.snapshot_sequence is not null
                and snapshot_record.snapshot_sequence is null
              )
              or (
                current_snapshot.snapshot_sequence is null
                and snapshot_record.snapshot_sequence is null
                and (current_snapshot.created_at, current_snapshot.id) >
                  (snapshot_record.created_at, snapshot_record.id)
              )
            )
        )
      )
    );
 insert into public.audit_events(tenant_id,actor_user_id,action,target_type,target_id,result,metadata)values(job_record.tenant_id,snapshot_record.created_by,'dynamic.render.completed','dynamic_slide_snapshots',snapshot_record.id,'success',jsonb_build_object('systemExecuted',true,'jobId',job_record.id,'mediaAssetId',job_record.output_media_asset_id,'checksum',sha,'contentAddressed',true,'rendererVersion','sync-v1','mimeType',mime,'durationMs',duration_ms,'pages',pages));
 return job_record.output_media_asset_id;
end;$$;

-- Legacy workers cannot mutate a modern attempt even when worker IDs match.
alter function public.fail_dynamic_render_job_v1(uuid,text,text,text,boolean)rename to fail_dynamic_render_before_sync_v1;
alter function public.fail_dynamic_render_before_sync_v1(uuid,text,text,text,boolean)set schema private;
create function public.fail_dynamic_render_job_v1(p_job_id uuid,p_worker_id text,p_error_code text,p_error_detail text,p_retryable boolean)returns text
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.dynamic_render_jobs where id=p_job_id for update;
 if exists(select 1 from public.dynamic_render_jobs where id=p_job_id and lease_token is not null)then raise exception 'dynamic render lease lost'using errcode='55000';end if;
 return private.fail_dynamic_render_before_sync_v1(p_job_id,p_worker_id,p_error_code,p_error_detail,p_retryable);
end;$$;
do $migration$
declare definition text;
begin
 select pg_get_functiondef('public.fail_dynamic_render_job_v2(uuid,text,uuid,text,text,boolean)'::regprocedure)into definition;
 execute replace(definition,'public.fail_dynamic_render_job_v1(','private.fail_dynamic_render_before_sync_v1(');
 select pg_get_functiondef('public.complete_dynamic_render_job_v1(uuid,text,text,bigint,text,integer,integer)'::regprocedure)into definition;
 if position(E'begin\n if exists'in definition)=0 then raise exception 'Legacy dynamic completion fence precondition failed';end if;
 definition:=replace(definition,E'begin\n if exists',E'begin\n perform 1 from public.dynamic_render_jobs where id=p_job_id for update;\n if exists');
 execute replace(definition,' return private.complete_dynamic_render_before_sync_v1',E' if exists(select 1 from public.dynamic_render_jobs where id=p_job_id and lease_token is not null)then raise exception ''dynamic render lease lost''using errcode=''55000'';end if;\n return private.complete_dynamic_render_before_sync_v1');
 select pg_get_functiondef('public.claim_dynamic_render_job_v1(text,integer,integer)'::regprocedure)into definition;
 if position('locked_by = left(p_worker_id, 120),'in definition)=0 then raise exception 'Legacy dynamic claim clear fence precondition failed';end if;
 execute replace(definition,'locked_by = left(p_worker_id, 120),',E'locked_by = left(p_worker_id, 120),\n        lease_token = null,');
end;$migration$;
revoke all on function private.assert_sync_dynamic_render_presentation_v1(public.dynamic_slide_snapshots,jsonb),public.complete_dynamic_render_job_v2(uuid,text,uuid,jsonb),private.fail_dynamic_render_before_sync_v1(uuid,text,text,text,boolean),public.fail_dynamic_render_job_v1(uuid,text,text,text,boolean)from public,anon,authenticated,service_role;
grant execute on function public.complete_dynamic_render_job_v2(uuid,text,uuid,jsonb),public.fail_dynamic_render_job_v1(uuid,text,text,text,boolean)to service_role;
