import React from "react";
import {sitesPresentationForPlacement} from "./sites-placement-presentation";
import {renderToReadableStream} from "react-dom/server.edge";
import {SitesStaticView} from "@veyocast/content-templates/sites-static-view";
import type {SitesPresentation,PlayerDynamicTemplateAsset} from "@veyocast/contracts";
import {sitesPresentationPages} from "@veyocast/content-templates/sites-presentation-model";
import {sitesPresentationCss} from "@veyocast/content-templates/sites-styles";
import {buildSitesPresentationFromDynamicPayload} from "@veyocast/content-templates/sites-dynamic-projector";
import {parseGoalMessage} from "./ledscores-goal-message";
import {buildSitesLedOverlayPresentation} from "./player-sites-led-presentation";
import {parseLedScoresMatchOverlayMessage} from "./ledscores-match-experience";
import {parseLedScoresLiveMatchConfig,formatLedScoresClock,resolveLedScoresClockSeconds} from "./ledscores-match-experience";
import type {PlayerManifestItem} from "./player-manifest";
import systemAssets from "../../../../packages/content-templates/src/sites-system-assets.json";
export type PlayerSitesMarkup={rendererVersion:"sites-v11";sourceRevision:string;orientation:"landscape"|"portrait";width:number;height:number;pageDurationSeconds:number;pages:string[];css:string;assetTokens:Array<{token:string;cacheKey:string}>};
/** Only canonical typed database content reaches this renderer; no supplied markup is accepted. */
export async function buildPlayerSitesMarkup(item:PlayerManifestItem):Promise<PlayerSitesMarkup|undefined>{
 const state=parseLedScoresLiveMatchConfig(item.dynamicTemplate?.data)?.fallbackState;
 const presentation=item.sitesStudioPresentation??buildSitesPresentationFromDynamicPayload(item.dynamicTemplate,undefined,new Date(),state?{...state,clockLabel:formatLedScoresClock(resolveLedScoresClockSeconds(state.clock,Date.now()+(state.serverTimeOffsetMs??0),state.staleAfter))}:null);if(!presentation)return undefined;
 return buildSitesMarkup(presentation,item.sitesStudioAssets??item.dynamicTemplate?.assets??{},item.durationSeconds);
}
export async function buildSitesMarkup(presentation:SitesPresentation,assets:Readonly<Record<string,Pick<PlayerDynamicTemplateAsset,"mimeType"|"checksumSha256">>>,durationSeconds:number):Promise<PlayerSitesMarkup> {
 presentation=sitesPresentationForPlacement(presentation,durationSeconds);
 const tokens=new Map<string,string>();const token=(checksum:string)=>{const value=`VEYOSITES_ASSET_${checksum}`;tokens.set(value,`/__veyocast-player-cache/${checksum}`);return value;};
 const system=new Map(systemAssets.files.map(asset=>[asset.path,asset]));
 const css=sitesPresentationCss.replace(/url\(["']?(\/[^"')]+)["']?\)/g,(_match,path:string)=>{const asset=system.get(path);if(!asset)throw new Error("SITES_SYSTEM_ASSET_UNAVAILABLE");return `url("${token(asset.sha256)}")`;});
 const pages=await Promise.all(Array.from({length:sitesPresentationPages(presentation)},async(_,page)=>{const stream=await renderToReadableStream(<SitesStaticView presentation={presentation} page={page} includeStyles={false} active resolveAsset={asset=>{
  if(asset.kind==="system"){const trusted=system.get(asset.path);return trusted?.sha256===asset.checksumSha256?token(asset.checksumSha256):undefined;}
  const stored=assets[asset.mediaAssetId];return stored?.checksumSha256===asset.checksumSha256&&stored.mimeType.startsWith("image/")?token(asset.checksumSha256):undefined;
 }}/>);await stream.allReady;return new Response(stream).text();}));
 if(pages.some(html=>html.length>524288||/<(?:script|iframe|object|embed)\b|<[^>]*\son[a-z]+\s*=|<[^>]*\s(?:src|href)=["'](?:https?:|javascript:|data:)/i.test(html)))throw new Error("SITES_MARKUP_INVALID");
 const orientation=presentation.kind==="dynamic"?presentation.configuration.orientation:presentation.slide.orientation;
 return {rendererVersion:"sites-v11",sourceRevision:presentation.kind==="dynamic"?presentation.configuration.sourceRevision:presentation.sourceRevision,orientation,width:orientation==="portrait"?1080:1920,height:orientation==="portrait"?1920:1080,pageDurationSeconds:durationSeconds/pages.length,pages,css,assetTokens:[...tokens].map(([token,cacheKey])=>({token,cacheKey}))};
}

/** The transient LED delivery uses the same typed projector and trusted renderer. */
export async function buildPlayerSitesLedDeliveryMarkup(value:unknown):Promise<Partial<Record<"landscape"|"portrait",PlayerSitesMarkup>>|undefined>{
 const goal=parseGoalMessage(value);const match=goal?null:parseLedScoresMatchOverlayMessage(value);const overlay=goal?.goal??match?.overlay;if(!overlay?.scene)return undefined;
 const assets=Object.fromEntries([...overlay.assets].map(([id,asset])=>[id,{checksumSha256:asset.checksum,mimeType:asset.mimeType}]));const result:Partial<Record<"landscape"|"portrait",PlayerSitesMarkup>>={};
 for(const orientation of ["landscape","portrait"] as const){const presentation=buildSitesLedOverlayPresentation(overlay,orientation);if(!presentation)continue;const markup=await buildSitesMarkup(presentation,assets,overlay.durationMs/1000);const tenantChecksums=new Set([...overlay.assets.values()].map(asset=>asset.checksum));markup.assetTokens=markup.assetTokens.map(asset=>({...asset,cacheKey:tenantChecksums.has(asset.token.slice("VEYOSITES_ASSET_".length))?asset.cacheKey.replace("/__veyocast-player-cache/","/__veyocast-goal-cache/"):asset.cacheKey}));result[orientation]=markup;}
 return Object.keys(result).length?result:undefined;
}
