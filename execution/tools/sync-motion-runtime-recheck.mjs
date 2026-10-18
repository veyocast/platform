import assert from 'node:assert/strict';
import {readFileSync,statSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium,expect as playwrightExpect} from '@playwright/test';

assert.equal(process.env.VEYOCAST_S226_LOCAL_ACCEPTANCE,'1');assert.equal(process.cwd(),'/home/codex/repos/castivo-s226');
const proof=JSON.parse(readFileSync('execution/evidence/sync-motion-to-player.json','utf8'));assert.equal(proof.status,'PASS');assert.equal(proof.release.syncDurationMs,3000);assert.equal(proof.release.durationSeconds,5);assert.match(proof.release.releaseId,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
const profile='/tmp/veyocast-s226-motion-player-profile';assert.equal(statSync(profile).mode&0o777,0o700);
assert.equal(execFileSync('docker',['inspect','--format','{{.Name}} {{ index .Config.Labels "com.supabase.cli.project" }}','supabase_db_veyocast-s226'],{encoding:'utf8'}).trim(),'/supabase_db_veyocast-s226 veyocast-s226');
const releaseHash=()=>execFileSync('docker',['exec','supabase_db_veyocast-s226','psql','-U','postgres','-d','postgres','-At','-c',`select manifest_hash from public.playlist_releases where tenant_id='19170000-0000-4000-8000-000000000010' and id='${proof.release.releaseId}'`],{encoding:'utf8'}).trim();const beforeHash=releaseHash();
const expect=playwrightExpect.configure({timeout:15000}),context=await chromium.launchPersistentContext(profile,{ignoreHTTPSErrors:true,viewport:{width:1920,height:1080}}),page=context.pages()[0]??await context.newPage();
const report={status:'RUNNING',startedAt:new Date().toISOString(),scope:'same already paired browser profile and immutable animated release; current production build, actual three-second DOM video boundaries and offline cold reload; original publication/first-frame proof is separate',originalPublicationProof:'execution/evidence/sync-motion-to-player.json',releaseId:proof.release.releaseId,playerBuildId:readFileSync('apps/player/.next/BUILD_ID','utf8').trim()};
await context.addInitScript(()=>{
  globalThis.sourceLoopFrames=[];let last;
  const inspect=()=>{
    const node=[...document.querySelectorAll('.playback-sync')].at(-1),frame=node?.querySelector('.sync-slide-animated'),scene=node?.closest('[data-player-handoff]');
    if(node&&node!==last&&node.getAttribute('data-sync-ready')==='true'&&scene?.getAttribute('data-player-handoff')==='first-frame-ready'&&frame&&Number(getComputedStyle(frame).opacity)>0&&frame.getBoundingClientRect().width>0){last=node;globalThis.sourceLoopFrames.push(performance.now());}
    requestAnimationFrame(inspect);
  };requestAnimationFrame(inspect);
});
try{
  await page.goto('http://127.0.0.1:3222',{waitUntil:'domcontentloaded',timeout:60000});
  const token=await page.evaluate(()=>localStorage.getItem('veyocast.player.deviceToken'));assert.ok(token);
  const response=await context.request.get('http://127.0.0.1:3222/api/player/manifest',{headers:{Authorization:'Bearer '+token,'X-VeyoCast-Sync-Renderer':'sync-v1'}});assert.equal(response.status(),200);const envelope=await response.json();assert.equal(envelope.manifest.releaseId,proof.release.releaseId);assert.equal(envelope.manifest.items[0].syncStudioPresentation.style.motion,'dynamisch');assert.equal(envelope.manifest.items[0].syncStudioDurationMs,3000);assert.equal(envelope.manifest.items[0].source.checksumSha256,proof.sha256);
  await expect.poll(()=>page.evaluate(()=>globalThis.sourceLoopFrames.length),{timeout:15000}).toBeGreaterThanOrEqual(3);
  report.onlineLoopIntervals=await page.evaluate(()=>globalThis.sourceLoopFrames.slice(1,3).map((time,index)=>time-globalThis.sourceLoopFrames[index]));
  for(const interval of report.onlineLoopIntervals){assert.ok(interval>=2800);assert.ok(interval<4500,'A three-second Source video must not inherit the five-second media placement minimum');}
  report.animation=await page.locator('.sync-slide-animated').last().evaluate(element=>({name:getComputedStyle(element).animationName,duration:getComputedStyle(element).animationDuration}));assert.equal(report.animation.name,'veyocast-sync-slide-enter');assert.equal(report.animation.duration,'0.4s');
  report.loadedScriptDigest=createHash('sha256').update(await page.evaluate(()=>[...document.scripts].flatMap(script=>script.src?[new URL(script.src).pathname]:[]).sort().join('\n'))).digest('hex');
  await page.screenshot({path:'execution/evidence/sync-motion-runtime-online.png'});
  await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  await expect.poll(()=>page.evaluate(()=>globalThis.sourceLoopFrames.length),{timeout:12000}).toBeGreaterThanOrEqual(2);
  report.offlineLoopIntervals=await page.evaluate(()=>globalThis.sourceLoopFrames.slice(1,2).map((time,index)=>time-globalThis.sourceLoopFrames[index]));for(const interval of report.offlineLoopIntervals){assert.ok(interval>=2800);assert.ok(interval<4500);}
  assert.equal(await page.evaluate(()=>localStorage.getItem('veyocast.player.deviceToken')),token);
  await expect(page.locator('.playback-sync').last()).toContainText('Een werkelijk gerenderde overgang');
  report.verifiedAssetCount=await page.evaluate(async()=>(await (await caches.open('veyocast-player-assets-v1')).keys()).length);assert.ok(report.verifiedAssetCount>=12);
  await page.screenshot({path:'execution/evidence/sync-motion-runtime-offline.png'});assert.equal(releaseHash(),beforeHash);report.offlineColdReload=true;report.pairingPreserved=true;report.immutableReleaseUnchanged=true;report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.message.slice(0,1800);await page.screenshot({path:'/tmp/veyocast-s226-motion-runtime-recheck-failure.png'}).catch(()=>{});throw error;
}finally{await context.close();writeFileSync('execution/evidence/sync-motion-runtime-recheck.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
