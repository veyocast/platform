import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {expect,test,type Page} from '@playwright/test';
import {syncContentFamilies} from '../../packages/contracts/src/sync-content-families';

const require=createRequire(join(process.cwd(),'package.json'));
let bundle='';
const entry=`
import React from 'react';import{createRoot}from'react-dom/client';
import{createSyncTemplatePreview}from'./apps/control/app/(shell)/dashboard/studio/sync-template-preview';
import{SyncSlideStaticView}from'./packages/content-templates/src/sync-slide-static-view';
import{SitesPresentationView}from'./packages/content-templates/src/sites-presentation';
import{sitesDynamicConfigurationSchema}from'./packages/contracts/src/sites-presentation';
const root=createRoot(document.getElementById('root'));
window.show=({family='menu',orientation='landscape',mode='light',menu=false,historical=false})=>{
 const base=createSyncTemplatePreview(family),slide={...base,orientation,visual:{...base.visual,mode},style:{...base.style,...(historical?{font:'Inter',fontChanged:false}:{})}};
 const configuration=sitesDynamicConfigurationSchema.parse({schemaVersion:1,rendererVersion:'sites-v17',sourceRevision:'6800bc858436ba0843eaea89b682cd5b43c3521d',themeId:'onzetrots-tv',orientation,provider:'menu',title:'Onze menukaart',subtitle:'Vers uit onze kantine',unifiedKind:'kantine',menuWidgets:true,onzeTrotsStyle:'v9-marker-'+mode,safeArea:6,overlay:0});
 const products=[{id:'coffee',primary:'Koffie',secondary:'Groot · Klein',value:'€ 2,50',column:1},{id:'tea',primary:'Thee',value:'€ 0,00',column:2}];
 const presentation={kind:'dynamic',configuration,content:{kind:'kantine',title:configuration.title,subtitle:configuration.subtitle,clubName:'Eigen club',rows:products.map(({column,...row})=>row),menuPages:[{id:'page-1',columns:1,widgets:[{id:'category',type:'category',column:'full',columns:2,title:'Warme dranken',subtitle:'Met aandacht gemaakt',rows:products}]}]}};
 root.render(<div key={family+orientation+mode+menu+historical} data-family={family} style={{width:'100%',height:'100%'}}>{menu?<SitesPresentationView presentation={presentation} fitViewport/>:<SyncSlideStaticView presentation={slide}/>}</div>);
};window.show({});
`;
test.beforeAll(()=>{
 const esbuild=require.resolve('esbuild',{paths:[require.resolve('tsx')]});
 const script=`const{buildSync}=require(${JSON.stringify(esbuild)});const r=buildSync({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',nodePaths:[process.cwd()+'/apps/control/node_modules']});process.stdout.write(r.outputFiles[0].text)`;
 bundle=execFileSync(process.execPath,['-e',script],{encoding:'utf8',maxBuffer:24*1024*1024});
});
async function mount(page:Page){
 await page.route('**/__approved-menu',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="nl"><style>*{box-sizing:border-box}html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="root"></div><script>${bundle.replace(/<\/script/gi,'<\\/script')}</script></html>`}));
 await page.route('**/onzetrots*/**',route=>{const path=new URL(route.request().url()).pathname;return route.fulfill({body:readFileSync(join(process.cwd(),'apps/control/public',path)),contentType:path.endsWith('.ttf')?'font/ttf':'image/webp'});});
 await page.goto('http://127.0.0.1:3343/__approved-menu');
}
for(const orientation of ['landscape','portrait'] as const)for(const mode of ['light','dark'] as const){
 test(`all 36 OnzeTrots headers use original Marker: ${orientation}/${mode}`,async({page})=>{
  await page.setViewportSize(orientation==='portrait'?{width:1080,height:1920}:{width:1920,height:1080});await mount(page);
  for(const family of syncContentFamilies){
   await page.evaluate(value=>Reflect.get(window,'show')(value),{family:family.id,orientation,mode});
   await expect(page.locator(`[data-family="${family.id}"] .screen`)).toHaveAttribute('data-ot-marker','true');
   await page.evaluate(async()=>{await document.fonts.load('400 49px OTMarker');await document.fonts.ready;});
   const header=page.locator('[data-ot-header-text]');await expect(header).toBeVisible();
   expect(await header.evaluate(element=>getComputedStyle(element).fontFamily)).toContain('OTMarker');
   const metrics=await header.evaluate(element=>{const a=element.getBoundingClientRect(),b=element.closest('header')!.getBoundingClientRect();return{left:a.left,right:a.right,top:a.top,bottom:a.bottom,parent:b.toJSON(),loaded:document.fonts.check('400 49px OTMarker')};});
   expect(metrics.loaded).toBe(true);expect(metrics.left).toBeGreaterThanOrEqual(metrics.parent.left);expect(metrics.right).toBeLessThanOrEqual(metrics.parent.right+.1);expect(metrics.bottom).toBeLessThanOrEqual(metrics.parent.bottom+.1);
   const context=page.locator('.panel-context').first();if(await context.count())expect(await context.evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBe(14.3);
  }
 });
 test(`approved Menu Studio keeps widgets and readable surfaces: ${orientation}/${mode}`,async({page},info)=>{
  await page.setViewportSize(orientation==='portrait'?{width:390,height:844}:{width:1440,height:900});await mount(page);
  await page.evaluate(value=>Reflect.get(window,'show')(value),{orientation,mode,menu:true});
  await expect(page.locator('.vm-approved [data-ot-header-text]')).toHaveText('Onze menukaart');
  await expect(page.locator('.uc-header')).toHaveCount(0);await expect(page.locator('.vm-product')).toHaveCount(2);
  await expect(page.locator('.vm-product').first()).toContainText('Groot · Klein');await expect(page.locator('.vm-product').last()).toContainText('€ 0,00');
  const surface=await page.locator('.vm-widget').evaluate(element=>({background:getComputedStyle(element).backgroundColor,ink:getComputedStyle(element.querySelector('strong')!).color}));
  expect(surface.background).toBe('rgba(0, 0, 0, 0)');expect(surface.ink).toBe(mode==='dark'?'rgb(241, 245, 255)':'rgb(16, 36, 65)');
  const bounds=await page.locator('.vm-product').evaluateAll(elements=>elements.map(element=>element.getBoundingClientRect().toJSON()));
  for(const b of bounds){expect(b.x).toBeGreaterThanOrEqual(0);expect(b.right).toBeLessThanOrEqual(orientation==='portrait'?390:1440);expect(b.bottom).toBeLessThanOrEqual(orientation==='portrait'?844:900);}
  await page.screenshot({path:info.outputPath('approved-menu.png')});
 });
}
test('unmarked v9 keeps its historical Rubik header',async({page})=>{
 await mount(page);await page.evaluate(()=>Reflect.get(window,'show')({historical:true}));await expect(page.locator('.screen')).not.toHaveAttribute('data-ot-marker');
 expect(await page.locator('[data-ot-header-text]').evaluate(element=>getComputedStyle(element).fontFamily)).toContain('OTRubikDistressed');
});
