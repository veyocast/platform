import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  syncSystemAssets,
  syncSlidePresentationSchema,
} from "@veyocast/contracts";

const origin = "http://127.0.0.1:3314",
  require = createRequire(join(process.cwd(), "package.json")),
  compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
let bundle: string;
test.beforeAll(() => {
  const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{SyncStudioMedia}from'./apps/player/app/_components/sync-studio-media';import{PlaybackMedia}from'./apps/player/app/_components/player-runtime';async function main(){const props=globalThis.fixture;const item=props.item;item.syncSystemAssetUrls={};for(const asset of props.assets){const response=await fetch(asset.path);if(!response.ok)throw Error('Source asset unavailable');const bytes=await response.arrayBuffer();const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');if(hash!==asset.sha256||bytes.byteLength!==asset.bytes)throw Error('Source asset integrity mismatch');item.syncSystemAssetUrls[asset.path]=URL.createObjectURL(new Blob([bytes],{type:asset.mimeType}));}if(props.unsupported){const original=CSS.supports.bind(CSS);CSS.supports=(key,value)=>value==='1cqw'?false:original(key,value);}if(props.failFont)document.fonts.load=async()=>{throw Error('Controlled font decoder failure')};if(props.holdMotion){const style=document.createElement('style');style.id='hold-source-motion';style.textContent='.sync-slide-animated{animation-play-state:paused!important}';document.head.append(style);}globalThis.ready=[];globalThis.ended=[];const ready=id=>{globalThis.firstReadyAt??=performance.now();globalThis.ready.push({type:'source',id,visible:document.querySelector('.vc-slide-preview')?.getBoundingClientRect().width>0});};function App(){const[acknowledged,setAcknowledged]=useState(0),[paused,setPaused]=useState(false),[shown,setShown]=useState(!props.hiddenInitial),[live,setLive]=useState(()=>new Map());globalThis.updateMatch=state=>setLive(new Map([[state.connectionId,state]]));return <><output aria-label="Framebevestigingen">{acknowledged}</output><button onClick={()=>setShown(true)}>Zichtbaar maken</button><button onClick={()=>setPaused(v=>!v)}>{paused?'Hervatten':'Pauzeren'}</button><div style={{width:960,height:shown?540:0}}>{props.wholePlayback?<PlaybackMedia item={item} liveMatchStates={live} paused={paused} watchdogTimeoutMs={10000} onReady={ready} onEnded={id=>globalThis.ended.push({id,at:performance.now()})} onFailure={(id,code)=>{globalThis.fixtureError=code;}}/>:<SyncStudioMedia item={item} liveMatchStates={live} paused={paused} passive={props.passive} onReady={props.rerenderOnReady?id=>{ready(id);setAcknowledged(value=>value+1);}:ready} onEnded={props.naturalEnd?id=>globalThis.ended.push({id,at:performance.now()}):undefined} fallback={<img id="complete-binary-fallback" src="/fallback.png" alt="Geverifieerde volledige fallback" onLoad={()=>globalThis.ready.push({type:'binary'})}/>}/>}</div></>}createRoot(document.getElementById('root')).render(<App/>);}main().catch(error=>{globalThis.fixtureError=error.message;document.getElementById('root').textContent=error.message;});`;
  // Source injects its actual shared CSS. The full runtime also imports unrelated
  // legacy CSS modules; esbuild gives .module.css its own default loader.
  const code = `const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/player/node_modules'],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'empty','.module.css':'empty'},define:{'process.env':'{}'}});process.stdout.write(result.outputFiles[0].text);`;
  bundle = execFileSync(
    process.execPath,
    [
      "-e",
      `(async()=>{${code}})().catch(e=>{console.error(e.message);process.exitCode=1})`,
    ],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 30000 },
  );
});
async function mount(
  page: Page,
  options: {
    unsupported?: boolean;
    dynamic?:boolean;
    liveMatch?:boolean;
    engage?:boolean;
    youtube?:boolean;
    binaryImageBase?:boolean;
    wholePlayback?:boolean;
    corruptDynamicFallback?:boolean;
    failFont?: boolean;
    passive?: boolean;
    hiddenInitial?: boolean;
    motion?: "rustig" | "dynamisch" | "geen";
    holdMotion?: boolean;
    rerenderOnReady?:boolean;
    naturalEnd?:boolean;
    orientation?:'landscape'|'portrait';
    fitMode?:'contain'|'cover';
    cropFocus?:{x:number;y:number};
    trim?:{startSeconds:number;endSeconds:number|null};
  } = {},
) {
  const presentation = syncSlidePresentationSchema.parse({
    schemaVersion: 1,
    rendererVersion: "sync-v1",
    sourceRevision: "8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a",
    family: options.liveMatch?"scoreboard":options.engage?"engage":options.youtube?"youtube":"fixtures",
    orientation: options.orientation??"landscape",
    theme: "fieldflow",
    name: "Eigen programma",
    title: "Ons programma",
    club: { name: "Club A" },
    rows: Array.from({ length: options.liveMatch||options.engage?0:options.naturalEnd?1:9 }, (_, i) => [
      `Thuis ${i}`,
      `Uit ${i}`,
      "14:30",
      String(i + 1),
    ]),
    style: {motion:options.motion},
  });
  const item:Record<string,unknown> = {
    id: "22600000-0000-4000-8000-000000000001",
    kind: options.binaryImageBase?"image":"video",
    durationSeconds: options.binaryImageBase?5:options.naturalEnd?5:9,
    syncStudioPresentation: presentation,
    syncStudioDurationMs: options.naturalEnd?3000:9000,
    syncStudioAssets: {},
    fitMode:options.fitMode??'contain',
    cropFocus:options.cropFocus,
    trim:options.trim,
    backgroundColor:'#123456',
    source:{checksumSha256:'a'.repeat(64),bytes:100,mimeType:options.binaryImageBase?'image/png':'video/mp4',url:options.binaryImageBase?'/fallback.png':'/complete-source.mp4'},
  };
  if(options.engage)item.onlinePlayback={kind:'engage',publicId:'50000000-0000-4000-8000-000000000232',title:'Eigen publieksvraag',question:'Wie was de beste speler?'};
  if(options.youtube)item.onlinePlayback={kind:'youtube',privacyEnhanced:true,title:'Eigen gecontroleerde videobron',videoId:'abcdefghijk'};
  if(options.dynamic){
    item.syncDynamic={schemaVersion:1,configurationSnapshotId:'10000000-0000-4000-8000-000000000230',snapshotId:'20000000-0000-4000-8000-000000000230',templateVersionId:'30000000-0000-4000-8000-000000000230',configurationHash:'b'.repeat(64),contentHash:'c'.repeat(64),fallbackChecksumSha256:(options.corruptDynamicFallback?'f':'a').repeat(64),durationMs:options.naturalEnd?3000:9000,presentation:options.liveMatch?{...presentation,state:'empty'}:presentation,assets:{},...(options.liveMatch?{liveMatch:{connectionId:'40000000-0000-4000-8000-000000000231',showClock:true}}:{})};
    delete item.syncStudioPresentation;delete item.syncStudioDurationMs;delete item.syncStudioAssets;
  }
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(`${origin}/assets/*`, (route) => {
    const asset = syncSystemAssets.find(
      (asset) => new URL(route.request().url()).pathname === asset.path,
    );
    if (!asset) return route.abort();
    return route.fulfill({
      contentType: asset.mimeType,
      body: readFileSync(join(process.cwd(), "apps/player/public", asset.path)),
    });
  });
  await page.route(`${origin}/fallback.png`, (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
        "base64",
      ),
    }),
  );
  await page.route(`${origin}/fixture`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="nl"><head><title>Source playback component</title><style>html,body{margin:0;background:#142d32}</style></head><body><div id="root"></div><script>globalThis.fixture=${JSON.stringify({ item, assets: syncSystemAssets, ...options }).replace(/</g, "\\u003c")};${bundle.replace(/<\/script/gi, "<\\/script")}</script></body></html>`,
    }),
  );
  await page.goto(`${origin}/fixture`);
  await expect(
    page.getByRole("button", { name: "Pauzeren", exact: true }),
  ).toBeVisible();
  return errors;
}
test("Source playback verifies and renders all pages, pauses its page clock and cycles without a binary gap", async ({
  page,
}) => {
  const errors = await mount(page);
  const frame = page.locator(".playback-sync");
  await expect(frame).toHaveAttribute("data-sync-ready", "true");
  await expect(page.locator(".vc-slide-preview")).toContainText("Thuis 0");
  await expect
    .poll(() => page.evaluate(() => Reflect.get(globalThis, "ready")))
    .toEqual([
      {
        type: "source",
        id: "22600000-0000-4000-8000-000000000001",
        visible: true,
      },
    ]);
  await expect(frame).toHaveAttribute("data-sync-page", "1");
  await expect(page.locator(".vc-slide-preview")).toContainText("Thuis 4");
  await page.getByRole("button", { name: "Pauzeren", exact: true }).click();
  await page.waitForTimeout(3200);
  await expect(frame).toHaveAttribute("data-sync-page", "1");
  await page.getByRole("button", { name: "Hervatten", exact: true }).click();
  await expect(frame).toHaveAttribute("data-sync-page", "2");
  await expect(page.locator(".vc-slide-preview")).toContainText("Thuis 8");
  await expect(page.locator("#complete-binary-fallback")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("an older CSS implementation renders the existing complete binary fallback", async ({
  page,
}) => {
  const errors = await mount(page, { unsupported: true });
  await expect(page.locator("#complete-binary-fallback")).toBeVisible();
  await expect(page.locator(".playback-sync")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => Reflect.get(globalThis, "ready")))
    .toEqual([{ type: "binary" }]);
  expect(errors).toEqual([]);
});
test("a Source font failure uses binary playback without claiming a Source frame", async ({
  page,
}) => {
  const errors = await mount(page, { failFont: true });
  await expect(page.locator("#complete-binary-fallback")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(globalThis, "ready")))
    .toEqual([{ type: "binary" }]);
  expect(errors).toEqual([]);
});
test("the outgoing passive Source frame remains visible without producing a new frame receipt", async ({
  page,
}) => {
  const errors = await mount(page, { passive: true });
  await expect(page.locator(".vc-slide-preview")).toBeVisible();
  await expect(page.locator(".vc-slide-preview")).toContainText("Thuis 0");
  expect(await page.evaluate(() => Reflect.get(globalThis, "ready"))).toEqual(
    [],
  );
  expect(errors).toEqual([]);
});

test('a transparent motion frame cannot acknowledge playback and resumes from its paused beginning',async({page})=>{
  const errors=await mount(page,{motion:'dynamisch',holdMotion:true});
  await expect(page.locator('.playback-sync')).toHaveAttribute('data-sync-ready','true');
  await expect(page.locator('.sync-slide-animated')).toHaveCSS('opacity','0');
  expect(await page.evaluate(()=>Reflect.get(globalThis,'ready'))).toEqual([]);
  await page.getByRole('button',{name:'Pauzeren',exact:true}).click();
  await page.evaluate(()=>document.getElementById('hold-source-motion')?.remove());
  await expect(page.locator('.sync-slide-animated')).toHaveCSS('animation-play-state','paused');
  await expect(page.locator('.sync-slide-animated')).toHaveCSS('opacity','0');
  expect(await page.evaluate(()=>Reflect.get(globalThis,'ready'))).toEqual([]);
  await page.getByRole('button',{name:'Hervatten',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>Reflect.get(globalThis,'ready'))).toEqual([{type:'source',id:'22600000-0000-4000-8000-000000000001',visible:true}]);
  await expect(page.locator('.sync-slide-animated')).toHaveCSS('opacity','1');
  expect(errors).toEqual([]);
});

test('a parent render after acknowledgement does not restart Source preparation or report another first frame',async({page})=>{
  const errors=await mount(page,{rerenderOnReady:true});
  await expect(page.getByLabel('Framebevestigingen',{exact:true})).toHaveText('1');
  await page.waitForTimeout(500);
  await expect(page.getByLabel('Framebevestigingen',{exact:true})).toHaveText('1');
  expect(errors).toEqual([]);
});

test('DOM video respects the complete encoded loop boundary even when placement minimum is longer',async({page})=>{
  const errors=await mount(page,{naturalEnd:true,motion:'dynamisch'});
  await expect.poll(()=>page.evaluate(()=>Reflect.get(globalThis,'ended').length),{timeout:5000}).toBe(1);
  const duration=await page.evaluate(()=>Reflect.get(globalThis,'ended')[0].at-Reflect.get(globalThis,'firstReadyAt'));
  expect(duration).toBeGreaterThanOrEqual(2900);expect(duration).toBeLessThan(4500);
  expect(errors).toEqual([]);
});

test("a Source frame receipt and page clock wait until the actual frame is visible", async ({
  page,
}) => {
  const errors = await mount(page, { hiddenInitial: true });
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => Reflect.get(globalThis, "ready"))).toEqual(
    [],
  );
  await page
    .getByRole("button", { name: "Zichtbaar maken", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(globalThis, "ready")))
    .toEqual([
      {
        type: "source",
        id: "22600000-0000-4000-8000-000000000001",
        visible: true,
      },
    ]);
  await expect(page.locator(".playback-sync")).toHaveAttribute(
    "data-sync-page",
    "0",
  );
  await page.waitForTimeout(2400);
  await expect(page.locator(".playback-sync")).toHaveAttribute(
    "data-sync-page",
    "0",
  );
  expect(errors).toEqual([]);
});

