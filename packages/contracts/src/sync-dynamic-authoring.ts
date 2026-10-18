import {z} from 'zod';
import {syncDynamicConfigurationSchema} from './sync-dynamic-configuration';

export const syncDynamicRequestSchema=z.object({templateVersionId:z.uuid(),dataSourceId:z.uuid(),configuration:z.record(z.string(),z.unknown())}).strict();
const request=syncDynamicRequestSchema;
export const syncDynamicCommandSchema=z.object({
 action:z.enum(['create','save','publish']),slideId:z.uuid().nullable(),versionId:z.uuid().nullable(),
 expectedRevision:z.number().int().nonnegative(),idempotencyKey:z.uuid(),request:z.union([request,z.object({}).strict()]),
}).strict().superRefine((value,context)=>{
 if(value.action==='create'?(value.slideId!==null||value.versionId!==null||value.expectedRevision!==0):(!value.slideId||!value.versionId))context.addIssue({code:'custom',message:'De gekozen ontwerpversie is niet geldig.'});
 if(value.action==='publish'){
  if(Object.keys(value.request).length)context.addIssue({code:'custom',message:'Een voorbereidingsopdracht bevat geen nieuwe ontwerpgegevens.'});
 }else{
  const parsed=request.safeParse(value.request);
  if(!parsed.success||!syncDynamicConfigurationSchema.safeParse(parsed.success?parsed.data.configuration.syncConfiguration:null).success)context.addIssue({code:'custom',message:'Controleer de bron, ontwerpnaam en vaste vormgeving.'});
 }
});
export type SyncDynamicCommand=z.infer<typeof syncDynamicCommandSchema>;
export type SyncDynamicRequest=z.infer<typeof request>;
