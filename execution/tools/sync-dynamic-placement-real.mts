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
const authFile='/tmp/veyocast-s226-qa-auth-state.json',configFile='/tmp/veyocast-s226-local-status.json',checkpoint='/tmp/veyocast-s226-dynamic-placement-final-state.json';
for(const file of[authFile,configFile])assert.equal(statSync(file).mode&0o777,0o600);
const cfg=JSON.parse(readFileSync(configFile,'utf8'));assert.equal(cfg.API_URL,'http://127.0.0.1:57621');assert.equal(new URL(cfg.DB_URL).port,'57622');
assert.equal(execFileSync('docker',['inspect','--format','{{index .Config.Labels "com.supabase.cli.project"}}',container],{encoding:'utf8'}).trim(),'veyocast-s226');
function sql(query:string){return execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
const library=JSON.parse(readFileSync('execution/evidence/sync-dynamic-library-real.json','utf8'));assert.equal(library.status,'PASS');
for(const id of[library.playlistId,library.sourceSlideId,library.readback.id,library.readback.snapshotId])assert.match(id,/^[a-f0-9-]{36}$/);
if(existsSync(checkpoint))assert.equal(statSync(checkpoint).mode&0o777,0o600);
type Command={snapshotId:string;theme:string;secondsPerPage:number;idempotencyKey:string};
type State={command?:Command;snapshotId?:string;jobId?:string;receiptRecovered?:boolean;recoveryRoute?:string;mainBefore?:string;releasesBefore?:string;jobsBefore?:number;restored?:boolean};
const state:State=existsSync(checkpoint)?JSON.parse(readFileSync(checkpoint,'utf8')):{};
const save=()=>writeFileSync(checkpoint,JSON.stringify(state),{mode:0o600});
const mainQuery=`select row_to_json(source)::text from public.dynamic_slides source where tenant_id='${tenant}'and id='${library.sourceSlideId}'`;
const releasesQuery=`select md5(coalesce(string_agg(row_to_json(release)::text,','order by id),''))from public.playlist_releases release where tenant_id='${tenant}'`;
state.mainBefore??=sql(mainQuery);state.releasesBefore??=sql(releasesQuery);state.jobsBefore??=Number(sql(`select count(*)from public.dynamic_render_jobs where tenant_id='${tenant}'`));save();
const expect=baseExpect.configure({timeout:30000}),browser=await chromium.launch(),context=await browser.newContext({storageState:authFile,ignoreHTTPSErrors:true,reducedMotion:'reduce',viewport:{width:1440,height:1000}});
await context.addCookies([{name:'veyocast-tenant-context',value:'duindorp-sites-local-qa',url:base,httpOnly:true,sameSite:'Lax'}]);const page=await context.newPage();
const report:Record<string,unknown>={status:'RUNNING',startedAt:new Date().toISOString(),controlBuildId:readFileSync('apps/control/.next/BUILD_ID','utf8').trim(),scope:'actual AAL2 pinned Source theme/duration choice, receipt recovery, one complete existing-worker variant, private SHA and reload; no publication, provider, hardware or hosted deployment claim',playlistId:library.playlistId,sourceSlideId:library.sourceSlideId};
try{
 await page.goto(base+'/dashboard/playlists/'+library.playlistId,{waitUntil:'domcontentloaded',timeout:120000});const editor=page.getByRole('dialog',{name:'Playlist bewerken',exact:true});await expect(editor).toBeVisible();await context.storageState({path:authFile});
 const require=createRequire(process.cwd()+'/apps/control/package.json'),{createServerClient}=require('@supabase/ssr'),cookies=new Map((await context.cookies()).map(cookie=>[cookie.name,cookie]));
 const client=createServerClient(cfg.API_URL,cfg.ANON_KEY,{cookies:{getAll:()=>[...cookies.values()],setAll:()=>undefined}});
 assert.equal((await client.auth.getUser()).data.user?.id,'19170000-0000-4000-8000-000000000001');assert.equal((await client.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,'aal2');
 if(state.command&&!state.receiptRecovered){const v=state.command,reply=await client.rpc('prepare_sync_dynamic_variant_v1',{p_tenant_id:tenant,p_base_snapshot_id:v.snapshotId,p_theme:v.theme,p_seconds_per_page:v.secondsPerPage,p_idempotency_key:v.idempotencyKey});assert.equal(reply.error,null);assert.equal(reply.data.snapshotId,state.snapshotId);state.receiptRecovered=true;state.recoveryRoute='actual AAL2 exact receipt after harness restart';save();}
 if(!state.restored&&!state.jobId){
  const original=JSON.parse(sql(`select jsonb_build_object('snapshotId',dynamic_snapshot_id,'duration',duration_seconds)from public.playlist_items where id='${library.readback.id}'`));
  if(original.snapshotId!==library.readback.snapshotId){
   const prior=JSON.parse(readFileSync('/tmp/veyocast-s226-dynamic-placement-state.json','utf8'));assert.equal(original.snapshotId,prior.snapshotId);assert.equal(original.duration,15);
   await editor.getByRole('button',{name:/15 seconden, instellingen openen$/}).click();await editor.getByRole('region',{name:'Playlistinhoud',exact:true}).getByRole('button',{name:'Nieuwste Studio-versie',exact:true}).click();
   await editor.getByRole('button',{name:'Opslaan',exact:true}).click();await expect(editor.locator('p[role="status"]').filter({hasText:'Je concept is bevestigd door de server.'})).toBeVisible();
   assert.equal(sql(`select dynamic_snapshot_id from public.playlist_items where id='${library.readback.id}'`),library.readback.snapshotId);
   await page.reload({waitUntil:'domcontentloaded',timeout:120000});await expect(editor).toBeVisible();
   report.ownedDraftRecovery='Existing latest-draft follower incorrectly adopted the first 21s variant before its authoring CAS. After the Source-only fence, the actual UI restored the original reviewed Source snapshot before this new 24s choice.';
  }
  state.restored=true;save();
 }
 await page.route(base+'/dashboard/playlists/'+library.playlistId+'**',async current=>{
  const body=current.request().postData();if(current.request().method()!=='POST'||!body?.includes('"secondsPerPage":8')||!body.includes('"theme":"onzetrots-tv"'))return current.continue();
  const input=JSON.parse(body)[0]as Command;assert.equal(input.snapshotId,library.readback.snapshotId);assert.match(input.idempotencyKey,/^[a-f0-9-]{36}$/);
  if(!state.command){state.command=input;save();const response=await current.fetch();assert.equal(response.status(),200);
   const receipt=JSON.parse(sql(`select outcome_json from public.publisher_command_receipts where tenant_id='${tenant}'and command_type='sync.dynamic.variant'and idempotency_key='${input.idempotencyKey}'`));
   state.snapshotId=receipt.snapshotId;state.jobId=receipt.jobId;save();return current.abort();
  }
  if(!state.receiptRecovered){assert.deepEqual(input,state.command);state.receiptRecovered=true;state.recoveryRoute='actual browser retries the same prepare command';save();}
  return current.continue();
 });
 const saved=JSON.parse(sql(`select jsonb_build_object('snapshotId',dynamic_snapshot_id,'duration',duration_seconds)from public.playlist_items where tenant_id='${tenant}'and id='${library.readback.id}'`));
 if(saved.snapshotId!==state.snapshotId||!state.snapshotId){
  assert.equal(saved.snapshotId,library.readback.snapshotId);
  await editor.getByRole('button',{name:/15 seconden, instellingen openen$/}).click();
  const settings=editor.getByRole('region',{name:'Playlistinhoud',exact:true});await settings.getByLabel('Seconden per pagina',{exact:true}).fill('8');await settings.getByRole('button',{name:/OnzeTrots TV/}).click();
  assert.equal(sql(mainQuery),state.mainBefore);assert.equal(Number(sql(`select count(*)from public.dynamic_render_jobs where tenant_id='${tenant}'`)),state.jobsBefore!+(state.jobId?1:0));
  const button=editor.getByRole('button',{name:'Opslaan',exact:true});await button.click();
  if(!state.receiptRecovered){await expect.poll(()=>Boolean(state.snapshotId)).toBe(true);await expect(button).toBeEnabled();await button.click();}
  await expect.poll(()=>Boolean(state.jobId&&state.receiptRecovered)).toBe(true);
  assert.match(state.jobId!,/^[a-f0-9-]{36}$/);assert.match(state.snapshotId!,/^[a-f0-9-]{36}$/);
  const pending=JSON.parse(sql("select coalesce(json_agg(id),'[]'::json)from public.dynamic_render_jobs where status in('queued','rendering')"));assert.ok(pending.every((id:string)=>id===state.jobId),'Never claim unrelated queue entries');
  const jobStatus=sql(`select status from public.dynamic_render_jobs where id='${state.jobId}'`);
  process.env.CHROMIUM_EXECUTABLE_PATH=chromium.executablePath();
  if(jobStatus!=='completed'){const result=await runDynamicRenderOnce({backend:new SupabaseDynamicRenderBackend(cfg.API_URL,cfg.SERVICE_ROLE_KEY),renderer:new ResvgSharpStudioRenderer(),storageOrigin:cfg.API_URL,config:{workerId:'s226-source-placement-proof',lockTimeoutSeconds:60,maxAttempts:3}});assert.equal(result.status,'completed');}
  await expect(editor.locator('p[role="status"]').filter({hasText:'Je concept is bevestigd door de server.'})).toBeVisible({timeout:60000});
 }
 const output=JSON.parse(sql(`select jsonb_build_object('snapshotId',s.id,'versionId',s.dynamic_slide_version_id,'assetId',s.output_media_asset_id,'theme',s.sync_render_result_json#>>'{presentation,theme}','secondsPerPage',s.snapshot_data_json#>>'{syncConfiguration,secondsPerPage}','durationMs',s.sync_render_result_json->'durationMs','rows',jsonb_array_length(s.sync_render_result_json#>'{presentation,rows}'),'bytes',v.file_size_bytes,'sha256',v.checksum_sha256,'path',v.storage_path)from public.dynamic_slide_snapshots s join public.media_variants v on v.tenant_id=s.tenant_id and v.asset_id=s.output_media_asset_id and v.variant_type='player_1080p'where s.tenant_id='${tenant}'and s.id='${state.snapshotId}'`));
 assert.equal(output.theme,'onzetrots-tv');assert.equal(output.secondsPerPage,'8');assert.equal(output.durationMs,24000);assert.equal(output.rows,9);assert.notEqual(output.assetId,library.readback.assetId);
 const download=await client.storage.from('tenant-media').download(output.path);assert.equal(download.error,null);const bytes=Buffer.from(await download.data.arrayBuffer());assert.equal(bytes.length,Number(output.bytes));assert.equal(createHash('sha256').update(bytes).digest('hex'),output.sha256);delete output.path;report.completeOutput=output;
 await page.reload({waitUntil:'domcontentloaded',timeout:120000});await expect(editor).toBeVisible();await editor.getByRole('button',{name:'Voorbeeld',exact:true}).click();
 await expect(editor.locator('.vc-slide-preview').first()).toHaveClass(/is-trots/);await expect(editor.locator('.vc-slide-preview').first()).toBeVisible();assert.ok((await editor.locator('.vc-slide-preview').first().boundingBox())!.height>150);await expect(editor.locator('.vc-slide-preview').first()).toContainText('Bronproduct 1');
 const readback=JSON.parse(sql(`select jsonb_build_object('snapshotId',dynamic_snapshot_id,'sourceId',dynamic_slide_id,'mediaAssetId',media_asset_id,'duration',duration_seconds,'sites',sites_configuration_json)from public.playlist_items where tenant_id='${tenant}'and id='${library.readback.id}'`));
 assert.equal(readback.snapshotId,state.snapshotId);assert.equal(readback.sourceId,library.sourceSlideId);assert.equal(readback.mediaAssetId,output.assetId);assert.equal(readback.duration,24);assert.equal(readback.sites,null);report.readback=readback;
 assert.equal(Number(sql(`select count(*)from public.dynamic_render_jobs where tenant_id='${tenant}'`)),state.jobsBefore!+1);assert.equal(sql(mainQuery),state.mainBefore);assert.equal(sql(releasesQuery),state.releasesBefore);
 const axe=await new AxeBuilder({page}).include('[aria-label="Playlist bewerken"]').analyze();assert.deepEqual(axe.violations,[]);report.editorAxeViolations=0;report.widths=[];
 for(const width of[390,768,1024,1440,1920]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);(report.widths as number[]).push(width);}
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'execution/evidence/sync-dynamic-placement-real.png'});
 report.receiptRecovery=state.recoveryRoute;report.oneExistingQueueJob=true;report.recoveredStages=['sync-dynamic-placement-attempt-1.json','sync-dynamic-placement-attempt-2.json','sync-dynamic-placement-attempt-3.json'];report.mainSourceAndReleasesUnchanged=true;report.status='PASS';
}catch(error){report.status='FAIL';report.error=error instanceof Error?error.message.replace(/([?&]token=)[^\s"<>]+/g,'$1[redacted]').slice(0,1600):'proof failed';await page.screenshot({path:'/tmp/veyocast-s226-source-placement-failure.png',fullPage:true}).catch(()=>{});throw Error(String(report.error));}
finally{await browser.close();writeFileSync('execution/evidence/sync-dynamic-placement-real.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