test('Source portrait cover applies the same bottom crop as its binary fallback',async({page})=>{
 await mount(page,{orientation:'portrait',fitMode:'cover',cropFocus:{x:0,y:1}});
 await expect(page.locator('.playback-sync')).toHaveAttribute('data-sync-ready','true');
 const geometry=await page.locator('.sync-slide-frame').evaluate(element=>{const box=element.getBoundingClientRect(),root=element.parentElement!.getBoundingClientRect();return{width:box.width,height:box.height,left:box.left-root.left,top:box.top-root.top,background:getComputedStyle(element.parentElement!).backgroundColor};});
 expect(geometry.width).toBeCloseTo(960,1);expect(geometry.height).toBeCloseTo(960*16/9,1);expect(geometry.left).toBe(0);expect(geometry.top).toBeCloseTo(540-960*16/9,1);expect(geometry.background).toBe('rgb(18, 52, 86)');
 await expect(page.locator('#complete-binary-fallback')).toHaveCount(0);
});
test('Source portrait contain honors a left focus without stretching',async({page})=>{
 await mount(page,{orientation:'portrait',fitMode:'contain',cropFocus:{x:0,y:1}});
 await expect(page.locator('.playback-sync')).toHaveAttribute('data-sync-ready','true');
 const geometry=await page.locator('.sync-slide-frame').evaluate(element=>{const box=element.getBoundingClientRect(),root=element.parentElement!.getBoundingClientRect();return{width:box.width,height:box.height,left:box.left-root.left,top:box.top-root.top};});
 expect(geometry.width).toBeCloseTo(540*9/16,1);expect(geometry.height).toBe(540);expect(geometry.left).toBe(0);expect(geometry.top).toBe(0);
});
test('an existing trimmed Source placement plays its verified binary instead of ignoring trim',async({page})=>{
 await mount(page,{trim:{startSeconds:1,endSeconds:3}});await expect(page.locator('#complete-binary-fallback')).toBeVisible();await expect(page.locator('.playback-sync')).toHaveCount(0);
 expect(await page.evaluate(()=>Reflect.get(globalThis,'ready').filter((entry:{type:string})=>entry.type==='source'))).toEqual([]);
});

