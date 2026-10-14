import {sitesCurrentPresentationVersion,sitesSystemImageChecksums,type SitesAssetReference,type SitesPresentation,type SitesStudioSlide,type SitesTvContent} from "@veyocast/contracts";
import type {OnzeTrotsTvContent} from "./sites-screen-themes";
import type {SitesDynamicDesignView,SitesStudioSlideView} from "./sites-render-types";
export type SitesAssetResolver = (asset: SitesAssetReference) => string | undefined;
export const sitesTvRowsPerPage = {programma:8,uitslagen:8,stand:8,kantine:12,clubnieuws:3,partners:6,generic:6} as const;
export function sitesPresentationPages(input: SitesPresentation): number {
  if(input.kind==="dynamic" && input.content.menuPages)return input.content.menuPages.length;
  const rendererVersion=input.kind==="studio"?input.rendererVersion:input.configuration.rendererVersion;
  if(rendererVersion===sitesCurrentPresentationVersion)return 1;
  if(input.kind==="dynamic")return Math.max(1,Math.ceil(input.content.rows.length/input.configuration.rowsPerPage));
  if(input.slide.themeId!=="onzetrots-tv"||!input.slide.tv)return 1;
  return Math.max(1,Math.ceil(input.slide.tv.rows.length/(sitesTvRowsPerPage[input.slide.tv.kind as keyof typeof sitesTvRowsPerPage]??12)));
}
export function sitesPresentationDurationSeconds(input: SitesPresentation): number {
 return (input.kind==="studio"?input.slide.duration:input.configuration.seconds)*sitesPresentationPages(input);
}
export function sitesPresentationAssets(input: SitesPresentation): SitesAssetReference[] {
 const refs:SitesAssetReference[]=[];
 function visit(value:unknown){if(!value||typeof value!=="object")return;if(Array.isArray(value)){value.forEach(visit);return;}const item=value as Record<string,unknown>;if(item.kind==="system"||item.kind==="tenant"){refs.push(value as SitesAssetReference);return;}Object.values(item).forEach(visit);}
 visit(input);return [...new Map(refs.map(asset=>[asset.kind==="system"?asset.path:asset.mediaAssetId,asset])).values()];
}
/** System paths are release-owned, immutable files; tenant URLs require a verified resolver. */
export const resolveSitesSystemAsset:SitesAssetResolver=asset=>asset.kind==="system"&&sitesSystemImageChecksums[asset.path]===asset.checksumSha256?asset.path:undefined;
export function resolveTv(content:SitesTvContent,resolve:SitesAssetResolver):OnzeTrotsTvContent {
 const {brandLogo,...fields}=content;
 const defaults:Partial<Record<SitesTvContent["kind"],keyof typeof sitesSystemImageChecksums>>={wedstrijd:"/onzetrots-tv/assets/clubmuur-portraits-v17/10-strijd-1280.webp",programma:"/onzetrots-tv/assets/clubmuur-portraits-v14/05-juichen-1280.webp",uitslagen:"/onzetrots-tv/assets/clubmuur-portraits-v14/05-juichen-1280.webp",clubnieuws:"/onzetrots-tv/assets/clubmuur-portraits-v14/07-walking-1280.webp",welkom:"/onzetrots-tv/assets/clubmuur-players/trio-1280.webp"};const path=defaults[content.kind];const fallback=path?resolve({kind:"system",path,checksumSha256:sitesSystemImageChecksums[path]}):undefined;
 return {...fields,logo:(content.logo??brandLogo)?resolve((content.logo??brandLogo)!):undefined,background:content.background?resolve(content.background):undefined,heroImage:content.heroImage?resolve(content.heroImage):fallback,rows:content.rows.map(row=>({...row,image:row.image?resolve(row.image):undefined})),timeline:content.timeline?.map(row=>({...row,image:row.image?resolve(row.image):undefined})),match:content.match?{...content.match,homeLogo:content.match.homeLogo?resolve(content.match.homeLogo):undefined,awayLogo:content.match.awayLogo?resolve(content.match.awayLogo):undefined}:undefined};
}
export function resolveSitesStudioSlide(slide:SitesStudioSlide,resolve:SitesAssetResolver):SitesStudioSlideView{return {...slide,photo:slide.photo?resolve(slide.photo):undefined,logo:slide.logo?resolve(slide.logo):undefined,tv:slide.tv?resolveTv(slide.tv,resolve):undefined};}

