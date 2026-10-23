import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {syncContentFamilies,syncSlidePresentationSchema} from '../../packages/contracts/src/index';
import {createSyncStudioDocument} from '../../packages/studio/src/sync';
import {createSyncTemplatePreview} from '../../apps/control/app/(shell)/dashboard/studio/sync-template-preview';
import {createSyncSlideCapture} from '../../apps/media-worker/src/sync-dom-capture';

const require=createRequire(new URL('../../apps/media-worker/package.json',import.meta.url)),sharp=require('sharp');
const directory=process.argv[2],referenceDirectory=process.argv[3];
if(!directory)throw Error('Provide a new owned evidence directory; an optional second argument compares an existing native reference directory');
const output=resolve(directory);await mkdir(output,{recursive:false});
const matrix=[];
for(const family of syncContentFamilies)for(const orientation of ['landscape','portrait']as const)for(const mode of ['light','dark']as const){
 const example=createSyncTemplatePreview(family.id,'sync-onzetrots-v1');
 if(example.rendererVersion!=='sync-onzetrots-v1')throw Error('The actual catalogue must use the approved renderer');
 const presentation=syncSlidePresentationSchema.parse({...example,orientation,visual:{...example.visual,mode}}),document=createSyncStudioDocument(presentation),filename=`${family.id}-${orientation}-${mode}.png`;
 const capture=await createSyncSlideCapture({presentation,durationMs:document.motion.durationMs,executablePath:chromium.executablePath()});
 try{
  const bytes=await capture.renderPng(1200),metadata=await sharp(bytes).metadata();
  if(metadata.width!==document.artboard.width||metadata.height!==document.artboard.height)throw Error(`Native canvas mismatch: ${filename}`);
  await writeFile(join(output,filename),bytes,{flag:'wx'});
  let comparison:undefined|{meanAbsoluteChannelDifference:number;pixelsOver25:number};
  if(referenceDirectory){
   const reference=await readFile(join(resolve(referenceDirectory),filename));
   const a=await sharp(bytes).toColourspace('srgb').removeAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(reference).toColourspace('srgb').removeAlpha().raw().toBuffer({resolveWithObject:true});
   if(a.info.width!==b.info.width||a.info.height!==b.info.height)throw Error(`Reference is not native: ${filename}`);
   let sum=0,changed=0;
   for(let i=0;i<a.data.length;i+=3){let maximum=0;for(let c=0;c<3;c++){const delta=Math.abs(a.data[i+c]-b.data[i+c]);sum+=delta;maximum=Math.max(maximum,delta);}if(maximum>25)changed++;}
   // Diagnostic metrics, not an adjustable visual pass threshold. Inspect and
   // explain real layout/copy differences before accepting the final report.
   comparison={meanAbsoluteChannelDifference:sum/a.data.length,pixelsOver25:changed/(a.info.width*a.info.height)};
  }
  matrix.push({family:family.id,orientation,mode,filename,width:metadata.width,height:metadata.height,durationMs:document.motion.durationMs,elapsedMs:1200,rendererVersion:presentation.rendererVersion,sourceRevision:presentation.sourceRevision,comparison});
  await writeFile(join(output,'matrix.json'),JSON.stringify(matrix,null,2));
  process.stdout.write(`${matrix.length}/144 ${filename}\n`);
 }finally{await capture.close();}
}
for(const orientation of ['landscape','portrait']as const)for(const mode of ['light','dark']as const){
 const width=orientation==='landscape'?320:180,height=orientation==='landscape'?180:320,caption=24,columns=6,rows=6,tiles=[];
 const entries=matrix.filter(row=>row.orientation===orientation&&row.mode===mode);
 for(const[index,entry]of entries.entries()){
  const left=(index%columns)*width,top=Math.floor(index/columns)*(height+caption);
  tiles.push({input:await sharp(join(output,entry.filename)).resize(width,height).png().toBuffer(),left,top});
  const label=Buffer.from(`<svg width="${width}" height="${caption}"><rect width="100%" height="100%" fill="#fff"/><text x="8" y="16" font-family="sans-serif" font-size="12" fill="#102441">${entry.family}</text></svg>`);
  tiles.push({input:label,left,top:top+height});
 }
 await sharp({create:{width:columns*width,height:rows*(height+caption),channels:3,background:'#ffffff'}}).composite(tiles).jpeg({quality:90}).toFile(join(output,`contact-${orientation}-${mode}.jpg`));
}
process.stdout.write('All 144 actual Worker captures and four contact sheets complete.\n');
