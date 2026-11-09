import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expect,test} from '@playwright/test';
import {syncSlideRendererAssets,syncDomDescriptorMimeType,type SyncSlidePresentation} from '../../packages/contracts/src/index';
import type {PlayerManifestEnvelope} from '../../apps/player/app/_lib/player-manifest';

type Stage={label:string;dataRevision:number;contentHash:string;dataKey:string;presentation:SyncSlidePresentation};
type Variant={orientation:'landscape'|'portrait';releaseId:string;snapshotId:string;templateVersionId:string;configurationHash:string;descriptor:string;descriptorChecksum:string;durationMs:number;initial:Stage;standing:Stage;added:Stage;corrected:Stage;expired:Stage;empty:Stage};
// Regenerate with the local-only SQL/RPC probe. These are its exact canonical
// projections after an actual guarded publication, never provider credentials.
const fixture=JSON.parse(readFileSync('tests/fixtures/s295-published-sportlink.json','utf8')) as {generatedFromIsolatedDatabase:boolean;variants:Variant[]};
const origin=`http://127.0.0.1:${process.env.PLAYER_PORT??3106}`;
const runtimeBuildId=process.env.PLAYWRIGHT_PRODUCTION_SERVERS==='1'?readFileSync('apps/player/.next/BUILD_ID','utf8').trim():null;

// Optional read-only diagnostics for slow/cold renderer preparation. Preserve
// the failed run too; a loaded DOM alone must never count as first-frame proof.
test.afterEach(async({page},info)=>{
 if(process.env.S295_READINESS_PROBE!=='1')return;
 const observations=await page.evaluate(()=>Reflect.get(window,'__s295Readiness')).catch(()=>null);
 writeFileSync(info.outputPath('renderer-readiness-final-page.json'),JSON.stringify(observations));
});

