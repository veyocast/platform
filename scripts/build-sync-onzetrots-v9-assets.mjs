import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {fileURLToPath,URL} from 'node:url';
import {Buffer} from 'node:buffer';
import console from 'node:console';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {join,relative,dirname,extname} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const reference=join(root,'docs/design/onzetrots-slides/v9');
const manifest=JSON.parse(readFileSync(join(reference,'MANIFEST.json'),'utf8'));
if(manifest.prototype.commit!=='5ba52a657d6d16ad103ba2fb43b8db18aa83715a')throw Error('Unexpected approved OnzeTrots source');
const base=join(reference,'broncode/assets');
const mime={'.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml'};
const assets=[];
function collect(directory){
 for(const item of readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
  const file=join(directory,item.name);
  if(item.isSymbolicLink())throw Error('Reference symlinks are not assets');
  if(item.isDirectory()){collect(file);continue;}
  const mimeType=mime[extname(item.name)];if(!mimeType)continue;
  const prefix=item.name.startsWith('RubikDistressed-')?'/onzetrots-approved-v9':'/onzetrots-approved-v1';
  const path=prefix+'/assets/'+relative(base,file).split('\\').join('/');
  const bytes=readFileSync(file);assets.push({path,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,mimeType});
  for(const app of ['control','player']){
   const destination=join(root,'apps',app,'public',path.slice(1));mkdirSync(dirname(destination),{recursive:true});if(prefix==='/onzetrots-approved-v9')writeFileSync(destination,bytes);else if(readFileSync(destination).compare(bytes)!==0)throw Error('Historical physical asset bytes changed: '+destination);
  }
 }
}
collect(base);
for(const app of ['control','player']){
 const license=join(root,'apps',app,'public/onzetrots-approved-v9/assets/fonts/RubikDistressed-OFL.txt');
 mkdirSync(dirname(license),{recursive:true});writeFileSync(license,readFileSync(join(base,'fonts/RubikDistressed-OFL.txt')));
}

