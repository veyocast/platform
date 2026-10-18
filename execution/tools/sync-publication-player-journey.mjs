import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {chromium,expect as playwrightExpect} from '@playwright/test';

assert.equal(process.env.VEYOCAST_S226_LOCAL_ACCEPTANCE,'1');
assert.equal(process.cwd(),'/home/codex/repos/castivo-s226');
const expect=playwrightExpect.configure({timeout:30000});
assert.ok(!process.env.VEYOCAST_S226_JOURNEY_KIND||process.env.VEYOCAST_S226_JOURNEY_KIND==='motion');
const motionJourney=process.env.VEYOCAST_S226_JOURNEY_KIND==='motion',prefix=motionJourney?'sync-motion-to-player':'sync-to-player',expectedPages=motionJourney?1:2;
const tenant='19170000-0000-4000-8000-000000000010',screen=motionJourney?'19170000-0000-4000-8000-000000000020':'19170000-0000-4000-8000-000000000021';
const container='supabase_db_veyocast-s226',base='http://127.0.0.1:3220',playerBase='http://127.0.0.1:3222';
const auth='/tmp/veyocast-s226-qa-auth-state.json',checkpoint=motionJourney?'/tmp/veyocast-s226-motion-publication.json':'/tmp/veyocast-s226-sync-publication.json',profile=motionJourney?'/tmp/veyocast-s226-motion-player-profile':'/tmp/veyocast-s226-sync-player-profile';
for(const path of [auth,'/tmp/veyocast-s226-local-status.json'])assert.equal(statSync(path).mode&0o777,0o600);
const cfg=JSON.parse(readFileSync('/tmp/veyocast-s226-local-status.json','utf8'));assert.equal(cfg.API_URL,'http://127.0.0.1:57621');assert.equal(new URL(cfg.DB_URL).port,'57622');
assert.equal(execFileSync('docker',['inspect','--format','{{.Name}} {{ index .Config.Labels "com.supabase.cli.project" }}',container],{encoding:'utf8'}).trim(),'/supabase_db_veyocast-s226 veyocast-s226');
function sql(query){return execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
const motionProof=motionJourney?JSON.parse(readFileSync('execution/evidence/sync-motion-real-worker.json','utf8')):null;
if(motionProof){assert.equal(motionProof.status,'PASS');assert.equal(motionProof.projectId,'ff08733e-e5b7-4536-a6a0-31378d03af35');}
const proof=motionProof?{projectId:motionProof.projectId,job:{id:motionProof.jobId},media:{id:motionProof.assetId},outputSha256:motionProof.sha256,bytes:motionProof.bytes,documentDurationMs:motionProof.durationMs}:JSON.parse(readFileSync('execution/evidence/sync-studio-real-worker.json','utf8')).results.find(item=>item.outputKind==='mp4');
assert.equal(proof.projectId,motionJourney?'ff08733e-e5b7-4536-a6a0-31378d03af35':'a3753b6d-609b-44af-b70c-b4c90b24a4f9');assert.equal(proof.media.id,motionJourney?'0fe0396d-5071-4c26-a119-d2dcd1011e6d':'c202f2fe-0ee8-4e36-b794-b5c6572313b6');
const originalFile=sql(`select original_file_name from public.media_assets where tenant_id='${tenant}' and id='${proof.media.id}'`);
assert.equal(originalFile,'studio-'+proof.projectId+'.mp4');
const mediaTitle=sql(`select title from public.media_assets where tenant_id='${tenant}' and id='${proof.media.id}'`);
assert.ok(mediaTitle.startsWith(motionJourney?'S226 echte Motion ':'S226 Sync mp4 '));
const state=existsSync(checkpoint)?JSON.parse(readFileSync(checkpoint,'utf8')):{name:(motionJourney?'S226 Motion publicatie ':'S226 Sync publicatie ')+Date.now()};
const save=()=>writeFileSync(checkpoint,JSON.stringify(state),{mode:0o600});
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
if(state.playlistId)assert.match(state.playlistId,uuid);
mkdirSync(profile,{recursive:true,mode:0o700});
const browser=await chromium.launch();
const context=await browser.newContext({storageState:auth,ignoreHTTPSErrors:true,reducedMotion:'reduce',viewport:{width:1440,height:1000}});
await context.addCookies([{name:'veyocast-tenant-context',value:'duindorp-sites-local-qa',url:base,httpOnly:true,sameSite:'Lax'}]);
context.setDefaultTimeout(30000);const page=await context.newPage();let playerContext;
const report={status:'RUNNING',startedAt:new Date().toISOString(),scope:'actual disposable AAL2 Control publication → production-mode browser Player → offline reload',projectId:proof.projectId,renderJobId:proof.job.id,assetId:proof.media.id,sha256:proof.outputSha256,bytes:proof.bytes,screenId:screen};
try{
  if(motionJourney){await page.goto(base+'/dashboard/studio/'+proof.projectId,{waitUntil:'domcontentloaded',timeout:120000});await page.getByRole('button',{name:'Instellingen',exact:true}).click();await expect(page.getByLabel('Motion',{exact:true})).toHaveValue('dynamisch');report.sourceUiMotionVerified=true;}
  if(!state.playlistId){
    await page.goto(base+'/dashboard/playlists',{waitUntil:'domcontentloaded',timeout:120000});
    assert.ok(page.url().startsWith(base+'/dashboard/playlists'),'Existing AAL2 Control session required');
    await page.getByRole('button',{name:'Nieuwe playlist',exact:true}).click();
    const create=page.getByRole('dialog',{name:'Nieuwe playlist',exact:true});
    await create.getByLabel('Playlistnaam').fill(state.name);await create.getByRole('button',{name:'Concept maken',exact:true}).click();
    await expect(page).toHaveURL(/\/dashboard\/playlists\/[a-f0-9-]{36}(?:\?|$)/);
    state.playlistId=new URL(page.url()).pathname.split('/').at(-1);assert.match(state.playlistId,uuid);save();
  }else await page.goto(base+'/dashboard/playlists/'+state.playlistId,{waitUntil:'domcontentloaded',timeout:120000});
  report.playlistId=state.playlistId;
  const itemCount=Number(sql(`select count(*) from public.playlist_items where tenant_id='${tenant}' and playlist_id='${state.playlistId}'`));
  const editor=page.getByRole('dialog',{name:'Playlist bewerken',exact:true});
  if(itemCount===0){
    await editor.getByRole('button',{name:'Eerste inhoud toevoegen',exact:true}).click();
    const picker=page.getByRole('dialog',{name:'Inhoud toevoegen aan playlist',exact:true});
    await picker.getByRole('button',{name:'Media',exact:true}).click();await picker.getByRole('searchbox',{name:'Inhoud zoeken'}).fill(mediaTitle);
    await picker.getByRole('button',{name:mediaTitle+', selecteren',exact:true}).click();
    await picker.getByRole('button',{name:'1 item toevoegen',exact:true}).click();await editor.getByRole('button',{name:'Opslaan',exact:true}).click();
    await expect(editor.getByText('Je concept is bevestigd door de server.').first()).toBeVisible();
  }else assert.equal(itemCount,1);
  assert.equal(sql(`select media_asset_id from public.playlist_items where playlist_id='${state.playlistId}' and tenant_id='${tenant}'`),proof.media.id);
  console.log('Exact complete Source MP4 saved through actual playlist UI');
  let releaseCount=Number(sql(`select count(*) from public.playlist_releases where tenant_id='${tenant}' and playlist_id='${state.playlistId}'`));
  report.reusedExistingRelease=releaseCount>0;
  if(releaseCount===0){
    await editor.getByRole('button',{name:'Schermen kiezen en publiceren',exact:true}).click();
    const targets=page.getByRole('dialog',{name:'Playlist publiceren',exact:true});
    await targets.getByRole('checkbox',{name:motionJourney?/^Clubhuis/:/^Entree/}).check();await targets.getByRole('button',{name:'Publiceren',exact:true}).click();await expect(page).toHaveURL(/\/publish\?/);
    for(let step=0;step<4;step++)await page.locator('.vc-sticky-action-bar').getByRole('button',{name:'Volgende',exact:true}).click();
    const risk=page.getByRole('checkbox',{name:/begrijp|risico|bewust/i});if(await risk.count())await risk.check();
    await page.getByRole('checkbox',{name:/Publiceer de actuele configuratie/}).check();await page.getByRole('button',{name:'Publiceren en schermstatus volgen',exact:true}).click();
    await expect.poll(()=>Number(sql(`select count(*) from public.playlist_releases where tenant_id='${tenant}' and playlist_id='${state.playlistId}'`))).toBe(1);
  }else assert.equal(releaseCount,1);
  report.release=JSON.parse(sql(`select jsonb_build_object('releaseId',r.id,'version',r.version,'assetId',i.media_asset_id,'sha256',i.checksum_sha256,'bytes',i.file_size_bytes,'durationSeconds',i.duration_seconds,'syncDurationMs',i.sync_studio_duration_ms,'sourceRevision',i.sync_studio_presentation_json->>'sourceRevision','rows',jsonb_array_length(i.sync_studio_presentation_json->'rows'),'rowsPerPage',(i.sync_studio_presentation_json->>'rowsPerPage')::int) from public.playlist_releases r join public.playlist_release_items i on i.tenant_id=r.tenant_id and i.release_id=r.id where r.tenant_id='${tenant}' and r.playlist_id='${state.playlistId}'`));
  assert.equal(report.release.assetId,proof.media.id);assert.equal(report.release.sha256,proof.outputSha256);assert.equal(report.release.bytes,proof.bytes);assert.equal(report.release.syncDurationMs,proof.documentDurationMs);assert.equal(report.release.sourceRevision,'8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a');assert.equal(Math.max(1,Math.ceil(report.release.rows/report.release.rowsPerPage)),expectedPages);
  state.releaseId=report.release.releaseId;save();console.log('Immutable Source identity, complete page duration and binary SHA frozen in actual release');
  playerContext=await chromium.launchPersistentContext(profile,{ignoreHTTPSErrors:true,viewport:{width:1920,height:1080}});playerContext.setDefaultTimeout(30000);
  const player=playerContext.pages()[0]??await playerContext.newPage();
  const heartbeat=player.waitForResponse(response=>{if(!response.url().endsWith('/api/player/heartbeat')||response.status()!==200)return false;const body=response.request().postDataJSON();return body?.activeReleaseId===report.release.releaseId&&!!body?.publicationTrace?.firstFrameAt;},{timeout:180000});
  // Keep the listener promise handled if an earlier UI assertion fails.
  heartbeat.catch(()=>{});
  const manifest=player.waitForResponse(response=>response.url().includes('/api/player/manifest')&&[200,304].includes(response.status()),{timeout:180000});manifest.catch(()=>{});
  await player.goto(playerBase,{waitUntil:'domcontentloaded',timeout:120000});
  if(!state.paired){
    const pairing=player.getByLabel('Pairingcode');await expect(pairing).toBeVisible();const code=(await pairing.textContent()).trim();assert.match(code,/^[A-Z2-9]{3} [A-Z2-9]{3}$/);
    await page.goto(base+'/dashboard/screens/new?screen='+screen,{waitUntil:'domcontentloaded',timeout:120000});
    await page.getByLabel('Koppelcode',{exact:true}).fill(code);await page.getByRole('button',{name:'Player veilig koppelen',exact:true}).click();
    await expect(player.getByRole('region',{name:'Release playback'})).toBeVisible({timeout:90000});state.paired=true;save();
  }
  const source=player.locator('.playback-sync[data-sync-ready="true"]').last();await expect(source).toBeVisible({timeout:90000});
  const response=await heartbeat,body=response.request().postDataJSON();assert.equal(body.runtimeState,'PLAYING');report.firstFrame={releaseId:body.activeReleaseId,runtimeState:body.runtimeState,trace:body.publicationTrace,serverStatus:response.status(),observedAfterJourneyStart:Date.parse(body.publicationTrace.firstFrameAt)>=Date.parse(report.startedAt)};
  const token=await player.evaluate(()=>localStorage.getItem('veyocast.player.deviceToken'));assert.ok(token);
  const negotiated=await manifest;assert.equal(negotiated.request().headers()['x-veyocast-sync-renderer'],'sync-v1');
  const mf=negotiated.status()===304?await playerContext.request.get(playerBase+'/api/player/manifest',{headers:{Authorization:'Bearer '+token,'X-VeyoCast-Sync-Renderer':'sync-v1'}}):negotiated;
  assert.equal(mf.status(),200);const envelope=await mf.json();assert.equal(envelope.manifest.syncSystemAssets.length,11);assert.equal(envelope.manifest.items[0].syncStudioDurationMs,proof.documentDurationMs);if(motionJourney)assert.equal(envelope.manifest.items[0].syncStudioPresentation.style.motion,'dynamisch');report.manifest={sourceAssets:envelope.manifest.syncSystemAssets.length,etag:mf.headers().etag,capability:'sync-v1',negotiationStatus:negotiated.status()};
  const legacy=await playerContext.request.get(playerBase+'/api/player/manifest',{headers:{Authorization:'Bearer '+token}});assert.equal(legacy.status(),200);const legacyBody=await legacy.json();assert.equal(legacyBody.manifest.syncSystemAssets,undefined);assert.equal(legacyBody.manifest.items[0].syncStudioPresentation,undefined);assert.equal(legacyBody.manifest.items[0].source.checksumSha256,proof.outputSha256);report.legacyBinaryProfile=true;
  report.onlinePages=[];for(const index of Array.from({length:expectedPages},(_,i)=>i)){await expect.poll(()=>source.getAttribute('data-sync-page')).toBe(String(index));await expect(source).toContainText(motionJourney?'Een werkelijk gerenderde overgang':index===0?'Thuis 1':'Thuis 5');report.onlinePages.push(index);}
  report.readback=JSON.parse(sql(`select jsonb_build_object('activeReleaseId',active_release_id,'desiredReleaseId',desired_release_id,'phase',current_sync_phase,'lastSeenAt',last_seen_at,'lastErrorCode',last_error_code) from public.player_devices where tenant_id='${tenant}' and screen_id='${screen}' and status='paired'`));assert.equal(report.readback.activeReleaseId,report.release.releaseId);assert.equal(report.readback.desiredReleaseId,report.release.releaseId);assert.equal(report.readback.lastErrorCode,null);
  await player.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
  report.cache=await player.evaluate(async()=>{const cache=await caches.open('veyocast-player-assets-v1');return {verifiedAssetCount:(await cache.keys()).length,shellControlled:!!navigator.serviceWorker.controller};});assert.ok(report.cache.verifiedAssetCount>=12);
  await player.screenshot({path:'execution/evidence/'+prefix+'-first-frame.png'});
  await playerContext.setOffline(true);await player.reload({waitUntil:'domcontentloaded',timeout:60000});
  const offlineSource=player.locator('.playback-sync[data-sync-ready="true"]').last();await expect(offlineSource).toBeVisible({timeout:45000});await expect.poll(()=>offlineSource.locator('.sync-slide-animated').evaluate(element=>Number(getComputedStyle(element).opacity))).toBeGreaterThan(0);
  report.offlinePages=[];for(const index of Array.from({length:expectedPages},(_,i)=>i)){await expect.poll(()=>offlineSource.getAttribute('data-sync-page')).toBe(String(index));await expect(offlineSource).toContainText(motionJourney?'Een werkelijk gerenderde overgang':index===0?'Thuis 1':'Thuis 5');report.offlinePages.push(index);}
  assert.equal(await player.evaluate(()=>localStorage.getItem('veyocast.player.deviceToken')),token);report.offlineReload=true;report.pairingPreserved=true;await player.screenshot({path:'execution/evidence/'+prefix+'-offline-reload.png'});report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.message.slice(0,1800);await page.screenshot({path:'/tmp/veyocast-s226-sync-publication-failure.png',fullPage:true}).catch(()=>{});console.log((await page.locator('main').innerText().catch(()=>'' )).slice(0,4500));throw error;
}finally{await playerContext?.close();await browser.close();writeFileSync('execution/evidence/'+prefix+'.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
