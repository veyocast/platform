import {describe,it,expect} from 'vitest';
import {syncOnzeTrotsRankScrollAt,syncOnzeTrotsPinnedRowY,syncOnzeTrotsSixSlots,advanceSyncOnzeTrotsTime,selectSyncOnzeTrotsVisitors} from '../src/sync-onzetrots-motion';

describe('approved OnzeTrots deterministic behavior',()=>{
 it('samples both holds and directions, including zero/invalid ranges',()=>{
  expect([0,2500,3500,4500,7000,8000,9000].map(time=>syncOnzeTrotsRankScrollAt(time,60))).toEqual([0,0,30,60,60,30,0]);
  for(const range of [0,-1,NaN,Infinity])expect(syncOnzeTrotsRankScrollAt(4000,range)).toBe(0);
  expect(syncOnzeTrotsRankScrollAt(3500,100,'slow')).toBe(19);
  expect(syncOnzeTrotsRankScrollAt(3500,100,'fast')).toBe(48);
 });
 it('clamps first, middle and last own row at both edges without a duplicate',()=>{
  expect(syncOnzeTrotsPinnedRowY(0,60,300,300)).toBe(0);
  expect(syncOnzeTrotsPinnedRowY(4,60,300,120)).toBe(120);
  expect(syncOnzeTrotsPinnedRowY(4,60,300,360)).toBe(0);
  expect(syncOnzeTrotsPinnedRowY(13,60,300,0)).toBe(240);
  expect(syncOnzeTrotsPinnedRowY(13,60,300,600)).toBe(180);
 });
 it('keeps six immutable places on all pages, including an empty collection',()=>{
  for(let count=0;count<=13;count++){
   const items=Array.from({length:count},(_,i)=>i);const original=[...items];const found=[];
   for(let page=0;page<Math.max(1,Math.ceil(count/6));page++){
    const slots=syncOnzeTrotsSixSlots(items,page);expect(slots).toHaveLength(6);found.push(...slots.filter(value=>value!==null));
   }
   expect(found).toEqual(items);expect(items).toEqual(original);
  }
 });
 it('does not accrue paused, hidden, backwards or discontinuous wall-clock time',()=>{
  expect(advanceSyncOnzeTrotsTime(1000,100,116,true)).toBe(1016);
  for(const [before,now,active] of [[100,200,false],[null,200,true],[100,99,true],[100,5000,true]] as const)
   expect(advanceSyncOnzeTrotsTime(1000,before,now,active)).toBe(1000);
 });
 it('selects the next four authorized home fixtures before limiting, without mutating input',()=>{
  const fixture=(id:string,time:string)=>({id,home:{teamId:'own-team',clubId:'own-club',name:'Club'},away:{teamId:'other-team',clubId:'other-club',name:'Gast'},kickoffAt:time,status:'scheduled' as const,field:null,homeRoom:null,awayRoom:null,homeScore:null,awayScore:null});
  const valid=[5,3,1,4,2].map(day=>fixture(String(day),`2026-10-${23+day}T14:00:00+01:00`));
  const rows=[{...valid[0]!,id:'cancelled',status:'cancelled' as const},{...valid[0]!,id:'external',home:{...valid[0]!.home,clubId:'foreign'}},{...valid[0]!,id:'unknown',home:{...valid[0]!.home,teamId:null}},fixture('past','2026-10-22T12:00:00Z'),fixture('equal','2026-10-23T12:00:00Z'),fixture('invalid','invalid'),...valid];
  const original=JSON.stringify(rows);
  expect(selectSyncOnzeTrotsVisitors(rows,{ownClubId:'own-club',ownTeamIds:['own-team'],referenceAt:'2026-10-23T12:00:00Z'}).map(row=>row.id)).toEqual(['1','2','3','4']);
  expect(JSON.stringify(rows)).toBe(original);
 });
});
