import {z} from 'zod';
import type {SyncSlideAsset} from './sync-slide-presentation';

/** A new visual identity: the old Sync-v1 literal keeps its original meaning. */
export const syncOnzeTrotsRendererVersion='sync-onzetrots-v1' as const;
export const syncOnzeTrotsSourceRevision='ae83f2b4312408eacae9f29177d3c743e104185b' as const;
export const syncOnzeTrotsVisualSchema=z.object({
 schemaVersion:z.literal(1),mode:z.enum(['light','dark']),
 scrollSpeed:z.enum(['slow','normal','fast']).default('normal'),
 panelOpacity:z.number().int().min(80).max(100).default(94),
}).strict();

const id=z.string().trim().min(1).max(200),text=z.string().max(400);
const statistic=z.number().int().min(0).max(1_000_000).nullable();
const publicUrl=z.string().max(2048).url().refine(value=>{
 const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;
});

export const syncOnzeTrotsMatchdayContextSchema=z.object({
 tenantId:z.uuid(),teamId:id,competitionId:id.nullable(),poolId:id.nullable(),seasonId:id.nullable(),
 revisions:z.array(z.object({dataset:z.enum(['results','standings','fixtures']),revision:z.number().int().nonnegative()}).strict()).length(3),
}).strict().refine(value=>new Set(value.revisions.map(row=>row.dataset)).size===3,'Elke matchdaydataset heeft één eigen revisie.');

/** Produced only after the existing tenant/source/selection checks. Names are
 * display labels and never authorize a home fixture or own standings row. */
export const syncOnzeTrotsSourceScopeSchema=z.object({
 schemaVersion:z.literal(1),tenantId:z.uuid(),sourceId:z.uuid(),sourceConnectionId:z.uuid(),
 ownClubId:id.nullable(),ownTeamIds:z.array(id).max(200),
 context:z.object({teamId:id,competitionId:id.nullable(),poolId:id.nullable(),seasonId:id.nullable()}).strict().nullable(),
}).strict().refine(value=>new Set(value.ownTeamIds).size===value.ownTeamIds.length,'Teamselectie moet uniek zijn.');

/** The existing verified reference schema is supplied by the presentation
 * boundary. These are facts, never formatted strings parsed back into facts. */
export function createSyncOnzeTrotsRichSchema(asset:z.ZodType<SyncSlideAsset>){
 const side=z.object({teamId:id.nullable(),clubId:id.nullable(),name:text,logo:asset.optional()}).strict();
 const standing=z.object({
  id,teamId:id.nullable(),clubId:id.nullable(),teamName:text,logo:asset.optional(),
  position:z.number().int().min(1).max(1000).nullable(),played:statistic,won:statistic,drawn:statistic,lost:statistic,
  goalDifference:z.number().int().min(-1_000_000).max(1_000_000).nullable(),points:z.number().int().min(-1_000_000).max(1_000_000).nullable(),
  form:z.array(z.enum(['W','GL','V'])).max(10),
 }).strict();
 const standings=z.object({ownTeamId:id.nullable(),rows:z.array(standing).max(200),label:text.optional()}).strict();
 const fixture=z.object({
  id,home:side,away:side,kickoffAt:z.iso.datetime({offset:true}).nullable(),
  status:z.enum(['scheduled','live','finished','cancelled','postponed','unknown']),
  field:text.nullable(),homeRoom:text.nullable(),awayRoom:text.nullable(),venue:text.optional(),
  homeScore:statistic,awayScore:statistic,
 }).strict();
 return z.object({
  teamSelection:z.object({ownClubId:id.nullable(),ownTeamIds:z.array(id).max(200),primaryTeamId:id.nullable()}).strict().optional(),
  standings:standings.optional(),fixtures:z.array(fixture).max(200).optional(),
  visitorsSelection:z.object({ownClubId:id,ownTeamIds:z.array(id).min(1).max(200),referenceAt:z.iso.datetime({offset:true}),windowMinutes:z.number().int().min(1).max(60480).optional()}).strict().optional(),
  birthdays:z.array(z.object({id,displayName:text,age:z.number().int().min(0).max(130).nullable(),dateLabel:text,meta:text}).strict()).max(200).optional(),
  activities:z.array(z.object({id,title:text,body:z.string().max(4000),dateLabel:text,timeLabel:text,location:text,image:asset.optional()}).strict()).max(200).optional(),
  news:z.array(z.object({id,title:text,intro:z.string().max(4000),source:text,url:publicUrl.optional(),heroImage:asset.optional(),providerLogo:asset.optional()}).strict()).max(50).optional(),
  sponsors:z.array(z.object({id,name:text,logo:asset.optional()}).strict()).max(200).optional(),
  infoRows:z.array(z.object({id,cells:z.tuple([text,text,text,text,text]),logo:asset.optional(),selected:z.boolean().default(false)}).strict()).max(200).optional(),
  lineupPlayers:z.array(z.object({number:z.number().int().min(1).max(99),name:text}).strict()).max(36).optional(),
  featureImage:asset.optional(),
  matchday:z.object({context:syncOnzeTrotsMatchdayContextSchema,results:z.array(fixture).max(200),standings,fixtures:z.array(fixture).max(200)}).strict().optional(),
  phase:z.enum(['scheduled','live','paused','halftime','finished','unknown']).optional(),
 }).strict();
}
