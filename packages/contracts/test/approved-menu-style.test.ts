import {describe,it,expect} from 'vitest';
import {sitesDynamicConfigurationSchema,syncSlidePresentationSchema,syncSlideRendererAssets,syncOnzeTrotsMarkerDraft} from '../src/index';

const config={schemaVersion:1,rendererVersion:'sites-v17',sourceRevision:'6800bc858436ba0843eaea89b682cd5b43c3521d',themeId:'onzetrots-tv',orientation:'portrait',provider:'menu',title:'Onze kaart',unifiedKind:'kantine',menuWidgets:true};
describe('saved OnzeTrots menu style and original Marker font',()=>{
 it('retains unmarked historical configurations and accepts both explicit modes',()=>{
  expect(sitesDynamicConfigurationSchema.parse(config).onzeTrotsStyle).toBeUndefined();
  for(const onzeTrotsStyle of ['v9-marker-light','v9-marker-dark'])expect(sitesDynamicConfigurationSchema.parse({...config,onzeTrotsStyle}).onzeTrotsStyle).toBe(onzeTrotsStyle);
 });
 it('rejects unsupported styles, unrelated providers, missing widgets and mismatched source identity',()=>{
  for(const patch of [{onzeTrotsStyle:'custom-html'},{onzeTrotsStyle:null},{onzeTrotsStyle:'v9-marker-light',provider:'sportlink'},{onzeTrotsStyle:'v9-marker-light',menuWidgets:false},{onzeTrotsStyle:'v9-marker-light',sourceRevision:'b1cae899af19fc39908217253094c5240d7359fc'}])expect(sitesDynamicConfigurationSchema.safeParse({...config,...patch}).success).toBe(false);
 });
 it('requires the exact original font for historical and explicitly edited inputs without mutating the saved document',()=>{
  const historical=syncSlidePresentationSchema.parse({schemaVersion:1,rendererVersion:'sync-onzetrots-v9',sourceRevision:'5ba52a657d6d16ad103ba2fb43b8db18aa83715a',family:'menu',orientation:'portrait',theme:'onzetrots-tv',name:'Menu',title:'Onze kaart',club:{name:'Eigen club'},visual:{schemaVersion:1,mode:'light'},style:{}});
  const before=JSON.stringify(historical),next=syncOnzeTrotsMarkerDraft(historical);
  const marker='/onzetrots-approved-v1/assets/fonts/club-font-9.ttf';
  expect(syncSlideRendererAssets(historical).filter(asset=>asset.path===marker)).toHaveLength(1);
  expect(syncSlideRendererAssets(historical).find(asset=>asset.path===marker)).toMatchObject({sha256:'a73712ce4f3b32d3c7a1a657d56c6aaf50c719b7fa7fe0541905fe77f5a9906c',bytes:73276,mimeType:'font/ttf'});
  expect(syncSlideRendererAssets(next).filter(asset=>asset.path===marker)).toHaveLength(1);
  expect(next.style).toMatchObject({font:'Brush',fontChanged:true});
  expect(JSON.stringify(historical)).toBe(before);
  expect(syncSlidePresentationSchema.safeParse(next).success).toBe(true);
 });
});
