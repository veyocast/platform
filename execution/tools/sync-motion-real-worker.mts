import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,readFileSync,statSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createSyncStudioStarter,updateSyncStudioDocument} from '../../packages/studio/src/sync';
import {SupabaseStudioRenderBackend} from '../../apps/media-worker/src/studio-render-backend';
import {ResvgSharpStudioRenderer} from '../../apps/media-worker/src/studio-render-resvg';
import {runStudioRenderOnce} from '../../apps/media-worker/src/studio-render-runner';

assert.equal(process.env.VEYOCAST_S226_LOCAL_ACCEPTANCE,'1');assert.equal(process.cwd(),'/home/codex/repos/castivo-s226');
const configFile='/tmp/veyocast-s226-local-status.json',authFile='/tmp/veyocast-s226-qa-auth-state.json',checkpoint='/tmp/veyocast-s226-motion-worker-state.json';
for(const path of [configFile,authFile])assert.equal(statSync(path).mode&0o777,0o600);
const cfg=JSON.parse(readFileSync(configFile,'utf8')),auth=JSON.parse(readFileSync(authFile,'utf8'));
assert.equal(cfg.API_URL,'http://127.0.0.1:57621');assert.equal(new URL(cfg.DB_URL).port,'57622');
const container='supabase_db_veyocast-s226',tenant='19170000-0000-4000-8000-000000000010';
assert.equal(execFileSync('docker',['inspect','--format','{{.Name}} {{ index .Config.Labels "com.supabase.cli.project" }}',container],{encoding:'utf8'}).trim(),'/'+container+' veyocast-s226');
function sql(query:string){return execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
type Checkpoint={name:string;createKey:string;renderKey:string;projectId?:string;jobId?:string};
if(existsSync(checkpoint))assert.equal(statSync(checkpoint).mode&0o777,0o600);
const state:Checkpoint=existsSync(checkpoint)?JSON.parse(readFileSync(checkpoint,'utf8')):{name:'S226 echte Motion '+Date.now(),createKey:randomUUID(),renderKey:randomUUID()};assert.match(state.name,/^S226 echte Motion \d+$/);
const save=()=>writeFileSync(checkpoint,JSON.stringify(state),{mode:0o600});save();
const pending=JSON.parse(sql("select coalesce(json_agg(id),'[]'::json) from public.studio_render_jobs where status not in('completed','failed','cancelled')")) as string[];assert.ok(pending.every(id=>id===state.jobId),'An unrelated pending job must not be claimed');
const require=createRequire(process.cwd()+'/apps/control/package.json'),{createServerClient}=require('@supabase/ssr');
const cookies=new Map(auth.cookies.map((cookie:{name:string})=>[cookie.name,cookie]));
const client=createServerClient(cfg.API_URL,cfg.ANON_KEY,{cookies:{getAll:()=>[...cookies.values()],setAll:(values:Array<{name:string}>)=>values.forEach(cookie=>cookies.set(cookie.name,cookie))}});
assert.equal((await client.auth.getUser()).data.user?.id,'19170000-0000-4000-8000-000000000001');assert.equal((await client.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,'aal2');
const initial=createSyncStudioStarter({family:'club-story',tenantName:'S226 lokale club'});
const document=updateSyncStudioDocument(initial,{...initial.syncPresentation!,name:state.name,title:'Een werkelijk gerenderde overgang',body:'Eigen tekst uit de geautoriseerde Source-renderketen.',style:{...initial.syncPresentation!.style,motion:'dynamisch'}},3);
assert.equal(document.motion.enabled,true);
if(!state.projectId){const created=await client.rpc('create_studio_project_v1',{p_tenant_id:tenant,p_name:state.name,p_orientation:'landscape',p_document:document,p_referenced_asset_ids:[],p_project_kind:'design',p_idempotency_key:state.createKey});assert.equal(created.error,null);state.projectId=created.data.projectId;save();}
assert.match(state.projectId!,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
const actual=await client.from('studio_project_drafts').select('document_json,draft_revision').eq('tenant_id',tenant).eq('project_id',state.projectId).single();assert.equal(actual.error,null);assert.deepEqual(actual.data.document_json,JSON.parse(JSON.stringify(document)));
const queued=await client.rpc('request_studio_render_v1',{p_project_id:state.projectId,p_expected_draft_revision:actual.data.draft_revision,p_output_kind:'mp4',p_idempotency_key:state.renderKey});assert.equal(queued.error,null);if(state.jobId)assert.equal(queued.data.renderJobId,state.jobId);else{state.jobId=queued.data.renderJobId;save();}
const beforeReleases=sql(`select count(*) from public.playlist_releases where tenant_id='${tenant}'`);
const previous=await client.from('studio_render_jobs').select('status,media_asset_id').eq('tenant_id',tenant).eq('id',state.jobId).single();assert.equal(previous.error,null);assert.notEqual(previous.data.status,'failed','Retain failure history and inspect before a manual retry');
const rootRequire=createRequire(process.cwd()+'/package.json');process.env.CHROMIUM_EXECUTABLE_PATH=rootRequire('@playwright/test').chromium.executablePath();
const started=Date.now();
const rendered=previous.data.status==='completed'?{status:'completed',jobId:state.jobId,mediaAssetId:previous.data.media_asset_id}:await runStudioRenderOnce({backend:new SupabaseStudioRenderBackend(cfg.API_URL,cfg.SERVICE_ROLE_KEY),renderer:new ResvgSharpStudioRenderer(),config:{workerId:'s226-source-motion-proof',lockTimeoutSeconds:900,maxAttempts:3}});
assert.equal(rendered.status,'completed');assert.equal(rendered.jobId,state.jobId);if(rendered.status!=='completed')throw Error('Motion render did not complete');
const assetId=rendered.mediaAssetId;
const media=await client.from('media_assets').select('id,status,kind,width,height,duration_seconds,checksum_sha256').eq('tenant_id',tenant).eq('id',assetId).single();assert.equal(media.error,null);assert.equal(media.data.status,'ready');assert.equal(media.data.kind,'video');assert.equal(media.data.duration_seconds,3);
const variant=await client.from('media_variants').select('storage_path,file_size_bytes,checksum_sha256').eq('tenant_id',tenant).eq('asset_id',assetId).eq('variant_type','player_1080p').single();assert.equal(variant.error,null);
const download=await client.storage.from('tenant-media').download(variant.data.storage_path);assert.equal(download.error,null);const bytes=Buffer.from(await download.data.arrayBuffer());const sha256=createHash('sha256').update(bytes).digest('hex');assert.equal(sha256,variant.data.checksum_sha256);assert.equal(bytes.length,Number(variant.data.file_size_bytes));assert.equal(sha256,media.data.checksum_sha256);
const directory=mkdtempSync('/tmp/veyocast-studio-render-s226-motion-');let frames:Array<{time:number;mean:number;sha256:string}>=[];
try{
  const file=directory+'/motion.mp4';writeFileSync(file,bytes,{mode:0o600});
  for(const time of [0,0.2,1.2]){const pixels=execFileSync('ffmpeg',['-v','error','-ss',String(time),'-i',file,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:12*1024*1024,timeout:30000,stdio:['ignore','pipe','pipe']});assert.equal(pixels.length,1920*1080*3);let total=0;for(const value of pixels)total+=value;frames.push({time,mean:total/pixels.length,sha256:createHash('sha256').update(pixels).digest('hex')});}
  assert.ok(frames[0]!.mean>frames[1]!.mean+10);assert.ok(frames[1]!.mean>frames[2]!.mean+3);
}finally{rmSync(directory,{recursive:true,force:true});}
assert.equal(sql(`select count(*) from public.playlist_releases where tenant_id='${tenant}'`),beforeReleases);
const report={status:'PASS',capturedAt:new Date().toISOString(),scope:'actual AAL2 create/render receipt, Chromium timed Source capture, FFmpeg encoding/validation and authenticated private Storage bytes; no publication/device/deployment claim',projectId:state.projectId,jobId:state.jobId,assetId,media:media.data,sha256,bytes:bytes.length,renderElapsedMs:Date.now()-started,selectedMotion:'dynamisch',durationMs:3000,decodedFrames:frames,unintendedReleases:0};writeFileSync('execution/evidence/sync-motion-real-worker.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
