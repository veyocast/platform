import React from 'react';
import{describe,it,expect}from'vitest';
import{renderToStaticMarkup}from'react-dom/server';
import{syncContentFamilies,syncSlidePresentationSchema,syncSlideAssets,syncSlideRendererAssets}from'@veyocast/contracts';
import{SyncSlideStaticView}from'@veyocast/content-templates/sync-slide-static-view';
import{createSyncStudioStarter,createSyncStudioDocument}from'@veyocast/studio';
import{createSyncTemplatePreview}from'./sync-template-preview';
describe('approved OnzeTrots display catalogue in the actual shared renderer',()=>{
 for(const family of ['birthdays','activities','agenda']as const)it(`${family}: keeps all explicit manual labels in six fixed slots and on continuation pages`,()=>{
  const example=createSyncStudioStarter({family,tenantName:'Eigen club',theme:'onzetrots-tv'}).syncPresentation!;
  const presentation=syncSlidePresentationSchema.parse({...example,rows:Array.from({length:7},(_,i)=>family==='birthdays'?['24','oktober',`Eigen jarige ${i}`,'Eigen toelichting']:['19:00','27 oktober',`Eigen activiteit ${i}`,'Eigen beschrijving'])});
  expect(createSyncStudioDocument(presentation,3).motion.durationMs).toBe(8000);
  const first=renderToStaticMarkup(<SyncSlideStaticView presentation={presentation} page={0}/>),last=renderToStaticMarkup(<SyncSlideStaticView presentation={presentation} page={1}/>);
  expect(first).toContain('data-filled-count="6"');expect(last).toContain('data-filled-count="1"');expect(last.match(/class="empty-grid-slot"/g)).toHaveLength(5);
  expect(first).toContain(family==='birthdays'?'Gefeliciteerd, Eigen 0.':'Eigen activiteit 0');expect(last).toContain(family==='birthdays'?'Gefeliciteerd, Eigen 6.':'Eigen activiteit 6');
 });
 for(const family of ['goal','scoreboard','next-match']as const)it(`${family}: an unobserved match renders its waiting state without a goal or invented score`,()=>{
  const example=createSyncTemplatePreview(family,'sync-onzetrots-v1'),presentation=syncSlidePresentationSchema.parse({...example,state:'empty',home:undefined,away:undefined,match:undefined});
  const html=renderToStaticMarkup(<SyncSlideStaticView presentation={presentation}/>);
  expect(html).toContain('De wedstrijdgegevens zijn nog niet beschikbaar.');expect(html).not.toContain('class="goal-word"');expect(html).not.toContain('class="score-number"');
 });
 for(const family of syncContentFamilies)for(const orientation of ['landscape','portrait']as const)for(const mode of ['light','dark']as const)it(`${family.id}/${orientation}/${mode}`,()=>{
  const example=createSyncTemplatePreview(family.id,'sync-onzetrots-v1');expect(example.rendererVersion).toBe('sync-onzetrots-v1');if(example.rendererVersion!=='sync-onzetrots-v1')throw Error('Approved example missing');
  const presentation=syncSlidePresentationSchema.parse({...example,orientation,visual:{...example.visual,mode}});
  const document=createSyncStudioDocument(presentation);
  expect(document.syncPresentation).toEqual(presentation);expect(document.motion.durationMs).toBeGreaterThanOrEqual(3000);
  const html=renderToStaticMarkup(<SyncSlideStaticView presentation={presentation}/>);
  expect(html).toContain('data-renderer="sync-onzetrots-v1"');expect(html).toContain(`data-theme="${mode}"`);expect(html).toContain(`viewBox="0 0 ${orientation==='portrait'?'900 1600':'1600 900'}"`);
  expect(html).not.toContain('vc-banner');expect(html).toContain('ONZE CLUB. ONZE TROTS.');
  const paths=new Set(syncSlideRendererAssets(presentation).map(asset=>asset.path));
  expect(syncSlideAssets(presentation).every(asset=>asset.kind==='system'&&paths.has(asset.path))).toBe(true);
  const starter=createSyncStudioStarter({family:family.id,tenantName:'Echte vereniging',orientation,theme:'onzetrots-tv'}).syncPresentation!;
  expect(starter.rows).toEqual([]);expect(starter.news).toEqual([]);expect('rich'in starter?starter.rich:undefined).toBeUndefined();
  expect(JSON.stringify(starter)).not.toMatch(/Duindorp|Houtrust|Quick Steps|Sam|Nora/);
 });
});