for(const variant of fixture.variants)test(`published Sportlink ${variant.orientation}: independent standings and pool results reach visible frames in the same release`,async({page,context},info)=>{
 test.setTimeout(500_000);
 expect(fixture.generatedFromIsolatedDatabase).toBe(true);
 const base=await(await page.request.get(`${origin}/api/player/manifest?deviceToken=demo-online`)).json() as PlayerManifestEnvelope;
 let stage=variant.initial,offline=false;
 const requests:Array<{at:number;status:number;conditional:boolean;revision:number;correlationId:string;etag:string;dataKey:string;ifNoneMatch:string|null;phase:'online'|'offline'}>=[];
 const frames:Array<{revision:number;at:number;contentHash:string;correlationId:string;snapshotId:string;itemId:string}>=[];
 const sawFrame=(expected:Stage)=>frames.some(frame=>frame.revision===expected.dataRevision&&frame.contentHash===expected.contentHash&&frame.snapshotId===variant.snapshotId&&frame.itemId===variant.snapshotId);
 const settledFrames:Array<{revision:number;at:number}>=[];
 const make=():PlayerManifestEnvelope=>({...base,
  device:{...base.device,desiredReleaseId:variant.releaseId},
  target:{revision:'1',configRevision:'1',publicationId:variant.releaseId,assignmentSource:'default',committedAt:new Date().toISOString()},
  manifest:{...base.manifest,schemaVersion:2,releaseId:variant.releaseId,playlistId:'29500000-0000-4000-9000-000000000003',
   syncSystemAssets:syncSlideRendererAssets(stage.presentation).map(asset=>({path:asset.path,checksumSha256:asset.sha256,bytes:asset.bytes,mimeType:asset.mimeType})),
   items:[{...base.manifest.items[0]!,id:variant.snapshotId,kind:'composition',durationSeconds:variant.durationMs/1000,transition:'cut',
    source:{url:origin+'/s295-descriptor.json',checksumSha256:variant.descriptorChecksum,bytes:Buffer.byteLength(variant.descriptor),mimeType:syncDomDescriptorMimeType},
    syncDynamic:{schemaVersion:2,configurationSnapshotId:variant.snapshotId,snapshotId:variant.snapshotId,templateVersionId:variant.templateVersionId,configurationHash:variant.configurationHash,descriptorChecksumSha256:variant.descriptorChecksum,durationMs:variant.durationMs,contentHash:stage.contentHash,dataRevision:stage.dataRevision,presentation:stage.presentation,assets:{}}}]}});
 await page.route('**/api/player/installation',route=>route.fulfill({json:{ok:true,bound:true,installationCredential:'i'.repeat(48)}}));
 await page.route('**/api/player/realtime',route=>route.fulfill({status:204}));
 await page.route('**/api/player/commands*',route=>route.fulfill({json:{commands:[],serverTime:new Date().toISOString()}}));
 await page.route('**/api/player/manifest*',route=>{
  const etag=`"s295-${createHash('sha256').update(stage.dataKey).digest('hex')}"`,conditional=Boolean(route.request().headers()['if-none-match']);
  const status=offline?503:route.request().headers()['if-none-match']===etag?304:200;
  requests.push({at:Date.now(),status,conditional,revision:stage.dataRevision,correlationId:`s295-manifest:${variant.releaseId}:${requests.length+1}`,etag,dataKey:stage.dataKey,ifNoneMatch:route.request().headers()['if-none-match']??null,phase:offline?'offline':'online'});
  return route.fulfill(status===200?{json:make(),headers:{ETag:etag}}:{status,body:'',headers:{ETag:etag}});
 });
 await page.route('**/api/player/heartbeat',route=>{
  const confirmation=route.request().postDataJSON().sourceDataConfirmation as {dataRevision:number;contentHash:string;configurationSnapshotId:string;itemId:string}|undefined;
  if(confirmation&&!frames.some(frame=>frame.revision===confirmation.dataRevision))frames.push({revision:confirmation.dataRevision,contentHash:confirmation.contentHash,at:Date.now(),correlationId:`s295-frame:${variant.releaseId}:${confirmation.dataRevision}`,snapshotId:confirmation.configurationSnapshotId,itemId:confirmation.itemId});
  return route.fulfill({json:{ok:true}});
 });
 await page.route('**/s295-descriptor.json',route=>route.fulfill({body:variant.descriptor,contentType:syncDomDescriptorMimeType}));
 await page.setViewportSize(variant.orientation==='portrait'?{width:1080,height:1920}:{width:1920,height:1080});
 // Prepare the real app shell before the already-published playback scenario.
 // No DOM2 candidate can bypass its controlled/complete service-worker gate.
 await page.goto(origin);
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));});
 await page.addInitScript(({production})=>{
  localStorage.setItem('veyocast.player.deviceToken','a'.repeat(48));localStorage.setItem('veyocast.player.installationCredential','i'.repeat(48));
  if(production){const schedule=window.setTimeout.bind(window);window.setTimeout=((handler:TimerHandler,delay?:number,...args:unknown[])=>schedule(handler,delay!==undefined&&delay>=8000&&delay<=8750?120000:delay,...args)) as typeof window.setTimeout;}
 },{production:process.env.PLAYWRIGHT_PRODUCTION_SERVERS==='1'});
 if(process.env.S295_READINESS_PROBE==='1')await page.addInitScript(()=>{
  const observations:unknown[]=[];Reflect.set(window,'__s295Readiness',observations);
  let previousRaf=performance.now(),maxRafGapMs=0,previousSample=previousRaf;
  const raf=(at:number)=>{maxRafGapMs=Math.max(maxRafGapMs,at-previousRaf);previousRaf=at;requestAnimationFrame(raf);};requestAnimationFrame(raf);
  setInterval(()=>{
   if(observations.length>=2000)return;
   const at=performance.now(),root=document.querySelector<HTMLElement>('[data-sync-ready]');
   if(!root)return;
   const frame=root.querySelector<HTMLElement>('.vc-slide-preview'),screen=frame?.querySelector<HTMLElement>('.screen'),animated=root.querySelector<HTMLElement>('.sync-slide-animated');
   const box=frame?.getBoundingClientRect(),style=frame?getComputedStyle(frame):null;
   observations.push({at,intervalGapMs:at-previousSample,maxRafGapMs,hash:root.dataset.syncContentHash,innerReady:root.dataset.syncReady,elapsed:root.querySelector('[data-ot-elapsed]')?.getAttribute('data-ot-elapsed'),handoff:root.closest('[data-player-handoff]')?.getAttribute('data-player-handoff'),frame:box?{width:box.width,height:box.height,visibility:style?.visibility,opacity:style?.opacity}:null,animatedOpacity:animated?getComputedStyle(animated).opacity:null,backgroundOpacity:screen?getComputedStyle(screen,'::before').opacity:null,panels:screen?[...screen.querySelectorAll<HTMLElement>('.slide-content .panel,.slide-content .photo-panel,.slide-content .pitch,.slide-content .goal-scene,.slide-content .video-layout')].map(panel=>({className:panel.className,opacity:getComputedStyle(panel).opacity})):[]});
   previousSample=at;maxRafGapMs=0;
  },100);
 });
 await page.goto(`${origin}/?syncMs=120000`);
 const results=page.locator('.dashboard-results'),fixtures=page.locator('.dashboard-fixtures');
 const current=()=>page.locator('[data-player-handoff="first-frame-ready"] [data-sync-ready="true"] .vc-slide-preview').last();
 const confirmReadablePanels=async()=>{
  await expect.poll(()=>page.locator('.slide-content .panel').evaluateAll(panels=>panels.length===3&&panels.every(panel=>{const style=getComputedStyle(panel);return Number(style.opacity)>=0.99&&(style.filter==='none'||style.filter==='blur(0px)');})),{timeout:10_000}).toBe(true);
  settledFrames.push({revision:stage.dataRevision,at:Date.now()});
 };

 await expect(current()).toBeVisible({timeout:25_000});
 await expect(results.getByText('Eigen tegenstander',{exact:true})).toBeVisible();
 await expect(results.getByText('Poule B',{exact:true})).toHaveCount(0);
 await expect(results.getByText('Poule D',{exact:true})).toBeVisible();
 await expect(page.locator('[data-ot-pool-results="2"]')).toBeVisible();
 await expect(page.locator('[data-ot-rank-list] .rank-row')).toHaveCount(14);
 await expect(fixtures.getByText('Volgende tegenstander',{exact:true})).toBeVisible();
 await expect(page.getByText('Andere poule',{exact:true})).toHaveCount(0);
 const ownRank=page.locator('.rank-row[data-team-id="295100"]').first();
 const poolCard=results.locator('.match-card').filter({hasText:'Poule B'});
 await expect(ownRank).toHaveAttribute('data-position','2');
 await expect(ownRank.locator('.points')).toHaveText('3');
 await expect(page.locator('.match-card.ours').filter({hasText:'Eigen tegenstander'})).toBeVisible();
 await expect.poll(()=>sawFrame(variant.initial),{timeout:12_000}).toBe(true);
 await confirmReadablePanels();
 // Renderer selectors vary with historical visual revisions; semantic text
 // and the existing three panels are the visible acceptance boundaries.
 await expect(page.locator('.dashboard-results .panel-head h3')).toHaveText('De uitslagen.');
 await expect(page.locator('.dashboard-rank .panel-head h3')).toHaveText('Dit is onze plek.');
 await expect(page.locator('.dashboard-fixtures .panel-head h3')).toHaveText('Het programma.');
 const standingChangedAt=Date.now();stage=variant.standing;
 await expect.poll(()=>requests.some(request=>request.revision===stage.dataRevision&&request.status===200),{timeout:60_000}).toBe(true);
 await expect(ownRank).toHaveAttribute('data-position','1',{timeout:70_000});
 await expect(ownRank.locator('.points')).toHaveText('9');
 await expect(ownRank).toContainText('+5');
 await expect(results.getByText('Eigen tegenstander',{exact:true})).toBeVisible();
 await expect(results.getByText('Poule B',{exact:true})).toHaveCount(0);
 await expect.poll(()=>sawFrame(stage),{timeout:12_000}).toBe(true);
 await confirmReadablePanels();
 await page.screenshot({path:info.outputPath(`sportlink-${variant.orientation}-standings-only.png`)});
 const newResultOriginAt=Date.now();stage=variant.added;
 await expect.poll(()=>requests.some(request=>request.revision===stage.dataRevision&&request.status===200),{timeout:60_000}).toBe(true);
 await expect(results.getByText('Poule B',{exact:true})).toBeVisible({timeout:70_000});
 await expect(poolCard.locator('.team-line b')).toHaveText(['0','0']);
 await expect(page.locator('[data-ot-pool-results="3"]')).toBeVisible();
 await expect(ownRank.locator('.points')).toHaveText('9');
 await expect.poll(()=>sawFrame(stage),{timeout:12_000}).toBe(true);
 await confirmReadablePanels();
 await page.screenshot({path:info.outputPath(`sportlink-${variant.orientation}-new-zero-result.png`)});
 const poolChangedAt=Date.now();stage=variant.corrected;
 await expect.poll(()=>requests.some(request=>request.revision===stage.dataRevision&&request.status===200),{timeout:60_000}).toBe(true);
 await expect(poolCard.locator('.team-line b')).toHaveText(['2','0'],{timeout:70_000});
 await expect(ownRank).toHaveAttribute('data-position','1');
 await expect(ownRank.locator('.points')).toHaveText('9');
 await expect(results.getByText('Eigen tegenstander',{exact:true})).toBeVisible();
 await expect(fixtures.getByText('Volgende tegenstander',{exact:true})).toBeVisible();
 await expect.poll(()=>sawFrame(stage),{timeout:12_000}).toBe(true);
 await confirmReadablePanels();
 // Early acceptance can make revision 4 the first frame of a new item.
 // The unchanged conditional check then belongs to its next real activation.
 await expect.poll(()=>requests.some(request=>request.revision===stage.dataRevision&&request.status===304),{timeout:variant.durationMs+10_000}).toBe(true);
 expect(requests.slice(1).every(request=>request.conditional)).toBe(true);
 expect(requests.length).toBeLessThan(15);
 // Verify the last official row actually crosses the clipped rank viewport;
 // a DOM row count alone does not prove that a screen can show it.
 await expect.poll(()=>page.locator('[data-ot-rank-list] .rank-row').last().evaluate(row=>{
  const viewport=row.closest('[data-ot-rank-list]');
  if(!viewport)return false;
  const clip=viewport.getBoundingClientRect(),card=row.getBoundingClientRect();
  return card.top>=clip.top-1&&card.bottom<=clip.bottom+1;
 }),{timeout:variant.durationMs+5_000}).toBe(true);
 await page.screenshot({path:info.outputPath(`sportlink-${variant.orientation}-last-standing-row.png`)});
 const expiredOriginAt=Date.now();stage=variant.expired;
 await expect.poll(()=>requests.some(request=>request.revision===stage.dataRevision&&request.status===200),{timeout:60_000}).toBe(true);
 await expect(results.getByText('Poule D',{exact:true})).toHaveCount(0,{timeout:70_000});
 await expect(poolCard.locator('.team-line b')).toHaveText(['2','0']);
 await expect(results.getByText('Eigen tegenstander',{exact:true})).toBeVisible();
 await expect.poll(()=>sawFrame(stage),{timeout:12_000}).toBe(true);
 await confirmReadablePanels();
 const emptyOriginAt=Date.now();stage=variant.empty;
 await expect.poll(()=>requests.some(request=>request.revision===stage.dataRevision&&request.status===200),{timeout:60_000}).toBe(true);
 await expect(results.locator('.ot-empty')).toHaveText('Er zijn nog geen gegevens beschikbaar.',{timeout:70_000});
 await expect(results.locator('.match-card')).toHaveCount(0);
 await expect(fixtures.getByText('Volgende tegenstander',{exact:true})).toBeVisible();
 await expect(ownRank.locator('.points')).toHaveText('9');
 await expect.poll(()=>sawFrame(stage),{timeout:12_000}).toBe(true);
 await confirmReadablePanels();
 await page.screenshot({path:info.outputPath(`sportlink-${variant.orientation}-empty-results.png`)});
 if(process.env.S295_READINESS_PROBE==='1')writeFileSync(info.outputPath('renderer-readiness-evidence.json'),JSON.stringify(await page.evaluate(()=>Reflect.get(window,'__s295Readiness'))));
 const finalRevision=stage.dataRevision;
 offline=true;await context.setOffline(true);
 try{await page.reload();await expect(current()).toBeVisible({timeout:20_000});await expect(results.locator('.ot-empty')).toHaveText('Er zijn nog geen gegevens beschikbaar.');await expect(page.getByLabel('Pairingcode')).toHaveCount(0);await confirmReadablePanels();}finally{await context.setOffline(false);}
 await page.screenshot({path:info.outputPath(`sportlink-${variant.orientation}-offline.png`)});
 writeFileSync(info.outputPath('publication-frame-evidence.json'),JSON.stringify({fixture:true,runtimeBuildId,orientation:variant.orientation,serverClockInstrumentedForExpiry:true,releaseId:variant.releaseId,snapshotId:variant.snapshotId,periodicIntervalMs:120000,itemDurationMs:variant.durationMs,finalRevision,requests,frames,settledFrames,
  expiredOriginToReadableFrameMs:settledFrames.find(frame=>frame.revision===variant.expired.dataRevision)!.at-expiredOriginAt,
  emptyOriginToReadableFrameMs:settledFrames.find(frame=>frame.revision===variant.empty.dataRevision)!.at-emptyOriginAt,
  standingOriginToReadableFrameMs:settledFrames.find(frame=>frame.revision===variant.standing.dataRevision)!.at-standingChangedAt,
  newResultOriginToReadableFrameMs:settledFrames.find(frame=>frame.revision===variant.added.dataRevision)!.at-newResultOriginAt,
  poolOriginToReadableFrameMs:settledFrames.find(frame=>frame.revision===variant.corrected.dataRevision)!.at-poolChangedAt,
  standingOriginToFrameMs:frames.find(frame=>frame.revision===variant.standing.dataRevision)!.at-standingChangedAt,
  newResultOriginToFrameMs:frames.find(frame=>frame.revision===variant.added.dataRevision)!.at-newResultOriginAt,
  poolOriginToFrameMs:frames.find(frame=>frame.revision===variant.corrected.dataRevision)!.at-poolChangedAt,hostedStaging:false,actualProvider:false}));
});
