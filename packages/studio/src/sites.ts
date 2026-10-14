import {
 sitesCurrentPresentationSourceRevision,sitesCurrentPresentationVersion,sitesLegacyPresentationSourceRevision,sitesLegacyPresentationVersion,
 sitesStudioSlideSchema,sitesPresentationSchema,sitesSystemImageChecksums,
 type SitesAssetReference,type SitesPresentation,type SitesStudioSlide,type SitesTvContent,type SitesUnifiedKind
} from "@veyocast/contracts";
import literalStarters from "./sites-literal-starters.json";
import { createEmptyStudioDocument } from "./document";
import { parseStudioDocument,type StudioDocument } from "./schema";
import type { StudioSystemTemplate,StudioTemplateCategory } from "./templates";

export const studioSitesMaximumDurationMs=120_000;
const rowsPerPage:Record<string,number>={programma:8,uitslagen:8,stand:8,kantine:12,clubnieuws:3,partners:6,generic:6};
export function studioSitesPages(slide:SitesStudioSlide){if(slide.unifiedKind)return 1;return slide.themeId==="onzetrots-tv"&&slide.tv?Math.max(1,Math.ceil(slide.tv.rows.length/(rowsPerPage[slide.tv.kind]??12))):1;}
export function studioSitesDurationMs(slide:SitesStudioSlide){return slide.duration*studioSitesPages(slide)*1000;}
export function studioSitesAssetReferences(input:SitesPresentation|StudioDocument):SitesAssetReference[]{
 const presentation="sitesPresentation" in input?input.sitesPresentation:input;
 const refs:SitesAssetReference[]=[];const visit=(value:unknown)=>{if(!value||typeof value!=="object")return;if(Array.isArray(value)){value.forEach(visit);return;}const object=value as Record<string,unknown>;if(object.kind==="system"||object.kind==="tenant"){refs.push(value as SitesAssetReference);return;}Object.values(object).forEach(visit);};visit(presentation);
 return [...new Map(refs.map(ref=>[ref.kind==="tenant"?ref.mediaAssetId:ref.path,ref])).values()];
}
export function studioDocumentAssetIds(document:StudioDocument){return [...new Set([...document.elements.flatMap(e=>e.type==="image"||e.type==="video"?[e.mediaAssetId]:[]),...studioSitesAssetReferences(document).flatMap(ref=>ref.kind==="tenant"?[ref.mediaAssetId]:[])])];}
type SitesDocumentIdentity={rendererVersion:typeof sitesLegacyPresentationVersion|typeof sitesCurrentPresentationVersion;sourceRevision:typeof sitesLegacyPresentationSourceRevision|typeof sitesCurrentPresentationSourceRevision};
export function createSitesStudioDocument(slide:SitesStudioSlide,motionEnabled=false,identity?:SitesDocumentIdentity):StudioDocument{
 const resolved=identity??(slide.unifiedKind?{rendererVersion:sitesCurrentPresentationVersion,sourceRevision:sitesCurrentPresentationSourceRevision}:{rendererVersion:sitesLegacyPresentationVersion,sourceRevision:sitesLegacyPresentationSourceRevision});
 const presentation=sitesPresentationSchema.parse({kind:"studio",schemaVersion:1,...resolved,slide});
 return parseStudioDocument({...createEmptyStudioDocument(slide.orientation==="portrait"?"portrait-hd":"landscape-hd"),sitesPresentation:presentation,motion:{durationMs:studioSitesDurationMs(slide),enabled:motionEnabled||studioSitesPages(slide)>1,fps:30}});
}
export function updateSitesStudioDocument(document:StudioDocument,slide:SitesStudioSlide){if(document.sitesPresentation?.kind!=="studio")throw new Error("Dit ontwerp gebruikt de bestaande vrije Studio.");return createSitesStudioDocument(slide,document.motion.enabled,{rendererVersion:document.sitesPresentation.rendererVersion,sourceRevision:document.sitesPresentation.sourceRevision});}
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
const v17Definitions:readonly {kind:SitesUnifiedKind;name:string;category:StudioTemplateCategory;contentKind:NonNullable<SitesStudioSlide["tv"]>["kind"];extraType?:string}[]=[
 {kind:"competitie",name:"Poulestand",category:"schedule",contentKind:"stand"},{kind:"programma",name:"Clubprogramma",category:"schedule",contentKind:"programma"},{kind:"uitslagen",name:"Clubuitslagen",category:"result",contentKind:"uitslagen"},{kind:"matchday",name:"Match of the day",category:"matchday",contentKind:"wedstrijd"},
 {kind:"agenda",name:"Agenda",category:"activity",contentKind:"generic"},{kind:"rss",name:"Nieuws & RSS",category:"social",contentKind:"clubnieuws"},{kind:"verjaardagen",name:"Verjaardagen",category:"activity",contentKind:"generic"},{kind:"trainingen",name:"Trainingen vandaag",category:"schedule",contentKind:"programma"},
 {kind:"vacatures",name:"Vacatures",category:"volunteer",contentKind:"generic"},{kind:"kantine",name:"Prijslijst kantine",category:"menu",contentKind:"kantine"},{kind:"partners",name:"Partners",category:"sponsor",contentKind:"partners"},{kind:"welkom",name:"Welkom bij Duindorp SV",category:"welcome",contentKind:"welkom"},
 {kind:"bezoekers",name:"Welkom bezoekende teams",category:"welcome",contentKind:"programma"},{kind:"led",name:"Live score",category:"result",contentKind:"score"},{kind:"sportlink-extra",name:"Meer clubinformatie",category:"activity",contentKind:"generic",extraType:"periodestand"},{kind:"vrij",name:"Vrij ontwerp",category:"social",contentKind:"generic"}
];
const ownLogo=()=>sitesSystemImage("/onzetrots-tv/assets/logo.png");
const v17Standings=()=>[
 ["DUNO 1",13,10,2,1,17,32,"W,W,G,W,V"],["SV Loosduinen 1",13,9,2,2,14,29,"W,W,W,V,G"],["RAS 1",13,8,3,2,12,27,"W,G,G,W,W"],["HMSH 1",13,8,1,4,9,25,"W,V,W,G,W"],["Duindorp SV 1",13,7,3,3,8,24,"W,W,G,V,W"],["GDA 1",13,7,1,5,5,22,"V,W,W,V,G"],["Quick Steps 1",13,6,2,5,3,20,"G,W,V,W,V"],["Vredenburch 1",13,5,3,5,0,18,"G,G,V,W,W"],["VCS 1",13,5,2,6,-3,17,"V,V,W,G,W"],["DHC 1",13,4,3,6,-5,15,"G,W,V,V,W"],["Houtwijk 1",13,4,1,8,-9,13,"V,V,W,V,V"],["SEV 1",13,3,2,8,-11,11,"W,V,V,G,V"],["PGS/VOGEL 1",13,2,2,9,-17,8,"V,V,G,V,V"],["Wanica Star 1",13,1,1,11,-23,4,"V,V,V,V,V"]
].map(([primary,played,won,drawn,lost,difference,points,form],index)=>({id:`standing-${index+1}`,primary:String(primary),rank:index+1,played:String(played),won:String(won),drawn:String(drawn),lost:String(lost),difference:Number(difference)>0?`+${difference}`:String(difference),points:String(points),value:String(points),form:String(form).split(",") as Array<"W"|"G"|"V">,own:String(primary).startsWith("Duindorp"),image:String(primary).startsWith("Duindorp")?ownLogo():undefined}));
const v17Fixtures=()=>[
 {id:"fixture-1",home:"Duindorp SV JO13-1",away:"Quick JO13-2",time:"09:00",tag:"ZA 17 OKT",field:"Veld 2",secondary:"Kleedkamer 3 / 4",homeOwn:true,homeImage:ownLogo(),homeScore:"4",awayScore:"1"},
 {id:"fixture-2",home:"HBS JO15-2",away:"Duindorp SV JO15-1",time:"10:30",tag:"ZA 17 OKT",field:"Veld 3",secondary:"Kleedkamer 5 / 6",awayOwn:true,awayImage:ownLogo(),homeScore:"2",awayScore:"2"},
 {id:"fixture-3",home:"Duindorp SV JO17-1",away:"DUNO JO17-1",time:"11:00",tag:"ZA 17 OKT",field:"Veld 2",secondary:"Kleedkamer 3 / 4",homeOwn:true,homeImage:ownLogo(),homeScore:"3",awayScore:"0"},
 {id:"fixture-4",home:"Duindorp SV 2",away:"GDA 2",time:"12:00",tag:"ZA 17 OKT",field:"Veld 1",secondary:"Kleedkamer 1 / 2",homeOwn:true,homeImage:ownLogo(),homeScore:"2",awayScore:"1"},
 {id:"fixture-5",home:"Die Haghe VR1",away:"Duindorp SV VR1",time:"12:30",tag:"ZA 17 OKT",field:"Veld 2",secondary:"Kleedkamer 7 / 8",awayOwn:true,awayImage:ownLogo(),homeScore:"1",awayScore:"3"},
 {id:"fixture-6",home:"SV Loosduinen 1",away:"Duindorp SV 1",time:"14:30",tag:"ZA 17 OKT",field:"Veld 1",secondary:"Sportpark Madestein",awayOwn:true,awayImage:ownLogo(),homeScore:"1",awayScore:"2"}
].map(row=>({...row,primary:row.home,away:row.away}));
function v17Rows(kind:SitesUnifiedKind):SitesTvContent["rows"]{
 if(kind==="competitie"||kind==="sportlink-extra")return v17Standings();
 if(["programma","uitslagen","matchday","bezoekers"].includes(kind))return v17Fixtures();
 if(kind==="trainingen")return ["JO13-1","JO15-1","JO17-1","JO19-1","Duindorp SV 1","Duindorp SV 2"].map((team,index)=>({id:`training-${index}`,primary:team,time:["17:00","17:30","18:00","18:30","19:30","20:00"][index],tag:"tot 21:00",field:index>3?"Veld 1":"Veld 2",secondary:String(index+1),image:team.startsWith("Duindorp")?ownLogo():undefined}));
 if(kind==="agenda")return ["Start jeugdprogramma","Duindorp SV 1 – Vredenburch 1","Kantine geopend","Clubavond","Overleg vrijwilligers"].map((primary,index)=>({id:`agenda-${index}`,primary,secondary:index<2?"Sportpark Houtrust":"Clubhuis",time:["08:30","14:30","17:00","19:30","19:00"][index],value:["17","17","17","24","27"][index],tag:"OKT",field:index===4?"DI":"ZA"}));
 if(kind==="rss")return ([
  ["Een nieuwe zaterdag op Houtrust","Clubnieuws · 13 oktober","Bekijk het programma en de praktische informatie voor de komende wedstrijddag.","clubhuis.jpg"],
  ["Werkzaamheden rondom het sportpark","Praktisch · 12 oktober","De hoofdingang is bereikbaar. Kom op tijd en parkeer op de aangegeven plaatsen.","duindorp-luchtfoto.jpg"],
  ["De kantine is weer geopend","Kantine · 10 oktober","Voor en na de wedstrijden kun je terecht in het clubhuis. De actuele prijslijst staat op het scherm.","clubhuis.jpg"],
  ["Clubavond op zaterdag 24 oktober","Agenda · 9 oktober","Een avond in het clubhuis voor leden en vrijwilligers. Meer informatie staat op de clubwebsite.","havenlicht.jpg"],
  ["Aanmelden voor een vrijwilligerstaak","Vrijwilligers · 8 oktober","De club zoekt hulp bij de kantine, wedstrijdzaken en het onderhoud van het sportpark.","historische-poort.jpg"]
 ] as const).map(([primary,tag,secondary,image],index)=>({id:`news-${index}`,primary,secondary,tag,image:sitesSystemImage(`/onzetrots/originals/${image}` as keyof typeof sitesSystemImageChecksums)}));
 if(kind==="verjaardagen")return ["Sam de Vries","Noa Jansen","Jesse Bakker","Mila van Dijk","Daan Visser","Sem Bos"].map((primary,index)=>({id:`birthday-${index}`,primary,secondary:["JO13-1","VR1","Duindorp SV 1","VR1","JO17-1","Duindorp SV 2"][index],tag:index<2?"Vandaag":`${14+index} okt`,value:["12 jaar","24 jaar","27 jaar","22 jaar","16 jaar","31 jaar"][index]}));
 if(kind==="kantine")return ([["Koffie","€ 2,00","Warme dranken"],["Cappuccino","€ 2,50","Warme dranken"],["Frisdrank","€ 2,50","Koude dranken"],["Water","€ 2,00","Koude dranken"],["Tosti kaas","€ 3,00","Uit de keuken"],["Broodje kroket","€ 3,50","Uit de keuken"]] as const).map(([primary,value,tag],index)=>({id:`menu-${index}`,primary,value,tag}));
 if(kind==="partners")return ["bnu.svg","kwaliteit-kozijnen-holland.svg","proto-tegelzetbedrijf.svg","deelman-daktechniek.svg","rw-repair.png","dg-webservices.svg"].map((file,index)=>({id:`partner-${index}`,primary:`Partner ${index+1}`,image:sitesSystemImage(`/onzetrots-tv/assets/sponsors/${file}` as keyof typeof sitesSystemImageChecksums)}));
 if(kind==="vacatures")return ([["Kantinemedewerker","Een zaterdag per maand","Help mee achter de bar."],["Jeugdtrainer","In overleg","Begeleid een jeugdteam."],["Wedstrijdsecretariaat","Zaterdagochtend","Ontvang teams op de club."]] as const).map(([primary,value,secondary],index)=>({id:`role-${index}`,primary,value,secondary}));
 if(kind==="led")return [{id:"home",primary:"Duindorp SV 1",value:"3",own:true,image:ownLogo()},{id:"away",primary:"SV Loosduinen 1",value:"1"}];
 return [];
}
function v17Slide(definition:typeof v17Definitions[number],orientation:"landscape"|"portrait"):SitesStudioSlide{
 let fixtures:SitesTvContent["rows"]=v17Rows(definition.kind);const first=fixtures[0] as Record<string,unknown>|undefined;
 if(definition.kind==="bezoekers")fixtures=[
  {id:"visitor-1",home:"Duindorp SV JO13-1",away:"Quick JO13-2",primary:"Duindorp SV JO13-1",time:"09:00",field:"Veld 2",secondary:"4",tag:"Sportpark Houtrust",homeOwn:true,homeImage:ownLogo()},
  {id:"visitor-2",home:"Duindorp SV JO17-1",away:"DUNO JO17-1",primary:"Duindorp SV JO17-1",time:"11:00",field:"Veld 2",secondary:"4",tag:"Sportpark Houtrust",homeOwn:true,homeImage:ownLogo()},
  {id:"visitor-3",home:"Duindorp SV 2",away:"GDA 2",primary:"Duindorp SV 2",time:"12:00",field:"Veld 1",secondary:"2",tag:"Sportpark Houtrust",homeOwn:true,homeImage:ownLogo()},
  {id:"visitor-4",home:"Duindorp SV 3",away:"Houtwijk 3",primary:"Duindorp SV 3",time:"12:30",field:"Veld 2",secondary:"4",tag:"Sportpark Houtrust",homeOwn:true,homeImage:ownLogo()}
 ];
 const subtitle=definition.kind==="competitie"?"4e klasse C · 2026–2027":definition.kind==="bezoekers"?"Zaterdag 17 oktober":definition.kind==="welkom"?"Onze Club. Onze Trots.":"Actuele clubinformatie";
 return sitesStudioSlideSchema.parse({id:`sites-v17-${definition.kind}-${orientation}-hd`,name:definition.name,title:definition.name.toUpperCase(),time:definition.kind==="bezoekers"?"10:30 · VOORBEELDTIJD":"",subtitle,location:"Sportpark Houtrust",duration:20,color:"#03438a",background:"#03438a",bold:true,italic:false,align:"left",size:58,context:true,showLocation:true,animation:"Flow in",transition:"Rustig",orientation,themeId:"onzetrots-tv",unifiedKind:definition.kind,extraType:definition.extraType??"periodestand",body:definition.kind==="vrij"?"Samen maken we de club.":definition.kind==="welkom"?"Onze Club. Onze Trots.":"",vacancyContact:"Vraag bij de club naar de mogelijkheden.",qrUrl:"https://duindorpsv.nl",clubName:"Duindorp SV",logo:ownLogo(),tv:{kind:definition.contentKind,title:definition.name,subtitle,location:"Sportpark Houtrust",time:definition.kind==="bezoekers"?"10:30 · VOORBEELDTIJD":undefined,clubName:"Duindorp SV",logo:ownLogo(),rows:fixtures,values:definition.kind==="welkom"?["Onze Wijk.","Onze Club.","Onze Trots."]:undefined,match:definition.kind==="led"?{home:"Duindorp SV 1",away:"SV Loosduinen 1",homeScore:"3",awayScore:"1",homeLogo:ownLogo(),homeOwn:true,clock:"67′",label:"LIVE"}:definition.kind==="matchday"&&first?{home:String(first.home),away:String(first.away),homeLogo:first.homeImage,awayLogo:first.awayImage,homeOwn:Boolean(first.homeOwn),awayOwn:Boolean(first.awayOwn)}:undefined}});
}
/** Literal editable examples from the immutable Source; never live provider/tenant data. */
export const studioSitesSystemTemplates:readonly StudioSystemTemplate[]=( ["landscape-hd","portrait-hd"] as const).flatMap(formatId=>[
 ...literalStarters.studio.map((entry,index)=>{const category=categories[index]!;const id=`sites-v11-${category}-${formatId}`;const slide=sitesStudioSlideSchema.parse({...canonicalStarter(entry.slide) as Record<string,unknown>,id,themeId:"fieldflow",orientation:formatId==="portrait-hd"?"portrait":"landscape"});return {id,category,description:"Bewerkbaar voorbeeld uit Sites v11 · FieldFlow",document:createSitesStudioDocument(slide),formatId,name:slide.name,version:11};}),
 ...literalStarters.tv.map((entry,index)=>{const category=tvCategories[index]!;const id=`sites-v11-tv-${entry.content.kind}-${formatId}`;const content=canonicalStarter(entry.content) as Record<string,unknown>;const slide=sitesStudioSlideSchema.parse({...canonicalStarter(literalStarters.studio[0]!.slide) as Record<string,unknown>,id,name:entry.name,title:content.title,time:content.time??"",subtitle:content.subtitle??"",location:content.location??"",photo:content.background,clubName:content.clubName,logo:content.logo,themeId:"onzetrots-tv",tv:content,overlay:20,duration:15,color:"#123f8d",background:"#063893",orientation:formatId==="portrait-hd"?"portrait":"landscape"});return {id,category,description:"Bewerkbaar voorbeeld uit Sites v11 · OnzeTrots TV",document:createSitesStudioDocument(slide),formatId,name:entry.name,version:11};}),
 ...v17Definitions.map(definition=>{const orientation=formatId==="portrait-hd"?"portrait":"landscape";const slide=v17Slide(definition,orientation);return{id:slide.id,category:definition.category,description:"Actuele unified presentatie uit Sites v17",document:createSitesStudioDocument(slide),formatId,name:definition.name,version:17};})
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
