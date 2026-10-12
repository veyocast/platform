import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// Photo geometry stays locked: only tonal filters and decorative paint layers.
// No generated architecture, displacement, cropping or shape reconstruction.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sourceDir=path.join(root,'public/onzetrots/originals');
const outputDir=path.join(root,'public/onzetrots/brush');
mkdirSync(outputDir,{recursive:true});
const frame=readFileSync(path.join(outputDir,'brush-frame.png'));
const sources=JSON.parse(readFileSync(path.join(sourceDir,'sources.json'),'utf8')).images;
const results=[];
for(const source of sources){
 const original=readFileSync(path.join(sourceDir,source.file));
 const hash=createHash('sha256').update(original).digest('hex');
 if(hash!==source.sha256)throw new Error(`Changed reference photo: ${source.file}`);
 const {width:w,height:h}=source.dimensions;
 const id=source.file.replace(/\.jpg$/,'');
 const credit=id==='havenlicht'?`<rect x="${w*.09}" y="${h*.945}" width="${w*.84}" height="${h*.055}" fill="black"/>`:'';
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<title>OnzeTrots · ${id}</title>
<desc>Blauw-witte brush/grunge-compositie met ongewijzigde fotogeometrie. Bron: ${source.uploaded_filename}.</desc>
<defs>
 <filter id="club-ink" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feColorMatrix type="saturate" values="0"/>
  <feComponentTransfer>
   <feFuncR type="table" tableValues="0.008 0.012 0.145 0.537 0.827 0.957 1"/>
   <feFuncG type="table" tableValues="0.161 0.263 0.396 0.675 0.878 0.973 1"/>
   <feFuncB type="table" tableValues="0.345 0.541 0.647 0.812 0.929 0.988 1"/>
  </feComponentTransfer>
 </filter>
 <filter id="ink-grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency=".68" numOctaves="3" seed="37" stitchTiles="stitch"/>
  <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 5 -2.6"/>
 </filter>
 <filter id="soft-paint-boundary"><feGaussianBlur stdDeviation="${Math.min(w,h)*.018}"/></filter>
 <mask id="paint-edges"><rect width="${w}" height="${h}" fill="white"/><rect x="${w*.05}" y="${h*.05}" width="${w*.90}" height="${h*.90}" fill="black" filter="url(#soft-paint-boundary)"/>${credit}</mask>
 <mask id="grain-area"><rect width="${w}" height="${h}" fill="white"/>${credit}</mask>
</defs>
<rect width="${w}" height="${h}" fill="white"/>
<image x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" filter="url(#club-ink)" xlink:href="data:image/jpeg;base64,${original.toString('base64')}"/>
<g mask="url(#grain-area)"><rect width="${w}" height="${h}" filter="url(#ink-grain)" opacity=".24"/></g>
<image x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" mask="url(#paint-edges)" xlink:href="data:image/png;base64,${frame.toString('base64')}"/>
</svg>`;
 writeFileSync(path.join(outputDir,`${id}.svg`),svg);
 results.push({file:`${id}.svg`,reference:source.file,reference_sha256:hash,width:w,height:h,geometry:'Original source pixels at identical coordinates; tonal filters and independent paint overlay only.'});
}
writeFileSync(path.join(outputDir,'sources.json'),JSON.stringify({method:'Source-preserving SVG photo composition',frame:'brush-frame.png',images:results},null,2)+'\n');
console.log(`Created ${results.length} OnzeTrots backgrounds with verified source geometry.`);
