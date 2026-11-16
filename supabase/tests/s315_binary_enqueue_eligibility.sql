begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create temporary table eligibility_snapshots as select *from public.dynamic_slide_snapshots with no data;
create temporary table eligibility_bindings as select *from public.published_dynamic_data with no data;
create temporary table eligibility_items as select *from public.playlist_release_items with no data;
create temporary table eligibility_cache(like private.sync_published_binary_state including defaults);
create temporary table eligibility_queue(like private.published_data_refresh_queue including defaults);
alter table eligibility_cache add primary key(tenant_id,configuration_snapshot_id);
alter table eligibility_queue add primary key(tenant_id,snapshot_id);
create function pg_temp.eligibility_releases(uuid)returns table(release_id uuid)language sql as $$select '31500000-0000-4000-8000-000000000010'::uuid$$;
do $fixture$
declare definition text;
begin
 select pg_get_functiondef('private.enqueue_sync_binary_before_dom_v2(uuid,uuid)'::regprocedure)into definition;
 definition:=replace(definition,'private.enqueue_sync_binary_before_dom_v2','pg_temp.enqueue_under_test');
 definition:=replace(definition,'public.dynamic_slide_snapshots','pg_temp.eligibility_snapshots');
 definition:=replace(definition,'public.published_dynamic_data','pg_temp.eligibility_bindings');
 definition:=replace(definition,'public.playlist_release_items','pg_temp.eligibility_items');
 definition:=replace(definition,'private.sync_published_binary_state','pg_temp.eligibility_cache');
 definition:=replace(definition,'private.published_data_refresh_queue','pg_temp.eligibility_queue');
 definition:=replace(definition,'private.referenced_publication_releases_v1','pg_temp.eligibility_releases');
 execute definition;
end;$fixture$;
create function pg_temp.probe_binary_eligibility(payload jsonb)returns integer language plpgsql as $probe$
declare result integer;
begin
 truncate pg_temp.eligibility_snapshots,pg_temp.eligibility_bindings,pg_temp.eligibility_items,pg_temp.eligibility_cache,pg_temp.eligibility_queue;
 insert into pg_temp.eligibility_snapshots(id,tenant_id,status,data_source_id,snapshot_data_json)
 values('31500000-0000-4000-8000-000000000002','31500000-0000-4000-8000-000000000001','ready','31500000-0000-4000-8000-000000000003',payload);
 insert into pg_temp.eligibility_bindings(snapshot_id,tenant_id,data_source_id,data_json,content_hash,data_revision)
 values('31500000-0000-4000-8000-000000000002','31500000-0000-4000-8000-000000000001','31500000-0000-4000-8000-000000000003',payload,repeat('f',64),1);
 insert into pg_temp.eligibility_items(tenant_id,dynamic_snapshot_id,release_id,live_data_enabled)
 values('31500000-0000-4000-8000-000000000001','31500000-0000-4000-8000-000000000002','31500000-0000-4000-8000-000000000010',true);
 perform pg_temp.enqueue_under_test('31500000-0000-4000-8000-000000000001','31500000-0000-4000-8000-000000000002');
 select count(*)::integer into result from pg_temp.eligibility_queue;
 return result;
end;$probe$;
select is(pg_temp.probe_binary_eligibility('{"type":"price_list","menuDocument":{}}'),0,'an unversioned Menu cannot allocate an unsupported binary job');
select is((select count(*)from eligibility_cache),0::bigint,'an unversioned Menu creates no rendercache state');
select is(pg_temp.probe_binary_eligibility('{"type":"price_list","menuDocument":{},"syncPlaybackProtocol":null}'),0,'an explicit null protocol fails closed');
select is(pg_temp.probe_binary_eligibility('{"type":"price_list","menuDocument":{},"syncPlaybackProtocol":1}'),0,'historical Menu PNG publications are not reinterpreted as Menu DOM');
select is(pg_temp.probe_binary_eligibility('{"type":"price_list","menuDocument":{},"syncPlaybackProtocol":2}'),1,'a real protocol-2 Menu retains its binary fallback lane');
select is(pg_temp.probe_binary_eligibility('{"type":"news","syncConfiguration":{}}'),1,'existing unversioned Source refreshes keep their historical contract');
select is(pg_temp.probe_binary_eligibility('{"type":"news","syncConfiguration":{},"syncPlaybackProtocol":1}'),1,'protocol-1 Source refresh remains supported');
select is(pg_temp.probe_binary_eligibility('{"type":"news","syncConfiguration":{},"syncPlaybackProtocol":2}'),1,'protocol-2 Source export remains supported');
select is(pg_temp.probe_binary_eligibility('{"type":"price_list","syncPlaybackProtocol":2}'),0,'protocol 2 without a MenuDocument is not a Menu export');
select ok(not has_function_privilege('anon','private.enqueue_sync_binary_before_dom_v2(uuid,uuid)','execute'),'anonymous roles still cannot enqueue private work');
select ok(not has_function_privilege('authenticated','private.enqueue_sync_binary_before_dom_v2(uuid,uuid)','execute'),'tenant browsers still cannot enqueue private work');
select ok(not has_function_privilege('service_role','private.enqueue_sync_binary_before_dom_v2(uuid,uuid)','execute'),'Worker calls remain behind their guarded RPC boundary');
select *from finish();
rollback;
