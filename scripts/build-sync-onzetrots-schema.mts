import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {syncOnzeTrotsSystemAssets,syncOnzeTrotsDynamicFamilies,syncSystemAssets,syncBackgroundAssets} from '../packages/contracts/src/index';
const file=process.argv[2];
if(!file||!/^supabase\/migrations\/\d{14}_sync_onzetrots_approved_renderer\.sql$/.test(file)||file<='supabase/migrations/20261019141413_menu_price_candidates.sql')throw Error('Supply the new explicit OnzeTrots forward migration; historical migrations are never rewritten.');
let sql=readFileSync(resolve(file),'utf8');
for(const [marker,value]of [
 ['sync_schema',JSON.parse(readFileSync('packages/contracts/src/sync-slide-json-schema.json','utf8'))],
 ['sync_dynamic_schema',JSON.parse(readFileSync('packages/contracts/src/sync-dynamic-json-schema.json','utf8'))],
 ['sync_onzetrots_manifest',Object.fromEntries([...syncSystemAssets,...syncOnzeTrotsSystemAssets].filter(asset=>asset.mimeType.startsWith('image/')).map(asset=>[asset.path,asset.sha256]))],
 ['sync_onzetrots_families',syncOnzeTrotsDynamicFamilies],
 ['sync_onzetrots_backgrounds',Object.fromEntries(syncBackgroundAssets.map(asset=>[asset.path,asset.sha256]))],
] as const){
 const tag=`$${marker}$`,start=sql.indexOf(tag),end=sql.indexOf(tag,start+tag.length);
 if(start<0||end<0||sql.indexOf(tag,end+tag.length)>=0)throw Error('Expected one current generated literal '+marker);
 sql=sql.slice(0,start+tag.length)+JSON.stringify(value)+sql.slice(end);
}
writeFileSync(file,sql);console.log('Generated only the explicit new OnzeTrots migration '+file);
