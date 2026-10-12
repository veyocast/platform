begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
set local statement_timeout='45s';
select set_config('request.jwt.claim.role','service_role',true);

select ok(not has_function_privilege('anon','private.publication_authoring_uuid_refs_v1(jsonb)','EXECUTE')
  and not has_function_privilege('authenticated','private.publication_prune_page_v1(uuid,text,timestamptz,uuid,integer)','EXECUTE')
  and not has_function_privilege('service_role','public.prune_versions_before_composition_v1(uuid,integer)','EXECUTE'),
  'index and page helpers and the composition inner command have no client bypass');
select is(private.publication_authoring_uuid_refs_v1('{"a":{"note":"prefix a1920000-0000-4000-8000-000000000001 suffix"},"key-a1920000-0000-4000-8000-000000000002":"other","dupe":"a1920000-0000-4000-8000-000000000001"}'),
  array['a1920000-0000-4000-8000-000000000001'::uuid,'a1920000-0000-4000-8000-000000000002'::uuid],
  'indexed authoring reachability preserves nested strings, keys, substring UUIDs and deduplicates');

-- Synthetic production-sized technical history, never provider/person records.
insert into public.tenants(id,name,slug) values ('a1910000-0000-4000-8000-000000002001','S191 latency isolated fixture','s191-latency-isolated');
insert into public.dynamic_data_sources(id,tenant_id,name,kind,status,provider_status,config_json)
values('a1910000-0000-4000-8000-000000002002','a1910000-0000-4000-8000-000000002001','Retention Sportlink','sportlink','active','ready','{}');
insert into public.dynamic_slides(id,tenant_id,name,slide_type,orientation,template_id,template_version_id,
  data_source_id,selection_mode,status,configuration_json)
select 'a1910000-0000-4000-8000-000000002003','a1910000-0000-4000-8000-000000002001','Retention standings',
  'sport_standing','landscape',template.id,version.id,'a1910000-0000-4000-8000-000000002002','latest','draft',
  '{"schemaVersion":1,"blueprintKey":"sportlink.pool_standings","title":"Poulestand","context":{"competitionId":null,"competitionSelectionMode":"auto_current","phaseId":null,"poolId":null,"providerTeamId":"jo17","seasonId":null},"display":{"columns":"two","showDressingRoom":false,"showField":true,"showHomeAway":true,"showReferee":false},"editorial":{"schemaVersion":2,"themeSelection":{"ref":{"catalog":"v2","id":"fieldflow","version":"1.0.0"},"modePolicy":{"kind":"fixed","mode":"light"},"accent":null,"support":null,"categoryOverrides":[]}},"maxItems":40}'::jsonb
from public.dynamic_templates template join public.dynamic_template_versions version on version.id=template.current_published_version_id
where template.slide_type='sport_standing' and template.orientation='landscape' and template.status='published' limit 1;
insert into public.dynamic_slide_snapshots(id,tenant_id,dynamic_slide_id,template_version_id,data_source_id,
  source_revision_hash,snapshot_data_json,status,completed_at)
select ('a1920000-0000-4000-8000-'||lpad(number::text,12,'0'))::uuid,slide.tenant_id,slide.id,
  slide.template_version_id,slide.data_source_id,lpad(number::text,64,'a'),
  '{"type":"sport_standing","sport":{"title":"Frozen v1","items":[]}}','ready',now()
from public.dynamic_slides slide cross join generate_series(1,21909) number where slide.id='a1910000-0000-4000-8000-000000002003';

