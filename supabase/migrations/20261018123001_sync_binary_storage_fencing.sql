-- SQL completion fencing alone cannot fence a delayed Storage delete. Each
-- attempt now owns unique flat filenames and a durable, independently counted
-- reservation. Unknown old writers require operator drain before reclamation.
alter table private.sync_published_binary_state add column attempt_reservations jsonb not null default '{}'::jsonb
 check(jsonb_typeof(attempt_reservations)='object' and pg_column_size(attempt_reservations)<=10000);

create or replace function private.sync_binary_cache_bytes_v1(p_tenant_id uuid)returns bigint
language sql stable security definer set search_path='' as $$
 select coalesce(sum((select coalesce(sum(
  coalesce((state.slot_artifacts#>>array[slot::text,'byteLength'])::bigint,0)+coalesce((state.slot_artifacts#>>array[slot::text,'poster','byteLength'])::bigint,0)
  +coalesce((state.slot_reservations->>slot::text)::bigint,0)),0)from generate_series(0,2)slot)
  +(select coalesce(sum((value->>'reservedBytes')::bigint),0)from jsonb_each(state.attempt_reservations))),0)::bigint
 from private.sync_published_binary_state state where state.tenant_id=p_tenant_id
$$;
revoke all on function private.sync_binary_cache_bytes_v1(uuid)from public,anon,authenticated,service_role;

do $fence_claim$
declare definition text;marker text;
begin
 select pg_get_functiondef('public.claim_dynamic_render_job_v3(text,integer,integer)'::regprocedure)into definition;
 marker:='if private.sync_binary_cache_bytes_v1(work.tenant_id)-old_slot_bytes+83886080>536870912 then';
 if position(marker in definition)=0 then raise exception 'binary reservation claim precondition failed';end if;
 definition:=replace(definition,marker,$replacement$if private.sync_binary_cache_bytes_v1(work.tenant_id)+83886080>536870912
 or(select count(*)from jsonb_each(cache.attempt_reservations)where(value->>'slot')::integer=selected_slot)>=3 then$replacement$);
 marker:='slot_reservations=jsonb_set(slot_reservations,array[selected_slot::text],''83886080''::jsonb)';
 if position(marker in definition)=0 then raise exception 'binary reservation write precondition failed';end if;
 definition:=replace(definition,marker,$replacement$attempt_reservations=jsonb_set(attempt_reservations,array[work.lease_token::text],jsonb_build_object('slot',selected_slot,'reservedBytes',83886080))$replacement$);
 execute definition;
end;$fence_claim$;

create function public.validate_sync_binary_storage_v1(p_tenant_id uuid,p_snapshot_id uuid,p_lease_token uuid,p_slot_id uuid)returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception 'service role required'using errcode='42501';end if;
 return exists(select 1 from private.published_data_refresh_queue work
 join private.sync_published_binary_state cache on cache.tenant_id=work.tenant_id and cache.snapshot_id=work.snapshot_id
 where work.tenant_id=p_tenant_id and work.snapshot_id=p_snapshot_id and work.phase='binary'
 and work.lease_token=p_lease_token and work.lease_until>clock_timestamp()
 and cache.slot_ids[work.binary_slot+1]=p_slot_id
 and work.binary_slot is distinct from cache.current_slot and work.binary_slot is distinct from cache.previous_slot
 and cache.attempt_reservations?p_lease_token::text);
end;$$;
revoke all on function public.validate_sync_binary_storage_v1(uuid,uuid,uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.validate_sync_binary_storage_v1(uuid,uuid,uuid,uuid)to service_role;

do $fence_completion$
declare definition text;marker text;
begin
 select pg_get_functiondef('public.complete_sync_binary_render_v1(uuid,uuid,text,uuid,jsonb)'::regprocedure)into definition;
 marker:='prefix:=''tenants/''||job_record.tenant_id::text||''/assets/''||job_record.output_media_asset_id::text||''/sync-dynamic/'';';
 if position(marker in definition)=0 then raise exception 'binary filename fence precondition failed';end if;
 definition:=replace(definition,marker,replace(marker,'/sync-dynamic/'';','/sync-dynamic/''||work.lease_token::text||''-'';'));
 marker:='slot_reservations=slot_reservations-work.binary_slot::text,previous_slot=current_slot';
 if position(marker in definition)=0 then raise exception 'binary completion reservation precondition failed';end if;
 definition:=replace(definition,marker,'slot_reservations=slot_reservations,attempt_reservations=attempt_reservations-work.lease_token::text,previous_slot=current_slot');
 execute definition;
end;$fence_completion$;

-- A retired listing is not proof that a suspended writer can no longer write.
-- Retain its budget/references and stop frequent retrying until operator drain.
do $fence_retirement$
declare definition text;marker text;
begin
 select pg_get_functiondef('public.finish_sync_binary_cleanup_v1(uuid,uuid,text,uuid,boolean)'::regprocedure)into definition;
 marker:='if p_success then';
 if position(marker in definition)=0 then raise exception 'binary cleanup fence precondition failed';end if;
 definition:=replace(definition,marker,$replacement$if p_success then
  update private.sync_published_binary_state set slot_artifacts='{}'::jsonb,current_slot=null,previous_slot=null,
   cleanup_lease_token=null,cleanup_lease_until=null,cleanup_worker=null,cleanup_not_before=clock_timestamp()+'1 day'::interval,last_error_code='binary_writer_drain_required'
   where tenant_id=p_tenant_id and configuration_snapshot_id=p_snapshot_id and snapshot_id is null
   and(attempt_reservations<>'{}'::jsonb or slot_reservations<>'{}'::jsonb)and cleanup_lease_token=p_lease_token and cleanup_worker=p_worker_id and cleanup_lease_until>clock_timestamp();
  if found then return true;end if;$replacement$);
 execute definition;
end;$fence_retirement$;
