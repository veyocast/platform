import {Script} from "node:vm";
import {describe,expect,it,vi} from "vitest";
import systemAssets from "../../../../packages/content-templates/src/sites-system-assets.json";
import {lgSitesRuntimeScript} from "./lg-sites-runtime";
import {lgSitesYouTubeScript} from "./lg-sites-youtube";
import {renderLgLegacyHtml} from "./lg-legacy-page";
import {mediaFrameClubmuurAsset} from "./player-media-frame";

type RuntimeContext=Record<string,unknown>;
const uuid=(value:number)=>`00000000-0000-4000-8000-${String(value).padStart(12,"0")}`;
const hash="a".repeat(64);
function envelope(id=1){return {manifest:{schemaVersion:1,tenantId:uuid(100),playlistId:uuid(id+10),releaseId:uuid(id),items:[{id:uuid(id+20),kind:"image",source:{url:"/verified.png",bytes:4,checksumSha256:hash,mimeType:"image/png"}}]},device:{id:uuid(200),screenId:uuid(300)},target:{revision:"4"}};}
function composition(){return {...envelope(),composition:{published:{id:uuid(400),revision:1,configuration:{schemaVersion:1,layout:"three",orientation:"landscape",mainWidthPercent:70,bottomHeightPercent:20,zones:["main","side","bottom"].map((id,index)=>({id,playlistId:uuid(index+11)}))},bindings:["main","side","bottom"].map((zoneId,index)=>({zoneId,playlistId:uuid(index+11),releaseId:uuid(index+1)}))},zones:{side:envelope(2),bottom:envelope(3)}}};}
/** Exercise the generated ES5 functions, rather than rewriting their rules in TS. */
function context(extra:RuntimeContext={}){
 const value:RuntimeContext={CONFIG:{cachePathPrefix:"/__veyocast-player-cache/",sitesSystemAssets:systemAssets.files,mediaFrameClubmuurAsset},nextItem:vi.fn(),request:vi.fn(),requestDynamicManifestCheck:vi.fn(),revokeObjectUrls:vi.fn(),...extra};
 new Script(`
  var callbacks={}, queued=[], commits=[], failures=[];
  var runtime={playbackGeneration:1,currentElement:{old:true},pendingElement:null,envelope:null,deviceToken:"fixture-device-token",offline:false};
  var window={frameElement:null,setTimeout:function(fn){queued.push(fn);return queued.length;},clearTimeout:function(){}};
  var document={documentElement:{outerHTML:"<html>standalone</html>"},createElement:function(tag){
   var element={tagName:tag.toUpperCase(),style:{},attributes:{},children:[],setAttribute:function(name,value){this.attributes[name]=value;},getAttribute:function(name){return this.attributes[name];},appendChild:function(child){this.children.push(child);child.parentNode=this;},removeChild:function(child){this.children=this.children.filter(function(candidate){return candidate!==child;});child.parentNode=null;}};
   if(tag==="iframe"){element.contentDocument={open:function(){},write:function(){},close:function(){}};element.contentWindow={__veyocastLgZone:{initialize:function(envelope,index,value){callbacks[element.attributes["data-lg-composition-zone"]]=value;},refresh:function(envelope){element.refreshed=envelope;},acceptData:function(envelope){element.accepted=envelope;},resume:function(){element.resumed=(element.resumed||0)+1;},pause:function(paused){element.paused=paused;},dispose:function(){element.disposed=true;}}};}return element;
  }};
  function isManifestEnvelope(entry){return Boolean(entry&&entry.manifest&&entry.manifest.releaseId&&entry.device&&Array.isArray(entry.manifest.items));}
  function releaseIdOf(entry){return entry&&entry.manifest&&entry.manifest.releaseId;}
  function beginPendingMedia(root){runtime.pendingElement=root;}
  function commitPendingMedia(root){commits.push(root);runtime.currentElement=root;runtime.pendingElement=null;return true;}
  function cancelPendingMedia(){if(runtime.pendingElement)runtime.pendingElement.lgCleanup();runtime.pendingElement=null;}
  function failItem(code){failures.push(code);}
  function clearPlaybackTimers(){}
  function silenceCurrentMediaEvents(){}
  ${lgSitesRuntimeScript()}
  ${lgSitesYouTubeScript()}
 `).runInNewContext(value);
 return value;
}

