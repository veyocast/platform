import{createHash}from'node:crypto';
import{test,expect,type Page}from'@playwright/test';
import{menuDomFixture,menuDomFixtureId as id}from'../helpers/menu-dom-fixture';
import{prepareMenuDomDescriptor}from'../../apps/media-worker/src/menu-dom-render';
import type{ClaimedDynamicRenderJob}from'../../apps/media-worker/src/dynamic-render-backend';
import type{PlayerManifestEnvelope}from'../../apps/player/app/_lib/player-manifest';
import system from'../../packages/content-templates/src/sites-system-assets.json';
const origin=`http://127.0.0.1:${process.env.PLAYER_PORT??3106}`;
async function setup(page:Page,orientation:'landscape'|'portrait'='landscape',mode:'light'|'dark'='light',split=false,activationProbe=false){
 const baseline=await(await page.request.get(origin+'/api/player/manifest?deviceToken=demo-online')).json()as PlayerManifestEnvelope;
 const fixture=menuDomFixture('twelve_excel',orientation,mode),data={syncPlaybackProtocol:2,menuDocument:fixture.document,sitesConfiguration:fixture.design,brand:{clubName:'Eigen testclub'}};
 const job:ClaimedDynamicRenderJob={jobId:id(20),tenantId:id(1),snapshotId:id(21),templateVersionId:id(22),templateSlug:'price-list-widget',snapshotHash:'a'.repeat(64),slideVersionId:id(23),leaseToken:id(24),outputMediaAssetId:id(25),slideName:'Onze kantine',orientation,markup:'unused',css:'',manifest:{engine:'veyocast-safe-template-v1',schemaVersion:1,canvas:{width:orientation==='portrait'?1080:1920,height:orientation==='portrait'?1920:1080},slideType:'price_list',allowedFields:[],maxCollectionItems:100},snapshotData:data};
 const prepared=prepareMenuDomDescriptor(job,{}),descriptor=prepared.bytes,checksum=createHash('sha256').update(descriptor).digest('hex');
 const create=(revision=1):PlayerManifestEnvelope=>{
  const presentation=structuredClone(prepared.menuDom.presentation);if(presentation.kind!=='dynamic')throw Error('fixture');
  if(revision>1)presentation.content.menuPages![0]!.widgets[0]!.rows[0]!.value='€ 3,75';
  const body:PlayerManifestEnvelope={...baseline,device:{...baseline.device,desiredReleaseId:id(26)},manifest:{...baseline.manifest,schemaVersion:2,releaseId:id(26),syncSystemAssets:undefined,systemAssets:system.files.map(asset=>({path:asset.path,bytes:asset.bytes,checksumSha256:asset.sha256,mimeType:asset.mimeType})),items:[{...baseline.manifest.items[0]!,id:id(27),kind:'composition',durationSeconds:prepared.menuDom.durationMs/1000,contentHash:'c'.repeat(64),source:{url:origin+'/menu-dom.json',mimeType:prepared.menuDom.mimeType,bytes:descriptor.byteLength,checksumSha256:checksum},menuDom:{schemaVersion:2,configurationSnapshotId:job.snapshotId,snapshotId:job.snapshotId,templateVersionId:job.templateVersionId!,configurationHash:'c'.repeat(64),contentHash:String(revision).repeat(64),descriptorChecksumSha256:checksum,durationMs:prepared.menuDom.durationMs,dataRevision:revision,presentation,assets:{}}}]}};
  if(split){const child=structuredClone(body);child.manifest.releaseId=id(41);child.manifest.playlistId=id(42);child.manifest.items[0]!.id=id(43);child.manifest.items[0]!.durationSeconds=20;body.composition={published:{id:id(44),revision:1,configuration:{schemaVersion:1,layout:'sidebar',orientation:'landscape',mainWidthPercent:70,bottomHeightPercent:20,zones:[{id:'main',playlistId:body.manifest.playlistId},{id:'side',playlistId:child.manifest.playlistId}]},bindings:[{zoneId:'main',playlistId:body.manifest.playlistId,releaseId:body.manifest.releaseId,publicationId:id(45),configRevision:1},{zoneId:'side',playlistId:child.manifest.playlistId,releaseId:child.manifest.releaseId,publicationId:id(46),configRevision:1}]},zones:{side:child}};}
  return body;
 };
 let envelope=create(),offline=false,downloads=0,requests=0;const failures:string[]=[],frames:number[]=[],headers:string[]=[],mediaRequests:string[]=[];
 if(activationProbe){await page.goto(origin);await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));});}
 await page.addInitScript(({activationProbe,production})=>{localStorage.setItem('veyocast.player.deviceToken','a'.repeat(48));localStorage.setItem('veyocast.player.installationCredential','i'.repeat(48));if(activationProbe&&production){const schedule=window.setTimeout.bind(window);window.setTimeout=((handler:TimerHandler,delay?:number,...args:unknown[])=>schedule(handler,delay!==undefined&&delay>=8000&&delay<=8750?60000:delay,...args))as typeof window.setTimeout;}},{activationProbe,production:process.env.PLAYWRIGHT_PRODUCTION_SERVERS==='1'});
 page.on('request',request=>{if(/\.(mp4|png)(?:\?|$)/.test(request.url()))mediaRequests.push(new URL(request.url()).pathname);});
 await page.route('**/api/player/installation',route=>offline?route.abort():route.fulfill({json:{ok:true,bound:true,installationCredential:'i'.repeat(48)}}));
 await page.route('**/api/player/realtime',route=>route.fulfill({status:204}));
 await page.route('**/api/player/manifest*',route=>{requests++;headers.push(route.request().headers()['x-veyocast-sync-dynamic']??'');return offline?route.abort():route.fulfill({json:envelope});});
 await page.route('**/api/player/heartbeat',route=>{const body=route.request().postDataJSON();if(body.lastPlaybackError?.code)failures.push(body.lastPlaybackError.code);if(body.sourceDataConfirmation?.rendererVersion==='sites-v17')frames.push(body.sourceDataConfirmation.dataRevision);return route.fulfill({json:{ok:true}});});
 await page.route('**/menu-dom.json',route=>{downloads++;return route.fulfill({body:descriptor,contentType:prepared.menuDom.mimeType});});
 await page.setViewportSize(orientation==='portrait'?{width:1080,height:1920}:{width:1920,height:1080});
 await page.goto(origin+'/?syncMs='+(activationProbe?'60000':'10000'));
 const panel=page.locator('[data-player-handoff="first-frame-ready"] .vm-products-fit').last();await expect(panel).toBeVisible({timeout:30000});await expect.poll(()=>frames.includes(1),{timeout:15000}).toBe(true);
 return{create,panel,failures,frames,headers,mediaRequests,get downloads(){return downloads;},get requests(){return requests;},set(value:PlayerManifestEnvelope){envelope=value;},setOffline(){offline=true;}};
}
test('one-item multipage Menu facts accepted at the first page boundary do not start another activation check',async({page})=>{
 test.setTimeout(45000);const state=await setup(page,'landscape','light',false,true),startedAt=Date.now();
 const next=state.create(2),content=next.manifest.items[0]!.menuDom!;expect(content.presentation.kind==='dynamic'&&content.presentation.content.menuPages?.length).toBe(2);expect(content.durationMs).toBe(12000);
 state.set(next);await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await expect(page.getByText('Nieuwe brongegevens volledig gecontroleerd; wisselen na de huidige slide.',{exact:true})).toHaveCount(1);
 const observed=state.requests;
 await expect.poll(()=>state.frames.includes(2),{timeout:9000}).toBe(true);
 await expect(state.panel.locator('.vm-product')).toContainText('€ 3,75');
 await page.waitForTimeout(250);expect(state.requests).toBe(observed);
 // Renderer clocks can restart, but the original 12 s item deadline remains.
 // The next actual item loop still checks despite the unchanged slide ID.
 await expect.poll(()=>state.requests,{timeout:8500}).toBeGreaterThan(observed);
 expect(state.requests-observed).toBe(1);
 expect(Date.now()-startedAt).toBeLessThan(13500);
});
for(const orientation of ['landscape','portrait']as const)for(const mode of ['light','dark']as const)test(`actual Twelve MenuDocument widgets are DOM-ready ${orientation}/${mode} and survive offline reboot`,async({page,context},info)=>{
 const state=await setup(page,orientation,mode);expect(state.headers).toContain('sync-dynamic-v2');
 await expect(state.panel.locator('.vm-product strong')).toHaveText('Clubkoffie');await expect(state.panel.locator('.vm-product')).toContainText('€ 2,50');await expect(state.panel).toContainText('Koffiedeal');
 await page.screenshot({path:info.outputPath(`menu-${orientation}-${mode}.png`)});expect(state.downloads).toBe(1);expect(state.mediaRequests).not.toContain('/menu.png');expect(state.mediaRequests.some(path=>path.endsWith('.mp4'))).toBe(false);
 state.setOffline();await context.setOffline(true);try{await page.reload();await expect(page.locator('[data-player-handoff="first-frame-ready"] .vm-product').first()).toContainText('€ 2,50',{timeout:30000});expect(await page.evaluate(()=>localStorage.getItem('veyocast.player.deviceToken'))).toBe('a'.repeat(48));}finally{await context.setOffline(false);}
});
test('an approved Menu dataset switches at the natural boundary without downloading another descriptor and rejects regression',async({page})=>{
 await page.clock.install();const state=await setup(page);await page.clock.pauseAt(new Date(Date.now()+500));state.set(state.create(2));await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await expect(page.getByText('Nieuwe brongegevens volledig gecontroleerd; wisselen na de huidige slide.',{exact:true})).toHaveCount(1);await expect(state.panel.locator('.vm-product')).toContainText('€ 2,50');expect(state.frames).not.toContain(2);
 await page.clock.fastForward(13000);await page.clock.runFor(1000);await expect.poll(()=>state.frames.includes(2),{timeout:25000}).toBe(true);await expect(state.panel.locator('.vm-product')).toContainText('€ 3,75');expect(state.downloads).toBe(1);
 state.set(state.create(1));const before=state.requests;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect.poll(()=>state.requests).toBeGreaterThan(before);await expect(state.panel.locator('.vm-product')).toContainText('€ 3,75');
});
test('a real Menu renderer exception restores the prior verified dataset',async({page})=>{
 const state=await setup(page);await page.evaluate(()=>{const set=Element.prototype.setAttribute;Element.prototype.setAttribute=function(name,value){if(name==='data-menu-content-hash'&&value==='2'.repeat(64))throw Error('fixture Menu commit failure');return set.call(this,name,value);};});
 state.set(state.create(2));const before=state.requests;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect.poll(()=>state.requests).toBeGreaterThan(before);await expect.poll(()=>state.failures.includes('SYNC_DOM_ERROR'),{timeout:25000}).toBe(true);await expect(page.locator('[data-menu-content-hash="1'+ '1'.repeat(63)+'"] .vm-product').first()).toContainText('€ 2,50',{timeout:25000});expect(state.frames).not.toContain(2);
});