test('connected Source uses its own complete presentation and page timing without Studio fields',async({page})=>{
 const errors=await mount(page,{dynamic:true,motion:'geen'});const frame=page.locator('.playback-sync');await expect(frame).toHaveAttribute('data-sync-ready','true');await expect(page.locator('.vc-slide-preview')).toContainText('Thuis 0');await expect(frame).toHaveAttribute('data-sync-page','1');await expect(page.locator('.vc-slide-preview')).toContainText('Thuis 4');await expect(frame).toHaveAttribute('data-sync-page','2');await expect(page.locator('.vc-slide-preview')).toContainText('Thuis 8');await expect(page.locator('#complete-binary-fallback')).toHaveCount(0);expect(errors).toEqual([]);
});
test('connected Source refuses a presentation paired with another binary checksum',async({page})=>{
 const errors=await mount(page,{dynamic:true,corruptDynamicFallback:true});await expect(page.locator('#complete-binary-fallback')).toBeVisible();await expect(page.locator('.playback-sync')).toHaveCount(0);expect(errors).toEqual([]);
});

test('connected data grows beyond an image fallback and completes all three pages before its natural boundary',async({page})=>{
 const errors=await mount(page,{dynamic:true,binaryImageBase:true,wholePlayback:true,motion:'geen'});const frame=page.locator('.playback-sync');await expect(frame).toHaveAttribute('data-sync-ready','true');await expect(frame).toHaveAttribute('data-sync-page','1');await expect(frame).toHaveAttribute('data-sync-page','2');await expect(frame).toContainText('Thuis 8');expect(await page.evaluate(()=>Reflect.get(globalThis,'ended'))).toEqual([]);await expect.poll(()=>page.evaluate(()=>Reflect.get(globalThis,'ended'))).toHaveLength(1);expect(await page.evaluate(()=>Reflect.get(globalThis,'ended')[0].at-Reflect.get(globalThis,'firstReadyAt'))).toBeGreaterThanOrEqual(8800);expect(errors).toEqual([]);
});
test('a failed connected DOM font retains the image fallback and its own complete playback boundary',async({page})=>{
 const errors=await mount(page,{dynamic:true,binaryImageBase:true,wholePlayback:true,failFont:true,naturalEnd:true,motion:'geen'});await expect(page.locator('img.playback-media')).toBeVisible();await expect(page.locator('.playback-sync')).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>Reflect.get(globalThis,'ended')),{timeout:7000}).toHaveLength(1);expect(await page.evaluate(()=>Reflect.get(globalThis,'ended')[0].at-Reflect.get(globalThis,'firstReadyAt'))).toBeGreaterThanOrEqual(4900);expect(await page.evaluate(()=>Reflect.get(globalThis,'fixtureError'))).toBeUndefined();expect(errors).toEqual([]);
});


