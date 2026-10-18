import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {chromium,expect as playwrightExpect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

assert.equal(process.env.VEYOCAST_S226_LOCAL_ACCEPTANCE,'1');assert.equal(process.cwd(),'/home/codex/repos/castivo-s226');
const expect=playwrightExpect.configure({timeout:30000}),base='http://127.0.0.1:3220',tenant='19170000-0000-4000-8000-000000000010',project='dd38316c-63b4-4a60-9d8c-3b8211de00ce',container='supabase_db_veyocast-s226';
const auth='/tmp/veyocast-s226-qa-auth-state.json',checkpoint='/tmp/veyocast-s226-background-journey.json';for(const file of [auth,'/tmp/veyocast-s226-local-status.json'])assert.equal(statSync(file).mode&0o777,0o600);
const cfg=JSON.parse(readFileSync('/tmp/veyocast-s226-local-status.json'));assert.equal(cfg.API_URL,'http://127.0.0.1:57621');assert.equal(new URL(cfg.DB_URL).port,'57622');assert.equal(execFileSync('docker',['inspect','--format','{{.Name}} {{ index .Config.Labels "com.supabase.cli.project" }}',container],{encoding:'utf8'}).trim(),'/'+container+' veyocast-s226');
const sql=query=>execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
assert.equal(sql(`select name from public.studio_projects where tenant_id='${tenant}' and id='${project}'`),'S226 echt aangemaakt in Sync');
const draft=()=>JSON.parse(sql(`select jsonb_build_object('revision',draft_revision,'presentation',document_json->'syncPresentation') from public.studio_project_drafts where tenant_id='${tenant}' and project_id='${project}'`));
const beforeReleases=sql(`select coalesce(jsonb_agg(jsonb_build_object('id',id,'hash',manifest_hash) order by id),'[]') from public.playlist_releases where tenant_id='${tenant}'`);
const state=existsSync(checkpoint)?JSON.parse(readFileSync(checkpoint)):{title:'S226 achtergrond '+Date.now()};assert.match(state.title,/^S226 achtergrond \d+$/);const save=()=>writeFileSync(checkpoint,JSON.stringify(state),{mode:0o600});save();
const require=createRequire(process.cwd()+'/apps/control/package.json'),sharp=require('sharp'),{createServerClient}=require('@supabase/ssr');
const bytes=await sharp({create:{width:320,height:180,channels:3,background:{r:32,g:89,b:108}}}).png().toBuffer();
const browser=await chromium.launch(),context=await browser.newContext({storageState:auth,ignoreHTTPSErrors:true,reducedMotion:'reduce',viewport:{width:1440,height:1050}});context.setDefaultTimeout(30000);await context.addCookies([{name:'veyocast-tenant-context',value:'duindorp-sites-local-qa',url:base,httpOnly:true,sameSite:'Lax'}]);const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
const report={status:'RUNNING',startedAt:new Date().toISOString(),scope:'actual local AAL2 Source editor → image-upload validation/private Storage → save/authenticated readback/reload',projectId:project};
try{
  await page.goto(base+'/dashboard/studio/'+project,{waitUntil:'domcontentloaded',timeout:120000});await expect(page.getByLabel('Ontwerpnaam',{exact:true})).toHaveValue('S226 echt aangemaakt in Sync');await page.getByRole('button',{name:'Vormgeving',exact:true}).click();
  if(!state.assetId){
    const known=JSON.parse(sql(`select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status)),'[]') from public.media_assets where tenant_id='${tenant}' and title='${state.title}'`));assert.ok(known.length<=1,'A unique owned upload is required');
    if(known.length){assert.equal(known[0].status,'ready');state.assetId=known[0].id;save();}
  }
  if(!state.uploadStarted){
    await page.getByRole('button',{name:'Strepen',exact:true}).click();await page.getByLabel('Lettertype',{exact:true}).selectOption('Arial');
    if(draft().presentation.style.background!=='stripes'||draft().presentation.style.font!=='Arial'){
      await page.getByRole('button',{name:'Opslaan',exact:true}).click();await expect(page.getByText(/is veilig opgeslagen\./).first()).toBeVisible();
    }
    const options=draft();assert.equal(options.presentation.style.background,'stripes');assert.equal(options.presentation.style.font,'Arial');report.sourceOptionsSaved={revision:options.revision,background:'stripes',font:'Arial'};
    state.uploadStarted=true;save();
    const acknowledgement=page.waitForResponse(response=>response.url().endsWith('/api/media/images')&&response.request().method()==='POST',{timeout:120000});acknowledgement.catch(()=>{});
    await page.getByLabel('Achtergrond uploaden',{exact:true}).setInputFiles({name:state.title+'.png',mimeType:'image/png',buffer:bytes});
    const response=await acknowledgement;assert.equal(response.status(),201);const receipt=await response.json();assert.equal(receipt.ok,true);state.assetId=receipt.data.assetId;save();
    await expect(page.getByText('Je achtergrond is gecontroleerd en geselecteerd. Bewaar je ontwerp om de keuze vast te leggen.',{exact:true})).toBeVisible({timeout:45000});
  }else{
    assert.ok(state.assetId,'An earlier unknown upload must be reconciled before another upload is attempted');
    if(draft().presentation.style.backgroundAsset?.mediaAssetId!==state.assetId){
      await page.getByText('Clubbeelden en achtergrond',{exact:true}).click();await page.getByLabel('Achtergrondfoto',{exact:true}).selectOption(state.assetId);
    }
  }
  assert.match(state.assetId,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  if(draft().presentation.style.backgroundAsset?.mediaAssetId!==state.assetId){await page.getByRole('button',{name:'Opslaan',exact:true}).click();await expect.poll(()=>draft().presentation.style.backgroundAsset?.mediaAssetId).toBe(state.assetId);}
  const snapshot=await context.storageState(),client=createServerClient(cfg.API_URL,cfg.ANON_KEY,{cookies:{getAll:()=>snapshot.cookies,setAll:()=>{}}});assert.equal((await client.auth.getUser()).data.user?.id,'19170000-0000-4000-8000-000000000001');assert.equal((await client.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,'aal2');
  const asset=await client.from('media_assets').select('id,tenant_id,title,status,kind').eq('tenant_id',tenant).eq('id',state.assetId).single();assert.equal(asset.error,null);assert.equal(asset.data.status,'ready');assert.equal(asset.data.title,state.title);
  const variant=await client.from('media_variants').select('storage_path,checksum_sha256,file_size_bytes').eq('tenant_id',tenant).eq('asset_id',state.assetId).eq('variant_type','original').single();assert.equal(variant.error,null);assert.ok(variant.data.storage_path.startsWith('tenants/'+tenant+'/assets/'+state.assetId+'/'));
  const download=await client.storage.from('tenant-media').download(variant.data.storage_path);assert.equal(download.error,null);const downloaded=Buffer.from(await download.data.arrayBuffer());assert.equal(downloaded.length,Number(variant.data.file_size_bytes));assert.equal(createHash('sha256').update(downloaded).digest('hex'),variant.data.checksum_sha256);
  const current=await client.from('studio_project_drafts').select('draft_revision,document_json').eq('tenant_id',tenant).eq('project_id',project).single();assert.equal(current.error,null);assert.equal(current.data.document_json.syncPresentation.style.backgroundAsset.mediaAssetId,state.assetId);assert.equal(current.data.document_json.syncPresentation.style.backgroundAsset.checksumSha256,variant.data.checksum_sha256);assert.equal(current.data.document_json.syncPresentation.style.font,'Arial');
  await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Vormgeving',exact:true}).click();await page.getByText('Clubbeelden en achtergrond',{exact:true}).click();await expect(page.getByLabel('Achtergrondfoto',{exact:true})).toHaveValue(state.assetId);await expect(page.getByLabel('Lettertype',{exact:true})).toHaveValue('Arial');await expect(page.getByRole('button',{name:'Opslaan',exact:true})).toBeDisabled();
  const scan=await new AxeBuilder({page}).analyze();assert.deepEqual(scan.violations,[]);report.axeViolations=0;report.widths=[];for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:1050});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert.ok(overflow<=1);report.widths.push({width,overflow});}await page.screenshot({path:'execution/evidence/sync-editor-background-real-services.png',fullPage:true});
  assert.equal(sql(`select coalesce(jsonb_agg(jsonb_build_object('id',id,'hash',manifest_hash) order by id),'[]') from public.playlist_releases where tenant_id='${tenant}'`),beforeReleases);assert.deepEqual(errors,[]);
  report.asset={id:state.assetId,sha256:variant.data.checksum_sha256,bytes:downloaded.length,kind:asset.data.kind,status:asset.data.status};report.draftRevision=current.data.draft_revision;report.privateStorageVerified=true;report.reopenedSameAsset=true;report.existingReleasesUnchanged=true;report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.message.slice(0,1500);report.pageErrors=errors;await page.screenshot({path:'/tmp/veyocast-s226-background-journey-failure.png',fullPage:true}).catch(()=>{});throw error;
}finally{await context.storageState({path:auth});await browser.close();writeFileSync('execution/evidence/sync-editor-background-real-services.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
