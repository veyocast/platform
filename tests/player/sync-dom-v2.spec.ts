import {createHash}from'node:crypto';
import {writeFileSync}from'node:fs';
import {expect,test,chromium,type Page}from'@playwright/test';
import {syncSlideRendererAssets,syncSlideDurationMs,syncSlidePresentationSchema,syncDomDescriptorMimeType,type SyncSlidePresentation}from'@veyocast/contracts';
import {createSyncTemplatePreview}from'../../apps/control/app/(shell)/dashboard/studio/sync-template-preview';
import type {PlayerManifestEnvelope}from'../../apps/player/app/_lib/player-manifest';
test.use({launchOptions:{executablePath:chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--num-raster-threads=1']}});
const origin=`http://127.0.0.1:${process.env.PLAYER_PORT??3106}`;
const uuid=(n:number)=>`29200000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
async function setup(page:Page,family:'menu'|'rss'|'birthdays'='menu',orientation:'landscape'|'portrait'='landscape',mode:'light'|'dark'='light',initialLegacy=false,birthdayCount=8){
 const base=await(await page.request.get(`${origin}/api/player/manifest?deviceToken=demo-online`)).json()as PlayerManifestEnvelope;
 const preview=createSyncTemplatePreview(family);
 const presentation=syncSlidePresentationSchema.parse({...preview,...(family==='birthdays'?{rich:{...preview.rich,birthdays:Array.from({length:birthdayCount},(_,index)=>({...preview.rich!.birthdays![0]!,id:`fixture-person-${index}`,displayName:'Voornaam Achternaam'}))}}:{}),orientation,visual:{schemaVersion:1,mode},...(family==='rss'?{rich:{news:[{id:'controlled-article',title:'Gecontroleerd nieuws',intro:'Een echte foto, leverancier en QR in de gedeelde renderer.',source:'Fixture redactie',url:'https://www.duindorpsv.nl/nieuws',heroImage:{kind:'system',path:'/onzetrots-approved-v1/assets/club-life-v28/walking-1280.webp',checksumSha256:'e48d17d104d69a28b1cced837571329c7ae2e1fd15bc8347e63846539ca598be'},providerLogo:createSyncTemplatePreview('rss').club.logo}]}}:{})});
 const descriptor=JSON.stringify({schemaVersion:2,presentation}),descriptorHash=hash(descriptor);
 const create=(dataRevision=1,current:SyncSlidePresentation=presentation):PlayerManifestEnvelope=>({...base,
  device:{...base.device,desiredReleaseId:uuid(1)},
  target:{revision:'2',configRevision:'2',publicationId:uuid(2),assignmentSource:'default',committedAt:new Date().toISOString()},
  manifest:{...base.manifest,schemaVersion:2,releaseId:uuid(1),syncSystemAssets:syncSlideRendererAssets(current).map(asset=>({path:asset.path,checksumSha256:asset.sha256,bytes:asset.bytes,mimeType:asset.mimeType})),items:[{...base.manifest.items[0]!,id:uuid(3),sourceItemId:uuid(4),kind:'composition',durationSeconds:syncSlideDurationMs(current,4)/1000,transition:'none',source:{url:`${origin}/fixture-source.json`,checksumSha256:descriptorHash,bytes:Buffer.byteLength(descriptor),mimeType:syncDomDescriptorMimeType},syncDynamic:{schemaVersion:2,configurationSnapshotId:uuid(5),snapshotId:uuid(5),templateVersionId:uuid(6),configurationHash:'c'.repeat(64),contentHash:hash(`facts-${dataRevision}`),descriptorChecksumSha256:descriptorHash,durationMs:syncSlideDurationMs(current,4),dataRevision,presentation:current,assets:{}}}]}});
 const legacy={...base,target:{revision:'1',configRevision:'1',publicationId:uuid(2),assignmentSource:'default' as const,committedAt:new Date().toISOString()},manifest:{...base.manifest,items:[{...base.manifest.items[0]!,durationSeconds:2}]}};
 let envelope=initialLegacy?legacy:create(),offline=false,corrupt=false,downloads=0,manifestRequests=0,resourceDownloads=0;const startedAt=Date.now(),resourcePaths=new Set(syncSlideRendererAssets(presentation).map(asset=>asset.path));
 page.on('request',request=>{if(resourcePaths.has(new URL(request.url()).pathname))resourceDownloads++;});
 const headers:string[]=[],heartbeats:Array<Record<string,unknown>>=[],frameReceipts:Array<{revision:number;contentVisible:boolean;at:number}>=[],seenFrames=new Set<string>();
 await page.addInitScript(()=>{
  localStorage.setItem('veyocast.player.deviceToken','a'.repeat(48));localStorage.setItem('veyocast.player.installationCredential','i'.repeat(48));
  Object.assign(window,{s292FontLoads:0});const load=FontFace.prototype.load;FontFace.prototype.load=function(){(window as unknown as {s292FontLoads:number}).s292FontLoads++;return load.call(this);};
 });
 await page.route('**/api/player/installation',route=>offline?route.abort():route.fulfill({json:{ok:true,bound:true,installationCredential:'i'.repeat(48)}}));
 await page.route('**/api/player/realtime',route=>route.fulfill({status:204}));
 await page.route('**/api/player/manifest*',route=>{manifestRequests++;headers.push(route.request().headers()['x-veyocast-sync-dynamic']??'');return offline?route.abort():route.fulfill({json:envelope});});
 await page.route('**/api/player/heartbeat',async route=>{
  const body=route.request().postDataJSON();heartbeats.push(body);const source=body.sourceDataConfirmation as {dataRevision:number;contentHash:string}|null;
  if(source&&!seenFrames.has(source.contentHash)){
   seenFrames.add(source.contentHash);
   const contentVisible=await page.evaluate(hash=>{const root=[...document.querySelectorAll<HTMLElement>('[data-sync-content-hash]')].find(element=>element.dataset.syncContentHash===hash&&!element.closest('[aria-hidden="true"]')),panels=root?.querySelectorAll<HTMLElement>('.slide-content .panel,.slide-content .photo-panel');return Boolean(panels?.length&&[...panels].every(element=>Number(getComputedStyle(element).opacity)>0));},source.contentHash);
   frameReceipts.push({revision:source.dataRevision,contentVisible,at:Date.now()});
  }
  return route.fulfill({json:{ok:true}});
 });
 await page.route('**/fixture-source.json',route=>{downloads++;return route.fulfill({body:corrupt?'corrupt descriptor':descriptor,contentType:syncDomDescriptorMimeType});});
 await page.setViewportSize(orientation==='portrait'?{width:1080,height:1920}:{width:1920,height:1080});
 await page.goto(`${origin}/?syncMs=10000`);
 if(!initialLegacy)await expect(page.getByRole('status',{name:'Uitzending voorbereiden',exact:true})).toBeVisible({timeout:15000});
 return{presentation,headers,heartbeats,frameReceipts,create,startedAt,get resourceDownloads(){return resourceDownloads;},get requests(){return manifestRequests;},get downloads(){return downloads;},setEnvelope(value:PlayerManifestEnvelope){envelope=value;},setOffline(value:boolean){offline=value;},setCorrupt(value:boolean){corrupt=value;}};
}
async function visible(page:Page){await expect(page.locator('[data-sync-ready="true"] .vc-slide-preview').last()).toBeVisible({timeout:25000});await expect(page.locator('[data-player-handoff="first-frame-ready"]').last()).toBeVisible();}
async function stored(page:Page){return page.evaluate(()=>new Promise<{schemaVersion:number;dataRevision:number;previousSchema?:number}>((resolve,reject)=>{
 const request=indexedDB.open('veyocast-player-cache-v1');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('activeReleases'),get=tx.objectStore('activeReleases').get('a'.repeat(48));get.onsuccess=()=>{const value=get.result;db.close();resolve(value?{schemaVersion:value.envelope.manifest.schemaVersion,dataRevision:value.envelope.manifest.items[0].syncDynamic?.dataRevision,previousSchema:value.previousDom?.envelope.manifest.schemaVersion}:{schemaVersion:0,dataRevision:0});};};
 }));}
for(const orientation of ['landscape','portrait']as const)for(const mode of ['light','dark']as const)test(`v2 RSS ${orientation}/${mode}: actual photo, QR, logo and first-frame receipt without a full-slide binary`,async({page},info)=>{
 const state=await setup(page,'rss',orientation,mode);await visible(page);
 await expect(page.locator('.rss-photo img')).toBeVisible();await expect(page.locator('.rss-qr-zone svg')).toBeVisible();await expect(page.locator('.rss-provider img')).toBeVisible();
 await expect.poll(()=>state.heartbeats.some(body=>(body.sourceDataConfirmation as {dataRevision?:number}|null)?.dataRevision===1)).toBe(true);
 await expect.poll(()=>state.frameReceipts.find(frame=>frame.revision===1)?.contentVisible).toBe(true);
 expect(state.headers).toContain('sync-dynamic-v2');expect(state.downloads).toBe(1);expect(await page.locator('video').count()).toBe(0);
 await expect.poll(async()=>(await stored(page)).schemaVersion).toBe(2);
 writeFileSync(info.outputPath('first-frame.json'),JSON.stringify({fixture:true,family:'rss',orientation,mode,fixtureStartToConfirmedContentFrameMs:state.frameReceipts[0]!.at-state.startedAt,descriptorDownloads:state.downloads,resourceDownloads:state.resourceDownloads,requiredBytes:syncSlideRendererAssets(state.presentation).reduce((sum,asset)=>sum+asset.bytes,0)}));
 await expect(page.locator('.screen.intro-finished').last()).toBeAttached({timeout:10000});
 await page.locator('.vc-slide-preview').last().screenshot({path:info.outputPath(`rss-${orientation}-${mode}.png`)});
});
test('v2 facts change at the natural boundary without a new descriptor or font load; unchanged and regressed revisions do not replace it',async({page},info)=>{
 test.setTimeout(60000);const state=await setup(page);await visible(page);await expect.poll(async()=>(await stored(page)).dataRevision).toBe(1);
 const fonts=await page.evaluate(()=>(window as unknown as {s292FontLoads:number}).s292FontLoads),downloads=state.downloads,resources=state.resourceDownloads;
 const changed=syncSlidePresentationSchema.parse({...state.presentation,rows:state.presentation.rows.map((row,index)=>index===0?['Actueel broodje',...row.slice(1)]:row)});
 const updateStarted=Date.now();state.setEnvelope(state.create(2,changed));const requested=state.requests;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect.poll(()=>state.requests).toBeGreaterThan(requested);
 await expect(page.getByText('Actueel broodje',{exact:false}).last()).toBeVisible({timeout:15000});
 await expect.poll(async()=>(await stored(page)).dataRevision).toBe(2);const updateToConfirmedFrameMs=Date.now()-updateStarted;
 await expect.poll(()=>state.frameReceipts.find(frame=>frame.revision===2)?.contentVisible).toBe(true);
 await expect.poll(()=>state.heartbeats.some(body=>(body.sourceDataConfirmation as {dataRevision?:number}|null)?.dataRevision===2)).toBe(true);
 const after=await page.evaluate(()=>(window as unknown as {s292FontLoads:number}).s292FontLoads);expect(after).toBe(fonts);expect(state.downloads).toBe(downloads);expect(state.resourceDownloads).toBe(resources);
 state.setEnvelope(state.create(1));await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForTimeout(1000);await expect(page.getByText('Actueel broodje',{exact:false}).last()).toBeVisible();expect((await stored(page)).dataRevision).toBe(2);
 await page.waitForTimeout(4500);expect(await page.evaluate(()=>(window as unknown as {s292FontLoads:number}).s292FontLoads)).toBe(fonts);await expect(page.getByText('Actueel broodje',{exact:false}).last()).toBeVisible();
 writeFileSync(info.outputPath('facts-refresh.json'),JSON.stringify({initialFontLoads:fonts,afterFontLoads:after,descriptorDownloads:state.downloads,additionalResourceDownloads:state.resourceDownloads-resources,updateToConfirmedFrameMs,visibleDataRevision:2}));
});
test('a complete DOM publication survives a real offline reload and rejects corrupt new descriptor bytes',async({page,context})=>{
 test.setTimeout(60000);const state=await setup(page);await visible(page);await expect.poll(async()=>(await stored(page)).dataRevision).toBe(1);
 const corrupt=state.create();corrupt.manifest.releaseId=uuid(10);corrupt.target!.revision='3';corrupt.target!.configRevision='3';corrupt.device.desiredReleaseId=uuid(10);corrupt.manifest.items[0]!.source.checksumSha256='f'.repeat(64);if(corrupt.manifest.items[0]!.syncDynamic!.schemaVersion===2)corrupt.manifest.items[0]!.syncDynamic!.descriptorChecksumSha256='f'.repeat(64);
 state.setCorrupt(true);state.setEnvelope(corrupt);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect.poll(()=>state.downloads).toBeGreaterThan(1);await expect(page.locator('[data-sync-ready="true"] .vc-slide-preview').last()).toBeVisible();expect((await stored(page)).dataRevision).toBe(1);
 state.setOffline(true);await context.setOffline(true);
 try{await page.reload();await expect(page.getByRole('status',{name:'Uitzending voorbereiden',exact:true})).toBeVisible();await visible(page);expect((await stored(page)).schemaVersion).toBe(2);await expect(page.getByLabel('Pairingcode')).toHaveCount(0);}finally{await context.setOffline(false);}
});

test('a renderer exception restores the verified prior DOM data and preserves a v1 app rollback release',async({page})=>{
 test.setTimeout(70000);const state=await setup(page,'menu','landscape','light',true);
 await expect(page.locator('[data-player-handoff="first-frame-ready"]')).toBeVisible();await expect.poll(async()=>(await stored(page)).schemaVersion).toBe(1);
 state.setEnvelope(state.create());await page.evaluate(()=>window.dispatchEvent(new Event('online')));await visible(page);await expect.poll(async()=>(await stored(page)).dataRevision).toBe(1);
 const changed=syncSlidePresentationSchema.parse({...state.presentation,rows:state.presentation.rows.map((row,index)=>index===0?['Hersteld broodje',...row.slice(1)]:row)});
 state.setEnvelope(state.create(2,changed));await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(page.getByText('Hersteld broodje',{exact:false}).last()).toBeVisible({timeout:15000});await expect.poll(async()=>(await stored(page)).dataRevision).toBe(2);
 const failedHash=hash('facts-3');await page.evaluate(failedHash=>{
  const original=HTMLElement.prototype.querySelectorAll;HTMLElement.prototype.querySelectorAll=function(selector:string){
   if(selector==='[data-ot-rank-list]'&&this.dataset.syncContentHash===failedHash)throw Error('Injected renderer layout failure');
   return original.call(this,selector);
  }as typeof original;
 },failedHash);
 state.setEnvelope(state.create(3,{...changed,title:'Niet bevestigde kandidaat'}));await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await expect(page.getByLabel('Player diagnostics')).toContainText('De laatste correcte uitzending is hersteld',{timeout:20000});
 await expect(page.getByText('Hersteld broodje',{exact:false}).last()).toBeVisible();expect((await stored(page)).dataRevision).toBe(2);
 expect(state.heartbeats.some(body=>(body.sourceDataConfirmation as {dataRevision?:number}|null)?.dataRevision===3)).toBe(false);
 const compatibility=await page.evaluate(()=>new Promise<number>((resolve,reject)=>{const request=indexedDB.open('veyocast-player-cache-v1');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,get=db.transaction('previousReleases').objectStore('previousReleases').get('a'.repeat(48));get.onsuccess=()=>{db.close();resolve(get.result?.envelope.manifest.schemaVersion??0);};};}));
 expect(compatibility).toBe(1);await expect(page.getByLabel('Pairingcode')).toHaveCount(0);
});

test('a corrupt new original image keeps the prior complete CSS data active',async({page})=>{
 test.setTimeout(45000);const state=await setup(page);await visible(page);await expect.poll(async()=>(await stored(page)).dataRevision).toBe(1);
 let attempted=false;await page.route('**/corrupt-source.png',route=>{attempted=true;return route.fulfill({contentType:'image/png',body:Buffer.alloc(64)});});
 const id=uuid(30),presentation=syncSlidePresentationSchema.parse({...state.presentation,club:{...state.presentation.club,logo:{kind:'tenant',mediaAssetId:id,checksumSha256:'b'.repeat(64)}}}),next=state.create(2,presentation);
 next.manifest.items[0]!.syncDynamic!.assets={[id]:{bytes:64,checksumSha256:'b'.repeat(64),mimeType:'image/png',url:origin+'/corrupt-source.png'}};
 state.setEnvelope(next);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect.poll(()=>attempted).toBe(true);
 await page.waitForTimeout(500);expect((await stored(page)).dataRevision).toBe(1);await expect(page.locator('[data-sync-ready="true"] .vc-slide-preview').last()).toBeVisible();expect(state.heartbeats.some(body=>(body.sourceDataConfirmation as {dataRevision?:number}|null)?.dataRevision===2)).toBe(false);
});

for(const orientation of ['landscape','portrait']as const)for(const count of [0,8])test(`v2 birthdays ${orientation}/${count}: authorized empty or paged content becomes a real offline recovery point`,async({page})=>{
 const state=await setup(page,'birthdays',orientation,'light',false,count);await visible(page);
 await expect.poll(async()=>(await stored(page)).dataRevision).toBe(1);
 await expect(page.locator('.fixed-six-grid')).toHaveAttribute('data-filled-count',String(Math.min(6,count)));
 await expect(page.locator('.fixed-six-grid > *')).toHaveCount(6);
 if(!count){await expect(page.locator('.birthday-card')).toHaveCount(0);await expect(page.locator('.empty-grid-slot')).toHaveCount(6);}
 else{await expect(page.locator('.birthday-name').first()).toContainText('Voornaam A.');await expect(page.locator('.fixed-six-grid')).toHaveAttribute('data-filled-count','2',{timeout:8000});await expect(page.locator('.empty-grid-slot')).toHaveCount(4);}
 expect(state.heartbeats.some(body=>body.preparationError==='SYNC_DOM_RENDER_FAILED')).toBe(false);expect((await stored(page)).schemaVersion).toBe(2);
});
