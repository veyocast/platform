import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {test,expect,type Page} from '@playwright/test';
import {syncSlideRendererAssets,syncOnzeTrotsSystemAssets,syncSlidePresentationSchema,type PlayerDynamicTemplateAsset} from '@veyocast/contracts';
import {measureSyncOnzeTrotsV9Layout,measureSyncOnzeTrotsLayout,projectSyncOnzeTrotsMotion,applySyncOnzeTrotsMotion} from '@veyocast/content-templates/sync-slide-static-view';
import type {PlayerManifestEnvelope} from '../../apps/player/app/_lib/player-manifest';
import type {SyncDynamicRenderArtifact} from '../../apps/media-worker/src/sync-dynamic-render';

const playerURL=`http://127.0.0.1:${process.env.PLAYER_PORT??3106}`;
const id=(n:number)=>`28500000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function activeId(page:Page){return page.evaluate(()=>new Promise<string>((resolve,reject)=>{const open=indexedDB.open('veyocast-player-cache-v1');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,read=db.transaction('activeReleases').objectStore('activeReleases').get('demo-online');read.onerror=()=>reject(read.error);read.onsuccess=()=>{db.close();resolve(read.result?.envelope.manifest.releaseId??'');};};}));}

test('the full canonical motion export agrees with DOM time, survives cold offline startup and remains the complete older-Player fallback',async({page,context,browser,browserName},info)=>{
 test.setTimeout(60000);
 expect(browserName).toBe('chromium');
 const directory=process.env.S286_ONZETROTS_BINARIES;
 if(!directory)throw Error('Produce the complete canonical OnzeTrots export with tests/helpers/sync-onzetrots-export.ts before the Player browser cohort');
 const metadata=JSON.parse(readFileSync(join(directory,'artifact.json'),'utf8'));
 const artifact:SyncDynamicRenderArtifact={...metadata,bytes:readFileSync(join(directory,'standings-full.mp4')),presentation:syncSlidePresentationSchema.parse(JSON.parse(readFileSync(join(directory,'presentation.json'),'utf8'))),poster:{...metadata.poster,bytes:readFileSync(join(directory,'standings-poster.png'))}};
 const assets=JSON.parse(readFileSync(join(directory,'assets.json'),'utf8'))as Record<string,PlayerDynamicTemplateAsset>,images=new Map(Object.keys(assets).map(id=>[id,readFileSync(join(directory,`${id}.png`))]));
 expect(createHash('sha256').update(artifact.bytes).digest('hex')).toBe(artifact.checksumSha256);
 expect(artifact).toMatchObject({mimeType:'video/mp4',durationMs:40000,width:1920,height:1080});
 const response=await page.request.get(`${playerURL}/api/player/manifest?deviceToken=demo-online`);
 expect(response.ok()).toBe(true);
 const value=await response.json()as PlayerManifestEnvelope,item=value.manifest.items[0]!;
 value.manifest.items=[item];
 Object.assign(item,{id:id(101),kind:'video',durationSeconds:40,title:'Goedgekeurde volledige ranglijst',syncStudioPresentation:artifact.presentation,syncStudioDurationMs:40000,syncStudioAssets:Object.fromEntries(Object.entries(assets).map(([key,asset])=>[key,{...asset,url:`${playerURL}/s285-approved/${key}.png`}])),source:{url:`${playerURL}/s285-approved/complete.mp4`,mimeType:'video/mp4',bytes:artifact.byteLength,checksumSha256:artifact.checksumSha256,posterUrl:`${playerURL}/s285-approved/poster.png`,posterBytes:artifact.poster.byteLength,posterChecksumSha256:artifact.poster.checksumSha256}});
 item.syncDynamic={schemaVersion:1,configurationSnapshotId:id(201),snapshotId:id(202),templateVersionId:id(203),configurationHash:'c'.repeat(64),contentHash:'d'.repeat(64),fallbackChecksumSha256:artifact.checksumSha256,durationMs:40000,presentation:artifact.presentation,assets:item.syncStudioAssets??{},dataRevision:1};
 delete item.syncStudioPresentation;delete item.syncStudioDurationMs;delete item.syncStudioAssets;
 value.manifest.syncSystemAssets=syncSlideRendererAssets(artifact.presentation).map(asset=>({path:asset.path,checksumSha256:asset.sha256,bytes:asset.bytes,mimeType:asset.mimeType}));
 Object.assign(value.manifest,{releaseId:id(1),version:1,label:'OnzeTrots acceptatie',manifestHash:createHash('sha256').update(JSON.stringify(artifact.presentation)).digest('hex'),totalDurationSeconds:40,totalBytes:artifact.byteLength+artifact.poster.byteLength+Object.values(assets).reduce((sum,asset)=>sum+asset.bytes,0)+value.manifest.syncSystemAssets.reduce((sum,asset)=>sum+asset.bytes,0)});
 value.device.desiredReleaseId=value.manifest.releaseId;
 let offlineMode=false;
 await context.route('**/s285-approved/*',route=>{if(offlineMode)return route.abort();const name=new URL(route.request().url()).pathname.split('/').at(-1)!;if(name==='complete.mp4')return route.fulfill({body:Buffer.from(artifact.bytes),contentType:'video/mp4'});if(name==='poster.png')return route.fulfill({body:Buffer.from(artifact.poster.bytes),contentType:'image/png'});const bytes=images.get(name.replace(/\.png$/,''));return bytes?route.fulfill({body:bytes,contentType:'image/png'}):route.abort();});
 let current=value;const headers:Record<string,string>[]=[];
 await context.route('**/api/player/manifest*',route=>{if(offlineMode)return route.abort();headers.push(route.request().headers());return route.fulfill({json:current});});
 await page.goto(`${playerURL}/?deviceToken=demo-online&syncMs=250`);
 await expect(page.locator('[data-player-handoff="first-frame-ready"]')).toBeAttached();
 await expect(page.locator('.rank-row')).toHaveCount(14);await expect(page.locator('.rank-row.own')).toHaveCount(1);
 expect(headers[0]?.['x-veyocast-sync-onzetrots-v9']).toBe('sync-onzetrots-v9');expect(await activeId(page)).toBe(id(1));
 await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));
 const layouts=await page.evaluate(measureSyncOnzeTrotsLayout);
 const decoderContext=await browser.newContext(),decoder=await decoderContext.newPage(),decoderOrigin='http://127.0.0.1:3384';
 await decoder.route(decoderOrigin+'/**',route=>new URL(route.request().url()).pathname==='/complete.mp4'?route.fulfill({body:Buffer.from(artifact.bytes),contentType:'video/mp4'}):route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
 await decoder.goto(decoderOrigin);
 const video=await decoder.evaluate(async url=>{const element=document.createElement('video');element.id='s285-export-frame';element.muted=true;element.src=URL.createObjectURL(new Blob([await(await fetch(url)).arrayBuffer()],{type:'video/mp4'}));element.style.cssText='position:fixed;right:0;bottom:0;width:192px;height:108px;z-index:999999';document.body.append(element);await new Promise<void>((resolve,reject)=>{element.onloadeddata=()=>resolve();element.onerror=()=>reject(Error('Complete MP4 decode failed'));});return{width:element.videoWidth,height:element.videoHeight,duration:element.duration};},decoderOrigin+'/complete.mp4');
 expect(video).toEqual({width:1920,height:1080,duration:40});
 for(const elapsed of [4000,9000,20000,39000]){
  const decodedAt=await decoder.evaluate(async time=>{const element=document.querySelector<HTMLVideoElement>('#s285-export-frame')!;const presented=new Promise<number>(resolve=>{const receive=(_now:number,metadata:VideoFrameCallbackMetadata)=>{if(metadata.mediaTime>=time/1000)resolve(metadata.mediaTime);else element.requestVideoFrameCallback(receive);};element.requestVideoFrameCallback(receive);});element.currentTime=time/1000;await element.play();const actual=await presented;element.pause();return actual;},elapsed);
  await page.evaluate(applySyncOnzeTrotsMotion,projectSyncOnzeTrotsMotion(decodedAt*1000,layouts,'normal',false,{panelCount:await page.evaluate(measureSyncOnzeTrotsV9Layout,undefined),mode:'light',paused:false,introFinished:false,entranceAllowed:true}));
  const dom=await page.locator('.rank-row.own').evaluate(element=>{const box=element.getBoundingClientRect(),canvas=element.closest('.ot-approved-canvas')!.getBoundingClientRect();return{top:(box.top-canvas.top)*1080/canvas.height,bottom:(box.bottom-canvas.top)*1080/canvas.height};});
  const frame=await decoder.evaluate(()=>{const element=document.querySelector<HTMLVideoElement>('#s285-export-frame')!;const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;const ctx=canvas.getContext('2d')!;ctx.drawImage(element,0,0);const data=ctx.getImageData(0,0,1920,1080).data,blue:number[]=[];for(let y=0;y<1080;y++){if([150,800,1700].every(x=>{const i=(y*1920+x)*4;const r=data[i]!,g=data[i+1]!,b=data[i+2]!;return b>150&&b-r>80&&b-g>50;}))blue.push(y);}return{top:Math.min(...blue),bottom:Math.max(...blue)+1,png:canvas.toDataURL('image/png')};});
  // Classify the blue silhouette, including the approved translucent inset
  // border, rather than only its solid-color interior. H.264 can blend the
  // boundary pixel; geometry is checked
  // at native output size, not by increasing a screenshot difference tolerance.
  await info.attach(`decoded-export-${elapsed}ms`,{body:Buffer.from(frame.png.split(',')[1]!,'base64'),contentType:'image/png'});
  expect(Math.abs(frame.top-dom.top),JSON.stringify({elapsed,dom,frame:{top:frame.top,bottom:frame.bottom}})).toBeLessThanOrEqual(2);expect(Math.abs(frame.bottom-dom.bottom)).toBeLessThanOrEqual(2);
 }
 await decoderContext.close();await page.clock.resume();
 const pending=structuredClone(value),background=syncOnzeTrotsSystemAssets.find(asset=>asset.path.includes('de-wijk-wide'))!;
 expect(background).toBeDefined();
 const pendingItem=pending.manifest.items[0]!;
 pendingItem.syncDynamic!.presentation={...artifact.presentation,style:{...artifact.presentation.style,background:'photo',backgroundAsset:{kind:'system',path:background.path,checksumSha256:background.sha256}}};
 pending.manifest.syncSystemAssets=syncSlideRendererAssets(pendingItem.syncDynamic!.presentation).map(asset=>({path:asset.path,checksumSha256:asset.sha256,bytes:asset.bytes,mimeType:asset.mimeType}));
 pending.manifest.totalBytes=artifact.byteLength+artifact.poster.byteLength+Object.values(assets).reduce((sum,asset)=>sum+asset.bytes,0)+pending.manifest.syncSystemAssets.reduce((sum,asset)=>sum+asset.bytes,0);
 pending.manifest.releaseId=id(2);pending.manifest.version=2;pending.manifest.manifestHash='b'.repeat(64);pending.device.desiredReleaseId=id(2);
 let corruptRequests=0;
 await context.route(`**${background.path}`,route=>{if(offlineMode)return route.abort();corruptRequests++;const bytes=Buffer.from(readFileSync(join(process.cwd(),'apps/player/public',background.path)));bytes[20]=bytes[20]!^1;return route.fulfill({body:bytes,contentType:background.mimeType});});
 current=pending;await expect.poll(()=>corruptRequests,{timeout:11000}).toBeGreaterThan(0);expect(await activeId(page)).toBe(id(1));await expect(page.locator('.rank-row.own')).toBeVisible();
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});offlineMode=true;await context.setOffline(true);await page.close();
 const cold=await context.newPage();await cold.goto(`${playerURL}/?deviceToken=demo-online&syncMs=250`);await expect(cold.locator('[data-player-handoff="first-frame-ready"]')).toBeAttached();await expect(cold.locator('.rank-row')).toHaveCount(14);expect(await activeId(cold)).toBe(id(1));
 await cold.close();offlineMode=false;await context.setOffline(false);
 const older=await context.newPage();await older.addInitScript(()=>{const supports=CSS.supports.bind(CSS);CSS.supports=(key:string,setting?:string)=>key==='filter'&&setting==='blur(1px)'?false:setting===undefined?supports(key):supports(key,setting);});
 await older.goto(`${playerURL}/?deviceToken=demo-online&syncMs=250`);await expect(older.locator('video').first()).toBeVisible();await expect(older.locator('.ot-approved-frame')).toHaveCount(0);
 expect(await older.locator('video').first().evaluate(element=>({width:element.videoWidth,height:element.videoHeight,duration:element.duration,source:element.currentSrc}))).toMatchObject({width:1920,height:1080,duration:40,source:expect.stringMatching(/blob:|__veyocast-player-cache/)});
 await older.locator('video').first().evaluate(async element=>{element.currentTime=39.5;await element.play();});await expect.poll(()=>older.locator('video').first().evaluate(element=>element.currentTime),{timeout:5000}).toBeLessThan(5);
 await info.attach('actual-worker-metadata',{path:join(directory,'artifact.json'),contentType:'application/json'});
});
