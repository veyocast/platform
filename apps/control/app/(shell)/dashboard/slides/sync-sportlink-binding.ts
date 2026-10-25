import {sportlinkArrivalConfigSchema,sportDynamicSlideTypes,sportlinkBirthdayConfigurationSchema,sportlinkSlideTeamSelectionSchema,syncDynamicFamilies,syncOnzeTrotsDynamicFamilies,type SyncSlidePresentation,type SportlinkSlideContext,type SyncDynamicConfiguration} from '@veyocast/contracts';

export type SyncSportlinkTeam={externalId:string;name:string;contexts:Array<{label:string;competitionId:string;phaseId:string|null;poolId:string|null;seasonId:string|null}>};
export type SyncSportlinkOptions={sourceId:string;teams:SyncSportlinkTeam[];capabilities:Array<{article:string;capability:string;available:boolean;enabled:boolean}>;privacyPeople:boolean;privacyBirthdays:boolean};
export type SyncSportlinkSelection={mode:'all'|'selected';contexts:SportlinkSlideContext[];birthdayDays:7|14|21;matchLocation?:'both'|'home'|'away';welcomeDays?:number};
export function syncConnectedAuthoringType(family:string,rendererVersion:SyncSlidePresentation['rendererVersion']='sync-v1'):'menu'|'news'|'ledscores_live_match'|(typeof sportDynamicSlideTypes)[number]|undefined{
 if(family==='menu')return'menu';if(family==='rss')return'news';
 if(family==='scoreboard'||family==='goal')return'ledscores_live_match';
 return Object.entries(rendererVersion!=='sync-v1'?syncOnzeTrotsDynamicFamilies:syncDynamicFamilies).find(([type,families])=>type.startsWith('sport_')&&(families as readonly string[]).includes(family))?.[0]as(typeof sportDynamicSlideTypes)[number]|undefined;
}
export function isSyncSportlinkType(value:string):value is (typeof sportDynamicSlideTypes)[number]{return(sportDynamicSlideTypes as readonly string[]).includes(value);}
export function syncSportlinkSelectionPolicy(cfg:SyncDynamicConfiguration){
 const clubOnly=['sport_activities','sport_volunteers'].includes(cfg.slideType);
 const single=['sport_standing','sport_period_standing','sport_match_of_the_day','sport_next_match','sport_cancellations','sport_dressing_rooms','sport_officials','sport_team'].includes(cfg.slideType)||['team-program','pool-program','team-results','pool-results'].includes(cfg.seed.family);
 const required=single||['sport_visitor_arrivals','sport_referee_arrivals'].includes(cfg.slideType);
 return{clubOnly,single,required,maximum:cfg.rendererVersion!=='sync-v1'?200:cfg.slideType==='sport_birthdays'?50:500};
}
export function syncSportlinkAutoContext(providerTeamId:string):SportlinkSlideContext{return{providerTeamId,competitionSelectionMode:'auto_current',competitionId:null,phaseId:null,poolId:null,seasonId:null};}
export function clearSyncSportlinkBinding(configuration:Record<string,unknown>){
 const result={...configuration};for(const key of['context','teamSelection','sourceTeamSelection','teamContexts','blueprintKey','birthday'])delete result[key];return result;
}
export function readSyncSportlinkSelection(cfg:SyncDynamicConfiguration,configuration:Record<string,unknown>):SyncSportlinkSelection{
 const policy=syncSportlinkSelectionPolicy(cfg),raw=(configuration.sourceTeamSelection??configuration.teamSelection)as {mode?:unknown;teamContexts?:unknown}|undefined;
 let contexts=raw?.teamContexts??configuration.teamContexts??(configuration.context?[configuration.context]:[]);
 if(policy.required&&Array.isArray(contexts)&&!contexts.length&&configuration.context)contexts=[configuration.context];
 const mode=policy.required?'selected':raw?.mode==='selected'?'selected':'all';
 const parsed=sportlinkSlideTeamSelectionSchema.safeParse({mode:mode==='selected'&&Array.isArray(contexts)&&contexts.length===0?'all':mode,teamContexts:contexts});
 if(!parsed.success)throw Error('De opgeslagen teamselectie is ongeldig. Kies de bron en teams opnieuw; het serverontwerp blijft behouden.');
 const birthday=configuration.birthday as {period?:{days?:unknown}}|undefined,days=birthday?.period?.days??7;
 if(![7,14,21].includes(Number(days)))throw Error('De opgeslagen verjaardagsperiode is ongeldig. Kies een periode opnieuw; het serverontwerp blijft behouden.');
 const arrival=configuration.arrival as {minutesBefore?:unknown}|undefined;
 return{mode,contexts:parsed.data.teamContexts,birthdayDays:Number(days)as 7|14|21,...(raw&&'matchLocation' in raw?{matchLocation:sportlinkSlideTeamSelectionSchema.parse({...raw,mode,teamContexts:parsed.data.teamContexts}).matchLocation}:{}),...(typeof arrival?.minutesBefore==='number'?{welcomeDays:arrival.minutesBefore/1440}:{})};
}

