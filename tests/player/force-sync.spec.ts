import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { PlayerManifestEnvelope } from "../../apps/player/app/_lib/player-manifest";
const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const bytes = readFileSync("apps/player/public/lg-probe/h264-baseline-aac.mp4");
const receipt = "2026-10-15T23:00:01.123456+00:00";
for (const platform of ["browser", "static-lg"] as const) {
  test(`${platform}: force sync bypasses conditional access and preserves the verified playing video`, async ({page}) => {
    const baseline = await (await page.request.get(`${playerURL}/api/player/manifest?deviceToken=demo-online`)).json() as PlayerManifestEnvelope;
    const envelope = { ...baseline, manifest: {...baseline.manifest, items: [{...baseline.manifest.items[0]!,id:"sync-video",kind:"video",durationSeconds:60,source:{url:`${playerURL}/sync-video.mp4`,mimeType:"video/mp4",bytes:bytes.length,checksumSha256:createHash("sha256").update(bytes).digest("hex")}}]} };
    const headers: (string|undefined)[]=[]; const acknowledgements: string[]=[]; let downloads=0; let issued=false; let received=false;
    await page.addInitScript(() => {localStorage.setItem("veyocast.player.deviceToken","a".repeat(48));localStorage.setItem("veyocast.player.installationCredential","i".repeat(48));});
    await page.route("**/api/player/installation", route=>route.fulfill({json:{ok:true,bound:true,installationCredential:"i".repeat(48)}}));
    await page.route("**/api/player/realtime",route=>route.fulfill({status:204}));
    await page.route("**/api/player/manifest*",route=>{headers.push(route.request().headers()["if-none-match"]);return route.fulfill({json:envelope,headers:{ETag:'"sync-release"'}});});
    await page.route("**/sync-video.mp4",route=>{if(["fetch","xhr"].includes(route.request().resourceType()))downloads++;return route.fulfill({body:bytes,contentType:"video/mp4"});});
    await page.route("**/api/player/heartbeat",async route=>{
      const body=route.request().postDataJSON();
      if(body.syncRetryAcknowledgedAt) {acknowledgements.push(body.syncRetryAcknowledgedAt);received=true;}
      if(body.activeReleaseId && !issued){issued=true;await page.locator("video").last().evaluate((video:HTMLVideoElement)=>{video.setAttribute("data-playing-before-sync","true");video.playbackRate=0.1;});}
      return route.fulfill({json:{ok:true,syncRetryRequestedAt:issued&&!received?receipt:null}});
    });
    await page.goto(platform==="browser"?`${playerURL}/?syncMs=60000`:`${playerURL}/lg/legacy`);
    await expect.poll(()=>acknowledgements.includes(receipt),{timeout:10000}).toBe(true);
    expect(headers.length).toBeGreaterThanOrEqual(2);expect(headers.at(-1)).toBeUndefined();
    await expect(page.locator('video[data-playing-before-sync="true"]')).toBeVisible();
    expect(downloads).toBe(1);
  });
}

test("static-lg: a new video publication presents real progressing frames when playing is absent",async({page})=>{
  const baseline=await(await page.request.get(`${playerURL}/api/player/manifest?deviceToken=demo-online`)).json()as PlayerManifestEnvelope;
  const image={...baseline,device:{...baseline.device,desiredReleaseId:"old-menu"},manifest:{...baseline.manifest,releaseId:"old-menu",items:[{...baseline.manifest.items[0]!,durationSeconds:5}]}};
  const video={...image,device:{...image.device,desiredReleaseId:"new-video"},manifest:{...image.manifest,releaseId:"new-video",items:[{...image.manifest.items[0]!,id:"new-video-item",kind:"video",source:{url:`${playerURL}/new-video.mp4`,mimeType:"video/mp4",bytes:bytes.length,checksumSha256:createHash("sha256").update(bytes).digest("hex")}}]}};
  let desired:unknown=image;const shown:string[]=[];
  await page.addInitScript(()=>{localStorage.setItem("veyocast.player.deviceToken","a".repeat(48));localStorage.setItem("veyocast.player.installationCredential","i".repeat(48));Object.defineProperty(HTMLMediaElement.prototype,"onplaying",{configurable:true,set(){},get(){return null;}});});
  await page.route("**/api/player/installation",route=>route.fulfill({json:{ok:true,bound:true,installationCredential:"i".repeat(48)}}));
  await page.route("**/api/player/realtime",route=>route.fulfill({status:204}));
  await page.route("**/api/player/manifest*",route=>route.fulfill({json:desired}));
  await page.route("**/new-video.mp4",route=>route.fulfill({body:bytes,contentType:"video/mp4"}));
  await page.route("**/api/player/heartbeat",route=>{const body=route.request().postDataJSON();if(body.activeReleaseId)shown.push(body.activeReleaseId);if(body.activeReleaseId==="old-menu")desired=video;return route.fulfill({json:{ok:true,syncRetryRequestedAt:body.activeReleaseId==="old-menu"?receipt:null}});});
  await page.goto(`${playerURL}/lg/legacy`);
  await expect.poll(()=>shown.includes("old-menu")).toBe(true);
  await expect.poll(()=>shown.includes("new-video"),{timeout:12000}).toBe(true);
  await expect(page.locator("video.visible")).toBeVisible();
  await expect.poll(()=>page.locator("video.visible").evaluate((video:HTMLVideoElement)=>video.currentTime)).toBeGreaterThan(0.04);
});

