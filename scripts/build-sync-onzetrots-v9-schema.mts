import {readFileSync,writeFileSync} from 'node:fs';
const file=process.argv[2];
if(!file||!/^supabase\/migrations\/\d{14}_sync_onzetrots_v9\.sql$/.test(file))throw Error('Explicit v9 forward migration required; historical SQL is never rewritten.');
let sql=readFileSync(file,'utf8');
for(const [marker,source]of [['sync_schema','sync-slide-json-schema.json'],['sync_dynamic_schema','sync-dynamic-json-schema.json']]){
 const tag='$'+marker+'$',a=sql.indexOf(tag),b=sql.indexOf(tag,a+tag.length);
 if(a<0||b<0||sql.indexOf(tag,b+tag.length)>=0)throw Error('Unique current schema marker required');
 sql=sql.slice(0,a+tag.length)+JSON.stringify(JSON.parse(readFileSync('packages/contracts/src/'+source,'utf8')))+sql.slice(b);
}
writeFileSync(file,sql);
