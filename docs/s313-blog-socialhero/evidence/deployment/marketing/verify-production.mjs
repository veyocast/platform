/** Read-only production evidence; no sign-in, credentials or publication. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const expectedRevision='67d8470198acec4272c47c4c7979b6071a915c4b';
const productionJob='43456528973';
const origin='https://veyocast.nl';
const directory=dirname(fileURLToPath(import.meta.url));
const browserExecutable='/home/codex/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell';
const sha=(value)=>createHash('sha256').update(value).digest('hex');
const report={kind:'read-only-real-production-http-and-browser-verification',expectedRevision,productionJob,rootConfirmedJobComplete:false,startedAtUtc:new Date().toISOString(),command:'S313_PRODUCTION_JOB_COMPLETE=43456528973 TMPDIR=/dev/shm/s313-marketing-production-browser node docs/s313-blog-socialhero/evidence/deployment/marketing/verify-production.mjs',health:[],http:[],browser:[],assertions:[],failures:[]};
let browser;
async function request(url){const r=await fetch(url,{method:'GET',redirect:'manual',headers:{'User-Agent':'SocialHeroBlogPublisher/1.0'},signal:AbortSignal.timeout(8000)});const reader=r.body?.getReader();const parts=[];let size=0;if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2097152){await reader.cancel();throw new Error('BODY_LIMIT');}parts.push(value);}return {response:r,body:Buffer.concat(parts).toString()};}
function attrs(tag){return Object.fromEntries([...tag.matchAll(/([\w:-]+)=["']([^"']*)["']/gu)].map(m=>[m[1].toLowerCase(),m[2]]));}
const clean=s=>(s??'').replace(/<[^>]*>/gu,' ').replace(/\s+/gu,' ').trim();
function htmlMetadata(body){const metas=[...body.matchAll(/<meta\s+[^>]+>/gu)].map(m=>attrs(m[0]));const links=[...body.matchAll(/<link\s+[^>]+>/gu)].map(m=>attrs(m[0]));return {title:clean(/<title[^>]*>([\s\S]*?)<\/title>/u.exec(body)?.[1]),h1:[...body.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gu)].map(m=>clean(m[1])),canonicals:links.filter(x=>x.rel==='canonical').map(x=>x.href),robots:metas.filter(x=>x.name==='robots'),publicationMarkers:metas.filter(x=>x.name?.startsWith('socialhero:')),openGraph:metas.filter(x=>['og:url','og:type','og:image','og:image:width','og:image:height'].includes(x.property)),hasSharedHeader:body.includes('mk-header'),hasBlogLink:/href=["']\/blog["']/u.test(body),hasEmptyBlogText:body.includes('Hier staan nog geen artikelen.')};}
async function probe(url){const {response:r,body}=await request(url);const contentType=r.headers.get('content-type')??'';const row={url,status:r.status,contentType,location:r.headers.get('location'),cacheControl:r.headers.get('cache-control'),xRobotsTag:r.headers.get('x-robots-tag'),bodySha256:sha(body)};if(contentType.includes('json')){const parsed=JSON.parse(body);row.json=Object.fromEntries(Object.entries(parsed).filter(([key])=>['status','service','environment','revision','error'].includes(key)));}if(contentType.includes('text/html'))row.html=htmlMetadata(body);if(contentType.includes('xml'))row.sitemap={urls:[...body.matchAll(/<loc>([^<]+)<\/loc>/gu)].map(m=>m[1])};return row;}
async function check(name,work){try{await work();report.assertions.push({name,status:'passed'});}catch(e){report.failures.push({name,code:e.code??e.name,message:e.message.slice(0,600)});}}
try{
 for(const url of [origin+'/api/health','https://control.veyocast.nl/api/health','https://player.veyocast.nl/healthz'])report.health.push(await probe(url));
 report.rootConfirmedJobComplete=process.env.S313_PRODUCTION_JOB_COMPLETE===productionJob;
 if(!report.rootConfirmedJobComplete||!report.health.every(r=>r.status===200&&r.json?.revision===expectedRevision&&r.json?.environment==='production'&&r.json?.status==='ok')){
  console.log(JSON.stringify({status:'standby',rootConfirmedJobComplete:report.rootConfirmedJobComplete,health:report.health.map(r=>({url:r.url,status:r.status,revision:r.json?.revision}))}));process.exitCode=2;
 }else{
  for(const path of ['/','/blog','/sitemap.xml','/api/socialhero/v1/capabilities','/blog/s313-unpublished-does-not-exist'])report.http.push(await probe(origin+path));
  for(const path of ['/login','/platform','/dashboard','/platform/blog','/api/platform/blog'])report.http.push(await probe('https://control.veyocast.nl'+path));
  const at=url=>report.http.find(x=>x.url===url);
  await check('homepage-canonical-shell-and-indexability',()=>{const row=at(origin+'/');assert.equal(row.status,200);assert.deepEqual(row.html.canonicals,[origin]);assert.equal(row.html.h1.length,1);assert.equal(row.html.hasSharedHeader,true);assert.equal(row.html.hasBlogLink,true);assert.ok(row.html.robots.some(r=>r.content==='index, follow'));});
  await check('new-blog-canonical-production-metadata-and-empty-state',()=>{const row=at(origin+'/blog');assert.equal(row.status,200);assert.equal(row.html.title,'Blog over ClubTV en narrowcasting | VeyoCast');assert.deepEqual(row.html.h1,['Het VeyoCast-blog']);assert.deepEqual(row.html.canonicals,[origin+'/blog']);assert.equal(row.html.hasSharedHeader,true);assert.ok(row.html.robots.every(r=>!r.content.includes('noindex')));assert.equal(row.html.hasEmptyBlogText,true);});
  await check('sitemap-includes-blog-and-retains-existing-urls',async()=>{const row=at(origin+'/sitemap.xml');assert.equal(row.status,200);assert.ok(row.sitemap.urls.includes(origin+'/blog'));const before=JSON.parse(await readFile(join(directory,'baseline.json'),'utf8')).results.find(x=>x.url===origin+'/sitemap.xml').sitemap.urls;assert.ok(before.every(url=>row.sitemap.urls.includes(url)));assert.equal(row.sitemap.urls.some(url=>url.includes('s313-')||url.includes('worker-acceptatie')),false);});
  await check('socialhero-api-rejects-anonymous-json',()=>{const row=at(origin+'/api/socialhero/v1/capabilities');assert.equal(row.status,401);assert.ok(row.contentType.includes('json'));assert.equal(row.json.error.code,'INVALID_CREDENTIAL');});
  await check('unknown-unpublished-article-stays-private',()=>assert.equal(at(origin+'/blog/s313-unpublished-does-not-exist').status,404));
  await check('control-login-and-protected-routes',()=>{assert.equal(at('https://control.veyocast.nl/login').status,200);for(const path of ['/platform','/dashboard','/platform/blog']){const row=at('https://control.veyocast.nl'+path);assert.equal(row.status,307);assert.ok(row.location?.startsWith('/login?'));}const api=at('https://control.veyocast.nl/api/platform/blog');assert.equal(api.status,403);assert.ok(api.contentType.includes('json'));assert.equal(api.json.error.code,'PERMISSION_DENIED');});
  await mkdir(process.env.TMPDIR??'/dev/shm/s313-marketing-production-browser',{recursive:true,mode:0o700});
  browser=await chromium.launch({headless:true,executablePath:browserExecutable});
  const context=await browser.newContext({locale:'nl-NL',reducedMotion:'reduce'});
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:844}])for(const route of ['home','blog']){
   const page=await context.newPage();await page.setViewportSize(viewport);const errors=[],consoleErrors=[],failedRequests=[],failedResponses=[];
   page.on('pageerror',e=>errors.push({name:e.name,message:e.message}));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText}));page.on('response',r=>{if(r.status()>=400)failedResponses.push({url:r.url(),status:r.status()});});
   const url=origin+(route==='home'?'/':'/blog');const response=await page.goto(url,{waitUntil:'networkidle',timeout:20000});assert.equal(response?.status(),200);
   await page.evaluate(async()=>{await document.fonts.ready;for(const image of document.images)image.loading='eager';await Promise.all([...document.images].map(image=>image.decode().catch(()=>undefined)));});
   const measured=await page.evaluate(()=>({viewport:{width:innerWidth,height:innerHeight},overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,h1:[...document.querySelectorAll('h1')].map(x=>x.textContent?.trim()),headerCount:document.querySelectorAll('header.mk-header').length,footerCount:document.querySelectorAll('footer.mk-footer').length,canonicals:[...document.querySelectorAll('link[rel="canonical"]')].map(x=>x.getAttribute('href')),robots:[...document.querySelectorAll('meta[name="robots"]')].map(x=>x.getAttribute('content')),imageCount:document.images.length,brokenImages:[...document.images].filter(x=>!x.complete||!x.naturalWidth).map(x=>x.getAttribute('src'))}));
   const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();const name='production-'+route+'-'+viewport.width+'.png';const png=await page.screenshot({path:join(directory,name),fullPage:true,animations:'disabled'});
   await page.keyboard.press('Tab');const skip=page.getByRole('link',{name:'Direct naar inhoud'});const keyboard={skipFocused:await skip.evaluate(e=>document.activeElement===e),hash:null};await page.keyboard.press('Enter');keyboard.hash=await page.evaluate(()=>location.hash);keyboard.targetTag=await page.evaluate(()=>document.querySelector(location.hash)?.tagName??null);
   const row={url,route,viewport,screenshot:name,sha256:sha(png),...measured,pageErrors:errors,consoleErrors,failedRequests,failedResponses,axeViolations:axe.violations,keyboard};report.browser.push(row);
   await check(route+'-'+viewport.width+'-browser-health-reflow-keyboard-and-a11y',()=>{assert.equal(row.overflow,0);assert.equal(row.headerCount,1);assert.equal(row.footerCount,1);assert.equal(row.h1.length,1);assert.deepEqual(row.brokenImages,[]);assert.deepEqual(row.pageErrors,[]);assert.deepEqual(row.consoleErrors,[]);assert.deepEqual(row.failedRequests,[]);assert.deepEqual(row.failedResponses,[]);assert.deepEqual(row.axeViolations,[]);assert.equal(row.keyboard.skipFocused,true);assert.equal(row.keyboard.hash,route==='home'?'#main':'#main-content');assert.equal(row.keyboard.targetTag,'MAIN');});
   await page.close();
  }
  await context.close();report.completedAtUtc=new Date().toISOString();report.status=report.failures.length?'failed':'passed';
  report.scope={realProduction:true,credentialSubmission:false,contentWrites:false,configurationWrites:false,authenticatedEditorFlow:false,publishedArticleMetadata:false,publishedArticleReason:'No content publication is authorized by this read-only verification; index is expected to be empty.'};
  await writeFile(join(directory,'after-production.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,assertions:report.assertions.length,failures:report.failures,screenshots:report.browser.length,report:'docs/s313-blog-socialhero/evidence/deployment/marketing/after-production.json'}));if(report.failures.length)process.exitCode=1;
 }
}catch(e){report.status='failed';report.failures.push({name:'probe-execution',code:e.code??e.name,message:e.message.slice(0,600)});await writeFile(join(directory,'after-production.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'failed',failures:report.failures}));process.exitCode=1;}finally{if(browser)await browser.close();}
