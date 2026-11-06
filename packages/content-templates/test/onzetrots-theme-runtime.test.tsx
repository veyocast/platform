import React,{createElement,type CSSProperties} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {MenuDocumentV2,PlayerDynamicTemplatePayload} from '@veyocast/contracts';
import {EditorialArenaRenderer} from '../src/editorial-arena-renderer';
import {MenuSceneCanvas,resolveMenuScenePages} from '../src/menu-scene';
import {freezeThemePresentation,themeCatalog} from '../src/theme-catalog';
import {createDynamicTemplateView} from '../src/dynamic-template-view';
import {prepareThemeFonts} from '../src/onzetrots-theme-runtime';

const presentation=freezeThemePresentation({instant:'2026-09-09T08:00:00.000Z',timezone:'UTC',appearance:{schemaVersion:1,surfaces:{clubLogoBackground:'#ffffff',homeLogoBackground:'#ffffff'},typography:{baseScale:1,bodyFontRef:'vc-source-serif-4-v1',displayFontRef:'vc-anton-v1',sportScale:1}},selection:{accent:'#FF5C20',categoryOverrides:[],modePolicy:{kind:'fixed',mode:'light'},ref:{catalog:'v2',id:'onzetrots-tv',version:themeCatalog['onzetrots-tv'].version},support:null}});
const payload:PlayerDynamicTemplatePayload={schemaVersion:1,slideType:'news',orientation:'landscape',snapshotHash:'a'.repeat(64),snapshotId:'00000000-0000-4000-8000-000000000101',templateVersionId:'00000000-0000-4000-8000-000000000102',templateSlug:'editorial-arena-news-landscape',data:{themePresentation:presentation,brand:{primaryColor:'#FF5C20',clubName:'Eigen club'},news:{title:'Clubnieuws',articles:[{title:'Samen langs de lijn',intro:'Onze vrijwilligers maken het mogelijk.',sourceName:'Clubnieuws'}]}}};
const menu:MenuDocumentV2={schemaVersion:'menu-document.v2',id:'menu-1',tenantId:'tenant-1',title:'Onze kaart',createdAt:'2026-09-09T08:00:00Z',updatedAt:'2026-09-09T08:00:00Z',revision:1,assets:[],theme:{themeId:'onzetrots-tv',themeVersion:themeCatalog['onzetrots-tv'].version,mode:'light',brand:{accent:'#FF5C20'}},pages:[{id:'page-1',order:0,blocks:[{id:'category-1',type:'category',order:0,layout:{landscape:{x:96,y:248,w:846,h:704,rotation:0},portrait:{x:72,y:348,w:936,h:1388,rotation:0}},source:{source:'manual',sourceCategoryId:'dranken',sourceName:'Dranken'},productNodes:[{id:'coffee',kind:'product',order:0,productRef:{source:'manual',productId:'coffee'},snapshotFallback:{available:true,name:'Clubkoffie',price:{amountMinor:250,currency:'EUR',taxMode:'inclusive'}}}]}]}]};

describe('generic OnzeTrots runtime brand',()=>{
 beforeEach(()=>vi.stubGlobal('React',React));
 afterEach(()=>vi.unstubAllGlobals());
 it('renders an existing Editorial payload with the real local header face while preserving its body and source',()=>{
  const before=JSON.stringify(payload),view=createDynamicTemplateView(payload)!;
  expect(view.accentColor).toBe('#03438A');expect(view.themeTokens.accent).toBe('#03438A');
  const html=renderToStaticMarkup(createElement(EditorialArenaRenderer,{item:{id:'item-1',title:'Nieuws',durationSeconds:10,dynamicTemplate:payload}}));
  expect(html).toContain('Samen langs de lijn');expect(html).toContain('--vc-theme-display-font:&quot;OTMarker&quot;');expect(html).toContain('--vc-theme-body-font:&quot;Source Serif 4&quot;');expect(html).toContain('--vc-theme-display-weight:400');expect(html).toContain('/onzetrots-approved-v1/assets/fonts/club-font-9.ttf');
  expect(JSON.stringify(payload)).toBe(before);
 });
 it('keeps the MenuDocument brand fixed even when its caller passes older font/accent overrides',()=>{
  const before=JSON.stringify(menu),page=resolveMenuScenePages(menu,'landscape')[0]!;
  const html=renderToStaticMarkup(createElement(MenuSceneCanvas,{document:menu,assets:{},orientation:'landscape',page,themeOverrideStyle:{'--vc-theme-accent':'#E000FF','--vc-theme-display-font':'"Anton"'} as CSSProperties}));
  expect(html).toContain('Clubkoffie');expect(html).toContain('--vc-theme-accent:#03438A');expect(html).toContain('--vc-theme-display-font:&quot;OTMarker&quot;');expect(html).toContain('--vc-theme-display-weight:400');expect(html).toContain('/onzetrots-approved-v1/assets/fonts/club-font-9.ttf');expect(JSON.stringify(menu)).toBe(before);
 });
 it('does not report readiness until the required font is loaded',async()=>{
  let resolveFont!:(faces:FontFace[])=>void;const pending=new Promise<FontFace[]>(resolve=>{resolveFont=resolve;});let ready=false;
  const preparation=prepareThemeFonts('onzetrots-tv',{load:()=>pending,ready:Promise.resolve(undefined as unknown as FontFaceSet)}).then(()=>{ready=true;});
  await Promise.resolve();expect(ready).toBe(false);resolveFont([{status:'loaded'} as FontFace]);await preparation;expect(ready).toBe(true);
 });
 it('rejects missing or undecodable Marker faces without changing the FieldFlow font contract',async()=>{
  for(const faces of [[],[{status:'error'} as FontFace]])await expect(prepareThemeFonts('onzetrots-tv',{load:async()=>faces,ready:Promise.resolve(undefined as unknown as FontFaceSet)})).rejects.toThrow('ONZETROTS_HEADER_FONT_UNAVAILABLE');
  let requested=false;await prepareThemeFonts('fieldflow',{load:async()=>{requested=true;return[];},ready:Promise.resolve(undefined as unknown as FontFaceSet)});expect(requested).toBe(false);
 });
});
