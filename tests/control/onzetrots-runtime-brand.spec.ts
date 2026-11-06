import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {chromium,expect,test,type Page} from '@playwright/test';
import {syncContentFamilies} from '../../packages/contracts/src/sync-content-families';

// Exercise saved presentations through the actual renderer and loaded local face.
// The stored accent/font choices deliberately predate the runtime brand policy.
test.use({launchOptions:{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH??chromium.executablePath()}});
const require=createRequire(join(process.cwd(),'package.json'));
let bundle='';
const entry=`
import React from 'react';import{createRoot}from'react-dom/client';
import{createSyncTemplatePreview}from'./apps/control/app/(shell)/dashboard/studio/sync-template-preview';
import{SyncSlideStaticView,measureSyncOnzeTrotsV9Layout}from'./packages/content-templates/src/sync-slide-static-view';
import{syncSlidePresentationSchema}from'./packages/contracts/src';
const root=createRoot(document.getElementById('root'));
window.show=({family='fixtures',orientation='landscape',mode='light',version='v9',long=false,theme='onzetrots-tv'})=>{
 const base=createSyncTemplatePreview(family);let slide={...base,orientation,theme,visual:{...base.visual,mode},style:{...base.style,accent:'#ff00ff',font:'Serif',fontChanged:false,background:mode==='light'?'light':'stadium'},authoring:{...base.authoring,visualRevision:undefined,headerTexts:long?{[family]:'W'.repeat(120)}:{}}};
 if(version==='v1'){delete slide.authoring;slide.rendererVersion='sync-onzetrots-v1';slide.sourceRevision='ae83f2b4312408eacae9f29177d3c743e104185b';}
 if(version==='classic')slide={schemaVersion:1,rendererVersion:'sync-v1',sourceRevision:'8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a',family,orientation,theme,name:base.name,title:base.title,headline:base.headline,body:base.body,club:{name:'Eigen club'},style:slide.style,rows:base.rows,home:{name:'Eigen thuisclub'},away:{name:'Eigen uitclub'},lineup:base.lineup,news:[{title:'Eigen artikel',intro:'Eigen toelichting',source:'Eigen nieuwsbron'}]};
 if(version==='current')slide.authoring.visualRevision='onzetrots-20261024';
 slide=syncSlidePresentationSchema.parse(slide);window.saved=slide;
 root.render(<SyncSlideStaticView key={family+orientation+mode+version+long+theme} presentation={slide}/>);
};window.fit=measureSyncOnzeTrotsV9Layout;window.show({});
`;
test.beforeAll(()=>{
 const esbuild=require.resolve('esbuild',{paths:[require.resolve('tsx')]});
 bundle=execFileSync(process.execPath,['-e',`const{buildSync}=require(${JSON.stringify(esbuild)});const r=buildSync({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',nodePaths:[process.cwd()+'/apps/control/node_modules']});process.stdout.write(r.outputFiles[0].text)`],{encoding:'utf8',maxBuffer:24*1024*1024});
});
async function mount(page:Page){
 await page.route('**/*',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/__brand')return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="nl"><style>*{box-sizing:border-box}html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}.sync-slide-root{width:100%;height:100%}</style><div id="root"></div><script>${bundle.replace(/<\/script/gi,'<\\/script')}</script></html>`});
  try{return route.fulfill({body:readFileSync(join(process.cwd(),'apps/control/public',path)),contentType:path.endsWith('.ttf')?'font/ttf':'image/webp'});}catch{return route.abort();}
 });
 await page.goto('http://127.0.0.1:3343/__brand');
}
for(const version of ['v1','v9','classic']as const)for(const orientation of ['landscape','portrait']as const)for(const mode of ['light','dark']as const){
 test(`saved Source ${version}/${orientation}/${mode} receives primary and real Marker without changing content`,async({page})=>{
  await page.setViewportSize(orientation==='portrait'?{width:1080,height:1920}:{width:1920,height:1080});await mount(page);
  const families=version==='classic'?['fixtures','welcome','birthdays','rss','menu','goal']:syncContentFamilies.map(family=>family.id);
  for(const family of families){
   await page.evaluate(value=>Reflect.get(window,'show')(value),{family,orientation,mode,version});
   const canvas=page.locator(version==='classic'?'.vc-slide-preview.is-trots':'.screen');await expect(canvas).toBeVisible();
   const before=await page.evaluate(()=>JSON.stringify(Reflect.get(window,'saved')));
   await page.evaluate(async(version)=>{await document.fonts.load(version==='classic'?"400 24px 'OnzeTrots Brush'":'400 24px OTMarker');await document.fonts.ready;Reflect.get(window,'fit')();},version);
   const headers=canvas.locator('h1,h2,h3,h4,.welcome-text,.goal-word,.birthday-name,.sponsor-thanks,.visitor-copy>span');
   const fonts=await headers.evaluateAll(elements=>elements.filter(element=>element.textContent?.trim()).map(element=>{const s=getComputedStyle(element);return{family:s.fontFamily,weight:s.fontWeight,synthesis:s.fontSynthesis};}));
   expect(fonts.length,`${family} renders an actual heading`).toBeGreaterThan(0);
   for(const font of fonts){expect(font.family).toContain(version==='classic'?'OnzeTrots Brush':'OTMarker');expect(font.weight).toBe('400');expect(font.synthesis).toBe('none');}
   const colors=await canvas.evaluate((element,classic)=>{const s=getComputedStyle(element);return{primary:s.getPropertyValue(classic?'--slide-accent':'--blue').trim(),ink:s.getPropertyValue('--ot-accent-ink').trim(),body:s.fontFamily};},version==='classic');
   expect(colors.primary).toBe('#03438A');
   if(version==='classic')expect(colors.body).toContain('Georgia');
   else expect(colors.ink).toBe(mode==='dark'?'#f1f5ff':'#03438A');
   for(const color of await canvas.locator('.photo-caption h3').evaluateAll(elements=>elements.map(element=>getComputedStyle(element).color)))expect(color).toBe('rgb(255, 255, 255)');
   expect(await page.evaluate(()=>JSON.stringify(Reflect.get(window,'saved')))).toBe(before);
  }
  const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const{root}=await cdp.send('DOM.getDocument');
  const{nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:version==='classic'?'.is-trots h2':'.screen h2,.screen h3'});const{fonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
  expect(fonts.length).toBeGreaterThan(0);expect(fonts.every(font=>font.isCustomFont&&font.postScriptName==='PermanentMarker-Regular')).toBe(true);
 });
}
for(const version of ['v9','current']as const)for(const orientation of ['landscape','portrait']as const){
 test(`maximum saved header fits real Marker glyphs: ${version}/${orientation}`,async({page})=>{
  await page.setViewportSize(orientation==='portrait'?{width:1080,height:1920}:{width:1920,height:1080});await mount(page);
  await page.evaluate(value=>Reflect.get(window,'show')(value),{version,orientation,long:true});
  await page.evaluate(async()=>{await document.fonts.load('400 24px OTMarker');await document.fonts.ready;Reflect.get(window,'fit')();});
  const metrics=await page.locator('[data-ot-header-text]').evaluate(element=>{const e=element as HTMLElement,h=e.getBoundingClientRect(),p=e.closest('header')!.getBoundingClientRect();return{h:h.toJSON(),p:p.toJSON(),text:e.textContent,scroll:e.scrollWidth,width:e.clientWidth};});
  expect(metrics.text).toBe('W'.repeat(120));expect(metrics.h.top).toBeGreaterThanOrEqual(metrics.p.top);expect(metrics.h.bottom).toBeLessThanOrEqual(metrics.p.bottom+1);expect(metrics.scroll).toBeLessThanOrEqual(metrics.width+1);
 });
}
test('classic other themes retain their saved accent and body font',async({page})=>{
 await mount(page);await page.evaluate(()=>Reflect.get(window,'show')({version:'classic',theme:'fieldflow'}));
 const canvas=page.locator('.is-fieldflow');await expect(canvas).toBeVisible();
 expect(await canvas.evaluate(element=>getComputedStyle(element).getPropertyValue('--slide-accent'))).toBe('#ff00ff');
 expect(await canvas.locator('h2').first().evaluate(element=>getComputedStyle(element).fontFamily)).not.toContain('OnzeTrots Brush');
});
