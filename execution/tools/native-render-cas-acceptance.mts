import assert from "node:assert/strict";
import {createHash, randomUUID} from "node:crypto";
import {readFileSync, writeFileSync, statSync, existsSync} from "node:fs";
import {createRequire} from "node:module";
import {updateSyncStudioDocument} from "../../packages/studio/src/sync";
let phase="guard";
async function run(){
 assert.equal(process.env.VEYOCAST_S227_LOCAL_ACCEPTANCE,"1");assert.equal(process.cwd(),"/home/codex/repos/castivo-s227");
 const configPath="/home/codex/.local/state/veyocast-s226/local-status.json",statePath="/tmp/veyocast-s226-qa-auth-state.json",checkpointPath="/tmp/veyocast-s227-render-cas-checkpoint.json";
 for(const path of[configPath,statePath])assert.equal(statSync(path).mode&0o777,0o600);
 const config=JSON.parse(readFileSync(configPath,"utf8")),state=JSON.parse(readFileSync(statePath,"utf8"));assert.equal(config.API_URL,"http://127.0.0.1:57621");
 const {createServerClient}=createRequire(`${process.cwd()}/apps/control/package.json`)("@supabase/ssr");
 const cookies=new Map(state.cookies.map((cookie:{name:string})=>[cookie.name,cookie]));
 const auth=createServerClient(config.API_URL,config.ANON_KEY,{cookies:{getAll:()=>[...cookies.values()],setAll:(values:Array<{name:string}>)=>values.forEach(cookie=>cookies.set(cookie.name,cookie))}});
 assert.equal((await auth.auth.getUser()).data.user?.id,"19170000-0000-4000-8000-000000000001");assert.equal((await auth.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,"aal2");
 const tenantId="19170000-0000-4000-8000-000000000010", token=(await auth.auth.getSession()).data.session?.access_token;assert.ok(typeof token==="string");
 const headers={Authorization:`Bearer ${token}`,"X-VeyoCast-Tenant-Id":tenantId,"Content-Type":"application/json"},endpoint="http://127.0.0.1:3250/api/mobile/v3/studio";
 async function request(url:string,command?:unknown){const r=await fetch(url,{headers,method:command?"POST":"GET",...(command?{body:JSON.stringify(command)}:{}),signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);return(await r.json()).data;}
 const projectId=JSON.parse(readFileSync("execution/evidence/native-mfa-real-services.json","utf8")).projectId;
 const existed=existsSync(checkpointPath);if(existed)assert.equal(process.env.VEYOCAST_S227_RESUME,"1");
 phase="current-draft";const original=(await request(`${endpoint}?projectId=${projectId}`)).projects[0];
 const checkpoint=existed?JSON.parse(readFileSync(checkpointPath,"utf8")):{oldRevision:original.draftRevision,save:{operation:"save",projectId,expectedDraftRevision:original.draftRevision,document:updateSyncStudioDocument(original.document,{...original.document.syncPresentation,style:{...original.document.syncPresentation.style,motion:"rustig"}}),idempotencyKey:randomUUID()},render:{operation:"render",projectId,expectedDraftRevision:original.draftRevision,outputKind:"png",idempotencyKey:randomUUID()}};
 assert.ok(!checkpoint.completed,"Completed acceptance is single-use");const persist=()=>writeFileSync(checkpointPath,JSON.stringify(checkpoint),{mode:0o600});persist();
 const count=async()=>{const r=await auth.from("studio_render_jobs").select("id",{count:"exact",head:true}).eq("tenant_id",tenantId).eq("project_id",projectId);assert.ok(!r.error);return r.count;};
 const history=async()=>{const r=await auth.from("playlist_releases").select("id,playlist_id,version").eq("tenant_id",tenantId).order("id");assert.ok(!r.error);return createHash("sha256").update(JSON.stringify(r.data)).digest("hex");};
 const jobsBefore=await count(),historyBefore=await history();phase="concurrent-motion-save";
 const saved=await request(endpoint,checkpoint.save);assert.equal(saved.outcome,"saved");assert.equal(saved.draftRevision,checkpoint.oldRevision+1);
 phase="stale-render";const started=performance.now(),conflict=await request(endpoint,checkpoint.render),ms=Math.round(performance.now()-started);
 assert.equal(conflict.outcome,"conflict");assert.equal(conflict.draftRevision,saved.draftRevision);assert.equal(conflict.renderJobId,null);
 const current=(await request(`${endpoint}?projectId=${projectId}`)).projects[0];assert.equal(current.document.motion.enabled,true);assert.equal(current.draftRevision,saved.draftRevision);
 const jobsAfter=await count();assert.equal(jobsAfter,jobsBefore);assert.equal(await history(),historyBefore);
 const evidence={status:"PASS",checkedAt:new Date().toISOString(),scope:"Actual local AAL2 V3 HTTP and original PostgreSQL render RPC; no installed native/hardware claim",projectId,oldRevision:checkpoint.oldRevision,currentRevision:saved.draftRevision,concurrentMotionEnabled:true,stalePngRenderOutcome:conflict.outcome,staleRenderMilliseconds:ms,newJobs:jobsAfter-jobsBefore,immutablePublicationHistoryUnchanged:true,sourceSha256:createHash("sha256").update(readFileSync("apps/control/lib/mobile/studio-v3.ts")).digest("hex")};writeFileSync("execution/evidence/native-render-cas-real-services.json",JSON.stringify(evidence,null,2)+"\n");checkpoint.completed=true;persist();process.stdout.write(JSON.stringify(evidence)+"\n");
}
run().catch(()=>{process.stderr.write(`LOCAL_NATIVE_RENDER_CAS_FAILED phase=${phase}; protected checkpoint retained\n`);process.exitCode=1;});
