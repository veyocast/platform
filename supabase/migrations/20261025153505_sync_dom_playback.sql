begin;
-- Offering protocol 2 is a separate operational step after consumer deployment.
create table private.sync_dom_rollouts(
 tenant_id uuid primary key references public.tenants(id) on delete cascade,
 enabled boolean not null default false,
 verified_consumer_sha text not null check(verified_consumer_sha~'^[a-f0-9]{40}$'),
 updated_at timestamptz not null default now()
);
alter table private.sync_dom_rollouts enable row level security;
alter table private.sync_dom_rollouts force row level security;
revoke all on private.sync_dom_rollouts from public,anon,authenticated,service_role;
create function public.set_sync_dom_rollout_v2(p_tenant_id uuid,p_enabled boolean,p_verified_consumer_sha text)returns void
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception 'service role required'using errcode='42501';end if;
 if p_enabled is null or p_verified_consumer_sha is null or p_verified_consumer_sha!~'^[a-f0-9]{40}$'then raise exception 'verified consumer release required'using errcode='22023';end if;
 insert into private.sync_dom_rollouts(tenant_id,enabled,verified_consumer_sha)values(p_tenant_id,p_enabled,p_verified_consumer_sha)
 on conflict(tenant_id)do update set enabled=excluded.enabled,verified_consumer_sha=excluded.verified_consumer_sha,updated_at=clock_timestamp();
 insert into public.audit_events(tenant_id,action,target_type,target_id,result,metadata)
 values(p_tenant_id,'sync.dom.rollout','tenants',p_tenant_id,'success',jsonb_build_object('enabled',p_enabled,'verifiedConsumerSha',p_verified_consumer_sha,'systemExecuted',true));
end;$$;
revoke all on function public.set_sync_dom_rollout_v2(uuid,boolean,text)from public,anon,authenticated,service_role;
grant execute on function public.set_sync_dom_rollout_v2(uuid,boolean,text)to service_role;

-- The user's original request remains the idempotency identity. The server,
-- after its permission gate, materializes the opted-in new protocol in the
-- versioned definition. No historical definition or release is rewritten.
do $migration$
declare definition text;marker text:=$m$configuration:=p_request->'configuration';$m$;
begin
 definition:=pg_get_functiondef('public.mutate_sync_dynamic_authoring_v1(uuid,text,uuid,uuid,bigint,jsonb,uuid)'::regprocedure);
 if position(marker in definition)=0 then raise exception 'DOM authoring predecessor mismatch';end if;
 execute replace(definition,marker,marker||$m$
  if exists(select 1 from private.sync_dom_rollouts where tenant_id=p_tenant_id and enabled)then
   configuration:=configuration||jsonb_build_object('syncPlaybackProtocol',2);
  elsif configuration?'syncPlaybackProtocol'then
   raise exception 'DOM producer rollout is not enabled'using errcode='23514';
  end if;$m$);
end;$migration$;
alter function private.build_dynamic_snapshot_data(public.dynamic_slides)rename to build_dynamic_snapshot_before_dom_v2;
create function private.build_dynamic_snapshot_data(p_slide public.dynamic_slides)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 result:=private.build_dynamic_snapshot_before_dom_v2(p_slide);
 if p_slide.configuration_json->'syncPlaybackProtocol'='2'::jsonb and p_slide.configuration_json?'syncConfiguration'then
  result:=result||jsonb_build_object('syncPlaybackProtocol',2);
 end if;
 return result;
end;$$;
revoke all on function private.build_dynamic_snapshot_before_dom_v2(public.dynamic_slides),private.build_dynamic_snapshot_data(public.dynamic_slides)from public,anon,authenticated,service_role;

