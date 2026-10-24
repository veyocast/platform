import{it,expect}from'vitest';
import{syncSlidePresentationSchema,syncOnzeTrotsWelcomeShouldSkip,collectSyncSportMediaAssetIds}from'../src/index';
it('current welcome skips empty/out-of-window/foreign matches, using stable home identity during offline playback',()=>{
 const at=Date.parse('2026-10-25T12:00:00Z');
 const match={id:'fixture',home:{name:'Eigen team',teamId:'own',clubId:'club'},away:{name:'Bezoeker',teamId:'visitor',clubId:'other'},kickoffAt:'2026-10-27T12:00:00Z',status:'scheduled',field:null,homeRoom:null,awayRoom:null,venue:'Neutrale locatie',homeScore:null,awayScore:null};
 const slide=syncSlidePresentationSchema.parse({schemaVersion:1,rendererVersion:'sync-onzetrots-v9',sourceRevision:'5ba52a657d6d16ad103ba2fb43b8db18aa83715a',family:'welcome',theme:'onzetrots-tv',orientation:'landscape',name:'Eigen gasten',club:{name:'Eigen club'},title:'Welkom',style:{},visual:{schemaVersion:1,mode:'light'},authoring:{visualRevision:'onzetrots-20261024'},rich:{fixtures:[match],visitorsSelection:{ownClubId:'club',ownTeamIds:['own'],referenceAt:new Date(at).toISOString(),windowMinutes:7*1440}}});
 expect(syncOnzeTrotsWelcomeShouldSkip(slide,at)).toBe(false);
 expect(syncOnzeTrotsWelcomeShouldSkip(slide,at+3*86400000)).toBe(true);
 if(slide.rendererVersion!=='sync-onzetrots-v9')throw Error('Current required');
 slide.rich!.visitorsSelection!.windowMinutes=1440;expect(syncOnzeTrotsWelcomeShouldSkip(slide,at)).toBe(true);
 slide.rich!.visitorsSelection!.windowMinutes=7*1440;slide.rich!.fixtures![0]!.home.teamId='own-lookalike';expect(syncOnzeTrotsWelcomeShouldSkip(slide,at)).toBe(true);
 slide.rich!.fixtures=[];expect(syncOnzeTrotsWelcomeShouldSkip(slide,at)).toBe(true);
 delete slide.authoring.visualRevision;expect(syncOnzeTrotsWelcomeShouldSkip(slide,at)).toBe(false);
});
it('collects deduplicated assets from all three matchday blocks',()=>{
 const first='10000000-0000-4000-8000-000000000291',second='20000000-0000-4000-8000-000000000291';
 expect(collectSyncSportMediaAssetIds({sport:{matchday:{results:{items:[{homeLogoMediaAssetId:first}]},standings:{items:[{logoMediaAssetId:second}]},fixtures:{items:[{awayLogoMediaAssetId:first}]}}}}).sort()).toEqual([first,second]);
});
