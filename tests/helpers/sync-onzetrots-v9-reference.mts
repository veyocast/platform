import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {extname,join,resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {syncContentFamilies} from '../../packages/contracts/src/index';
import {sitesCaptureBrowserArgs} from '../../apps/media-worker/src/sites-dom-capture';

// Read-only prototype evidence. None of this application or its demonstration
// controls is loaded into the production renderer, editor or Player.
declare const state: {id:string;theme:string;portrait:boolean;motion:boolean;welcomeCount:number;gridCounts:Record<string,number>;ownPosition:number;background:string;opacity:number;speed:string;moment:string;homeScore:number;awayScore:number};
declare function render():void;
const directory=process.argv[2];
if(!directory)throw Error('Provide a new owned native reference directory');
const output=resolve(directory),source=resolve('docs/design/onzetrots-slides/v9');
const manifest=JSON.parse(await readFile(join(source,'MANIFEST.json'),'utf8'));
if(manifest.prototype.commit!=='5ba52a657d6d16ad103ba2fb43b8db18aa83715a')throw Error('Unexpected approved source');
const files=new Map<string,Buffer>();
for(const line of (await readFile(join(source,'SHA256SUMS.txt'),'utf8')).trim().split('\n')){
 const match=/^([a-f0-9]{64}) {2}(broncode\/.+)$/.exec(line);
 if(!match)continue;
 const path=resolve(source,match[2]!);
 if(!path.startsWith(join(source,'broncode')+'/'))throw Error('Invalid reference inventory path');
 const bytes=await readFile(path);
 if(createHash('sha256').update(bytes).digest('hex')!==match[1])throw Error('Reference checksum mismatch');
 files.set('/'+match[2]!.slice('broncode/'.length),bytes);
}
if(files.size!==261)throw Error('Incomplete original source inventory');
const mime:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2'};
const server=createServer((request,response)=>{
 const path=new URL(request.url??'/','http://127.0.0.1').pathname,filename=path==='/'?'/index.html':path,bytes=files.get(filename);
 if(!bytes){response.writeHead(404).end();return;}
 response.writeHead(200,{'Content-Type':mime[extname(filename)]??'application/octet-stream','Cache-Control':'no-store'}).end(bytes);
});
await mkdir(output,{recursive:false});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${(server.address()as {port:number}).port}`;
const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath(),args:[...sitesCaptureBrowserArgs]});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1}),matrix=[];
 await page.clock.setFixedTime(new Date('2026-10-22T12:00:00Z'));
 await page.goto(origin+'/#standings');await page.addStyleTag({content:'.panel-context,.panel-context strong{font-size:14.3px}'});await page.waitForSelector('#screen .rank-row');
 const selected=process.env.OT_V9_FAMILIES?.split(',');
 for(const family of syncContentFamilies.filter(f=>!selected||selected.includes(f.id)))for(const orientation of ['landscape','portrait']as const)for(const mode of ['light','dark']as const){
  const width=orientation==='portrait'?1080:1920,height=orientation==='portrait'?1920:1080;
  await page.setViewportSize({width,height});
  await page.evaluate(async({family,orientation,mode,width,height})=>{
   state.id=family;state.theme=mode;state.portrait=orientation==='portrait';state.motion=false;state.welcomeCount=4;state.gridCounts={birthdays:6,activities:6,agenda:6};state.ownPosition=5;state.background='houtrust';state.opacity=94;state.speed='normal';state.moment='live';state.homeScore=2;state.awayScore=1;render();
   await Promise.all([...document.fonts].map(face=>face.load()));await document.fonts.ready;
   await Promise.all([...document.images].map(image=>image.decode()));
   for(const path of [`/assets/clubmuur-brush-v25/houtrust-${state.portrait?'portrait-941':'wide-1672'}.webp`,'/assets/clubmuur-lettering.webp']){const image=new Image();image.src=path;await image.decode();}
   const screen=document.querySelector<HTMLElement>('#screen')!,shell=screen.parentElement!;
   screen.style.setProperty('transform','scale(1.2)','important');Object.assign(shell.style,{position:'fixed',left:'0',top:'0',width:`${width}px`,height:`${height}px`,zIndex:'2147483000',borderRadius:'0',overflow:'visible'});
   if(family==='goal'){screen.classList.remove('is-paused');screen.classList.add('intro-finished');for(const animation of screen.getAnimations({subtree:true})){animation.pause();animation.currentTime=1200;}}
   await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
   const box=screen.getBoundingClientRect();if(Math.abs(box.width-width)>.001||Math.abs(box.height-height)>.001)throw Error('Reference canvas mismatch');
  },{family:family.id,orientation,mode,width,height});
  const filename=`${family.id}-${orientation}-${mode}.png`,bytes=await page.screenshot();await writeFile(join(output,filename),bytes,{flag:'wx'});
  matrix.push({family:family.id,orientation,mode,filename,width,height,elapsedMs:1200,sha256:createHash('sha256').update(bytes).digest('hex')});
  await writeFile(join(output,'reference.json'),JSON.stringify({sourceRevision:manifest.prototype.commit,userApprovedDelta:'Context 11→14.3 logical pixels (+30%); reference files unchanged',sourceFiles:files.size,referenceAt:'2026-10-22T12:00:00Z',chromium:browser.version(),executablePath:chromium.executablePath(),matrix},null,2));
  process.stdout.write(`${matrix.length}/144 ${filename}\n`);
 }
}finally{await browser.close();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