-- Older workers must not claim a descriptor and encode it as an image/video.
-- New workers reuse all existing lease/reaper/variant/binary-queue logic.
do $migration$
declare definition text;modern text;marker text:=$m$where job.status = 'queued'$m$;
begin
 definition:=pg_get_functiondef('public.claim_dynamic_render_job_v2(text,integer,integer)'::regprocedure);
 if position(marker in definition)=0 then raise exception 'DOM claim predecessor mismatch';end if;
 modern:=replace(definition,'FUNCTION public.claim_dynamic_render_job_v2(','FUNCTION private.claim_dynamic_render_dom_aware_v2(');
 execute modern;
 execute replace(definition,marker,marker||$m$ and not exists(select 1 from public.dynamic_slide_snapshots candidate_snapshot
  where candidate_snapshot.id=job.snapshot_id and candidate_snapshot.snapshot_data_json->'syncPlaybackProtocol'='2'::jsonb)$m$);
 definition:=pg_get_functiondef('public.claim_dynamic_render_job_v3(text,integer,integer)'::regprocedure);
 if position('public.claim_dynamic_render_job_v2('in definition)=0 then raise exception 'DOM worker queue predecessor mismatch';end if;
 definition:=replace(definition,'FUNCTION public.claim_dynamic_render_job_v3(','FUNCTION public.claim_dynamic_render_job_v4(');
 execute replace(definition,'public.claim_dynamic_render_job_v2(','private.claim_dynamic_render_dom_aware_v2(');
end;$migration$;
revoke all on function private.claim_dynamic_render_dom_aware_v2(text,integer,integer),public.claim_dynamic_render_job_v4(text,integer,integer)from public,anon,authenticated,service_role;
grant execute on function public.claim_dynamic_render_job_v4(text,integer,integer)to service_role;

-- Original source assets are verified on the Player before activation. This
-- readiness receipt validates the exact known renderer, canonical projection,
-- asset authority, duration and descriptor identity without capture/encoding.
create function public.complete_dynamic_dom_job_v2(p_job_id uuid,p_worker_id text,p_lease_token uuid,p_artifact jsonb)returns uuid
language plpgsql security definer set search_path='' as $$
declare
 job_record public.dynamic_render_jobs%rowtype;snapshot_record public.dynamic_slide_snapshots%rowtype;slide_record public.dynamic_slides%rowtype;
 presentation jsonb:=p_artifact->'presentation';mime text:=p_artifact->>'mimeType';sha text:=p_artifact->>'checksumSha256';path text:=p_artifact->>'storagePath';
 bytes bigint;duration_ms integer;pages integer;render_width integer;render_height integer;
