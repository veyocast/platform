import {expect,test,type Page}from"@playwright/test";
import{createHash}from"node:crypto";
import{readFileSync}from"node:fs";
import type{PlayerManifestEnvelope}from"../../apps/player/app/_lib/player-manifest";
const origin=`http://127.0.0.1:${process.env.PLAYER_PORT??3106}`;
const video=readFileSync("apps/player/public/lg-probe/h264-baseline-aac.mp4");
const sha=createHash("sha256").update(video).digest("hex");
const image='<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="1080" height="1920" fill="#155fac"/></svg>';
const replacementImage=image.replace("#155fac","#008844");
const replacementImageSha=createHash("sha256").update(replacementImage).digest("hex");
const imageSha=createHash("sha256").update(image).digest("hex");
type Report={activeReleaseId?:string;desiredReleaseId?:string;lastPlaybackError?:{code:string;action:string;recoveredAt?:string};syncPhase?:string;syncRetryAcknowledgedAt?:string;videoProbe?:{code:string}};
async function fixture(page:Page,policy:"paintable"|"blob-fails"|"local-fails"|"all-fail",previousVideo=false,initialVideo=false,mixedRelease=false){
 const base=await(await page.request.get(`${origin}/api/player/manifest?deviceToken=demo-online`)).json()as PlayerManifestEnvelope;
 const delivered=previousVideo?Buffer.concat([video,Buffer.from([0,0,0,8,102,114,101,101])]):video;
 const deliveredSha=createHash("sha256").update(delivered).digest("hex");
 const old:PlayerManifestEnvelope={...base,device:{...base.device,desiredReleaseId:"old-menu"},manifest:{...base.manifest,releaseId:"old-menu",items:[{...base.manifest.items[0]!,id:"menu",kind:"image",durationSeconds:5,source:{url:`${origin}/compat-menu.svg`,bytes:Buffer.byteLength(image),mimeType:"image/svg+xml",checksumSha256:imageSha}}]}};
 if(previousVideo)old.manifest.items=[{...old.manifest.items[0]!,id:"good-video",kind:"video",source:{url:`${origin}/compat-good.mp4`,bytes:video.length,mimeType:"video/mp4",checksumSha256:sha}}];
 const next:PlayerManifestEnvelope={...old,device:{...old.device,desiredReleaseId:"new-video"},manifest:{...old.manifest,releaseId:"new-video",items:[{...old.manifest.items[0]!,id:"video",kind:"video",durationSeconds:30,source:{url:`${origin}/compat-video.mp4`,bytes:delivered.length,mimeType:"video/mp4",checksumSha256:deliveredSha}}]}};
 if(mixedRelease)old.manifest.items.push({...next.manifest.items[0]!,id:"old-rejected-video"});
 let desired=initialVideo?next:old;let downloads=0;let syncReceipt:string|null=null;const reports:Report[]=[];
 await page.addInitScript(mode=>{
  localStorage.setItem("veyocast.player.deviceToken","a".repeat(48));localStorage.setItem("veyocast.player.installationCredential","i".repeat(48));
  const state=window as unknown as{videoAttempts:Array<{scheme:string;paintable:boolean;cover:string}>};state.videoAttempts=[];
  const sizes=new Map<string,number>();const createUrl=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=createUrl(blob);if(blob instanceof Blob)sizes.set(url,blob.size);return url;};
  const descriptor=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,"src")!;
  Object.defineProperty(HTMLMediaElement.prototype,"src",{...descriptor,set(value:string){
   if(this instanceof HTMLVideoElement&&value){
    const style=getComputedStyle(this),bounds=this.getBoundingClientRect();const paintable=style.visibility!=="hidden"&&Number(style.opacity)>0&&bounds.width>0&&bounds.height>0;
    state.videoAttempts.push({scheme:value.startsWith("blob:")?"blob":value.includes("/__veyocast-player-cache/")?"cache":"native",paintable,cover:document.elementsFromPoint(innerWidth/2,innerHeight/2)[0]?.tagName??""});
    const rejectedSource=!mode.previousVideo||value.includes(mode.blockedSha)||value.includes("compat-video.mp4")||sizes.get(value)===mode.blockedSize;
    if(mode.policy==="local-fails"&&(value.startsWith("blob:")||value.includes("/__veyocast-player-cache/"))||mode.policy==="all-fail"&&rejectedSource||mode.policy==="blob-fails"&&value.startsWith("blob:")||mode.policy==="paintable"&&!paintable){
     Object.defineProperty(this,"error",{configurable:true,get:()=>({code:4})});queueMicrotask(()=>this.dispatchEvent(new Event("error")));return;
    }
   }
   descriptor.set!.call(this,value);
  }});
 },{policy,previousVideo,blockedSha:deliveredSha,blockedSize:delivered.length});
 await page.route("**/api/player/installation",route=>route.fulfill({json:{ok:true,bound:true,installationCredential:"i".repeat(48)}}));
 await page.route("**/api/player/realtime",route=>route.fulfill({status:204}));
 await page.route("**/api/player/commands",route=>route.fulfill({json:{ok:true,commands:[],serverTime:new Date().toISOString()}}));
 await page.route("**/api/player/manifest*",route=>route.fulfill({json:desired}));
 await page.context().route("**/compat-replacement.svg",route=>route.fulfill({body:replacementImage,contentType:"image/svg+xml"}));
 await page.context().route("**/compat-menu.svg",route=>route.fulfill({body:image,contentType:"image/svg+xml"}));
 await page.context().route("**/compat-video.mp4",route=>{downloads++;return route.fulfill({body:delivered,contentType:"video/mp4"});});
 await page.context().route("**/compat-good.mp4",route=>route.fulfill({body:video,contentType:"video/mp4"}));
 await page.route("**/api/player/heartbeat",route=>{const body=route.request().postDataJSON();reports.push(body);if(body.syncRetryAcknowledgedAt===syncReceipt)syncReceipt=null;return route.fulfill({json:{ok:true,syncRetryRequestedAt:syncReceipt}});});
 await page.goto(`${origin}/lg/legacy`);
 if(!initialVideo)await expect.poll(()=>reports.some(body=>body.activeReleaseId==="old-menu")).toBe(true);
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener("controllerchange",()=>resolve(),{once:true}));});
 return{reports,publishImage:async()=>{desired={...old,device:{...old.device,desiredReleaseId:"new-image"},manifest:{...old.manifest,releaseId:"new-image",items:[{...old.manifest.items[0]!,id:"new-image-item",kind:"image",source:{url:`${origin}/compat-replacement.svg`,bytes:Buffer.byteLength(replacementImage),mimeType:"image/svg+xml",checksumSha256:replacementImageSha}}]}};await page.evaluate(()=>window.dispatchEvent(new Event("online")));},getDownloads:()=>downloads,requestSync:async()=>{syncReceipt="2026-10-16T01:00:00.123456+00:00";await page.evaluate(()=>window.dispatchEvent(new Event("online")));},publishAgain:async()=>{desired={...next,device:{...next.device,desiredReleaseId:"new-video-2"},manifest:{...next.manifest,releaseId:"new-video-2"}};await page.evaluate(()=>window.dispatchEvent(new Event("online")));},publish:async()=>{desired=next;await page.evaluate(()=>window.dispatchEvent(new Event("online")));}};
}
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus)console.log(JSON.stringify(await page.evaluate(()=>({attempts:(window as unknown as{videoAttempts:unknown}).videoAttempts,diagnostics:localStorage.getItem("veyocast.player.lgLegacyDiagnostics.v1"),text:document.body.innerText.slice(-1200)}))));});
test("LG prepares a paintable video underneath the last menu before confirming its first frame",async({page})=>{
 const run=await fixture(page,"paintable");await run.publish();
 await expect.poll(()=>run.reports.some(body=>body.activeReleaseId==="new-video"),{timeout:12000}).toBe(true);
 const attempts=await page.evaluate(()=>(window as unknown as{videoAttempts:Array<{paintable:boolean;cover:string}>}).videoAttempts);
 expect(attempts[0]).toMatchObject({paintable:true,cover:"IMG"});
 expect(run.getDownloads()).toBe(1);await expect(page.locator("video.visible:not(.retiring)")).toBeVisible();
});
test("LG retries a rejected Blob using verified local Range bytes and restores that video offline",async({page,context})=>{
 const run=await fixture(page,"blob-fails");await run.publish();
 await expect.poll(()=>run.reports.some(body=>body.activeReleaseId==="new-video"),{timeout:12000}).toBe(true);
 await expect(page.locator("video.visible:not(.retiring)")).toHaveAttribute("src",`/__veyocast-player-cache/${sha}`);
 expect(run.getDownloads()).toBe(1);
 await page.route("**/api/player/**",route=>route.abort("internetdisconnected"));await context.setOffline(true);await page.reload();
 await expect(page.locator("video.visible:not(.retiring)")).toHaveAttribute("src",`/__veyocast-player-cache/${sha}`);
 await expect.poll(()=>page.locator("video.visible:not(.retiring)").evaluate((v:HTMLVideoElement)=>v.currentTime),{timeout:8000}).toBeGreaterThan(0);
 expect(run.getDownloads()).toBe(1);
});
test("LG preserves the verified previous menu after all video transports fail, including offline startup",async({page,context})=>{
 const run=await fixture(page,"all-fail");await run.publish();
 await expect.poll(()=>run.reports.some(body=>body.lastPlaybackError?.action.includes("media_4")),{timeout:12000}).toBe(true);
 await expect(page.locator("#media-root img.visible").first()).toBeVisible();
 await expect.poll(()=>run.reports.at(-1)?.desiredReleaseId).toBe("new-video");
 await expect.poll(()=>run.reports.at(-1)?.activeReleaseId).toBe("old-menu");
 await page.waitForTimeout(6000);
 const attempts=await page.evaluate(()=>(window as unknown as{videoAttempts:unknown[]}).videoAttempts.length);expect(attempts).toBe(6);
 expect(run.getDownloads()).toBe(1);
 await run.requestSync();
 await expect.poll(()=>run.reports.some(body=>body.syncRetryAcknowledgedAt==="2026-10-16T01:00:00.123456+00:00")).toBe(true);
 await expect.poll(()=>page.evaluate(()=>(window as unknown as{videoAttempts:unknown[]}).videoAttempts.length),{timeout:10000}).toBe(12);
 await page.route("**/api/player/**",route=>route.abort("internetdisconnected"));await context.setOffline(true);await page.reload();await expect(page.locator("#media-root img.visible").first()).toBeVisible();
 await expect(page.locator("#status")).toBeHidden();
});

