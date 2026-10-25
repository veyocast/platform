import {spawn}from'node:child_process';
import {createInterface}from'node:readline';
import assert from'node:assert/strict';
import {createSyncStudioStarter}from'../packages/studio/src/sync';
import {syncDynamicConfigurationSchema,syncSlidePageCount}from'../packages/contracts/src/index';
import {mkdir,writeFile}from'node:fs/promises';
import {prepareSyncDynamicDescriptor,renderSyncDynamicArtifact}from'../apps/media-worker/src/sync-dynamic-render';
import {parseClaimedDynamicRenderJob,dynamicRenderStoragePath}from'../apps/media-worker/src/dynamic-render-backend';
const port=process.env.S292_LOCAL_DB_PORT??'63271';assert.match(port,/^[0-9]{4,5}$/);
const child=spawn('psql',['-XAtq','-h','127.0.0.1','-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{env:{...process.env,PGPASSWORD:'postgres'},stdio:['pipe','pipe','pipe']});
type SqlRow=Record<string,unknown>&{receipt:{slideId:string};replay:{slideId:string};claim:unknown;heavy:unknown;dom:unknown;dataLease:{leaseToken:string}|null;export:{status:string};queueHint:number;draftQueued:number;unpublishedReleaseCount:number;revision:number;binaryStates:number;binaryQueued:number;queued:number};
let serial=0,lines:string[]=[],errors='',pending:{marker:string;resolve:(value:SqlRow[])=>void;reject:(error:Error)=>void}|null=null;
createInterface({input:child.stdout}).on('line',line=>{
 if(pending&&line===pending.marker){const result=lines.filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));lines=[];const done=pending;pending=null;done.resolve(result);}else lines.push(line);
});
child.stderr.on('data',data=>{errors+=data;});child.on('exit',code=>{if(pending){pending.reject(Error(`Local SQL exited ${code}: ${errors}`));pending=null;}});
function query(sql:string):Promise<SqlRow[]>{assert(!pending);return new Promise((resolve,reject)=>{const marker=`S292_DONE_${++serial}`;pending={marker,resolve,reject};child.stdin.write(`${sql}\n\\echo ${marker}\n`);});}
const json=(value:unknown)=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const tenant='10000000-0000-4000-8000-000000292701',owner='00000000-0000-4000-8000-000000292701',source='20000000-0000-4000-8000-000000292701',playlist='30000000-0000-4000-8000-000000292701';
const human=`set local role authenticated;select set_config('request.jwt.claim.sub','${owner}',true);select set_config('request.jwt.claim.role','authenticated',true);`;
const worker=`set local role service_role;select set_config('request.jwt.claim.role','service_role',true);`;
try{
 for(const type of ['menu','news']as const)for(const orientation of ['landscape','portrait']as const){
  const starter=createSyncStudioStarter({family:type==='menu'?'menu':'rss',tenantName:'Eigen testclub',theme:'onzetrots-tv'}).syncPresentation!;
  const seed={...starter,orientation,rows:[],news:[],ownRowIndexes:[],rich:undefined,home:undefined,away:undefined,match:undefined,poll:undefined,state:'ready' as const};
  const configuration={maxItems:20,syncConfiguration:syncDynamicConfigurationSchema.parse({schemaVersion:1,kind:'dynamic',rendererVersion:seed.rendererVersion,sourceRevision:seed.sourceRevision,slideType:type,seed,secondsPerPage:3})};
  const created=await query(`begin;
   insert into public.tenants(id,name,slug)values('${tenant}','DOM integration','s292-dom');
   insert into public.tenant_settings(tenant_id)values('${tenant}');
   insert into auth.users(id,email)values('${owner}','s292-dom@test.invalid');
   insert into public.profiles(id,display_name)values('${owner}','Fixture owner');
   insert into public.tenant_memberships(tenant_id,user_id,role)values('${tenant}','${owner}','tenant_owner');
   insert into public.dynamic_data_sources(id,tenant_id,name,kind,config_json)values('${source}','${tenant}','Fixture source','${type==='menu'?'manual_products':'rss'}','${type==='menu'?'{}':'{"feedUrl":"https://news.example.test/rss"}'}');
   ${type==='menu'?`insert into public.tenant_products(tenant_id,data_source_id,source,slug,name,price_cents)select '${tenant}','${source}','manual','product-'||n,'Product '||n,250 from generate_series(1,5)n;`:`insert into public.dynamic_news_articles(tenant_id,data_source_id,external_id,title,intro,source_name,link,content_hash,published_at)select '${tenant}','${source}','article-'||n,'Volledige kop '||n,'Gecontroleerd nieuws','Fixture redactie','https://news.example.test/'||n,repeat('d',64),now()from generate_series(1,3)n;`}
   ${worker}select public.set_sync_dom_rollout_v2('${tenant}',true,repeat('a',40));reset role;
   ${human}
   select jsonb_build_object('receipt',public.mutate_sync_dynamic_authoring_v1('${tenant}','create',null,null,0,jsonb_build_object('templateVersionId',(select current_published_version_id from public.dynamic_templates where slide_type='${type}'and orientation='${orientation}'and status='published'order by slug limit 1),'dataSourceId','${source}','configuration',${json(configuration)}),'40000000-0000-4000-8000-000000292701'));
   reset role;${worker}
   select jsonb_build_object('queueHint',public.get_worker_queue_hint_v3(3));
   select jsonb_build_object('oldClaimCount',(select count(*)from public.claim_dynamic_render_job_v3('old-worker',30,3)));
   select jsonb_build_object('claim',(select value from public.claim_sync_dom_ready_job_v2('dom-worker',30,3)value));
  `);
  assert.equal(created.find(value=>'oldClaimCount'in value)?.oldClaimCount,0);const hint=created.find(value=>'queueHint'in value)!.queueHint;assert.equal(hint&32,32);assert.equal(hint&4,0);
  const raw=created.find(value=>value.claim)?.claim;assert(raw,'New v4 claim must carry the genuine canonical snapshot');
  const job=parseClaimedDynamicRenderJob(raw);assert.equal((job.snapshotData as Record<string,unknown>).syncPlaybackProtocol,2);
  const samples:number[]=[];for(let index=0;index<30;index++){const t=performance.now();prepareSyncDynamicDescriptor({job,assets:{}});samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);
  const started=performance.now(),prepared=prepareSyncDynamicDescriptor({job,assets:{}}),prepareMs=performance.now()-started;
  const artifact={byteLength:prepared.byteLength,checksumSha256:prepared.checksumSha256,width:prepared.width,height:prepared.height,storagePath:dynamicRenderStoragePath(job,prepared.dom.mimeType,prepared.checksumSha256),...prepared.dom};
  await query(`do $test$ begin begin perform public.complete_dynamic_dom_job_v2('${job.jobId}','dom-worker','ffffffff-ffff-4fff-8fff-ffffffffffff',${json(artifact)});exception when sqlstate '55000'then return;end;raise exception 'missing lease fence';end;$test$;
   do $test$ begin begin perform public.complete_dynamic_dom_job_v2('${job.jobId}','dom-worker','${job.leaseToken}',${json({...artifact,storagePath:artifact.storagePath.replace(tenant,owner)})});exception when sqlstate '23514'then return;end;raise exception 'missing tenant path fence';end;$test$;`);
  const completed=await query(`select jsonb_build_object('complete',public.complete_dynamic_dom_job_v2('${job.jobId}','dom-worker','${job.leaseToken}',${json(artifact)}));
   select jsonb_build_object('replay',public.complete_dynamic_dom_job_v2('${job.jobId}','dom-worker','${job.leaseToken}',${json(artifact)}));
   reset role;
   select jsonb_build_object('kind',kind,'variants',(select count(*)from public.media_variants where asset_id=asset.id),'snapshotStatus',(select status from public.dynamic_slide_snapshots where id='${job.snapshotId}'))from public.media_assets asset where id='${job.outputMediaAssetId}';
   savepoint unpublished_export;
   ${human}select jsonb_build_object('draftExport',public.request_sync_export_v2('${tenant}','${job.snapshotId}','90000000-0000-4000-8000-000000292700'));reset role;
   select jsonb_build_object('draftQueued',(select count(*)from private.published_data_refresh_queue where phase='binary'),'unpublishedReleaseCount',(select count(*)from public.playlist_releases where tenant_id='${tenant}'));
   rollback to savepoint unpublished_export;
   insert into public.playlists(id,tenant_id,name)values('${playlist}','${tenant}','DOM fixture playlist');
   insert into public.screens(id,tenant_id,name,orientation,status)values('70000000-0000-4000-8000-000000292701','${tenant}','Fixture target','${orientation}','active');
   ${human}
   select public.mutate_playlist_batch_v1('${playlist}',0,jsonb_build_array(jsonb_build_object('operation','add_sync_dynamic','clientId','50000000-0000-4000-8000-000000292701','dynamicSlideId','${created.find(value=>value.receipt)!.receipt.slideId}','expectedSnapshotId','${job.snapshotId}','snapshotId','${job.snapshotId}','durationSeconds',${artifact.durationMs/1000})),'60000000-0000-4000-8000-000000292701');
   select jsonb_build_object('publication',public.publish_playlist_to_targets_v3('${playlist}',(select revision from public.playlists where id='${playlist}'),array['70000000-0000-4000-8000-000000292701'::uuid],'DOM fixture','80000000-0000-4000-8000-000000292701'));
   reset role;
   select jsonb_build_object('schemaVersion',manifest_json->'schemaVersion','binaryStates',(select count(*)from private.sync_published_binary_state),'live',(select bool_and(live_data_enabled)from public.playlist_release_items where release_id=release.id))from public.playlist_releases release where playlist_id='${playlist}';
  `);
  assert.equal(completed.find(value=>value.complete)?.complete,job.outputMediaAssetId);assert.equal(completed.find(value=>value.replay)?.replay,job.outputMediaAssetId);
  const draft=completed.find(value=>'draftQueued'in value);assert.equal(draft.draftQueued,1);assert.equal(draft.unpublishedReleaseCount,0);
  const status=completed.find(value=>value.kind);assert.equal(status.kind,'composition');assert.equal(status.variants,1);assert.equal(status.snapshotStatus,'ready');
  const publication=completed.find(value=>'schemaVersion'in value);assert.equal(publication.schemaVersion,2);assert.equal(publication.binaryStates,0);assert.equal(publication.live,true);
  const lease=(await query(`${worker}select jsonb_build_object('dataLease',public.claim_published_data_refresh_v1('dom-data',60));`)).find(value=>'dataLease'in value)?.dataLease;
  if(lease)await query(`select public.complete_published_data_refresh_v1('${tenant}','${job.snapshotId}','${lease.leaseToken}');`);
  const dataState=(await query(`reset role;select jsonb_build_object('binaryStates',(select count(*)from private.sync_published_binary_state),'revision',(select data_revision from public.published_dynamic_data where snapshot_id='${job.snapshotId}'));`))[0];
  assert.equal(dataState.binaryStates,0);assert.equal(dataState.revision,1);
  // Real source triggers may queue a lightweight refresh, never a capture.
  const before=(await query(`select jsonb_build_object('snapshots',(select count(*)from public.dynamic_slide_snapshots where tenant_id='${tenant}'),'jobs',(select count(*)from public.dynamic_render_jobs where tenant_id='${tenant}'),'releases',(select count(*)from public.playlist_releases where tenant_id='${tenant}'));`))[0];
  await query(type==='menu'?`update public.tenant_products set name='Actueel product' where tenant_id='${tenant}'and slug='product-1';`:`update public.dynamic_news_articles set title='Gewijzigde volledige kop'where tenant_id='${tenant}'and external_id='article-1';`);
  if(type==='news')await query(`update public.dynamic_data_sources set last_successful_sync_at=now()-interval '1 second'where id='${source}';update public.dynamic_data_sources set revision=revision+1,last_successful_sync_at=now()where id='${source}';`);
  const nextLease=(await query(`${worker}select jsonb_build_object('dataLease',(select value from public.claim_published_data_refresh_v1('dom-data',60)value));`))[0]?.dataLease;
  assert(nextLease,'The actual source update must schedule a live data refresh');
  await query(`select public.complete_published_data_refresh_v1('${tenant}','${job.snapshotId}','${nextLease.leaseToken}');reset role;`);
  const changed=(await query(`select jsonb_build_object('revision',(select data_revision from public.published_dynamic_data where snapshot_id='${job.snapshotId}'),'snapshots',(select count(*)from public.dynamic_slide_snapshots where tenant_id='${tenant}'),'jobs',(select count(*)from public.dynamic_render_jobs where tenant_id='${tenant}'),'releases',(select count(*)from public.playlist_releases where tenant_id='${tenant}'),'binaryStates',(select count(*)from private.sync_published_binary_state));`))[0];
  assert.equal(changed.revision,2);assert.equal(changed.binaryStates,0);
  for(const name of ['snapshots','jobs','releases'])assert.equal(changed[name],before[name],`${name} must remain immutable during live data refresh`);
  // A duplicate refresh carries a new observation, with identical content.
  await query(`insert into private.published_data_refresh_queue(tenant_id,snapshot_id,data_source_id,phase)values('${tenant}','${job.snapshotId}','${source}','data')on conflict(tenant_id,snapshot_id)do update set next_attempt_at=clock_timestamp();`);
  const unchangedLease=(await query(`${worker}select jsonb_build_object('dataLease',(select value from public.claim_published_data_refresh_v1('dom-data',60)value));`))[0]?.dataLease;
  assert(unchangedLease);
  await query(`select public.complete_published_data_refresh_v1('${tenant}','${job.snapshotId}','${unchangedLease.leaseToken}');reset role;`);
  assert.equal((await query(`select jsonb_build_object('revision',data_revision)from public.published_dynamic_data where snapshot_id='${job.snapshotId}';`))[0].revision,2);
  if(process.env.S292_VERIFY_EXPORT==='1'&&orientation==='landscape'){
   const explicitKey='90000000-0000-4000-8000-000000292701';
   const exported=await query(`${human}select jsonb_build_object('receipt',public.request_sync_export_v2('${tenant}','${job.snapshotId}','${explicitKey}'));select jsonb_build_object('replay',public.request_sync_export_v2('${tenant}','${job.snapshotId}','${explicitKey}'));reset role;
    select jsonb_build_object('queued',(select count(*)from private.published_data_refresh_queue where phase='binary'));${worker}select jsonb_build_object('claim',(select value from public.claim_dynamic_render_job_v4('explicit-export',120,3)value));`);
   assert.deepEqual(exported.find(value=>value.receipt)?.receipt,exported.find(value=>value.replay)?.replay);assert.equal(exported.find(value=>'queued'in value)!.queued,1);
   const binaryJob=parseClaimedDynamicRenderJob(exported.find(value=>value.claim)!.claim);assert.equal(binaryJob.publishedRefresh,true);
   let renewed=Promise.resolve<SqlRow[]>([]);const renewal=setInterval(()=>{renewed=renewed.then(()=>query(`select public.renew_sync_binary_render_v1('${tenant}','${job.snapshotId}','explicit-export','${binaryJob.leaseToken}');`));},30000);
   const exportStarted=performance.now();let binary;try{binary=await renderSyncDynamicArtifact({job:binaryJob,assets:{},renderer:{renderPng:async()=>{throw Error('Alternative renderer forbidden');},renderRgba:async()=>{throw Error('Alternative renderer forbidden');}}});}finally{clearInterval(renewal);await renewed;}const exportMs=performance.now()-exportStarted;
   const output={byteLength:binary.byteLength,checksumSha256:binary.checksumSha256,width:binary.width,height:binary.height,mimeType:binary.mimeType,durationMs:binary.durationMs,presentation:binary.presentation,storagePath:dynamicRenderStoragePath(binaryJob,binary.mimeType,binary.checksumSha256),poster:{byteLength:binary.poster.byteLength,checksumSha256:binary.poster.checksumSha256,storagePath:dynamicRenderStoragePath(binaryJob,'image/png',binary.poster.checksumSha256)}};
   await query(`select public.complete_sync_binary_render_v1('${tenant}','${job.snapshotId}','explicit-export','${binaryJob.leaseToken}',${json(output)});reset role;${human}select jsonb_build_object('export',public.read_sync_export_v2('${tenant}','${job.snapshotId}'));reset role;`);
   await mkdir('/tmp/castivo-s292-explicit-exports',{recursive:true});await writeFile(`/tmp/castivo-s292-explicit-exports/${type}.${binary.mimeType==='video/mp4'?'mp4':'png'}`,binary.bytes);
   const reuse=await query(`${human}select public.request_sync_export_v2('${tenant}','${job.snapshotId}','90000000-0000-4000-8000-000000292702');select jsonb_build_object('export',public.read_sync_export_v2('${tenant}','${job.snapshotId}'));reset role;select jsonb_build_object('queued',(select count(*)from private.published_data_refresh_queue where phase='binary'));`);
   assert.equal(reuse.find(value=>value.export)?.export.status,'ready');assert.equal(reuse.find(value=>'queued'in value)!.queued,0);
   console.log(JSON.stringify({type,explicitExport:true,nativeCapture:true,encode:binary.mimeType==='video/mp4',exportMs,bytes:binary.byteLength,posterBytes:binary.poster.byteLength,durationMs:binary.durationMs,deduplicated:true,storageUpload:false}));
  }
  const legacy=await query(`${worker}
   select jsonb_build_object('legacy',public.get_sync_binary_playback_v1('${tenant}',array['${job.snapshotId}'::uuid]));reset role;
   select jsonb_build_object('binaryQueued',(select count(*)from private.published_data_refresh_queue where phase='binary'),'binaryStates',(select count(*)from private.sync_published_binary_state));`);
  assert.equal(legacy.find(value=>'binaryStates'in value)!.binaryStates,1);
  assert.equal(legacy.find(value=>'binaryQueued'in value)!.binaryQueued,process.env.S292_VERIFY_EXPORT==='1'&&orientation==='landscape'?0:1);
  if(!(process.env.S292_VERIFY_EXPORT==='1'&&orientation==='landscape')){
   const lane=await query(`${worker}select jsonb_build_object('heavy',(select value from public.claim_dynamic_render_job_v3('held-heavy-export',120,3)value));reset role;${human}
    select jsonb_build_object('receipt',public.mutate_sync_dynamic_authoring_v1('${tenant}','create',null,null,0,jsonb_build_object('templateVersionId','${job.templateVersionId}','dataSourceId','${source}','configuration',${json(configuration)}),'40000000-0000-4000-8000-000000292702'));reset role;${worker}
    select jsonb_build_object('dom',(select value from public.claim_sync_dom_ready_job_v2('independent-dom',30,3)value));`);
   assert.equal(parseClaimedDynamicRenderJob(lane.find(value=>value.heavy)!.heavy).publishedRefresh,true);
   const independent=parseClaimedDynamicRenderJob(lane.find(value=>value.dom)!.dom),ready=prepareSyncDynamicDescriptor({job:independent,assets:{}});
   const receipt={...ready.dom,width:ready.width,height:ready.height,byteLength:ready.byteLength,checksumSha256:ready.checksumSha256,storagePath:dynamicRenderStoragePath(independent,ready.dom.mimeType,ready.checksumSha256)};
   await query(`select public.complete_dynamic_dom_job_v2('${independent.jobId}','independent-dom','${independent.leaseToken}',${json(receipt)});reset role;`);
  }
  await query('rollback;');
  console.log(JSON.stringify({type,orientation,descriptorBytes:prepared.byteLength,pages:syncSlidePageCount(prepared.dom.presentation),prepareMs,prepareSamples:30,prepareP50Ms:samples[14],prepareP95Ms:samples[28],publicationSchema:2,binaryBeforeLegacyDemand:0,legacyDemandQueued:!(process.env.S292_VERIFY_EXPORT==='1'&&orientation==='landscape'),unpublishedExportDoesNotPublish:true,leaseAndTenantFences:true,independentQueue:!(process.env.S292_VERIFY_EXPORT==='1'&&orientation==='landscape'),exactCompletionReplay:true,changedDataRevision:2,unchangedRevisionStable:true,immutableRowsStable:true,rolledBack:true}));
 }
}finally{child.stdin.end();}