begin
 select *into job_record from public.dynamic_render_jobs where id=p_job_id for update;
 if not found or job_record.lease_token is distinct from p_lease_token then raise exception 'dynamic render lease lost'using errcode='55000';end if;
 select *into snapshot_record from public.dynamic_slide_snapshots where tenant_id=job_record.tenant_id and id=job_record.snapshot_id for update;
 if job_record.status='completed'and snapshot_record.sync_render_result_json=p_artifact and snapshot_record.snapshot_data_json->'syncPlaybackProtocol'='2'::jsonb then return job_record.output_media_asset_id;end if;
 if job_record.status<>'rendering'or job_record.locked_by is distinct from left(p_worker_id,120)then raise exception 'dynamic render lease lost'using errcode='55000';end if;
 if snapshot_record.snapshot_data_json->'syncPlaybackProtocol'is distinct from'2'::jsonb
  or p_artifact->'schemaVersion'is distinct from'2'::jsonb or mime is distinct from'application/vnd.veyocast.sync-dom+json'
  or (select count(*)from jsonb_object_keys(p_artifact))<>9 or pg_column_size(p_artifact)>550000
  or coalesce(sha,'')!~'^[a-f0-9]{64}$'or coalesce(p_artifact->>'byteLength','')!~'^[0-9]{1,6}$'
  or coalesce(p_artifact->>'durationMs','')!~'^[0-9]{1,6}$'
  or coalesce(p_artifact->>'width','')!~'^[0-9]{1,4}$'or coalesce(p_artifact->>'height','')!~'^[0-9]{1,4}$'
  then raise exception 'invalid DOM descriptor receipt'using errcode='23514';end if;
 perform private.assert_sync_dynamic_render_presentation_v1(snapshot_record,presentation);
 bytes:=(p_artifact->>'byteLength')::bigint;duration_ms:=(p_artifact->>'durationMs')::integer;
 render_width:=(p_artifact->>'width')::integer;render_height:=(p_artifact->>'height')::integer;
 pages:=private.sync_slide_page_count_v1(presentation);
 if bytes not between 1 and 550000 or duration_ms not between 3000 and 120000
  or duration_ms<>private.sync_slide_duration_ms_v1(presentation,(snapshot_record.snapshot_data_json#>>'{syncConfiguration,secondsPerPage}')::integer)
  or render_width<>(case when presentation->>'orientation'='portrait'then 1080 else 1920 end)
  or render_height<>(case when presentation->>'orientation'='portrait'then 1920 else 1080 end)
  or path is distinct from'tenants/'||job_record.tenant_id::text||'/assets/'||job_record.output_media_asset_id::text||'/sync-dom/'||sha||'.json'
  then raise exception 'incomplete DOM descriptor receipt'using errcode='23514';end if;
 select *into slide_record from public.dynamic_slides where tenant_id=job_record.tenant_id and id=snapshot_record.dynamic_slide_id;
 insert into public.media_assets(id,tenant_id,created_by,kind,title,original_file_name,mime_type,status,storage_bucket,storage_path,file_size_bytes,checksum_sha256,width,height,duration_seconds,processed_at,source_kind)
 values(job_record.output_media_asset_id,job_record.tenant_id,snapshot_record.created_by,'composition',presentation->>'name','source.json',mime,'ready','tenant-media',path,bytes,sha,render_width,render_height,duration_ms::numeric/1000,now(),'generated')on conflict(id)do nothing;
 if not exists(select 1 from public.media_assets asset where asset.tenant_id=job_record.tenant_id and asset.id=job_record.output_media_asset_id and asset.kind='composition'and asset.status='ready'and asset.deleted_at is null and asset.storage_bucket='tenant-media'and asset.storage_path=path and asset.checksum_sha256=sha and asset.file_size_bytes=bytes and asset.mime_type=mime)then raise exception 'DOM descriptor collision'using errcode='23514';end if;
 insert into public.media_variants(tenant_id,asset_id,variant_type,storage_bucket,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height,duration_seconds)
 values(job_record.tenant_id,job_record.output_media_asset_id,'original','tenant-media',path,mime,bytes,sha,render_width,render_height,duration_ms::numeric/1000)on conflict(tenant_id,asset_id,variant_type)do nothing;
 if not exists(select 1 from public.media_variants variant where variant.tenant_id=job_record.tenant_id and variant.asset_id=job_record.output_media_asset_id and variant.variant_type='original'and variant.storage_bucket='tenant-media'and variant.storage_path=path and variant.mime_type=mime and variant.file_size_bytes=bytes and variant.checksum_sha256=sha)then raise exception 'DOM descriptor variant collision'using errcode='23514';end if;
 update public.dynamic_slide_snapshots set sync_render_result_json=p_artifact,status='ready',output_media_asset_id=job_record.output_media_asset_id,completed_at=now()where id=snapshot_record.id;
 update public.dynamic_render_jobs set status='completed',finished_at=now(),locked_at=null,locked_by=null where id=job_record.id;
  update public.dynamic_slides slide
  set status = 'ready',
      current_snapshot_id = snapshot_record.id,
      last_error_code = null
  where slide.id = slide_record.id
    and not exists(select 1 from private.sync_dynamic_placement_variants variant where variant.tenant_id=snapshot_record.tenant_id and variant.snapshot_id=snapshot_record.id)
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
 insert into public.audit_events(tenant_id,actor_user_id,action,target_type,target_id,result,metadata)values(job_record.tenant_id,snapshot_record.created_by,'dynamic.render.completed','dynamic_slide_snapshots',snapshot_record.id,'success',jsonb_build_object('systemExecuted',true,'jobId',job_record.id,'mediaAssetId',job_record.output_media_asset_id,'checksum',sha,'contentAddressed',true,'protocolVersion',2,'rendererVersion',presentation->>'rendererVersion','mimeType',mime,'durationMs',duration_ms,'pages',pages));
 return job_record.output_media_asset_id;
end;$$;
revoke all on function public.complete_dynamic_dom_job_v2(uuid,text,uuid,jsonb)from public,anon,authenticated,service_role;
grant execute on function public.complete_dynamic_dom_job_v2(uuid,text,uuid,jsonb)to service_role;

-- The descriptor is a genuine media kind with a distinct MIME, never an image
-- pretending to be a rendered fallback. Human upload contracts stay unchanged.
do $migration$
declare original text;
begin
 select pg_get_constraintdef(oid)into original from pg_constraint where conrelid='public.media_assets'::regclass and conname='media_assets_kind_mime_v2_check';
 if original is null then raise exception 'DOM media MIME predecessor mismatch';end if;
 alter table public.media_assets drop constraint media_assets_kind_mime_v2_check;
 execute 'alter table public.media_assets add constraint media_assets_kind_mime_v2_check check ('||substring(original from 8 for length(original)-8)||$extra$ or(kind='composition'and mime_type='application/vnd.veyocast.sync-dom+json'and source_kind='generated'and original_file_name='source.json'and file_size_bytes<=550000))$extra$;
end;$migration$;
update storage.buckets set allowed_mime_types=array_append(allowed_mime_types,'application/vnd.veyocast.sync-dom+json')
where id='tenant-media'and allowed_mime_types is not null and not('application/vnd.veyocast.sync-dom+json'=any(allowed_mime_types));

-- A version-2 Source publication freezes its configuration and follows the
-- authorized dataset through the existing independent data-revision model.
do $migration$
declare definition text;marker text:='return new;';
begin
 definition:=pg_get_functiondef('private.materialize_published_data_binding_v1()'::regprocedure);
 if position(marker in definition)=0 then raise exception 'DOM live binding predecessor mismatch';end if;
 execute replace(definition,marker,$m$if exists(select 1 from public.dynamic_slide_snapshots snapshot where snapshot.tenant_id=new.tenant_id and snapshot.id=new.dynamic_snapshot_id and snapshot.snapshot_data_json->'syncPlaybackProtocol'='2'::jsonb)then new.live_data_enabled:=true;end if;
 return new;$m$);
end;$migration$;

-- A recent, genuinely incompatible consumer or explicit export is the only
-- reason to encode ordinary v2 data changes. Three existing cache slots and
-- the lease/coalescing/retention budgets remain the binary authority.
create table private.sync_binary_demand_v2(
 tenant_id uuid not null,snapshot_id uuid primary key,expires_at timestamptz not null,
 foreign key(tenant_id,snapshot_id)references public.dynamic_slide_snapshots(tenant_id,id)on delete cascade
);
create index sync_binary_demand_v2_tenant_idx on private.sync_binary_demand_v2(tenant_id,snapshot_id);
alter table private.sync_binary_demand_v2 enable row level security;
alter table private.sync_binary_demand_v2 force row level security;
revoke all on private.sync_binary_demand_v2 from public,anon,authenticated,service_role;
alter function private.enqueue_sync_binary_cache_v1(uuid,uuid)rename to enqueue_sync_binary_before_dom_v2;
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('private.enqueue_sync_binary_before_dom_v2(uuid,uuid)'::regprocedure);
 definition:=replace(definition,$m$initial_hash:=private.published_data_hash_v1(frozen.snapshot_data_json);$m$,$m$initial_hash:=case when frozen.snapshot_data_json->'syncPlaybackProtocol'='2'::jsonb then repeat('0',64)else private.published_data_hash_v1(frozen.snapshot_data_json)end;$m$);
 execute definition;
end;$migration$;
create function private.enqueue_sync_binary_cache_v1(p_tenant_id uuid,p_snapshot_id uuid)returns void
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.dynamic_slide_snapshots where tenant_id=p_tenant_id and id=p_snapshot_id and snapshot_data_json->'syncPlaybackProtocol'='2'::jsonb)
  and not exists(select 1 from private.sync_binary_demand_v2 where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id and expires_at>clock_timestamp())then return;end if;
 perform private.enqueue_sync_binary_before_dom_v2(p_tenant_id,p_snapshot_id);