test('Source score consumes the existing global state, freezes its offline clock and keeps one original item boundary',async({page})=>{
 const errors=await mount(page,{dynamic:true,liveMatch:true,naturalEnd:true,wholePlayback:true,motion:'geen'});
 await expect(page.locator('.playback-sync')).toHaveAttribute('data-sync-ready','true');
 const now=Date.now(),connectionId='40000000-0000-4000-8000-000000000231';
 const state={schemaVersion:1,connectionId,matchKey:'fixture-match',revision:'1',sequence:1,status:'live',home:{name:'Eigen thuis',score:2,logoUrl:null},away:{name:'Eigen uit',score:1,logoUrl:null},clock:{anchorAt:new Date(now).toISOString(),anchorSeconds:120,direction:'up',maxSeconds:7200,running:true},sourceUpdatedAt:new Date(now).toISOString(),staleAfter:new Date(now+1300).toISOString(),serverTimeOffsetMs:0,periodLabel:null,timeline:[]};
 await page.evaluate(state=>Reflect.get(globalThis,'updateMatch')(state),state);
 const frame=page.locator('.vc-slide-preview');await expect(frame).toContainText('Eigen thuis');await expect(frame).toContainText('02:01',{timeout:3500});
 await page.evaluate(state=>Reflect.get(globalThis,'updateMatch')(state),{...state,sequence:2,revision:'2',home:{...state.home,score:3}});
 await expect(page.locator('.vc-match-middle > strong')).toContainText('3');
 await page.evaluate(state=>Reflect.get(globalThis,'updateMatch')(state),{...state,matchKey:'waiting:'+connectionId,revision:'0',status:'unknown'});
 await expect(page.locator('.vc-match-middle > strong')).toContainText('3');
 await expect.poll(()=>page.evaluate(()=>Reflect.get(globalThis,'ended')),{timeout:5000}).toHaveLength(1);
 const receipts=await page.evaluate(()=>({ready:Reflect.get(globalThis,'ready'),duration:Reflect.get(globalThis,'ended')[0].at-Reflect.get(globalThis,'firstReadyAt')}));
 expect(receipts.ready).toHaveLength(1);expect(receipts.duration).toBeGreaterThanOrEqual(2900);expect(receipts.duration).toBeLessThan(4500);await expect(frame).toContainText('02:01');expect(errors).toEqual([]);
});


