import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,readFileSync,statSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createSyncStudioStarter} from '../../packages/studio/src/sync';
import {syncDynamicConfigurationSchema} from '../../packages/contracts/src/sync-dynamic-configuration';
import {SupabaseDynamicRenderBackend} from '../../apps/media-worker/src/dynamic-render-backend';
import {ResvgSharpStudioRenderer} from '../../apps/media-worker/src/studio-render-resvg';
import {runDynamicRenderOnce} from '../../apps/media-worker/src/dynamic-render-runner';

assert.equal(process.env.VEYOCAST_S226_LOCAL_ACCEPTANCE,'1');assert.equal(process.cwd(),'/home/codex/repos/castivo-s226');
const configFile='/tmp/veyocast-s226-local-status.json',authFile='/tmp/veyocast-s226-qa-auth-state.json',checkpoint='/tmp/veyocast-s226-dynamic-worker-state.json';
for(const path of[configFile,authFile])assert.equal(statSync(path).mode&0o777,0o600);
const cfg=JSON.parse(readFileSync(configFile,'utf8')),auth=JSON.parse(readFileSync(authFile,'utf8'));
assert.equal(cfg.API_URL,'http://127.0.0.1:57621');assert.equal(new URL(cfg.DB_URL).port,'57622');
const container='supabase_db_veyocast-s226',tenant='19170000-0000-4000-8000-000000000010';
assert.equal(execFileSync('docker',['inspect','--format','{{.Name}} {{ index .Config.Labels "com.supabase.cli.project" }}',container],{encoding:'utf8'}).trim(),'/'+container+' veyocast-s226');
function sql(query:string){return execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
type State={name:string;sourceId?:string;slideId?:string;snapshotId?:string;jobId?:string;productKeys:string[]};
if(existsSync(checkpoint))assert.equal(statSync(checkpoint).mode&0o777,0o600);
const state:State=existsSync(checkpoint)?JSON.parse(readFileSync(checkpoint,'utf8')):{name:'S226 echte bronrender '+Date.now(),productKeys:Array.from({length:5},()=>randomUUID())};assert.match(state.name,/^S226 echte bronrender \d+$/);
const save=()=>writeFileSync(checkpoint,JSON.stringify(state),{mode:0o600});save();
const pending=JSON.parse(sql("select coalesce(json_agg(id),'[]'::json)from public.dynamic_render_jobs where status in('queued','rendering')"))as string[];assert.ok(pending.every(id=>id===state.jobId),'Never claim unrelated pending work');
const require=createRequire(process.cwd()+'/apps/control/package.json'),{createServerClient}=require('@supabase/ssr'),cookies=new Map(auth.cookies.map((cookie:{name:string})=>[cookie.name,cookie]));
const client=createServerClient(cfg.API_URL,cfg.ANON_KEY,{cookies:{getAll:()=>[...cookies.values()],setAll:(values:Array<{name:string}>)=>values.forEach(cookie=>cookies.set(cookie.name,cookie))}});
assert.equal((await client.auth.getUser()).data.user?.id,'19170000-0000-4000-8000-000000000001');assert.equal((await client.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,'aal2');
const initialReleaseHash=sql(`select md5(coalesce(string_agg(row_to_json(release)::text,','order by id),''))from public.playlist_releases release where tenant_id='${tenant}'`);
if(!state.sourceId){const old=await client.from('dynamic_data_sources').select('id').eq('tenant_id',tenant).eq('name',state.name);assert.equal(old.error,null);assert.ok(old.data.length<=1);if(old.data.length)state.sourceId=old.data[0].id;else{const created=await client.rpc('create_dynamic_data_source_v1',{p_tenant_id:tenant,p_name:state.name,p_kind:'manual_products',p_config_json:{}});assert.equal(created.error,null);state.sourceId=created.data;}save();}
assert.match(state.sourceId!,/^[a-f0-9-]{36}$/);
for(let i=0;i<5;i++){
 const result=await client.rpc('manage_tenant_product_v2',{p_tenant_id:tenant,p_product_id:null,p_data_source_id:state.sourceId,p_expected_revision:0,p_action:'create',p_values:{active:true,barcode:null,category:'Eigen testselectie',description:`Eigen werkelijk opgeslagen product ${i+1}`,externalId:`S226-REAL-${i+1}`,name:`Bronproduct ${i+1}`,priceCents:250+i*25,unit:null,vatRate:null},p_idempotency_key:state.productKeys[i]});
 assert.equal(result.error,null,'The real existing guarded catalog writer must confirm each product');
}
const seed=createSyncStudioStarter({family:'menu',tenantName:'Eigen bronclub'}).syncPresentation!;
const configuration=syncDynamicConfigurationSchema.parse({schemaVersion:1,kind:'dynamic',rendererVersion:'sync-v1',sourceRevision:seed.sourceRevision,slideType:'menu',secondsPerPage:3,seed:{...seed,name:state.name,title:'Eigen actuele bronproducten',style:{...seed.style,motion:'geen'}}});
const template=await client.from('dynamic_templates').select('current_published_version_id').eq('slug','editorial-arena-menubord-dark-landscape').eq('status','published').single();assert.equal(template.error,null);
if(!state.slideId){
 // This harness recovers only its unique, owned fixture after a lost create
 // reply. It does not claim a production authoring receipt for the legacy RPC.
 const prior=await client.from('dynamic_slides').select('id').eq('tenant_id',tenant).eq('name',state.name);assert.equal(prior.error,null);assert.ok(prior.data.length<=1);
 if(prior.data.length)state.slideId=prior.data[0].id;else{const created=await client.rpc('create_dynamic_slide_v1',{p_tenant_id:tenant,p_name:state.name,p_template_version_id:template.data.current_published_version_id,p_data_source_id:state.sourceId,p_selection_mode:'latest',p_configuration_json:{maxItems:200,syncConfiguration:configuration}});assert.equal(created.error,null,'The existing AAL2 canonical authoring command must accept Source');state.slideId=created.data.slideId;}save();
}
const snapshots=await client.from('dynamic_slide_snapshots').select('id,status,snapshot_data_json,source_revision_hash,output_media_asset_id,sync_render_result_json').eq('tenant_id',tenant).eq('dynamic_slide_id',state.slideId);assert.equal(snapshots.error,null);assert.equal(snapshots.data.length,1);const snapshot=snapshots.data[0];state.snapshotId=snapshot.id;
assert.equal(snapshot.snapshot_data_json.menu.products.length,5);assert.equal(snapshot.snapshot_data_json.syncConfiguration.seed.sourceRevision,seed.sourceRevision);assert.ok(snapshot.snapshot_data_json.generatedAt);
const queued=await client.from('dynamic_render_jobs').select('id,status,output_media_asset_id').eq('tenant_id',tenant).eq('snapshot_id',snapshot.id).single();assert.equal(queued.error,null);assert.notEqual(queued.data.status,'failed','Retain actual failure history for inspection');state.jobId=queued.data.id;save();
const rootRequire=createRequire(process.cwd()+'/package.json');process.env.CHROMIUM_EXECUTABLE_PATH=rootRequire('@playwright/test').chromium.executablePath();
const started=Date.now();const result=queued.data.status==='completed'?{status:'completed',jobId:queued.data.id,mediaAssetId:queued.data.output_media_asset_id}:await runDynamicRenderOnce({backend:new SupabaseDynamicRenderBackend(cfg.API_URL,cfg.SERVICE_ROLE_KEY),renderer:new ResvgSharpStudioRenderer(),storageOrigin:cfg.API_URL,config:{workerId:'s226-source-dynamic-proof',lockTimeoutSeconds:60,maxAttempts:3}});assert.equal(result.status,'completed');if(result.status!=='completed')throw Error('The complete dynamic render must finish');assert.equal(result.jobId,state.jobId);
const completed=await client.from('dynamic_slide_snapshots').select('status,sync_render_result_json').eq('tenant_id',tenant).eq('id',snapshot.id).single();assert.equal(completed.error,null);assert.equal(completed.data.status,'ready');const frozen=completed.data.sync_render_result_json;assert.equal(frozen.presentation.rows.length,5);assert.equal(frozen.presentation.rows[4][0],'Bronproduct 5');assert.equal(frozen.durationMs,6000);assert.equal(frozen.mimeType,'video/mp4');
const media=await client.from('media_assets').select('id,status,kind,mime_type,width,height,duration_seconds,checksum_sha256').eq('tenant_id',tenant).eq('id',result.mediaAssetId).single();assert.equal(media.error,null);assert.equal(media.data.kind,'video');assert.equal(media.data.status,'ready');assert.equal(media.data.duration_seconds,6);
const variants=await client.from('media_variants').select('variant_type,storage_path,file_size_bytes,checksum_sha256,mime_type').eq('tenant_id',tenant).eq('asset_id',result.mediaAssetId);assert.equal(variants.error,null);assert.equal(variants.data.length,3);
const downloaded:Record<string,{bytes:number;sha256:string}>={};let video:Buffer|undefined;
for(const variant of variants.data){const reply=await client.storage.from('tenant-media').download(variant.storage_path);assert.equal(reply.error,null);const bytes=Buffer.from(await reply.data.arrayBuffer()),sha=createHash('sha256').update(bytes).digest('hex');assert.equal(sha,variant.checksum_sha256);assert.equal(bytes.length,Number(variant.file_size_bytes));downloaded[variant.variant_type]={bytes:bytes.length,sha256:sha};if(variant.variant_type==='player_1080p')video=bytes;}
const directory=mkdtempSync('/tmp/veyocast-studio-render-s226-dynamic-');const frames:Array<{time:number;sha256:string;path:string}>=[];
try{const file=directory+'/complete-source.mp4';writeFileSync(file,video!,{mode:0o600});for(const time of[1.2,4.2]){const png=execFileSync('ffmpeg',['-v','error','-ss',String(time),'-i',file,'-frames:v','1','-f','image2pipe','-vcodec','png','pipe:1'],{maxBuffer:12*1024*1024,timeout:30000,stdio:['ignore','pipe','pipe']});const path=`execution/evidence/sync-dynamic-real-page-${frames.length+1}.png`;writeFileSync(path,png);frames.push({time,sha256:createHash('sha256').update(png).digest('hex'),path});}assert.notEqual(frames[0]!.sha256,frames[1]!.sha256);}finally{rmSync(directory,{recursive:true,force:true});}
assert.equal(sql(`select md5(coalesce(string_agg(row_to_json(release)::text,','order by id),''))from public.playlist_releases release where tenant_id='${tenant}'`),initialReleaseHash);
const report={status:'PASS',capturedAt:new Date().toISOString(),scope:'actual AAL2 catalog and canonical source creation, same dynamic queue with lease fencing, complete Source Chromium/FFmpeg artifact and authenticated private original/video/poster bytes; no external provider, Source binding UI, live refresh, publication, hardware or deployment claim',slideId:state.slideId,snapshotId:state.snapshotId,jobId:state.jobId,sourceId:state.sourceId,assetId:result.mediaAssetId,templateVersionId:template.data.current_published_version_id,sourceRevision:seed.sourceRevision,canonicalRows:5,pages:2,durationMs:6000,renderElapsedMs:Date.now()-started,media:media.data,downloaded,decodedFrames:frames,existingReleasesUnchanged:true};writeFileSync('execution/evidence/sync-dynamic-real-worker.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
