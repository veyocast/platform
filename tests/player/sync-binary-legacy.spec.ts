import{createHash}from'node:crypto';
import{readFileSync}from'node:fs';
import{test,expect,type Page}from'@playwright/test';
import type{PlayerManifestEnvelope}from'../../apps/player/app/_lib/player-manifest';
const origin=`http://127.0.0.1:${process.env.PLAYER_PORT??3106}`,uuid=(n:number)=>`29210000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function setup(page:Page){
 const baseline=await(await page.request.get(origin+'/api/player/manifest?deviceToken=demo-online')).json()as PlayerManifestEnvelope;
 const images=['apps/player/public/assets/sync-icon-192.png','apps/player/public/brand/veyocast-icon-maskable-512.png'].map(path=>{const bytes=readFileSync(path);return{bytes,sha:createHash('sha256').update(bytes).digest('hex')};});
 const release=(revision:number):PlayerManifestEnvelope=>{
  const asset=images[(revision-1)%2]!;
  return{...baseline,device:{...baseline.device,desiredReleaseId:uuid(1)},target:{revision:'1',configRevision:'1',publicationId:uuid(2),assignmentSource:'default',committedAt:new Date().toISOString()},manifest:{...baseline.manifest,schemaVersion:1,releaseId:uuid(1),items:[{...baseline.manifest.items[0]!,id:uuid(3),sourceItemId:uuid(4),kind:'image',fitMode:'contain',durationSeconds:3,accessibilityName:`Bronrevisie ${revision}`,contentHash:'c'.repeat(64),source:{url:`${origin}/binary-source-${revision}.png`,bytes:asset.bytes.length,checksumSha256:asset.sha,mimeType:'image/png'},syncDynamicBinary:{schemaVersion:1,configurationSnapshotId:uuid(5),snapshotId:uuid(5),templateVersionId:uuid(6),configurationHash:'c'.repeat(64),contentHash:String(revision).repeat(64),fallbackChecksumSha256:asset.sha,durationMs:3000,dataRevision:revision}}]}};
 };
 let desired=release(1),offline=false,downloads=0,requests=0;const modes:string[]=[],frames:number[]=[];
 await page.addInitScript(()=>{localStorage.setItem('veyocast.player.deviceToken','a'.repeat(48));localStorage.setItem('veyocast.player.installationCredential','i'.repeat(48));});
 await page.route('**/api/player/installation',route=>route.fulfill({json:{ok:true,bound:true,installationCredential:'i'.repeat(48)}}));
 await page.route('**/api/player/realtime',route=>route.fulfill({status:204}));
 await page.route('**/api/player/manifest*',route=>{requests++;modes.push(route.request().headers()['x-veyocast-sync-dynamic']??'');return offline?route.abort():route.fulfill({json:desired});});
 await page.route('**/api/player/heartbeat',route=>{const body=route.request().postDataJSON();if(body.sourceDataConfirmation?.transport==='binary')frames.push(body.sourceDataConfirmation.dataRevision);return route.fulfill({json:{ok:true}});});
 await page.route('**/binary-source-*.png',route=>{downloads++;const revision=Number(new URL(route.request().url()).pathname.match(/(\d+)\.png$/)![1]);return route.fulfill({body:images[(revision-1)%2]!.bytes,contentType:'image/png'});});
 await page.goto(origin+'/lg/legacy');await expect(page.getByRole('img',{name:'Bronrevisie 1',exact:true})).toBeVisible();await expect.poll(()=>frames.includes(1)).toBe(true);
 return{release,set(value:PlayerManifestEnvelope){desired=value;},setOffline(value:boolean){offline=value;},modes,frames,get downloads(){return downloads;},get requests(){return requests;}};
}
test('the actual standalone LG negotiates binary v1, switches facts at a boundary and retains them offline',async({page,context})=>{
 test.setTimeout(60000);const state=await setup(page);expect(state.modes).toContain('sync-dynamic-binary-v1');
 state.set(state.release(2));await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(page.getByRole('img',{name:'Bronrevisie 2',exact:true})).toBeVisible({timeout:15000});await expect.poll(()=>state.frames.includes(2)).toBe(true);expect(state.downloads).toBe(2);
 state.set(state.release(1));const prior=state.requests;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect.poll(()=>state.requests).toBeGreaterThan(prior);await expect(page.getByRole('img',{name:'Bronrevisie 2',exact:true})).toBeVisible();
 state.setOffline(true);await context.setOffline(true);try{await page.reload();await expect(page.getByRole('img',{name:'Bronrevisie 2',exact:true})).toBeVisible();await expect(page.getByLabel('Pairingcode')).toBeHidden();expect(await page.evaluate(()=>localStorage.getItem('veyocast.player.deviceToken'))).toBe('a'.repeat(48));}finally{await context.setOffline(false);}
});
test('a forged binary metadata checksum cannot replace the verified LG frame',async({page})=>{
 const state=await setup(page),invalid=state.release(2);invalid.manifest.items[0]!.syncDynamicBinary!.fallbackChecksumSha256='f'.repeat(64);state.set(invalid);
 const prior=state.requests;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect.poll(()=>state.requests).toBeGreaterThan(prior);await page.waitForTimeout(1000);
 await expect(page.getByRole('img',{name:'Bronrevisie 1',exact:true})).toBeVisible();expect(state.frames).not.toContain(2);expect(state.downloads).toBe(1);
});
test('LG retains the previous painted dataset of the same release when the active cache is damaged',async({page,context})=>{
 const state=await setup(page);state.set(state.release(2));await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await expect(page.getByRole('img',{name:'Bronrevisie 2',exact:true})).toBeVisible({timeout:15000});await expect.poll(()=>state.frames.includes(2)).toBe(true);
 const checksum=state.release(2).manifest.items[0]!.source.checksumSha256;
 const removed=await page.evaluate(async sha=>{let count=0;for(const name of await caches.keys()){const cache=await caches.open(name);for(const request of await cache.keys())if(request.url.includes(sha)&&await cache.delete(request))count++;}return count;},checksum);expect(removed).toBeGreaterThan(0);
 state.setOffline(true);await context.setOffline(true);try{await page.reload();await expect(page.getByRole('img',{name:'Bronrevisie 1',exact:true})).toBeVisible();await expect(page.getByLabel('Pairingcode')).toBeHidden();expect(await page.evaluate(()=>localStorage.getItem('veyocast.player.deviceToken'))).toBe('a'.repeat(48));}finally{await context.setOffline(false);}
});