/** Resolves a single canonical data page for all trusted display adapters. */
export function resolveSitesDynamicPage(input:Extract<SitesPresentation,{kind:"dynamic"}>,resolve:SitesAssetResolver=resolveSitesSystemAsset,page=0){
 const config=input.configuration,pages=sitesPresentationPages(input),safePage=Math.min(pages-1,Math.max(0,Math.trunc(page)));
 const rows=input.content.rows.slice(safePage*config.rowsPerPage,(safePage+1)*config.rowsPerPage).map(row=>config.provider==="menu"&&!config.showCategories?{...row,tag:"Assortiment"}:row);
 const content=resolveTv({...input.content,rows,page:safePage,pages,scale:config.scale,titleScale:config.titleScale,scoreScale:config.scoreScale,logoScale:config.logoScale,teamScale:config.teamScale,overlay:config.overlay,align:config.align,safeArea:config.safeArea,accent:config.accent,showBranding:config.showBranding,showSceneLabel:config.showSceneLabel,backgroundFit:config.provider==="led-scores"?config.backgroundFit:input.content.backgroundFit},resolve);
 const design:SitesDynamicDesignView={...config,id:"published",name:config.title,kind:content.kind==="stand"?"standings":content.kind,background:config.background?resolve(config.background)??"":"",rows:config.provider==="menu"?content.rows.map(row=>({...row,secondary:config.showCategories?[...new Set([row.tag,row.secondary].filter(Boolean))].join(" · "):row.secondary})):content.rows,config:{...config,template:config.ledTemplate,ledTitleScale:config.titleScale,ledScoreScale:config.scoreScale,ledLogoScale:config.logoScale,ledTeamScale:config.teamScale,clubName:content.clubName,homeLogo:content.match?.homeLogo,awayLogo:content.match?.awayLogo,homeOwn:content.match?.homeOwn,awayOwn:content.match?.awayOwn,clock:content.match?.clock,homeScore:content.match?.homeScore,awayScore:content.match?.awayScore,ledTimeline:content.timeline,page:safePage}};
 return {content,design,pages,page:safePage};
}

/** Frozen Studio data paging follows the literal Studio composition, before row slicing. */
export function resolveSitesStudioPage(input:Extract<SitesPresentation,{kind:"studio"}>,resolve:SitesAssetResolver=resolveSitesSystemAsset,page=0){
 const slide=resolveSitesStudioSlide(input.slide,resolve),pages=sitesPresentationPages(input),safePage=Math.min(pages-1,Math.max(0,Math.trunc(page)));
 if(!slide.tv)return {slide,content:undefined,pages,page:safePage};
 let content:OnzeTrotsTvContent={...slide.tv,title:slide.title,time:slide.time,subtitle:slide.subtitle,location:slide.location,background:slide.photo??slide.tv.background,clubName:slide.clubName??slide.tv.clubName,logo:slide.logo??slide.tv.logo,overlay:slide.overlay??slide.tv.overlay??20,align:slide.align};
 if(content.kind==="uitslagen"){const featured=content.rows.find(row=>row.own)??content.rows[0];content={...content,match:featured?{home:featured.home||featured.primary,away:featured.away||featured.secondary||"",homeScore:featured.homeScore,awayScore:featured.awayScore,label:content.values?.[0]}:undefined};}
 const pageSize=sitesTvRowsPerPage[content.kind as keyof typeof sitesTvRowsPerPage]??12;
 return {slide,content:{...content,rows:content.rows.slice(safePage*pageSize,(safePage+1)*pageSize),page:safePage,pages},pages,page:safePage};
}