test("an authorized one-time LG diagnostic command returns to playback and retains only a bounded report",async({page})=>{
 const run=await fixture(page,"paintable");const phases:string[]=[];let complete=false;const visited:string[]=[];
 page.on("framenavigated",frame=>{if(frame===page.mainFrame())visited.push(frame.url());});
 await page.route("**/api/player/commands",route=>{
  if(route.request().method()==="GET")return route.fulfill({json:{ok:true,serverTime:new Date().toISOString(),commands:complete?[]:[{id:"diagnostic-command",nonce:"diagnostic-once",commandType:"RELOAD_PLAYER",createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),payload:{view:"video-diagnostics"}}]}});
  const body=route.request().postDataJSON();phases.push(body.phase);if(body.phase==="completed")complete=true;return route.fulfill({json:{ok:true,commandType:"RELOAD_PLAYER"}});
 });
 await expect.poll(()=>visited.some(url=>url.endsWith("/lg/probe?returnToPlayer=1")),{timeout:15000}).toBe(true);
 await expect.poll(()=>run.reports.some(body=>Boolean(body.videoProbe?.code)),{timeout:15000}).toBe(true);
 await expect(page).toHaveURL(`${origin}/lg/legacy`,{timeout:10000});
 expect(phases).toEqual(["acknowledged","completed"]);
 expect(await page.evaluate(()=>localStorage.getItem("veyocast.player.deviceToken"))).toBe("a".repeat(48));
 await expect(page.locator("#media-root img.visible").first()).toBeVisible();
});


