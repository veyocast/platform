#!/usr/bin/env node
// Deterministic export of the exact Sites vectors. No geometry, colour or typography edits.
// Requirements: Node.js >=20 and sharp 0.34.x (or the supplied runtime's sharp).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
let sharp;
try { sharp = require('sharp'); } catch (error) {
  const deps = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  if (!deps) throw error;
  sharp = require(path.join(deps, 'sharp'));
}
const root = __dirname;
const source = path.join(root, 'source');
const icon = fs.readFileSync(path.join(source, 'brand-icon.svg'), 'utf8');
const wordmark = fs.readFileSync(path.join(source, 'full-light.svg'), 'utf8');
const bg = '#0D1725';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const inner = svg => svg.replace(/^.*?<svg[^>]*>/s, '').replace(/<\/svg>\s*$/, '');
const fit = (svg, vw, vh, x, y, w, h) => `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${vw} ${vh}" preserveAspectRatio="xMidYMid meet">${inner(svg)}</svg>`;
const square = (size, fraction, background, rounded=false) => {
  const w=size*fraction, h=w*190/280;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${background ? rounded ? `<circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${bg}"/>` : `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}${fit(icon,280,190,(size-w)/2,(size-h)/2,w,h)}</svg>`;
};
async function write(name, data) { const dest=path.join(root,name); fs.mkdirSync(path.dirname(dest),{recursive:true}); fs.writeFileSync(dest,data); }
async function png(name,svg){await write(name,await sharp(Buffer.from(svg)).png({compressionLevel:9}).toBuffer());}
async function main(){
  await png('android/res/drawable-nodpi/veyocast_launcher_icon.png',square(512,.76,true));
  await png('android/res/drawable-nodpi/veyocast_launcher_icon_round.png',square(512,.76,true,true));
  const density={mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192};
  for(const [dpi,size] of Object.entries(density)){
    await png(`android/res/mipmap-${dpi}/ic_launcher.png`,square(size,.76,true));
    await png(`android/res/mipmap-${dpi}/ic_launcher_round.png`,square(size,.76,true,true));
    await png(`android/res/mipmap-${dpi}/ic_launcher_foreground.png`,square(Math.round(size*108/48),.56,false));
  }
  await png('expo/icon-1024.png',square(1024,.76,true));
  await png('expo/adaptive-foreground-1024.png',square(1024,.56,false));
  await write('source/adaptive-foreground.svg',square(108,.56,false));
  const banner = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="${bg}"/>${fit(wordmark,887.98,210,24,52,272,76)}</svg>`;
  await png('android/res/drawable-nodpi/veyocast_tv_banner.png',banner);
  await write('source/tv-banner.svg',banner);
  const paths=[...icon.matchAll(/<path\s[^>]*\/>/g)].map(match=>{
    const d=match[0].match(/\sd="([^"]+)"/)[1];
    const fill=match[0].match(/\sfill="([^"]+)"/)[1];
    const even=match[0].includes('fill-rule="evenodd"');
    return `<path android:pathData="${d}" android:fillColor="${fill}"${even ? ' android:fillType="evenOdd"' : ''}/>`;
  }).join('\n');
  // 280x190 exact source into 56% of a 108dp canvas; both paths fit the central 66dp safe circle.
  const vector=`<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><group android:translateX="23.76" android:translateY="33.48" android:scaleX="0.216" android:scaleY="0.216"><group android:translateX="4" android:translateY="9">${paths}</group></group></vector>\n`;
  await write('android/res/drawable/veyocast_icon_foreground.xml',vector);
  await write('android/res/values/veyocast_icon_colors.xml',`<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="veyocast_icon_background">${bg}</color></resources>\n`);
  const adaptive=`<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/veyocast_icon_background"/><foreground android:drawable="@drawable/veyocast_icon_foreground"/></adaptive-icon>\n`;
  for(const name of ['veyocast_launcher_icon','veyocast_launcher_icon_round']) await write(`android/res/drawable-anydpi-v26/${name}.xml`,adaptive);
  for(const name of ['ic_launcher','ic_launcher_round']) await write(`android/res/mipmap-anydpi-v26/${name}.xml`,adaptive);
  const files=[];
  function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())walk(p);else if(!['asset-manifest.json','README.md'].includes(item.name))files.push({path:path.relative(root,p).split(path.sep).join('/'),bytes:fs.statSync(p).size,sha256:sha(fs.readFileSync(p))});}}
  walk(root);
  await write('asset-manifest.json',JSON.stringify({source:'Exact Sites Sync V1 brand vectors; packaging and padding only',background:bg,foregroundFraction:.56,legacyFraction:.76,generator:{node:process.version,sharp:sharp.versions.sharp,librsvg:sharp.versions.rsvg},files:files.sort((a,b)=>a.path.localeCompare(b.path))},null,2)+'\n');
  console.log(`Exported ${files.length} files. Brand geometry and source colours retained.`);
}
main().catch(error=>{console.error(error);process.exit(1);});
