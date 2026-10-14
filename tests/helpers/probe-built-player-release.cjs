// Runs the actual Next route bundle with a synthetic, strictly bounded backend.
// This catches RSC client-reference failures that source-level Vitest cannot.
const {readFileSync}=require('node:fs');
const [routePath,fixturePath]=process.argv.slice(2);
const fixture=JSON.parse(readFileSync(fixturePath,'utf8'));
process.env.NEXT_PUBLIC_SUPABASE_URL='https://database.example.test';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-only-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY='sb_secret_'+ 'a'.repeat(32);
global.fetch=async(input,options)=>{
 const url=new URL(typeof input==='string'?input:input.url);
 if(url.hostname!=='database.example.test')throw new Error('Unexpected external request');
 let data;
 if(url.pathname.endsWith('/rpc/get_player_effective_target_v1'))data=fixture.target;
 else if(url.pathname.endsWith('/rpc/get_player_entitlement_v1'))data=[];
 else if(url.pathname.includes('/storage/v1/object/sign/')){
  if(fixture.missingStorage)return Response.json({message:'Object not found'},{status:404});
  data={signedURL:'/object/sign/tenant-media/frozen.png?token=test-only'};
 }else if(url.pathname.startsWith('/rest/v1/')){
  const table=url.pathname.split('/').at(-1),rows=fixture.tables[table]??[];
  for(const col of url.searchParams.get('select')?.split(',')??[]){
   if(rows[0]&&!(col in rows[0]))return Response.json({code:'42703',message:'Unknown fixture column'},{status:400});
  }
  const headers=new Headers(options?.headers??(input instanceof Request?input.headers:undefined));
  data=headers.get('accept')?.includes('vnd.pgrst.object')?(rows[0]??null):rows;
 }else throw new Error('Unexpected backend request');
 return Response.json(data);
};
async function run(){
 const route=require(routePath);
 const response=await route.routeModule.userland.GET(new Request('https://player.example.test/api/player/manifest',{headers:{authorization:'Bearer test-only-device'}}));
 const body=await response.json();
 process.stdout.write(JSON.stringify({status:response.status,body}));
}
run().catch(()=>{process.stderr.write('BUILT_PLAYER_PROBE_FAILED');process.exitCode=1;});
