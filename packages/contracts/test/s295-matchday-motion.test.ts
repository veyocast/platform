import {expect,it} from 'vitest';
import {syncSlidePresentationSchema,syncSlideMinimumDurationMs,syncSlideInternalMotion,syncOnzeTrotsMatchdayResultSlots} from '../src/index';

const result=(id:string,teamId:string)=>({id,home:{name:teamId,teamId,clubId:null},away:{name:'Guest',teamId:'guest-'+id,clubId:null},kickoffAt:'2026-11-07T12:00:00Z',status:'finished',field:null,homeRoom:null,awayRoom:null,homeScore:0,awayScore:0});
const presentation=(count:number,otherResults=2)=>syncSlidePresentationSchema.parse({schemaVersion:1,rendererVersion:'sync-onzetrots-v9',sourceRevision:'5ba52a657d6d16ad103ba2fb43b8db18aa83715a',family:'matchday',orientation:'portrait',theme:'onzetrots-tv',name:'Checked matchday',title:'Matchday',club:{name:'Own club'},style:{motion:'rustig'},visual:{schemaVersion:1,mode:'light'},rich:{matchday:{context:{tenantId:'10000000-0000-4000-8000-000000000295',teamId:'team-0',competitionId:'competition',poolId:'pool',seasonId:null,revisions:['results','standings','fixtures'].map(dataset=>({dataset,revision:1}))},results:[result('own','team-0'),...Array.from({length:otherResults},(_,index)=>result('other-'+index,'other-'+index))],standings:{ownTeamId:'team-0',rows:Array.from({length:count},(_,index)=>({id:'row-'+index,teamId:'team-'+index,clubId:null,teamName:'Team '+index,position:index+1,played:1,won:0,drawn:1,lost:0,goalDifference:0,points:1,form:[]}))},fixtures:[]}}});

it.each([[7,9000],[8,14000]] as const)('retains the published admission duration for %i rows while marking the measured scroll for fitting', (count,duration)=>{
 const slide=presentation(count),before=JSON.stringify(slide);
 expect(syncSlideMinimumDurationMs(slide)).toBe(duration);
 expect(syncSlideInternalMotion(slide)).toMatchObject({enabled:true,fitAvailableDuration:true});
 expect(syncOnzeTrotsMatchdayResultSlots(slide)).toBe(3);
 expect(syncSlideMinimumDurationMs(presentation(count,0))).toBe(duration);
 expect(syncSlideInternalMotion(presentation(count,0)).fitAvailableDuration).toBeUndefined();
 expect(syncOnzeTrotsMatchdayResultSlots(presentation(count,0))).toBe(0);
 expect(syncOnzeTrotsMatchdayResultSlots(presentation(count,1))).toBe(2);
 expect(JSON.stringify(slide)).toBe(before);
});
it('keeps newly overflowing small standings animated even when the historic viewport fitted them',()=>{
 expect(syncSlideInternalMotion(presentation(4))).toMatchObject({enabled:true,fitAvailableDuration:true});
 const noEntrance=syncSlidePresentationSchema.parse({...presentation(4),style:{...presentation(4).style,motion:'geen'}});
 expect(syncSlideInternalMotion(noEntrance).enabled).toBe(true);
});
