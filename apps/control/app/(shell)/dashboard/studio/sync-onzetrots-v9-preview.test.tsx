import React from 'react';
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {syncContentFamilies,syncSlidePresentationSchema,syncSlideRendererAssets} from '@veyocast/contracts';
import {SyncSlideStaticView} from '@veyocast/content-templates/sync-slide-static-view';
import {createSyncStudioDocument,parseStudioDocument} from '@veyocast/studio';
import {createSyncTemplatePreview} from './sync-template-preview';

describe('current v9 common renderer',()=>{
 for(const family of syncContentFamilies)for(const orientation of ['landscape','portrait']as const)for(const mode of ['light','dark']as const)it(`${family.id}/${orientation}/${mode}: semantic headers, real font and immutable document`,()=>{
  const example=createSyncTemplatePreview(family.id);if(example.rendererVersion!=='sync-onzetrots-v9')throw Error('Current fixture required');
  const slide=syncSlidePresentationSchema.parse({...example,orientation,visual:{...example.visual,mode}});
  const document=createSyncStudioDocument(slide),html=renderToStaticMarkup(<SyncSlideStaticView presentation={slide}/>);
  expect(parseStudioDocument(JSON.parse(JSON.stringify(document)))).toEqual(document);
  expect(html.match(/class="panel slide-header-container"/g)).toHaveLength(1);
  expect(html.match(/class="panel-head"/g)??[]).toHaveLength(family.id==='matchday'?3:0);
  expect(html).toContain('data-ot-header-subtitle');expect(html).toContain('data-ot-header-text');
  expect(html).toContain('font-size:14.3px');
  expect(syncSlideRendererAssets(slide).some(asset=>asset.path==='/onzetrots-approved-v9/assets/fonts/RubikDistressed-Regular.ttf')).toBe(true);
  if(family.id==='birthdays'){
   // The stylesheet contains the same names; constrain this check to real markup.
   const markup=html.slice(html.indexOf('<article'));
   expect(markup.indexOf('birthday-card-header')).toBeLessThan(markup.indexOf('birthday-name'));
   expect(markup.indexOf('birthday-name')).toBeLessThan(markup.indexOf('birthday-age-block'));
   expect(markup).toContain('Gefeliciteerd, Sam K.!');
  }
 });
 it('escapes both saved fields as text, keeps empty fields empty and does not invent a missing initial',()=>{
  const base=createSyncTemplatePreview('birthdays');if(base.rendererVersion!=='sync-onzetrots-v9')throw Error('v9');
  const text='<img src=x onerror=alert(1)> & "Club"';
  const slide=syncSlidePresentationSchema.parse({...base,authoring:{...base.authoring,headerSubtitles:{birthdays:text},headerTexts:{birthdays:''}},rich:{...base.rich,birthdays:[{id:'private-display-name',displayName:'Sam',age:12,dateLabel:'Vandaag',meta:'Eigen team'}]}});
  const html=renderToStaticMarkup(<SyncSlideStaticView presentation={slide}/>);
  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');expect(html).not.toContain('<img src="x"');
  expect(html).toContain('data-ot-header-text="true" hidden=""');expect(html).toContain('Gefeliciteerd, Sam!');expect(html).not.toContain('Gefeliciteerd, Sam K.');
 });
});
