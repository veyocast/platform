import AxeBuilder from "@axe-core/playwright";
import {expect,test} from "@playwright/test";
import {mountScreenStatus,prepareScreenStatusFixture,screenStatusNow,screenStatusOrigin,statusFixture} from "../helpers/screen-status-fixture";

test.beforeAll(()=>prepareScreenStatusFixture());
for(const [age,label,kind] of [[299999,"Online","online"],[300000,"Status verouderd","stale"],[300001,"Status verouderd","stale"],[1799999,"Status verouderd","stale"],[1800000,"Offline","offline"],[1800001,"Offline","offline"]] as const) {
 test(`SCR-01 ${age}ms: overview, card, filter, health and detail agree`,async({page})=>{
  const data=statusFixture(age),trace=await mountScreenStatus(page,data);
  await expect(page.locator('.px-screen-live')).toHaveText(label);
  await expect(page.locator('.px-hero-stats > div').nth(1).locator('b')).toHaveText(kind==='online'?'1':'0');
  await page.goto(`${screenStatusOrigin}/dashboard/screens?status=${kind}`,{waitUntil:"domcontentloaded"});
  await expect(page.locator('.px-screen-card')).toHaveCount(1);
  await page.goto(`${screenStatusOrigin}/dashboard/screens?status=${kind==='online'?'offline':'online'}`,{waitUntil:"domcontentloaded"});
  await expect(page.locator('.px-screen-card')).toHaveCount(0);
  await page.goto(`${screenStatusOrigin}/dashboard/screens?view=health`,{waitUntil:"domcontentloaded"});
  await expect(page.locator('[aria-labelledby="health-title"] li').getByText(label,{exact:true})).toBeVisible();
  await page.goto(`${screenStatusOrigin}/dashboard`,{waitUntil:"domcontentloaded"});
  await expect(page.locator('.ov-screen-state .badge')).toHaveText(label);
  await page.goto(`${screenStatusOrigin}/dashboard/screens/${data.screenData.screen.id}`,{waitUntil:"domcontentloaded"});
  await expect(page.locator('.px-health-panel > .row .badge')).toHaveText(label);
  expect(trace.errors).toEqual([]);
 });
}
for(const [management,paired,seen,label] of [["disabled",false,null,"Uitgeschakeld"],["maintenance",false,null,"Onderhoud"],["active",false,null,"Niet gekoppeld"],["active",true,null,"Status onbekend"],["active",true,"2026-11-09T12:00:00.001Z","Status onbekend"]] as const) {
 test(`SCR-02 ${management}/${paired}/${seen??'missing'} preserves management priority`,async({page})=>{
  const data=statusFixture();data.screenData.screen.status=management;data.overview.screens[0]!.status=management;
  data.screenData.devices[0]!.lastSeenAt=seen as string;data.overview.devices[0]!.last_seen_at=seen as string;
  if(!paired){data.screenData.devices=[];data.fleet.devices=[];data.overview.devices=[];}
  await mountScreenStatus(page,data);
  await expect(page.locator('.px-screen-live')).toHaveText(label);
  await page.goto(`${screenStatusOrigin}/dashboard`,{waitUntil:"domcontentloaded"});await expect(page.locator('.ov-screen-state .badge')).toHaveText(label);
  await page.goto(`${screenStatusOrigin}/dashboard/screens/${data.screenData.screen.id}`,{waitUntil:"domcontentloaded"});await expect(page.locator('.px-health-panel > .row .badge')).toHaveText(label);
 });
}
test("SCR-03 assignment and download do not confirm a frame; contact loss preserves dated evidence",async({page})=>{
 const data=statusFixture(),device=data.screenData.devices[0]!;device.desiredReleaseId=data.screenData.releases[1]!.id;data.screenData.screen.assignedReleaseId=device.desiredReleaseId;data.overview.screens[0]!.assigned_release_id=device.desiredReleaseId;device.syncDetail={};
 await mountScreenStatus(page,data,`/dashboard/screens/${data.screenData.screen.id}`);
 await expect(page.locator('.px-confirmation > div').first()).toContainText('Nog niet bevestigd');
 await expect(page.getByText('Synchroniseren',{exact:true})).toBeVisible();
 Object.assign(device,{syncPhase:'downloading'});await page.reload({waitUntil:"domcontentloaded"});await expect(page.locator('.px-confirmation > div').first()).toContainText('Nog niet bevestigd');
 device.syncDetail={publicationTrace:{releaseId:device.activeReleaseId,firstFrameAt:"2026-11-09T10:00:00Z"}};await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator('.px-confirmation > div').first()).toContainText('v7');
 device.lastSeenAt=new Date(screenStatusNow-1800000).toISOString();await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator('.px-health-panel > .row .badge')).toHaveText('Offline');
 await expect(page.locator('.px-confirmation > div').first()).toContainText('v7');
 await expect(page.locator('[aria-label="Afzonderlijk schermbewijs"]')).toContainText('09-11-2026');
});
for(const width of [320,1440])test(`SCR-04 separate source evidence and saved preview are readable at ${width}px`,async({page},info)=>{
 const data=statusFixture();const snapshot='29600000-0000-4000-8000-000000000001';
 data.screenData.devices[0]!.syncDetail={publicationTrace:{releaseId:data.screenData.devices[0]!.activeReleaseId,firstFrameAt:"2026-11-09T10:00:00Z"},sourceDataConfirmation:{schemaVersion:2,itemId:snapshot,configurationSnapshotId:snapshot,dataRevision:3,contentHash:'a'.repeat(64),rendererVersion:'sync-onzetrots-v9'}};
 data.sources=[{snapshotId:snapshot,sourceName:'Sportlink',sourceKind:'sportlink',datasetKey:'competitions',lastSuccessAt:'2026-11-08T10:00:00Z',lastAttemptAt:'2026-11-09T11:00:00Z',checkedAt:'2026-11-09T11:00:01Z',dataRevision:4,contentHash:'b'.repeat(64),lastErrorCode:'PROVIDER_TIMEOUT'}];
 await page.setViewportSize({width,height:900});
 await mountScreenStatus(page,data,`/dashboard/screens/${data.screenData.screen.id}?tab=health`);
 await expect(page.locator('.px-health-panel > .row .badge')).toHaveText('Online');
 const source=page.locator('[aria-labelledby="screen-source-status-title"]');await expect(source).toContainText('Laatst geslaagde broncontrole: 08-11-2026');await expect(source).toContainText('Player gemeld: 3');await expect(source).toContainText('Beschikbaar: 4');
 await expect(page.getByText('Publicatievoorbeeld uit opgeslagen bytes · geen live screenshot van het scherm',{exact:false})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
 await page.screenshot({path:info.outputPath(`screen-status-${width}.png`),fullPage:true});
 await page.keyboard.press("Tab");
 await expect(page.getByRole("link",{name:"Alle schermen",exact:true})).toBeFocused();
 await page.keyboard.press("Enter");
 await expect(page.locator(".px-screen-card")).toHaveCount(1);
 for (const [route,name] of [["/dashboard/screens","fleet"],["/dashboard","overview"],[`/dashboard/screens/${data.screenData.screen.id}`,"detail"]] as const) {
  await page.goto(screenStatusOrigin+route,{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`screen-status-${name}-${width}.png`),fullPage:true});
 }

});

