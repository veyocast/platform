import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect,vi} from 'vitest';
import {createSyncStudioStarter} from '@veyocast/studio';
import type {DynamicSlidePreviewResult} from '../actions';
import {DynamicSlideLivePreview} from './dynamic-slide-live-preview';
// Control's Vitest uses classic JSX for historical shared renderers.
vi.stubGlobal('React',React);

const seed=createSyncStudioStarter({family:'menu',tenantName:'Eigen club'}).syncPresentation!;
function fixture(source:unknown):Extract<DynamicSlidePreviewResult,{ok:true}>{return{ok:true,itemCount:2,missingAssetCount:0,source:{providerStatus:'healthy',lastErrorCode:null,lastSuccessfulSyncAt:null},payload:{schemaVersion:1,snapshotId:'10000000-0000-4000-8000-000000000226',snapshotHash:'a'.repeat(64),templateVersionId:'20000000-0000-4000-8000-000000000226',templateSlug:'actual-canonical-menu',slideType:'menu',orientation:'landscape',data:{type:'menu',...(source===undefined?{}:{syncConfiguration:source}),menu:{products:[{id:'own-product',name:'Eigen product',priceMinor:235,category:'Eigen categorie'}]}}}};}
const source={schemaVersion:1,kind:'dynamic',rendererVersion:'sync-v1',sourceRevision:seed.sourceRevision,slideType:'menu',secondsPerPage:3,seed};
describe('Source previews preserve renderer identity',()=>{
 it('uses Source markup and canonical facts for a connected Source snapshot',()=>{
  const html=renderToStaticMarkup(<DynamicSlideLivePreview result={fixture(source)}loading={false}/>);
  expect(html).toContain('class="vc-menu-row"');expect(html).toContain('Eigen product');expect(html).toContain('2,35');
 });
 it('refuses an invalid Source seed instead of drawing it through the old renderer',()=>{
  const html=renderToStaticMarkup(<DynamicSlideLivePreview result={fixture({})}loading={false}/>);
  expect(html).toContain('Bronvoorbeeld niet beschikbaar');expect(html).not.toContain('Eigen product');
 });
 it('keeps the historical preview path for existing non-Source payloads',()=>{
  const html=renderToStaticMarkup(<DynamicSlideLivePreview result={fixture(undefined)}loading={false}/>);
  expect(html).toContain('Eigen product');expect(html).not.toContain('class="vc-menu-row"');
 });
});