test("a different verified previous video remains eligible for offline last-known-good",async({page,context})=>{
 const run=await fixture(page,"all-fail",true);await run.publish();
 await expect.poll(()=>run.reports.some(body=>body.lastPlaybackError?.action.includes("media_4")),{timeout:12000}).toBe(true);
 await expect.poll(()=>run.reports.at(-1)?.activeReleaseId).toBe("old-menu");
 await expect(page.locator("video.visible:not(.retiring)").last()).toBeVisible();
 await page.route("**/api/player/**",route=>route.abort("internetdisconnected"));await context.setOffline(true);await page.reload();
 await expect(page.locator("video.visible:not(.retiring)").last()).toBeVisible();
 await expect.poll(()=>page.locator("video.visible:not(.retiring)").last().evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(0);
});


test("several unpresented video publications cannot overwrite the previous working release",async({page,context})=>{
 const run=await fixture(page,"all-fail");await run.publish();
 await expect.poll(()=>page.evaluate(()=>(window as unknown as{videoAttempts:unknown[]}).videoAttempts.length),{timeout:12000}).toBe(6);
 await run.publishAgain();
 await expect.poll(()=>run.reports.at(-1)?.desiredReleaseId).toBe("new-video-2");
 await expect.poll(()=>page.evaluate(()=>(window as unknown as{videoAttempts:unknown[]}).videoAttempts.length),{timeout:10000}).toBe(12);
 await page.route("**/api/player/**",route=>route.abort("internetdisconnected"));await context.setOffline(true);await page.reload();
 await expect(page.locator("#media-root img.visible").first()).toBeVisible();
 await expect(page.locator("#status")).toBeHidden();
 expect(run.getDownloads()).toBe(1);
});


test("a cold pending video keeps the startup status painted above its decoder surface",async({page})=>{
 await page.addInitScript(()=>{HTMLMediaElement.prototype.play=()=>new Promise<void>(()=>{});});
 await fixture(page,"paintable",false,true);
 await expect(page.locator("#media-root video")).toBeAttached();
 await expect(page.locator("#status")).toBeVisible();
 expect(await page.evaluate(()=>Boolean(document.elementFromPoint(innerWidth/2,innerHeight/2)?.closest("#status")))).toBe(true);
 expect(await page.locator("#media-root video").evaluate(element=>getComputedStyle(element).visibility)).toBe("visible");
});


test("a verified image publication escapes a terminal video failure without a remaining item timer",async({page,context})=>{
 const run=await fixture(page,"all-fail",false,false,true);
 await expect.poll(()=>page.evaluate(()=>(window as unknown as{videoAttempts:unknown[]}).videoAttempts.length),{timeout:15000}).toBe(6);
 await expect.poll(()=>run.reports.at(-1)?.syncPhase).toBe("failed");
 await run.publishImage();
 await expect.poll(()=>run.reports.some(body=>body.activeReleaseId==="new-image"),{timeout:8000}).toBe(true);
 await expect(page.locator("#media-root img.visible:not(.retiring)")).toBeVisible();
 await expect.poll(()=>run.reports.at(-1)?.lastPlaybackError?.recoveredAt).toBeTruthy();
 await page.route("**/api/player/**",route=>route.abort("internetdisconnected"));
 await context.setOffline(true);await page.reload();
 await expect(page.locator("#media-root img.visible:not(.retiring)")).toBeVisible();
 await expect(page.locator("#status")).toBeHidden();
});


test("a healthy LG video keeps its own boundary when a new verified image is ready",async({page})=>{
 const run=await fixture(page,"all-fail",true);
 const active=page.locator("video.visible:not(.retiring)");
 await active.evaluate((video:HTMLVideoElement)=>{video.playbackRate=0.1;video.setAttribute("data-before-publication","true");});
 await run.publishImage();
 await expect.poll(()=>run.reports.some(body=>body.desiredReleaseId==="new-image"&&body.syncPhase==="switch_pending")).toBe(true);
 await page.waitForTimeout(500);
 expect(run.reports.some(body=>body.activeReleaseId==="new-image")).toBe(false);
 await expect(page.locator('video[data-before-publication="true"]')).toBeVisible();
 await active.evaluate(video=>video.dispatchEvent(new Event("ended")));
 await expect.poll(()=>run.reports.some(body=>body.activeReleaseId==="new-image")).toBe(true);
 await expect(page.locator("#media-root img.visible:not(.retiring)")).toBeVisible();
});


test("recovery waits for a paused goal overlay and resumes after it expires",async({page})=>{
 const run=await fixture(page,"all-fail",false,false,true);
 await expect.poll(()=>page.evaluate(()=>(window as unknown as{videoAttempts:unknown[]}).videoAttempts.length),{timeout:15000}).toBe(6);
 await expect.poll(()=>run.reports.at(-1)?.syncPhase).toBe("failed");
 let sent=false;
 await page.route("**/api/player/realtime/ack",route=>route.fulfill({json:{ok:true}}));
 await page.route("**/api/player/realtime",route=>{
  if(sent)return route.fulfill({status:204});
  sent=true;const now=Date.now();
  const goal={id:"11111111-1111-4111-8111-000000000225",assets:[],executeAt:new Date(now+100).toISOString(),expiresAt:new Date(now+15000).toISOString(),serverTime:new Date(now).toISOString(),payload:{
   eventId:"22222222-2222-4222-8222-000000000225",design:{headline:"GOAL!",palette:"ink-black",animation:"none"},durationMs:3000,underlayPolicy:"pause",scoringSide:"own",homeScore:1,awayScore:0,previousHomeScore:0,previousAwayScore:0
  }};
  return route.fulfill({body:`event: goal\ndata: ${JSON.stringify(goal)}\n\n`,contentType:"text/event-stream"});
 });
 await page.evaluate(()=>window.dispatchEvent(new Event("online")));
 await expect(page.locator("#goal-overlay")).toBeVisible();
 await run.publishImage();
 await expect.poll(()=>run.reports.some(body=>body.desiredReleaseId==="new-image")).toBe(true);
 await expect(page.locator("#goal-overlay")).toBeVisible();
 expect(run.reports.some(body=>body.activeReleaseId==="new-image")).toBe(false);
 await expect(page.locator("#goal-overlay")).toBeHidden({timeout:5000});
 await expect.poll(()=>run.reports.some(body=>body.activeReleaseId==="new-image"),{timeout:5000}).toBe(true);
});


test("LG uses its authorized immutable source after both verified local video transports fail and restores the local image offline",async({page,context})=>{
 const run=await fixture(page,"local-fails");await run.publish();
 await expect.poll(()=>run.reports.some(body=>body.activeReleaseId==="new-video"),{timeout:12000}).toBe(true);
 await expect(page.locator("video.visible:not(.retiring)")).toHaveAttribute("src",`${origin}/compat-video.mp4`);
 await expect.poll(()=>page.locator("video.visible:not(.retiring)").evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(0);
 await page.route("**/api/player/**",route=>route.abort("internetdisconnected"));
 await context.setOffline(true);
 await expect(page.locator("#media-root img.visible:not(.retiring)")).toBeVisible();
 await page.reload();
 await expect(page.locator("#media-root img.visible:not(.retiring)")).toBeVisible();
 await expect(page.locator("#status")).toBeHidden();
});


test("two presented native HTTP publications never replace the locally playable previous release",async({page,context})=>{
 const run=await fixture(page,"local-fails");await run.publish();
 await expect.poll(()=>run.reports.some(body=>body.activeReleaseId==="new-video"),{timeout:12000}).toBe(true);
 await run.publishAgain();
 await expect.poll(()=>run.reports.some(body=>body.activeReleaseId==="new-video-2"),{timeout:12000}).toBe(true);
 await page.route("**/api/player/**",route=>route.abort("internetdisconnected"));await context.setOffline(true);await page.reload();
 await expect(page.locator("#media-root img.visible:not(.retiring)")).toBeVisible();
 await expect(page.locator("#status")).toBeHidden();
});
