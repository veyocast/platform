import {z} from 'zod';
import {dynamicTemplateSlideTypeSchema,type PlayerDynamicTemplatePayload} from './dynamic-content';
import {type SyncContentFamily} from './sync-content-families';
import {syncSlidePresentationSchema,syncSlideRendererVersion,syncSlideSourceRevision} from './sync-slide-presentation';

/** New Sync presentation only. Historical Sites configuration/decoders stay independent. */
export const syncDynamicFamilies = {
  menu: ["menu"],
  price_list: ["menu"],
  news: ["rss"],
  sport_program: ["fixtures", "club-program", "team-program", "pool-program"],
  sport_results: ["results", "club-results", "team-results", "pool-results"],
  sport_standing: ["standings"],
  sport_period_standing: ["period-standings"],
  sport_match_of_the_day: ["matchday"],
  sport_next_match: ["next-match"],
  sport_cancellations: ["cancellations"],
  sport_dressing_rooms: ["dressing-rooms", "changing-rooms"],
  sport_officials: ["officials"],
  sport_team: ["team-info"],
  sport_sponsor: ["sponsors"],
  sport_activities: ["activities", "agenda"],
  sport_trainings: ["training"],
  sport_volunteers: ["volunteers"],
  sport_birthdays: ["birthdays"],
  sport_visitor_arrivals: ["visitors", "team-arrivals"],
  sport_referee_arrivals: ["referees"],
  ledscores_live_match: ["scoreboard", "goal"],
} as const satisfies Record<
  PlayerDynamicTemplatePayload["slideType"],
  readonly SyncContentFamily[]
>;


export function syncDynamicFamilyMatches(slideType:PlayerDynamicTemplatePayload['slideType'],family:SyncContentFamily){
 return (syncDynamicFamilies[slideType] as readonly SyncContentFamily[]).includes(family);
}

/** Only static authoring choices belong in the seed. The existing canonical
 * snapshot supplies every result, article, participant and score at render time. */
export const syncDynamicConfigurationSchema=z.object({
 schemaVersion:z.literal(1),kind:z.literal('dynamic'),rendererVersion:z.literal(syncSlideRendererVersion),sourceRevision:z.literal(syncSlideSourceRevision),
 slideType:dynamicTemplateSlideTypeSchema,seed:syncSlidePresentationSchema,secondsPerPage:z.number().int().min(3).max(120),
}).strict().superRefine((value,context)=>{
 if(!syncDynamicFamilyMatches(value.slideType,value.seed.family))context.addIssue({code:'custom',path:['seed','family'],message:'Deze slidefamilie hoort niet bij het gekozen brontype.'});
 if(value.seed.name.trim().length<2||value.seed.name.trim().length>120)context.addIssue({code:'custom',path:['seed','name'],message:'Gebruik een ontwerpnaam van 2 tot 120 tekens.'});
 if(value.seed.rows.length||value.seed.news.length||value.seed.ownRowIndexes.length||value.seed.home||value.seed.away||value.seed.match||value.seed.poll||value.seed.youtubeUrl||value.seed.state!=='ready')context.addIssue({code:'custom',path:['seed'],message:'Gekoppelde feiten komen uitsluitend uit de gecontroleerde bron. Bewaar handmatige invoer in het oorspronkelijke ontwerp.'});
});
export type SyncDynamicConfiguration=z.infer<typeof syncDynamicConfigurationSchema>;
