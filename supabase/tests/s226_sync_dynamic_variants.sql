begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into public.tenants(id,name,slug)values
 ('10000000-0000-4000-8000-000000226151','Source variant A','source-author-a'),
 ('10000000-0000-4000-8000-000000226152','Source variant B','source-author-b');
insert into public.tenant_settings(tenant_id)values('10000000-0000-4000-8000-000000226151'),('10000000-0000-4000-8000-000000226152');
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)values
 ('00000000-0000-4000-8000-000000226151','authenticated','authenticated','source-owner@test.invalid','test',now(),now(),now(),'{}','{}'),
 ('00000000-0000-4000-8000-000000226152','authenticated','authenticated','source-other@test.invalid','test',now(),now(),now(),'{}','{}'),
 ('00000000-0000-4000-8000-000000226153','authenticated','authenticated','source-viewer@test.invalid','test',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name)values('00000000-0000-4000-8000-000000226151','Owner A'),('00000000-0000-4000-8000-000000226152','Owner B'),('00000000-0000-4000-8000-000000226153','Viewer');
insert into public.tenant_memberships(tenant_id,user_id,role)values
 ('10000000-0000-4000-8000-000000226151','00000000-0000-4000-8000-000000226151','tenant_owner'),
 ('10000000-0000-4000-8000-000000226152','00000000-0000-4000-8000-000000226152','tenant_owner'),
 ('10000000-0000-4000-8000-000000226151','00000000-0000-4000-8000-000000226153','tenant_viewer');
insert into public.dynamic_data_sources(id,tenant_id,name,kind)values
 ('20000000-0000-4000-8000-000000226151','10000000-0000-4000-8000-000000226151','Own catalog','manual_products'),
 ('20000000-0000-4000-8000-000000226152','10000000-0000-4000-8000-000000226152','Foreign catalog','manual_products');
insert into public.tenant_products(tenant_id,data_source_id,source,slug,name,price_cents)values
 ('10000000-0000-4000-8000-000000226151','20000000-0000-4000-8000-000000226151','manual','own-product','Actual own product',250);
create function pg_temp.source_config()returns jsonb language sql immutable as $function$select $configuration${"schemaVersion":1,"kind":"dynamic","rendererVersion":"sync-v1","sourceRevision":"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a","slideType":"sport_program","seed":{"schemaVersion":1,"rendererVersion":"sync-v1","sourceRevision":"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a","family":"fixtures","orientation":"landscape","theme":"fieldflow","name":"Gekoppeld bronontwerp","club":{"name":"Source A","tagline":""},"title":"DIT IS ONZE TROTS","headline":"","body":"","subtitle":"","topLabel":"CLUB TV","footer":"","footerRight":"","rows":[],"rowsPerPage":4,"ownRowIndexes":[],"category":"","subline":"","lineup":[],"news":[],"imageCaption":"","state":"ready","style":{"motion":"geen","background":"stadium","backgroundPosition":"center","font":"Inter, sans-serif","fontChanged":false,"accent":"#1763ed","alignment":"left","scale":100,"safeMargin":5,"showLogo":true,"showFooter":true}},"secondsPerPage":3}$configuration$::jsonb$function$;
create function pg_temp.request()returns jsonb language sql stable as $$
 select jsonb_build_object('templateVersionId',current_published_version_id,'dataSourceId','20000000-0000-4000-8000-000000226151','configuration',jsonb_build_object('maxItems',200,'syncConfiguration',jsonb_set(jsonb_set(pg_temp.source_config(),'{slideType}','"menu"'),'{seed,family}','"menu"')))
 from public.dynamic_templates where slug='editorial-arena-menubord-dark-landscape'and status='published';$$;
create temporary table variant_results(name text primary key,value jsonb);grant select,insert on variant_results to authenticated,service_role;
insert into public.dynamic_slides(id,tenant_id,name,slide_type,orientation,template_id,template_version_id,data_source_id,configuration_json)
select '30000000-0000-4000-8000-000000226151','10000000-0000-4000-8000-000000226151','Gekoppeld bronontwerp','menu','landscape',template.id,template.current_published_version_id,'20000000-0000-4000-8000-000000226151',pg_temp.request()->'configuration'
from public.dynamic_templates template where slug='editorial-arena-menubord-dark-landscape';
insert into variant_results select 'draft',jsonb_build_object('id',id,'revision',edit_revision)from public.dynamic_slide_versions where dynamic_slide_id='30000000-0000-4000-8000-000000226151';

