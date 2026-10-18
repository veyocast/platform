import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {chromium,expect as playwrightExpect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {SupabaseStudioRenderBackend} from '../../apps/media-worker/src/studio-render-backend';
import {ResvgSharpStudioRenderer} from '../../apps/media-worker/src/studio-render-resvg';
import {runStudioRenderOnce} from '../../apps/media-worker/src/studio-render-runner';

assert.equal(process.env.VEYOCAST_S226_LOCAL_ACCEPTANCE,'1');assert.equal(process.cwd(),'/home/codex/repos/castivo-s226');
const auth='/tmp/veyocast-s226-qa-auth-state.json',config='/tmp/veyocast-s226-local-status.json',checkpoint='/tmp/veyocast-s226-library-playlist-state.json';
for(const path of[auth,config])assert.equal(statSync(path).mode&0o777,0o600);
const cfg=JSON.parse(readFileSync(config,'utf8'));assert.equal(cfg.API_URL,'http://127.0.0.1:57621');assert.equal(new URL(cfg.DB_URL).port,'57622');
const container='supabase_db_veyocast-s226',tenant='19170000-0000-4000-8000-000000000010',project='a3753b6d-609b-44af-b70c-b4c90b24a4f9',asset='c202f2fe-0ee8-4e36-b794-b5c6572313b6',base='http://127.0.0.1:3220';
assert.equal(execFileSync('docker',['inspect','--format','{{.Name}} {{ index .Config.Labels "com.supabase.cli.project" }}',container],{encoding:'utf8'}).trim(),'/'+container+' veyocast-s226');
const sql=(query:string)=>execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const original=sql(`select document_json::text from public.studio_project_drafts where tenant_id='${tenant}' and project_id='${project}'`),originalDoc=JSON.parse(original);
assert.equal(originalDoc.motion.durationMs,6000);assert.equal(originalDoc.syncPresentation.rows.length,5);assert.equal(originalDoc.syncPresentation.theme,'fieldflow');
const projectName=sql(`select name from public.studio_projects where tenant_id='${tenant}' and id='${project}'`);assert.ok(projectName.startsWith('S226 Sync mp4 '));
const releases=sql(`select coalesce(jsonb_agg(jsonb_build_object('id',id,'hash',manifest_hash) order by id),'[]') from public.playlist_releases where tenant_id='${tenant}'`);
const jobsBefore=Number(sql('select count(*) from public.studio_render_jobs'));
const pending=()=>JSON.parse(sql("select coalesce(jsonb_agg(jsonb_build_object('id',id,'project',project_id)),'[]') from public.studio_render_jobs where status not in ('completed','failed','cancelled')")) as Array<{id:string;project:string}>;
assert.deepEqual(pending(),[],'An unrelated pending render must not be claimed');
type State={name:string;playlistId?:string;themeStarted?:boolean;themedAsset?:string};
const state:State=existsSync(checkpoint)?JSON.parse(readFileSync(checkpoint,'utf8')):{name:'S226 Slides-kiezer '+Date.now()};assert.match(state.name,/^S226 Slides-kiezer \d+$/);
const save=()=>writeFileSync(checkpoint,JSON.stringify(state),{mode:0o600});save();
const expect=playwrightExpect.configure({timeout:30000}),browser=await chromium.launch(),context=await browser.newContext({storageState:auth,ignoreHTTPSErrors:true,reducedMotion:'reduce',viewport:{width:1440,height:1050}});
await context.addCookies([{name:'veyocast-tenant-context',value:'duindorp-sites-local-qa',url:base,httpOnly:true,sameSite:'Lax'}]);context.setDefaultTimeout(30000);
const page=await context.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
const report:Record<string,unknown>={status:'RUNNING',startedAt:new Date().toISOString(),scope:'actual disposable AAL2 Slides chooser → immutable export placement/reload → separate theme/duration render → authenticated private bytes; no publication or provider claim',sourceProjectId:project,sourceAssetId:asset};
try{
 if(!state.playlistId){
  await page.goto(base+'/dashboard/playlists',{waitUntil:'domcontentloaded',timeout:120000});assert.ok(page.url().startsWith(base+'/dashboard/playlists'));
  await page.getByRole('button',{name:'Nieuwe playlist',exact:true}).click();const create=page.getByRole('dialog',{name:'Nieuwe playlist',exact:true});await create.getByLabel('Playlistnaam').fill(state.name);await create.getByRole('button',{name:'Concept maken',exact:true}).click();await expect(page).toHaveURL(/\/dashboard\/playlists\/[a-f0-9-]{36}(?:\?|$)/);state.playlistId=new URL(page.url()).pathname.split('/').at(-1)!;save();
 }else await page.goto(base+'/dashboard/playlists/'+state.playlistId,{waitUntil:'domcontentloaded',timeout:120000});
 assert.match(state.playlistId!,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);report.playlistId=state.playlistId;
 const editor=page.getByRole('dialog',{name:'Playlist bewerken',exact:true});
 const item=()=>JSON.parse(sql(`select coalesce(jsonb_agg(jsonb_build_object('id',id,'asset',media_asset_id,'duration',duration_seconds)),'[]') from public.playlist_items where tenant_id='${tenant}' and playlist_id='${state.playlistId}'`)) as Array<{id:string;asset:string;duration:number}>;
 if(!item().length){
  await editor.getByRole('button',{name:'Eerste inhoud toevoegen',exact:true}).click();const picker=page.getByRole('dialog',{name:'Inhoud toevoegen aan playlist',exact:true});await picker.getByRole('button',{name:'Slides',exact:true}).click();await picker.getByRole('searchbox',{name:'Inhoud zoeken'}).fill(projectName);
  await picker.getByRole('button',{name:projectName+', 1 items, selecteren',exact:true}).click();assert.equal(Number(sql('select count(*) from public.studio_render_jobs')),jobsBefore,'Read and selection must not queue a render');
  const axe=await new AxeBuilder({page}).include('[aria-label="Inhoud toevoegen aan playlist"]').analyze();assert.deepEqual(axe.violations,[]);report.pickerAxeViolations=0;
  await picker.getByRole('button',{name:'1 item toevoegen',exact:true}).click();await editor.getByRole('button',{name:'Opslaan',exact:true}).click();await expect(editor.getByText('Je concept is bevestigd door de server.').first()).toBeVisible();
 }
 assert.equal(item().length,1);
 if(item()[0]!.asset===asset){
  assert.equal(item()[0]!.duration,6);assert.equal(Number(sql('select count(*) from public.studio_render_jobs')),jobsBefore);
  await page.reload({waitUntil:'domcontentloaded'});await editor.getByRole('button',{name:projectName+', 6 seconden, instellingen openen',exact:true}).click();await expect(editor.getByRole('spinbutton',{name:'Seconden per pagina',exact:true})).toHaveValue('3');await expect(editor.getByText('2 pagina’s × 3s = 6 seconden in je playlist.',{exact:true}).filter({visible:true})).toBeVisible();report.frozenPagesReopened=true;
  assert.ok(!state.themeStarted,'Inspect an interrupted theme save before submitting a new command');state.themeStarted=true;save();
  await editor.getByRole('button',{name:'OnzeTrots TV',exact:true}).click();await editor.getByRole('spinbutton',{name:'Seconden per pagina',exact:true}).fill('4');await editor.getByRole('button',{name:'Opslaan',exact:true}).click();
  await expect.poll(()=>pending().length).toBe(1);const queued=pending();assert.equal(queued.length,1);assert.notEqual(queued[0]!.project,project);
  const fork=JSON.parse(sql(`select document_json::text from public.studio_project_drafts where tenant_id='${tenant}' and project_id='${queued[0]!.project}'`));assert.deepEqual(fork.syncPresentation,{...originalDoc.syncPresentation,theme:'onzetrots-tv'});assert.equal(fork.motion.durationMs,8000);
  process.env.CHROMIUM_EXECUTABLE_PATH=chromium.executablePath();const rendered=await runStudioRenderOnce({backend:new SupabaseStudioRenderBackend(cfg.API_URL,cfg.SERVICE_ROLE_KEY),renderer:new ResvgSharpStudioRenderer(),config:{workerId:'s226-source-library-proof',lockTimeoutSeconds:900,maxAttempts:3}});assert.equal(rendered.status,'completed');assert.equal(rendered.jobId,queued[0]!.id);
  await expect(editor.getByText('Je concept is bevestigd door de server.').first()).toBeVisible({timeout:180000});state.themedAsset=item()[0]!.asset;save();report.actualRender={jobId:queued[0]!.id,projectId:queued[0]!.project,assetId:state.themedAsset};
 }
 assert.ok(state.themedAsset);assert.equal(item()[0]!.asset,state.themedAsset);assert.equal(item()[0]!.duration,8);
 await page.reload({waitUntil:'domcontentloaded'});await editor.getByRole('button',{name:projectName+', 8 seconden, instellingen openen',exact:true}).click();await expect(editor.getByRole('spinbutton',{name:'Seconden per pagina',exact:true})).toHaveValue('4');await expect(editor.getByRole('button',{name:'OnzeTrots TV',exact:true})).toHaveAttribute('aria-pressed','true');await expect(editor.getByText('2 pagina’s × 4s = 8 seconden in je playlist.',{exact:true}).filter({visible:true})).toBeVisible();
 const require=createRequire(process.cwd()+'/apps/control/package.json'),{createServerClient}=require('@supabase/ssr'),snapshot=await context.storageState(),client=createServerClient(cfg.API_URL,cfg.ANON_KEY,{cookies:{getAll:()=>snapshot.cookies,setAll:()=>{}}});assert.equal((await client.auth.getUser()).data.user?.id,'19170000-0000-4000-8000-000000000001');assert.equal((await client.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,'aal2');
 const variant=await client.from('media_variants').select('storage_path,file_size_bytes,checksum_sha256,duration_seconds').eq('tenant_id',tenant).eq('asset_id',state.themedAsset).eq('variant_type','player_1080p').single();assert.equal(variant.error,null);assert.equal(Number(variant.data.duration_seconds),8);
 const download=await client.storage.from('tenant-media').download(variant.data.storage_path);assert.equal(download.error,null);const bytes=Buffer.from(await download.data.arrayBuffer());assert.equal(bytes.length,Number(variant.data.file_size_bytes));assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.data.checksum_sha256);
 report.media={bytes:bytes.length,sha256:variant.data.checksum_sha256,durationSeconds:8};report.themedPagesReopened=true;report.privateBytesVerified=true;report.widths=[];
 for(const width of[320,390,768,1024,1440]){await page.setViewportSize({width,height:1050});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert.ok(overflow<=1);(report.widths as unknown[]).push({width,overflow});}
 await page.screenshot({path:'execution/evidence/sync-library-playlist-real-services.png',fullPage:true});assert.deepEqual(errors,[]);assert.equal(sql(`select document_json::text from public.studio_project_drafts where tenant_id='${tenant}' and project_id='${project}'`),original);assert.equal(sql(`select coalesce(jsonb_agg(jsonb_build_object('id',id,'hash',manifest_hash) order by id),'[]') from public.playlist_releases where tenant_id='${tenant}'`),releases);report.originalDraftUnchanged=true;report.existingReleasesUnchanged=true;report.status='PASS';
}catch(error){report.status='FAIL';report.error=error instanceof Error?error.message:String(error);await page.screenshot({path:'/tmp/veyocast-s226-library-playlist-failure.png',fullPage:true}).catch(()=>{});throw error;
}finally{await context.storageState({path:auth});await browser.close();writeFileSync('execution/evidence/sync-library-playlist-real-services.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
