import {mkdir,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import sharp from "sharp";
import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {sportDynamicSlideTypes,sitesDynamicConfigurationSchema,sitesPresentationSchema,sitesSystemImageChecksums,type SitesPresentation,type SitesDynamicConfiguration,type PlayerDynamicTemplatePayload} from "@veyocast/contracts";
import {buildSitesPresentationFromDynamicPayload} from "@veyocast/content-templates/sites-presentation";
import {resolveSitesDynamicPage,sitesPresentationPages} from "@veyocast/content-templates/sites-presentation-model";
import {createSitesSourceReference,sourceComparisonHash,resolveSitesSourceReferenceDirectory} from "./support/sites-source-reference";
import {buildSitesCaptureHtml,createSitesPresentationCapture} from "../src/sites-dom-capture";
const selectedSource=resolveSitesSourceReferenceDirectory();
const enabled=Boolean(process.env.SITES_CAPTURE_TEST_CHROMIUM&&selectedSource&&process.env.SITES_DYNAMIC_COMPARISON_DIRECTORY);
const sourceDirectory=resolve(selectedSource??"/missing-sites-reference"),outputDirectory=resolve(process.env.SITES_DYNAMIC_COMPARISON_DIRECTORY??"/tmp/missing-sites-dynamic-evidence");
const families=[...sportDynamicSlideTypes,"menu",...(["live","goal","start","half","end"]as const).map(moment=>`led-${moment}`)]as const;
const matrix=families.flatMap(family=>(["landscape","portrait"]as const).flatMap(orientation=>(["fieldflow","onzetrots-tv"]as const).map(themeId=>({family,orientation,themeId}))));
const logo={kind:"system"as const,path:"/onzetrots-tv/assets/logo.png"as const,checksumSha256:sitesSystemImageChecksums["/onzetrots-tv/assets/logo.png"]};
const rows=Array.from({length:17},(_,index)=>({id:`fixture-${index}`,primary:`Duindorp SV ${index+1} – Bezoekers ${index+1}`,teamName:`Fixtureteam ${index+1}`,displayName:`Fixture ${index+1}`,homeTeam:`Duindorp SV ${index+1}`,awayTeam:`Bezoekers ${index+1}`,homeScore:2,awayScore:1,kickoffAt:"2026-10-11T11:15:00Z",kickoffTime:"13:15",time:"13:15",location:"Fixture sportpark",field:"Veld 1",selected:index===0,homeMatch:true,position:index+1,played:5,won:3,drawn:1,lost:1,goalDifference:6,points:10,form:["win","draw","loss","win","draw"],month:10,day:11,age:20,role:"Fixtureteam"}));
let reference:Awaited<ReturnType<typeof createSitesSourceReference>>|undefined;
const results:Record<string,unknown>[]=[];
function presentation(family:string,configuration:SitesDynamicConfiguration):Extract<SitesPresentation,{kind:"dynamic"}>{
 if(family==="menu")return sitesPresentationSchema.parse({kind:"dynamic",configuration,content:{kind:"kantine",title:configuration.title,clubName:"Duindorp SV",logo,rows:rows.map((row,index)=>({id:row.id,primary:`Fixtureproduct ${index+1}`,secondary:"Genormaliseerde productvariant",value:`€ ${(250+index*50)/100}`,tag:"Kantine"}))}})as Extract<SitesPresentation,{kind:"dynamic"}>;
 const led=family.startsWith("led-");
 const payload:PlayerDynamicTemplatePayload={schemaVersion:1,orientation:configuration.orientation,slideType:led?"ledscores_live_match":family as PlayerDynamicTemplatePayload["slideType"],snapshotId:"10000000-0000-4000-8000-000000001191",snapshotHash:"a".repeat(64),templateVersionId:"20000000-0000-4000-8000-000000001191",templateSlug:`editorial-arena-${family.replaceAll("_","-")}-${configuration.orientation}`,data:{type:led?"ledscores_live_match":family,brand:{clubName:"Duindorp SV"},sitesConfiguration:configuration,...(led?{}:{sport:{title:configuration.title,items:rows.map(row=>({...row,kickoffAt:family==="sport_results"?"2026-10-10T11:15:00Z":row.kickoffAt,status:family==="sport_results"?"finished":"scheduled"})),birthdays:rows}})}};
 const projected=buildSitesPresentationFromDynamicPayload(payload,configuration,new Date("2026-10-11T10:00:00Z"),led?{home:{name:"Duindorp SV 1",score:2,logoUrl:null},away:{name:"Bezoekers 1",score:1,logoUrl:null},clockLabel:"67:24",homeOwn:true,awayOwn:false,periodLabel:"Tweede helft",timeline:[{id:"fixture-goal",label:"Doelpunt",clockLabel:"65′",homeScore:2,awayScore:1}]}:undefined);
 if(projected?.kind!=="dynamic")throw Error(`Canonical projection unavailable for ${family}`);
 return {...projected,content:{...projected.content,clubName:"Duindorp SV",logo,rows:projected.content.rows.map(row=>({...row,image:logo})),...(projected.content.match?{match:{...projected.content.match,homeLogo:logo}}:{})}};
}
describe.runIf(enabled)("literal original dynamic renderers against canonical stored-data presentations",()=>{
 beforeAll(async()=>{reference=await createSitesSourceReference(sourceDirectory,process.env.SITES_CAPTURE_TEST_CHROMIUM!);await mkdir(outputDirectory,{recursive:true});},30000);
 afterAll(async()=>{await reference?.close();await writeFile(join(outputDirectory,"comparison.json"),JSON.stringify({sourceDirectory,sourceRevision:"b1cae899af19fc39908217253094c5240d7359fc",sourceHashes:reference?.sourceHashes,assertionMode:process.env.SITES_SOURCE_COMPARE_REPORT_ONLY==="1"?"REPORT_ONLY":"STRICT_PIXEL_EQUALITY",caseCount:results.length,exactCount:results.filter(row=>row.changedPixels===0).length,comparisons:results},null,2));});
 it.each(matrix)("$family / $orientation / $themeId",async({family,orientation,themeId})=>{
  const led=family.startsWith("led-");const configuration=sitesDynamicConfigurationSchema.parse({schemaVersion:1,rendererVersion:"sites-v11",sourceRevision:"b1cae899af19fc39908217253094c5240d7359fc",provider:led?"led-scores":family==="menu"?"menu":"sportlink",orientation,themeId,title:family==="led-live"?"De tussenstand":family==="led-goal"?"GOALLL!":family,rowsPerPage:8,...(led?{ledMoment:family.slice(4)}:{})});
  const input=presentation(family,configuration);expect(input.content.rows.length).toBeGreaterThan(0);
  const pages=sitesPresentationPages(input),selectedPages=pages>1?[0,pages-1]:[0];
  const artboard={width:orientation==="portrait"?1080:1920,height:orientation==="portrait"?1920:1080};
  const capture=await createSitesPresentationCapture({presentation:input,executablePath:process.env.SITES_CAPTURE_TEST_CHROMIUM!});
  try{for(const page of selectedPages){
   const resolved=resolveSitesDynamicPage(input,undefined,page);
   // The source authoring pager is omitted: the immutable Player item owns its page clock.
   // Identical selected rows and page metadata are passed to the literal source frame.
   let sourceMetrics:unknown;let productionMetrics:unknown;
   const source=await reference!.capture(themeId==="onzetrots-tv"?"tv":"experience",themeId==="onzetrots-tv"?{content:resolved.content,orientation}:resolved.design,artboard.width,artboard.height,value=>{sourceMetrics=value;});
   if(process.env.SITES_COMPARE_INSPECT)await reference!.capture("static",buildSitesCaptureHtml(input,{},page),artboard.width,artboard.height,value=>{productionMetrics=value;});
   const production=await capture.renderPng(page*configuration.seconds*1000+1200),a=await sharp(source).removeAlpha().raw().toBuffer(),b=await sharp(production).removeAlpha().raw().toBuffer();
   expect(a.length).toBe(b.length);let changedPixels=0,total=0,maximum=0;const diff=Buffer.alloc(a.length);
   for(let index=0;index<a.length;index+=3){let changed=false;for(let channel=0;channel<3;channel++){const delta=Math.abs(a[index+channel]!-b[index+channel]!);diff[index+channel]=delta;total+=delta;maximum=Math.max(maximum,delta);changed ||= delta!==0;}if(changed)changedPixels++;}
   const name=`${family}--${orientation}--${themeId}--page-${page}`;
   await Promise.all([writeFile(join(outputDirectory,`${name}--source.png`),source),writeFile(join(outputDirectory,`${name}--production.png`),production),writeFile(join(outputDirectory,`${name}--diff.png`),await sharp(diff,{raw:{width:artboard.width,height:artboard.height,channels:3}}).png().toBuffer())]);
   const result={status:changedPixels===0?"EXACT":"DIFFERENT",caseId:name,family,orientation,themeId,page,pages,totalRows:input.content.rows.length,displayedRows:resolved.content.rows.length,width:artboard.width,height:artboard.height,changedPixels,changedPixelFraction:changedPixels/(a.length/3),meanChannelDifference:total/a.length,maximumChannelDifference:maximum,sourceSha256:sourceComparisonHash(source),productionSha256:sourceComparisonHash(production),...(productionMetrics?{sourceMetrics,productionMetrics}:{}),scope:"typed normalized synthetic test fixture, identical selected canonical fields, audited source branding; no provider/demoRows call and no production-data/hardware assertion"};results.push(result);await writeFile(join(outputDirectory,`${name}.json`),JSON.stringify(result,null,2));
   if(process.env.SITES_SOURCE_COMPARE_REPORT_ONLY!=="1")expect(changedPixels,`${name}: measured pixel differences are saved with the source and production captures`).toBe(0);
  }}finally{await capture.close();}
 },45000);
});
