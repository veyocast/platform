import type {SyncOnzeTrotsRich} from '@veyocast/contracts';

export const syncOnzeTrotsScrollSpeeds={slow:19,normal:30,fast:48} as const;
const finite=(value:number)=>Number.isFinite(value)?value:0;
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

/** Logical pixels, with the same 2.5-second hold at both ends in every runtime. */
export function syncOnzeTrotsRankScrollAt(elapsedMs:number,range:number,speed:keyof typeof syncOnzeTrotsScrollSpeeds='normal'){
 const maximum=Math.max(0,finite(range));if(maximum===0)return 0;
 const velocity=syncOnzeTrotsScrollSpeeds[speed],travel=maximum/velocity,hold=2.5;
 const phase=(Math.max(0,finite(elapsedMs))/1000)%(2*travel+2*hold);
 if(phase<hold)return 0;
 if(phase<hold+travel)return clamp((phase-hold)*velocity,0,maximum);
 if(phase<2*hold+travel)return maximum;
 return clamp(maximum-(phase-2*hold-travel)*velocity,0,maximum);
}

/** One physical row is clamped; there is never an overlay copy of the team. */
export function syncOnzeTrotsPinnedRowY(rowIndex:number,rowHeight:number,viewportHeight:number,scrollY:number){
 const height=Math.max(0,finite(rowHeight));
 return clamp(Math.max(0,finite(rowIndex))*height-Math.max(0,finite(scrollY)),0,Math.max(0,finite(viewportHeight)-height));
}

/** UI clocks accrue active time only. Restarting after pause/visibility never
 * catches up to wall-clock time; large discontinuities accrue nothing. */
export function advanceSyncOnzeTrotsTime(elapsedMs:number,previousMs:number|null,nowMs:number,active:boolean){
 const elapsed=Math.max(0,finite(elapsedMs));
 if(!active||previousMs===null||!Number.isFinite(nowMs)||nowMs<previousMs||nowMs-previousMs>1000)return elapsed;
 return elapsed+nowMs-previousMs;
}

export function syncOnzeTrotsSixSlots<T>(items:readonly T[],page=0):Array<T|null>{
 const pages=Math.max(1,Math.ceil(items.length/6));
 const selected=clamp(Math.trunc(finite(page)),0,pages-1);
 return Array.from({length:6},(_,index)=>items[selected*6+index]??null);
}

export type SyncOnzeTrotsRankLayout={range:number;viewportHeight:number;rowHeight:number;ownIndex:number|null};
export type SyncOnzeTrotsMotionFrame={elapsedMs:number;reducedMotion:boolean;ranks:Array<{scrollTop:number;progress:number}>};

/** Serialization-safe DOM adapter; used as-is by the capture browser too. All
 * measurements are logical CSS pixels, independent of output/preview scale. */
export function measureSyncOnzeTrotsLayout(root:ParentNode=document):SyncOnzeTrotsRankLayout[]{
 return [...root.querySelectorAll<HTMLElement>('[data-ot-rank-list]')].map(list=>{
  const rows=[...list.querySelectorAll<HTMLElement>('.rank-row')],ownIndex=rows.findIndex(row=>row.dataset.own==='true');
  return {range:Math.max(0,list.scrollHeight-list.clientHeight),viewportHeight:list.clientHeight,rowHeight:rows[0]?.offsetHeight??0,ownIndex:ownIndex<0?null:ownIndex};
 });
}

export function projectSyncOnzeTrotsMotion(elapsedMs:number,layouts:readonly SyncOnzeTrotsRankLayout[],speed:keyof typeof syncOnzeTrotsScrollSpeeds='normal',reducedMotion=false):SyncOnzeTrotsMotionFrame{
 const time=reducedMotion?0:Math.max(0,finite(elapsedMs));
 return {elapsedMs:time,reducedMotion,ranks:layouts.map(layout=>{
  const scrollTop=syncOnzeTrotsRankScrollAt(time,layout.range,speed);
  return {scrollTop,progress:layout.range>0?scrollTop/layout.range:0};
 })};
}

/** No injected source code, timers, global animation search or duplicate own
 * row. CSS sticky clamps the one real row against both viewport boundaries. */
export function applySyncOnzeTrotsMotion(frame:SyncOnzeTrotsMotionFrame,root:ParentNode=document){
 const lists=[...root.querySelectorAll<HTMLElement>('[data-ot-rank-list]')];
 lists.forEach((list,index)=>{
  const position=frame.ranks[index];if(!position)return;
  list.scrollTop=position.scrollTop;
  const progress=list.closest('.rank-panel')?.querySelector<HTMLElement>('.rank-progress i');
  if(progress)progress.style.width=`${30+70*position.progress}%`;
 });
 // Capture, preview and Player sample the same internal CSS animation clock.
 // Parent entrance transitions are deliberately outside this screen subtree.
 for(const screen of root.querySelectorAll<HTMLElement>('.ot-approved-frame .screen')){
  screen.classList.toggle('reduced',frame.reducedMotion);
  screen.dataset.otElapsed=String(frame.elapsedMs);
  for(const animation of screen.getAnimations({subtree:true})){
   animation.pause();animation.currentTime=frame.elapsedMs;
  }
 }
}

type Fixture=NonNullable<SyncOnzeTrotsRich['fixtures']>[number];
type Selection=NonNullable<SyncOnzeTrotsRich['visitorsSelection']>;
/** Input has already passed the canonical tenant/source boundary. Filter before
 * sorting/limiting, and never derive club/team identity from display names. */
export function selectSyncOnzeTrotsVisitors(fixtures:readonly Fixture[],selection:Selection):Fixture[]{
 const reference=Date.parse(selection.referenceAt),teams=new Set(selection.ownTeamIds);
 if(!Number.isFinite(reference))return [];
 return fixtures.filter(fixture=>{
  const kickoff=fixture.kickoffAt?Date.parse(fixture.kickoffAt):NaN;
  return fixture.home.clubId===selection.ownClubId&&fixture.home.teamId!==null&&teams.has(fixture.home.teamId)
   &&Number.isFinite(kickoff)&&kickoff>reference&&fixture.status==='scheduled';
 }).sort((a,b)=>Date.parse(a.kickoffAt!)-Date.parse(b.kickoffAt!)||a.id.localeCompare(b.id,'en')).slice(0,4);
}
