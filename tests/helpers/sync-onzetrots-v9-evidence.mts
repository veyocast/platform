import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const require=createRequire(new URL('../../apps/media-worker/package.json',import.meta.url)),sharp=require('sharp');
const [matrixDir,referenceDir,birthdayDir,outputDir]=process.argv.slice(2);
if(!matrixDir||!referenceDir||!birthdayDir||!outputDir)throw Error('Explicit own input/output directories required');
const output=resolve(outputDir);await mkdir(output,{recursive:false});await mkdir(join(output,'native'));
const matrix=JSON.parse(await readFile(join(matrixDir,'matrix.json'),'utf8'));
const birthdays=JSON.parse(await readFile(join(birthdayDir,'matrix.json'),'utf8'));
const reference=JSON.parse(await readFile(join(referenceDir,'reference.json'),'utf8'));
for(let i=0;i<matrix.length;i++){
 const row=matrix[i];if(row.family==='birthdays')matrix[i]=birthdays.find((b:{filename:string})=>b.filename===row.filename);
}
if(matrix.length!==144||reference.matrix.length!==144)throw Error('Complete 36×2×2 closure required');
const selected=['standings-landscape-light.png','matchday-landscape-light.png','birthdays-portrait-dark.png','menu-portrait-light.png','scoreboard-portrait-light.png','welcome-landscape-light.png'];
for(const row of matrix){
 const workerDir=row.family==='birthdays'?birthdayDir:matrixDir,bytes=await readFile(join(workerDir,row.filename));
 if(createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw Error('Actual capture identity changed');
 const a=await sharp(bytes).toColourspace('srgb').removeAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(join(referenceDir,row.filename)).toColourspace('srgb').removeAlpha().raw().toBuffer({resolveWithObject:true});
 if(a.info.width!==b.info.width||a.info.height!==b.info.height)throw Error('Native geometry mismatch');
 let sum=0,changed=0;
 for(let p=0;p<a.data.length;p+=3){let max=0;for(let c=0;c<3;c++){const delta=Math.abs(a.data[p+c]-b.data[p+c]);sum+=delta;max=Math.max(max,delta);}if(max>25)changed++;}
 row.contextScalePercent=130;row.comparison={meanAbsoluteChannelDifference:sum/a.data.length,pixelsOver25:changed/(a.info.width*a.info.height)};
 if(selected.includes(row.filename)){
  await sharp(bytes).png({compressionLevel:9}).toFile(join(output,'native','worker-'+row.filename));
  await sharp(join(referenceDir,row.filename)).png({compressionLevel:9}).toFile(join(output,'native','reference-'+row.filename));
 }
}
for(const orientation of ['landscape','portrait'])for(const mode of ['light','dark'])for(const kind of ['worker','reference']){
 const width=orientation==='landscape'?320:180,height=orientation==='landscape'?180:320,caption=24,columns=6,tiles=[];
 for(const [index,row]of matrix.filter((r:{orientation:string;mode:string})=>r.orientation===orientation&&r.mode===mode).entries()){
  const left=(index%columns)*width,top=Math.floor(index/columns)*(height+caption),source=kind==='reference'?referenceDir:row.family==='birthdays'?birthdayDir:matrixDir;
  tiles.push({input:await sharp(join(source,row.filename)).resize(width,height).png().toBuffer(),left,top});
  tiles.push({input:Buffer.from(`<svg width="${width}" height="${caption}"><rect width="100%" height="100%" fill="#fff"/><text x="8" y="16" font-family="sans-serif" font-size="12" fill="#102441">${row.family}</text></svg>`),left,top:top+height});
 }
 await sharp({create:{width:columns*width,height:6*(height+caption),channels:3,background:'#ffffff'}}).composite(tiles).jpeg({quality:90}).toFile(join(output,`${kind}-${orientation}-${mode}.jpg`));
}
await writeFile(join(output,'native-matrix.json'),JSON.stringify({schemaVersion:1,sourceRevision:'5ba52a657d6d16ad103ba2fb43b8db18aa83715a',userApprovedDelta:'Context row 11→14.3 logical pixels (+30%), reference archive unchanged',matrix},null,2)+'\n');
await writeFile(join(output,'reference-matrix.json'),JSON.stringify(reference,null,2)+'\n');
console.log(JSON.stringify({captures:matrix.length,reference:reference.matrix.length,worst:[...matrix].sort((a,b)=>b.comparison.meanAbsoluteChannelDifference-a.comparison.meanAbsoluteChannelDifference).slice(0,8).map(row=>({family:row.family,orientation:row.orientation,mode:row.mode,comparison:row.comparison}))},null,2));