end;$$;
alter function public.get_sync_binary_playback_v1(uuid,uuid[])rename to get_sync_binary_before_dom_v2;
alter function public.get_sync_binary_before_dom_v2(uuid,uuid[])set schema private;
create function public.get_sync_binary_playback_v1(p_tenant_id uuid,p_snapshot_ids uuid[])returns jsonb
language plpgsql security definer set search_path='' as $$
declare snapshot_id uuid;
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception 'service role required'using errcode='42501';end if;
 if p_snapshot_ids is null or cardinality(p_snapshot_ids)>1000 then raise exception 'binary snapshot selection outside bounds'using errcode='22023';end if;
 for snapshot_id in select snapshot.id from public.dynamic_slide_snapshots snapshot
  where snapshot.tenant_id=p_tenant_id and snapshot.id=any(p_snapshot_ids)and snapshot.snapshot_data_json->'syncPlaybackProtocol'='2'::jsonb
   and exists(select 1 from public.playlist_release_items item join private.referenced_publication_releases_v1(p_tenant_id)used on used.release_id=item.release_id where item.tenant_id=p_tenant_id and item.dynamic_snapshot_id=snapshot.id)
 loop
  insert into private.sync_binary_demand_v2(tenant_id,snapshot_id,expires_at)values(p_tenant_id,snapshot_id,clock_timestamp()+'30 minutes'::interval)
  on conflict on constraint sync_binary_demand_v2_pkey do update set expires_at=excluded.expires_at where private.sync_binary_demand_v2.expires_at<clock_timestamp()+'15 minutes'::interval;
  perform private.enqueue_sync_binary_cache_v1(p_tenant_id,snapshot_id);
 end loop;
 return private.get_sync_binary_before_dom_v2(p_tenant_id,p_snapshot_ids);
