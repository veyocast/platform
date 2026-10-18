import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
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
const authFile='/tmp/veyocast-s226-qa-auth-state.json',configFile='/tmp/veyocast-s226-local-status.json',checkpoint='/tmp/veyocast-s226-dynamic-editor-state.json';
for(const file of[authFile,configFile])assert.equal(statSync(file).mode&0o777,0o600);
const cfg=JSON.parse(readFileSync(configFile,'utf8'));assert.equal(cfg.API_URL,'http://127.0.0.1:57621');assert.equal(new URL(cfg.DB_URL).port,'57622');
assert.equal(execFileSync('docker',['inspect','--format','{{index .Config.Labels "com.supabase.cli.project"}}',container],{encoding:'utf8'}).trim(),'veyocast-s226');
function sql(query:string){return execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
const worker=JSON.parse(readFileSync('execution/evidence/sync-dynamic-real-worker.json','utf8'));assert.equal(worker.status,'PASS');assert.match(worker.slideId,/^[a-f0-9-]{36}$/);
type State={name:string;versionId?:string;saveCommands?:unknown[];snapshotId?:string;jobId?:string};
if(existsSync(checkpoint))assert.equal(statSync(checkpoint).mode&0o777,0o600);
const state:State=existsSync(checkpoint)?JSON.parse(readFileSync(checkpoint,'utf8')):{name:'S226 gekoppelde bewerking '+Date.now()};assert.match(state.name,/^S226 gekoppelde bewerking \d+$/);
const save=()=>writeFileSync(checkpoint,JSON.stringify(state),{mode:0o600});save();
const historyQuery=`select md5(coalesce(string_agg(row_to_json(r)::text,','order by id),''))from public.playlist_releases r where tenant_id='${tenant}'`;
const releaseHash=sql(historyQuery),initialJobs=Number(sql(`select count(*)from public.dynamic_render_jobs where tenant_id='${tenant}'`));
const report:Record<string,unknown>={status:'RUNNING',startedAt:new Date().toISOString(),controlBuildId:readFileSync('apps/control/.next/BUILD_ID','utf8').trim(),scope:'actual Source dynamic editor, existing AAL2 version and read-only canonical preview, exact lost-save receipt recovery, explicit complete worker output; no Source create/team/pool selector, provider, hardware or hosted deployment claim',slideId:worker.slideId};
const browser=await chromium.launch(),context=await browser.newContext({storageState:authFile,ignoreHTTPSErrors:true,viewport:{width:1440,height:1000},reducedMotion:'reduce'});
await context.addCookies([{name:'veyocast-tenant-context',value:'duindorp-sites-local-qa',url:base,httpOnly:true,sameSite:'Lax'}]);const page=await context.newPage(),expect=baseExpect.configure({timeout:30000});
let dropped=false;const commands:Array<Record<string,unknown>>=[];
const failures:string[]=[];page.on('pageerror',error=>failures.push(error.message.slice(0,200)));
try{
 await page.goto(base+'/dashboard/slides/'+worker.slideId+(state.versionId?'/edit':''),{waitUntil:'domcontentloaded',timeout:120000});
 assert.ok(page.url().startsWith(base+'/dashboard/slides/'));await context.storageState({path:authFile});
 if(!state.versionId){
  await page.getByRole('button',{name:'Nieuwe versie maken',exact:true}).click();await expect(page).toHaveURL(new RegExp('/dashboard/slides/'+worker.slideId+'/edit'));
  state.versionId=sql(`select active_draft_version_id from public.dynamic_slides where tenant_id='${tenant}'and id='${worker.slideId}'`);save();
 }
 assert.match(state.versionId!,/^[a-f0-9-]{36}$/);report.versionId=state.versionId;
 const editor=page.locator('.sync-studio-frame:visible');
 const name=editor.getByLabel('Ontwerpnaam',{exact:true});await expect(name).toHaveCount(1);await expect(name).toBeEnabled();
 await expect(page.locator('.vc-stage-canvas .vc-slide-preview')).toContainText('Bronproduct 1');
 await page.getByRole('button',{name:'Gegevensbron',exact:true}).click();await expect(page.getByLabel('Bronregels',{exact:true})).toHaveValue('9');await expect(page.getByLabel('Rijen · één rij per regel')).toHaveCount(0);
 assert.equal(Number(sql(`select count(*)from public.dynamic_render_jobs where tenant_id='${tenant}'`)),initialJobs);report.previewReadOnly=true;
 await page.route(base+'/dashboard/slides/'+worker.slideId+'/edit**',async route=>{
  const body=route.request().postData();
  if(route.request().method()!=='POST'||!body||!body.includes('"action":"save"'))return route.continue();
  const input=JSON.parse(body)[0]as Record<string,unknown>;assert.equal(input.slideId,worker.slideId);assert.equal(input.versionId,state.versionId);assert.match(String(input.idempotencyKey),/^[a-f0-9-]{36}$/);commands.push(input);
  if(!dropped){const reply=await route.fetch();assert.equal(reply.status(),200);assert.equal(Number(sql(`select count(*)from public.publisher_command_receipts where tenant_id='${tenant}'and command_type='sync.dynamic.authoring'and idempotency_key='${input.idempotencyKey}'`)),1);dropped=true;state.saveCommands=commands;save();return route.abort();}
  return route.continue();
 });
 await name.fill(state.name);await page.getByRole('button',{name:'Inhoud',exact:true}).click();await page.getByLabel('Titel op het scherm',{exact:true}).fill('Eigen geverifieerde bronproducten');await page.getByRole('button',{name:'Opslaan',exact:true}).click();await expect(page.locator('.notice[role="alert"]')).toContainText('antwoord is verloren');await expect(name).toBeDisabled();
 await page.reload({waitUntil:'domcontentloaded',timeout:120000});await expect(name).toHaveCount(1);await expect(name).toHaveValue(state.name);await page.getByRole('button',{name:'Dezelfde opdracht bevestigen',exact:true}).click();await expect(name).toBeEnabled();await expect(page.getByText('Je bronontwerp is opgeslagen.',{exact:false})).toBeVisible();
 assert.equal(commands.length,2);assert.deepEqual(commands[1],commands[0]);state.saveCommands=commands;save();report.exactSaveReceiptRecovered=true;
 const draft=JSON.parse(sql(`select jsonb_build_object('revision',edit_revision,'name',name,'seedName',configuration_json#>>'{syncConfiguration,seed,name}','rows',jsonb_array_length(configuration_json#>'{syncConfiguration,seed,rows}'))from public.dynamic_slide_versions where tenant_id='${tenant}'and id='${state.versionId}'`));assert.equal(draft.name,state.name);assert.equal(draft.seedName,state.name);assert.equal(draft.rows,0);report.savedDraft=draft;
 await page.getByRole('button',{name:'Instellingen',exact:true}).click();const prepare=page.getByRole('button',{name:'Afspeeluitvoer voorbereiden',exact:true});await expect(prepare).toBeEnabled();
 const axe=await new AxeBuilder({page}).analyze();assert.deepEqual(axe.violations,[]);report.axeViolations=0;report.widths=[];
 for(const width of[390,768,1024,1440,1920]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);(report.widths as number[]).push(width);}
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'execution/evidence/sync-dynamic-editor-real.png'});
 await prepare.click();await expect(page.getByText('De volledige bronuitvoer wordt voorbereid.',{exact:false})).toBeVisible();
 const snapshot=JSON.parse(sql(`select jsonb_build_object('snapshotId',s.id,'jobId',j.id,'status',j.status)from public.dynamic_slide_snapshots s join public.dynamic_render_jobs j on j.snapshot_id=s.id and j.tenant_id=s.tenant_id where s.tenant_id='${tenant}'and s.dynamic_slide_version_id='${state.versionId}'`));
 state.snapshotId=snapshot.snapshotId;state.jobId=snapshot.jobId;save();
 const pending=JSON.parse(sql("select coalesce(json_agg(id),'[]'::json)from public.dynamic_render_jobs where status in('queued','rendering')"));assert.ok(pending.every((id:string)=>id===state.jobId),'Never claim unrelated worker jobs');
 process.env.CHROMIUM_EXECUTABLE_PATH=chromium.executablePath();
 const result=await runDynamicRenderOnce({backend:new SupabaseDynamicRenderBackend(cfg.API_URL,cfg.SERVICE_ROLE_KEY),renderer:new ResvgSharpStudioRenderer(),storageOrigin:cfg.API_URL,config:{workerId:'s226-source-editor-proof',lockTimeoutSeconds:60,maxAttempts:3}});assert.equal(result.status,'completed');
 const completed=JSON.parse(sql(`select jsonb_build_object('status',s.status,'assetId',s.output_media_asset_id,'durationMs',s.sync_render_result_json->'durationMs','rows',jsonb_array_length(s.sync_render_result_json#>'{presentation,rows}'),'sha256',v.checksum_sha256,'bytes',v.file_size_bytes,'path',v.storage_path)from public.dynamic_slide_snapshots s join public.media_variants v on v.tenant_id=s.tenant_id and v.asset_id=s.output_media_asset_id and v.variant_type='player_1080p'where s.tenant_id='${tenant}'and s.id='${state.snapshotId}'`));assert.equal(completed.status,'ready');assert.equal(completed.rows,9);assert.equal(completed.durationMs,9000);
 const require=createRequire(process.cwd()+'/apps/control/package.json'),{createServerClient}=require('@supabase/ssr'),cookies=new Map((await context.cookies()).map(cookie=>[cookie.name,cookie]));
 const client=createServerClient(cfg.API_URL,cfg.ANON_KEY,{cookies:{getAll:()=>[...cookies.values()],setAll:()=>undefined}});assert.equal((await client.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,'aal2');
 const download=await client.storage.from('tenant-media').download(completed.path);assert.equal(download.error,null);const bytes=Buffer.from(await download.data.arrayBuffer());assert.equal(bytes.length,Number(completed.bytes));assert.equal(createHash('sha256').update(bytes).digest('hex'),completed.sha256);delete completed.path;report.completeOutput=completed;
 assert.equal(sql(historyQuery),releaseHash);report.existingReleasesUnchanged=true;report.explicitRenderJobsCreated=Number(sql(`select count(*)from public.dynamic_render_jobs where tenant_id='${tenant}'`))-initialJobs;assert.equal(report.explicitRenderJobsCreated,1);
 assert.deepEqual(failures,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.error=error instanceof Error?error.message.replace(/([?&]token=)[^\s"<>]+/g,'$1[redacted]').slice(0,1600):'proof failed';await page.screenshot({path:'/tmp/veyocast-s226-source-editor-failure.png',fullPage:true}).catch(()=>{});throw Error(String(report.error));}
finally{await browser.close();writeFileSync('execution/evidence/sync-dynamic-editor-real.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
