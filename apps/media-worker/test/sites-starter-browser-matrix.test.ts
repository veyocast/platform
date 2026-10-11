import {createHash} from "node:crypto";
import {mkdir,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {describe,expect,it} from "vitest";
import sharp from "sharp";
import {createSitesStudioDocument,studioSitesSystemTemplates} from "@veyocast/studio";
import {createSitesStudioCapture} from "../src/sites-dom-capture";
const matrix=studioSitesSystemTemplates.flatMap(template=>(["fieldflow","onzetrots-tv"]as const).map(themeId=>({template,themeId})));
describe.runIf(Boolean(process.env.SITES_CAPTURE_TEST_CHROMIUM))("all Sites Studio starters through the production browser renderer",()=>{
 it.each(matrix)("$template.id → $themeId",async({template,themeId})=>{
  const presentation=template.document.sitesPresentation;
  if(presentation?.kind!=="studio")throw Error("The canonical Studio starter is unavailable");
  const slide={...presentation.slide,themeId,...(themeId==="onzetrots-tv"&&!presentation.slide.tv?{tv:{kind:"generic" as const,title:presentation.slide.title,rows:[],scale:100}}:{})};
  const document=createSitesStudioDocument(slide);
  const capture=await createSitesStudioCapture({document,executablePath:process.env.SITES_CAPTURE_TEST_CHROMIUM!});
  try{
   const png=await capture.renderPng(1200);
   const image=sharp(png),metadata=await image.metadata(),stats=await image.stats();
   expect(metadata).toMatchObject({format:"png",width:document.artboard.width,height:document.artboard.height});
   expect(stats.channels.slice(0,3).some(channel=>channel.stdev>5)).toBe(true);
   expect(png.byteLength).toBeGreaterThan(10_000);
   const outputDirectory=process.env.SITES_CAPTURE_EVIDENCE_DIRECTORY;
   if(outputDirectory){
    await mkdir(outputDirectory,{recursive:true});
    const name=`${template.id}--${themeId}`;
    await writeFile(join(outputDirectory,`${name}.png`),png);
    await writeFile(join(outputDirectory,`${name}.json`),JSON.stringify({templateId:template.id,themeId,orientation:slide.orientation,sourceTheme:presentation.slide.themeId,sourceRevision:presentation.sourceRevision,rendererVersion:presentation.rendererVersion,width:metadata.width,height:metadata.height,bytes:png.byteLength,sha256:createHash("sha256").update(png).digest("hex"),captureTimeMs:1200,scope:"production-trusted-DOM-renderer-with-audited-local-fonts-and-images; not physical-device acceptance"},null,2));
   }
  }finally{await capture.close();}
 },45000);
});