end;$$;
revoke all on function private.enqueue_sync_binary_before_dom_v2(uuid,uuid),private.enqueue_sync_binary_cache_v1(uuid,uuid),private.get_sync_binary_before_dom_v2(uuid,uuid[]),public.get_sync_binary_playback_v1(uuid,uuid[])from public,anon,authenticated,service_role;
grant execute on function public.get_sync_binary_playback_v1(uuid,uuid[])to service_role;
-- Explicit downloads share the bounded export cache, without publishing a draft
-- and without retaining a standing subscription to later data changes.
create table private.sync_explicit_exports_v2(
 tenant_id uuid not null,snapshot_id uuid primary key,pending boolean not null default true,
 requested_hash text not null check(requested_hash~'^[a-f0-9]{64}$'),
 expires_at timestamptz not null,
 foreign key(tenant_id,snapshot_id)references public.dynamic_slide_snapshots(tenant_id,id)on delete cascade
);
create index sync_explicit_exports_v2_tenant_idx on private.sync_explicit_exports_v2(tenant_id,snapshot_id);
alter table private.sync_explicit_exports_v2 enable row level security;
alter table private.sync_explicit_exports_v2 force row level security;
revoke all on private.sync_explicit_exports_v2 from public,anon,authenticated,service_role;
do $migration$
declare definition text;marker text;
begin
 definition:=pg_get_functiondef('private.enqueue_sync_binary_before_dom_v2(uuid,uuid)'::regprocedure);
 marker:=$m$if binding.snapshot_id is null or frozen.id is null$m$;
 if position(marker in definition)=0 then raise exception 'explicit export binding predecessor mismatch';end if;
 definition:=replace(definition,marker,$m$if binding.snapshot_id is null and frozen.id is not null and exists(select 1 from private.sync_explicit_exports_v2 where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id and pending and expires_at>clock_timestamp())then
  binding.tenant_id:=p_tenant_id;binding.snapshot_id:=p_snapshot_id;binding.data_source_id:=frozen.data_source_id;
  binding.data_json:=frozen.snapshot_data_json;binding.content_hash:=private.published_data_hash_v1(frozen.snapshot_data_json);binding.data_revision:=1;
 end if;
 if binding.snapshot_id is null or frozen.id is null$m$);
 marker:=$m$and item.live_data_enabled)$m$;
 if position(marker in definition)=0 then raise exception 'explicit export publication predecessor mismatch';end if;
 definition:=replace(definition,marker,marker||$m$and not exists(select 1 from private.sync_explicit_exports_v2 where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id and pending and expires_at>clock_timestamp())$m$);
 execute definition;
 definition:=pg_get_functiondef('private.enqueue_sync_binary_cache_v1(uuid,uuid)'::regprocedure);
 marker:=$m$then return;end if;$m$;
 execute replace(definition,marker,$m$and not exists(select 1 from private.sync_explicit_exports_v2 where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id and pending and expires_at>clock_timestamp())then return;end if;$m$);
 definition:=pg_get_functiondef('public.complete_sync_binary_render_v1(uuid,uuid,text,uuid,jsonb)'::regprocedure);
 marker:='return job_record.output_media_asset_id;';
 if position(marker in definition)=0 then raise exception 'explicit export completion predecessor mismatch';end if;
 execute replace(definition,marker,$m$update private.sync_explicit_exports_v2 set pending=false where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id;
 return job_record.output_media_asset_id;$m$);
