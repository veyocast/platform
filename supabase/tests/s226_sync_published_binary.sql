begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into public.tenants(id,name,slug)values
 ('10000000-0000-4000-8000-000000226231','Source variant A','source-author-a'),
 ('10000000-0000-4000-8000-000000226232','Source variant B','source-author-b');
insert into public.tenant_settings(tenant_id)values('10000000-0000-4000-8000-000000226231'),('10000000-0000-4000-8000-000000226232');
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)values
 ('00000000-0000-4000-8000-000000226231','authenticated','authenticated','source-owner@test.invalid','test',now(),now(),now(),'{}','{}'),
 ('00000000-0000-4000-8000-000000226232','authenticated','authenticated','source-other@test.invalid','test',now(),now(),now(),'{}','{}'),
 ('00000000-0000-4000-8000-000000226233','authenticated','authenticated','source-viewer@test.invalid','test',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name)values('00000000-0000-4000-8000-000000226231','Owner A'),('00000000-0000-4000-8000-000000226232','Owner B'),('00000000-0000-4000-8000-000000226233','Viewer');
insert into public.tenant_memberships(tenant_id,user_id,role)values
 ('10000000-0000-4000-8000-000000226231','00000000-0000-4000-8000-000000226231','tenant_owner'),
 ('10000000-0000-4000-8000-000000226232','00000000-0000-4000-8000-000000226232','tenant_owner'),
 ('10000000-0000-4000-8000-000000226231','00000000-0000-4000-8000-000000226233','tenant_viewer');
insert into public.dynamic_data_sources(id,tenant_id,name,kind)values
 ('20000000-0000-4000-8000-000000226231','10000000-0000-4000-8000-000000226231','Own catalog','manual_products'),
 ('20000000-0000-4000-8000-000000226232','10000000-0000-4000-8000-000000226232','Foreign catalog','manual_products');
insert into public.tenant_products(tenant_id,data_source_id,source,slug,name,price_cents)values
 ('10000000-0000-4000-8000-000000226231','20000000-0000-4000-8000-000000226231','manual','own-product','Actual own product',250);
create function pg_temp.source_config()returns jsonb language sql immutable as $function$select $configuration${"schemaVersion":1,"kind":"dynamic","rendererVersion":"sync-v1","sourceRevision":"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a","slideType":"sport_program","seed":{"schemaVersion":1,"rendererVersion":"sync-v1","sourceRevision":"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a","family":"fixtures","orientation":"landscape","theme":"fieldflow","name":"Gekoppeld bronontwerp","club":{"name":"Source A","tagline":""},"title":"DIT IS ONZE TROTS","headline":"","body":"","subtitle":"","topLabel":"CLUB TV","footer":"","footerRight":"","rows":[],"rowsPerPage":4,"ownRowIndexes":[],"category":"","subline":"","lineup":[],"news":[],"imageCaption":"","state":"ready","style":{"motion":"geen","background":"stadium","backgroundPosition":"center","font":"Inter, sans-serif","fontChanged":false,"accent":"#1763ed","alignment":"left","scale":100,"safeMargin":5,"showLogo":true,"showFooter":true}},"secondsPerPage":3}$configuration$::jsonb$function$;
create function pg_temp.request()returns jsonb language sql stable as $$
 select jsonb_build_object('templateVersionId',current_published_version_id,'dataSourceId','20000000-0000-4000-8000-000000226231','configuration',jsonb_build_object('maxItems',200,'syncConfiguration',jsonb_set(jsonb_set(pg_temp.source_config(),'{slideType}','"menu"'),'{seed,family}','"menu"')))
 from public.dynamic_templates where slug='editorial-arena-menubord-dark-landscape'and status='published';$$;
