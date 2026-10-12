import {createHash} from "node:crypto";
import {mkdir,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {afterAll,beforeAll,describe,expect,it} from "vitest";
import sharp from "sharp";
import {createSitesStudioDocument,studioSitesSystemTemplates} from "@veyocast/studio";
import {createSitesStudioCapture} from "../src/sites-dom-capture";
import manifest from "../../../packages/content-templates/src/sites-system-assets.json";
import {createSitesSourceReference,resolveSitesSourceReferenceDirectory} from "./support/sites-source-reference";

interface Comparison {templateId:string;themeId:string;orientation:string;width:number;height:number;changedPixels:number;changedPixelFraction:number;meanChannelDifference:number;maximumChannelDifference:number;sourceSha256:string;productionSha256:string;sourceComponentSha256:string;sourceCssSha256:string;status:"EXACT"|"DIFFERENT";captureTimeMs:number;scope:string}
const matrix=studioSitesSystemTemplates.flatMap(template=>(["fieldflow","onzetrots-tv"]as const).map(themeId=>({template,themeId})));
const selectedSource=resolveSitesSourceReferenceDirectory();
const enabled=Boolean(process.env.SITES_CAPTURE_TEST_CHROMIUM&&selectedSource&&process.env.SITES_SOURCE_COMPARISON_DIRECTORY);
const sourceDirectory=resolve(selectedSource??"/missing-sites-reference");
const outputDirectory=resolve(process.env.SITES_SOURCE_COMPARISON_DIRECTORY??"/tmp/missing-sites-evidence");
const hash=(value:Uint8Array|string)=>createHash("sha256").update(value).digest("hex");
type SourceObject=Record<string,unknown>;
let sourceFixtures:{studio:Array<{slide:SourceObject}>;tv:Array<{name:string;content:SourceObject}>};
let reference:Awaited<ReturnType<typeof createSitesSourceReference>>|undefined;let sourceComponentSha256="";let sourceCssSha256="";
const comparisons:Comparison[]=[];

describe.runIf(enabled)("original immutable Sites components compared with production trusted DOM",()=>{
 beforeAll(async()=>{
  reference=await createSitesSourceReference(sourceDirectory,process.env.SITES_CAPTURE_TEST_CHROMIUM!);
  sourceFixtures=await reference.fixtures() as typeof sourceFixtures;
  sourceComponentSha256=reference.sourceHashes["app/prototype/studio.tsx"]!;sourceCssSha256=reference.sourceHashes["app/prototype/studio.module.css"]!;
  await mkdir(outputDirectory,{recursive:true});
 },30000);
 afterAll(async()=>{await reference?.close();if(comparisons.length)await writeFile(join(outputDirectory,"comparison.json"),JSON.stringify({sourceDirectory,sourceRevision:"b1cae899af19fc39908217253094c5240d7359fc",caseCount:comparisons.length,exactCount:comparisons.filter(row=>row.status==="EXACT").length,differentCount:comparisons.filter(row=>row.status==="DIFFERENT").length,reactVersion:"19.2.7 (same patched engine on both sides)",browser:"Chromium 1228, DPR 1",comparisons},null,2));});
 it.each(matrix)("$template.id → $themeId",async({template,themeId})=>{
  const original=template.document.sitesPresentation;if(original?.kind!=="studio")throw Error("Missing canonical Studio starter");
  const slide={...original.slide,themeId,clubName:"Duindorp SV",logo:{kind:"system"as const,path:"/onzetrots-tv/assets/logo.png"as const,checksumSha256:manifest.files.find(asset=>asset.path==="/onzetrots-tv/assets/logo.png")!.sha256},...(themeId==="onzetrots-tv"&&!original.slide.tv?{tv:{kind:"generic"as const,title:original.slide.title,rows:[],scale:100}}:{})};
  const document=createSitesStudioDocument(slide);
  const production=await createSitesStudioCapture({document,executablePath:process.env.SITES_CAPTURE_TEST_CHROMIUM!});
  try{
   // Expected content comes from independently exported immutable Source constants,
   // never the production catalog/projector. Only the explicit orientation/theme/QA brand
   // overrides are shared; corrupt production rows/photos/text therefore remain visible.
   const categories=["matchday","schedule","result","sponsor","menu","activity","volunteer","welcome","cancelled","social","emergency"];
   let expected:SourceObject;
   if(template.id.startsWith("sites-v11-tv-")){
    const kind=template.id.replace(/^sites-v11-tv-/,"").replace(/-(landscape|portrait)-hd$/,"");
    const source=sourceFixtures.tv.find(entry=>entry.content.kind===kind);if(!source)throw Error("Original Source TV starter missing");const content=source.content;
    expected={...sourceFixtures.studio[0]!.slide,name:source.name,title:content.title,time:content.time??"",subtitle:content.subtitle??"",location:content.location??"",photo:content.background??"",color:"#123f8d",background:"#063893",clubName:content.clubName,logo:content.logo,tv:content,overlay:20,duration:15};
   }else{const source=sourceFixtures.studio[categories.indexOf(template.id.replace(/^sites-v11-/,"").replace(/-(landscape|portrait)-hd$/,""))];if(!source)throw Error("Original Source FieldFlow starter missing");expected={...source.slide};}
   if(themeId==="onzetrots-tv"&&!expected.tv)expected.tv={kind:"generic",title:expected.title,rows:[],scale:100};
   const sourceSlide={...expected,orientation:original.slide.orientation,themeId,clubName:"Duindorp SV",logo:"/onzetrots-tv/assets/logo.png"};
   const sourceJson=JSON.stringify(sourceSlide).replace(/</g,"\\u003c");
   const sourcePng=await reference!.capture("studio",JSON.parse(sourceJson),document.artboard.width,document.artboard.height);const productionPng=await production.renderPng(1200);
   const referencePixels=await sharp(sourcePng).removeAlpha().raw().toBuffer();const actual=await sharp(productionPng).removeAlpha().raw().toBuffer();
   expect(actual.length).toBe(referencePixels.length);
   let changedPixels=0,totalDifference=0,maximum=0;const diff=Buffer.alloc(referencePixels.length);
   for(let index=0;index<actual.length;index+=3){let changed=false;for(let channel=0;channel<3;channel++){const delta=Math.abs(actual[index+channel]!-referencePixels[index+channel]!);diff[index+channel]=delta;totalDifference+=delta;maximum=Math.max(maximum,delta);changed ||= delta!==0;}if(changed)changedPixels++;}
   const name=`${template.id}--${themeId}`;
   await Promise.all([writeFile(join(outputDirectory,`${name}--source.png`),sourcePng),writeFile(join(outputDirectory,`${name}--production.png`),productionPng),writeFile(join(outputDirectory,`${name}--diff.png`),await sharp(diff,{raw:{width:document.artboard.width,height:document.artboard.height,channels:3}}).png().toBuffer())]);
   const row:Comparison={templateId:template.id,themeId,orientation:slide.orientation,width:document.artboard.width,height:document.artboard.height,changedPixels,changedPixelFraction:changedPixels/(actual.length/3),meanChannelDifference:totalDifference/actual.length,maximumChannelDifference:maximum,sourceSha256:hash(sourcePng),productionSha256:hash(productionPng),sourceComponentSha256,sourceCssSha256,status:changedPixels?"DIFFERENT":"EXACT",captureTimeMs:1200,scope:"independent immutable Source starter constants and original SlideCanvas/CSS/assets versus the actual production starter catalog/worker renderer; only explicit orientation/theme/QA-brand overrides are shared; examples are not production tenant data; no physical-device claim"};
   comparisons.push(row);await writeFile(join(outputDirectory,`${name}.json`),JSON.stringify(row,null,2));expect(changedPixels).toBe(0);
  }finally{await production.close();}
 },45000);
});