end;$migration$;
create function public.request_sync_export_v2(p_tenant_id uuid,p_snapshot_id uuid,p_idempotency_key uuid)returns jsonb
language plpgsql security definer set search_path='' as $$
declare request jsonb:=jsonb_build_object('snapshotId',p_snapshot_id);result jsonb;frozen public.dynamic_slide_snapshots%rowtype;current_hash text;
begin
 if private.current_user_id()is null or not private.has_tenant_capability(p_tenant_id,'tenant.dynamic_slide.write')then raise exception 'Source export permission required'using errcode='42501';end if;
 perform private.require_active_tenant_command(p_tenant_id);
 if p_snapshot_id is null or p_idempotency_key is null then raise exception 'export selection required'using errcode='22023';end if;
 result:=private.begin_publisher_command(p_tenant_id,'sync.dynamic.export',p_idempotency_key,request);if result is not null then return result;end if;
 select *into frozen from public.dynamic_slide_snapshots where tenant_id=p_tenant_id and id=p_snapshot_id and status='ready'and snapshot_data_json->'syncPlaybackProtocol'='2'::jsonb;
 if frozen.id is null then raise exception 'ready DOM snapshot required'using errcode='23514';end if;
 select content_hash into current_hash from public.published_dynamic_data where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id;
 current_hash:=coalesce(current_hash,private.published_data_hash_v1(frozen.snapshot_data_json));
 insert into private.sync_explicit_exports_v2(tenant_id,snapshot_id,pending,expires_at,requested_hash)values(p_tenant_id,p_snapshot_id,true,clock_timestamp()+'15 minutes'::interval,current_hash)
 on conflict(snapshot_id)do update set pending=true,expires_at=excluded.expires_at,requested_hash=excluded.requested_hash;
 update private.sync_published_binary_state set last_failed_hash=null,last_error_code=null where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id;
 update private.published_data_refresh_queue set attempt_count=0,next_attempt_at=clock_timestamp()where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id and phase='binary'and(lease_until is null or lease_until<=clock_timestamp());
 if exists(select 1 from private.sync_published_binary_state where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id and current_slot is not null and content_hash=current_hash)then
  update private.sync_explicit_exports_v2 set pending=false where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id;
 else perform private.enqueue_sync_binary_cache_v1(p_tenant_id,p_snapshot_id);end if;
 result:=jsonb_build_object('snapshotId',p_snapshot_id,'outcome','requested');
 return private.complete_publisher_command(p_tenant_id,'sync.dynamic.export',p_idempotency_key,request,'dynamic_slide_snapshots',p_snapshot_id,result,'sync.dynamic.export.requested','success');
end;$$;
create function public.read_sync_export_v2(p_tenant_id uuid,p_snapshot_id uuid)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare frozen public.dynamic_slide_snapshots%rowtype;cache private.sync_published_binary_state%rowtype;
begin
 if private.current_user_id()is null or not private.has_tenant_capability(p_tenant_id,'tenant.dynamic_slide.read')then raise exception 'Source read permission required'using errcode='42501';end if;
 select *into frozen from public.dynamic_slide_snapshots where tenant_id=p_tenant_id and id=p_snapshot_id and status='ready'and snapshot_data_json->'syncPlaybackProtocol'='2'::jsonb;
 if frozen.id is null then raise exception 'DOM snapshot unavailable'using errcode='42501';end if;
 select *into cache from private.sync_published_binary_state where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id;
 if cache.current_slot is not null and cache.content_hash=coalesce((select requested_hash from private.sync_explicit_exports_v2 where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id),(select content_hash from public.published_dynamic_data where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id),private.published_data_hash_v1(frozen.snapshot_data_json))then return jsonb_build_object('status','ready','configuration',frozen.snapshot_data_json->'syncConfiguration','artifact',cache.slot_artifacts->cache.current_slot::text);end if;
 return jsonb_build_object('status',case when cache.last_error_code is not null or exists(select 1 from private.sync_explicit_exports_v2 where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id and not pending and requested_hash is distinct from cache.content_hash)then'failed'else'preparing'end);