test('a Source Engage presentation follows public visibility without replacing its design or restarting its item clock',async({page})=>{
 const publicId='50000000-0000-4000-8000-000000000232';let visible=true,requests=0;
 await page.route(origin+'/api/player/engage/'+publicId,route=>{requests++;return route.fulfill({json:{id:publicId,kind:'poll',closesAt:null,privacyNotice:'Stemmen worden zonder naam geteld.',question:'Wie was de beste speler?',title:'Eigen wedstrijd',resultVisibility:visible?'live':'after_vote',resultsVisible:visible,status:'live',tenantName:'Eigen club',totalVotes:8,options:[{id:'20000000-0000-4000-8000-000000000232',label:'Eigen speler A',sortOrder:0,voteCount:6},{id:'30000000-0000-4000-8000-000000000232',label:'Eigen speler B',sortOrder:1,voteCount:2}]}});});
 const errors=await mount(page,{engage:true,wholePlayback:true,motion:'geen'}),frame=page.locator('.playback-sync');
 await expect(frame).toHaveAttribute('data-sync-ready','true');await expect(frame).toContainText('Wie was de beste speler?');await expect(frame.locator('.vc-engage-result strong').first()).toHaveText('75%');await expect(page.locator('.engage-playback')).toHaveCount(0);
 visible=false;await expect(frame.locator('.vc-engage-result strong')).toHaveCount(0,{timeout:7000});await expect(frame).toContainText('Resultaten zichtbaar op je telefoon nadat je hebt gestemd.');await expect(frame).not.toContainText('6 stemmen');
 await expect.poll(()=>page.evaluate(()=>Reflect.get(globalThis,'ended')),{timeout:11000}).toHaveLength(1);const receipts=await page.evaluate(()=>({ready:Reflect.get(globalThis,'ready'),duration:Reflect.get(globalThis,'ended')[0].at-Reflect.get(globalThis,'firstReadyAt')}));
 expect(receipts.ready).toHaveLength(1);expect(receipts.duration).toBeGreaterThanOrEqual(8800);expect(receipts.duration).toBeLessThan(10500);expect(requests).toBeLessThanOrEqual(4);expect(errors).toEqual([]);
});

