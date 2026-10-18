import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,statSync,writeFileSync} from 'node:fs';
import {chromium,expect as baseExpect} from '@playwright/test';

process.umask(0o077);assert.equal(process.env.VEYOCAST_S226_LOCAL_ACCEPTANCE,'1');assert.equal(process.cwd(),'/home/codex/repos/castivo-s226');
const base='http://127.0.0.1:3220',tenant='19170000-0000-4000-8000-000000000010',container='supabase_db_veyocast-s226',checkpoint='/tmp/veyocast-s226-rss-copy-state.json',auth='/tmp/veyocast-s226-qa-auth-state.json';
for(const path of[checkpoint,auth])assert.equal(statSync(path).mode&0o777,0o600);
assert.equal(execFileSync('docker',['inspect','--format','{{index .Config.Labels "com.supabase.cli.project"}}',container],{encoding:'utf8'}).trim(),'veyocast-s226');
const state=JSON.parse(readFileSync(checkpoint,'utf8'));for(const id of[state.projectId,state.sourceId,state.slideId,state.snapshotId,state.jobId])assert.match(id,/^[a-f0-9-]{36}$/);assert.ok(state.command&&state.recovery&&state.receiptRecovered);
const sql=query=>execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const history=`select jsonb_build_object('slides',(select count(*)from public.dynamic_slides where tenant_id='${tenant}'),'versions',(select count(*)from public.dynamic_slide_versions where tenant_id='${tenant}'),'snapshots',(select count(*)from public.dynamic_slide_snapshots where tenant_id='${tenant}'),'jobs',(select count(*)from public.dynamic_render_jobs where tenant_id='${tenant}'),'original',(select md5(document_json::text)from public.studio_project_drafts where tenant_id='${tenant}'and project_id='${state.projectId}'),'releases',(select md5(coalesce(string_agg(row_to_json(r)::text,','order by id),''))from public.playlist_releases r where tenant_id='${tenant}'))`;
const before=sql(history),browser=await chromium.launch(),context=await browser.newContext({storageState:auth,ignoreHTTPSErrors:true,reducedMotion:'reduce',viewport:{width:1440,height:1000}}),expect=baseExpect.configure({timeout:30000});
await context.addCookies([{name:'veyocast-tenant-context',value:'duindorp-sites-local-qa',url:base,httpOnly:true,sameSite:'Lax'}]);
await context.addInitScript(({key,value})=>sessionStorage.setItem(key,value),{key:`veyocast.sync.dynamic.draft.v1:${tenant}:${state.projectId}:new`,value:state.recovery});
const page=await context.newPage(),errors=[];let phase='manual origin',dropped=false,calls=0;
page.on('pageerror',error=>errors.push({phase,url:page.url(),message:error.message.slice(0,600),stack:error.stack?.slice(0,1200)}));
const report={status:'RUNNING',startedAt:new Date().toISOString(),controlBuildId:readFileSync('apps/control/.next/BUILD_ID','utf8').trim(),scope:'actual manual-to-bound RSS navigation and twice-replayed already committed create, first reply deliberately lost; exact same command/entity/artifact, no new history or original-document change; no external feed or hosted deployment claim'};
try{
 await page.route(base+'/dashboard/slides/new/sync**',async current=>{
  const text=current.request().postData();if(current.request().method()!=='POST'||!text?.includes('"action":"create"'))return current.continue();
  assert.deepEqual(JSON.parse(text)[0],state.command);calls++;
  if(!dropped){const response=await current.fetch();assert.equal(response.status(),200);dropped=true;return current.abort();}
  return current.continue();
 });
 await page.goto(base+'/dashboard/studio/'+state.projectId,{waitUntil:'domcontentloaded',timeout:120000});const manual=page.locator('.sync-studio-frame:visible');await expect(manual).toBeVisible();await manual.getByRole('button',{name:'Gegevensbron',exact:true}).click();await manual.getByRole('button',{name:'Gekoppelde bron',exact:true}).click();phase='copy navigation';await manual.getByRole('link',{name:'Gekoppelde kopie maken',exact:true}).click();await expect(page).toHaveURL(base+'/dashboard/slides/new/sync?project='+state.projectId);
 const editor=page.locator('.sync-studio-frame:visible');phase='first exact receipt';await editor.getByRole('button',{name:'Dezelfde opdracht bevestigen',exact:true}).click();await expect(editor.locator('.notice[role="alert"]')).toContainText('antwoord is verloren');
 phase='SSR reload';await page.reload({waitUntil:'domcontentloaded',timeout:120000});await expect(editor.getByRole('button',{name:'Dezelfde opdracht bevestigen',exact:true})).toBeVisible();phase='second exact receipt and destination';await editor.getByRole('button',{name:'Dezelfde opdracht bevestigen',exact:true}).click();await expect(page).toHaveURL(base+'/dashboard/slides/'+state.slideId);
 await expect(page.getByRole('heading',{name:state.name,exact:true})).toBeVisible();assert.equal(calls,2);assert.deepEqual(errors,[]);assert.equal(sql(history),before);report.exactReplays=2;report.noNewEntityVersionSnapshotJobOrRelease=true;report.manualDocumentUnchanged=true;report.browserErrors=errors;report.status='PASS';
}catch(error){report.status='FAIL';report.error=(error.message??'Replay failed').replace(/([?&]token=)[^\s"<>]+/g,'$1[redacted]').slice(0,1600);report.browserErrors=errors;await page.screenshot({path:'/tmp/veyocast-s226-rss-recovery-replay-failure.png',fullPage:true}).catch(()=>{});throw Error(report.error);}
finally{await browser.close();writeFileSync('execution/evidence/sync-rss-recovery-replay.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
