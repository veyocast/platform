import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {syncDynamicConfigurationSchema,syncDynamicFamilies} from '../packages/contracts/src/sync-dynamic-configuration';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(join(root,'packages/contracts/package.json'));
const {z}=require('zod') as typeof import('../packages/contracts/node_modules/zod');
const schema=z.toJSONSchema(syncDynamicConfigurationSchema,{target:'draft-7',io:'output'});
const filename=join(root,'supabase/migrations/20261018007000_sync_dynamic_configuration.sql');let text=readFileSync(filename,'utf8');
for(const[marker,value]of [['sync_dynamic_schema',schema],['sync_dynamic_families',syncDynamicFamilies]] as const){const delimiter=`$${marker}$`,start=text.indexOf(delimiter),end=text.indexOf(delimiter,start+delimiter.length);if(start<0||end<0||text.indexOf(delimiter,end+delimiter.length)>=0)throw Error(`Expected one generated ${marker} literal`);text=text.slice(0,start+delimiter.length)+JSON.stringify(value)+text.slice(end);}
writeFileSync(filename,text);writeFileSync(join(root,'packages/contracts/src/sync-dynamic-json-schema.json'),JSON.stringify(schema,null,2)+'\n');
console.log('Generated Source dynamic schema and family scope without modifying the existing Source presentation schema.');