insert into public.tenant_products(tenant_id,data_source_id,source,slug,name,price_cents)
select '10000000-0000-4000-8000-000000226151','20000000-0000-4000-8000-000000226151','manual','extra-'||n,'Actual product '||n,250 from generate_series(2,5)n;
create function pg_temp.artifact(p_snapshot uuid)returns jsonb language sql stable as $fn$
 select jsonb_build_object('mimeType','video/mp4','durationMs',2*(s.snapshot_data_json#>>'{syncConfiguration,secondsPerPage}')::integer*1000,
 'width',1920,'height',1080,'byteLength',4096,'checksumSha256',repeat('d',64),
 'storagePath','tenants/'||s.tenant_id||'/assets/'||j.output_media_asset_id||'/sync-dynamic/'||repeat('d',64)||'.mp4',
 'presentation',jsonb_set(s.snapshot_data_json#>'{syncConfiguration,seed}','{rows}','[["Actual own product","€ 2,50","",""],["Actual product 2","€ 2,50","",""],["Actual product 3","€ 2,50","",""],["Actual product 4","€ 2,50","",""],["Actual product 5","€ 2,50","",""]]'),
 'poster',jsonb_build_object('byteLength',1024,'checksumSha256',repeat('e',64),'storagePath','tenants/'||s.tenant_id||'/assets/'||j.output_media_asset_id||'/sync-dynamic/'||repeat('e',64)||'.png'))
 from public.dynamic_slide_snapshots s join public.dynamic_render_jobs j on j.snapshot_id=s.id where s.id=p_snapshot;$fn$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226151',true);
insert into variant_results values('create',public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000226151','create',null,null,0,pg_temp.request(),'40000000-0000-4000-8000-000000226161'));
reset role;
set local role service_role;
create temporary table base_claim as select *from public.claim_dynamic_render_job_v2('source-base',30,3);
select lives_ok($$select public.complete_dynamic_render_job_v2((select job_id from base_claim),'source-base',(select lease_token from base_claim),pg_temp.artifact((select snapshot_id from base_claim)))$$,'the original Source obtains complete checked output');
reset role;
insert into variant_results select 'base',jsonb_build_object('snapshotId',current_snapshot_id,'versionId',current_published_version_id,'configuration',configuration_json)from public.dynamic_slides where id=(select(value->>'slideId')::uuid from variant_results where name='create');
insert into public.playlists(id,tenant_id,name)values('50000000-0000-4000-8000-000000226163','10000000-0000-4000-8000-000000226151','Unrelated existing latest Source');
set local role authenticated;
insert into variant_results values('mainDraft',public.create_or_resume_dynamic_slide_version_v1((select(value->>'slideId')::uuid from variant_results where name='create'),null));
insert into variant_results values('untouchedPlaylist',public.mutate_playlist_batch_v1('50000000-0000-4000-8000-000000226163',0,jsonb_build_array(jsonb_build_object('operation','add_sync_dynamic','clientId','60000000-0000-4000-8000-000000226163','dynamicSlideId',(select value->>'slideId'from variant_results where name='create'),'expectedSnapshotId',(select value->>'snapshotId'from variant_results where name='base'),'snapshotId',(select value->>'snapshotId'from variant_results where name='base'),'durationSeconds',6)),'40000000-0000-4000-8000-000000226174'));
insert into variant_results select 'untouchedItem',to_jsonb(item)from public.playlist_items item where playlist_id='50000000-0000-4000-8000-000000226163';
insert into variant_results values('variant',public.prepare_sync_dynamic_variant_v1('10000000-0000-4000-8000-000000226151',(select(value->>'snapshotId')::uuid from variant_results where name='base'),'onzetrots-tv',7,'40000000-0000-4000-8000-000000226162'));
select is(public.prepare_sync_dynamic_variant_v1('10000000-0000-4000-8000-000000226151',(select(value->>'snapshotId')::uuid from variant_results where name='base'),'onzetrots-tv',7,'40000000-0000-4000-8000-000000226162'),(select value from variant_results where name='variant'),'a lost prepare response recovers exactly the same queued variant');
select is(public.prepare_sync_dynamic_variant_v1('10000000-0000-4000-8000-000000226151',(select(value->>'snapshotId')::uuid from variant_results where name='base'),'onzetrots-tv',7,'40000000-0000-4000-8000-000000226163'),(select value from variant_results where name='variant'),'different command keys deduplicate the same frozen choice');
select throws_ok($$select public.prepare_sync_dynamic_variant_v1('10000000-0000-4000-8000-000000226151',(select(value->>'snapshotId')::uuid from variant_results where name='base'),'fieldflow',7,'40000000-0000-4000-8000-000000226162')$$,'23505',null,'a key cannot be reused for another theme');
select throws_ok($$select public.prepare_sync_dynamic_variant_v1('10000000-0000-4000-8000-000000226151',(select(value->>'snapshotId')::uuid from variant_results where name='base'),'onzetrots-tv',61,'40000000-0000-4000-8000-000000226164')$$,'23514',null,'the full multi-page duration is bounded');
select throws_ok($$select public.prepare_sync_dynamic_variant_v1('10000000-0000-4000-8000-000000226151',(select(value->>'snapshotId')::uuid from variant_results where name='base'),'unknown',7,'40000000-0000-4000-8000-000000226164')$$,'22023',null,'unsupported themes are rejected');
reset role;
select is((select count(*)from public.dynamic_render_jobs where tenant_id='10000000-0000-4000-8000-000000226151'),2::bigint,'the selected variant queues exactly one existing render job');
select is((select dynamic_slide_version_id from public.dynamic_slide_snapshots where id=(select(value->>'snapshotId')::uuid from variant_results where name='variant')),(select(value->>'versionId')::uuid from variant_results where name='variant'),'the snapshot retains its actual independent immutable version');
select is((select active_draft_version_id from public.dynamic_slides where id=(select(value->>'slideId')::uuid from variant_results where name='create')),(select(value->>'versionId')::uuid from variant_results where name='mainDraft'),'the main open draft remains selected');
select is((select snapshot_data_json-'syncConfiguration'from public.dynamic_slide_snapshots where id=(select(value->>'snapshotId')::uuid from variant_results where name='variant')),(select snapshot_data_json-'syncConfiguration'from public.dynamic_slide_snapshots where id=(select(value->>'snapshotId')::uuid from variant_results where name='base')),'theme and duration preparation preserve the entire frozen canonical data set');
select is((select snapshot_data_json#>>'{syncConfiguration,seed,theme}'from public.dynamic_slide_snapshots where id=(select(value->>'snapshotId')::uuid from variant_results where name='variant')),'onzetrots-tv','the requested theme is frozen before rendering');
select is((select snapshot_data_json#>>'{syncConfiguration,secondsPerPage}'from public.dynamic_slide_snapshots where id=(select(value->>'snapshotId')::uuid from variant_results where name='variant')),'7','the requested page duration is frozen before rendering');
set local role service_role;
create temporary table variant_claim as select *from public.claim_dynamic_render_job_v2('source-variant',30,3);
select lives_ok($$select public.complete_dynamic_render_job_v2((select job_id from variant_claim),'source-variant',(select lease_token from variant_claim),pg_temp.artifact((select snapshot_id from variant_claim)))$$,'the selected variant completes through the existing fenced worker');
reset role;
select is((select to_jsonb(item)from public.playlist_items item where playlist_id='50000000-0000-4000-8000-000000226163'),(select value from variant_results where name='untouchedItem'),'a newly ready placement variant never auto-follows into another latest draft item');
select is((select revision from public.playlists where id='50000000-0000-4000-8000-000000226163'),(select(value->>'actualRevision')::bigint from variant_results where name='untouchedPlaylist'),'variant readiness never increments an unrelated playlist revision');
select is((select current_snapshot_id from public.dynamic_slides where id=(select(value->>'slideId')::uuid from variant_results where name='create')),(select(value->>'snapshotId')::uuid from variant_results where name='base'),'a newer variant sequence never replaces the main Source snapshot');
select is((select current_published_version_id from public.dynamic_slides where id=(select(value->>'slideId')::uuid from variant_results where name='create')),(select(value->>'versionId')::uuid from variant_results where name='base'),'variant completion never replaces the main published version');
select is((select active_draft_version_id from public.dynamic_slides where id=(select(value->>'slideId')::uuid from variant_results where name='create')),(select(value->>'versionId')::uuid from variant_results where name='mainDraft'),'variant completion never clears the main draft');
select is((select status from public.dynamic_slide_versions where id=(select(value->>'versionId')::uuid from variant_results where name='variant')),'published','only the fully ready variant version becomes published');
select is((select sync_render_result_json->>'durationMs'from public.dynamic_slide_snapshots where id=(select(value->>'snapshotId')::uuid from variant_results where name='variant')),'14000','the full two-page variant matches the chosen duration');
insert into public.playlists(id,tenant_id,name)values('50000000-0000-4000-8000-000000226161','10000000-0000-4000-8000-000000226151','Source variant playlist');
create function pg_temp.operations()returns jsonb language sql stable as $fn$
 select jsonb_build_array(jsonb_build_object('operation','add_sync_dynamic','clientId','60000000-0000-4000-8000-000000226161','dynamicSlideId',(select value->>'slideId'from variant_results where name='create'),'expectedSnapshotId',(select value->>'snapshotId'from variant_results where name='base'),'snapshotId',(select value->>'snapshotId'from variant_results where name='variant'),'durationSeconds',14));$fn$;
set local role authenticated;
insert into variant_results values('batch',public.mutate_playlist_batch_v1('50000000-0000-4000-8000-000000226161',0,pg_temp.operations(),'40000000-0000-4000-8000-000000226165'));
select is((select value->>'outcome'from variant_results where name='batch'),'applied','the base and its verified variant bind in one atomic batch');
select is(public.mutate_playlist_batch_v1('50000000-0000-4000-8000-000000226161',0,pg_temp.operations(),'40000000-0000-4000-8000-000000226165'),(select value from variant_results where name='batch'),'lost playlist confirmation replays before changed revision CAS');
select is((select count(*)from public.playlist_items where playlist_id='50000000-0000-4000-8000-000000226161'),1::bigint,'batch recovery creates one placement');
select is((select dynamic_snapshot_id from public.playlist_items where playlist_id='50000000-0000-4000-8000-000000226161'),(select(value->>'snapshotId')::uuid from variant_results where name='variant'),'the placement pins the matching variant snapshot');
select is((select duration_seconds from public.playlist_items where playlist_id='50000000-0000-4000-8000-000000226161'),14,'the placement stores its full artifact duration');
select is((select dynamic_selection_mode from public.playlist_items where playlist_id='50000000-0000-4000-8000-000000226161'),'pinned','an explicit placement variant cannot be overwritten by a later main Source version');
select ok((select sites_configuration_json is null from public.playlist_items where playlist_id='50000000-0000-4000-8000-000000226161'),'the Source placement has no synthetic Sites configuration');


reset role;
insert into public.playlists(id,tenant_id,name)values('50000000-0000-4000-8000-000000226162','10000000-0000-4000-8000-000000226151','Existing Source placement');
set local role authenticated;
insert into variant_results values('existingBase',public.mutate_playlist_batch_v1('50000000-0000-4000-8000-000000226162',0,jsonb_set(jsonb_set(pg_temp.operations(),'{0,snapshotId}',(select value->'snapshotId'from variant_results where name='base')),'{0,durationSeconds}','6'),'40000000-0000-4000-8000-000000226171'));
create function pg_temp.bind_operation(p_expected uuid)returns jsonb language sql stable as $fn$
 select jsonb_build_array(jsonb_build_object('operation','use_sync_dynamic_variant','itemId',(select id from public.playlist_items where playlist_id='50000000-0000-4000-8000-000000226162'),'expectedSnapshotId',p_expected,'snapshotId',(select value->>'snapshotId'from variant_results where name='variant'),'durationSeconds',14));$fn$;
select throws_ok($$select public.mutate_playlist_batch_v1('50000000-0000-4000-8000-000000226162',(select(value->>'actualRevision')::bigint from variant_results where name='existingBase'),pg_temp.bind_operation(gen_random_uuid()),'40000000-0000-4000-8000-000000226172')$$,'40001',null,'a placement snapshot CAS rejects stale variant replacement');
insert into variant_results values('existingVariant',public.mutate_playlist_batch_v1('50000000-0000-4000-8000-000000226162',(select(value->>'actualRevision')::bigint from variant_results where name='existingBase'),pg_temp.bind_operation((select(value->>'snapshotId')::uuid from variant_results where name='base')),'40000000-0000-4000-8000-000000226173'));
select is((select value->>'outcome'from variant_results where name='existingVariant'),'applied','an existing pinned Source placement receives its verified matching variant');
select is((select dynamic_snapshot_id from public.playlist_items where playlist_id='50000000-0000-4000-8000-000000226162'),(select(value->>'snapshotId')::uuid from variant_results where name='variant'),'the existing placement pins the new artifact without changing Source identity');
select is(public.mutate_playlist_batch_v1('50000000-0000-4000-8000-000000226162',(select(value->>'actualRevision')::bigint from variant_results where name='existingBase'),pg_temp.bind_operation((select(value->>'snapshotId')::uuid from variant_results where name='base')),'40000000-0000-4000-8000-000000226173'),(select value from variant_results where name='existingVariant'),'a replaced snapshot still recovers the exact original batch receipt');
reset role;
create function pg_temp.freeze_source(p_playlist uuid,p_release uuid)returns void language plpgsql as $fn$
begin
 insert into public.playlist_releases(id,tenant_id,playlist_id,version,manifest_hash,manifest_json,item_count,total_duration_seconds,total_bytes)
 select p_release,'10000000-0000-4000-8000-000000226151',p_playlist,1,repeat('f',64),'{}',1,sum(duration_seconds),4096 from public.playlist_items where playlist_id=p_playlist;
 insert into public.playlist_release_items(tenant_id,playlist_id,release_id,source_item_id,media_asset_id,media_variant_id,sort_order,duration_seconds,fit_mode,muted,asset_kind,asset_title,storage_path,mime_type,file_size_bytes,checksum_sha256)
 select item.tenant_id,item.playlist_id,p_release,item.id,asset.id,variant.id,0,item.duration_seconds,item.fit_mode,item.muted,asset.kind,asset.title,variant.storage_path,variant.mime_type,variant.file_size_bytes,variant.checksum_sha256
 from public.playlist_items item join public.media_assets asset on asset.id=item.media_asset_id and asset.tenant_id=item.tenant_id
 join public.media_variants variant on variant.asset_id=asset.id and variant.tenant_id=asset.tenant_id and variant.variant_type='player_1080p'where item.playlist_id=p_playlist;
end;$fn$;
select lives_ok($$select pg_temp.freeze_source('50000000-0000-4000-8000-000000226161','70000000-0000-4000-8000-000000226161')$$,'the verified pinned placement variant freezes through the existing release triggers');
select is((select live_data_enabled from public.playlist_release_items where release_id='70000000-0000-4000-8000-000000226161'),true,'Source variant pinning freezes the design while retaining authorized live source facts');
select is((select data_json#>>'{syncConfiguration,seed,theme}'from public.published_dynamic_data where snapshot_id=(select(value->>'snapshotId')::uuid from variant_results where name='variant')),'onzetrots-tv','live binding starts from the variant theme rather than the main source design');
select is((select data_json#>>'{syncConfiguration,secondsPerPage}'from public.published_dynamic_data where snapshot_id=(select(value->>'snapshotId')::uuid from variant_results where name='variant')),'7','live binding retains the variant page duration');
update public.playlist_items set dynamic_selection_mode='pinned'where playlist_id='50000000-0000-4000-8000-000000226163';
select lives_ok($$select pg_temp.freeze_source('50000000-0000-4000-8000-000000226163','70000000-0000-4000-8000-000000226163')$$,'an ordinary pinned Source snapshot retains its original publication policy');
select is((select live_data_enabled from public.playlist_release_items where release_id='70000000-0000-4000-8000-000000226163'),false,'the variant exception never enables ordinary pinned snapshot refresh');
set local role authenticated;
insert into variant_results values('pending',public.prepare_sync_dynamic_variant_v1('10000000-0000-4000-8000-000000226151',(select(value->>'snapshotId')::uuid from variant_results where name='base'),'onzetrots-tv',8,'40000000-0000-4000-8000-000000226167'));
select throws_ok($$select public.mutate_playlist_batch_v1('50000000-0000-4000-8000-000000226161',(select(value->>'actualRevision')::bigint from variant_results where name='batch'),jsonb_set(pg_temp.operations(),'{0,snapshotId}',(select value->'snapshotId'from variant_results where name='pending')),'40000000-0000-4000-8000-000000226168')$$,'23514',null,'pending Source output cannot enter a playlist');
select throws_ok($$select public.mutate_playlist_batch_v1('50000000-0000-4000-8000-000000226161',(select(value->>'actualRevision')::bigint from variant_results where name='batch'),jsonb_set(pg_temp.operations(),'{0,durationSeconds}','13'),'40000000-0000-4000-8000-000000226168')$$,'23514',null,'the full Source duration cannot be shortened independently of its artifact');
select is((select count(*)from public.playlist_items where playlist_id='50000000-0000-4000-8000-000000226161'),1::bigint,'rejected variant batches add no partial placements');
reset role;
insert into variant_results select 'mainBeforeFailure',to_jsonb(source)from public.dynamic_slides source where id=(select(value->>'slideId')::uuid from variant_results where name='create');
set local role service_role;
create temporary table failed_claim as select *from public.claim_dynamic_render_job_v2('variant-failure',30,3);
select is(public.fail_dynamic_render_job_v2((select job_id from failed_claim),'variant-failure',(select lease_token from failed_claim),'controlled_failure','Controlled variant failure',false),'failed','a terminal variant render failure is recorded in the existing queue');
reset role;
select is((select to_jsonb(source)from public.dynamic_slides source where id=(select(value->>'slideId')::uuid from variant_results where name='create')),(select value from variant_results where name='mainBeforeFailure'),'terminal variant failure leaves the complete main Source state unchanged');
set local role authenticated;
insert into variant_results values('expired',public.prepare_sync_dynamic_variant_v1('10000000-0000-4000-8000-000000226151',(select(value->>'snapshotId')::uuid from variant_results where name='base'),'onzetrots-tv',9,'40000000-0000-4000-8000-000000226169'));
set local role service_role;
create temporary table expired_claim as select *from public.claim_dynamic_render_job_v2('variant-expired',30,3);
reset role;
update public.dynamic_render_jobs set locked_at=now()-interval '10 minutes',attempt_count=3 where id=(select job_id from expired_claim);
set local role service_role;
select is((select count(*)from public.claim_dynamic_render_job_v1('legacy-reaper',30,3)),0::bigint,'the original worker reaps but never claims a Source variant');
reset role;
select is((select status from public.dynamic_slide_snapshots where id=(select snapshot_id from expired_claim)),'failed','the bounded lease reaper terminalizes an exhausted variant');
select is((select to_jsonb(source)from public.dynamic_slides source where id=(select(value->>'slideId')::uuid from variant_results where name='create')),(select value from variant_results where name='mainBeforeFailure'),'the lease reaper leaves the entire main Source state unchanged');
select is((select count(*)from public.playlist_items where playlist_id='50000000-0000-4000-8000-000000226161'),1::bigint,'failed variants leave the pinned ready placement intact');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226152',true);
select throws_ok($$select public.prepare_sync_dynamic_variant_v1('10000000-0000-4000-8000-000000226152',(select(value->>'snapshotId')::uuid from variant_results where name='base'),'onzetrots-tv',7,'40000000-0000-4000-8000-000000226166')$$,'42501',null,'another tenant cannot derive the private frozen Source');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226153',true);
select throws_ok($$select public.prepare_sync_dynamic_variant_v1('10000000-0000-4000-8000-000000226151',(select(value->>'snapshotId')::uuid from variant_results where name='base'),'onzetrots-tv',7,'40000000-0000-4000-8000-000000226166')$$,'42501',null,'a viewer cannot prepare playlist variants');
reset role;
select is(has_table_privilege('authenticated','private.sync_dynamic_placement_variants','INSERT'),false,'the association is never a client write surface');
select is(has_function_privilege('service_role','public.prepare_sync_dynamic_variant_v1(uuid,uuid,text,integer,uuid)','EXECUTE'),false,'workers cannot author placement variants');
select is(has_function_privilege('anon','public.prepare_sync_dynamic_variant_v1(uuid,uuid,text,integer,uuid)','EXECUTE'),false,'anonymous callers cannot author placement variants');
select *from finish();rollback;