test("static-lg: a decoder without a first-frame signal times out, retains the menu and recovers",async({page})=>{
  test.setTimeout(40000);
  const baseline=await(await page.request.get(`${playerURL}/api/player/manifest?deviceToken=demo-online`)).json()as PlayerManifestEnvelope;
  const image={...baseline,device:{...baseline.device,desiredReleaseId:"old-menu"},manifest:{...baseline.manifest,releaseId:"old-menu",items:[{...baseline.manifest.items[0]!,durationSeconds:5}]}};
  const video={...image,device:{...image.device,desiredReleaseId:"stalled-video"},manifest:{...image.manifest,releaseId:"stalled-video",items:[{...image.manifest.items[0]!,id:"stalled-item",kind:"video",source:{url:`${playerURL}/stalled-video.mp4`,mimeType:"video/mp4",bytes:bytes.length,checksumSha256:createHash("sha256").update(bytes).digest("hex")}}]}};
  let desired:unknown=image;const reports:Array<{activeReleaseId?:string;lastPlaybackError?:{code:string;recoveredAt?:string};syncPhase?:string}>=[];
  await page.addInitScript(()=>{
    localStorage.setItem("veyocast.player.deviceToken","a".repeat(48));localStorage.setItem("veyocast.player.installationCredential","i".repeat(48));
    const state=window as unknown as {blockVideoEvents:boolean};state.blockVideoEvents=true;
    for(const event of["playing","timeupdate"])document.addEventListener(event,e=>{if(state.blockVideoEvents)e.stopImmediatePropagation();},true);
    const create=document.createElement.bind(document);document.createElement=((name:string,options?:ElementCreationOptions)=>{const element=create(name,options);if(name.toLowerCase()==="video")(element as HTMLVideoElement).loop=true;return element;})as typeof document.createElement;
  });
  await page.route("**/api/player/installation",route=>route.fulfill({json:{ok:true,bound:true,installationCredential:"i".repeat(48)}}));
  await page.route("**/api/player/realtime",route=>route.fulfill({status:204}));
  await page.route("**/api/player/manifest*",route=>route.fulfill({json:desired}));
  await page.route("**/stalled-video.mp4",route=>route.fulfill({body:bytes,contentType:"video/mp4"}));
  await page.route("**/api/player/heartbeat",route=>{const body=route.request().postDataJSON();reports.push(body);if(body.activeReleaseId==="old-menu")desired=video;return route.fulfill({json:{ok:true,syncRetryRequestedAt:body.activeReleaseId==="old-menu"?receipt:null}});});
  await page.goto(`${playerURL}/lg/legacy`);
  await expect.poll(()=>reports.some(body=>body.lastPlaybackError?.code==="LEGACY_VIDEO_START_TIMEOUT"),{timeout:25000}).toBe(true);
  expect(reports.some(body=>body.activeReleaseId==="stalled-video")).toBe(false);
  expect(reports.find(body=>body.lastPlaybackError?.code==="LEGACY_VIDEO_START_TIMEOUT")?.syncPhase).toBe("failed");
  await expect(page.locator("img.visible").first()).toBeVisible();
  await page.evaluate(()=>{(window as unknown as {blockVideoEvents:boolean}).blockVideoEvents=false;});
  await expect.poll(()=>reports.some(body=>body.activeReleaseId==="stalled-video"),{timeout:5000}).toBe(true);
  await expect(page.locator("video.visible")).toBeVisible();
});
