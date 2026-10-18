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
const tenant='19170000-0000-4000-8000-000000000010',container='supabase_db_veyocast-s226',base='http://127.0.0.1:3220',route=base+'/dashboard/slides/new/sync?family=menu';
const authFile='/tmp/veyocast-s226-qa-auth-state.json',configFile='/tmp/veyocast-s226-local-status.json',checkpoint='/tmp/veyocast-s226-dynamic-create-state.json';
for(const file of[authFile,configFile])assert.equal(statSync(file).mode&0o777,0o600);
const cfg=JSON.parse(readFileSync(configFile,'utf8'));assert.equal(cfg.API_URL,'http://127.0.0.1:57621');assert.equal(new URL(cfg.DB_URL).port,'57622');
assert.equal(execFileSync('docker',['inspect','--format','{{index .Config.Labels "com.supabase.cli.project"}}',container],{encoding:'utf8'}).trim(),'veyocast-s226');
function sql(query:string){return execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
const source=JSON.parse(readFileSync('execution/evidence/sync-dynamic-real-worker.json','utf8'));assert.equal(source.status,'PASS');assert.match(source.sourceId,/^[a-f0-9-]{36}$/);
type State={name:string;command?:Record<string,unknown>;recovery?:string;receiptRecovered?:boolean;slideId?:string;snapshotId?:string;jobId?:string};
if(existsSync(checkpoint))assert.equal(statSync(checkpoint).mode&0o777,0o600);
const state:State=existsSync(checkpoint)?JSON.parse(readFileSync(checkpoint,'utf8')):{name:'S226 Source UI-aanmaak '+Date.now()};assert.match(state.name,/^S226 Source UI-aanmaak \d+$/);
const save=()=>writeFileSync(checkpoint,JSON.stringify(state),{mode:0o600});save();
const frozenQuery=`select md5(coalesce(string_agg(row_to_json(r)::text,','order by id),''))from public.playlist_releases r where tenant_id='${tenant}'`;
const frozen=sql(frozenQuery),jobsBefore=Number(sql(`select count(*)from public.dynamic_render_jobs where tenant_id='${tenant}'`));
const expect=baseExpect.configure({timeout:30000}),browser=await chromium.launch(),context=await browser.newContext({storageState:authFile,ignoreHTTPSErrors:true,reducedMotion:'reduce',viewport:{width:1440,height:1000}});
await context.addCookies([{name:'veyocast-tenant-context',value:'duindorp-sites-local-qa',url:base,httpOnly:true,sameSite:'Lax'}]);
if(state.recovery&&!state.receiptRecovered)await context.addInitScript(({key,value})=>sessionStorage.setItem(key,value),{key:`veyocast.sync.dynamic.draft.v1:${tenant}:menu:new`,value:state.recovery});
const page=await context.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message.slice(0,200)));
const report:Record<string,unknown>={status:'RUNNING',startedAt:new Date().toISOString(),controlBuildId:readFileSync('apps/control/.next/BUILD_ID','utf8').trim(),scope:'actual AAL2 Source menu creation with explicit canonical source selection, lost committed create response and exact receipt recovery, complete existing-worker artifact; no RSS/external provider, sport selectors, copied Studio origin, hardware or hosted deployment claim'};
let dropped=Boolean(state.command),writes:Array<Record<string,unknown>>=[];
try{
 if(!state.receiptRecovered){
  await page.route(base+'/dashboard/slides/new/sync**',async current=>{
   const body=current.request().postData();if(current.request().method()!=='POST'||!body?.includes('"action":"create"'))return current.continue();
   const input=JSON.parse(body)[0]as Record<string,unknown>;assert.equal(input.action,'create');assert.equal(input.slideId,null);assert.equal(input.versionId,null);assert.match(String(input.idempotencyKey),/^[a-f0-9-]{36}$/);writes.push(input);
   if(!dropped){state.command=input;state.recovery=await page.evaluate(key=>sessionStorage.getItem(key),`veyocast.sync.dynamic.draft.v1:${tenant}:menu:new`)??undefined;save();
    const reply=await current.fetch();assert.equal(reply.status(),200);assert.equal(Number(sql(`select count(*)from public.publisher_command_receipts where tenant_id='${tenant}'and idempotency_key='${input.idempotencyKey}'and command_type='sync.dynamic.authoring'`)),1);dropped=true;return current.abort();}
   assert.deepEqual(input,state.command);return current.continue();
  });
  await page.goto(route,{waitUntil:'domcontentloaded',timeout:120000});
  const editor=page.locator('.sync-studio-frame:visible'),name=editor.getByLabel('Ontwerpnaam',{exact:true}),create=editor.getByRole('button',{name:'Maken en voorbereiden',exact:true});
  await expect(name).toHaveCount(1);
  if(!state.command){await expect(name).toBeEnabled();await expect(create).toBeDisabled();await name.fill(state.name);await editor.getByLabel('Gekoppelde bron',{exact:true}).selectOption(source.sourceId);await expect(editor.getByLabel('Bronregels',{exact:true})).toHaveValue('9');await expect(create).toBeEnabled();
   assert.equal(Number(sql(`select count(*)from public.dynamic_render_jobs where tenant_id='${tenant}'`)),jobsBefore);report.previewReadOnly=true;
   await page.screenshot({path:'execution/evidence/sync-dynamic-create-ready.png'});await create.click();await expect(editor.locator('.notice[role="alert"]')).toContainText('antwoord is verloren');await page.reload({waitUntil:'domcontentloaded',timeout:120000});
  }
  await editor.getByRole('button',{name:'Dezelfde opdracht bevestigen',exact:true}).click();await expect(page).toHaveURL(/\/dashboard\/slides\/[a-f0-9-]{36}$/);
  state.slideId=new URL(page.url()).pathname.split('/').at(-1);assert.match(state.slideId!,/^[a-f0-9-]{36}$/);state.receiptRecovered=true;save();
 }
 assert.match(state.slideId!,/^[a-f0-9-]{36}$/);report.slideId=state.slideId;report.exactCreateReceiptRecovered=true;report.transportWritesThisRun=writes.length;
 const own=JSON.parse(sql(`select jsonb_build_object('slideCount',(select count(*)from public.dynamic_slides where tenant_id='${tenant}'and name='${state.name}'),'snapshotId',s.id,'jobId',j.id,'jobStatus',j.status,'rows',jsonb_array_length(s.snapshot_data_json#>'{menu,products}'),'sourceId',s.data_source_id,'seedRows',jsonb_array_length(s.snapshot_data_json#>'{syncConfiguration,seed,rows}'))from public.dynamic_slide_snapshots s join public.dynamic_render_jobs j on j.tenant_id=s.tenant_id and j.snapshot_id=s.id where s.tenant_id='${tenant}'and s.dynamic_slide_id='${state.slideId}'`));assert.equal(own.slideCount,1);assert.equal(own.rows,9);assert.equal(own.seedRows,0);assert.equal(own.sourceId,source.sourceId);state.snapshotId=own.snapshotId;state.jobId=own.jobId;save();report.canonical=own;
 const pending=JSON.parse(sql("select coalesce(json_agg(id),'[]'::json)from public.dynamic_render_jobs where status in('queued','rendering')"));assert.ok(pending.every((id:string)=>id===state.jobId),'Never claim unrelated queue entries');
 process.env.CHROMIUM_EXECUTABLE_PATH=chromium.executablePath();
 if(own.jobStatus!=='completed'){const rendered=await runDynamicRenderOnce({backend:new SupabaseDynamicRenderBackend(cfg.API_URL,cfg.SERVICE_ROLE_KEY),renderer:new ResvgSharpStudioRenderer(),storageOrigin:cfg.API_URL,config:{workerId:'s226-source-create-proof',lockTimeoutSeconds:60,maxAttempts:3}});assert.equal(rendered.status,'completed');}
 const completed=JSON.parse(sql(`select jsonb_build_object('status',s.status,'assetId',s.output_media_asset_id,'durationMs',s.sync_render_result_json->'durationMs','rows',jsonb_array_length(s.sync_render_result_json#>'{presentation,rows}'),'bytes',v.file_size_bytes,'sha256',v.checksum_sha256,'path',v.storage_path)from public.dynamic_slide_snapshots s join public.media_variants v on v.tenant_id=s.tenant_id and v.asset_id=s.output_media_asset_id and v.variant_type='player_1080p'where s.tenant_id='${tenant}'and s.id='${state.snapshotId}'`));assert.equal(completed.status,'ready');assert.equal(completed.rows,9);assert.equal(completed.durationMs,15000);
 const require=createRequire(process.cwd()+'/apps/control/package.json'),{createServerClient}=require('@supabase/ssr'),cookies=new Map((await context.cookies()).map(cookie=>[cookie.name,cookie]));const client=createServerClient(cfg.API_URL,cfg.ANON_KEY,{cookies:{getAll:()=>[...cookies.values()],setAll:()=>undefined}});
 assert.equal((await client.auth.getUser()).data.user?.id,'19170000-0000-4000-8000-000000000001');assert.equal((await client.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,'aal2');
 const download=await client.storage.from('tenant-media').download(completed.path);assert.equal(download.error,null);const bytes=Buffer.from(await download.data.arrayBuffer());assert.equal(bytes.length,Number(completed.bytes));assert.equal(createHash('sha256').update(bytes).digest('hex'),completed.sha256);delete completed.path;report.completeOutput=completed;
 await page.goto(base+'/dashboard/slides/'+state.slideId,{waitUntil:'domcontentloaded',timeout:120000});await expect(page.getByRole('heading',{name:state.name,exact:true})).toBeVisible();const video=page.locator('video[aria-label^="Volledige offline fallback"]:visible');await expect(video).toHaveCount(1);await expect(video).toBeVisible();await expect.poll(()=>video.evaluate((element:HTMLVideoElement)=>element.readyState)).toBeGreaterThanOrEqual(2);
 const axe=await new AxeBuilder({page}).analyze();assert.deepEqual(axe.violations,[]);report.detailAxeViolations=0;await page.screenshot({path:'execution/evidence/sync-dynamic-create-complete.png'});
 assert.equal(sql(frozenQuery),frozen);report.existingReleasesUnchanged=true;assert.deepEqual(errors,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.error=error instanceof Error?error.message.replace(/([?&]token=)[^\s"<>]+/g,'$1[redacted]').slice(0,1600):'proof failed';await page.screenshot({path:'/tmp/veyocast-s226-source-create-failure.png',fullPage:true}).catch(()=>{});throw Error(String(report.error));}
finally{await browser.close();writeFileSync('execution/evidence/sync-dynamic-create-real.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
