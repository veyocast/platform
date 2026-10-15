import {sitesPresentationPages} from "./sites-presentation-model";
import { projectSitesMenuWidgets } from "./sites-menu-widgets-model";
import {
  menuDocumentV2Schema,
  playerDynamicTemplatePayloadSchema, sitesDynamicConfigurationSchema,
  sitesPresentationSchema, sitesPresentationSourceRevision, sitesPresentationVersion,
  type PlayerDynamicTemplatePayload, type SitesAssetReference,
  type SitesDynamicConfiguration, type SitesPresentation, type SitesTvContent
} from "@veyocast/contracts";
import {createDynamicTemplateView, type DynamicTemplateListItem} from "./dynamic-template-view";
import {formatMenuMoney,resolveMenuProductPrice,resolveMenuGroupPrice,resolveMenuScenePages} from "./menu-scene-model";

/** Input is the already normalized database state, never a provider message. */
export type SitesLedMatchProjection = {
 home:{name:string;score:number;logoUrl:string|null};away:{name:string;score:number;logoUrl:string|null};
 clockLabel?:string;homeOwn?:boolean;awayOwn?:boolean;periodLabel?:string|null;
 timeline:ReadonlyArray<{id:string;label:string;clockLabel:string|null;homeScore:number|null;awayScore:number|null}>;
};
type Row=SitesTvContent["rows"][number];
const number=(value:number|null)=>value===null?"—":String(value);
const record=(value:unknown):Record<string,unknown>|null=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;
export function sitesDynamicAssetReference(payload:PlayerDynamicTemplatePayload,url:string|undefined|null):SitesAssetReference|undefined {
 if(!url)return undefined;
 const entry=Object.entries(payload.assets??{}).find(([,asset])=>asset.url===url&&asset.mimeType.startsWith("image/"));
 return entry?{kind:"tenant",mediaAssetId:entry[0],checksumSha256:entry[1].checksumSha256}:undefined;
}
export function resolveSitesDynamicAsset(payload:PlayerDynamicTemplatePayload,asset:SitesAssetReference):string|undefined {
 if(asset.kind==="system")return asset.path;
 const entry=payload.assets?.[asset.mediaAssetId];
 return entry&&entry.checksumSha256===asset.checksumSha256&&entry.mimeType.startsWith("image/")?entry.url:undefined;
}
/** Project canonical typed fields; display strings are never parsed back into data. */
export function buildSitesPresentationFromDynamicPayload(value:unknown,configurationOverride?:SitesDynamicConfiguration|null,now=new Date(),liveState?:SitesLedMatchProjection|null):SitesPresentation|null {
 const parsed=playerDynamicTemplatePayloadSchema.safeParse(value);if(!parsed.success)return null;const payload=parsed.data;
 const document=record(payload.data.menuDocument??record(payload.data.priceList)?.menuDocument);
 const stored=configurationOverride??payload.data.sitesConfiguration??document?.sitesConfiguration;
 const selectedTheme=record(record(record(payload.data.themePresentation)?.selection)?.ref)?.id;
 if(!stored&&selectedTheme!=="onzetrots-tv")return null; // Historical snapshots keep their renderer.
 const defaultProvider=payload.slideType==="ledscores_live_match"?"led-scores":["menu","price_list"].includes(payload.slideType)?"menu":"sportlink";
 const configResult=sitesDynamicConfigurationSchema.safeParse(stored??{schemaVersion:1,rendererVersion:sitesPresentationVersion,sourceRevision:sitesPresentationSourceRevision,themeId:"onzetrots-tv",orientation:payload.orientation,provider:defaultProvider,title:""});
 if(!configResult.success||configResult.data.orientation!==payload.orientation||configResult.data.provider!==defaultProvider)return null;
 const configuration=configResult.data;
 const image=(url:string|undefined|null)=>sitesDynamicAssetReference(payload,url);
 if(configuration.provider==="menu" && document && configuration.menuWidgets) {
  const asset=(id:string):SitesAssetReference|undefined=>{const stored=payload.assets?.[id];return stored?.mimeType.startsWith("image/")?{kind:"tenant",mediaAssetId:id,checksumSha256:stored.checksumSha256}:undefined;};
  const brand=record(payload.data.brand),clubName=typeof brand?.clubName==="string"?brand.clubName:undefined;
  const projected=buildSitesMenuPresentation(document,configuration,clubName,asset);
  if(projected?.kind!=="dynamic")return projected;
  return {...projected,content:{...projected.content,logo:projected.content.logo??(typeof brand?.logoMediaAssetId==="string"?asset(brand.logoMediaAssetId):undefined)}};
 }
 if(payload.slideType==="ledscores_live_match"){
  liveState=liveState??readSitesLedStateFromCanonicalPayload(payload,now);
  if(!liveState)return null;
  const rows:Row[]=[{id:"home",primary:liveState.home.name,value:String(liveState.home.score),own:liveState.homeOwn,image:image(liveState.home.logoUrl)},{id:"away",primary:liveState.away.name,value:String(liveState.away.score),own:liveState.awayOwn,image:image(liveState.away.logoUrl)}];
  const projected=sitesPresentationSchema.safeParse({kind:"dynamic",configuration,content:{kind:configuration.ledMoment==="goal"?"goal":"score",title:configuration.title||"De tussenstand",subtitle:configuration.subtitle,rows,background:configuration.background,match:{home:liveState.home.name,away:liveState.away.name,homeScore:String(liveState.home.score),awayScore:String(liveState.away.score),homeLogo:image(liveState.home.logoUrl),awayLogo:image(liveState.away.logoUrl),homeOwn:liveState.homeOwn,awayOwn:liveState.awayOwn,clock:configuration.showClock?liveState.clockLabel:undefined,label:liveState.periodLabel??undefined},timeline:configuration.showTimeline?liveState.timeline.slice(-configuration.timelineLimit).map(event=>({id:event.id,primary:event.clockLabel??event.label,secondary:event.label,value:event.homeScore!==null&&event.awayScore!==null?`${event.homeScore}–${event.awayScore}`:undefined})):[]}});return projected.success?projected.data:null;
 }
 const view=createDynamicTemplateView(payload,now);if(!view)return null;
 const listRow=(item:DynamicTemplateListItem):Row=>({id:item.id,primary:item.primary,secondary:item.secondary,value:item.homeScore!==null&&item.awayScore!==null?`${item.homeScore}–${item.awayScore}`:item.time||undefined,home:item.homeTeam||undefined,away:item.awayTeam||undefined,homeImage:image(item.homeLogoUrl),awayImage:image(item.awayLogoUrl),homeScore:item.homeScore===null?undefined:String(item.homeScore),awayScore:item.awayScore===null?undefined:String(item.awayScore),time:item.kickoffTime||item.time||undefined,field:item.field||undefined,tag:item.competition||undefined,own:item.selected,homeOwn:item.homeMatch&&item.selected,awayOwn:!item.homeMatch&&item.selected,image:image(item.logoUrl||item.homeLogoUrl||item.photoUrl)});
 const rows:Row[]=[];const seen=new Set<string>();const add=(row:Row)=>{if(!seen.has(row.id)){seen.add(row.id);rows.push(row);}};
 for(const page of view.pages){
  if(page.kind==="standing")for(const item of page.items)add({id:item.id,primary:item.teamName,rank:item.position??undefined,own:item.selected,image:image(item.logoUrl),played:number(item.played),won:number(item.won),drawn:number(item.drawn),lost:number(item.lost),difference:number(item.goalDifference),points:number(item.points),value:number(item.points),form:item.form.map(form=>form==="win"?"W":form==="draw"?"G":"V")});
  else if(page.kind==="birthday")for(const item of page.items)add({id:item.id,primary:item.displayName,secondary:item.meta,value:item.age===null?undefined:String(item.age),tag:item.dateLabel,image:image(item.photoUrl)});
  else if(page.kind==="menu"){for(const column of page.columns)for(const entry of column)if(entry.kind==="product")add({id:entry.item.id,primary:entry.item.name,secondary:entry.item.description,value:entry.item.price,tag:entry.item.category,image:image(entry.item.imageUrl)});}
  else if(page.kind==="price-list")for(const column of Object.values(page.page.columns)){let category="";for(const entry of column)if(entry.kind==="category")category=entry.name;else add({id:entry.item.id,primary:entry.item.name,secondary:entry.item.description,value:entry.item.formattedPrice,tag:category,image:entry.item.image.kind==="image"?image(entry.item.image.url):undefined});}
  else if(page.kind==="menu-v2")for(const column of Object.values(page.page.columns)){let category="";for(const entry of column)if(entry.kind==="category")category=entry.label;else if(entry.kind==="product")add({id:entry.id,primary:entry.product.nameOverride??entry.product.snapshotFallback.name,secondary:entry.product.snapshotFallback.variantLabel??undefined,value:formatMenuMoney(resolveMenuProductPrice(entry.product)),tag:category});else add({id:entry.id,primary:entry.group.title,secondary:entry.group.secondaryLineItems.map(line=>line.kind==="free-text"?line.label:line.labelOverride??line.snapshotFallback.variantLabel??line.snapshotFallback.name).join(" · "),value:resolveMenuGroupPrice(entry.group),tag:category});}
  else if(page.kind==="news"){for(const item of [page.item,...page.secondaryItems])if(item)add({id:item.id,primary:item.title,secondary:item.intro,value:item.date,tag:item.source,image:image(item.heroUrl)});}
  else if(page.kind==="match"){if(page.item)add(listRow(page.item));}
  else if("items" in page)for(const item of page.items)add(listRow(item));
 }
 const kind:SitesTvContent["kind"]=payload.slideType==="sport_standing"||payload.slideType==="sport_period_standing"?"stand":payload.slideType==="sport_results"?"uitslagen":payload.slideType==="sport_program"?"programma":defaultProvider==="menu"?"kantine":payload.slideType==="news"?"clubnieuws":payload.slideType==="sport_sponsor"?"partners":"generic";
 const result=sitesPresentationSchema.safeParse({kind:"dynamic",configuration,content:{kind,title:configuration.title||view.title,subtitle:configuration.subtitle,clubName:view.clubName,logo:image(view.clubLogoUrl),background:configuration.background,rows,standingColumns:kind==="stand"?["played","won","drawn","lost","difference","points","form"]:undefined}});
 return result.success?result.data:null;
}

