import {
 sitesStudioSlideSchema,sitesPresentationSchema,sitesPresentationSourceRevision,sitesPresentationVersion,sitesSystemImageChecksums,
 type SitesAssetReference,type SitesPresentation,type SitesStudioSlide
} from "@veyocast/contracts";
import literalStarters from "./sites-literal-starters.json";
import { createEmptyStudioDocument } from "./document";
import { parseStudioDocument,type StudioDocument } from "./schema";
import type { StudioSystemTemplate,StudioTemplateCategory } from "./templates";

export const studioSitesMaximumDurationMs=120_000;
const rowsPerPage:Record<string,number>={programma:8,uitslagen:8,stand:8,kantine:12,clubnieuws:3,partners:6,generic:6};
export function studioSitesPages(slide:SitesStudioSlide){return slide.themeId==="onzetrots-tv"&&slide.tv?Math.max(1,Math.ceil(slide.tv.rows.length/(rowsPerPage[slide.tv.kind]??12))):1;}
export function studioSitesDurationMs(slide:SitesStudioSlide){return slide.duration*studioSitesPages(slide)*1000;}
export function studioSitesAssetReferences(input:SitesPresentation|StudioDocument):SitesAssetReference[]{
 const presentation="sitesPresentation" in input?input.sitesPresentation:input;
 const refs:SitesAssetReference[]=[];const visit=(value:unknown)=>{if(!value||typeof value!=="object")return;if(Array.isArray(value)){value.forEach(visit);return;}const object=value as Record<string,unknown>;if(object.kind==="system"||object.kind==="tenant"){refs.push(value as SitesAssetReference);return;}Object.values(object).forEach(visit);};visit(presentation);
 return [...new Map(refs.map(ref=>[ref.kind==="tenant"?ref.mediaAssetId:ref.path,ref])).values()];
}
export function studioDocumentAssetIds(document:StudioDocument){return [...new Set([...document.elements.flatMap(e=>e.type==="image"||e.type==="video"?[e.mediaAssetId]:[]),...studioSitesAssetReferences(document).flatMap(ref=>ref.kind==="tenant"?[ref.mediaAssetId]:[])])];}
export function createSitesStudioDocument(slide:SitesStudioSlide,motionEnabled=false):StudioDocument{
 const presentation=sitesPresentationSchema.parse({kind:"studio",schemaVersion:1,rendererVersion:sitesPresentationVersion,sourceRevision:sitesPresentationSourceRevision,slide});
 return parseStudioDocument({...createEmptyStudioDocument(slide.orientation==="portrait"?"portrait-hd":"landscape-hd"),sitesPresentation:presentation,motion:{durationMs:studioSitesDurationMs(slide),enabled:motionEnabled||studioSitesPages(slide)>1,fps:30}});
}
export function updateSitesStudioDocument(document:StudioDocument,slide:SitesStudioSlide){if(document.sitesPresentation?.kind!=="studio")throw new Error("Dit ontwerp gebruikt de bestaande vrije Studio.");return createSitesStudioDocument(slide,document.motion.enabled);}
const categories:readonly StudioTemplateCategory[]=["matchday","schedule","result","sponsor","menu","activity","volunteer","welcome","cancelled","social","emergency"];
const tvCategories:readonly StudioTemplateCategory[]=["matchday","schedule","result","result","menu","activity","sponsor","welcome"];
const imageKeys=new Set(["photo","logo","brandLogo","background","heroImage","image","homeLogo","awayLogo"]);
function canonicalStarter(value:unknown,key=""):unknown {
 if(Array.isArray(value))return value.map(item=>canonicalStarter(item));
 if(value&&typeof value==="object"){
  const object=value as Record<string,unknown>;
  // Static, immutable Source examples carry explicit own-team metadata; providers never use this adapter.
  return {...Object.fromEntries(Object.entries(object).map(([name,child])=>[name,canonicalStarter(child,name)])),...(typeof object.home==="string"?{homeOwn:object.home.startsWith("Duindorp SV")}:{}),...(typeof object.away==="string"?{awayOwn:object.away.startsWith("Duindorp SV")}:{})};
 }
 if(typeof value==="string"&&imageKeys.has(key)) {
  if(value==="")return undefined;
  if(value.startsWith("/")){const checksumSha256=sitesSystemImageChecksums[value as keyof typeof sitesSystemImageChecksums];if(!checksumSha256)throw Error("Starter asset is not in the audited manifest");return{kind:"system",path:value,checksumSha256};}
 }
 if(typeof value==="string"&&value.startsWith("var(--ff-field"))return "#2f7d5c";
 if(typeof value==="string"&&value.startsWith("var(--ff-sidebar"))return "#123332";
 return value;
}
/** Literal editable examples from the immutable Source; never live provider/tenant data. */
export const studioSitesSystemTemplates:readonly StudioSystemTemplate[]=( ["landscape-hd","portrait-hd"] as const).flatMap(formatId=>[
 ...literalStarters.studio.map((entry,index)=>{const category=categories[index]!;const id=`sites-v11-${category}-${formatId}`;const slide=sitesStudioSlideSchema.parse({...canonicalStarter(entry.slide) as Record<string,unknown>,id,themeId:"fieldflow",orientation:formatId==="portrait-hd"?"portrait":"landscape"});return {id,category,description:"Bewerkbaar voorbeeld uit Sites v11 · FieldFlow",document:createSitesStudioDocument(slide),formatId,name:slide.name,version:11};}),
 ...literalStarters.tv.map((entry,index)=>{const category=tvCategories[index]!;const id=`sites-v11-tv-${entry.content.kind}-${formatId}`;const content=canonicalStarter(entry.content) as Record<string,unknown>;const slide=sitesStudioSlideSchema.parse({...canonicalStarter(literalStarters.studio[0]!.slide) as Record<string,unknown>,id,name:entry.name,title:content.title,time:content.time??"",subtitle:content.subtitle??"",location:content.location??"",photo:content.background,clubName:content.clubName,logo:content.logo,themeId:"onzetrots-tv",tv:content,overlay:20,duration:15,color:"#123f8d",background:"#063893",orientation:formatId==="portrait-hd"?"portrait":"landscape"});return {id,category,description:"Bewerkbaar voorbeeld uit Sites v11 · OnzeTrots TV",document:createSitesStudioDocument(slide),formatId,name:entry.name,version:11};})
]);
export function sitesSystemImage(path:keyof typeof sitesSystemImageChecksums):SitesAssetReference{return {kind:"system",path,checksumSha256:sitesSystemImageChecksums[path]};}

/** Example data is visible in the catalog, but never becomes another tenant's factual content. */
export function createTenantSitesStudioStarter(document:StudioDocument,tenantName:string,brandLogo?:SitesAssetReference):StudioDocument {
 if(document.sitesPresentation?.kind!=="studio")return document;
 const original=document.sitesPresentation.slide;
 const title=original.title.replaceAll("Duindorp",tenantName);
 return createSitesStudioDocument({...original,title,time:"",location:"",subtitle:"",clubName:tenantName,logo:brandLogo,
  tv:original.tv?{...original.tv,title,time:"",location:"",subtitle:"",clubName:tenantName,logo:brandLogo,brandLogo,eyebrow:"",rows:[],timeline:[],match:undefined,combo:undefined}:undefined
 },document.motion.enabled);
}