test("SCR-03 authoritative screen assignment and explicit removal ignore stale device desire",async({page})=>{
 const data=statusFixture(),screen=data.screenData.screen,device=data.screenData.devices[0]!;
 device.desiredReleaseId=data.screenData.releases[1]!.id;
 data.overview.devices[0]!.desired_release_id=device.desiredReleaseId;
 await mountScreenStatus(page,data);
 await expect(page.locator('.px-hero-stats > div').nth(2).locator('b')).toHaveText('1');
 await expect(page.locator('.px-version-row')).toContainText('Gewenst v7');
 await page.goto(`${screenStatusOrigin}/dashboard/screens/${screen.id}`,{waitUntil:"domcontentloaded"});
 await expect(page.locator('.px-confirmation > div').nth(1)).toContainText('v7');
 await expect(page.getByText('Gewenst beeld bevestigd',{exact:true})).toBeVisible();
 // An explicit unassignment is meaningful; a stale device request cannot revive it.
 Object.assign(screen,{assignedReleaseId:null});
 Object.assign(data.overview.screens[0]!,{assigned_release_id:null});
 await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator('.px-confirmation > div').nth(1)).toContainText('Nog geen publicatie');
 await expect(page.locator('.px-confirmation > div').first()).toContainText('v7');
 await page.goto(`${screenStatusOrigin}/dashboard`,{waitUntil:"domcontentloaded"});
 await expect(page.locator('.ov-screen-publication')).not.toContainText('→');
 await page.goto(`${screenStatusOrigin}/dashboard/screens?status=syncing`,{waitUntil:"domcontentloaded"});
 await expect(page.locator('.px-screen-card')).toHaveCount(0);
});
