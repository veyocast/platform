import {createHash}from'node:crypto';
import {ReactDomDynamicThumbnailRenderer}from'../apps/media-worker/src/dynamic-react-thumbnail';
import {menuDomFixture}from'../tests/helpers/menu-dom-fixture';
import {spawn}from'node:child_process';
import {createInterface}from'node:readline';
import assert from'node:assert/strict';
import {mkdir,writeFile}from'node:fs/promises';
import {readMenuDomArtifact,readMenuBinaryArtifact}from'../packages/contracts/src/index';
import {prepareMenuDomDescriptor}from'../apps/media-worker/src/menu-dom-render';
import {parseClaimedDynamicRenderJob,dynamicRenderStoragePath}from'../apps/media-worker/src/dynamic-render-backend';
const port=process.env.S292_LOCAL_DB_PORT??'63271';assert.match(port,/^[0-9]{4,5}$/);
const child=spawn('psql',['-XAtq','-h','127.0.0.1','-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{env:{...process.env,PGPASSWORD:'postgres'},stdio:['pipe','pipe','pipe']});
type SqlRow=Record<string,unknown>;
let serial=0,lines:string[]=[],errors='',pending:{marker:string;resolve:(value:SqlRow[])=>void;reject:(error:Error)=>void}|null=null;
createInterface({input:child.stdout}).on('line',line=>{
 if(pending&&line===pending.marker){const result=lines.filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));lines=[];const done=pending;pending=null;done.resolve(result);}else lines.push(line);
});
child.stderr.on('data',data=>{errors+=data;});child.on('exit',code=>{if(pending){pending.reject(Error(`Local SQL exited ${code}: ${errors}`));pending=null;}});
function query(sql:string):Promise<SqlRow[]>{assert(!pending);return new Promise((resolve,reject)=>{const marker=`S292_DONE_${++serial}`;pending={marker,resolve,reject};child.stdin.write(`${sql}\n\\echo ${marker}\n`);});}
const json=(value:unknown)=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;

