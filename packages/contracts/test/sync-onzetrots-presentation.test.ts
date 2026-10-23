import {describe,it,expect} from 'vitest';
import {syncSlidePresentationSchema,syncSlidePageCount,syncSlideAssets,syncSlideMinimumDurationMs} from '../src/sync-slide-presentation';

const seed=(family='standings')=>({
 schemaVersion:1,rendererVersion:'sync-onzetrots-v1',sourceRevision:'ae83f2b4312408eacae9f29177d3c743e104185b',
 family,orientation:'landscape',theme:'onzetrots-tv',name:'Eigen clubscherm',title:'De ranglijst',club:{name:'Eigen club'},style:{motion:'rustig'},
 visual:{schemaVersion:1,mode:'light',scrollSpeed:'normal',panelOpacity:94},
});
const standing=(index:number)=>({id:`row-${index}`,teamId:`team-${index}`,clubId:`club-${index}`,teamName:`Team ${index}`,position:index+1,played:null,won:null,drawn:null,lost:null,goalDifference:null,points:null,form:[]});

describe('approved OnzeTrots presentation identity and rich data',()=>{
 it('accepts the approved identity and both modes without changing the historical identity',()=>{
  for(const mode of ['light','dark']){
   const slide=syncSlidePresentationSchema.parse({...seed(),visual:{...seed().visual,mode}});
   expect(slide.rendererVersion).toBe('sync-onzetrots-v1');
  }
  expect(syncSlidePresentationSchema.safeParse({...seed(),rendererVersion:'sync-v1'}).success).toBe(false);
  expect(syncSlidePresentationSchema.safeParse({...seed(),sourceRevision:'8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a'}).success).toBe(false);
  expect(syncSlidePresentationSchema.safeParse({...seed(),theme:'fieldflow'}).success).toBe(false);
 });
 it('keeps the whole verified standing and nullable facts on one continuous page',()=>{
  const slide=syncSlidePresentationSchema.parse({...seed(),rich:{standings:{ownTeamId:'team-13',rows:Array.from({length:14},(_,i)=>standing(i))}}});
  expect(syncSlidePageCount(slide)).toBe(1);
  expect('rich' in slide&&slide.rich?.standings?.rows[13]?.points).toBeNull();
  expect(syncSlideAssets(slide)).toEqual([]);
 });
 it('gives each six-slot family six places per page without losing a seventh record',()=>{
  for(const family of ['birthdays','activities','agenda']){
   for(const count of [0,1,6,7,12,13]){
    const data=family==='birthdays'
     ?{birthdays:Array.from({length:count},(_,i)=>({id:`birthday-${i}`,displayName:`Testpersoon ${i}`,age:null,dateLabel:'24 okt',meta:''}))}
     :{activities:Array.from({length:count},(_,i)=>({id:`activity-${i}`,title:`Testactiviteit ${i}`,body:'',dateLabel:'24 okt',timeLabel:'14:00',location:''}))};
    const slide=syncSlidePresentationSchema.parse({...seed(family),rich:data});
    expect(syncSlidePageCount(slide)).toBe(Math.max(1,Math.ceil(count/6)));
   }
  }
 });
 it('covers a complete outward and return journey at each speed in both formats',()=>{
  for(const orientation of ['landscape','portrait'])for(const scrollSpeed of ['slow','normal','fast']){
   const slide=syncSlidePresentationSchema.parse({...seed(),orientation,visual:{...seed().visual,scrollSpeed},rich:{standings:{ownTeamId:'team-13',rows:Array.from({length:14},(_,i)=>standing(i))}}});
   const range=orientation==='portrait'?207:484,speed={slow:19,normal:30,fast:48}[scrollSpeed as 'normal'];
   expect(syncSlideMinimumDurationMs(slide)).toBe(Math.ceil((5000+2000*range/speed)/1000)*1000);
   expect(syncSlideMinimumDurationMs(slide)).toBeGreaterThan(12000);
  }
 });
 it('collects nested verified images and rejects conflicting checksums or duplicate team rows',()=>{
  const image={kind:'tenant',mediaAssetId:'10000000-0000-4000-8000-000000000285',checksumSha256:'a'.repeat(64)},rows=[{...standing(0),logo:image}];
  const slide=syncSlidePresentationSchema.parse({...seed(),club:{name:'Club',logo:image},rich:{standings:{ownTeamId:'team-0',rows}}});
  expect(syncSlideAssets(slide)).toEqual([image]);
  expect(syncSlidePresentationSchema.safeParse({...slide,rich:{standings:{ownTeamId:'team-0',rows:[{...rows[0],logo:{...image,checksumSha256:'b'.repeat(64)}}]}}}).success).toBe(false);
  expect(syncSlidePresentationSchema.safeParse({...slide,rich:{standings:{ownTeamId:'team-0',rows:[rows[0],{...rows[0],id:'other-id'}]}}}).success).toBe(false);
 });
});
