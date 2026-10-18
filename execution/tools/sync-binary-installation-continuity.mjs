import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,statSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

process.umask(0o077);
assert.equal(process.env.VEYOCAST_S226_LOCAL_ACCEPTANCE,'1');
assert.equal(process.cwd(),'/home/codex/repos/castivo-s226');
const cfgFile='/tmp/veyocast-s226-local-status.json';
assert.equal(statSync(cfgFile).mode&0o777,0o600);
const cfg=JSON.parse(readFileSync(cfgFile,'utf8'));
assert.equal(cfg.API_URL,'http://127.0.0.1:57621');
assert.equal(execFileSync('docker',['inspect','--format','{{index .Config.Labels "com.supabase.cli.project"}}','supabase_db_veyocast-s226'],{encoding:'utf8'}).trim(),'veyocast-s226');
const require=createRequire(process.cwd()+'/package.json');
const {chromium,expect}=require('@playwright/test');
const base='http://127.0.0.1:3222';
const keys=['veyocast.player.deviceToken','veyocast.player.installationCredential','veyocast.player.instanceId'];
const profile='/tmp/veyocast-s226-fresh-binary-player-profile';
const report={status:'RUNNING',startedAt:new Date().toISOString(),playerBuildId:readFileSync('apps/player/.next/BUILD_ID','utf8').trim(),scope:'real paired local QA identity, two interrupted installation requests followed by real registration recovery during full 24-second binary playback; no physical device or hosted acceptance',installation:[],media:[],browserErrors:[]};
let original,context;
try{
 original=await chromium.launchPersistentContext('/tmp/veyocast-s226-dynamic-player-profile',{ignoreHTTPSErrors:true});
 const op=original.pages()[0]??await original.newPage();
 await op.goto(base,{waitUntil:'domcontentloaded'});
 const identity=await op.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),keys);
 for(const key of keys)assert.ok(identity[key],`Existing paired identity component missing: ${key}`);
 await original.close();original=undefined;
 context=await chromium.launchPersistentContext(profile,{ignoreHTTPSErrors:true,viewport:{width:1920,height:1080}});
 await context.addInitScript(({identity})=>{
  for(const[key,value]of Object.entries(identity))localStorage.setItem(key,value);
  const supports=CSS.supports.bind(CSS);CSS.supports=(property,value)=>value==='1cqw'?false:supports(property,value);
  const events=[];Reflect.set(globalThis,'continuityEvents',events);let sequence=0;const ids=new WeakMap();
  for(const type of['playing','ended','emptied'])document.addEventListener(type,event=>{
   const video=event.target;if(!(video instanceof HTMLVideoElement))return;
   if(!ids.has(video))ids.set(video,++sequence);
   const row={type,at:Date.now(),time:video.currentTime,duration:Number.isFinite(video.duration)?video.duration:null,element:ids.get(video)};events.push(row);
   const src=video.currentSrc;if(src)fetch(src).then(response=>response.arrayBuffer()).then(bytes=>crypto.subtle.digest('SHA-256',bytes)).then(hash=>row.sha256=[...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,'0')).join('')).catch(()=>{});
  },true);
 },{identity});
 let interrupted=0;
 await context.route('**/api/player/installation',async route=>{if(route.request().method()==='POST'&&interrupted<2){interrupted++;report.installation.push({at:Date.now(),interrupted:true});await route.abort('connectionfailed');}else await route.continue();});
 const page=context.pages()[0]??await context.newPage();
 page.on('pageerror',error=>report.browserErrors.push(error.message.slice(0,250)));
 page.on('response',async response=>{if(new URL(response.url()).pathname!=='/api/player/installation')return;const body=await response.json().catch(()=>null);report.installation.push({at:Date.now(),status:response.status(),ok:body?.ok,bound:body?.bound,errorCode:body?.error?.code});});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.locator('video').last().evaluate(video=>video.readyState>=2&&!video.paused),{timeout:60000}).toBe(true);
 await page.waitForTimeout(51000);
 report.media=await page.evaluate(()=>Reflect.get(globalThis,'continuityEvents'));
 assert.equal(interrupted,2);assert.ok(report.installation.some(row=>row.status===200&&row.ok===true&&row.bound===true),'Actual installation registration must recover');
 assert.deepEqual(await page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),keys),identity,'Complete existing pairing and installation identity preserved');
 const starts=report.media.filter(row=>row.type==='playing'&&row.time<0.15).filter((row,index,rows)=>index===0||row.at-rows[index-1].at>300);
 assert.ok(starts.length>=3,'Observe two complete 24-second playback loops');
 for(let index=1;index<starts.length;index++){
  const start=starts[index],previous=starts[index-1];
  assert.ok(start.at-previous.at>=23700,`Premature playback restart after ${start.at-previous.at}ms`);
  assert.ok(report.media.some(row=>row.type==='ended'&&row.time>=23.8&&row.sha256===previous.sha256&&row.at>previous.at&&row.at<=start.at+100&&start.at-row.at<1000),'Every subsequent start follows the previous complete binary natural end');
 }
 assert.ok(starts.every(row=>row.sha256&&Math.abs(row.duration-24)<0.2));assert.deepEqual(report.browserErrors,[]);
 report.twoInterruptedRequestsRecovered=true;report.pairingPreserved=true;report.noPrematurePlaybackRestart=true;report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.message.slice(0,1500);throw error;}finally{
 await original?.close();await context?.close();report.finishedAt=new Date().toISOString();
 writeFileSync('execution/evidence/sync-binary-installation-continuity.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,installation:report.installation,media:report.media,error:report.error}));
}