end;$$;
revoke all on function public.request_sync_export_v2(uuid,uuid,uuid),public.read_sync_export_v2(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.request_sync_export_v2(uuid,uuid,uuid),public.read_sync_export_v2(uuid,uuid)to authenticated;

-- The immutable publication records its transport version at creation time.
do $migration$
declare definition text;marker text:=$m$'schemaVersion', 1,$m$;
begin
 definition:=pg_get_functiondef('private.materialize_publication_configuration_v1(uuid,text,jsonb)'::regprocedure);
 if position(marker in definition)=0 then raise exception 'DOM publication predecessor mismatch';end if;
 execute replace(definition,marker,$m$'schemaVersion',case when exists(select 1 from public.playlist_items item join public.media_assets asset on asset.tenant_id=item.tenant_id and asset.id=item.media_asset_id where item.playlist_id=playlist_record.id and asset.kind='composition')then 2 else 1 end,$m$);
end;$migration$;

-- Observation freshness is retained independently of semantic data identity.
-- Apply only to the new protocol; every historical hash/receipt stays valid.
create function private.sync_dom_semantic_data_v2(p_data jsonb)returns jsonb language sql immutable set search_path='' as $$
 select p_data-'generatedAt'#-'{sport,generatedAt}'#-'{menu,generatedAt}'#-'{news,generatedAt}'#-'{sport,fetchedAt}'#-'{news,fetchedAt}'#-'{menu,fetchedAt}'
$$;
revoke all on function private.sync_dom_semantic_data_v2(jsonb)from public,anon,authenticated,service_role;
alter function private.published_data_hash_v1(jsonb)rename to published_data_hash_before_dom_v2;
create function private.published_data_hash_v1(p_data jsonb)returns text language sql immutable set search_path='' as $$
 select private.published_data_hash_before_dom_v2(case when p_data->'syncPlaybackProtocol'='2'::jsonb then private.sync_dom_semantic_data_v2(p_data)else p_data end)
$$;
alter function private.dynamic_snapshot_content_hash_v1(public.dynamic_slides,jsonb)rename to dynamic_snapshot_content_hash_before_dom_v2;
create function private.dynamic_snapshot_content_hash_v1(p_slide public.dynamic_slides,p_snapshot_data jsonb)returns text language sql immutable set search_path='' as $$
 select private.dynamic_snapshot_content_hash_before_dom_v2(p_slide,case when p_snapshot_data->'syncPlaybackProtocol'='2'::jsonb then private.sync_dom_semantic_data_v2(p_snapshot_data)else p_snapshot_data end)
$$;
revoke all on function private.published_data_hash_before_dom_v2(jsonb),private.published_data_hash_v1(jsonb),private.dynamic_snapshot_content_hash_before_dom_v2(public.dynamic_slides,jsonb),private.dynamic_snapshot_content_hash_v1(public.dynamic_slides,jsonb)from public,anon,authenticated,service_role;
do $migration$
declare definition text;marker text;
begin
 definition:=pg_get_functiondef('private.complete_published_data_before_binary_v1(uuid,uuid,uuid)'::regprocedure);
 marker:='data_json=case when content_hash<>hash then dataset else data_json end';
 if position(marker in definition)=0 then raise exception 'DOM observation predecessor mismatch';end if;
 execute replace(definition,marker,$m$data_json=case when content_hash<>hash or dataset->'syncPlaybackProtocol'='2'::jsonb then dataset else data_json end$m$);
 definition:=pg_get_functiondef('private.build_dynamic_snapshot_data(public.dynamic_slides)'::regprocedure);
 marker:=$m$result:=result||jsonb_build_object('syncPlaybackProtocol',2);$m$;
 if position(marker in definition)=0 then raise exception 'DOM selection day predecessor mismatch';end if;
 execute replace(definition,marker,marker||$m$
  if p_slide.slide_type='sport_birthdays'then result:=result||jsonb_build_object('syncEffectiveDay',(now()at time zone'Europe/Amsterdam')::date);end if;$m$);
end;$migration$;

-- Every writer, including the older general authoring RPC, obeys rollout.
create function private.validate_sync_dom_configuration_v2()returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.configuration_json?'syncPlaybackProtocol'then
  if new.configuration_json->'syncPlaybackProtocol'is distinct from'2'::jsonb or not(new.configuration_json?'syncConfiguration')then raise exception 'invalid DOM protocol configuration'using errcode='23514';end if;
  if (tg_op='INSERT'or old.configuration_json->'syncPlaybackProtocol'is distinct from'2'::jsonb)
   and not exists(select 1 from private.sync_dom_rollouts where tenant_id=new.tenant_id and enabled)then raise exception 'DOM producer rollout is not enabled'using errcode='23514';end if;
 end if;
 return new;
end;$$;
revoke all on function private.validate_sync_dom_configuration_v2()from public,anon,authenticated,service_role;
create trigger dynamic_slides_dom_protocol before insert or update of configuration_json on public.dynamic_slides for each row execute function private.validate_sync_dom_configuration_v2();
create trigger dynamic_versions_dom_protocol before insert or update of configuration_json on public.dynamic_slide_versions for each row execute function private.validate_sync_dom_configuration_v2();
-- A descriptor can enter a playlist only through its matching immutable Source
-- snapshot. A guessed media ID through add_media/replace_media cannot bypass it.
create function private.validate_sync_dom_playlist_item_v2()returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.media_assets asset where asset.tenant_id=new.tenant_id and asset.id=new.media_asset_id and asset.kind='composition')then
  if not exists(select 1 from public.dynamic_slide_snapshots snapshot where snapshot.tenant_id=new.tenant_id
   and snapshot.id=new.dynamic_snapshot_id and snapshot.dynamic_slide_id=new.dynamic_slide_id and snapshot.output_media_asset_id=new.media_asset_id
   and snapshot.status='ready'and snapshot.snapshot_data_json->'syncPlaybackProtocol'='2'::jsonb
   and snapshot.sync_render_result_json->'schemaVersion'='2'::jsonb
   and new.duration_seconds*1000>=(snapshot.sync_render_result_json->>'durationMs')::integer)then
   raise exception 'matching ready DOM Source placement required'using errcode='23514';
  end if;
 end if;
 return new;
