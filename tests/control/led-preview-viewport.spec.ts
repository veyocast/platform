import {execFileSync}from"node:child_process";
import {createRequire}from"node:module";
import {join}from"node:path";
import {readFileSync}from"node:fs";
import {expect,test}from"@playwright/test";
const require=createRequire(join(process.cwd(),"package.json"));
const compiler=require.resolve("esbuild",{paths:[require.resolve("tsx")]});
let bundle:{js:string;css:string};
const entry=`import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{SitesLedSceneEditor}from'./apps/control/app/(shell)/dashboard/studio/led-scores/sites-led-scene-editor';
import{createSitesLedCanvasExperience}from'./apps/control/app/(shell)/dashboard/studio/led-scores/sites-led-scene-model';
function App(){const [experience]=useState(()=>createSitesLedCanvasExperience());const[orientation,setOrientation]=useState(new URLSearchParams(location.search).get('orientation')||'portrait');const[scene,setScene]=useState(null);return <SitesLedSceneEditor moment="goalOwn" scene={scene||experience.scenes.goalOwn[orientation]} media={[]} liveState={{home:{name:'Duindorp SV',score:1},away:{name:'Bezoekers',score:0},sourceUpdatedAt:'2026-10-15T22:00:00Z',clockSeconds:2}} durationMs={12000} onMomentChange={()=>{}} onOrientationChange={value=>{setScene(null);setOrientation(value)}} onChange={setScene}/>};createRoot(document.getElementById('root')).render(<App/>);`;
test.beforeAll(()=>{
 const program=`const{build}=require(${JSON.stringify(compiler)});const result=await build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,external:['/onzetrots-tv/*'],outfile:'/tmp/led-preview.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'css','.module.css':'local-css'},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'framework-image',setup(b){b.onResolve({filter:/^next\\/image$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'import React from"react";export default function Image({fill,unoptimized,priority,...props}){return React.createElement("img",props)}',loader:'js',resolveDir:process.cwd()}));}}]});process.stdout.write(JSON.stringify({js:result.outputFiles.find(x=>x.path.endsWith('.js')).text,css:result.outputFiles.find(x=>x.path.endsWith('.css')).text}));`;
 bundle=JSON.parse(execFileSync(process.execPath,["-e",`(async()=>{${program}})().catch(e=>{console.error(e);process.exitCode=1;})`],{encoding:"utf8",maxBuffer:12*1024*1024}));
});
for(const [width,height]of[[390,844],[768,1024],[1366,768],[1920,1080]])for(const orientation of["portrait","landscape"]){
 test(`LED complete ${orientation} preview fits ${width}x${height}`,async({page},testInfo)=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));await page.setViewportSize({width,height});
  await page.route("**/__led-viewport*",route=>route.fulfill({contentType:"text/html",body:`<!doctype html><html lang="nl"><head><style>html,body{margin:0}*{box-sizing:border-box}body{padding:24px;font-family:sans-serif}#root{margin-left:${width>1100?200:0}px}label{display:block}input,select{max-width:100%}${bundle.css}</style></head><body><main id="root"></main><script>${bundle.js.replace(/<\/script/giu,"<\\/script")}</script></body></html>`}));
  await page.route(/\/(?:onzetrots|onzetrots-tv|fieldflow|fonts)\//u,route=>{const path=new URL(route.request().url()).pathname;return route.fulfill({body:readFileSync(join(process.cwd(),"apps/control/public",path)),contentType:path.endsWith('.png')?'image/png':path.endsWith('.svg')?'image/svg+xml':'image/webp'});});
  await page.goto(`http://127.0.0.1:3343/__led-viewport?orientation=${orientation}`);
  const preview=page.locator('aside').filter({hasText:"Schermvoorbeeld"});await expect(preview.locator('.uc-preview')).toBeVisible();await preview.scrollIntoViewIfNeeded();
  await expect.poll(()=>preview.locator('.uc-slide').evaluate(element=>element.getBoundingClientRect().width)).toBeLessThan(width);
  const geometry=await preview.locator('.uc-slide').evaluate(element=>{const canvas=element.getBoundingClientRect();const frame=element.closest('.uc-preview')!.parentElement!.getBoundingClientRect();return{canvas:{x:canvas.x,y:canvas.y,right:canvas.right,bottom:canvas.bottom,width:canvas.width,height:canvas.height},frame:{x:frame.x,y:frame.y,right:frame.right,bottom:frame.bottom,height:frame.height},scroll:document.documentElement.scrollWidth,width:innerWidth};});
  expect(errors).toEqual([]);expect(geometry.scroll).toBeLessThanOrEqual(width+1);
  expect(geometry.canvas.x).toBeGreaterThanOrEqual(geometry.frame.x-1);expect(geometry.canvas.y).toBeGreaterThanOrEqual(geometry.frame.y-1);
  expect(geometry.canvas.right).toBeLessThanOrEqual(geometry.frame.right+1);expect(geometry.canvas.bottom).toBeLessThanOrEqual(geometry.frame.bottom+1);
  expect(geometry.frame.height).toBeLessThan(height);expect(geometry.canvas.width/geometry.canvas.height).toBeCloseTo(orientation==='portrait'?9/16:16/9,2);
  await page.screenshot({path:testInfo.outputPath(`led-${orientation}-${width}.png`)});
 });
}
