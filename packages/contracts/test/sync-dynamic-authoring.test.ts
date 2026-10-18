import {describe,it,expect} from 'vitest';
import {syncDynamicCommandSchema} from '../src/sync-dynamic-authoring';
import {syncDynamicConfigurationSchema} from '../src/sync-dynamic-configuration';
import {syncSlidePresentationSchema,syncSlideSourceRevision} from '../src/sync-slide-presentation';

const id='10000000-0000-4000-8000-000000000226';
const seed=syncSlidePresentationSchema.parse({schemaVersion:1,rendererVersion:'sync-v1',sourceRevision:syncSlideSourceRevision,family:'menu',orientation:'landscape',theme:'fieldflow',name:'Eigen bronontwerp',title:'Eigen kantine',club:{name:'Eigen club',tagline:''},style:{}});
const cfg=syncDynamicConfigurationSchema.parse({schemaVersion:1,kind:'dynamic',rendererVersion:'sync-v1',sourceRevision:syncSlideSourceRevision,slideType:'menu',seed,secondsPerPage:3});
const create={action:'create',slideId:null,versionId:null,expectedRevision:0,idempotencyKey:id,request:{templateVersionId:id,dataSourceId:id,configuration:{maxItems:200,syncConfiguration:cfg}}};
describe('independent Source authoring commands',()=>{
 it('admits only a new identity for create and existing identities for draft saves',()=>{
  expect(syncDynamicCommandSchema.safeParse(create).success).toBe(true);
  expect(syncDynamicCommandSchema.safeParse({...create,slideId:id}).success).toBe(false);
  expect(syncDynamicCommandSchema.safeParse({...create,action:'save',slideId:id,versionId:id,expectedRevision:4}).success).toBe(true);
 });
 it('rejects provider facts in a Source seed and arbitrary outer command fields',()=>{
  const altered=structuredClone(create);altered.request.configuration.syncConfiguration.seed.rows=[['Fake price','9,99','','']];
  expect(syncDynamicCommandSchema.safeParse(altered).success).toBe(false);
  expect(syncDynamicCommandSchema.safeParse({...create,tenantId:id}).success).toBe(false);
 });
 it('requires an empty preparation request so design cannot change inside prepare',()=>{
  const publish={...create,action:'publish',slideId:id,versionId:id,expectedRevision:4,request:{}};
  expect(syncDynamicCommandSchema.safeParse(publish).success).toBe(true);
  expect(syncDynamicCommandSchema.safeParse({...publish,request:create.request}).success).toBe(false);
 });
});