// Reuse the repository's pinned Next/PostCSS dependency solely as a build-time
// parser. No new package, runtime script or prototype dashboard is introduced.
const require=createRequire(join(root,'apps/control/package.json'));
const nextRequire=createRequire(require.resolve('next/package.json'));
const postcss=nextRequire('postcss');
const css=postcss.parse(readFileSync(join(reference,'broncode/style.css'),'utf8'));
const cssAssets=new Set();
const keyframes=new Map();css.walkAtRules(rule=>{if(/keyframes$/i.test(rule.name)){const name=rule.params;keyframes.set(name,'ot-v9-'+name);rule.params='ot-v9-'+name;}});
css.walkDecls(declaration=>{
 declaration.value=declaration.value.replace(/url\(\s*(['"]?)(\/assets\/[^)'"\s]+)\1\s*\)/g,(_,quote,path)=>{
  const target=(path.includes('RubikDistressed-')?'/onzetrots-approved-v9':'/onzetrots-approved-v1')+path;
  if(!assets.some(asset=>asset.path===target))throw Error('Unknown approved CSS asset '+path);
  cssAssets.add(target);
  return `url('${target}')`;
 });
 declaration.value=declaration.value.replace(/\bManrope\b/g,'OTManrope').replace(/\bBarlow\b/g,'OTBarlow').replace(/\bMarker\b/g,'OTMarker').replace(/Rubik Distressed/g,'OTRubikDistressed');
 if(/^animation/.test(declaration.prop))for(const [before,after]of keyframes)declaration.value=declaration.value.replace(new RegExp(`\\b${before}\\b`,'g'),after);
});
css.walkRules(rule=>{
 let parent=rule.parent;while(parent){if(parent.type==='atrule'&&/keyframes$/i.test(parent.name))return;parent=parent.parent;}
 rule.selectors=rule.selectors.map(selector=>selector.trim()===':root'?'.ot-v9-scope':`.ot-v9-scope ${selector}`);
});
const source=css.toString()+`
/* User-approved delta over the byte-preserved v9 reference: context +30%. */
.ot-v9-scope .panel-context,.ot-v9-scope .panel-context strong{font-size:14.3px}

.ot-v9-scope .ot-approved-frame{display:block!important;position:relative!important;padding:0!important;gap:0!important;min-height:0!important;background:none!important;border:0!important;container-type:normal!important;isolation:auto!important}
.ot-v9-scope .ot-approved-frame:before,.ot-v9-scope .ot-approved-frame:after{content:none!important;display:none!important}
.ot-v9-scope .screen.ot-controlled *{animation-play-state:paused!important}
.ot-v9-scope .screen.ot-controlled:not([data-ot-elapsed]) .goal-word{animation:none!important;opacity:1;transform:none}
.ot-v9-scope .club-initials{--badge:#16496a}
.ot-v9-scope .screen:before{background-position:var(--ot-background-position,center)}
.ot-v9-scope .screen.ot-controlled:before{animation:none!important;opacity:var(--ot-scene-background-opacity,var(--scene-background-opacity));transform:scale(var(--ot-scene-background-scale,1))}
.ot-v9-scope .screen.ot-controlled .slide-header-container,.ot-v9-scope .screen.ot-controlled .slide-footer,.ot-v9-scope .screen.ot-controlled [data-ot-scene-panel]{animation:none!important}
.ot-v9-scope .screen.intro-finished .goal-word{animation:none!important;opacity:1;transform:none}
.ot-v9-scope .poll-panel h3,.ot-v9-scope .poll-option>span{overflow-wrap:anywhere;min-width:0}
.ot-v9-scope .poll-option>b{flex-shrink:0}
.ot-v9-scope .has-long-poll-question .poll-panel h3{font-size:24px;line-height:1.25;margin-bottom:16px}
.ot-v9-scope .portrait .has-long-poll-question .poll-panel h3{font-size:28px;margin-bottom:20px}
.ot-v9-scope .has-long-poll-options .poll-option{font-size:18px;line-height:1.3;padding:12px;margin:8px 0}
.ot-v9-scope .screen:not(.portrait) .has-long-poll-options .poll-panel{padding:24px}
.ot-v9-scope .screen:not(.portrait) .has-long-poll-options:not(.has-long-poll-question) .poll-panel h3{font-size:28px;line-height:1.25;margin-bottom:16px}
.ot-v9-scope .screen:not(.portrait) .has-long-poll-options .poll-option{flex-shrink:0;padding:8px;margin:4px 0}
.ot-v9-scope .portrait .has-long-poll-options .poll-option{font-size:18px;padding:18px;margin:8px 0}
.ot-v9-scope .engage-qr{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0;max-width:180px;flex-shrink:0}
.ot-v9-scope .engage-qr .ot-qr{display:block;width:180px;height:auto;max-width:100%;aspect-ratio:1}
.ot-v9-scope .engage-qr small{font-size:12px;line-height:1.4;overflow-wrap:anywhere}
.ot-v9-scope .portrait .engage-qr,.ot-v9-scope .portrait .engage-qr .ot-qr{width:160px}
`;
writeFileSync(join(root,'packages/contracts/src/sync-onzetrots-v9-assets.ts'),`/** Generated from approved source ${manifest.prototype.commit}; do not edit assets or historical manifests. */\nexport const syncOnzeTrotsV9SystemAssets=${JSON.stringify(assets,null,2)} as const;\nexport const syncOnzeTrotsV9CssAssetPaths=${JSON.stringify([...cssAssets].sort(),null,2)} as const;\n`);
writeFileSync(join(root,'packages/content-templates/src/sync-onzetrots-v9-styles.ts'),`/** Generated by scripts/build-sync-onzetrots-v9-assets.mjs from approved ${manifest.prototype.commit}. */\nexport const syncOnzeTrotsV9Css=${JSON.stringify(source)};\n`);
console.log(JSON.stringify({source:manifest.prototype.commit,assets:assets.length,cssBytes:Buffer.byteLength(source)}));
