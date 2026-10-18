import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {chromium,expect as baseExpect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {runDynamicRenderOnce} from '../../apps/media-worker/src/dynamic-render-runner';
import {SupabaseDynamicRenderBackend} from '../../apps/media-worker/src/dynamic-render-backend';
import {ResvgSharpStudioRenderer} from '../../apps/media-worker/src/studio-render-resvg';

process.umask(0o077);
assert.equal(process.env.VEYOCAST_S226_LOCAL_ACCEPTANCE,'1');assert.equal(process.cwd(),'/home/codex/repos/castivo-s226');
const tenant='19170000-0000-4000-8000-000000000010',container='supabase_db_veyocast-s226',base='http://127.0.0.1:3220';
const auth='/tmp/veyocast-s226-qa-auth-state.json',config='/tmp/veyocast-s226-local-status.json',checkpoint='/tmp/veyocast-s226-led-binding-state.json';
for(const file of[auth,config])assert.equal(statSync(file).mode&0o777,0o600);
const cfg=JSON.parse(readFileSync(config,'utf8'));assert.equal(cfg.API_URL,'http://127.0.0.1:57621');assert.equal(new URL(cfg.DB_URL).port,'57622');
assert.equal(execFileSync('docker',['inspect','--format','{{index .Config.Labels "com.supabase.cli.project"}}',container],{encoding:'utf8'}).trim(),'veyocast-s226');
const sql=(query:string)=>execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
type State={name:string;flagKey:string;flagRevision:number;flagSet?:boolean;connectionId?:string;sourceId?:string;matchState?:Record<string,unknown>;fixturePrepared?:boolean;command?:Record<string,unknown>;recovery?:string;receiptRecovered?:boolean;slideId?:string;snapshotId?:string;jobId?:string};
if(existsSync(checkpoint))assert.equal(statSync(checkpoint).mode&0o777,0o600);
const state:State=existsSync(checkpoint)?JSON.parse(readFileSync(checkpoint,'utf8')):{name:'S226 Source-score '+Date.now(),flagKey:randomUUID(),flagRevision:0};assert.match(state.name,/^S226 Source-score \d+$/);
const save=()=>writeFileSync(checkpoint,JSON.stringify(state),{mode:0o600});save();
const frozenQuery=`select md5(coalesce(string_agg(row_to_json(r)::text,','order by id),''))from public.playlist_releases r where tenant_id='${tenant}'`,frozen=sql(frozenQuery);
const browser=await chromium.launch(),context=await browser.newContext({storageState:auth,ignoreHTTPSErrors:true,reducedMotion:'reduce',viewport:{width:1440,height:1000}}),expect=baseExpect.configure({timeout:30000});
await context.addCookies([{name:'veyocast-tenant-context',value:'duindorp-sites-local-qa',url:base,httpOnly:true,sameSite:'Lax'}]);
const recoveryKey=`veyocast.sync.dynamic.draft.v1:${tenant}:ledscores_live_match:scoreboard:new`;
if(state.recovery&&!state.receiptRecovered)await context.addInitScript(({key,value})=>sessionStorage.setItem(key,value),{key:recoveryKey,value:state.recovery});
const page=await context.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message.slice(0,300)));
const report:Record<string,unknown>={status:'RUNNING',startedAt:new Date().toISOString(),controlBuildId:readFileSync('apps/control/.next/BUILD_ID','utf8').trim(),scope:'actual AAL2 Source LED choice, existing leased normalized-state ingestion RPC over an explicit owned fixture, canonical preview, exact lost create recovery and complete private worker output; no external websocket/provider, Player stream, hardware or hosted deployment claim'};
let dropped=Boolean(state.command),writes=0;
try{
 await page.goto(base+'/dashboard/sources',{waitUntil:'domcontentloaded',timeout:120000});await context.storageState({path:auth});
 const require=createRequire(process.cwd()+'/apps/control/package.json'),{createServerClient}=require('@supabase/ssr'),{createClient}=require('@supabase/supabase-js');
 const cookies=new Map((await context.cookies()).map(cookie=>[cookie.name,cookie]));
 const actor=createServerClient(cfg.API_URL,cfg.ANON_KEY,{cookies:{getAll:()=>[...cookies.values()],setAll:()=>undefined}}),service=createClient(cfg.API_URL,cfg.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 assert.equal((await actor.auth.getUser()).data.user?.id,'19170000-0000-4000-8000-000000000001');assert.equal((await actor.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,'aal2');
 if(!state.flagSet){
  const result=await actor.rpc('set_tenant_feature_flag_v2',{p_tenant_id:tenant,p_flag_key:'ledscores_realtime',p_enabled:true,p_reason:'S226 uitsluitend lokale Source-acceptatie met opgeslagen wedstrijdfixture; geen externe providerclaim',p_expected_revision:state.flagRevision,p_request_id:state.flagKey});assert.equal(result.error,null);state.flagSet=true;save();
 }
 if(!state.connectionId){
  const prior=JSON.parse(sql(`select coalesce(json_agg(jsonb_build_object('id',id,'sourceId',data_source_id)),'[]'::json)from public.ledscores_connections where tenant_id='${tenant}'and name='S226 Source-score fixture'`));assert.ok(prior.length<=1);
  if(!prior.length){assert.equal(Number(sql(`select count(*)from public.ledscores_connections where tenant_id='${tenant}'`)),0,'Never replace another connection');const result=await actor.rpc('save_ledscores_connection_v1',{p_tenant_id:tenant,p_connection_id:null,p_name:'S226 Source-score fixture',p_club_slug:'s226-owned-fixture',p_status:'active',p_expected_revision:0});assert.equal(result.error,null);}
  const own=JSON.parse(sql(`select jsonb_build_object('id',id,'sourceId',data_source_id)from public.ledscores_connections where tenant_id='${tenant}'and name='S226 Source-score fixture'`));state.connectionId=own.id;state.sourceId=own.sourceId;save();
 }
 for(const id of[state.connectionId,state.sourceId])assert.match(id!,/^[a-f0-9-]{36}$/);
 if(!state.fixturePrepared){
  assert.equal(Number(sql(`select count(*)from public.ledscores_connections where status='active'and id<>'${state.connectionId}'`)),0,'Never claim another provider lease');
  const claim=await service.rpc('claim_ledscores_connections_v1',{p_worker_id:'s226-owned-source-fixture',p_lease_seconds:120,p_limit:1});assert.equal(claim.error,null);assert.equal(claim.data.length,1);assert.equal(claim.data[0].connection_id,state.connectionId);
  if(!state.matchState){const now=new Date().toISOString();state.matchState={schemaVersion:1,connectionId:state.connectionId,matchKey:'s226-owned-match',stateRevision:1,sourceUpdateId:'s226-initial',sourceUpdatedAt:now,staleAfter:10,status:'live',periodLabel:'Eerste helft',homeTeamKey:'s226-home',awayTeamKey:'s226-away',home:{teamKey:'s226-home',name:'Eigen QA-thuis',score:2},away:{teamKey:'s226-away',name:'Eigen QA-uit',score:1},clock:{anchorAt:now,anchorSeconds:720,direction:'up',maxSeconds:7200,running:true},timeline:[]};save();}
  const result=await service.rpc('upsert_ledscores_live_match_state_v1',{p_connection_id:state.connectionId,p_worker_id:'s226-owned-source-fixture',p_state:state.matchState,p_source_observed_at:new Date().toISOString()});assert.equal(result.error,null);
  sql(`update public.dynamic_data_sources set provider_status='error',last_error_code='fixture_no_external_sync'where tenant_id='${tenant}'and id='${state.sourceId}'`);
  state.fixturePrepared=true;save();
 }
 report.fixture={sourceId:state.sourceId,connectionId:state.connectionId,existingLeasedIngestion:true,observedScore:'2–1',externalProviderVerified:false};
 if(!state.receiptRecovered){
  await page.route(base+'/dashboard/slides/new/sync**',async current=>{
   const body=current.request().postData();if(current.request().method()!=='POST'||!body?.includes('"action":"create"'))return current.continue();
   const input=JSON.parse(body)[0];assert.equal(input.action,'create');assert.equal(input.request.dataSourceId,state.sourceId);assert.equal(input.request.configuration.syncConfiguration.slideType,'ledscores_live_match');assert.deepEqual(input.request.configuration.syncConfiguration.seed.rows,[]);assert.equal(input.request.configuration.syncConfiguration.seed.home,undefined);writes++;
   if(!dropped){state.command=input;state.recovery=await page.evaluate(key=>sessionStorage.getItem(key),recoveryKey)??undefined;save();const response=await current.fetch();assert.equal(response.status(),200);assert.equal(Number(sql(`select count(*)from public.publisher_command_receipts where tenant_id='${tenant}'and idempotency_key='${input.idempotencyKey}'and command_type='sync.dynamic.authoring'`)),1);dropped=true;return current.abort();}
   assert.deepEqual(input,state.command);return current.continue();
  });
  const jobsBefore=Number(sql(`select count(*)from public.dynamic_render_jobs where tenant_id='${tenant}'`));
  await page.goto(base+'/dashboard/slides/new/sync?family=scoreboard',{waitUntil:'domcontentloaded',timeout:120000});const editor=page.locator('.sync-studio-frame:visible'),create=editor.getByRole('button',{name:'Maken en voorbereiden',exact:true});
  if(!state.command){await expect(create).toBeDisabled();await editor.getByLabel('Ontwerpnaam',{exact:true}).fill(state.name);await editor.getByLabel('Gekoppelde bron',{exact:true}).selectOption(state.sourceId!);await expect(editor.locator('.vc-slide-preview').first()).toContainText('Eigen QA-thuis');await expect(editor.locator('.vc-match-middle > strong').first()).toHaveText('2 – 1');await expect(create).toBeEnabled();
   assert.equal(Number(sql(`select count(*)from public.dynamic_render_jobs where tenant_id='${tenant}'`)),jobsBefore);report.previewReadOnly=true;
   for(const width of[390,768,1024,1440,1920]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
   await page.setViewportSize({width:1440,height:1000});const axe=await new AxeBuilder({page}).analyze();assert.deepEqual(axe.violations,[]);report.editorAxeViolations=0;await page.screenshot({path:'execution/evidence/sync-led-binding-ready.png'});
   await create.click();await expect(editor.locator('.notice[role="alert"]')).toContainText('antwoord is verloren');await page.reload({waitUntil:'domcontentloaded',timeout:120000});
  }
  await editor.getByRole('button',{name:'Dezelfde opdracht bevestigen',exact:true}).click();await expect(page).toHaveURL(/\/dashboard\/slides\/[a-f0-9-]{36}$/);state.slideId=new URL(page.url()).pathname.split('/').at(-1);state.receiptRecovered=true;save();
 }
 assert.match(state.slideId!,/^[a-f0-9-]{36}$/);report.slideId=state.slideId;report.exactCreateReceiptRecovered=true;report.transportWritesThisRun=writes;
 const own=JSON.parse(sql(`select jsonb_build_object('slideCount',(select count(*)from public.dynamic_slides where tenant_id='${tenant}'and name='${state.name}'),'snapshotId',s.id,'jobId',j.id,'jobStatus',j.status,'sourceId',s.data_source_id,'home',s.snapshot_data_json#>>'{liveMatch,state,home,name}','seedHasHome',(s.snapshot_data_json#>'{syncConfiguration,seed}')?'home')from public.dynamic_slide_snapshots s join public.dynamic_render_jobs j on j.tenant_id=s.tenant_id and j.snapshot_id=s.id where s.tenant_id='${tenant}'and s.dynamic_slide_id='${state.slideId}'`));assert.equal(own.slideCount,1);assert.equal(own.sourceId,state.sourceId);assert.equal(own.home,'Eigen QA-thuis');assert.equal(own.seedHasHome,false);state.snapshotId=own.snapshotId;state.jobId=own.jobId;save();report.canonical=own;
 const pending=JSON.parse(sql("select coalesce(json_agg(id),'[]'::json)from public.dynamic_render_jobs where status in('queued','rendering')"));assert.ok(pending.every((id:string)=>id===state.jobId),'Never claim unrelated render entries');
 process.env.CHROMIUM_EXECUTABLE_PATH=chromium.executablePath();
 if(own.jobStatus!=='completed'){const result=await runDynamicRenderOnce({backend:new SupabaseDynamicRenderBackend(cfg.API_URL,cfg.SERVICE_ROLE_KEY),renderer:new ResvgSharpStudioRenderer(),storageOrigin:cfg.API_URL,config:{workerId:'s226-source-led-proof',lockTimeoutSeconds:60,maxAttempts:3}});assert.equal(result.status,'completed');}
 const complete=JSON.parse(sql(`select jsonb_build_object('status',s.status,'assetId',s.output_media_asset_id,'durationMs',s.sync_render_result_json->'durationMs','home',s.sync_render_result_json#>>'{presentation,home,name}','score',s.sync_render_result_json#>>'{presentation,match,homeScore}','bytes',v.file_size_bytes,'sha256',v.checksum_sha256,'mimeType',v.mime_type,'path',v.storage_path)from public.dynamic_slide_snapshots s join public.media_variants v on v.tenant_id=s.tenant_id and v.asset_id=s.output_media_asset_id and v.variant_type='player_1080p'where s.tenant_id='${tenant}'and s.id='${state.snapshotId}'`));assert.equal(complete.status,'ready');assert.equal(complete.home,'Eigen QA-thuis');assert.equal(complete.score,'2');assert.equal(complete.durationMs,5000);
 const download=await actor.storage.from('tenant-media').download(complete.path);assert.equal(download.error,null);const bytes=Buffer.from(await download.data.arrayBuffer());assert.equal(bytes.length,Number(complete.bytes));assert.equal(createHash('sha256').update(bytes).digest('hex'),complete.sha256);delete complete.path;report.completeOutput=complete;
 await page.goto(base+'/dashboard/slides/'+state.slideId,{waitUntil:'domcontentloaded',timeout:120000});await expect(page.getByRole('heading',{name:state.name,exact:true})).toBeVisible();const axe=await new AxeBuilder({page}).analyze();assert.deepEqual(axe.violations,[]);report.detailAxeViolations=0;await page.screenshot({path:'execution/evidence/sync-led-binding-complete.png'});
 assert.equal(sql(frozenQuery),frozen);report.existingReleasesUnchanged=true;assert.deepEqual(errors,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.error=(error instanceof Error?error.message:'LED proof failed').replace(/([?&]token=)[^\s"<>]+/g,'$1[redacted]').slice(0,1600);report.browserErrors=errors;await page.screenshot({path:'/tmp/veyocast-s226-led-binding-failure.png',fullPage:true}).catch(()=>{});throw Error(String(report.error));}
finally{await browser.close();writeFileSync('execution/evidence/sync-led-binding-real.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