create temporary table variant_results(name text primary key,value jsonb);grant select,insert on variant_results to authenticated,service_role;
insert into public.tenant_products(tenant_id,data_source_id,source,slug,name,price_cents)
select '10000000-0000-4000-8000-000000226231','20000000-0000-4000-8000-000000226231','manual','extra-'||n,'Actual product '||n,250 from generate_series(2,5)n;
create function pg_temp.artifact(p_snapshot uuid)returns jsonb language sql stable as $fn$
 select jsonb_build_object('mimeType','video/mp4','durationMs',2*(s.snapshot_data_json#>>'{syncConfiguration,secondsPerPage}')::integer*1000,
 'width',1920,'height',1080,'byteLength',4096,'checksumSha256',repeat('d',64),
 'storagePath','tenants/'||s.tenant_id||'/assets/'||j.output_media_asset_id||'/sync-dynamic/'||repeat('d',64)||'.mp4',
 'presentation',jsonb_set(s.snapshot_data_json#>'{syncConfiguration,seed}','{rows}','[["Actual own product","€ 2,50","",""],["Actual product 2","€ 2,50","",""],["Actual product 3","€ 2,50","",""],["Actual product 4","€ 2,50","",""],["Actual product 5","€ 2,50","",""]]'),
 'poster',jsonb_build_object('byteLength',1024,'checksumSha256',repeat('e',64),'storagePath','tenants/'||s.tenant_id||'/assets/'||j.output_media_asset_id||'/sync-dynamic/'||repeat('e',64)||'.png'))
 from public.dynamic_slide_snapshots s join public.dynamic_render_jobs j on j.snapshot_id=s.id where s.id=p_snapshot;$fn$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226231',true);
insert into variant_results values('create',public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000226231','create',null,null,0,pg_temp.request(),'40000000-0000-4000-8000-000000226161'));
reset role;
set local role service_role;
create temporary table base_claim as select *from public.claim_dynamic_render_job_v2('source-base',30,3);
select lives_ok($$select public.complete_dynamic_render_job_v2((select job_id from base_claim),'source-base',(select lease_token from base_claim),pg_temp.artifact((select snapshot_id from base_claim)))$$,'the original Source obtains complete checked output');
reset role;
insert into variant_results select 'base',jsonb_build_object('snapshotId',current_snapshot_id,'versionId',current_published_version_id,'configuration',configuration_json)from public.dynamic_slides where id=(select(value->>'slideId')::uuid from variant_results where name='create');

-- All rows/bytes below are explicit SQL admission fixtures, not provider or
-- browser/FFmpeg acceptance. Real output is tested separately against QA.
insert into public.playlists(id,tenant_id,name)values('50000000-0000-4000-8000-000000226231','10000000-0000-4000-8000-000000226231','Binary runtime fixture');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226231',true);
select public.mutate_playlist_batch_v1('50000000-0000-4000-8000-000000226231',0,jsonb_build_array(jsonb_build_object('operation','add_sync_dynamic','clientId','60000000-0000-4000-8000-000000226231','dynamicSlideId',(select value->>'slideId'from variant_results where name='create'),'expectedSnapshotId',(select value->>'snapshotId'from variant_results where name='base'),'snapshotId',(select value->>'snapshotId'from variant_results where name='base'),'durationSeconds',6)),'40000000-0000-4000-8000-000000226231');
reset role;
create function pg_temp.freeze_source(p_playlist uuid,p_release uuid)returns void language plpgsql as $fn$
begin
 insert into public.playlist_releases(id,tenant_id,playlist_id,version,manifest_hash,manifest_json,item_count,total_duration_seconds,total_bytes)
 select p_release,'10000000-0000-4000-8000-000000226231',p_playlist,1,repeat('f',64),'{}',1,sum(duration_seconds),4096 from public.playlist_items where playlist_id=p_playlist;
 insert into public.playlist_release_items(tenant_id,playlist_id,release_id,source_item_id,media_asset_id,media_variant_id,sort_order,duration_seconds,fit_mode,muted,asset_kind,asset_title,storage_path,mime_type,file_size_bytes,checksum_sha256)
 select item.tenant_id,item.playlist_id,p_release,item.id,asset.id,variant.id,0,item.duration_seconds,item.fit_mode,item.muted,asset.kind,asset.title,variant.storage_path,variant.mime_type,variant.file_size_bytes,variant.checksum_sha256
 from public.playlist_items item join public.media_assets asset on asset.id=item.media_asset_id and asset.tenant_id=item.tenant_id
 join public.media_variants variant on variant.asset_id=asset.id and variant.tenant_id=asset.tenant_id and variant.variant_type='player_1080p'where item.playlist_id=p_playlist;
end;$fn$;

select pg_temp.freeze_source('50000000-0000-4000-8000-000000226231','70000000-0000-4000-8000-000000226231');
insert into public.screens(id,tenant_id,name,orientation,status,assigned_playlist_id,assigned_release_id)values('80000000-0000-4000-8000-000000226231','10000000-0000-4000-8000-000000226231','Own SQL binary fixture','landscape','active','50000000-0000-4000-8000-000000226231','70000000-0000-4000-8000-000000226231');
insert into public.player_devices(id,tenant_id,screen_id,device_name,token_hash,status)values('31000000-0000-4000-8000-000000226231','10000000-0000-4000-8000-000000226231','80000000-0000-4000-8000-000000226231','Binary SQL fixture',repeat('9',64),'paired');
create function pg_temp.frozen_history()returns jsonb language sql stable as $$select jsonb_build_object('releases',(select md5(coalesce(string_agg(row_to_json(r)::text,','order by id),''))from public.playlist_releases r),'snapshots',(select md5(coalesce(string_agg(row_to_json(s)::text,','order by id),''))from public.dynamic_slide_snapshots s),'versions',(select count(*)from public.dynamic_slide_versions),'jobs',(select count(*)from public.dynamic_render_jobs))$$;
insert into variant_results values('history',pg_temp.frozen_history());
select is(has_function_privilege('authenticated','public.get_sync_binary_playback_v1(uuid,uuid[])','execute'),false,'a browser cannot read arbitrary runtime cache identities');
select is(has_function_privilege('anon','public.claim_dynamic_render_job_v3(text,integer,integer)','execute'),false,'anonymous callers cannot claim a render');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='private.sync_published_binary_state'::regclass),'the runtime state has forced default-deny RLS');
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
insert into variant_results values('initial-data',public.claim_published_data_refresh_v1('binary-data',60));
select public.complete_published_data_refresh_v1((select(value->>'tenantId')::uuid from variant_results where name='initial-data'),(select(value->>'snapshotId')::uuid from variant_results where name='initial-data'),(select(value->>'leaseToken')::uuid from variant_results where name='initial-data'));
reset role;
select is((select count(*)from private.sync_published_binary_state),0::bigint,'unchanged original facts do not schedule an unnecessary encode');
update public.tenant_products set price_cents=350 where tenant_id='10000000-0000-4000-8000-000000226231'and slug='own-product';
update public.dynamic_data_sources set revision=revision+1 where id='20000000-0000-4000-8000-000000226231';
set local role service_role;
insert into variant_results values('changed-data',public.claim_published_data_refresh_v1('binary-data',60));
select public.complete_published_data_refresh_v1((select(value->>'tenantId')::uuid from variant_results where name='changed-data'),(select(value->>'snapshotId')::uuid from variant_results where name='changed-data'),(select(value->>'leaseToken')::uuid from variant_results where name='changed-data'));
select is(public.claim_published_data_refresh_v1('legacy-data',60),null::jsonb,'the old data worker never claims binary work');
select ok((public.get_worker_queue_hint_v2(3)&4)=4,'the existing dynamic hint includes due binary work');
insert into variant_results values('target-before-binary',public.get_player_effective_target_v1(repeat('9',64)));
insert into variant_results select 'binary-claim',value from public.claim_dynamic_render_job_v3('binary-render',60,3)value;
select is((select value->>'published_refresh'from variant_results where name='binary-claim'),'true','the same dynamic worker receives an explicit fenced refresh purpose');
select is((select value->>'snapshot_id'from variant_results where name='binary-claim'),(select value->>'snapshotId'from variant_results where name='base'),'the existing configuration snapshot remains its identity');
select ok(public.renew_sync_binary_render_v1('10000000-0000-4000-8000-000000226231',(select(value->>'snapshotId')::uuid from variant_results where name='base'),'binary-render',(select(value->>'lease_token')::uuid from variant_results where name='binary-claim')),'the correct worker renews its exact lease');
select is(public.renew_sync_binary_render_v1('10000000-0000-4000-8000-000000226232',(select(value->>'snapshotId')::uuid from variant_results where name='base'),'binary-render',(select(value->>'lease_token')::uuid from variant_results where name='binary-claim')),false,'a foreign tenant cannot renew this lease');
select ok(public.validate_sync_binary_storage_v1('10000000-0000-4000-8000-000000226231',(select(value->>'snapshot_id')::uuid from variant_results where name='binary-claim'),(select(value->>'lease_token')::uuid from variant_results where name='binary-claim'),(select(value->>'output_media_asset_id')::uuid from variant_results where name='binary-claim')),'a current exact lease may clean its inactive slot');
select is(has_function_privilege('authenticated','public.validate_sync_binary_storage_v1(uuid,uuid,uuid,uuid)','execute'),false,'a browser cannot authorize Storage cleanup');
reset role;
select is(private.sync_binary_cache_bytes_v1('10000000-0000-4000-8000-000000226231'),83886080::bigint,'the full possible upload is durably reserved before any Storage write');
create function pg_temp.binary_artifact()returns jsonb language sql stable as $$
 select jsonb_build_object('mimeType','video/mp4','durationMs',6000,'width',1920,'height',1080,'byteLength',5000,'checksumSha256',repeat('a',64),
 'storagePath','tenants/'||(value->>'tenant_id')||'/assets/'||(value->>'output_media_asset_id')||'/sync-dynamic/'||(value->>'lease_token')||'-'||repeat('a',64)||'.mp4',
 'presentation',jsonb_set(value#>'{snapshot_data_json,syncConfiguration,seed}','{rows}','[["Actual own product","€ 3,50","",""],["Actual product 2","€ 2,50","",""],["Actual product 3","€ 2,50","",""],["Actual product 4","€ 2,50","",""],["Actual product 5","€ 2,50","",""]]'),
 'poster',jsonb_build_object('byteLength',1200,'checksumSha256',repeat('b',64),'storagePath','tenants/'||(value->>'tenant_id')||'/assets/'||(value->>'output_media_asset_id')||'/sync-dynamic/'||(value->>'lease_token')||'-'||repeat('b',64)||'.png'))from variant_results where name='binary-claim';
$$;
set local role service_role;
select throws_ok($$select public.complete_sync_binary_render_v1('10000000-0000-4000-8000-000000226231',(select(value->>'snapshotId')::uuid from variant_results where name='base'),'binary-render','ffffffff-ffff-4fff-8fff-ffffffffffff',pg_temp.binary_artifact())$$,'55000',null,'an expired or foreign attempt cannot activate bytes');
select throws_ok($$select public.complete_sync_binary_render_v1('10000000-0000-4000-8000-000000226231',(select(value->>'snapshotId')::uuid from variant_results where name='base'),'binary-render',(select(value->>'lease_token')::uuid from variant_results where name='binary-claim'),jsonb_set(pg_temp.binary_artifact(),'{durationMs}','3000'))$$,'23514',null,'a first-page-only artifact cannot become ready');
select throws_ok($$select public.complete_sync_binary_render_v1('10000000-0000-4000-8000-000000226231',(select(value->>'snapshotId')::uuid from variant_results where name='base'),'binary-render',(select(value->>'lease_token')::uuid from variant_results where name='binary-claim'),jsonb_set(pg_temp.binary_artifact(),'{presentation,theme}','"onzetrots-tv"'))$$,'23514',null,'binary data refresh cannot change the frozen theme');
select lives_ok($$select public.complete_sync_binary_render_v1('10000000-0000-4000-8000-000000226231',(select(value->>'snapshotId')::uuid from variant_results where name='base'),'binary-render',(select(value->>'lease_token')::uuid from variant_results where name='binary-claim'),pg_temp.binary_artifact())$$,'only a full valid artifact becomes the current runtime cache');
select isnt(public.get_player_effective_target_v1(repeat('9',64))->>'data_key',(select value->>'data_key'from variant_results where name='target-before-binary'),'ready binary invalidates an earlier conditional manifest even though canonical facts already refreshed');
select is(public.get_player_effective_target_v1(repeat('9',64))->>'target_revision',(select value->>'target_revision'from variant_results where name='target-before-binary'),'delivery freshness preserves the immutable target revision');
select is(public.get_player_effective_target_v1(repeat('9',64))->>'desired_release_id',(select value->>'desired_release_id'from variant_results where name='target-before-binary'),'delivery freshness preserves the original assigned release');
select is(public.get_player_effective_target_v1(repeat('0',64)),null::jsonb,'an unrecognized device credential cannot inspect a binary delivery identity');
insert into variant_results values('ready',public.get_sync_binary_playback_v1('10000000-0000-4000-8000-000000226231',array[(select(value->>'snapshotId')::uuid from variant_results where name='base')]));
select is((select value#>>'{0,artifact,checksumSha256}'from variant_results where name='ready'),repeat('a',64),'the reader exposes the complete acknowledged checksum');
select is(public.get_sync_binary_playback_v1('10000000-0000-4000-8000-000000226232',array[(select(value->>'snapshotId')::uuid from variant_results where name='base')]),'[]'::jsonb,'a tenant-scoped reader never returns the other tenant cache');
reset role;
select is(pg_temp.frozen_history(),(select value from variant_results where name='history'),'runtime refresh changes no release, version, snapshot or render-job history');
select is((select cardinality(slot_ids)from private.sync_published_binary_state),3,'one configuration owns exactly three reusable storage slots');
select is((select attempt_reservations from private.sync_published_binary_state),'{}'::jsonb,'only acknowledged completion replaces its own upload reservation with actual bytes');
select is(private.sync_binary_cache_bytes_v1('10000000-0000-4000-8000-000000226231'),6200::bigint,'the complete video and poster both count toward the tenant budget');
update private.sync_published_binary_state set slot_reservations=jsonb_build_object(current_slot::text,83886080);
select is(private.sync_binary_cache_bytes_v1('10000000-0000-4000-8000-000000226231'),83892280::bigint,'a retained pre-fence writer and newer acknowledged artifact in the same slot count independently');
update private.sync_published_binary_state set slot_reservations='{}'::jsonb;
update public.tenant_products set price_cents=450 where tenant_id='10000000-0000-4000-8000-000000226231'and slug='own-product';
update public.dynamic_data_sources set revision=revision+1 where id='20000000-0000-4000-8000-000000226231';
set local role service_role;
insert into variant_results values('newer-data',public.claim_published_data_refresh_v1('binary-data',60));
select public.complete_published_data_refresh_v1((select(value->>'tenantId')::uuid from variant_results where name='newer-data'),(select(value->>'snapshotId')::uuid from variant_results where name='newer-data'),(select(value->>'leaseToken')::uuid from variant_results where name='newer-data'));
select is((select count(*)from public.claim_dynamic_render_job_v3('too-soon',60,3)),0::bigint,'a changed data hash waits for the five-minute encode bound');
reset role;
select ok((select next_attempt_at>=cache.last_started_at+'5 minutes'::interval from private.published_data_refresh_queue work join private.sync_published_binary_state cache on cache.tenant_id=work.tenant_id and cache.configuration_snapshot_id=work.snapshot_id),'the coalesced work retains its concrete future not-before time');
select is((select count(*)from private.published_data_refresh_queue),1::bigint,'multiple facts reuse one durable queue row');
select is(pg_temp.frozen_history(),(select value from variant_results where name='history'),'even queued newer facts never mutate configuration history');
-- Another ingest supersedes an idle encode, immediately refreshes DOM facts,
-- and still retains the same future binary deadline.
update public.tenant_products set price_cents=550 where tenant_id='10000000-0000-4000-8000-000000226231'and slug='own-product';
update public.dynamic_data_sources set revision=revision+1 where id='20000000-0000-4000-8000-000000226231';
select is((select phase from private.published_data_refresh_queue),'data','idle binary work yields immediately to newer source facts');
set local role service_role;
insert into variant_results values('coalesced-data',public.claim_published_data_refresh_v1('binary-data',60));
select public.complete_published_data_refresh_v1((select(value->>'tenantId')::uuid from variant_results where name='coalesced-data'),(select(value->>'snapshotId')::uuid from variant_results where name='coalesced-data'),(select(value->>'leaseToken')::uuid from variant_results where name='coalesced-data'));
select is((select count(*)from public.claim_dynamic_render_job_v3('still-too-soon',60,3)),0::bigint,'ingestion cannot move an encode ahead of its cooldown');
reset role;
select is((select count(*)from private.published_data_refresh_queue),1::bigint,'coalescing still owns one queue row');
-- Advance only the SQL fixture clock fields; the real QA test waits for its
-- actual not-before time and does not use this shortcut.
update private.sync_published_binary_state set last_started_at=clock_timestamp()-'6 minutes'::interval;
update private.published_data_refresh_queue set next_attempt_at=statement_timestamp();
set local role service_role;
insert into variant_results select 'second-claim',value from public.claim_dynamic_render_job_v3('binary-new',60,3)value;
select isnt((select value->>'output_media_asset_id'from variant_results where name='second-claim'),(select value->>'output_media_asset_id'from variant_results where name='binary-claim'),'a new encode never overwrites the current storage slot');
reset role;
update private.published_data_refresh_queue set lease_until=clock_timestamp()-'1 second'::interval;
select ok(private.sync_binary_cache_bytes_v1('10000000-0000-4000-8000-000000226231')>=83886080,'lease expiry never forgets a possibly incomplete private upload');
set local role service_role;
insert into variant_results select 'reclaimed',value from public.claim_dynamic_render_job_v3('binary-new',60,3)value;
select isnt((select value->>'lease_token'from variant_results where name='reclaimed'),(select value->>'lease_token'from variant_results where name='second-claim'),'a reclaimed encode has a distinct fence even for the same worker');
select is(public.renew_sync_binary_render_v1('10000000-0000-4000-8000-000000226231',(select(value->>'snapshotId')::uuid from variant_results where name='base'),'binary-new',(select(value->>'lease_token')::uuid from variant_results where name='second-claim')),false,'the old attempt cannot renew after reclaim');
select throws_ok($$select public.complete_sync_binary_render_v1('10000000-0000-4000-8000-000000226231',(select(value->>'snapshotId')::uuid from variant_results where name='base'),'binary-new',(select(value->>'lease_token')::uuid from variant_results where name='second-claim'),pg_temp.binary_artifact())$$,'55000',null,'the old attempt cannot activate after reclaim');
select is(public.validate_sync_binary_storage_v1('10000000-0000-4000-8000-000000226231',(select(value->>'snapshot_id')::uuid from variant_results where name='second-claim'),(select(value->>'lease_token')::uuid from variant_results where name='second-claim'),(select(value->>'output_media_asset_id')::uuid from variant_results where name='second-claim')),false,'a delayed listing cannot authorize deletion after reclaim');
reset role;
select is((select count(*)from private.sync_published_binary_state,jsonb_each(attempt_reservations)),2::bigint,'reclaim reserves both potentially resident writer generations');
select ok(private.sync_binary_cache_bytes_v1('10000000-0000-4000-8000-000000226231')>=167772160,'reclaim never reuses an unknown writer byte reservation');
-- Use the same artifact builder for the new authoritative claim identity.
update variant_results set value=(select value from variant_results where name='reclaimed')where name='binary-claim';
set local role service_role;
select throws_ok($$select public.complete_sync_binary_render_v1('10000000-0000-4000-8000-000000226231',(select(value->>'snapshotId')::uuid from variant_results where name='base'),'binary-new',(select(value->>'lease_token')::uuid from variant_results where name='reclaimed'),jsonb_set(pg_temp.binary_artifact(),'{byteLength}','67108865'))$$,'23514',null,'the runtime cache byte budget is enforced server-side');
select lives_ok($$select public.complete_sync_binary_render_v1('10000000-0000-4000-8000-000000226231',(select(value->>'snapshotId')::uuid from variant_results where name='base'),'binary-new',(select(value->>'lease_token')::uuid from variant_results where name='reclaimed'),pg_temp.binary_artifact())$$,'the reclaimed full artifact activates once');
reset role;
select ok((select attempt_reservations?(select value->>'lease_token'from variant_results where name='second-claim')from private.sync_published_binary_state),'success releases only its own reservation and retains the suspended writer');
select ok((select previous_slot is not null and previous_slot<>current_slot and (select count(*)from jsonb_object_keys(slot_artifacts))=2 from private.sync_published_binary_state),'current and previous complete artifacts occupy different reusable slots');
select is(pg_temp.frozen_history(),(select value from variant_results where name='history'),'all coalescing and reclaims leave immutable configuration history unchanged');
-- A terminal upload failure can have written a poster or partial video. Keep
-- its fixed inactive prefix and reservation until replacement/retired cleanup.
update public.tenant_products set price_cents=650 where tenant_id='10000000-0000-4000-8000-000000226231'and slug='own-product';
update public.dynamic_data_sources set revision=revision+1 where id='20000000-0000-4000-8000-000000226231';
set local role service_role;
insert into variant_results values('terminal-data',public.claim_published_data_refresh_v1('binary-terminal-data',60));
select public.complete_published_data_refresh_v1((select(value->>'tenantId')::uuid from variant_results where name='terminal-data'),(select(value->>'snapshotId')::uuid from variant_results where name='terminal-data'),(select(value->>'leaseToken')::uuid from variant_results where name='terminal-data'));
reset role;
update private.sync_published_binary_state set last_started_at=clock_timestamp()-'6 minutes'::interval;
update private.published_data_refresh_queue set next_attempt_at=statement_timestamp();
set local role service_role;
insert into variant_results select 'terminal-claim',value from public.claim_dynamic_render_job_v3('binary-terminal',60,3)value;
select is(public.fail_sync_binary_render_v1('10000000-0000-4000-8000-000000226231',(select(value->>'snapshotId')::uuid from variant_results where name='base'),'binary-terminal',(select(value->>'lease_token')::uuid from variant_results where name='terminal-claim'),'binary_upload_failed',false),'failed','a definitive upload failure stops this content hash');
reset role;
select is((select count(*)from private.published_data_refresh_queue),0::bigint,'a terminal upload does not create an endless render poll');
select ok((select attempt_reservations<>'{}'::jsonb and last_failed_hash is not null from private.sync_published_binary_state),'a terminal partial upload retains its bounded prefix reservation');
select ok(private.sync_binary_cache_bytes_v1('10000000-0000-4000-8000-000000226231')>=83886080,'partial upload bytes still count after their queue row is gone');
select is(pg_temp.frozen_history(),(select value from variant_results where name='history'),'even terminal cache failure preserves publication history');
insert into private.sync_published_binary_state(tenant_id,configuration_snapshot_id,snapshot_id,content_hash)values('10000000-0000-4000-8000-000000226231','90000000-0000-4000-8000-000000226231',null,repeat('c',64));
set local role service_role;
insert into variant_results select 'cleanup',value from public.claim_dynamic_render_job_v3('binary-cleanup',60,3)value;
select is((select value->>'cleanup_only'from variant_results where name='cleanup'),'true','retired slots use the existing dynamic worker for cleanup');
select ok(public.finish_sync_binary_cleanup_v1('10000000-0000-4000-8000-000000226231','90000000-0000-4000-8000-000000226231','binary-cleanup',(select(value->>'lease_token')::uuid from variant_results where name='cleanup'),false),'failed Storage cleanup is durably retained for retry');
reset role;
select is((select count(*)from private.sync_published_binary_state where snapshot_id is null),1::bigint,'cleanup failure never drops the Storage references');
update private.sync_published_binary_state set cleanup_not_before=statement_timestamp()where snapshot_id is null;
set local role service_role;
insert into variant_results select 'cleanup-retry',value from public.claim_dynamic_render_job_v3('binary-cleanup',60,3)value;
select ok(public.finish_sync_binary_cleanup_v1('10000000-0000-4000-8000-000000226231','90000000-0000-4000-8000-000000226231','binary-cleanup',(select(value->>'lease_token')::uuid from variant_results where name='cleanup-retry'),true),'only acknowledged Storage removal releases the retired state');
reset role;
select is((select count(*)from private.sync_published_binary_state where snapshot_id is null),0::bigint,'successful cleanup leaves no retired cache history');
-- A retired empty listing must not release the budget of a writer that can resume.
insert into private.sync_published_binary_state(tenant_id,configuration_snapshot_id,snapshot_id,content_hash,attempt_reservations)
 values('10000000-0000-4000-8000-000000226231','90000000-0000-4000-8000-000000226232',null,repeat('c',64),'{"90000000-0000-4000-8000-000000226233":{"slot":0,"reservedBytes":83886080}}');
set local role service_role;
insert into variant_results select 'retired-writer',value from public.claim_dynamic_render_job_v3('binary-cleanup',60,3)value;
select ok(public.finish_sync_binary_cleanup_v1('10000000-0000-4000-8000-000000226231','90000000-0000-4000-8000-000000226232','binary-cleanup',(select(value->>'lease_token')::uuid from variant_results where name='retired-writer'),true),'retired Storage cleanup may acknowledge its captured deletion set');
reset role;
select ok((select attempt_reservations<>'{}'::jsonb and last_error_code='binary_writer_drain_required' and cleanup_not_before>now()+'23 hours'::interval from private.sync_published_binary_state where snapshot_id is null),'unknown retired writers remain reserved and need operator drain without frequent polling');
-- Explicit SQL resource-admission fixtures: no physical upload/history writes.
create function pg_temp.queue_binary_resource_fixture(p_hash text)returns void language sql security definer set search_path='' as $$
 insert into private.published_data_refresh_queue(tenant_id,snapshot_id,data_source_id,phase,binary_data_json,binary_hash,binary_revision,next_attempt_at)
 select data.tenant_id,data.snapshot_id,data.data_source_id,'binary',data.data_json,p_hash,data.data_revision,clock_timestamp()
 from public.published_dynamic_data data where data.tenant_id='10000000-0000-4000-8000-000000226231'
 and data.snapshot_id=(select(value->>'snapshotId')::uuid from pg_temp.variant_results where name='base')
 on conflict(tenant_id,snapshot_id)do update set phase='binary',binary_data_json=excluded.binary_data_json,binary_hash=excluded.binary_hash,binary_revision=excluded.binary_revision,
 binary_generation=null,binary_slot=null,generation=private.published_data_refresh_queue.generation+1,attempt_count=0,lease_token=null,lease_until=null,locked_by=null,next_attempt_at=clock_timestamp();
$$;
insert into variant_results values('resource-playback-before',public.get_sync_binary_playback_v1('10000000-0000-4000-8000-000000226231',array[(select(value->>'snapshotId')::uuid from variant_results where name='base')]));
-- Isolate admission from earlier deliberately unknown writer fixtures.
update private.sync_published_binary_state set attempt_reservations='{}'where snapshot_id=(select(value->>'snapshotId')::uuid from variant_results where name='base');
set local role service_role;
select pg_temp.queue_binary_resource_fixture(repeat('1',64));
insert into variant_results select 'resource-cap-1',value from public.claim_dynamic_render_job_v3('resource-cap',60,3)value;
select pg_temp.queue_binary_resource_fixture(repeat('2',64));
insert into variant_results select 'resource-cap-2',value from public.claim_dynamic_render_job_v3('resource-cap',60,3)value;
select pg_temp.queue_binary_resource_fixture(repeat('3',64));
insert into variant_results select 'resource-cap-3',value from public.claim_dynamic_render_job_v3('resource-cap',60,3)value;
select pg_temp.queue_binary_resource_fixture(repeat('4',64));
insert into variant_results select 'resource-cap-denied',to_jsonb(count(*))from public.claim_dynamic_render_job_v3('resource-cap',60,3);
reset role;
select is((select count(*)from variant_results where name in('resource-cap-1','resource-cap-2','resource-cap-3')),3::bigint,'three different hashes may reserve the same inactive slot');
select is((select count(distinct value->>'lease_token')from variant_results where name in('resource-cap-1','resource-cap-2','resource-cap-3')),3::bigint,'each resource claim owns a distinct writer namespace');
select is((select value from variant_results where name='resource-cap-denied'),'0'::jsonb,'a fourth source hash cannot reset the outstanding writer cap');
select is((select count(*)from private.sync_published_binary_state cache,jsonb_each(cache.attempt_reservations)where cache.snapshot_id=(select(value->>'snapshotId')::uuid from variant_results where name='base')),3::bigint,'denial neither replaces nor drops old reservations');
-- Isolate the tenant budget from the target slot cap.
update private.sync_published_binary_state set attempt_reservations='{}'where snapshot_id=(select(value->>'snapshotId')::uuid from variant_results where name='base');
insert into private.sync_published_binary_state(tenant_id,configuration_snapshot_id,snapshot_id,content_hash,attempt_reservations,cleanup_not_before)
 select '10000000-0000-4000-8000-000000226231',gen_random_uuid(),null,repeat('e',64),coalesce(jsonb_object_agg(gen_random_uuid()::text,jsonb_build_object('slot',(n-1)%3,'reservedBytes',83886080)),'{}'),clock_timestamp()+'1 day'::interval
 from generate_series(1,floor((536870912-private.sync_binary_cache_bytes_v1('10000000-0000-4000-8000-000000226231'))::numeric/83886080)::integer)n;
insert into variant_results values('resource-budget-before',to_jsonb(private.sync_binary_cache_bytes_v1('10000000-0000-4000-8000-000000226231')));
select ok((select(value::text)::bigint<=536870912 and(value::text)::bigint+83886080>536870912 from variant_results where name='resource-budget-before'),'the tenant fits512MiB but cannot reserve another complete upload');
set local role service_role;
select pg_temp.queue_binary_resource_fixture(repeat('5',64));
insert into variant_results select 'resource-budget-denied',to_jsonb(count(*))from public.claim_dynamic_render_job_v3('resource-budget',60,3);
reset role;
select is((select value from variant_results where name='resource-budget-denied'),'0'::jsonb,'tenant-wide retained writers stop admission before exceeding512MiB');
select is(to_jsonb(private.sync_binary_cache_bytes_v1('10000000-0000-4000-8000-000000226231')),(select value from variant_results where name='resource-budget-before'),'budget denial preserves every byte reservation');
select is(public.get_sync_binary_playback_v1('10000000-0000-4000-8000-000000226231',array[(select(value->>'snapshotId')::uuid from variant_results where name='base')]),(select value from variant_results where name='resource-playback-before'),'resource exhaustion preserves complete current playback');
select is(pg_temp.frozen_history(),(select value from variant_results where name='history'),'resource exhaustion creates no publication or render history');
select *from finish();rollback;
