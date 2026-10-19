import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {expect,test,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {compileResponsive,respTenant} from '../helpers/control-responsive-fixture';

const enabled=process.env.VEYOCAST_SYNC_SOURCE_COMPARISON==='1';
const sourceOrigin=process.env.VEYOCAST_SYNC_REFERENCE_ORIGIN??'http://127.0.0.1:4194';
if(!['127.0.0.1','localhost'].includes(new URL(sourceOrigin).hostname))throw Error('Source comparison must use the local immutable runtime');
const sourceRevision='8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a';
// A second, explicitly counterfactual measurement isolates the existing higher
// 44px touch canon. Raw production measurements/screenshots remain unchanged.
// Only the listed hit-area dimensions and their required header gap are restored;
// no unrelated color, font or per-route geometry is normalized.
const touchComparisonCss=`
.sync-control.app-shell :is(.btn,.vc-button){min-height:41px!important}
.sync-control.app-shell :is(.btn-small,.vc-button--sm){min-height:32px!important}
.sync-control .vc-library-search button:not(.sr-only):not(.sync-sr-only){min-height:32px!important;height:32px!important;width:32px!important}
.sync-control .topbar .sync-topbar-icon{width:35px!important;height:35px!important;min-height:35px!important;margin-inline:0!important}
.sync-control .vx-account.sync-avatar-trigger{width:34px!important;min-width:34px!important;height:34px!important;min-height:34px!important;margin-inline:0!important;padding:0!important}
.sync-control .vx-search.search-trigger{min-height:0!important}
@media(max-width:760px){
 .sync-control .vx-header.topbar{gap:10px!important}
 .sync-control .vx-search.search-trigger{min-width:0!important}
 .sync-control .vx-bottomnav{height:auto!important}
 .sync-control .mobile-bottom a{min-height:0!important;min-width:0!important;justify-content:normal!important}
}`;
const output=process.env.VEYOCAST_SYNC_RESP_OUTPUT??'/tmp/veyocast-sync-responsive';
const readbacks:Record<string,unknown>[]=[];
let bundle:{js:string;css:string},styles:string;
let comparisonFingerprint:string;
const assets=new Map<string,{bytes:Buffer;mimeType:string}>();
const routeMap:Record<string,{current:string;source:string;filter?:string;scope?:string}>={
 '/dashboard':{current:'/dashboard',source:'overview'},
 '/dashboard/playlists':{current:'/dashboard/playlists',source:'playlists'},
 '/dashboard/media':{current:'/dashboard/content',source:'content',filter:'media'},
 '/dashboard/studio':{current:'/dashboard/content',source:'content'},
 '/dashboard/screens':{current:'/dashboard/screens',source:'screens'},
 '/dashboard/planning':{current:'/dashboard/planning',source:'planning'},
 '/dashboard/settings':{current:'/dashboard/settings',source:'sources',scope:'Retained Settings has no chosen Source route. This case verifies its responsive shell, assets, overflow and accessibility; content parity is N_A and functional acceptance is separate.'},
 '/dashboard/team':{current:'/dashboard/team',source:'team'},
 '/dashboard/support':{current:'/dashboard/support',source:'support'},
 '/dashboard/sources':{current:'/dashboard/sources',source:'sources'},
 '/website':{current:'/website',source:'marketing'},
};
function originalRows(){
 const text=readFileSync('docs/sites-v11-overname/inventory/VISUAL-CASES.csv','utf8'),rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const char=text[i];if(char==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(char===','&&!quoted){row.push(cell);cell='';}else if(char==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=char;}
 const headers=rows.shift()!;const cases=rows.filter(row=>row.length===headers.length).map(row=>Object.fromEntries(headers.map((header,index)=>[header,row[index]!]))).filter(row=>row.case_id.startsWith('RESP-'));
 if(cases.length!==66||new Set(cases.map(row=>row.case_id)).size!==66)throw Error('All 66 original responsive IDs must remain');return cases;
}
test.beforeAll(()=>{
 if(!enabled)return;
 bundle=compileResponsive({chosenSync:true});
 styles=['tokens/veyocast-design-tokens.css','packages/ui/src/styles.css','apps/control/app/globals.css','apps/control/app/fieldflow.css','apps/control/app/sync-source.css','apps/control/app/sync-adapter.css'].map(path=>readFileSync(path,'utf8').replace(/@import[^;]+;/g,'')).join('\n');
 comparisonFingerprint=createHash('sha256').update(bundle.js).update(bundle.css).update(styles).update(readFileSync('tests/control/sync-source-geometry-comparison.spec.ts')).update(readFileSync('tests/helpers/sync-reference-runtime.mjs')).digest('hex');
 const manifest=JSON.parse(readFileSync('docs/sync-v1-rebuild/handoff/manifests/sites-files.json','utf8')) as {files:Array<{path:string;sha256:string;bytes:number}>};
 const mime:Record<string,string>={webp:'image/webp',png:'image/png',svg:'image/svg+xml',woff2:'font/woff2',ttf:'font/ttf'};
 for(const file of manifest.files){const prefix='reference/sites-sync/public/';if(!file.path.startsWith(prefix))continue;const type=mime[file.path.split('.').at(-1)!];if(!type)continue;const url='/'+file.path.slice(prefix.length),bytes=readFileSync('apps/control/public'+url);expect(bytes.length).toBe(file.bytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);assets.set(url,{bytes,mimeType:type});}
});
test.afterAll(()=>{if(!enabled)return;mkdirSync(output,{recursive:true});const metadata=join(output,'case-readback.json'),merged=new Map<string,Record<string,unknown>>();try{const prior=JSON.parse(readFileSync(metadata,'utf8'));if(prior.assertionVersion==='s226-sync-responsive-v4'&&prior.comparisonFingerprint===comparisonFingerprint)for(const row of prior.results)merged.set(row.caseId,row);}catch{/* First complete chosen Source cohort. */}for(const row of readbacks)merged.set(row.caseId as string,row);writeFileSync(metadata,JSON.stringify({schemaVersion:1,assertionVersion:'s226-sync-responsive-v4',comparisonFingerprint,sourceRevision,sourceFilesUnchanged:true,fixture:'Explicit empty owned read models; actual production JSX/CSS. Aliases map old Media/Studio inventory to the chosen unified Content flow; original IDs/viewport set retained.',routeMap,scope:'Individual Source geometry, typography, navigation, loaded assets and overflow. Recorded differences are not pixel PASS, provider, authorization or hardware evidence.',results:[...merged.values()]},null,2)+'\n');});
async function warmPublicImages(page:Page){
 await page.evaluate(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=innerHeight){window.scrollTo(0,y);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}await Promise.all([...document.images].map(image=>image.decode().catch(()=>undefined)));window.scrollTo(0,0);});
}
async function measure(page:Page){
 await page.evaluate(async()=>{await Promise.all([document.fonts.load('14px Manrope'),document.fonts.load('14px Inter')]);await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
 return page.evaluate(()=>{
  const visible=(element:Element)=>{const rect=element.getBoundingClientRect();return rect.width>1&&rect.height>1&&element.checkVisibility({checkVisibilityCSS:true});};
  const read=(element:Element)=>{const r=element.getBoundingClientRect(),s=getComputedStyle(element);return{x:r.x,y:r.y,width:r.width,height:r.height,padding:s.padding,font:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,letterSpacing:s.letterSpacing,fontVariation:s.fontVariationSettings,fontFeatures:s.fontFeatureSettings,lineHeight:s.lineHeight,gap:s.gap,minHeight:s.minHeight,display:s.display,boxSizing:s.boxSizing};};
  const selectors=['.nav-panel','.nav-panel .brand','.nav-panel .brand-button','.nav-panel .workspace-button','.nav-panel .main-nav .nav-link','.topbar','.topbar .avatar-button','.main-content','.mobile-bottom','.section-header','.section-header :is(.btn,.vc-button)','.vc-library-toolbar','.vc-filter-tabs','.vc-library-search','.vc-library-search button','.vc-library-search input','.ov-screen-rows .empty','.ov-screen-rows .empty .btn','.px-calendar-toolbar','.ad-tabs','.mk-header','.mk-nav','.mk-hero'];
  return{overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),parts:Object.fromEntries(selectors.map(selector=>[selector,[...document.querySelectorAll(selector)].filter(visible).map(read)])),headings:[...document.querySelectorAll('.main-content h1,.main-content h2,.main-content h3')].filter(visible).map(element=>({text:element.textContent?.trim(),...read(element)})),active:[...document.querySelectorAll('.nav-link.active,.mobile-bottom .active')].filter(visible).map(element=>(element.querySelector('span')??element).textContent?.trim()),images:[...document.images].filter(visible).map(element=>({path:new URL(element.currentSrc||element.src,location.href).pathname,loaded:element.complete&&element.naturalWidth>0})),mobileTargets:[...document.querySelectorAll('.mobile-bottom :is(a,button)')].filter(visible).map(read)};
 });
}
for(const row of originalRows())test(`original ${row.case_id} chosen Sync ${row.viewport} ${row.reference_route}`,async({browser})=>{
 test.skip(!enabled,'Explicit immutable chosen Sync comparison required');test.setTimeout(60000);
 const route=routeMap[row.reference_route.slice(1)]!;expect(route).toBeTruthy();const[width,height]=row.viewport.split('x').map(Number);
 const context=await browser.newContext({viewport:{width,height},locale:'nl-NL',timezoneId:'Europe/Amsterdam',reducedMotion:'reduce'});
 const source=await context.newPage(),current=await context.newPage(),errors:string[]=[];
 try{
  for(const page of[source,current]){page.on('pageerror',error=>errors.push(error.message));await page.clock.install({time:new Date('2026-10-11T10:00:00Z')});}
  await source.addInitScript(({tenant})=>{const empty=Object.fromEntries(['content','playlists','screens','schedule','sources','products','sponsors','campaigns','polls','tickets','members','audit','releases','requests','events','notifications'].map(key=>[key,[]]));localStorage.setItem('veyocast-v1-design-lab-v3',JSON.stringify({...empty,tenants:[{id:tenant,name:'Duindorp SV',status:'active',screenLimit:8}],settings:{tenantId:tenant,tenantName:'Duindorp SV',timezone:'Europe/Amsterdam',defaultTheme:'fieldflow',sessionRole:'Eigenaar',menuPriceSnapshot:{},notifications:true,biometrics:false}}));},{tenant:respTenant});
  await source.goto(sourceOrigin+(route.source==='marketing'?'/':'/?design=sync&page='+route.source));
  if(route.filter)await source.getByRole('button',{name:'Foto’s & video’s',exact:true}).click();
  await current.route('**/assets/*',r=>{const asset=assets.get(new URL(r.request().url()).pathname);return asset?r.fulfill({body:asset.bytes,contentType:asset.mimeType}):r.fallback();});
  if(route.current==='/website')await current.goto(`http://127.0.0.1:${process.env.MARKETING_PORT??3318}/`);
  else{
   await current.route('**/__sync-comparison?*',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}\n${bundle.css}</style></head><body><div id="root"></div><script>${bundle.js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`}));
   await current.goto('http://127.0.0.1:3313/__sync-comparison?path='+encodeURIComponent(route.current)+(route.filter?'&filter='+route.filter:''));await expect(current.locator('#control-content')).toBeVisible();
  }
  if(route.current==='/website'){await warmPublicImages(source);await warmPublicImages(current);}
  let referenceState:Record<string,unknown>={kind:'original-route'};
  if(['sources','support'].includes(route.source)&&!route.scope&&await current.locator('.empty .sync-empty-title').count()){
   const empty=current.locator('.empty').filter({has:current.locator('.sync-empty-title')});
   const props={title:(await empty.locator('.sync-empty-title').textContent())!.trim(),description:(await empty.locator('p').textContent())!.trim(),icon:route.source==='sources'?'Plug':'MessageSquare'};
   await source.evaluate(props=>{const apply=(window as unknown as{__veyocastReferenceEmpty:(props:unknown)=>void}).__veyocastReferenceEmpty;if(typeof apply!=='function')throw Error('Explicit immutable EmptyState reference missing');apply(props);},props);
   referenceState={kind:'canonical-Source-EmptyState',component:'reference/sites-sync/src/ui.tsx:EmptyState',reason:'Prototype route omits its zero-row branch; use its unchanged shared empty component with truthful production status text.',props};
  }
  const a=await measure(source),production=await measure(current);
  mkdirSync(output,{recursive:true});await source.screenshot({path:join(output,row.case_id+'-source.png')});await current.screenshot({path:join(output,row.case_id+'-current.png')});
  const copyComparisons:Array<{selector:string;production:string;reference:string;reason:string}>=[];
  if(route.source==='sources'&&!route.scope){
   const selector='.ad-demo-label',production=(await current.locator(selector).textContent())!.trim(),reference=(await source.locator(selector).textContent())!.trim();
   expect(production).toBe('Opgeslagen bronstatus');expect(reference).toBe('Interactieve demo · geen externe verbindingen');
   copyComparisons.push({selector,production,reference,reason:'Startprompt explicitly replaces false prototype/demo claims with factual production status. Isolate only the resulting intrinsic text-width reflow; raw screenshot/metrics remain production.'});
   await current.locator(selector).evaluate((element,text)=>{element.textContent=text;},reference);
  }
  const sourceFilterTouchCss=route.source==='sources'&&!route.scope
   ? '.sync-control .admin-page .ad-tabs > button{min-height:0!important}' : '';
  if(sourceFilterTouchCss){
   const targets=await current.locator('.ad-tabs > button').evaluateAll(elements=>elements.map(element=>element.getBoundingClientRect().height));
   expect(targets).toHaveLength(6);
   expect(targets.every(height=>height>=44),'Actual Source filters retain canonical 44px hit areas').toBe(true);
  }
  const comparisonCss=touchComparisonCss+'\n'+sourceFilterTouchCss;
  const normalization=route.current==='/website'?null:await current.addStyleTag({content:comparisonCss});
  if(normalization&&width<=760){
   // Probes observed stale computed media styles after two mocked rAF
   // callbacks, settled by the first sample after 25ms of host-time waiting.
   // Poll the existing rules; raw production measurements remain untouched.
   await expect.poll(()=>current.evaluate(()=>{
    const header=document.querySelector('.topbar'),links=[...document.querySelectorAll('.mobile-bottom a')];
    return{mobileMediaMatches:matchMedia('(max-width:760px)').matches,headerGap:header?getComputedStyle(header).gap:null,bottomLinkMinHeightsReset:links.length>0&&links.every(link=>getComputedStyle(link).minHeight==='0px')};
   }),{timeout:2000,intervals:[25,50,100,250],message:`${row.case_id}: existing mobile counterfactual CSS must apply before measurement`}).toEqual({mobileMediaMatches:true,headerGap:'10px',bottomLinkMinHeightsReset:true});
  }
  const b=normalization?await measure(current):production;
  if(normalization)await normalization.evaluate(element=>element.remove());
  for(const copy of copyComparisons)await current.locator(copy.selector).evaluate((element,text)=>{element.textContent=text;},copy.production);
  const differences:Record<string,unknown>[]=[];
  for(const[selector,parts]of Object.entries(a.parts)){if(route.scope&&!['.nav-panel','.nav-panel .brand','.nav-panel .brand-button','.nav-panel .workspace-button','.nav-panel .main-nav .nav-link','.topbar','.topbar .avatar-button','.main-content','.mobile-bottom'].includes(selector))continue;const other=b.parts[selector];if(parts.length!==other.length)differences.push({selector,sourceCount:parts.length,currentCount:other.length});for(let i=0;i<Math.min(parts.length,other.length);i++)for(const[key,value]of Object.entries(parts[i])){const actual=other[i][key as keyof typeof other[number]];if(selector==='.main-content'&&key==='height'||key==='minHeight'||key==='boxSizing'||key==='gap'&&!/flex|grid/.test(parts[i].display)&&!/flex|grid/.test(other[i].display))continue;if(typeof value==='number'?Math.abs(value-Number(actual))>0.1:value!==actual)differences.push({selector,index:i,property:key,source:value,current:actual});}}
  const headingDifferences:Record<string,unknown>[]=[];
  if(!route.scope)for(let i=0;i<Math.min(a.headings.length,b.headings.length);i++)for(const key of ['x','y','width','height','font','fontSize','fontWeight','lineHeight','gap']as const){const x=a.headings[i][key],y=b.headings[i][key];if(typeof x==='number'?Math.abs(x-Number(y))>0.1:x!==y)headingDifferences.push({index:i,text:a.headings[i].text,property:key,source:x,current:y});}
  const accessibility=process.env.VEYOCAST_SYNC_RESP_AXE==='1'?{source:(await new AxeBuilder({page:source}).analyze()).violations,current:(await new AxeBuilder({page:current}).analyze()).violations}:undefined;
  const criteria={noHorizontalOverflow:a.overflow===0&&production.overflow===0&&b.overflow===0,assetsLoaded:a.images.every(image=>image.loaded)&&production.images.every(image=>image.loaded)&&b.images.every(image=>image.loaded),shellAndControlGeometry:differences.length===0,activeNavigation:route.scope?b.active.every(label=>label==='Beheer'||label==='Instellingen'):JSON.stringify(a.active)===JSON.stringify(b.active),sourceHeadingOrder:Boolean(route.scope)||JSON.stringify(a.headings.map(h=>h.text))===JSON.stringify(b.headings.map(h=>h.text)),sourceSectionGeometry:headingDifferences.length===0,mobileTouchTargets:production.mobileTargets.every(target=>target.width>=44&&target.height>=44),browserErrors:errors.length===0,accessibility:!accessibility||accessibility.current.length===0};

  const unmet=Object.entries(criteria).filter(([,passed])=>!passed).map(([name])=>name);readbacks.push({caseId:row.case_id,viewport:row.viewport,originalRoute:row.reference_route,currentRoute:route.current,sourceRoute:route.source,status:unmet.length?'PARTIAL':'PASS',criteria,unmet,differences,headingDifferences,scope:route.scope??'Actual chosen Source route',source:a,current:production,referenceState,copyComparisons,sourceContentAvailable:!route.scope,touchCanonComparison:normalization?{css:comparisonCss,measurement:b,scope:'Counterfactual Source-size hit areas only; raw production is recorded separately. Not an actual pixel-equality claim.'}:null,errors,accessibility});
  expect(criteria.noHorizontalOverflow).toBe(true);expect(criteria.assetsLoaded).toBe(true);expect(errors).toEqual([]);
  if(accessibility)expect(accessibility.current).toEqual([]);
  if(process.env.VEYOCAST_SYNC_RESP_REQUIRE_COMPLETE==='1')expect(unmet,`${row.case_id} has unexplained chosen Sync differences`).toEqual([]);
 }catch(error){if(!readbacks.some(result=>result.caseId===row.case_id))readbacks.push({caseId:row.case_id,viewport:row.viewport,originalRoute:row.reference_route,currentRoute:route.current,status:'ERROR',error:error instanceof Error?error.message.slice(0,1200):String(error)});throw error;}finally{await context.close();}
});
