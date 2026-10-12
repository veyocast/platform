import React from "react";
import { createHash,randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium,type Browser,type Page } from "playwright-core";
import sharp from "sharp";
import {SitesStaticView} from "@veyocast/content-templates/sites-static-view";
import {sitesPresentationPages} from "@veyocast/content-templates/sites-presentation-model";
import { sitesPresentationCss } from "@veyocast/content-templates/sites-styles";
import { sitesPresentationSchema,type SitesPresentation } from "@veyocast/contracts";
import type { StudioDocument } from "@veyocast/studio";
import systemAssets from "../../../packages/content-templates/src/sites-system-assets.json";
import type { StudioSvgAssetSources } from "./studio-render-svg";
import {getSitesBrowserRenderBundle} from "./sites-dom-browser-bundle";
import type {SitesBrowserRenderInput} from "./sites-dom-browser-renderer";

export type SitesCaptureFailureStage="unknown"|"document_load"|"font_load"|"render_commit"|"dependency_decode"|"asset_integrity"|"layout_settle"|"raster_capture"|"png_encode";
export class SitesDomCaptureError extends Error {
 readonly code="studio_sites_capture_failed";
 readonly retryable=true;
 constructor(readonly failureStage:SitesCaptureFailureStage="unknown"){super("Het gecontroleerde schermvoorbeeld kon niet binnen de renderlimiet worden gemaakt.");this.name="SitesDomCaptureError";}
}
export interface SitesStudioCapture {
 renderPng(timeMs:number):Promise<Uint8Array>;
 renderRgba(timeMs:number):Promise<Uint8Array>;
 close():Promise<void>;
}
const origin="http://sites-render.invalid";
const files=new Map(systemAssets.files.map(asset=>[asset.path,asset]));
const defaultPublicDirectory=fileURLToPath(new URL("../../player/public/",import.meta.url));
const maximumAssetBytes=24*1024*1024;
const maximumSessionBytes=96*1024*1024;
/** Image downsampling can select a different cached raster under concurrent
 * raster workers. Use the same deterministic transport for Source and output.
 */
export const sitesCaptureBrowserArgs:readonly string[]=["--disable-dev-shm-usage","--no-sandbox","--num-raster-threads=1"];
/** Fit effects must first measure the audited fonts, rather than a fallback
 * whose later load can race the initial ResizeObserver callback.
 */
export async function loadSitesCaptureFonts(page:Page):Promise<void>{
 await page.evaluate(async()=>{await Promise.all(Array.from(document.fonts,face=>face.load()));await document.fonts.ready;});
}
/** Decode and equal adjacent frames can precede a later compositor repaint.
 * Require an elapsed settling period and a continuous exact raster window.
 * Call once per page, after pausing animations at the requested frame.
 */