test('a mixed-clock Menu composition waits for its side zone and retains both verified datasets offline',async({page,context})=>{
 test.setTimeout(60000);const state=await setup(page,'landscape','light',true);state.set(state.create(2));await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(page.getByText('Nieuwe brongegevens volledig gecontroleerd; wisselen na de huidige slide.',{exact:true})).toHaveCount(1);
 await expect.poll(()=>page.evaluate(()=>new Promise<number>((resolve,reject)=>{const open=indexedDB.open('veyocast-player-cache-v1');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,get=db.transaction('activeReleases').objectStore('activeReleases').get('a'.repeat(48));get.onsuccess=()=>{db.close();resolve(get.result?.envelope?.composition?.zones?.side?.manifest?.items[0]?.menuDom?.dataRevision??0);};};})),{timeout:30000}).toBe(2);
 await expect(page.locator('[data-menu-content-hash="'+ '2'.repeat(64)+'"] .vm-product')).toHaveCount(2);expect(state.downloads).toBe(1);state.setOffline();await context.setOffline(true);try{await page.reload();await expect(page.locator('[data-menu-content-hash="'+ '2'.repeat(64)+'"] .vm-product')).toHaveCount(2,{timeout:30000});}finally{await context.setOffline(false);}
});
test('a stale side-zone Menu revision cannot roll back its verified frame inside an unchanged main publication',async({page})=>{
 test.setTimeout(45000);await page.clock.install();const state=await setup(page,'landscape','light',true);await page.clock.pauseAt(new Date(Date.now()+100));
 const next=state.create(1);next.composition!.zones.side=state.create(2).composition!.zones.side;state.set(next);await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await expect(page.getByText('Nieuwe brongegevens volledig gecontroleerd; wisselen na de huidige slide.',{exact:true})).toHaveCount(1);
 await page.clock.fastForward(21000);await page.clock.runFor(1000);
 const fresh=page.locator('[data-player-handoff="first-frame-ready"] [data-menu-content-hash="'+ '2'.repeat(64)+'"]');await expect(fresh).toBeVisible();
 state.set(state.create(1));const requests=state.requests;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect.poll(()=>state.requests).toBeGreaterThan(requests);
 await page.clock.fastForward(21000);await page.clock.runFor(1000);await expect(fresh).toBeVisible();
 await expect(page.locator('[data-player-handoff="first-frame-ready"] [data-menu-content-hash="'+ '1'.repeat(64)+'"]')).toHaveCount(1);
});
