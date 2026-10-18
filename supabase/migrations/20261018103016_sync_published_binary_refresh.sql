-- Bounded runtime cache for qualified binary Players. This is neither a new
-- content version nor a mutable publication. The original complete export is
-- always retained. Data work and binary work share the existing durable queue.
create table private.sync_published_binary_state (
 tenant_id uuid not null,
 configuration_snapshot_id uuid not null,
 snapshot_id uuid,
 slot_ids uuid[] not null default array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()],
 slot_artifacts jsonb not null default '{}'::jsonb,
 slot_reservations jsonb not null default '{}'::jsonb check(jsonb_typeof(slot_reservations)='object'and slot_reservations<@'{"0":83886080,"1":83886080,"2":83886080}'::jsonb),
 current_slot smallint,
 previous_slot smallint,
 content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),
 data_revision bigint not null default 0 check(data_revision>=0),
 last_started_at timestamptz,
 last_failed_hash text,
 last_error_code text,
 cleanup_lease_token uuid,
 cleanup_lease_until timestamptz,
 cleanup_worker text,
 primary key(tenant_id,configuration_snapshot_id),
 foreign key(tenant_id,snapshot_id)references public.dynamic_slide_snapshots(tenant_id,id),
 check(cardinality(slot_ids)=3 and array_position(slot_ids,null)is null),
 check(jsonb_typeof(slot_artifacts)='object'and pg_column_size(slot_artifacts)<=1700000),
 check(current_slot is null or current_slot between 0 and 2),
 check(previous_slot is null or(previous_slot between 0 and 2 and previous_slot is distinct from current_slot)),
 check((cleanup_lease_token is null)=(cleanup_lease_until is null))
);
create index sync_published_binary_tenant_snapshot_idx on private.sync_published_binary_state(tenant_id,snapshot_id);
alter table private.sync_published_binary_state enable row level security;
alter table private.sync_published_binary_state force row level security;
revoke all on private.sync_published_binary_state from public,anon,authenticated,service_role;

alter table private.published_data_refresh_queue
 add column phase text not null default 'data'check(phase in('data','binary')),
 add column binary_data_json jsonb,
 add column binary_hash text,
 add column binary_revision bigint,
 add column binary_generation bigint,
 add column binary_slot smallint check(binary_slot between 0 and 2);

create function private.detach_sync_binary_cache_v1()returns trigger
language plpgsql security definer set search_path='' as $$
begin
 -- Keep only the small cache cleanup record after the existing retention
 -- writer has proved this snapshot removable. Storage deletion happens through
 -- the worker API, never by deleting storage.objects metadata in SQL.
 update private.sync_published_binary_state set snapshot_id=null
 where tenant_id=old.tenant_id and snapshot_id=old.id;
 return old;
end;$$;
revoke all on function private.detach_sync_binary_cache_v1()from public,anon,authenticated,service_role;
create trigger snapshot_detach_sync_binary_cache before delete on public.dynamic_slide_snapshots
 for each row execute function private.detach_sync_binary_cache_v1();