end;$$;
revoke all on function private.validate_sync_dom_playlist_item_v2()from public,anon,authenticated,service_role;
create trigger playlist_items_dom_binding before insert or update of media_asset_id,dynamic_snapshot_id,dynamic_slide_id,duration_seconds on public.playlist_items for each row execute function private.validate_sync_dom_playlist_item_v2();

notify pgrst,'reload schema';
-- A native explicit export may take minutes. Independent DOM readiness must
-- never wait behind that capture lane. Both lanes retain the same fenced jobs.
do $migration$
declare definition text;marker text:=$m$where job.status = 'queued'$m$;
begin
 definition:=pg_get_functiondef('private.claim_dynamic_render_dom_aware_v2(text,integer,integer)'::regprocedure);
 if position(marker in definition)=0 then raise exception 'DOM-only claim predecessor mismatch';end if;
 definition:=replace(definition,'FUNCTION private.claim_dynamic_render_dom_aware_v2(','FUNCTION public.claim_sync_dom_ready_job_v2(');
 execute replace(definition,marker,marker||$m$ and exists(select 1 from public.dynamic_slide_snapshots candidate_snapshot
  where candidate_snapshot.id=job.snapshot_id and candidate_snapshot.snapshot_data_json->'syncPlaybackProtocol'='2'::jsonb)$m$);
end;$migration$;
revoke all on function public.claim_sync_dom_ready_job_v2(text,integer,integer)from public,anon,authenticated,service_role;
grant execute on function public.claim_sync_dom_ready_job_v2(text,integer,integer)to service_role;
create function public.get_worker_queue_hint_v3(p_max_attempts integer default 3)returns integer
language sql stable security definer set search_path='' as $$
 select (public.get_worker_queue_hint_v2(p_max_attempts)&27)
 |case when exists(select 1 from public.dynamic_render_jobs job join public.dynamic_slide_snapshots snapshot on snapshot.id=job.snapshot_id
  where job.status='queued'and job.attempt_count<least(greatest(p_max_attempts,1),job.max_attempts)and snapshot.snapshot_data_json->'syncPlaybackProtocol'='2'::jsonb)then 32 else 0 end
 |case when exists(select 1 from public.dynamic_render_jobs job join public.dynamic_slide_snapshots snapshot on snapshot.id=job.snapshot_id
  where job.status='queued'and job.attempt_count<least(greatest(p_max_attempts,1),job.max_attempts)and snapshot.snapshot_data_json->'syncPlaybackProtocol'is distinct from'2'::jsonb)
  or exists(select 1 from private.published_data_refresh_queue where phase='binary'and next_attempt_at<=statement_timestamp()and(lease_until is null or lease_until<=statement_timestamp()))
  or exists(select 1 from private.sync_published_binary_state where snapshot_id is null and cleanup_not_before<=statement_timestamp()and(cleanup_lease_until is null or cleanup_lease_until<=statement_timestamp()))then 4 else 0 end;
$$;
revoke all on function public.get_worker_queue_hint_v3(integer)from public,anon,authenticated,service_role;
grant execute on function public.get_worker_queue_hint_v3(integer)to service_role;
commit;