it("requires decoded Marker faces for branded LG frames while preserving the nonbrand font boundary",async()=>{
 const load=vi.fn().mockResolvedValue([{status:"loaded"}]),value=context({fontLoad:load});
 evaluate(value,'document.fonts={ready:Promise.resolve(),load:fontLoad};var brandRoot={querySelector:function(){return true;}};var fieldRoot={querySelector:function(){return false;}}');
 await expect(evaluate(value,"lgSitesLoadBrandFont(brandRoot)")).resolves.toBeUndefined();expect(load).toHaveBeenCalledWith("400 24px OTMarker");load.mockResolvedValue([{status:"error"}]);
 await expect(evaluate(value,"lgSitesLoadBrandFont(brandRoot)")).rejects.toThrow("LEGACY_SITES_BRAND_FONT_UNAVAILABLE");load.mockClear();await expect(evaluate(value,"lgSitesLoadBrandFont(fieldRoot)")).resolves.toBeUndefined();expect(load).not.toHaveBeenCalled();
});

it("predecodes fresh LG Marker bytes without installing or mutating a visible font face",async()=>{
 const decode=vi.fn().mockResolvedValue({status:"loaded"}),value=context({decode});
 evaluate(value,'window.FontFace=function(family,source){this.load=function(){return decode(family,source);}};var branded={pages:[\'<div class="uc-slide" data-theme="onzetrots-tv"></div>\']};var fontCss=\'@font-face{font-family:OTMarker;src:url("blob:new-verified-font");font-weight:400}\';');
 await expect(evaluate(value,"lgSitesDecodeBrandFont(branded,fontCss)")).resolves.toBeDefined();expect(decode).toHaveBeenCalledWith("OTMarker",'url("blob:new-verified-font")');
 decode.mockRejectedValue(new Error("decode failed"));await expect(evaluate(value,"lgSitesDecodeBrandFont(branded,fontCss)")).rejects.toThrow("decode failed");
 await expect(evaluate(value,'lgSitesDecodeBrandFont(branded,"body{color:red}")')).rejects.toThrow("LEGACY_SITES_BRAND_FONT_UNAVAILABLE");
});
function evaluate<T=unknown>(value:RuntimeContext,code:string){return new Script(code).runInNewContext(value) as T;}
function loadAssets(value:RuntimeContext){const html=renderLgLegacyHtml();const source=html.slice(html.indexOf("    function cacheAsset("),html.indexOf("    function sha256Hex("));const validator=html.slice(html.indexOf("var validMediaFrameBackground ="),html.indexOf("var normalizeLgSitesCss ="));evaluate(value,`${validator} function playableItems(entry){return entry.manifest.items;} function releaseAssetItems(entry){return entry.manifest.items;} function templateRecord(entry){return entry;} ${source}`);}