/** Static selection only: the original canonical SQL builder still validates
 * tenant/provider rights and supplies every match/person/result at preview and
 * prepare. No Sites design or browser-authored fact enters this compilation. */
export function compileSyncSportlinkBinding(cfg:SyncDynamicConfiguration,configuration:Record<string,unknown>,selection:SyncSportlinkSelection,teams:SyncSportlinkTeam[]):Record<string,unknown>{
 if(!isSyncSportlinkType(cfg.slideType))throw Error('Dit ontwerp gebruikt geen Sportlink-selectie.');
 const policy=syncSportlinkSelectionPolicy(cfg),contexts=selection.mode==='all'?[]:selection.contexts;
 if(policy.required&&selection.mode!=='selected'||policy.single&&contexts.length!==1||contexts.length>policy.maximum||!([7,14,21]as number[]).includes(selection.birthdayDays))throw Error('Kies de teams en een beschikbare competitie voor dit brontype.');
 sportlinkSlideTeamSelectionSchema.parse({mode:selection.mode,teamContexts:contexts});
 for(const context of contexts){
  const team=teams.find(team=>team.externalId===context.providerTeamId);
  if(!team||context.competitionSelectionMode==='pinned'&&!team.contexts.some(option=>option.competitionId===context.competitionId&&option.phaseId===context.phaseId&&option.poolId===context.poolId&&option.seasonId===context.seasonId))throw Error('Een gekozen team of competitie hoort niet bij deze bron. Kies de selectie opnieuw.');
 }
 const result:Record<string,unknown>={...clearSyncSportlinkBinding(configuration),schemaVersion:1,maxItems:200,title:cfg.seed.title||cfg.seed.name,syncConfiguration:cfg};
 const teamSelection=sportlinkSlideTeamSelectionSchema.parse({mode:selection.mode,teamContexts:contexts,...(selection.matchLocation?{matchLocation:selection.matchLocation}:{})});
 if(selection.welcomeDays!==undefined){
  if(!Number.isFinite(selection.welcomeDays)||selection.welcomeDays<=0||selection.welcomeDays>42||!Number.isInteger(selection.welcomeDays*1440))throw Error('Kies een vooruitkijkperiode van maximaal 42 dagen.');
  result.arrival=sportlinkArrivalConfigSchema.parse({...configuration.arrival as Record<string,unknown>,minutesBefore:selection.welcomeDays*1440,minutesAfter:0,emptyBehavior:'skip'});
 }
 if(cfg.slideType==='sport_program'||cfg.slideType==='sport_results'){
  const pool=cfg.seed.family.startsWith('pool-');
  result.blueprintKey=cfg.slideType==='sport_program'?(pool?'sportlink.pool_schedule_next_7_days':'sportlink.club_schedule_next_7_days'):(pool?'sportlink.pool_results_previous_7_days':'sportlink.club_results_previous_7_days');
  if(!pool||cfg.seed.rendererVersion==='sync-onzetrots-v9'&&cfg.seed.authoring?.visualRevision==='onzetrots-20261024'||selection.matchLocation!==undefined)result.teamSelection=teamSelection;
 }else if(cfg.slideType==='sport_standing')result.blueprintKey='sportlink.pool_standings';
 else if(['sport_visitor_arrivals','sport_referee_arrivals'].includes(cfg.slideType)){
  result.blueprintKey=cfg.slideType==='sport_visitor_arrivals'?'sportlink.visitor_arrivals':'sportlink.referee_arrivals';result.teamContexts=contexts;
 }else if(['sport_team','sport_trainings','sport_sponsor'].includes(cfg.slideType))result.sourceTeamSelection=teamSelection;
 else if(!policy.clubOnly)result.teamSelection=teamSelection;
 if(contexts[0])result.context=contexts[0];
 if(cfg.slideType==='sport_birthdays'){
  result.blueprintKey='sportlink.birthdays';
  const prior=configuration.birthday as Record<string,unknown>|undefined;
  result.birthday=sportlinkBirthdayConfigurationSchema.parse({...prior,title:cfg.seed.title||cfg.seed.name,
   period:{days:selection.birthdayDays,mode:selection.birthdayDays===21?'next_21_days':selection.birthdayDays===14?'next_14_days':'next_7_days'},
   selection:{...(prior?.selection as Record<string,unknown>|undefined),teamSelectionMode:selection.mode,selectedTeamIds:contexts.map(context=>context.providerTeamId),includeWithoutTeam:selection.mode==='all'},
  });
 }
 return result;
}