update public.dynamic_slides set current_snapshot_id='a1920000-0000-4000-8000-000000021909',status='ready'
where id='a1910000-0000-4000-8000-000000002003';
insert into public.playlists(id,tenant_id,name) values ('a1910000-0000-4000-8000-000000002005','a1910000-0000-4000-8000-000000002001','Synthetic history');
insert into public.playlist_releases(id,tenant_id,playlist_id,version,manifest_hash,manifest_json,item_count,total_duration_seconds,total_bytes)
select ('a1930000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'a1910000-0000-4000-8000-000000002001','a1910000-0000-4000-8000-000000002005',n,repeat('a',64),'{}',1,10,100 from generate_series(1,1218)n;
insert into public.playlist_release_authoring_snapshots(tenant_id,playlist_id,release_id,snapshot_json,snapshot_hash)
select tenant_id,playlist_id,id,jsonb_build_object('syntheticContent',repeat('x',2000))
  ||case when version=1218 then jsonb_build_object('pinnedSnapshots',(select jsonb_agg(id order by id)
    from public.dynamic_slide_snapshots where tenant_id='a1910000-0000-4000-8000-000000002001'
      and id<='a1920000-0000-4000-8000-000000000300')) else '{}'::jsonb end,repeat('a',64)
from public.playlist_releases where tenant_id='a1910000-0000-4000-8000-000000002001';
analyze public.dynamic_slide_snapshots;
analyze public.playlist_release_authoring_snapshots;
insert into public.sportlink_connections(id,tenant_id,data_source_id,client_id_suffix,encrypted_client_id,encryption_iv,encryption_tag)
values('a1910000-0000-4000-8000-000000002004','a1910000-0000-4000-8000-000000002001','a1910000-0000-4000-8000-000000002002','TEST','synthetic-only','synthetic-only','synthetic-only');
insert into public.sports_matches(tenant_id,source_connection_id,external_id,starts_at,status,home_team,away_team)
select 'a1910000-0000-4000-8000-000000002001','a1910000-0000-4000-8000-000000002004','synthetic-'||n,
now()+interval '1 hour','scheduled','{"name":"Synthetic home"}','{"name":"Synthetic away"}' from generate_series(1,5000)n;

insert into public.media_assets(id,tenant_id,kind,title,original_file_name,mime_type,status,storage_path,
  file_size_bytes,checksum_sha256,width,height) values
  ('a1910000-0000-4000-8000-000000002006','a1910000-0000-4000-8000-000000002001','image','Synthetic fallback','synthetic.png','image/png','ready',
  'tenants/a1910000-0000-4000-8000-000000002001/assets/a1910000-0000-4000-8000-000000002006/original.png',100,repeat('d',64),1920,1080);
insert into public.media_variants(id,tenant_id,asset_id,variant_type,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height)
select 'a1910000-0000-4000-8000-000000002007',tenant_id,id,'original',storage_path,mime_type,file_size_bytes,checksum_sha256,width,height
  from public.media_assets where id='a1910000-0000-4000-8000-000000002006';
insert into public.playlist_release_items(tenant_id,playlist_id,release_id,media_asset_id,media_variant_id,
  sort_order,duration_seconds,fit_mode,muted,asset_kind,asset_title,storage_path,mime_type,file_size_bytes,checksum_sha256,
  dynamic_snapshot_id,live_data_enabled)
select asset.tenant_id,'a1910000-0000-4000-8000-000000002005','a1930000-0000-4000-8000-000000001218',asset.id,variant.id,
  row_number()over(order by snapshot.id)-1,10,'contain',true,asset.kind,asset.title,asset.storage_path,asset.mime_type,asset.file_size_bytes,asset.checksum_sha256,
  snapshot.id,true
from public.media_assets asset join public.media_variants variant on variant.asset_id=asset.id
cross join public.dynamic_slide_snapshots snapshot where asset.id='a1910000-0000-4000-8000-000000002006'
  and snapshot.tenant_id=asset.tenant_id and snapshot.id>='a1920000-0000-4000-8000-000000021857';
insert into public.sportlink_sync_runs(id,tenant_id,connection_id,dataset_group,status,worker_id,locked_at)
values('a1910000-0000-4000-8000-000000002008','a1910000-0000-4000-8000-000000002001',
  'a1910000-0000-4000-8000-000000002004','club_profile','running','worker:s191-latency',now());
create temp table s191_latency_before as select
  (select count(*) from public.dynamic_slide_versions where tenant_id='a1910000-0000-4000-8000-000000002001')version_count,
  (select count(*) from public.dynamic_slide_snapshots where tenant_id='a1910000-0000-4000-8000-000000002001')snapshot_count,
  (select md5(snapshot_data_json::text) from public.dynamic_slide_snapshots where id='a1920000-0000-4000-8000-000000021909')frozen_hash,
  (select release_id from public.playlist_publications where playlist_id='a1910000-0000-4000-8000-000000002005')release_id;

-- A deadline, runtime call budget and actual FK deletions catch the original
-- unbounded work. The deadline applies only after fixture construction.
set local statement_timeout='8s';
select lives_ok($$select public.complete_sportlink_sync_v4('a1910000-0000-4000-8000-000000002008','worker:s191-latency',
  '{"externalId":"synthetic-club","name":"Synthetic club"}')$$,
  'real v4 completion stores normalized data and queues 53 live bindings within the database deadline despite historical scale');
select is((select status from public.sportlink_sync_runs where id='a1910000-0000-4000-8000-000000002008'),'succeeded',
  'completion is committed through the existing leased run contract');
select is((select count(*) from private.published_data_refresh_queue where tenant_id='a1910000-0000-4000-8000-000000002001'),53::bigint,
  'every live binding receives durable refresh work through the database');
select is((select count(*) from public.dynamic_slide_versions where tenant_id='a1910000-0000-4000-8000-000000002001'),
  (select version_count from s191_latency_before),'provider completion creates no design versions');
select is((select count(*) from public.dynamic_slide_snapshots where tenant_id='a1910000-0000-4000-8000-000000002001'),
  (select snapshot_count from s191_latency_before),'provider completion creates no render snapshots');

-- Transaction-only instrumentation counts real predicate calls. No extension
-- or role-wide statistics setting is required, and every change rolls back.
create temp table s191_snapshot_reference_call_count(calls bigint not null);
insert into s191_snapshot_reference_call_count values(0);
alter function private.publication_snapshot_is_referenced_v1(uuid,uuid,uuid)
  rename to publication_snapshot_latency_test_original_v1;
create function private.publication_snapshot_is_referenced_v1(p_tenant_id uuid,p_snapshot_id uuid,p_ignored_version_id uuid default null)
returns boolean language plpgsql volatile security definer set search_path='' as $$
begin
  update pg_temp.s191_snapshot_reference_call_count set calls=calls+1;
  return private.publication_snapshot_latency_test_original_v1(p_tenant_id,p_snapshot_id,p_ignored_version_id);
end $$;
revoke all on function private.publication_snapshot_is_referenced_v1(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create temp table s191_latency_calls(label text,calls bigint);
insert into s191_latency_calls select 'before',(select calls from s191_snapshot_reference_call_count);
create temp table s191_latency_results(label text,result jsonb);
insert into s191_latency_results values('page1',public.prune_superseded_publication_versions_v1('a1910000-0000-4000-8000-000000002001',25));
insert into s191_latency_calls select 'after',(select calls from s191_snapshot_reference_call_count);
select ok((select calls from s191_latency_calls where label='after')-(select calls from s191_latency_calls where label='before')<=200,
  'one protected page evaluates at most 100 candidates plus 100 bounded remaining checks instead of all 21909');
select is((select result->>'snapshotsDeleted' from s191_latency_results where label='page1'),'0',
  'the first authoring-pinned prefix is preserved without walking to a later eligible row');
select ok((select snapshot_scan_id='a1920000-0000-4000-8000-000000000100' from private.publication_version_prune_queue
  where tenant_id='a1910000-0000-4000-8000-000000002001'),'cursor advances past the complete protected page');
select ok((select pending from private.publication_version_prune_queue where tenant_id='a1910000-0000-4000-8000-000000002001'),
  'a full protected page keeps the next bounded page queued');
select is((select result->>'prunedCompositions' from s191_latency_results where label='page1'),'0',
  'the existing public composition-first pruning wrapper remains active');
insert into s191_latency_results values('page2',public.prune_superseded_publication_versions_v1('a1910000-0000-4000-8000-000000002001',25));
insert into s191_latency_results values('page3',public.prune_superseded_publication_versions_v1('a1910000-0000-4000-8000-000000002001',25));
insert into s191_latency_results values('page4',public.prune_superseded_publication_versions_v1('a1910000-0000-4000-8000-000000002001',25));
select is((select result->>'snapshotsDeleted' from s191_latency_results where label='page4'),'25',
  'subsequent bounded passes reach and delete eligible history beyond 300 protected candidates');
select is((select count(*) from public.dynamic_slide_snapshots where tenant_id='a1910000-0000-4000-8000-000000002001'
  and id<='a1920000-0000-4000-8000-000000000300'),300::bigint,'all authoring restore references remain available');
select is((select count(*) from public.published_dynamic_data where tenant_id='a1910000-0000-4000-8000-000000002001'),53::bigint,
  'all current published datasets survive history cleanup');
select is((select md5(snapshot_data_json::text) from public.dynamic_slide_snapshots where id='a1920000-0000-4000-8000-000000021909'),
  (select frozen_hash from s191_latency_before),'immutable current fallback payload retains its exact bytes');
select is((select release_id from public.playlist_publications where playlist_id='a1910000-0000-4000-8000-000000002005'),
  (select release_id from s191_latency_before),'current publication identity remains stable');
select is((select count(*) from private.publication_version_prune_context),0::bigint,'completed pages leave no reusable deletion authority');
select is((select count(*) from private.composition_prune_context),0::bigint,'composition wrapper also clears its private authority');
-- The exact queue write used by composition publish/ack must reset an active
-- sweep, while maintenance timestamps must preserve page progress.
update private.publication_version_prune_queue set updated_at=clock_timestamp()
  where tenant_id='a1910000-0000-4000-8000-000000002001';
select ok((select snapshot_scan_id='a1920000-0000-4000-8000-000000000300'
  from private.publication_version_prune_queue where tenant_id='a1910000-0000-4000-8000-000000002001'),
  'maintenance timestamps preserve the cursor for the remaining eligible page');
insert into private.publication_version_prune_queue(tenant_id) values('a1910000-0000-4000-8000-000000002001')
  on conflict(tenant_id) do update set pending=true,requested_at=clock_timestamp(),not_before=clock_timestamp(),updated_at=clock_timestamp();
select ok((select release_scan_id is null and version_scan_id is null and snapshot_scan_id is null
  and not release_scan_complete and not version_scan_complete and not snapshot_scan_complete
  from private.publication_version_prune_queue where tenant_id='a1910000-0000-4000-8000-000000002001'),
  'direct composition-style reenqueue resets every middle-of-sweep cursor immediately');

-- A retained old design can itself own thousands of snapshots. Its guard
-- must check the reference set once, not call a JSON scan for every snapshot.
insert into public.dynamic_slide_versions(id,tenant_id,dynamic_slide_id,version_number,status,name,slide_type,
  orientation,template_id,template_version_id,data_source_id,selection_mode,configuration_json,theme_selection_json,based_on_version_id)
select 'a1910000-0000-4000-8000-000000002009',tenant_id,dynamic_slide_id,2,'publishing',name,slide_type,
  orientation,template_id,template_version_id,data_source_id,selection_mode,configuration_json,theme_selection_json,id
from public.dynamic_slide_versions where dynamic_slide_id='a1910000-0000-4000-8000-000000002003' and version_number=1;
update public.dynamic_slides set active_draft_version_id='a1910000-0000-4000-8000-000000002009'
  where id='a1910000-0000-4000-8000-000000002003';
insert into public.dynamic_slide_snapshots(id,tenant_id,dynamic_slide_id,template_version_id,data_source_id,
  source_revision_hash,snapshot_data_json,status,completed_at)
select 'a1920000-0000-4000-8000-000000021910',tenant_id,id,template_version_id,data_source_id,repeat('b',64),
  '{"type":"sport_standing","sport":{"title":"Synthetic successor","items":[]}}','ready',now()
from public.dynamic_slides where id='a1910000-0000-4000-8000-000000002003';
update public.dynamic_slides set current_snapshot_id='a1920000-0000-4000-8000-000000021910'
  where id='a1910000-0000-4000-8000-000000002003';
select is(private.publication_version_can_prune_v1('a1910000-0000-4000-8000-000000002001',
  (select id from public.dynamic_slide_versions where dynamic_slide_id='a1910000-0000-4000-8000-000000002003' and version_number=1)),
  false,'set-based old-version reachability preserves all authoring/live references within the deadline at historical scale');
select ok((select release_scan_id is null and version_scan_id is null and snapshot_scan_id is null
  and not release_scan_complete and not version_scan_complete and not snapshot_scan_complete
  from private.publication_version_prune_queue where tenant_id='a1910000-0000-4000-8000-000000002001'),
  'publishing a successor invalidates all active sweep cursors so newly released references are rechecked');
-- A second tenant proves deletion budgets also resume within an entirely
-- eligible page, and finished phases stay quiet while snapshots drain.
insert into public.tenants(id,name,slug) values('a1911000-0000-4000-8000-000000002001','S191 drain fixture','s191-drain-fixture');
insert into public.dynamic_data_sources(id,tenant_id,name,kind,status,provider_status,config_json)
values('a1911000-0000-4000-8000-000000002002','a1911000-0000-4000-8000-000000002001','Synthetic drain source','sportlink','active','ready','{}');
insert into public.dynamic_slides(id,tenant_id,name,slide_type,orientation,template_id,template_version_id,data_source_id,
  selection_mode,status,configuration_json)
select 'a1911000-0000-4000-8000-000000002003','a1911000-0000-4000-8000-000000002001','Synthetic drain standing',slide_type,
  orientation,template_id,template_version_id,'a1911000-0000-4000-8000-000000002002',selection_mode,'draft',configuration_json
from public.dynamic_slides where id='a1910000-0000-4000-8000-000000002003';
insert into public.dynamic_slide_snapshots(id,tenant_id,dynamic_slide_id,template_version_id,data_source_id,source_revision_hash,
  snapshot_data_json,status,completed_at)
select ('a1921000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,tenant_id,id,template_version_id,data_source_id,
  lpad(n::text,64,'a'),'{"type":"sport_standing","sport":{"title":"Synthetic drain","items":[]}}','ready',now()
from public.dynamic_slides cross join generate_series(1,226)n where id='a1911000-0000-4000-8000-000000002003';
update public.dynamic_slides set current_snapshot_id='a1921000-0000-4000-8000-000000000226',status='ready'
  where id='a1911000-0000-4000-8000-000000002003';
create temp table s191_other_tenant_count as select count(*)count from public.dynamic_slide_snapshots
  where tenant_id='a1910000-0000-4000-8000-000000002001';
insert into s191_latency_results values('drain1',public.prune_superseded_publication_versions_v1('a1911000-0000-4000-8000-000000002001',25));
select is((select result->>'snapshotsDeleted' from s191_latency_results where label='drain1'),'25',
  'an entirely eligible 100-candidate page still deletes at most the requested 25 snapshots');
select ok((select snapshot_scan_id is null and release_scan_complete and version_scan_complete
  from private.publication_version_prune_queue where tenant_id='a1911000-0000-4000-8000-000000002001'),
  'eligible rows left in the first page keep its cursor while finished release/version phases stop');
do $$begin
  for batch in 2..9 loop
    perform public.prune_superseded_publication_versions_v1('a1911000-0000-4000-8000-000000002001',25);
  end loop;
end $$;
select is((select count(*) from public.dynamic_slide_snapshots where tenant_id='a1911000-0000-4000-8000-000000002001'),1::bigint,
  'nine bounded passes eventually delete all 225 obsolete snapshots without skipping remaining page entries');
select ok(exists(select 1 from public.dynamic_slide_snapshots where id='a1921000-0000-4000-8000-000000000226'),
  'the final current fallback remains pinned after the eligible pages drain');
select ok((select not pending and release_scan_id is null and version_scan_id is null and snapshot_scan_id is null
  and not release_scan_complete and not version_scan_complete and not snapshot_scan_complete
  from private.publication_version_prune_queue where tenant_id='a1911000-0000-4000-8000-000000002001'),
  'exhausted sweep clears pending and resets all phase state for the low-frequency resweep');
select is((select count(*) from public.dynamic_slide_snapshots where tenant_id='a1910000-0000-4000-8000-000000002001'),
  (select count from s191_other_tenant_count),'tenant B draining never deletes tenant A history');
-- A saved reusable template remains a reference after its source item is
-- removed. All fixtures below are a separate synthetic tenant and roll back.
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
values('a1912000-0000-4000-8000-000000002001','authenticated','authenticated','s191-template-retention@veyocast.test','test',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name)values('a1912000-0000-4000-8000-000000002001','Synthetic template owner');
insert into public.tenants(id,name,slug)values('a1912000-0000-4000-8000-000000002001','S191 template-only fixture','s191-template-only-fixture');
insert into public.tenant_settings(tenant_id)values('a1912000-0000-4000-8000-000000002001');
insert into public.tenant_memberships(tenant_id,user_id,role)values('a1912000-0000-4000-8000-000000002001','a1912000-0000-4000-8000-000000002001','tenant_owner');
insert into public.dynamic_data_sources(id,tenant_id,name,kind,status,provider_status,config_json)
values('a1912000-0000-4000-8000-000000002002','a1912000-0000-4000-8000-000000002001','Synthetic template source','sportlink','active','ready','{}');
insert into public.media_assets(id,tenant_id,kind,title,original_file_name,mime_type,status,storage_path,file_size_bytes,checksum_sha256,width,height)
values('a1912000-0000-4000-8000-000000002006','a1912000-0000-4000-8000-000000002001','image','Synthetic template fallback','fixture.png','image/png','ready','tenants/a1912000-0000-4000-8000-000000002001/assets/a1912000-0000-4000-8000-000000002006/original.png',100,repeat('d',64),1920,1080);
insert into public.media_variants(tenant_id,asset_id,variant_type,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height)
select tenant_id,id,'original',storage_path,mime_type,file_size_bytes,checksum_sha256,width,height from public.media_assets where id='a1912000-0000-4000-8000-000000002006';
insert into public.dynamic_slides(id,tenant_id,name,slide_type,orientation,template_id,template_version_id,data_source_id,selection_mode,status,configuration_json)
select 'a1912000-0000-4000-8000-000000002003','a1912000-0000-4000-8000-000000002001','Template standing',slide_type,orientation,template_id,template_version_id,'a1912000-0000-4000-8000-000000002002','latest','draft',configuration_json from public.dynamic_slides where id='a1910000-0000-4000-8000-000000002003';
insert into public.dynamic_slide_snapshots(id,tenant_id,dynamic_slide_id,template_version_id,data_source_id,source_revision_hash,snapshot_data_json,status,output_media_asset_id,completed_at)
select ('a1922000-0000-4000-8000-'||lpad(value::text,12,'0'))::uuid,tenant_id,id,template_version_id,data_source_id,lpad(value::text,64,'b'),'{"type":"sport_standing","sport":{"title":"Template frozen","items":[]}}','ready','a1912000-0000-4000-8000-000000002006',now() from public.dynamic_slides cross join generate_series(1,2)value where id='a1912000-0000-4000-8000-000000002003';
update public.dynamic_slides set current_snapshot_id='a1922000-0000-4000-8000-000000000002',status='ready'where id='a1912000-0000-4000-8000-000000002003';
select is(private.publication_snapshot_is_referenced_v1('a1912000-0000-4000-8000-000000002001','a1922000-0000-4000-8000-000000000001'),false,'the obsolete snapshot has no current, draft, release or worker reference before template authoring');
insert into public.playlists(id,tenant_id,name,created_by,updated_by)values('a1912000-0000-4000-8000-000000002005','a1912000-0000-4000-8000-000000002001','Synthetic template source playlist','a1912000-0000-4000-8000-000000002001','a1912000-0000-4000-8000-000000002001');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','a1912000-0000-4000-8000-000000002001',true);
insert into public.playlist_items(tenant_id,playlist_id,media_asset_id,sort_order,duration_seconds,fit_mode,muted,dynamic_slide_id,dynamic_snapshot_id,dynamic_selection_mode)
values('a1912000-0000-4000-8000-000000002001','a1912000-0000-4000-8000-000000002005','a1912000-0000-4000-8000-000000002006',0,10,'contain',true,'a1912000-0000-4000-8000-000000002003','a1922000-0000-4000-8000-000000000001','pinned');
select set_config('test.s191_template',public.create_tenant_playlist_template_v1('a1912000-0000-4000-8000-000000002005','Retained frozen data','Synthetic exact source fixture','a1912000-0000-4000-8000-000000002007')::text,true);
select lives_ok($$insert into public.tenant_playlist_templates(tenant_id,source_playlist_id,name,snapshot_json,snapshot_hash,status,created_by,updated_by)
select tenant_id,source_playlist_id,'Direct authorized index write',snapshot_json,snapshot_hash,'active',created_by,updated_by from public.tenant_playlist_templates where id=(current_setting('test.s191_template')::jsonb->>'templateId')::uuid$$,'authorized direct tenant template insert can evaluate the pure GIN expression as the authenticated writer');
delete from public.playlist_items where tenant_id='a1912000-0000-4000-8000-000000002001'and playlist_id='a1912000-0000-4000-8000-000000002005';
reset role;
select set_config('request.jwt.claim.role','service_role',true);
select is(private.publication_snapshot_is_referenced_v1('a1912000-0000-4000-8000-000000002001','a1922000-0000-4000-8000-000000000001'),true,'an active template alone retains the obsolete immutable snapshot');
update public.tenant_playlist_templates set status='archived',archived_at=now()where id=(current_setting('test.s191_template')::jsonb->>'templateId')::uuid;
select is(private.publication_snapshot_is_referenced_v1('a1912000-0000-4000-8000-000000002001','a1922000-0000-4000-8000-000000000001'),true,'an archived stored template retains its references as well');
select is(public.prune_superseded_publication_versions_v1('a1912000-0000-4000-8000-000000002001',25)->>'snapshotsDeleted','0','service cleanup preserves a template-only fallback snapshot');
update public.tenant_playlist_templates set status='active',archived_at=null where id=(current_setting('test.s191_template')::jsonb->>'templateId')::uuid;
set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);
select set_config('test.s191_template_instance',public.instantiate_tenant_playlist_template_v1((current_setting('test.s191_template')::jsonb->>'templateId')::uuid,'Reused after cleanup','a1912000-0000-4000-8000-000000002008')::text,true);
select is((select dynamic_snapshot_id from public.playlist_items where playlist_id=(current_setting('test.s191_template_instance')::jsonb->>'playlistId')::uuid),'a1922000-0000-4000-8000-000000000001'::uuid,'real template instantiation after cleanup restores the exact still-available pinned data');
reset role;
select finish();
rollback;