export async function captureSettledSitesRaster(page:Page):Promise<Buffer>{
 await page.waitForTimeout(1200);
 let png=await page.screenshot({type:"png",timeout:15000});
 let hash=createHash("sha256").update(png).digest("hex"),stableSince=Date.now(),stableSamples=1;
 const deadline=Date.now()+3000;
 while(Date.now()<deadline){
  await page.waitForTimeout(100);
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  const next=await page.screenshot({type:"png",timeout:15000}),nextHash=createHash("sha256").update(next).digest("hex");
  png=next;
  if(nextHash===hash){
   stableSamples++;
   if(stableSamples>=3&&Date.now()-stableSince>=350)return png;
  }else{hash=nextHash;stableSince=Date.now();stableSamples=1;}
 }
 throw new SitesDomCaptureError();
}
/** Optional diagnostic measurements from browser bytes before PNG conversion. */
export async function measureSitesCaptureRaster(page:Page,png:Uint8Array){
 const document=await page.evaluate(()=>({viewport:{width:innerWidth,height:innerHeight,devicePixelRatio},elements:Array.from(globalThis.document.querySelectorAll("h2,p,span,strong,small,[data-fit-content],img")).map(node=>{
  const style=getComputedStyle(node),parent=node.parentElement;
  return {tag:node.tagName,className:node.className,font:style.fontFamily,size:style.fontSize,weight:style.fontWeight,variation:style.fontVariationSettings,fit:style.getPropertyValue("--led-auto-fit"),letterSpacing:style.letterSpacing,width:node.clientWidth,height:node.clientHeight,transform:style.transform,bounds:node.getBoundingClientRect().toJSON(),smoothing:style.getPropertyValue("-webkit-font-smoothing"),rendering:style.textRendering,
   ...(node instanceof HTMLImageElement?{image:{naturalWidth:node.naturalWidth,naturalHeight:node.naturalHeight,complete:node.complete,sourcePath:node.currentSrc.startsWith("data:")?"data:":node.currentSrc?new URL(node.currentSrc).pathname:"",objectFit:style.objectFit,objectPosition:style.objectPosition,imageRendering:style.imageRendering,filter:style.filter,opacity:style.opacity},parent:parent?{tag:parent.tagName,className:parent.className,transform:getComputedStyle(parent).transform,bounds:parent.getBoundingClientRect().toJSON()}:null}:{})};
 })}));
 return {...document,rawPngSha256:createHash("sha256").update(png).digest("hex"),rawPixelSha256:createHash("sha256").update(await sharp(png).removeAlpha().raw().toBuffer()).digest("hex")};
}
export function buildSitesCaptureHtml(presentation:SitesPresentation,assetSources:StudioSvgAssetSources,page=0,active=false){
 const input=sitesPresentationSchema.parse(presentation);
 const content=renderToStaticMarkup(<SitesStaticView presentation={input} page={page} active={active} includeStyles={false} resolveAsset={asset=>{
  if(asset.kind==="system")return asset.path;
  const source=assetSources[asset.mediaAssetId];const href=typeof source==="string"?source:source?.href;
  return href&&/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(href)?href:undefined;
 }}/>);
 return buildSitesCaptureFrame(input,content);
}
function buildSitesCaptureFrame(input:SitesPresentation,content:string,trustedScript?:string){
 const orientation=input.kind==="studio"?input.slide.orientation:input.configuration.orientation;
 const width=orientation==="portrait"?1080:1920,height=orientation==="portrait"?1920:1080;
 const nonce=trustedScript?randomBytes(18).toString("base64url"):undefined;
 const policy=nonce?`'nonce-${nonce}'`:"'none'";
 const script=trustedScript?`<script nonce="${nonce}">${trustedScript.replace(/<\/script/gi,"<\\/script")}</script>`:"";
 return `<!doctype html><html><head><meta charset="utf-8"><base href="${origin}/"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${origin} data:; font-src ${origin}; style-src 'unsafe-inline'; script-src ${policy}; connect-src 'none'"><style>*{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;font-family:"Inter Variable",Inter,ui-sans-serif,system-ui,sans-serif}#sites-capture{width:${width}px;height:${height}px;container-type:inline-size}${sitesPresentationCss}</style></head><body><div id="sites-capture">${content}</div>${script}</body></html>`;
}
function browserAssetSources(assetSources:StudioSvgAssetSources):Record<string,string>{
 const output:Record<string,string>={};let bytes=0;
 for(const [id,source] of Object.entries(assetSources)){
  const href=typeof source==="string"?source:source?.href;
  if(!href||!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(href))continue;
  const size=Buffer.byteLength(href);if(size>maximumAssetBytes*4/3+128)throw new SitesDomCaptureError();
  bytes+=size;if(bytes>maximumSessionBytes*4/3+1024)throw new SitesDomCaptureError();output[id]=href;
 }
 return output;
}
export async function createSitesStudioCapture({document,...options}:{document:StudioDocument;assetSources?:StudioSvgAssetSources;signal?:AbortSignal;publicDirectory?:string;executablePath?:string}):Promise<SitesStudioCapture>{
 return createSitesPresentationCapture({presentation:sitesPresentationSchema.parse(document.sitesPresentation),motionEnabled:document.motion.enabled,durationMs:document.motion.durationMs,...options});
}
/** Captures an already normalized immutable presentation; no provider or arbitrary network is available. */
export async function createSitesPresentationCapture({presentation,motionEnabled=false,durationMs,assetSources={},signal,publicDirectory=defaultPublicDirectory,executablePath=process.env.CHROMIUM_EXECUTABLE_PATH??"/usr/bin/chromium",onMeasure}:{presentation:SitesPresentation;motionEnabled?:boolean;durationMs?:number;assetSources?:StudioSvgAssetSources;signal?:AbortSignal;publicDirectory?:string;executablePath?:string;onMeasure?:(value:unknown)=>void}):Promise<SitesStudioCapture>{
 const input=sitesPresentationSchema.parse(presentation);
 const orientation=input.kind==="studio"?input.slide.orientation:input.configuration.orientation;
 const artboard={width:orientation==="portrait"?1080:1920,height:orientation==="portrait"?1920:1080};
 const totalDurationMs=durationMs??(input.kind==="studio"?input.slide.duration:input.configuration.seconds)*sitesPresentationPages(input)*1000;
 if(!Number.isFinite(totalDurationMs)||totalDurationMs<3000||totalDurationMs>120000)throw new SitesDomCaptureError();
 const browserLifecycle=(input.kind==="dynamic"&&input.configuration.provider==="led-scores"&&input.configuration.themeId==="fieldflow"&&input.configuration.ledTheme!=="fieldflow")||(input.kind==="studio"?input.slide.themeId:input.configuration.themeId)==="onzetrots-tv";
 if(signal?.aborted)throw new SitesDomCaptureError();
 const trustedBundle=browserLifecycle?await getSitesBrowserRenderBundle().catch(()=>{throw new SitesDomCaptureError();}):undefined;
 const tenantAssetSources=browserLifecycle?browserAssetSources(assetSources):{};
 const browser:Browser=await chromium.launch({args:[...sitesCaptureBrowserArgs],executablePath,headless:true,timeout:15000});
 if(signal?.aborted){await browser.close().catch(()=>undefined);throw new SitesDomCaptureError();}
 let page:Page;const close=()=>browser.close().catch(()=>undefined);const onAbort=()=>{void close();};signal?.addEventListener("abort",onAbort,{once:true});
 const deadline=setTimeout(()=>{void close();},Math.min(300000,60000+totalDurationMs*2));
 try{
  page=await browser.newPage({viewport:{width:artboard.width,height:artboard.height},deviceScaleFactor:1});
  const cache=new Map<string,Buffer>();let sessionBytes=0;let requests=0;let assetFailed=false;
  await page.route("**/*",async route=>{
   const url=new URL(route.request().url());const asset=files.get(url.pathname);
   requests++;if(requests>1000||url.origin!==origin||url.search||!asset||asset.bytes>maximumAssetBytes){assetFailed=true;await route.abort();return;}
   try{let bytes=cache.get(asset.path);if(!bytes){bytes=await readFile(resolve(publicDirectory,asset.path.slice(1)));if(bytes.byteLength!==asset.bytes||createHash("sha256").update(bytes).digest("hex")!==asset.sha256)throw new SitesDomCaptureError();sessionBytes+=bytes.byteLength;if(sessionBytes>maximumSessionBytes)throw new SitesDomCaptureError();cache.set(asset.path,bytes);}await route.fulfill({body:bytes,contentType:asset.mimeType,status:200});}catch{assetFailed=true;await route.abort();}
  });
  page.on("pageerror",()=>{assetFailed=true;});
  let currentPage=-1;let animationEndTime=0;let capturedKey="";let capturedPng:Buffer|undefined;let rgbaKey="";let capturedRgba:Buffer|undefined;let failureStage:SitesCaptureFailureStage="document_load";
  const capture=async(timeMs:number)=>{
   if(signal?.aborted)throw new SitesDomCaptureError();
   const pageSeconds=input.kind==="studio"?input.slide.duration:input.configuration.seconds;
   const targetPage=Math.min(sitesPresentationPages(input)-1,Math.max(0,Math.floor(timeMs/(pageSeconds*1000))));
   if(currentPage!==targetPage){
    // A nonce-bearing document is initialized once. Repeated document.write()
    // retains earlier meta-CSP policies and would reject the next trusted nonce.
    // Subsequent data pages update the same fixed React root instead.
    failureStage="document_load";
    if(!trustedBundle||currentPage===-1)await page.setContent(trustedBundle?buildSitesCaptureFrame(input,"",trustedBundle):buildSitesCaptureHtml(input,assetSources,targetPage,motionEnabled),{timeout:15000,waitUntil:"domcontentloaded"});
    if(trustedBundle){
     failureStage="font_load";
     await loadSitesCaptureFonts(page);
     const renderInput:SitesBrowserRenderInput={presentation:input,page:targetPage,active:motionEnabled,tenantAssetSources};
     failureStage="render_commit";
     await page.evaluate(value=>(globalThis as typeof globalThis & {startSitesRender:(input:SitesBrowserRenderInput)=>void}).startSitesRender(value),renderInput);
     await page.waitForFunction(expected=>document.getElementById("sites-capture")!.dataset.sitesPage===String(expected),targetPage,{timeout:10000});
    }
    failureStage="dependency_decode";
    await page.evaluate(async()=>{await globalThis.document.fonts.ready;await Promise.all(Array.from(globalThis.document.images).map(img=>img.decode()));await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));});
    currentPage=targetPage;animationEndTime=await page.evaluate(()=>Math.max(0,...globalThis.document.getAnimations().map(animation=>Number(animation.effect?.getComputedTiming().endTime??0))));
   }
   if(assetFailed)throw new SitesDomCaptureError("asset_integrity");
   const localTime=Math.min(timeMs%(pageSeconds*1000),animationEndTime);
   const key=`${targetPage}:${localTime}`;if(capturedPng&&capturedKey===key)return capturedPng;
   await page.evaluate(({frameTime,browserLifecycle})=>{globalThis.document.getAnimations().forEach(animation=>{animation.pause();animation.currentTime=frameTime;});
    if(!browserLifecycle)globalThis.document.querySelectorAll<HTMLElement>('[data-fit-box]').forEach(box=>{
     const inner=box.querySelector<HTMLElement>('[data-fit-content]');if(!inner)return;
     const base=inner.getBoundingClientRect(),ratio=base.width/Math.max(1,inner.offsetWidth)||1;
     const bounds=[base,...Array.from(inner.children).map(child=>child.getBoundingClientRect())];
     const width=Math.max(inner.scrollWidth,inner.offsetWidth,(Math.max(...bounds.map(rect=>rect.right))-Math.min(...bounds.map(rect=>rect.left)))/ratio,1);
     const height=Math.max(inner.scrollHeight,inner.offsetHeight,(Math.max(...bounds.map(rect=>rect.bottom))-Math.min(...bounds.map(rect=>rect.top)))/ratio,1);
     inner.style.setProperty('--led-auto-fit',String(Math.max(.01,Math.min(1,box.clientWidth/(width*1.035),box.clientHeight/(height*1.08)))));
    });},{frameTime:localTime,browserLifecycle});

   failureStage="layout_settle";
   if(browserLifecycle&&capturedKey.split(":")[0]!==String(targetPage))await page.evaluate(async()=>{
    // The commit marker proves the requested page exists. Source components
    // can still commit font/ResizeObserver-based fit updates afterwards.
    // Observe the actual layout instead of acknowledging its first RAF.
    const deadline=performance.now()+2000;let previous="";let stableFrames=0;
    while(performance.now()<deadline){
     await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
     const frame=JSON.stringify(Array.from(document.querySelectorAll<HTMLElement>("#sites-capture,h1,h2,h3,p,strong,img,[data-fit-content]")).map(element=>{
      const box=element.getBoundingClientRect(),style=getComputedStyle(element);
      return [box.x,box.y,box.width,box.height,style.fontSize,style.fontFamily,style.transform,style.getPropertyValue("--led-auto-fit")];
     }));
     if(document.fonts.status!=="loaded"){await document.fonts.ready;stableFrames=0;previous="";continue;}
     stableFrames=frame===previous?stableFrames+1:0;previous=frame;
     if(stableFrames>=3)return;
    }
    throw Error("sites_layout_did_not_settle");
   });

   await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
   // Initial pages need an elapsed quiet raster window. Later video frames
   // retain their explicit timeline and do not repeat the page settling wait.
   failureStage="raster_capture";
   const png=capturedKey.split(":")[0]!==String(targetPage)
    ?await captureSettledSitesRaster(page):await page.screenshot({type:"png",timeout:15000});
   if(assetFailed)throw new SitesDomCaptureError("asset_integrity");
   if(onMeasure)onMeasure(await measureSitesCaptureRaster(page,png));
   capturedPng=png;capturedKey=key;return capturedPng;
  };
  const safeFailure=(error:unknown)=>error instanceof SitesDomCaptureError&&error.failureStage!=="unknown"?error:new SitesDomCaptureError(failureStage);
  return {renderPng:async time=>{try{const png=await capture(time);failureStage="png_encode";return await sharp(png).toColourspace("srgb").withIccProfile("srgb").png().toBuffer();}catch(error){throw safeFailure(error);}},renderRgba:async time=>{try{const png=await capture(time);if(capturedRgba&&rgbaKey===capturedKey)return capturedRgba;failureStage="png_encode";capturedRgba=await sharp(png).ensureAlpha().raw().toBuffer();rgbaKey=capturedKey;return capturedRgba;}catch(error){throw safeFailure(error);}},close:async()=>{clearTimeout(deadline);signal?.removeEventListener("abort",onAbort);await close();}};
 }catch{clearTimeout(deadline);signal?.removeEventListener("abort",onAbort);await close();throw new SitesDomCaptureError();}
}
