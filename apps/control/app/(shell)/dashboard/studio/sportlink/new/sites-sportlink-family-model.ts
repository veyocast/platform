import { dynamicSlideTypeSchema, sportDynamicSlideTypes, sportlinkBirthdayConfigurationSchema, sportlinkDisplayConfigSchema, sportlinkSlideContextSchema, sportlinkSlideTeamSelectionSchema, sitesDynamicConfigurationSchema, themeSelectionSchema, type SitesDynamicConfiguration, type SportlinkSlideContext, type ThemeSelection } from "@veyocast/contracts";
export type SitesSportlinkFamily = (typeof sportDynamicSlideTypes)[number];
export const sitesSportlinkFamilyLabels: Record<SitesSportlinkFamily,string> = { sport_program:"Programma",sport_results:"Uitslagen",sport_standing:"Stand",sport_period_standing:"Periodestand",sport_match_of_the_day:"Wedstrijd van de dag",sport_next_match:"Volgende wedstrijd",sport_cancellations:"Afgelastingen",sport_dressing_rooms:"Kleedkamers",sport_officials:"Wedstrijdofficials",sport_team:"Teaminformatie",sport_sponsor:"Sponsors",sport_activities:"Clubactiviteiten",sport_trainings:"Trainingen",sport_volunteers:"Vrijwilligers",sport_birthdays:"Verjaardagen",sport_visitor_arrivals:"Bezoekers welkom",sport_referee_arrivals:"Scheidsrechters welkom" };
export type SitesSportlinkFamilyDraft = { family:SitesSportlinkFamily;name:string;templateVersionId:string;configuration:Record<string,unknown> & { sitesConfiguration:SitesDynamicConfiguration } };
export function sitesSportlinkAutoContext(providerTeamId:string):SportlinkSlideContext{return {providerTeamId,competitionSelectionMode:"auto_current",competitionId:null,poolId:null,seasonId:null,phaseId:null};}
export function buildSitesSportlinkFamilyDraft({family,name,templateVersionId,design,contexts,allTeams,themeSelection,birthdayDays=7}:{family:SitesSportlinkFamily;name:string;templateVersionId:string;design:SitesDynamicConfiguration;contexts:SportlinkSlideContext[];allTeams:boolean;themeSelection:ThemeSelection;birthdayDays?:number}):SitesSportlinkFamilyDraft {
 const birthday=family==="sport_birthdays"?sportlinkBirthdayConfigurationSchema.parse({title:design.title,themeSelection,period:{mode:birthdayDays===14?"next_14_days":birthdayDays===21?"next_21_days":"next_7_days",days:birthdayDays},selection:{teamSelectionMode:allTeams?"all":"selected",selectedTeamIds:allTeams?[]:contexts.map(context=>context.providerTeamId),includeWithoutTeam:allTeams}}):undefined;
 return {family,name,templateVersionId,configuration:{schemaVersion:1,title:design.title,maxItems:200,display:sportlinkDisplayConfigSchema.parse({}),editorial:{schemaVersion:2,themeSelection:themeSelectionSchema.parse(themeSelection)},teamSelection:sportlinkSlideTeamSelectionSchema.parse({mode:allTeams?"all":"selected",teamContexts:allTeams?[]:contexts}),...(contexts[0]?{context:contexts[0]}:{}),sitesConfiguration:sitesDynamicConfigurationSchema.parse(design),...(birthday?{birthday}:{})}};
}
export function parseSitesSportlinkFamilyDraft(value:unknown):SitesSportlinkFamilyDraft|null {
 try {
  if(!value||typeof value!=="object"||Array.isArray(value))return null;const input=value as Record<string,unknown>;
  if(Object.keys(input).some(key=>!["family","name","templateVersionId","configuration"].includes(key)))return null;
  const family=dynamicSlideTypeSchema.parse(input.family);if(!(sportDynamicSlideTypes as readonly string[]).includes(family)||typeof input.name!=="string"||input.name.trim().length<2||input.name.length>160||typeof input.templateVersionId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.templateVersionId))return null;
  if(!input.configuration||typeof input.configuration!=="object"||Array.isArray(input.configuration))return null;const config=input.configuration as Record<string,unknown>;
  if(Object.keys(config).some(key=>!["schemaVersion","title","maxItems","display","editorial","teamSelection","context","sitesConfiguration","birthday"].includes(key))||config.schemaVersion!==1||config.maxItems!==200)return null;
  const design=sitesDynamicConfigurationSchema.parse(config.sitesConfiguration);if(design.provider!=="sportlink"||config.title!==design.title)return null;
  const selection=sportlinkSlideTeamSelectionSchema.parse(config.teamSelection);const context=config.context===undefined?undefined:sportlinkSlideContextSchema.parse(config.context);
  const editorial=config.editorial as Record<string,unknown>;if(!editorial||editorial.schemaVersion!==2||Object.keys(editorial).some(key=>!["schemaVersion","themeSelection"].includes(key)))return null;
  if(family!=="sport_birthdays"&&config.birthday!==undefined)return null;
  const birthday=family==="sport_birthdays"?sportlinkBirthdayConfigurationSchema.parse(config.birthday):undefined;
  if(["sport_standing","sport_period_standing","sport_team"].includes(family)&&!context)return null;
  return {family:family as SitesSportlinkFamily,name:input.name.trim(),templateVersionId:input.templateVersionId,configuration:{schemaVersion:1,title:design.title,maxItems:200,display:sportlinkDisplayConfigSchema.parse(config.display),editorial:{schemaVersion:2,themeSelection:themeSelectionSchema.parse(editorial.themeSelection)},teamSelection:selection,...(context?{context}:{}),sitesConfiguration:design,...(birthday?{birthday}:{})}};
 }catch{return null;}
}

/** Compile to the existing family contracts used by the canonical DB builder. */
export function canonicalSitesSportlinkFamilyConfiguration(draft:SitesSportlinkFamilyDraft):Record<string,unknown>{
 const cfg={...draft.configuration};const selection=cfg.teamSelection as {mode:string;teamContexts:SportlinkSlideContext[]};delete cfg.teamSelection;
 if(draft.family==="sport_program")return {...cfg,blueprintKey:"sportlink.club_schedule_next_7_days",teamSelection:selection};
 if(draft.family==="sport_results")return {...cfg,blueprintKey:"sportlink.club_results_previous_7_days",teamSelection:selection};
 if(draft.family==="sport_standing")return {...cfg,blueprintKey:"sportlink.pool_standings"};
 if(draft.family==="sport_visitor_arrivals"||draft.family==="sport_referee_arrivals")return {...cfg,blueprintKey:draft.family==="sport_visitor_arrivals"?"sportlink.visitor_arrivals":"sportlink.referee_arrivals",teamContexts:selection.teamContexts};
 if(["sport_team","sport_trainings","sport_sponsor"].includes(draft.family))return {...cfg,sourceTeamSelection:selection};
 return cfg;
}

export function initialSitesSportlinkFamilySelection(family:SitesSportlinkFamily,providerTeamIds:string[]){
 const single=["sport_standing","sport_period_standing","sport_match_of_the_day","sport_next_match","sport_cancellations","sport_dressing_rooms","sport_officials"].includes(family);
 const arrival=family==="sport_visitor_arrivals"||family==="sport_referee_arrivals";
 return {allTeams:!single&&!arrival,teamIds:single?providerTeamIds.slice(0,1):arrival?[...new Set(providerTeamIds)].slice(0,500):[]};
}