describe("Standalone LG Sites compositor",()=>{
 it("keeps an unchanged zone clock running while a different zone waits for new facts",()=>{
  const value=context();value.input=composition();value.fresh=composition();
  evaluate(value,'fresh.composition.zones.side.manifest.items[0].dynamicTemplate={snapshotHash:"new-data"};lgCompositionStart(input,1);["main","side","bottom"].forEach(function(id){callbacks[id].ready({id:id},0);});runtime.pendingRelease={envelope:fresh};');
  expect(evaluate(value,'callbacks.main.boundary()')).toBe(false);expect(evaluate(value,'callbacks.bottom.boundary()')).toBe(false);
  expect(evaluate(value,'callbacks.side.boundary()')).toBe(true);
 });
 it.each([true,false])("resumes a Sites page in place after its facts refresh succeeds=%s",installed=>{
  const page=vi.fn(),play=vi.fn(),ready=vi.fn();
  const value=context({page,playCurrent:play,playableItems:(entry:ReturnType<typeof envelope>)=>entry.manifest.items,ready,refreshSitesData:vi.fn((_item,callback)=>callback(installed))});value.input=envelope();value.fresh=envelope();
  evaluate(value,'fresh.manifest.items[0].sitesPresentation={};runtime.activeIndex=0;runtime.envelope=input;runtime.currentElement={refreshSitesData:refreshSitesData};legacyIsCompositionZone=true;legacyZoneCallbacks={boundary:function(){return true;},ready:ready};lgZoneBoundary(page);lgInstallZoneBridge();window.__veyocastLgZone.acceptData(fresh)');
  expect(page).toHaveBeenCalledTimes(1);expect(play).not.toHaveBeenCalled();expect(value.nextItem).not.toHaveBeenCalled();
  expect(ready).toHaveBeenCalledTimes(installed?1:0);expect(evaluate(value,'runtime.envelope===fresh')).toBe(installed);expect(evaluate(value,'runtime.playbackGeneration')).toBe(1);
 });
 it("resumes a cancelled Sites page hold without advancing its playlist item",()=>{
  const page=vi.fn(),value=context({page});
  evaluate(value,'legacyIsCompositionZone=true;legacyZoneCallbacks={boundary:function(){return true;}};lgZoneBoundary(page);lgInstallZoneBridge();window.__veyocastLgZone.resume()');
  expect(page).toHaveBeenCalledTimes(1);expect(value.nextItem).not.toHaveBeenCalled();
 });
 it("accepts a verified side-only dataset at its own boundary while preserving the main decoder and clock",()=>{
  const value=context({persistRelease:vi.fn((_envelope,_assets,callback)=>callback(null)),setState:vi.fn(),sendHeartbeat:vi.fn()});
  value.input=composition();value.fresh=composition();evaluate(value,'fresh.composition.zones.side.manifest.items[0].dynamicTemplate={snapshotHash:"new-data"};lgCompositionStart(input,1);["main","side","bottom"].forEach(function(id){callbacks[id].ready({id:id},0);});var originalRoot=runtime.currentElement;runtime.envelope=input;runtime.targetGeneration=1;runtime.pendingRelease={envelope:fresh,assets:[],generation:1};callbacks.side.boundary()');
  expect(evaluate(value,'lgCompositionApplyPendingData()')).toBe(true);
  expect(evaluate(value,'runtime.currentElement===originalRoot')).toBe(true);expect(evaluate(value,'runtime.pendingRelease')).toBeNull();
  expect(evaluate(value,'runtime.currentElement.lgComposition.frames[0].accepted')).toBeUndefined();
  expect(evaluate(value,'runtime.currentElement.lgComposition.frames[1].accepted.manifest.releaseId')).toBe(uuid(2));
  expect(evaluate(value,'runtime.currentElement.lgComposition.frames[2].accepted')).toBeUndefined();
  expect(value.persistRelease).toHaveBeenCalledTimes(1);expect(value.nextItem).not.toHaveBeenCalled();
 });
 it("commits changed main facts at only its own boundary while unchanged side clocks remain installed",()=>{
  const value=context({persistRelease:vi.fn((_envelope,_assets,callback)=>callback(null)),setState:vi.fn(),sendHeartbeat:vi.fn()});
  value.input=composition();value.fresh=composition();evaluate(value,'fresh.manifest.items[0].dynamicTemplate={snapshotHash:"empty-main-2"};lgCompositionStart(input,1);["main","side","bottom"].forEach(function(id){callbacks[id].ready({id:id},0);});var originalRoot=runtime.currentElement;runtime.envelope=input;runtime.targetGeneration=1;runtime.pendingRelease={envelope:fresh,assets:[],generation:1};');
  expect(evaluate(value,'callbacks.side.boundary()')).toBe(false);expect(evaluate(value,'callbacks.bottom.boundary()')).toBe(false);
  expect(evaluate(value,'callbacks.main.boundary()')).toBe(true);expect(evaluate(value,'lgCompositionApplyPendingData()')).toBe(true);
  expect(evaluate(value,'runtime.currentElement===originalRoot')).toBe(true);expect(evaluate(value,'runtime.currentElement.lgComposition.frames[0].accepted===fresh')).toBe(true);
  expect(evaluate(value,'runtime.currentElement.lgComposition.frames[1].accepted')).toBeUndefined();expect(evaluate(value,'runtime.currentElement.lgComposition.frames[2].accepted')).toBeUndefined();
  expect(value.persistRelease).toHaveBeenCalledTimes(1);expect(value.nextItem).not.toHaveBeenCalled();
 });
 it("retains and resumes the current composition if persisting verified zone facts fails",()=>{
  const value=context({persistRelease:vi.fn((_envelope,_assets,callback)=>callback("STORAGE_FAILED"))});value.input=composition();value.fresh=composition();
  evaluate(value,'fresh.composition.zones.side.manifest.items[0].dynamicTemplate={snapshotHash:"new-data"};lgCompositionStart(input,1);["main","side","bottom"].forEach(function(id){callbacks[id].ready({id:id},0);});var originalRoot=runtime.currentElement;runtime.envelope=input;runtime.targetGeneration=1;runtime.pendingRelease={envelope:fresh,assets:[],generation:1};callbacks.side.boundary();lgCompositionApplyPendingData()');
  expect(evaluate(value,'runtime.currentElement===originalRoot')).toBe(true);expect(evaluate(value,'runtime.envelope===input')).toBe(true);expect(evaluate(value,'runtime.currentElement.lgComposition.frames.every(function(frame){return frame.resumed===1;})')).toBe(true);
 });
 it("shares actual zone activations through the parent and excludes an uncommitted preparation",()=>{
  const value=context();value.input=composition();evaluate(value,'lgCompositionStart(input,1);callbacks.main.ready({id:"main"},0);callbacks.main.activated();callbacks.side.ready({id:"side"},0);callbacks.side.activated()');
  expect(value.requestDynamicManifestCheck).not.toHaveBeenCalled();
  evaluate(value,'callbacks.bottom.ready({id:"bottom"},0)');expect(value.requestDynamicManifestCheck).toHaveBeenCalledTimes(1);
  evaluate(value,'callbacks.side.activated()');expect(value.requestDynamicManifestCheck).toHaveBeenCalledTimes(2);
  evaluate(value,'runtime.playbackGeneration=2;callbacks.side.activated()');expect(value.requestDynamicManifestCheck).toHaveBeenCalledTimes(2);
 });
 it("uses the published geometry while preserving a scheduled main release",()=>{const value=context();const input=composition();input.manifest.releaseId=uuid(99);value.input=input;expect(evaluate(value,'lgCompositionZones(input).map(function(zone){return [zone.id,zone.left,zone.top,zone.width,zone.height];})')).toEqual([["main",0,0,70,80],["side",70,0,30,80],["bottom",0,80,100,20]]);});
 it.each(["tenantId","releaseId","playlistId"])("rejects a child with an unauthorized %s",field=>{const value=context();const input=composition();Reflect.set(input.composition.zones.side.manifest,field,uuid(999));value.input=input;expect(evaluate(value,'lgCompositionZones(input)')).toBeNull();});
 it("rejects duplicate or missing named bindings and percentages outside the contract",()=>{const value=context();value.input=composition();evaluate(value,'input.composition.published.bindings[1].zoneId="main"');expect(evaluate(value,'lgCompositionZones(input)')).toBeNull();evaluate(value,'input.composition.published.bindings[1].zoneId="side"; input.composition.published.configuration.mainWidthPercent=73');expect(evaluate(value,'lgCompositionZones(input)')).toBeNull();});
 it("verifies the union of all zone content and the exact locked system manifest",()=>{const value=context();loadAssets(value);value.input=composition();value.system=systemAssets.files.map(asset=>({path:asset.path,checksumSha256:asset.sha256,bytes:asset.bytes,mimeType:asset.mimeType}));evaluate(value,'input.manifest.systemAssets=system');expect(evaluate(value,'releaseAssets(input)')).toHaveLength(3+systemAssets.files.length);evaluate(value,'input.manifest.systemAssets[0].checksumSha256="b".repeat(64)');expect(evaluate(value,'releaseAssets(input)')).toBeNull();});
 it("rejects missing or duplicated system assets before canonical markup can activate",()=>{const value=context();loadAssets(value);value.input=envelope();evaluate(value,'input.manifest.items[0].sitesPresentation={rendererVersion:"sites-v11"}');expect(evaluate(value,'releaseAssets(input)')).toBeNull();value.system=systemAssets.files.map(asset=>({path:asset.path,checksumSha256:asset.sha256,bytes:asset.bytes,mimeType:asset.mimeType}));evaluate(value,'input.manifest.systemAssets=system; input.manifest.systemAssets[1]=input.manifest.systemAssets[0]');expect(evaluate(value,'releaseAssets(input)')).toBeNull();});
 it("restores legacy cache metadata without MIME only when the entire immutable envelope union still matches",()=>{
  const value=context({openAssetCache:(callback:(error:null,cache:object)=>void)=>callback(null,{}),inspectCachedAssets:(_cache:unknown,_assets:unknown,callback:(error:null,missing:unknown[])=>void)=>callback(null,[]),validated:vi.fn()});loadAssets(value);const html=renderLgLegacyHtml();const start=html.indexOf("    function validateCachedRelease(");const end=html.indexOf("    function readCachedRelease(",start);evaluate(value,html.slice(start,end));value.input=composition();evaluate(value,'input.composition.zones.side.manifest.items[0].source.checksumSha256="b".repeat(64);input.composition.zones.bottom.manifest.items[0].source.checksumSha256="c".repeat(64)');
  evaluate(value,'var cached={envelope:input,assets:releaseAssets(input).map(function(asset){return {cacheKey:asset.cacheKey,bytes:asset.bytes,checksumSha256:asset.checksumSha256};})};validateCachedRelease(cached,validated)');expect(value.validated).toHaveBeenLastCalledWith(true);
  evaluate(value,'cached.assets.pop();validateCachedRelease(cached,validated)');expect(value.validated).toHaveBeenLastCalledWith(false);
  evaluate(value,'cached.assets=releaseAssets(input);cached.assets[0].mimeType="image/jpeg";validateCachedRelease(cached,validated)');expect(value.validated).toHaveBeenLastCalledWith(false);
 });
 it("includes side-zone source changes in identity without changing the main release",()=>{const value=context();value.old=composition();value.fresh=composition();evaluate(value,'fresh.composition.zones.side.manifest.items[0].dynamicTemplate={snapshotHash:"new-database-data"}');expect(evaluate(value,'lgCompositionIdentity(old)')).toBe(evaluate(value,'lgCompositionIdentity(fresh)'));expect(evaluate(value,'lgEnvelopeDataIdentity(old)')).not.toBe(evaluate(value,'lgEnvelopeDataIdentity(fresh)'));});
 it("keeps the old composition until every zone has an actual first frame and only then acknowledges",()=>{const value=context();value.input=composition();evaluate(value,'var old=runtime.currentElement;lgCompositionStart(input,1);callbacks.main.ready({id:"main-item"},0);callbacks.side.ready({id:"side-item"},0);lgCompositionAck()');expect(evaluate(value,'commits')).toHaveLength(0);expect(evaluate(value,'runtime.currentElement===old')).toBe(true);expect(value.request).not.toHaveBeenCalled();evaluate(value,'callbacks.bottom.ready({id:"bottom-item"},0)');expect(evaluate(value,'commits')).toHaveLength(1);evaluate(value,'lgCompositionAck()');expect(value.request).toHaveBeenCalledWith("POST","/api/player/composition/ack",expect.objectContaining({Authorization:"Bearer fixture-device-token"}),JSON.stringify({compositionId:uuid(400),targetRevision:"4"}),expect.any(Function));evaluate(value,'lgCompositionAck()');expect(value.request).toHaveBeenCalledTimes(1);});
 it("preserves the visible release when a pending zone fails or its generation is superseded",()=>{const value=context();value.input=composition();evaluate(value,'var old=runtime.currentElement;lgCompositionStart(input,1);callbacks.main.ready({id:"main"},0);callbacks.side.failed()');expect(evaluate(value,'runtime.currentElement===old')).toBe(true);expect(evaluate(value,'commits')).toHaveLength(0);expect(evaluate(value,'failures')).toEqual(["LEGACY_COMPOSITION_FRAME_UNAVAILABLE"]);const second=context();second.input=composition();evaluate(second,'lgCompositionStart(input,1);runtime.playbackGeneration=2;["main","side","bottom"].forEach(function(id){callbacks[id].ready({id:id},0);})');expect(evaluate(second,'commits')).toHaveLength(0);});
 it("activates once after all independent clocks reach their natural boundary",()=>{const value=context();value.input=composition();evaluate(value,'lgCompositionStart(input,1);["main","side","bottom"].forEach(function(id){callbacks[id].ready({id:id},0);});runtime.pendingRelease={envelope:input};callbacks.main.boundary();callbacks.side.boundary()');expect(value.nextItem).not.toHaveBeenCalled();evaluate(value,'callbacks.bottom.boundary();callbacks.bottom.boundary()');expect(evaluate(value,'queued')).toHaveLength(2);evaluate(value,'queued[1]()');expect(value.nextItem).toHaveBeenCalledTimes(1);});
 it("resumes held zones when a pending target is cancelled and pauses every zone for a goal",()=>{const value=context();value.input=composition();evaluate(value,'lgCompositionStart(input,1);["main","side","bottom"].forEach(function(id){callbacks[id].ready({id:id},0);});lgCompositionPause(true)');expect(evaluate(value,'runtime.currentElement.lgComposition.frames.every(function(frame){return frame.paused===true;})')).toBe(true);evaluate(value,'runtime.pendingRelease=null;lgCompositionCancelBoundary()');expect(evaluate(value,'runtime.currentElement.lgComposition.frames.every(function(frame){return frame.resumed===1;})')).toBe(true);});
 it("identifies unchanged local Sites pages independently of token ordering and detects every displayed change",()=>{
  const value=context();const document={rendererVersion:"sites-v11",sourceRevision:systemAssets.sourceRevision,orientation:"landscape",width:1920,height:1080,pageDurationSeconds:4,pages:["<h1>First</h1>","<h1>Second</h1>"],css:"h1{color:red}",assetTokens:[{token:`VEYOSITES_ASSET_${hash}`,cacheKey:`/__veyocast-player-cache/${hash}`},{token:`VEYOSITES_ASSET_${"b".repeat(64)}`,cacheKey:`/__veyocast-player-cache/${"b".repeat(64)}`}]};
  value.before=document;value.after=structuredClone(document);expect(evaluate(value,"lgSitesSameDocument(before,after)")).toBe(true);
  value.after={...document,assetTokens:[...document.assetTokens].reverse()};expect(evaluate(value,"lgSitesSameDocument(before,after)")).toBe(true);
  for(const patch of [{css:"h1{color:blue}"},{pages:["<h1>Changed</h1>",document.pages[1]]},{pages:[document.pages[0]]},{pageDurationSeconds:5},{orientation:"portrait",width:1080,height:1920},{assetTokens:[]},{assetTokens:[null]},{rendererVersion:"sites-v17",sourceRevision:"6800bc858436ba0843eaea89b682cd5b43c3521d"}]){value.after={...document,...patch};expect(evaluate(value,"lgSitesSameDocument(before,after)")).toBe(false);}
 });
 it("requires canonical source provenance and resolves only checksum-addressed local tokens",()=>{const callback=vi.fn();const value=context({cachedAssetUrl:(_source:unknown,callback:(url:string,objectUrl:string)=>void)=>callback("blob:verified","blob:verified"),callback});value.input={sitesPresentation:{rendererVersion:"sites-v11",sourceRevision:systemAssets.sourceRevision,orientation:"landscape",width:1920,height:1080,pages:["<div>escaped data</div>"],css:"",assetTokens:[{token:`VEYOSITES_ASSET_${hash}`,cacheKey:`/__veyocast-player-cache/${hash}`}]}};evaluate(value,'lgSitesResolveDocument(input,callback)');expect(callback).toHaveBeenCalledWith(expect.objectContaining({replacements:{[`VEYOSITES_ASSET_${hash}`]:"blob:verified"}}),["blob:verified"]);evaluate(value,'input.sitesPresentation.assetTokens[0].cacheKey="https://provider.example/unverified"');callback.mockClear();evaluate(value,'lgSitesResolveDocument(input,callback)');expect(callback).toHaveBeenCalledWith(null,[]);evaluate(value,'input.sitesPresentation.sourceRevision="untrusted"');expect(evaluate(value,'lgSitesValidDocument(input.sitesPresentation)')).toBe(false);});
 it("accepts only the exact v17 renderer and source pair",()=>{const value=context();value.input={rendererVersion:"sites-v17",sourceRevision:"6800bc858436ba0843eaea89b682cd5b43c3521d",orientation:"portrait",width:1080,height:1920,pages:["<div>v17</div>"],css:"",assetTokens:[]};expect(evaluate(value,"lgSitesValidDocument(input)")).toBe(true);evaluate(value,'input.sourceRevision="b1cae899af19fc39908217253094c5240d7359fc"');expect(evaluate(value,"lgSitesValidDocument(input)")).toBe(false);evaluate(value,'input.rendererVersion="sites-v11";input.sourceRevision="6800bc858436ba0843eaea89b682cd5b43c3521d"');expect(evaluate(value,"lgSitesValidDocument(input)")).toBe(false);});
 it("retains official YouTube occurrence order, skips unavailable IDs and obeys repeat/boundary policy",()=>{const value=context();value.videos=["abcdefghijk","lmnopqrstuv","abcdefghijk"];expect(evaluate(value,'lgYouTubeNextIndex(videos,0,{},false,false)')).toBe(1);expect(evaluate(value,'lgYouTubeNextIndex(videos,1,{},false,false)')).toBe(2);expect(evaluate(value,'lgYouTubeNextIndex(videos,2,{},false,false)')).toBeNull();expect(evaluate(value,'lgYouTubeNextIndex(videos,2,{},true,false)')).toBe(0);expect(evaluate(value,'lgYouTubeNextIndex(videos,0,{lmnopqrstuv:true},false,false)')).toBe(2);expect(evaluate(value,'lgYouTubeNextIndex(videos,0,{},true,true)')).toBeNull();});
 it("rejects incomplete YouTube metadata instead of using an arbitrary provider URL",()=>{const value=context();expect(evaluate(value,'lgYouTubeBinding({onlinePlayback:{kind:"youtube",privacyEnhanced:true,videoId:"abcdefghijk",playlistVideoIds:["lmnopqrstuv"],playlistRepeat:true}})')).toBeNull();expect(evaluate(value,'lgYouTubeBinding({onlinePlayback:{kind:"youtube",privacyEnhanced:true,videoId:"https://bad"}})')).toBeNull();});
});

