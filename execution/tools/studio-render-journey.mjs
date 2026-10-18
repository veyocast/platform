if(process.env.VEYOCAST_S226_LOCAL_ACCEPTANCE!=='1')throw Error('Set the explicit isolated S226 acceptance gate before running this archived journey');
import {chromium,expect as check} from '/home/codex/repos/castivo-s226/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const expect=check.configure({timeout:30000});
const db='supabase_db_veyocast-s226';const base='http://127.0.0.1:3220';
function sql(statement){return execFileSync('docker',['exec',db,'psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1','-c',statement],{encoding:'utf8',timeout:15000}).trim();}
if(sql("select current_database()")!=='postgres')throw Error('Disposable database required');
const b=await chromium.launch();const c=await b.newContext({storageState:'/tmp/veyocast-s226-qa-auth-state.json',reducedMotion:'reduce',viewport:{width:1440,height:1000}});
await c.addCookies([{name:'veyocast-tenant-context',value:'duindorp-sites-local-qa',url:base,httpOnly:true,sameSite:'Lax'}]);const p=await c.newPage();
const name='S226 Studio '+Date.now();const title='Deze Studio-publicatie is echt gerenderd';const report={scope:'isolated-local-real-studio-worker',name,title,api:'http://127.0.0.1:57621'};
function project(){const data=sql(`select jsonb_build_object('projectId',p.id,'projectRevision',p.revision,'draftRevision',d.draft_revision,'title',d.document_json#>>'{sitesPresentation,slide,title}')from public.studio_projects p join public.studio_project_drafts d on d.tenant_id=p.tenant_id and d.project_id=p.id where p.tenant_id='19170000-0000-4000-8000-000000000010' and p.name='${name}' limit 1`);return data?JSON.parse(data):{};}
try{
 await p.goto(base+'/dashboard/studio/new?family=free',{timeout:120000});if(!p.url().startsWith(base+'/dashboard/studio/'))throw Error('Live Studio authentication required');
 await p.getByLabel('Ontwerpnaam',{exact:true}).fill(name);await p.getByRole('button',{name:'Volgende',exact:true}).click();
 const choice=p.getByRole('radio',{name:/Welkom bij de club/}).first();await choice.locator('..').click();await expect(choice).toBeChecked();await p.getByRole('button',{name:'Volgende',exact:true}).click();await p.getByRole('button',{name:'Volgende',exact:true}).click();await p.getByRole('button',{name:'Ontwerp maken',exact:true}).click();await expect(p).toHaveURL(/\/dashboard\/studio\/[a-f0-9-]{36}$/);
 await p.getByLabel('Titel',{exact:true}).fill(title);await p.getByRole('button',{name:'Opslaan',exact:true}).click();await expect.poll(()=>project().title).toBe(title);report.draft=project();console.log('Studio draft persisted through UI');
 await p.getByRole('button',{name:'Gebruiken',exact:true}).click();await expect.poll(()=>Number(sql(`select count(*)from public.studio_render_jobs where project_id='${report.draft.projectId}' and status='queued'`))).toBe(1);
 const result=execFileSync('pnpm',['--filter','@veyocast/media-worker','exec','tsx','/home/codex/repos/castivo-s226/execution/tools/render-one-local-studio.mts'],{cwd:'/home/codex/repos/castivo-s226',env:{...process.env,CHROMIUM_EXECUTABLE_PATH:chromium.executablePath()},encoding:'utf8',timeout:240000,maxBuffer:1024*1024});
 const rendered=JSON.parse(result.trim().split('\n').at(-1));expect(rendered.status).toBe('completed');report.rendered=rendered;
 const metadata=JSON.parse(sql(`select jsonb_build_object('assetId',a.id,'title',a.title,'status',a.status,'width',a.width,'height',a.height,'variants',(select jsonb_agg(jsonb_build_object('type',v.variant_type,'sha256',v.checksum_sha256,'bytes',v.file_size_bytes,'mime',v.mime_type))from public.media_variants v where v.tenant_id=a.tenant_id and v.asset_id=a.id))from public.media_assets a where a.id='${rendered.mediaAssetId}' and a.tenant_id='19170000-0000-4000-8000-000000000010'`));
 expect(metadata.status).toBe('ready');expect(metadata.width).toBe(1920);expect(metadata.height).toBe(1080);report.media=metadata;
 await expect(p.getByText('De definitieve media is gereed en geverifieerd. Open Media om deze te gebruiken.',{exact:true})).toBeVisible({timeout:30000});await p.screenshot({path:'/home/codex/repos/castivo-s226/execution/evidence/studio-real-worker-ready.png',fullPage:true});
 fs.writeFileSync('/home/codex/repos/castivo-s226/execution/evidence/studio-real-worker.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await b.close();}
