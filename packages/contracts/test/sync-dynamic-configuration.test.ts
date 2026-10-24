import {describe,expect,it} from 'vitest';
import {z} from 'zod';
import {readFileSync} from 'node:fs';
import generatedSchema from '../src/sync-dynamic-json-schema.json';
import {syncDynamicConfigurationSchema,syncSlidePresentationSchema,syncDynamicFamilyMatches,sportDynamicSlideTypes,type SyncContentFamily} from '../src/index';
const seed=(family:SyncContentFamily='fixtures')=>syncSlidePresentationSchema.parse({schemaVersion:1,rendererVersion:'sync-v1',sourceRevision:'8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a',family,orientation:'landscape',theme:'fieldflow',name:'Eigen gekoppeld ontwerp',title:'Onze club',club:{name:'Eigen vereniging'},style:{motion:'rustig'}});
const config=()=>({schemaVersion:1,kind:'dynamic',rendererVersion:'sync-v1',sourceRevision:'8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a',slideType:'sport_program',seed:seed(),secondsPerPage:3});
describe('independent Source dynamic configuration',()=>{
 it('keeps the generated database schema identical to the normalized wire schema',()=>{
  expect(generatedSchema).toEqual(z.toJSONSchema(syncDynamicConfigurationSchema,{target:'draft-7',io:'output'}));
  const migration=readFileSync(new URL('../../../supabase/migrations/20261024173000_onzetrots_consistency.sql',import.meta.url),'utf8');
  expect(migration.split('$sync_dynamic_schema$')[1]).toBe(JSON.stringify(generatedSchema));
 });
 it('keeps Source identity and static design choices without embedding a canonical dataset',()=>{
  const parsed=syncDynamicConfigurationSchema.parse(config());expect(parsed.seed.rows).toEqual([]);expect(parsed.seed.style.motion).toBe('rustig');expect(parsed.seed.club.name).toBe('Eigen vereniging');expect(parsed.secondsPerPage).toBe(3);
  expect(syncDynamicConfigurationSchema.safeParse({...config(),rendererVersion:'sites-v17'}).success).toBe(false);
  expect(syncDynamicConfigurationSchema.safeParse({...config(),sourceRevision:'6800bc858436ba0843eaea89b682cd5b43c3521d'}).success).toBe(false);
 });
 it('rejects a family/source mismatch and preserves the explicit club/team/pool programme choices',()=>{
  expect(syncDynamicFamilyMatches('sport_program','fixtures')).toBe(true);expect(syncDynamicFamilyMatches('sport_program','team-program')).toBe(true);expect(syncDynamicFamilyMatches('sport_program','pool-program')).toBe(true);
  expect(syncDynamicConfigurationSchema.safeParse({...config(),slideType:'sport_results'}).success).toBe(false);expect(sportDynamicSlideTypes).toHaveLength(17);
 });
 it('does not accept manually supplied results, articles, scores, polls or video data as connected facts',()=>{
  for(const patch of[{rows:[['Thuis','Uit','9','0']]},{news:[{title:'Onbevestigd nieuws',intro:'Niet opgehaald',source:'Naam'}]},{ownRowIndexes:[0]},{home:{name:'Een verzonnen tegenstander',team:''}},{match:{homeScore:'9',awayScore:'0',clock:'',date:'',time:''}},{youtubeUrl:'https://www.youtube.com/watch?v=test'},{state:'empty'}])expect(syncDynamicConfigurationSchema.safeParse({...config(),seed:{...seed(),...patch}}).success).toBe(false);
 });
 it('bounds names, integral page timing and additional fields before any writer or render command',()=>{
  for(const secondsPerPage of[0,2,3.5,121])expect(syncDynamicConfigurationSchema.safeParse({...config(),secondsPerPage}).success).toBe(false);
  expect(syncDynamicConfigurationSchema.safeParse({...config(),seed:{...seed(),name:'X'}}).success).toBe(false);
  expect(syncDynamicConfigurationSchema.safeParse({...config(),sitesConfiguration:{rendererVersion:'sites-v17'}}).success).toBe(false);
  expect(syncDynamicConfigurationSchema.safeParse({...config(),seed:seed('club-story')}).success).toBe(false);
 });
});