it('validates the explicit binary decoder and refuses protocol 2 or mismatched complete bytes',()=>{
 const value=context();value.item={...envelope().manifest.items[0],syncDynamicBinary:{schemaVersion:1,configurationSnapshotId:uuid(1),snapshotId:uuid(2),templateVersionId:uuid(3),configurationHash:hash,contentHash:'b'.repeat(64),fallbackChecksumSha256:hash,durationMs:3000,dataRevision:1}};
 expect(evaluate(value,'lgSyncBinaryValid(item)')).toBe(true);expect(evaluate(value,'lgSyncBinaryFrame(item)')).toMatchObject({schemaVersion:1,transport:'binary',dataRevision:1,contentHash:'b'.repeat(64)});
 evaluate(value,'item.syncDynamicBinary.schemaVersion=2');expect(evaluate(value,'lgSyncBinaryValid(item)')).toBe(false);
 evaluate(value,'item.syncDynamicBinary.schemaVersion=1;item.syncDynamicBinary.fallbackChecksumSha256="f".repeat(64)');expect(evaluate(value,'lgSyncBinaryValid(item)')).toBe(false);
 evaluate(value,'item.syncDynamicBinary.fallbackChecksumSha256=item.source.checksumSha256;item.syncDynamicBinary.presentation={}');expect(evaluate(value,'lgSyncBinaryValid(item)')).toBe(false);
});
it('distinguishes source facts within one frozen release and rejects regressed or forged revisions',()=>{
 const value=context();const before=envelope();value.before=before;value.after=JSON.parse(JSON.stringify(before));
 evaluate(value,'before.manifest.items[0].syncDynamicBinary={schemaVersion:1,configurationSnapshotId:"'+uuid(1)+'",templateVersionId:"'+uuid(2)+'",configurationHash:"'+hash+'",contentHash:"'+hash+'",dataRevision:2};after.manifest.items[0].syncDynamicBinary=JSON.parse(JSON.stringify(before.manifest.items[0].syncDynamicBinary));after.manifest.items[0].syncDynamicBinary.dataRevision=3;after.manifest.items[0].syncDynamicBinary.contentHash="b".repeat(64)');
 expect(evaluate(value,'lgEnvelopeDataIdentity(before)!==lgEnvelopeDataIdentity(after)')).toBe(true);expect(evaluate(value,'lgSyncBinaryContinuity(before,after)')).toBe(true);
 evaluate(value,'after.manifest.items[0].syncDynamicBinary.dataRevision=1');expect(evaluate(value,'lgSyncBinaryContinuity(before,after)')).toBe(false);
 evaluate(value,'after.manifest.items[0].syncDynamicBinary.dataRevision=2');expect(evaluate(value,'lgSyncBinaryContinuity(before,after)')).toBe(false);
 evaluate(value,'after.manifest.items[0].syncDynamicBinary.dataRevision=3;after.manifest.items[0].syncDynamicBinary.configurationHash="f".repeat(64)');expect(evaluate(value,'lgSyncBinaryContinuity(before,after)')).toBe(false);
});
it('retains side-zone binary revision ordering when only the main publication changes',()=>{
 const value=context();value.before=composition();value.after=composition();
 evaluate(value,'var side=before.composition.zones.side.manifest.items[0];side.syncDynamicBinary={schemaVersion:1,configurationSnapshotId:"'+uuid(1)+'",templateVersionId:"'+uuid(2)+'",configurationHash:"'+hash+'",contentHash:"'+hash+'",dataRevision:2};after.composition.zones.side.manifest.items[0].syncDynamicBinary=JSON.parse(JSON.stringify(side.syncDynamicBinary));after.manifest.releaseId="'+uuid(900)+'";after.composition.zones.side.manifest.items[0].syncDynamicBinary.dataRevision=1');
 expect(evaluate(value,'lgSyncBinaryContinuity(before,after)')).toBe(false);
 evaluate(value,'after.composition.zones.side.manifest.items[0].syncDynamicBinary.dataRevision=2');
 expect(evaluate(value,'lgSyncBinaryContinuity(before,after)')).toBe(true);
});
it('validates historical source identity without changing its strict legacy payload and rejects stale or forged observations',()=>{
 const value=context();value.item=envelope().manifest.items[0];
 evaluate(value,'item.dynamicTemplate={snapshotId:"'+uuid(1)+'",templateVersionId:"'+uuid(2)+'",snapshotHash:"'+hash+'",assets:{}};item.dynamicData={schemaVersion:1,configurationSnapshotId:"'+uuid(1)+'",snapshotId:"'+uuid(1)+'",templateVersionId:"'+uuid(2)+'",configurationHash:"'+hash+'",contentHash:"'+hash+'",dataRevision:2}');
 expect(evaluate(value,'lgDynamicDataValid(item)')).toBe(true);
 evaluate(value,'var before={manifest:{releaseId:"same",items:[item]}},after=JSON.parse(JSON.stringify(before));after.manifest.items[0].dynamicData.dataRevision=1');
 expect(evaluate(value,'lgSyncBinaryContinuity(before,after)')).toBe(false);
 evaluate(value,'after.manifest.items[0].dynamicData.dataRevision=3;after.manifest.items[0].dynamicData.contentHash="b".repeat(64);after.manifest.items[0].dynamicTemplate.snapshotHash="b".repeat(64)');
 expect(evaluate(value,'lgSyncBinaryContinuity(before,after)')).toBe(true);expect(evaluate(value,'lgDynamicDataValid(after.manifest.items[0])')).toBe(true);
 evaluate(value,'after.manifest.items[0].dynamicData.contentHash="c".repeat(64)');expect(evaluate(value,'lgDynamicDataValid(after.manifest.items[0])')).toBe(false);
 evaluate(value,'item.dynamicData.dataRevision=0');expect(evaluate(value,'lgDynamicDataValid(item)')).toBe(false);
 evaluate(value,'delete item.dynamicData');expect(evaluate(value,'lgDynamicDataValid(item)')).toBe(true);
});