create function private.sync_binary_cache_bytes_v1(p_tenant_id uuid)returns bigint
language sql stable security definer set search_path='' as $$
 select coalesce(sum(greatest(coalesce((state.slot_artifacts#>>array[slot::text,'byteLength'])::bigint,0)+coalesce((state.slot_artifacts#>>array[slot::text,'poster','byteLength'])::bigint,0),coalesce((state.slot_reservations->>slot::text)::bigint,0))),0)::bigint
 from private.sync_published_binary_state state
 cross join generate_series(0,2)slot
 where state.tenant_id=p_tenant_id;
$$;
revoke all on function private.sync_binary_cache_bytes_v1(uuid)from public,anon,authenticated,service_role;

create function private.enqueue_sync_binary_cache_v1(p_tenant_id uuid,p_snapshot_id uuid)returns void
language plpgsql security definer set search_path='' as $$
declare binding public.published_dynamic_data%rowtype;frozen public.dynamic_slide_snapshots%rowtype;
 cache private.sync_published_binary_state%rowtype;initial_hash text;
begin
 select *into binding from public.published_dynamic_data where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id;
 select *into frozen from public.dynamic_slide_snapshots where tenant_id=p_tenant_id and id=p_snapshot_id and status='ready';
 if binding.snapshot_id is null or frozen.id is null or not(frozen.snapshot_data_json?'syncConfiguration')
  or binding.data_json->'syncConfiguration'is distinct from frozen.snapshot_data_json->'syncConfiguration'
  or not exists(select 1 from public.playlist_release_items item join private.referenced_publication_releases_v1(p_tenant_id)used on used.release_id=item.release_id
   where item.tenant_id=p_tenant_id and item.dynamic_snapshot_id=p_snapshot_id and item.live_data_enabled)
  then return;end if;
 initial_hash:=private.published_data_hash_v1(frozen.snapshot_data_json);
 if binding.content_hash=initial_hash and not exists(select 1 from private.sync_published_binary_state where tenant_id=p_tenant_id and configuration_snapshot_id=p_snapshot_id)then return;end if;
 insert into private.sync_published_binary_state(tenant_id,configuration_snapshot_id,snapshot_id,content_hash)
 values(p_tenant_id,p_snapshot_id,p_snapshot_id,initial_hash)on conflict do nothing;
 select *into cache from private.sync_published_binary_state where tenant_id=p_tenant_id and configuration_snapshot_id=p_snapshot_id;
 if cache.content_hash=binding.content_hash or cache.last_failed_hash=binding.content_hash then return;end if;
 -- A newer data generation already queued by ingestion takes precedence. It
 -- will coalesce all changes before scheduling the next bounded encode.
 insert into private.published_data_refresh_queue(tenant_id,snapshot_id,data_source_id,phase,binary_data_json,binary_hash,binary_revision,next_attempt_at)
 values(p_tenant_id,p_snapshot_id,binding.data_source_id,'binary',binding.data_json,binding.content_hash,binding.data_revision,
  greatest(clock_timestamp(),coalesce(cache.last_started_at+'5 minutes'::interval,clock_timestamp())))
 on conflict(tenant_id,snapshot_id)do nothing;
end;$$;
revoke all on function private.enqueue_sync_binary_cache_v1(uuid,uuid)from public,anon,authenticated,service_role;

-- Older data-only workers never claim a binary encode. The existing data
-- completion/ingestion generation guards remain the authority.
do $migration$
declare definition text;marker text:='where next_attempt_at<=clock_timestamp()';
begin
 select pg_get_functiondef('public.claim_published_data_refresh_v1(text,integer)'::regprocedure)into definition;
 if position(marker in definition)=0 then raise exception 'published claim phase precondition failed';end if;
 execute replace(definition,marker,'where phase=''data''and next_attempt_at<=clock_timestamp()');
end;$migration$;
-- Source ingestion can refresh facts while a future binary render is waiting.
-- It preserves an in-flight encode lease/generation, but an idle encode is
-- replaced by data work so DOM freshness never waits for the binary cooldown.
do $migration$
declare proc text;definition text;marker text:='next_attempt_at=least(private.published_data_refresh_queue.next_attempt_at,clock_timestamp());';
begin
 foreach proc in array array['private.enqueue_published_binding_v1(uuid,uuid)','private.refresh_published_data_v1(uuid,uuid)']loop
  select pg_get_functiondef(proc::regprocedure)into definition;
  if position(marker in definition)=0 then raise exception 'published enqueue phase precondition failed: %',proc;end if;
  execute replace(definition,marker,$phase$next_attempt_at=least(private.published_data_refresh_queue.next_attempt_at,clock_timestamp()),
    phase=case when private.published_data_refresh_queue.phase='binary'and private.published_data_refresh_queue.lease_until>clock_timestamp()then'binary'else'data'end,
    attempt_count=case when private.published_data_refresh_queue.phase='binary'and coalesce(private.published_data_refresh_queue.lease_until<=clock_timestamp(),true)then 0 else private.published_data_refresh_queue.attempt_count end;$phase$);
 end loop;
end;$migration$;
alter function public.complete_published_data_refresh_v1(uuid,uuid,uuid)rename to complete_published_data_before_binary_v1;
alter function public.complete_published_data_before_binary_v1(uuid,uuid,uuid)set schema private;
create function public.complete_published_data_refresh_v1(p_tenant_id uuid,p_snapshot_id uuid,p_lease_token uuid)returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if exists(select 1 from private.published_data_refresh_queue where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id and phase<>'data')then
  raise exception 'data lease required'using errcode='42501';end if;
 result:=private.complete_published_data_before_binary_v1(p_tenant_id,p_snapshot_id,p_lease_token);
 if result->>'status'='completed'then perform private.enqueue_sync_binary_cache_v1(p_tenant_id,p_snapshot_id);end if;
 return result;
end;$$;
revoke all on function private.complete_published_data_before_binary_v1(uuid,uuid,uuid),public.complete_published_data_refresh_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.complete_published_data_refresh_v1(uuid,uuid,uuid)to service_role;

alter table private.sync_published_binary_state
 add column cleanup_not_before timestamptz not null default now(),
 add column cleanup_attempt_count integer not null default 0 check(cleanup_attempt_count>=0);

create function public.claim_dynamic_render_job_v3(p_worker_id text,p_lock_timeout_seconds integer default 900,p_max_attempts integer default 3)
returns setof jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;work private.published_data_refresh_queue%rowtype;cache private.sync_published_binary_state%rowtype;
 selected_slot integer;old_slot_bytes bigint;lease_seconds integer:=least(600,greatest(60,p_lock_timeout_seconds));
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception 'service role required'using errcode='42501';end if;
 if nullif(btrim(p_worker_id),'')is null or length(p_worker_id)>120 or p_max_attempts not between 1 and 5 then raise exception 'worker options invalid'using errcode='22023';end if;
 select to_jsonb(claimed)into result from public.claim_dynamic_render_job_v2(p_worker_id,p_lock_timeout_seconds,p_max_attempts)claimed;
 if result is not null then return next result;return;end if;
 -- Cleanup stays in the existing dynamic worker rather than adding a poll or
 -- dropping references before private Storage has actually removed the bytes.
 select *into cache from private.sync_published_binary_state
 where snapshot_id is null and cleanup_not_before<=clock_timestamp()
  and(cleanup_lease_until is null or cleanup_lease_until<=clock_timestamp())
 order by cleanup_not_before,tenant_id,configuration_snapshot_id for update skip locked limit 1;
 if found then
  update private.sync_published_binary_state set cleanup_lease_token=gen_random_uuid(),cleanup_lease_until=clock_timestamp()+make_interval(secs=>lease_seconds),cleanup_worker=p_worker_id,cleanup_attempt_count=cleanup_attempt_count+1
  where tenant_id=cache.tenant_id and configuration_snapshot_id=cache.configuration_snapshot_id returning *into cache;
  return next jsonb_build_object('cleanup_only',true,'tenant_id',cache.tenant_id,'snapshot_id',cache.configuration_snapshot_id,'lease_token',cache.cleanup_lease_token,'slot_ids',cache.slot_ids);return;
 end if;
 -- A crashed last attempt must not leave a permanently runnable hint. Only a
 -- new content hash or explicit later source generation can make fresh work.
 for work in select *from private.published_data_refresh_queue
  where phase='binary'and attempt_count>=least(p_max_attempts,3)and(lease_until is null or lease_until<=clock_timestamp())
  order by requested_at for update skip locked limit 25
 loop
  update private.sync_published_binary_state set last_failed_hash=work.binary_hash,last_error_code='binary_retry_budget_exhausted'
   where tenant_id=work.tenant_id and configuration_snapshot_id=work.snapshot_id;
  if work.generation>coalesce(work.binary_generation,work.generation)then
   update private.published_data_refresh_queue set phase='data',attempt_count=0,lease_token=null,lease_until=null,locked_by=null,next_attempt_at=clock_timestamp()
    where tenant_id=work.tenant_id and snapshot_id=work.snapshot_id;
  else delete from private.published_data_refresh_queue where tenant_id=work.tenant_id and snapshot_id=work.snapshot_id;end if;
 end loop;
 select *into work from private.published_data_refresh_queue
 where phase='binary'and next_attempt_at<=clock_timestamp()and(lease_until is null or lease_until<=clock_timestamp())and attempt_count<least(p_max_attempts,3)
 order by next_attempt_at,requested_at,tenant_id,snapshot_id for update skip locked limit 1;
 if not found then return;end if;
 perform pg_advisory_xact_lock(hashtextextended('sync-binary-cache:'||work.tenant_id::text,0));
 select *into cache from private.sync_published_binary_state where tenant_id=work.tenant_id and configuration_snapshot_id=work.snapshot_id for update;
 if cache.snapshot_id is null then delete from private.published_data_refresh_queue where tenant_id=work.tenant_id and snapshot_id=work.snapshot_id;return;end if;
 select slot into selected_slot from generate_series(0,2)slot where slot is distinct from cache.current_slot and slot is distinct from cache.previous_slot order by slot limit 1;
 old_slot_bytes:=greatest(coalesce((cache.slot_artifacts#>>array[selected_slot::text,'byteLength'])::bigint,0)+coalesce((cache.slot_artifacts#>>array[selected_slot::text,'poster','byteLength'])::bigint,0),coalesce((cache.slot_reservations->>selected_slot::text)::bigint,0));
 if private.sync_binary_cache_bytes_v1(work.tenant_id)-old_slot_bytes+83886080>536870912 then
  update private.sync_published_binary_state set last_error_code='binary_cache_budget_unavailable'where tenant_id=work.tenant_id and configuration_snapshot_id=work.snapshot_id;
  update private.published_data_refresh_queue set next_attempt_at=clock_timestamp()+'5 minutes'::interval where tenant_id=work.tenant_id and snapshot_id=work.snapshot_id;return;
 end if;
 update private.published_data_refresh_queue set lease_token=gen_random_uuid(),lease_until=clock_timestamp()+make_interval(secs=>lease_seconds),locked_by=p_worker_id,attempt_count=attempt_count+1,binary_generation=generation,binary_slot=selected_slot
 where tenant_id=work.tenant_id and snapshot_id=work.snapshot_id returning *into work;
 -- Reserve before any upload. A crash or terminal failure can leave private
 -- partial bytes; their budget survives lease expiry until this same inactive
 -- prefix is cleaned/replaced or the retired cache is acknowledged removed.
 update private.sync_published_binary_state set last_started_at=clock_timestamp(),last_error_code=null,slot_reservations=jsonb_set(slot_reservations,array[selected_slot::text],'83886080'::jsonb)
 where tenant_id=work.tenant_id and configuration_snapshot_id=work.snapshot_id;
 select jsonb_build_object('published_refresh',true,'job_id',work.snapshot_id,'tenant_id',work.tenant_id,'snapshot_id',work.snapshot_id,
  'output_media_asset_id',cache.slot_ids[selected_slot+1],'slide_name',work.binary_data_json#>>'{syncConfiguration,seed,name}',
  'orientation',work.binary_data_json#>>'{syncConfiguration,seed,orientation}','markup',version.markup,'css',version.css,'manifest_json',version.manifest_json,
  'snapshot_data_json',work.binary_data_json,'template_version_id',snapshot.template_version_id,'template_slug',template.slug,
  'source_revision_hash',work.binary_hash,'dynamic_slide_version_id',snapshot.dynamic_slide_version_id,'lease_token',work.lease_token)
 into result from public.dynamic_slide_snapshots snapshot join public.dynamic_template_versions version on version.id=snapshot.template_version_id
 join public.dynamic_templates template on template.id=version.template_id where snapshot.tenant_id=work.tenant_id and snapshot.id=work.snapshot_id;
 if result is null then raise exception 'binary configuration unavailable'using errcode='23514';end if;
 return next result;
end;$$;

create function public.renew_sync_binary_render_v1(p_tenant_id uuid,p_snapshot_id uuid,p_worker_id text,p_lease_token uuid)returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception 'service role required'using errcode='42501';end if;
 update private.published_data_refresh_queue set lease_until=clock_timestamp()+'10 minutes'::interval
 where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id and phase='binary'and lease_token=p_lease_token and locked_by=p_worker_id and lease_until>clock_timestamp();
 return found;
end;$$;

create function public.fail_sync_binary_render_v1(p_tenant_id uuid,p_snapshot_id uuid,p_worker_id text,p_lease_token uuid,p_error_code text,p_retryable boolean)returns text
language plpgsql security definer set search_path='' as $$
declare work private.published_data_refresh_queue%rowtype;safe_code text;
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception 'service role required'using errcode='42501';end if;
 select *into work from private.published_data_refresh_queue where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id and phase='binary'and locked_by=p_worker_id and lease_token=p_lease_token and lease_until>clock_timestamp()for update;
 if not found then raise exception 'binary render lease lost'using errcode='55000';end if;
 safe_code:=case when p_error_code~'^[a-z0-9_]{1,80}$'then p_error_code else'binary_render_failed'end;
 update private.sync_published_binary_state set last_error_code=safe_code,last_failed_hash=case when not p_retryable or work.attempt_count>=3 then work.binary_hash else last_failed_hash end
 where tenant_id=p_tenant_id and configuration_snapshot_id=p_snapshot_id;
 if p_retryable and work.attempt_count<3 then
  update private.published_data_refresh_queue set lease_token=null,lease_until=null,locked_by=null,next_attempt_at=clock_timestamp()+make_interval(secs=>least(300,5*2^work.attempt_count)::integer)
   where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id;return 'queued';
 end if;
 if work.generation>work.binary_generation then
  update private.published_data_refresh_queue set phase='data',attempt_count=0,lease_token=null,lease_until=null,locked_by=null,next_attempt_at=clock_timestamp()
   where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id;
 else delete from private.published_data_refresh_queue where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id;end if;
 return 'failed';
end;$$;


create function public.complete_sync_binary_render_v1(p_tenant_id uuid,p_snapshot_id uuid,p_worker_id text,p_lease_token uuid,p_artifact jsonb)returns uuid
language plpgsql security definer set search_path='' as $$
declare work private.published_data_refresh_queue%rowtype;cache private.sync_published_binary_state%rowtype;
 job_record public.dynamic_render_jobs%rowtype;snapshot_record public.dynamic_slide_snapshots%rowtype;
 presentation jsonb:=p_artifact->'presentation';poster jsonb:=p_artifact->'poster';
 mime text:=p_artifact->>'mimeType';sha text:=p_artifact->>'checksumSha256';path text:=p_artifact->>'storagePath';
 bytes bigint;render_width integer;render_height integer;duration_ms integer;pages integer;is_video boolean;prefix text;
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception 'service role required'using errcode='42501';end if;
 select *into work from private.published_data_refresh_queue where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id and phase='binary'and lease_token=p_lease_token and locked_by=p_worker_id and lease_until>clock_timestamp()for update;
 if not found then raise exception 'binary render lease lost'using errcode='55000';end if;
 perform pg_advisory_xact_lock(hashtextextended('sync-binary-cache:'||p_tenant_id::text,0));
 select *into cache from private.sync_published_binary_state where tenant_id=p_tenant_id and configuration_snapshot_id=p_snapshot_id and snapshot_id=p_snapshot_id for update;
 select *into snapshot_record from public.dynamic_slide_snapshots where tenant_id=p_tenant_id and id=p_snapshot_id and status='ready';
 if cache.snapshot_id is null or snapshot_record.id is null or work.binary_slot is null or work.binary_revision<cache.data_revision then raise exception 'binary configuration changed'using errcode='55000';end if;
 -- A synthetic in-memory row supplies the current authorized facts to the
 -- existing complete-presentation guard. No snapshot is inserted or changed.
 snapshot_record.snapshot_data_json:=work.binary_data_json;snapshot_record.source_revision_hash:=work.binary_hash;
 job_record.tenant_id:=p_tenant_id;job_record.output_media_asset_id:=cache.slot_ids[work.binary_slot+1];
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

 if bytes>67108864 or(poster->>'byteLength')::bigint>16777216 then raise exception 'binary cache artifact budget exceeded'using errcode='23514';end if;
 update private.sync_published_binary_state set
  slot_artifacts=jsonb_set(slot_artifacts,array[work.binary_slot::text],p_artifact),slot_reservations=slot_reservations-work.binary_slot::text,previous_slot=current_slot,current_slot=work.binary_slot,
  content_hash=work.binary_hash,data_revision=work.binary_revision,last_failed_hash=null,last_error_code=null
 where tenant_id=p_tenant_id and configuration_snapshot_id=p_snapshot_id;
 if work.generation>work.binary_generation then
  update private.published_data_refresh_queue set phase='data',attempt_count=0,lease_token=null,lease_until=null,locked_by=null,next_attempt_at=clock_timestamp()
   where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id;
 else delete from private.published_data_refresh_queue where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id;end if;
 return job_record.output_media_asset_id;
end;$$;

create function public.finish_sync_binary_cleanup_v1(p_tenant_id uuid,p_snapshot_id uuid,p_worker_id text,p_lease_token uuid,p_success boolean)returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception 'service role required'using errcode='42501';end if;
 if p_success then
  delete from private.sync_published_binary_state where tenant_id=p_tenant_id and configuration_snapshot_id=p_snapshot_id and snapshot_id is null
   and cleanup_lease_token=p_lease_token and cleanup_worker=p_worker_id and cleanup_lease_until>clock_timestamp();return found;
 end if;
 update private.sync_published_binary_state set cleanup_lease_token=null,cleanup_lease_until=null,cleanup_worker=null,
  cleanup_not_before=clock_timestamp()+make_interval(secs=>least(300,5*2^least(cleanup_attempt_count,6))::integer),last_error_code='binary_storage_cleanup_failed'
 where tenant_id=p_tenant_id and configuration_snapshot_id=p_snapshot_id and snapshot_id is null and cleanup_lease_token=p_lease_token and cleanup_worker=p_worker_id and cleanup_lease_until>clock_timestamp();return found;
end;$$;

create function public.get_sync_binary_playback_v1(p_tenant_id uuid,p_snapshot_ids uuid[])returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception 'service role required'using errcode='42501';end if;
 if p_snapshot_ids is null or cardinality(p_snapshot_ids)>1000 then raise exception 'binary snapshot selection outside bounds'using errcode='22023';end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('snapshotId',cache.configuration_snapshot_id,'contentHash',cache.content_hash,'dataRevision',cache.data_revision,
  'artifact',case when cache.current_slot is null then snapshot.sync_render_result_json else cache.slot_artifacts->cache.current_slot::text end)),'[]'::jsonb)
  from private.sync_published_binary_state cache join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id=cache.tenant_id and snapshot.id=cache.snapshot_id
  where cache.tenant_id=p_tenant_id and cache.snapshot_id=any(p_snapshot_ids)and cache.data_revision>0);
end;$$;

create or replace function public.get_worker_queue_hint_v2(p_max_attempts integer default 3)returns integer
language sql stable security definer set search_path='' as $$
 select(public.get_render_queue_hint_v1(p_max_attempts)
  |case when exists(select 1 from private.published_data_refresh_queue where phase='binary'and next_attempt_at<=statement_timestamp()and(lease_until is null or lease_until<=statement_timestamp()))
   or exists(select 1 from private.sync_published_binary_state where snapshot_id is null and cleanup_not_before<=statement_timestamp()and(cleanup_lease_until is null or cleanup_lease_until<=statement_timestamp()))then 4 else 0 end)
  +case when exists(select 1 from private.published_data_refresh_queue where phase='data'and next_attempt_at<=statement_timestamp()and(lease_until is null or lease_until<=statement_timestamp()))then 8 else 0 end
  +case when exists(select 1 from private.publication_version_prune_queue where pending and not_before<=statement_timestamp())then 16 else 0 end;
$$;

revoke all on function public.claim_dynamic_render_job_v3(text,integer,integer),public.renew_sync_binary_render_v1(uuid,uuid,text,uuid),public.fail_sync_binary_render_v1(uuid,uuid,text,uuid,text,boolean),public.complete_sync_binary_render_v1(uuid,uuid,text,uuid,jsonb),public.finish_sync_binary_cleanup_v1(uuid,uuid,text,uuid,boolean),public.get_sync_binary_playback_v1(uuid,uuid[])from public,anon,authenticated,service_role;
grant execute on function public.claim_dynamic_render_job_v3(text,integer,integer),public.renew_sync_binary_render_v1(uuid,uuid,text,uuid),public.fail_sync_binary_render_v1(uuid,uuid,text,uuid,text,boolean),public.complete_sync_binary_render_v1(uuid,uuid,text,uuid,jsonb),public.finish_sync_binary_cleanup_v1(uuid,uuid,text,uuid,boolean),public.get_sync_binary_playback_v1(uuid,uuid[])to service_role;

-- A completed encode changes delivery independently of the already refreshed
-- canonical facts. Include only its acknowledged identity in the existing
-- device-authorized MVCC bootstrap, including composition zones, so an earlier
-- conditional manifest cannot hide the ready bytes behind a 304 response.
do $binary_manifest_identity$
declare definition text;marker text:='data.snapshot_id::text||'':''||data.data_revision::text';
begin
 select pg_get_functiondef('public.get_player_effective_target_v1(text)'::regprocedure)into definition;
 if position(marker in definition)=0 then raise exception 'binary manifest identity precondition failed';end if;
 execute replace(definition,marker,marker||$identity$||coalesce((select ':binary:'||cache.data_revision::text||':'||cache.content_hash||':'||(cache.slot_artifacts#>>array[cache.current_slot::text,'checksumSha256'])
  from private.sync_published_binary_state cache where cache.tenant_id=data.tenant_id and cache.snapshot_id=data.snapshot_id and cache.current_slot is not null and cache.data_revision>0),'')$identity$);
end;$binary_manifest_identity$;

-- Existing live Source publications enter the same data coalescer once. This
-- does not fetch providers, create content history, enable a rollout flag, or
-- render unchanged canonical facts.
select private.enqueue_published_binding_v1(binding.tenant_id,binding.snapshot_id)
 from public.published_dynamic_data binding join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id=binding.tenant_id and snapshot.id=binding.snapshot_id
 where snapshot.snapshot_data_json?'syncConfiguration'and exists(select 1 from public.playlist_release_items item
  join private.referenced_publication_releases_v1(binding.tenant_id)used on used.release_id=item.release_id
  where item.tenant_id=binding.tenant_id and item.dynamic_snapshot_id=binding.snapshot_id and item.live_data_enabled);
notify pgrst,'reload schema';