export function sitesDynamicPresentationDurationSeconds(presentation:SitesPresentation){return presentation.kind==="dynamic"?presentation.configuration.seconds*sitesPresentationPages(presentation):presentation.slide.duration;}

/** Authoring preview of the actual typed menu, without synthetic snapshot IDs. */
export function buildSitesMenuPresentation(value:unknown,configurationOverride?:SitesDynamicConfiguration,clubName?:string,assetOverride?:(id:string)=>SitesAssetReference|undefined):SitesPresentation|null {
 const document=menuDocumentV2Schema.safeParse(value);if(!document.success)return null;
 const config=sitesDynamicConfigurationSchema.safeParse(configurationOverride??document.data.sitesConfiguration);if(!config.success||config.data.provider!=="menu")return null;
 const rows:Row[]=[];const seen=new Set<string>();
 for(const page of resolveMenuScenePages(document.data,config.data.orientation))for(const column of Object.values(page.columns)){let category="";for(const entry of column){if(entry.kind==="category"){category=entry.label;continue;}if(seen.has(entry.id))continue;seen.add(entry.id);if(entry.kind==="product")rows.push({id:entry.id,primary:entry.product.nameOverride??entry.product.snapshotFallback.name,secondary:entry.product.snapshotFallback.variantLabel??undefined,value:formatMenuMoney(resolveMenuProductPrice(entry.product)),tag:category});else rows.push({id:entry.id,primary:entry.group.title,secondary:entry.group.secondaryLineItems.map(line=>line.kind==="free-text"?line.label:line.labelOverride??line.snapshotFallback.variantLabel??line.snapshotFallback.name).join(" · "),value:resolveMenuGroupPrice(entry.group),tag:category});}}
 const asset=assetOverride??((id:string)=>{const ref=document.data.assets.find(asset=>asset.assetId===id);return ref?.sha256?{kind:"tenant" as const,mediaAssetId:id,checksumSha256:ref.sha256}:undefined;});
 const menuPages=config.data.menuWidgets?projectSitesMenuWidgets(document.data,config.data,asset):undefined;
 const result=sitesPresentationSchema.safeParse({kind:"dynamic",configuration:config.data,content:{kind:"kantine",title:config.data.title||document.data.title||"De kantine",subtitle:config.data.subtitle,clubName,logo:document.data.theme.brand.logoAssetId?asset(document.data.theme.brand.logoAssetId):undefined,background:config.data.background,rows,menuPages}});return result.success?result.data:null;
}

