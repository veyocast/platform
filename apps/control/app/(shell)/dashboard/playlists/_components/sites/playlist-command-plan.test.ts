import {describe,it,expect}from'vitest';
import {sitesDynamicConfigurationSchema}from'@veyocast/contracts';
import {planPlaylistChanges,validatePlaylistPlan}from'./playlist-command-plan';
import type {DynamicDesign,Playlist,Slide,StudioSlide}from'./model';
const id=(n:number)=>`19110000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const slide=(n:number):Slide=>({id:id(n),mediaId:id(n+100),name:`Photo ${n}`,image:'',seconds:12});
const playlist=(slides:Slide[]):Playlist=>({id:id(1000),name:'Club playlist',description:'',status:'Concept',updated:'',slides});
const cfg=sitesDynamicConfigurationSchema.parse({schemaVersion:1,rendererVersion:'sites-v11',sourceRevision:'b1cae899af19fc39908217253094c5240d7359fc',themeId:'fieldflow',provider:'sportlink',orientation:'landscape',title:'Stand'});
const design=(n:number,rows=1):DynamicDesign=>({...cfg,id:id(n),name:'Stand',kind:'stand',background:'',rows:Array.from({length:rows},(_,i)=>({id:`row-${i}`,primary:`Team ${i}`})),config:cfg,screenIds:[],groupNames:[],snapshotId:id(n+1),payload:{}as DynamicDesign['payload'],sitesConfiguration:cfg});
describe('minimal revision-guarded playlist plans',()=>{
 it('has no command for unchanged contents',()=>{const before=playlist([slide(1)]);expect(planPlaylistChanges(before,structuredClone(before),new Map())).toEqual([]);});
 it('changes duration alone without replacing crop, sections, audio or source',()=>{const before=playlist([slide(1)]);expect(planPlaylistChanges(before,playlist([{...slide(1),seconds:3}]),new Map())).toEqual([{operation:'patch',itemId:id(1),patch:{durationSeconds:3}}]);});
 it('preserves ordered, mixed media and YouTube selection in one bounded command',()=>{
  const image=slide(1),video={...slide(2),kind:'video'as const},youtube={...slide(3),sourceKind:'youtube'as const,sourceId:id(800)};
  const next=playlist([video,youtube,image]);const ops=planPlaylistChanges(playlist([]),next,new Map(next.slides.map(item=>[item.id,item])));
  expect(ops.filter(op=>op.operation.startsWith('add_')).map(op=>op.operation)).toEqual(['add_media','add_youtube','add_media']);
  expect(ops.at(-1)).toEqual({operation:'reorder',itemIds:[video.id,youtube.id,image.id]});
  expect(()=>validatePlaylistPlan(next.id,0,id(999),ops)).not.toThrow();
 });
 it('adds a whole reviewed Studio series before removing an excluded member',()=>{
  const members=[slide(1),slide(2)].map((item,i)=>({...item,studioProjectId:id(500),seriesRevision:8,seriesClientId:id(1),seriesClientItemIds:[id(1),id(2)],seriesIndex:i}));
  const ops=planPlaylistChanges(playlist([]),playlist([members[1]!]),new Map(members.map(item=>[item.id,item])));
  expect(ops[0]).toEqual({operation:'add_studio_series',clientId:id(1),clientItemIds:[id(1),id(2)],seriesId:id(500),expectedSeriesRevision:8});
  expect(ops[1]).toEqual({operation:'remove',itemId:id(1)});
  expect(ops.filter(op=>op.operation==='add_studio_series')).toHaveLength(1);
 });
 it('rejects an incomplete reviewed series before any save is sent',()=>{
  const member={...slide(1),studioProjectId:id(500),seriesRevision:8,seriesClientId:id(1),seriesClientItemIds:[id(1),id(2)]};
  expect(()=>planPlaylistChanges(playlist([]),playlist([member]),new Map([[member.id,member]]))).toThrow('onvolledig');
 });
 it('creates a duplicate dependency before removing its original selection',()=>{
  const source=slide(1),copy={...source,id:id(2),duplicateOf:source.id};
  const ops=planPlaylistChanges(playlist([]),playlist([copy]),new Map([[source.id,source],[copy.id,copy]]));
  expect(ops.slice(0,3).map(op=>op.operation)).toEqual(['add_media','duplicate','remove']);
  expect(ops[1]).toMatchObject({itemId:source.id,clientId:copy.id});
 });
 it('explicitly refreshes a reviewed dynamic snapshot and recomputes all page time',()=>{
  const old={...slide(1),design:design(500,8),designId:id(500)};
  const latest={...old,design:{...design(500,17),snapshotId:id(510)}};
  const ops=planPlaylistChanges(playlist([old]),playlist([latest]),new Map());
  expect(ops[0]).toEqual({operation:'refresh_dynamic',itemId:old.id,expectedSnapshotId:id(510)});
  expect(ops.find(op=>op.operation==='patch')).toMatchObject({patch:{durationSeconds:36}});
 });
 it('does not create an authoring refresh merely because data in the same snapshot changed',()=>{
  const old={...slide(1),design:design(500),designId:id(500)};const next={...old,design:{...old.design,payload:{...old.design.payload,data:{score:2}}}};
  expect(planPlaylistChanges(playlist([old]),playlist([next]),new Map())).toEqual([]);
 });
 it('replaces the rendered medium while preserving every rich placement field',()=>{
  const old=slide(1);const next={...old,mediaId:id(900)};
  expect(planPlaylistChanges(playlist([old]),playlist([next]),new Map())).toEqual([{operation:'replace_media',itemId:old.id,mediaAssetId:id(900)}]);
 });
 it('changes a YouTube fallback without replacing the official online source',()=>{
  const old={...slide(1),sourceKind:'youtube'as const,sourceId:id(800)};const next={...old,mediaId:id(900)};
  expect(planPlaylistChanges(playlist([old]),playlist([next]),new Map())).toEqual([{operation:'replace_fallback',itemId:old.id,mediaAssetId:id(900),sourceKind:'youtube',sourceId:id(800)}]);
 });
 it('adds a new YouTube source before assigning its reviewed themed fallback',()=>{
  const chosen={...slide(1),sourceKind:'youtube'as const,sourceId:id(800)};const themed={...chosen,mediaId:id(900)};
  const ops=planPlaylistChanges(playlist([]),playlist([themed]),new Map([[chosen.id,chosen]]));
  expect(ops[0]).toMatchObject({operation:'add_youtube',sourceId:id(800)});expect(ops[1]).toEqual({operation:'replace_fallback',itemId:chosen.id,mediaAssetId:id(900),sourceKind:'youtube',sourceId:id(800)});
 });
 it('calculates pages from the actual theme chosen for a Studio placement',()=>{
  const presentation={kind:'studio',slide:{themeId:'onzetrots-tv',tv:{kind:'programma',rows:Array.from({length:17},(_,i)=>({id:`row-${i}`,primary:'Team'}))}}}as StudioSlide['presentation'];
  const before={...slide(1),studioSlide:{presentation,themeId:'onzetrots-tv'}as StudioSlide};
  const after={...before,studioSlide:{...before.studioSlide,themeId:'fieldflow'as const}};
  const ops=planPlaylistChanges(playlist([before]),playlist([after]),new Map());
  expect(ops.find(op=>op.operation==='patch')).toMatchObject({patch:{durationSeconds:12}});
 });
});
