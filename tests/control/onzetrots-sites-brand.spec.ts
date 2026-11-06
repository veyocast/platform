import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {join} from "node:path";
import {chromium,expect,test,type Page} from "@playwright/test";
import type {PlayerSitesMarkup} from "../../apps/player/app/_lib/player-sites-markup";
import {lgSitesRuntimeScript} from "../../apps/player/app/_lib/lg-sites-runtime";
import {normalizeLgSitesCss} from "../../apps/player/app/_lib/lg-sites-css";
import systemAssets from "../../packages/content-templates/src/sites-system-assets.json";

const require=createRequire(join(process.cwd(),"package.json"));
const entry=`
import React from 'react';import{createRoot}from'react-dom/client';
import{studioSitesSystemTemplates}from'./packages/studio/src/sites';
import{SitesPresentationView,loadSitesOnzeTrotsHeaderFont}from'./packages/content-templates/src/sites-presentation';
import{sitesPresentationCss}from'./packages/content-templates/src/sites-styles';
import{LedSlidePreview}from'./packages/content-templates/src/sites-led-slide';
import{SitesDynamicMedia}from'./apps/player/app/_components/sites-dynamic-media';
import{sitesDynamicConfigurationSchema,sitesCurrentPresentationSourceRevision,sitesLegacyPresentationSourceRevision}from'./packages/contracts/src/sites-presentation';
const root=createRoot(document.getElementById('root'));
window.loadDirectRoot=()=>loadSitesOnzeTrotsHeaderFont(document.querySelector('.uc-slide'));
window.renderSavedInput=presentation=>root.render(<SitesPresentationView presentation={presentation} fitViewport/>);
window.show=({kind='studio',orientation='landscape',theme='onzetrots-tv',readiness=false})=>{
 const title='Onze club maakt samen ruimte voor alle vrijwilligers en bezoekers op deze bijzondere wedstrijddag';
 const template=studioSitesSystemTemplates.find(t=>(theme==='fieldflow'||t.document.sitesPresentation?.slide.unifiedKind==='kantine')&&t.document.sitesPresentation?.slide.themeId===theme&&t.document.sitesPresentation?.slide.orientation===orientation);
 if(!template)throw Error('Missing real Studio template');
 const original=structuredClone(template.document.sitesPresentation);
 let presentation={...original,slide:{...original.slide,title,color:'#aa1133'}};
 if(kind==='legacy')presentation={...presentation,rendererVersion:'sites-v11',sourceRevision:sitesLegacyPresentationSourceRevision};
 if(kind.startsWith('menu'))presentation={kind:'dynamic',configuration:sitesDynamicConfigurationSchema.parse({schemaVersion:1,rendererVersion:'sites-v17',sourceRevision:sitesCurrentPresentationSourceRevision,themeId:theme,orientation,provider:'menu',unifiedKind:'kantine',title,accent:'#aa1133',menuWidgets:true,...(kind==='menu-v9'?{onzeTrotsStyle:'v9-marker-light'}:kind==='menu-v10'?{onzeTrotsStyle:'v10-barlow-dark'}:{})}),content:{kind:'kantine',title,clubName:'Eigen club',rows:[],menuPages:[{id:'page-1',columns:1,widgets:[{id:'coffee',type:'category',column:'full',columns:1,title:'Warme dranken uit onze clubkantine',rows:[{id:'coffee',column:1,primary:'Clubkoffie',secondary:'Vers gezet',value:'€ 2,50'}]}]}]}};
 window.savedInput=JSON.stringify(presentation);window.currentInput=presentation;window.readyCount=0;
 const item={id:'brand-readonly-fixture',durationSeconds:15};
 const design={themeId:theme,id:'led',name:'Onze wedstrijd',title,subtitle:'Samen langs de lijn',provider:'led-scores',kind:'score',orientation,accent:'#aa1133',overlay:0,layout:'full',scale:100,safeArea:6,seconds:15,align:'left',rows:[{id:'home',primary:'Eigen club',value:'2'},{id:'away',primary:'Bezoekers',value:'1'}],config:{ledMoment:'goal',ledTheme:'blue'}};
 root.render(<div key={kind+orientation+theme+readiness} style={{width:'100%',height:'100%'}}>{kind==='led'?<><style>{sitesPresentationCss}</style><LedSlidePreview design={design} background=""/></>:readiness?<SitesDynamicMedia item={item} presentation={presentation} onReady={()=>window.readyCount++} fallback={<p data-testid="verified-fallback">Bestaand geverifieerd beeld</p>}/>:<SitesPresentationView presentation={presentation} fitViewport/>}</div>);
};window.show({});
`;
let bundle="";
test.beforeAll(()=>{
 const compiler=require.resolve("esbuild",{paths:[require.resolve("tsx")]});
 const script=`const{buildSync}=require(${JSON.stringify(compiler)});const r=buildSync({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',nodePaths:[process.cwd()+'/apps/control/node_modules'],define:{'process.env.NODE_ENV':'"production"'}});process.stdout.write(r.outputFiles[0].text)`;
 bundle=execFileSync(process.execPath,["-e",script],{encoding:"utf8",maxBuffer:24*1024*1024});
});
async function mount(page:Page,brokenFont=false){
 await page.route("**/__sites-brand",route=>route.fulfill({contentType:"text/html",body:`<!doctype html><html lang="nl"><style>*{box-sizing:border-box}html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="root"></div><script>${bundle.replace(/<\/script/gi,"<\\/script")}</script></html>`}));
 await page.route(/\/(?:onzetrots[^/]*|fonts|fieldflow)\//,route=>{const path=new URL(route.request().url()).pathname;return route.fulfill({body:brokenFont&&path.endsWith("club-font-9.ttf")?Buffer.from("invalid font fixture"):readFileSync(join(process.cwd(),"apps/player/public",path)),contentType:path.endsWith(".ttf")?"font/ttf":path.endsWith(".woff2")?"font/woff2":path.endsWith(".svg")?"image/svg+xml":"image/webp"});});
 await page.goto("http://127.0.0.1:3343/__sites-brand");
}
const selector=(kind:string)=>kind==="led"?".s191-led-slide-headline h2":kind==="legacy"?".otv-heading-text":kind==="menu-v9"||kind==="menu-v10"?"[data-ot-header-text]":".uc-slide-title";
for(const orientation of ["landscape","portrait"] as const)for(const kind of ["studio","legacy","menu-untagged","menu-v9","menu-v10","led"]){
 test(`saved ${kind}/${orientation}: exact club primary and real Marker headers, readable bounded content`,async({page},info)=>{
  await page.setViewportSize(orientation==="portrait"?{width:1080,height:1920}:{width:1920,height:1080});await mount(page);
  await page.evaluate(value=>Reflect.get(window,"show")(value),{kind,orientation});
  const header=page.locator(selector(kind));await expect(header).toBeVisible();
  await page.evaluate(async()=>{await document.fonts.load("400 24px OTMarker");await document.fonts.ready;});
  await expect(header).toHaveCSS("font-family","OTMarker, cursive");await expect(header).toHaveCSS("font-weight","400");await expect(header).toHaveCSS("font-synthesis","none");
  const cdp=await page.context().newCDPSession(page);await cdp.send("DOM.enable");await cdp.send("CSS.enable");const{root}=await cdp.send("DOM.getDocument");const{nodeId}=await cdp.send("DOM.querySelector",{nodeId:root.nodeId,selector:selector(kind)});const{fonts}=await cdp.send("CSS.getPlatformFontsForNode",{nodeId});expect(fonts.length).toBeGreaterThan(0);expect(fonts.every(font=>font.isCustomFont&&font.postScriptName==="PermanentMarker-Regular")).toBe(true);await cdp.detach();
  const proof=await header.evaluate(element=>{const canvas=element.closest<HTMLElement>(".screen,.uc-slide,.nc-screen,.s191-led-slide-slide")!,style=getComputedStyle(canvas),rect=element.getBoundingClientRect(),bounds=canvas.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(element);return{primary:(style.getPropertyValue("--blue")||style.getPropertyValue("--uc-blue")||style.getPropertyValue("--otv-accent")||style.getPropertyValue("--led-accent")).trim().toLowerCase(),rect:rect.toJSON(),bounds:bounds.toJSON(),header:element.closest("header")!.getBoundingClientRect().toJSON(),glyphs:[...range.getClientRects()].map(rect=>rect.toJSON()),scrollWidth:element.scrollWidth,clientWidth:element.clientWidth};});
  expect(proof.primary).toBe("#03438a");expect(proof.scrollWidth).toBeLessThanOrEqual(proof.clientWidth+1);for(const rect of proof.glyphs){expect(rect.left).toBeGreaterThanOrEqual(proof.bounds.left-1);expect(rect.right).toBeLessThanOrEqual(proof.bounds.right+1);expect(rect.top).toBeGreaterThanOrEqual(proof.bounds.top-1);expect(rect.bottom).toBeLessThanOrEqual(proof.bounds.bottom+1);}
  if(kind!=="led"){expect(proof.rect.top).toBeGreaterThanOrEqual(proof.header.top-1);expect(proof.rect.bottom).toBeLessThanOrEqual(proof.header.bottom+1);}
  if(kind.startsWith("menu")){await expect(page.locator(".vm-product")).toContainText("€ 2,50");expect(await page.locator(".vm-product>b").evaluate(element=>getComputedStyle(element).fontFamily)).not.toContain("OTMarker");expect(await page.locator(".vm-product strong").evaluate(element=>getComputedStyle(element).fontFamily)).not.toContain("OTMarker");}
  if(kind==="led")expect(await page.locator(".s191-led-slide-scoreDigits b").first().evaluate(element=>getComputedStyle(element).fontFamily)).not.toContain("OTMarker");
  if(kind==="studio")await expect(page.locator(".ucc-menu-foot strong")).toHaveCSS("font-family","OTMarker, cursive");
  if(kind==="legacy"){await expect(page.locator(".nc-broadcast-brand span")).toHaveCSS("font-family","OTMarker, cursive");await expect(page.locator(".nc-broadcast-footer>span:not(.nc-brush-wordmark)")).toHaveCSS("font-family","OTMarker, cursive");}
  expect(await page.evaluate(()=>JSON.stringify(Reflect.get(window,"currentInput"))===Reflect.get(window,"savedInput"))).toBe(true);
  await info.attach("actual-renderer-brand-proof",{body:JSON.stringify({kind,orientation,fonts,proof}),contentType:"application/json"});await page.screenshot({path:info.outputPath(`brand-${kind}-${orientation}.png`)});
 });
}
test("FieldFlow keeps its own header font and color",async({page})=>{
 await mount(page);await page.evaluate(()=>Reflect.get(window,"show")({kind:"menu-untagged",theme:"fieldflow"}));const title=page.locator(".uc-slide-title");await expect(title).toBeVisible();expect(await title.evaluate(element=>getComputedStyle(element).fontFamily)).not.toContain("OTMarker");expect(await page.locator(".uc-slide").evaluate(element=>getComputedStyle(element).getPropertyValue("--uc-blue").trim())).toBe("#09554e");
});
test("FieldFlow still waits for late body fonts before its existing fit measurement",async({page})=>{
 await mount(page);await page.evaluate(()=>Reflect.get(window,"show")({kind:"menu-untagged",theme:"fieldflow"}));await expect(page.locator('.uc-slide[data-theme="fieldflow"]')).toBeVisible();
 await page.route("**/fonts/manrope.woff2?late-brand-proof=1",async route=>{await new Promise(resolve=>setTimeout(resolve,250));await route.fulfill({body:readFileSync(join(process.cwd(),"apps/player/public/fonts/manrope.woff2")),contentType:"font/woff2"});});
 const status=await page.evaluate(async()=>{const face=new FontFace("LateBodyFixture","url('/fonts/manrope.woff2?late-brand-proof=1')");document.fonts.add(face);const text=document.createElement("span");text.textContent="Verschillende echte letterbreedtes";text.style.fontFamily="LateBodyFixture";document.body.append(text);text.getBoundingClientRect();void document.fonts.load("20px LateBodyFixture");await Reflect.get(window,"loadDirectRoot")();text.remove();return face.status;});expect(status).toBe("loaded");
});
test("Player acknowledges an actual frame only with the verified local Marker face loaded",async({page})=>{
 await mount(page);await page.evaluate(()=>Reflect.get(window,"show")({kind:"menu-untagged",readiness:true}));await expect.poll(()=>page.evaluate(()=>Reflect.get(window,"readyCount"))).toBe(1);expect(await page.evaluate(()=>document.fonts.check("400 24px OTMarker"))).toBe(true);await expect(page.getByTestId("verified-fallback")).toHaveCount(0);
 const directRootLoads=await page.evaluate(async()=>{const load=document.fonts.load.bind(document.fonts);let calls=0;document.fonts.load=(...args)=>{calls++;return load(...args);};try{await Reflect.get(window,"loadDirectRoot")();return calls;}finally{document.fonts.load=load;}});expect(directRootLoads).toBe(1);
});
test("an undecodable mandatory Marker font cannot acknowledge a Player visible frame",async({page})=>{
 await mount(page,true);await page.evaluate(()=>Reflect.get(window,"show")({kind:"menu-untagged",readiness:true}));await expect(page.getByTestId("verified-fallback")).toBeVisible();expect(await page.evaluate(()=>Reflect.get(window,"readyCount"))).toBe(0);
});

for(const orientation of ["landscape","portrait"] as const)test(`actual LG markup and ES5 header fit use Marker inside the fixed ${orientation} header`,async({page},info)=>{
 const width=orientation==="portrait"?1080:1920,height=orientation==="portrait"?1920:1080;
 const result=JSON.parse(execFileSync(process.execPath,["--import","tsx","tests/helpers/onzetrots-sites-legacy-markup.mts",orientation],{encoding:"utf8",maxBuffer:4*1024*1024})) as {markup:PlayerSitesMarkup;unchanged:boolean};
 const {markup}=result,script=lgSitesRuntimeScript();
 const fit=script.slice(script.indexOf("    function lgSitesAutoFit("),script.indexOf("    function playSitesMarkup("));
 // Execute the same standalone bridge; no modern JS feature is introduced.
 expect(fit).not.toMatch(/\b(?:const|let)\s|=>|\?\./);
 const paths=new Map(systemAssets.files.map(asset=>[asset.sha256,asset.path]));
 const replace=(text:string)=>text.replace(/VEYOSITES_ASSET_([a-f0-9]{64})/g,(_match,sha:string)=>{const path=paths.get(sha);if(!path)throw Error("Unknown frozen asset token");return path;});
 const css=normalizeLgSitesCss(replace(markup.css),width,height);
 await page.setViewportSize({width,height});
 await page.route(/\/(?:onzetrots[^/]*|fonts|fieldflow)\//,route=>{const path=new URL(route.request().url()).pathname;return route.fulfill({body:readFileSync(join(process.cwd(),"apps/player/public",path)),contentType:path.endsWith(".ttf")?"font/ttf":path.endsWith(".woff2")?"font/woff2":path.endsWith(".svg")?"image/svg+xml":"image/webp"});});
 await page.route("**/__sites-legacy-brand",route=>route.fulfill({contentType:"text/html",body:`<!doctype html><html lang="nl"><style>*{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}#artboard{width:${width}px;height:${height}px}${css}</style><div id="artboard">${replace(markup.pages[0]!)}</div><script>${fit};document.fonts.load('400 24px OTMarker').then(function(){return document.fonts.ready;}).then(function(){lgSitesAutoFit(document.getElementById('artboard'));window.legacyFitReady=true;});</script></html>`}));
 await page.goto("http://127.0.0.1:3343/__sites-legacy-brand");await expect.poll(()=>page.evaluate(()=>Reflect.get(window,"legacyFitReady"))).toBe(true);
 const title=page.locator(".uc-slide-title");await expect(title).toHaveCSS("font-family","OTMarker, cursive");
 const geometry=await title.evaluate(element=>({heading:element.getBoundingClientRect().toJSON(),header:element.closest("header")!.getBoundingClientRect().toJSON(),scrollWidth:element.scrollWidth,clientWidth:element.clientWidth,font:getComputedStyle(element).fontFamily}));
 const cdp=await page.context().newCDPSession(page);await cdp.send("DOM.enable");await cdp.send("CSS.enable");const{root}=await cdp.send("DOM.getDocument");const{nodeId}=await cdp.send("DOM.querySelector",{nodeId:root.nodeId,selector:".uc-slide-title"});const{fonts}=await cdp.send("CSS.getPlatformFontsForNode",{nodeId});expect(fonts.length).toBeGreaterThan(0);expect(fonts.every(font=>font.isCustomFont&&font.postScriptName==="PermanentMarker-Regular")).toBe(true);await cdp.detach();
 expect(geometry.heading.top).toBeGreaterThanOrEqual(geometry.header.top);expect(geometry.heading.bottom).toBeLessThanOrEqual(geometry.header.bottom);expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth+1);expect(result.unchanged).toBe(true);expect(markup.assetTokens.some(asset=>asset.token==="VEYOSITES_ASSET_a73712ce4f3b32d3c7a1a657d56c6aaf50c719b7fa7fe0541905fe77f5a9906c")).toBe(true);
 await info.attach("actual-lg-header-fit",{body:JSON.stringify(geometry),contentType:"application/json"});await page.screenshot({path:info.outputPath("legacy-brand.png")});
});

for(const orientation of ["landscape","portrait"] as const)test(`actual Worker and preview share the loaded long-title ${orientation} header geometry`,async({page},info)=>{
 const executable=info.project.use.launchOptions?.executablePath??chromium.executablePath(),output=info.outputPath("worker-brand.png");
 const result=JSON.parse(execFileSync(process.execPath,["--import","tsx","tests/helpers/onzetrots-sites-legacy-markup.mts",orientation,output],{encoding:"utf8",maxBuffer:4*1024*1024,timeout:45000,env:{...process.env,CHROMIUM_EXECUTABLE_PATH:executable}})) as {input:unknown;unchanged:boolean;measurement:{elements:Array<{tag:string;className:string;font:string;bounds:{x:number;y:number;width:number;height:number}}>}};
 const title=result.measurement.elements.find(element=>element.tag==="H1"&&element.className.includes("uc-slide-title"))!,header=result.measurement.elements.find(element=>element.className==="uc-header")!;expect(title.font).toContain("OTMarker");expect(title.bounds.y).toBeGreaterThanOrEqual(header.bounds.y);expect(title.bounds.y+title.bounds.height).toBeLessThanOrEqual(header.bounds.y+header.bounds.height);expect(result.unchanged).toBe(true);
 await page.setViewportSize(orientation==="portrait"?{width:1080,height:1920}:{width:1920,height:1080});await mount(page);await page.evaluate(input=>Reflect.get(window,"renderSavedInput")(input),result.input);await expect(page.locator(".uc-slide-title")).toBeVisible();await page.evaluate(()=>document.fonts.ready);
 await expect.poll(()=>page.locator(".uc-slide-title").evaluate(element=>{const rect=element.getBoundingClientRect();return{x:rect.x,y:rect.y,width:rect.width,height:rect.height};})).toEqual({x:title.bounds.x,y:title.bounds.y,width:title.bounds.width,height:title.bounds.height});
 await info.attach("actual-worker-header-fit",{body:JSON.stringify({title,header}),contentType:"application/json"});await page.screenshot({path:info.outputPath("preview-brand.png")});
});

test("actual LG refresh keeps the visible DOM and old URLs through a Marker decode failure",async({page})=>{
 const result=JSON.parse(execFileSync(process.execPath,["--import","tsx","tests/helpers/onzetrots-sites-legacy-markup.mts","landscape"],{encoding:"utf8",maxBuffer:4*1024*1024})) as {markup:PlayerSitesMarkup;input:{configuration:{title:string}}};
 const paths=new Map(systemAssets.files.map(asset=>[asset.sha256,asset.path])),replacements=Object.fromEntries(result.markup.assetTokens.map(asset=>[asset.token,paths.get(asset.token.slice("VEYOSITES_ASSET_".length))]));
 await page.setViewportSize({width:1920,height:1080});await page.route(/\/(?:onzetrots[^/]*|fonts|fieldflow)\//,route=>{const path=new URL(route.request().url()).pathname;return route.fulfill({body:readFileSync(join(process.cwd(),"apps/player/public",path)),contentType:path.endsWith(".ttf")?"font/ttf":path.endsWith(".woff2")?"font/woff2":path.endsWith(".svg")?"image/svg+xml":"image/webp"});});await page.route("**/__invalid-marker.ttf",route=>route.fulfill({body:"deliberately undecodable font fixture",contentType:"font/ttf"}));
 const setup=`var runtime={playbackGeneration:1,currentElement:null,pendingElement:null,currentObjectUrls:[],pendingRelease:null};window.revoked=[];window.logs=[];window.commits=0;function revokeObjectUrls(urls){window.revoked=window.revoked.concat(urls);}function log(code){window.logs.push(code);}function beginPendingMedia(root){root.style.cssText='position:absolute;inset:0;width:100%;height:100%';document.body.appendChild(root);runtime.pendingElement=root;}function commitPendingMedia(root,urls){runtime.currentElement=root;runtime.pendingElement=null;runtime.currentObjectUrls=urls;root.classList.add('visible');window.commits++;return true;}function scheduleTemplateAdvance(){}function itemDurationMs(){return 15000;}function cancelPendingMedia(){}function sourceForItem(){}function playImage(){};`;
 const transport=`var originalDocument=${JSON.stringify(result.markup)},assetReplacements=${JSON.stringify(replacements)},originalTitle=${JSON.stringify(result.input.configuration.title)};lgSitesResolveDocument=function(item,callback){callback({document:item.sitesPresentation,replacements:item.replacements},item.urls);};playSitesMarkup({id:'lg-brand-fixture',sitesPresentation:originalDocument,replacements:assetReplacements,urls:['blob:old-safe']},'',[],1);window.refreshProof=function(broken){var fresh=JSON.parse(JSON.stringify(originalDocument));fresh.pages=fresh.pages.map(function(page){return page.split(originalTitle).join('Nieuwe echte opgeslagen titel');});var replacements=Object.assign({},assetReplacements);if(broken)replacements.VEYOSITES_ASSET_a73712ce4f3b32d3c7a1a657d56c6aaf50c719b7fa7fe0541905fe77f5a9906c='/__invalid-marker.ttf';runtime.currentElement.refreshSitesData({sitesPresentation:fresh,replacements:replacements,urls:[broken?'blob:failed-next':'blob:valid-next']});};`;
 const script=setup+lgSitesRuntimeScript()+transport;
 await page.route("**/__lg-refresh-brand",route=>route.fulfill({contentType:"text/html",body:`<!doctype html><html lang="nl"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}*{box-sizing:border-box}</style><body><script>${script.replace(/<\/script/gi,"<\\/script")}</script></body></html>`}));
 await page.goto("http://127.0.0.1:3343/__lg-refresh-brand");const title=page.locator(".lg-sites-canvas.visible .uc-slide-title");await expect(title).toHaveText(result.input.configuration.title);await page.locator(".lg-sites-canvas.visible").evaluate(element=>element.setAttribute("data-instance","preserved"));
 await page.evaluate(()=>Reflect.get(window,"refreshProof")(true));await expect.poll(()=>page.evaluate(()=>Reflect.get(window,"logs"))).toContain("LEGACY_SITES_BRAND_FONT_UNAVAILABLE");await expect(title).toHaveText(result.input.configuration.title);expect(await page.evaluate(()=>Reflect.get(window,"revoked"))).not.toContain("blob:old-safe");
 // A second failed refresh must not fence the first installed frame's rollback.
 // Detached FontFace.load still runs genuinely; only its later FontFaceSet
 // acknowledgement is delayed to make the overlapping boundary deterministic.
 await page.evaluate(()=>{const load=document.fonts.load.bind(document.fonts);document.fonts.load=()=>{document.fonts.load=load;return new Promise((_resolve,reject)=>{Reflect.set(window,"rejectInstalledFont",()=>reject(Error("delayed actual font rejection")));});};Reflect.get(window,"refreshProof")(false);});
 await expect.poll(()=>page.evaluate(()=>typeof Reflect.get(window,"rejectInstalledFont"))).toBe("function");
 await page.evaluate(()=>{Reflect.get(window,"refreshProof")(true);Reflect.get(window,"rejectInstalledFont")();});
 await expect.poll(()=>page.evaluate(()=>Reflect.get(window,"logs").filter((code:string)=>code==="LEGACY_SITES_BRAND_FONT_UNAVAILABLE").length)).toBe(3);await expect(title).toHaveText(result.input.configuration.title);expect(await page.evaluate(()=>Reflect.get(window,"revoked"))).not.toContain("blob:old-safe");
 await page.evaluate(()=>Reflect.get(window,"refreshProof")(false));await expect(title).toHaveText("Nieuwe echte opgeslagen titel");await expect.poll(()=>page.evaluate(()=>Reflect.get(window,"revoked"))).toContain("blob:old-safe");await expect(page.locator('.lg-sites-canvas.visible[data-instance="preserved"]')).toBeVisible();expect(await page.evaluate(()=>Reflect.get(window,"commits"))).toBe(1);
});