/** Reads stored, normalized match state; never opens a provider connection. */
export function readSitesLedStateFromCanonicalPayload(value:unknown,now=new Date()):SitesLedMatchProjection|null{
 const parsed=playerDynamicTemplatePayloadSchema.safeParse(value);if(!parsed.success||parsed.data.slideType!=="ledscores_live_match")return null;
 const live=record(parsed.data.data.liveMatch),state=record(live?.state);if(!state||state.schemaVersion!==1)return null;
 const team=(input:unknown)=>{const data=record(input);return data&&typeof data.name==="string"&&data.name.trim()&&data.name.length<=240&&typeof data.score==="number"&&Number.isInteger(data.score)&&data.score>=0&&data.score<=999?{name:data.name,score:data.score,logoUrl:typeof data.logoUrl==="string"?data.logoUrl:null}:null;};const home=team(state.home),away=team(state.away);if(!home||!away)return null;
 const clock=record(state.clock);let clockLabel=typeof clock?.label==="string"&&clock.label.length<=40?clock.label:undefined;
 if(clock&&typeof clock.anchorSeconds==="number"&&Number.isFinite(clock.anchorSeconds)&&clock.anchorSeconds>=0&&clock.anchorSeconds<=36000&&typeof clock.anchorAt==="string"&&Number.isFinite(Date.parse(clock.anchorAt))){const observed=typeof state.sourceUpdatedAt==="string"?Date.parse(state.sourceUpdatedAt):now.valueOf();const stale=typeof state.staleAfter==="string"?Date.parse(state.staleAfter):observed+120000;const elapsed=clock.running===true?Math.max(0,Math.floor((Math.min(now.valueOf(),Number.isFinite(stale)?stale:now.valueOf())-Date.parse(clock.anchorAt))/1000)):0;const maximum=typeof clock.maxSeconds==="number"&&Number.isFinite(clock.maxSeconds)?clock.maxSeconds:36000;const seconds=Math.max(0,Math.min(maximum,clock.anchorSeconds+(clock.direction==="down"?-elapsed:elapsed)));clockLabel=`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;}
 const timeline=Array.isArray(state.timeline)?state.timeline.slice(0,30).flatMap(value=>{const item=record(value);return item&&typeof item.id==="string"&&typeof item.label==="string"?[{id:item.id,label:item.label,clockLabel:typeof item.clockLabel==="string"?item.clockLabel:null,homeScore:typeof item.homeScore==="number"?item.homeScore:null,awayScore:typeof item.awayScore==="number"?item.awayScore:null}]:[]}):[];
 return {home,away,clockLabel,periodLabel:typeof state.periodLabel==="string"?state.periodLabel:null,timeline};
}