const id=(n:number)=>`29220000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tenant=id(1),owner=id(2),source=id(3),product=id(4),playlist=id(5),screen=id(6);
const human=`set local role authenticated;select set_config('request.jwt.claim.sub','${owner}',true);select set_config('request.jwt.claim.role','authenticated',true);`;
const service=`set local role service_role;select set_config('request.jwt.claim.role','service_role',true);`;
const results:unknown[]=[];
try{
 for(const provider of ['manual_products','twelve_excel']as const)for(const orientation of ['landscape','portrait']as const){
  const {design,document}=menuDomFixture(provider,orientation);
  const created=await query(`begin;
   insert into public.tenants(id,name,slug)values('${tenant}','Menu DOM fixture','s292-menu-dom');
   insert into public.tenant_settings(tenant_id,menu_document_v2_read_enabled,menu_studio_v2_authoring_enabled,menu_studio_v2_linked_groups_enabled,menu_studio_v2_media_enabled,menu_studio_v2_publish_enabled,menu_studio_v2_player_enabled)values('${tenant}',true,true,true,true,true,true);
   insert into auth.users(id,email)values('${owner}','s292-menu@test.invalid');insert into public.profiles(id,display_name)values('${owner}','Menu fixture');insert into public.tenant_memberships(tenant_id,user_id,role)values('${tenant}','${owner}','tenant_owner');
   insert into public.dynamic_data_sources(id,tenant_id,name,kind,provider_status)values('${source}','${tenant}','Menu source','${provider}','ready');
   insert into public.tenant_products(id,tenant_id,data_source_id,source,source_external_id,slug,name,category,source_category_id,price_cents)values('${product}','${tenant}','${source}','${provider==='twelve_excel'?'twelve_excel':'manual'}','coffee','coffee','Clubkoffie','Warme dranken','${id(7)}',250);
   ${service}select public.set_sync_dom_rollout_v2('${tenant}',true,repeat('a',40));reset role;
   ${human}select jsonb_build_object('created',public.create_menu_studio_draft_v2('${tenant}','Menu DOM',(select current_published_version_id from public.dynamic_templates where slide_type='price_list'and orientation='${orientation}'and status='published'order by slug limit 1),'${source}','latest',${json(document)},'${id(9)}'));
  `);
  const receipt=created.find(row=>row.created)?.created as {slideId:string;document:{revision:number}};assert(receipt?.slideId);
  const claims=await query(`select public.publish_dynamic_slide_version_v1('${receipt.slideId}',(select active_draft_version_id from public.dynamic_slides where id='${receipt.slideId}'),${receipt.document.revision});reset role;${service}
   select jsonb_build_object('oldClaimCount',(select count(*)from public.claim_dynamic_render_job_v3('old',60,3)));
   select jsonb_build_object('claim',(select value from public.claim_sync_dom_ready_job_v2('menu-dom',60,3)value));`);
  assert.equal(claims.find(row=>'oldClaimCount'in row)?.oldClaimCount,0);
  const job=parseClaimedDynamicRenderJob(claims.find(row=>row.claim)?.claim);assert.equal((job.snapshotData as Record<string,unknown>).syncPlaybackProtocol,2);
  const start=performance.now(),prepared=prepareMenuDomDescriptor(job,{}),prepareMs=performance.now()-start;
  const artifact={byteLength:prepared.byteLength,checksumSha256:prepared.checksumSha256,width:prepared.width,height:prepared.height,storagePath:dynamicRenderStoragePath(job,prepared.menuDom.mimeType,prepared.checksumSha256),...prepared.menuDom};
  if(provider==='manual_products'&&orientation==='landscape')await writeFile('/tmp/castivo-s292-menu-contract-fixture.json',JSON.stringify({data:job.snapshotData,artifact}));
  assert(readMenuDomArtifact(job.snapshotData,artifact));assert(!prepared.bytes.toString().includes('signedUrl'));
  const complete=await query(`select jsonb_build_object('complete',public.complete_menu_dom_job_v2('${job.jobId}','menu-dom','${job.leaseToken}',${json(artifact)}));select jsonb_build_object('replay',public.complete_menu_dom_job_v2('${job.jobId}','menu-dom','${job.leaseToken}',${json(artifact)}));reset role;`);
  assert.equal(complete[0]?.complete,job.outputMediaAssetId);assert.equal(complete[1]?.replay,job.outputMediaAssetId);
  await query(`insert into public.playlists(id,tenant_id,name)values('${playlist}','${tenant}','Menu DOM fixture');insert into public.screens(id,tenant_id,name,orientation,status)values('${screen}','${tenant}','Menu DOM fixture','${orientation}','active');${human}
   select public.mutate_playlist_batch_v1('${playlist}',0,jsonb_build_array(jsonb_build_object('operation','add_dynamic','clientId','${id(10)}','dynamicSlideId','${receipt.slideId}','snapshotId','${job.snapshotId}','expectedSnapshotId','${job.snapshotId}','durationSeconds',${artifact.durationMs/1000},'sitesConfiguration',${json(design)})),'${id(11)}');
   select public.publish_playlist_to_targets_v3('${playlist}',(select revision from public.playlists where id='${playlist}'),array['${screen}'::uuid],'Menu DOM fixture','${id(12)}');reset role;
  `);
  const before=(await query(`select jsonb_build_object('schema',(select manifest_json->'schemaVersion'from public.playlist_releases where playlist_id='${playlist}'),'jobs',(select count(*)from public.dynamic_render_jobs where tenant_id='${tenant}'),'snapshots',(select count(*)from public.dynamic_slide_snapshots where tenant_id='${tenant}'),'exports',(select count(*)from private.sync_published_binary_state where tenant_id='${tenant}'),'revision',(select data_revision from public.published_dynamic_data where snapshot_id='${job.snapshotId}'));`))[0];
  assert.equal(before.schema,2);assert.equal(before.exports,0);assert.equal(before.revision,1);
  await query(`${service}select public.set_sync_dom_rollout_v2('${tenant}',false,repeat('a',40));reset role;update public.tenant_products set price_cents=999 where id='${product}';${service}select jsonb_build_object('dataLease',(select value from public.claim_published_data_refresh_v1('menu-data',60)value));`);
  // A price proposal is not authority to update approved published prices.
  const queue=(await query(`reset role;select jsonb_build_object('queued',(select lease_token from private.published_data_refresh_queue where tenant_id='${tenant}'and snapshot_id='${job.snapshotId}'and phase='data'));`))[0];
  if(queue.queued)await query(`${service}select public.complete_published_data_refresh_v1('${tenant}','${job.snapshotId}','${queue.queued}');reset role;`);
  const after=(await query(`select jsonb_build_object('jobs',(select count(*)from public.dynamic_render_jobs where tenant_id='${tenant}'),'snapshots',(select count(*)from public.dynamic_slide_snapshots where tenant_id='${tenant}'),'exports',(select count(*)from private.sync_published_binary_state where tenant_id='${tenant}'),'revision',(select data_revision from public.published_dynamic_data where snapshot_id='${job.snapshotId}'),'data',(select data_json from public.published_dynamic_data where snapshot_id='${job.snapshotId}'));`))[0];
  for(const key of ['jobs','snapshots','exports','revision'])assert.equal(after[key],before[key],key);
  assert(JSON.stringify(after.data).includes('250'));
  // Actual legacy demand uses the existing bounded cache/claim, no new release.
  const legacy=await query(`${service}select public.get_sync_binary_playback_v1('${tenant}',array['${job.snapshotId}'::uuid]);select jsonb_build_object('binaryClaim',(select value from public.claim_dynamic_render_job_v3('menu-legacy',120,3)value));reset role;`);
  const legacyJob=parseClaimedDynamicRenderJob(legacy.find(row=>row.binaryClaim)?.binaryClaim);assert.equal(legacyJob.publishedRefresh,true);assert.equal(legacyJob.snapshotId,job.snapshotId);assert.equal(legacyJob.orientation,orientation);
  let nativeExport:Record<string,unknown>|undefined;
  if(process.env.S292_VERIFY_MENU_EXPORT==='1'&&provider==='manual_products'&&orientation==='landscape'){
   const renderer=new ReactDomDynamicThumbnailRenderer(undefined,process.env.SITES_CAPTURE_TEST_CHROMIUM);const start=performance.now(),bytes=await renderer.renderPng({job:legacyJob,assets:{}}),exportMs=performance.now()-start,checksumSha256=createHash('sha256').update(bytes).digest('hex');
   const binary={...prepareMenuDomDescriptor(legacyJob,{}).menuDom,mimeType:'image/png',byteLength:bytes.byteLength,checksumSha256,width:prepared.width,height:prepared.height,storagePath:dynamicRenderStoragePath(legacyJob,'image/png',checksumSha256)};
   assert(readMenuBinaryArtifact(job.snapshotData,binary));
   const exported=await query(`${service}select public.complete_menu_binary_render_v2('${tenant}','${job.snapshotId}','menu-legacy','${legacyJob.leaseToken}',${json(binary)});reset role;${human}select public.request_sync_export_v2('${tenant}','${job.snapshotId}','${id(40)}');select jsonb_build_object('export',public.read_sync_export_v2('${tenant}','${job.snapshotId}'));reset role;select jsonb_build_object('queueCount',(select count(*)from private.published_data_refresh_queue where tenant_id='${tenant}'and phase='binary'));`);
   const value=exported.find(row=>row.export)?.export as {status:string;menuData:unknown;artifact:unknown};assert.equal(value.status,'ready');assert(readMenuBinaryArtifact(value.menuData,value.artifact));assert.equal(exported.find(row=>'queueCount'in row)?.queueCount,0);
   await writeFile('/tmp/castivo-s292-menu-explicit-export.png',bytes);nativeExport={exportMs,bytes:bytes.byteLength,mimeType:'image/png',sameSharedWidgetRenderer:true,explicitRequestReusesLegacyCache:true,storageUpload:false};
  }
  results.push({provider,orientation,descriptorBytes:prepared.byteLength,prepareMs,...(nativeExport?{nativeExport}:{}),pages:prepared.menuDom.presentation.kind==='dynamic'?prepared.menuDom.presentation.content.menuPages?.length:0,publicationSchema:2,nativeCapture:false,binaryBeforeDemand:0,approvedPricePreserved:true,unchangedRevision:true,rolledBack:true});
  await query('rollback;');
 }
 console.log(JSON.stringify(results,null,2));await mkdir('docs/implementation/s292-dom-ready-recovery',{recursive:true});await writeFile('docs/implementation/s292-dom-ready-recovery/menu-dom-rpc.json',JSON.stringify(results,null,2)+'\n');
}catch(error){console.error(error);process.exitCode=1;}finally{child.stdin.end();}