test('Source YouTube uses the official iframe boundary and its full Source fallback owns exactly one natural end after failure',async({page})=>{
 let apiReads=0;
 await page.route('https://www.youtube.com/iframe_api',route=>{apiReads++;return route.fulfill({contentType:'application/javascript',body:`window.YT={PlayerState:{ENDED:0,PLAYING:1},Player:function(element,options){globalThis.youtubeOptions=options;var frame=document.createElement('iframe');frame.title='Eigen gecontroleerde videobron';frame.src=options.host+'/embed/'+options.videoId;element.replaceChildren(frame);this.destroy=()=>frame.remove();this.mute=()=>{};this.playVideo=()=>{};this.pauseVideo=()=>{};setTimeout(()=>{options.events.onReady({target:this});options.events.onStateChange({data:1});},0);}};window.onYouTubeIframeAPIReady();`});});
 await page.route('https://www.youtube-nocookie.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Controlled official iframe boundary</title>'}));
 const errors=await mount(page,{youtube:true,wholePlayback:true,naturalEnd:true});await expect(page.locator('iframe[src="https://www.youtube-nocookie.com/embed/abcdefghijk"]')).toBeVisible();expect(apiReads).toBe(1);await expect(page.locator('.playback-sync')).toHaveCount(0);
 await page.evaluate(()=>Reflect.get(globalThis,'youtubeOptions').events.onError());const frame=page.locator('.playback-sync[data-sync-ready="true"]');await expect(frame).toBeVisible();await expect(frame).toContainText('Ons programma');await expect(page.locator('iframe')).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>Reflect.get(globalThis,'ended').length)).toBe(1);await page.waitForTimeout(3000);expect(await page.evaluate(()=>Reflect.get(globalThis,'ended').length)).toBe(1);expect(apiReads).toBe(1);expect(errors).toEqual([]);
});
