import {readFileSync,mkdirSync,writeFileSync,mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import{createRequire}from'node:module';
import{tmpdir}from'node:os';
import{execFileSync}from'node:child_process';
import {test,expect,chromium,type Page} from '@playwright/test';
import {syncSlidePresentationSchema,syncSlideRendererAssets,type SyncSlidePresentation} from '@veyocast/contracts';
import {measureSyncOnzeTrotsV9Layout,measureSyncOnzeTrotsLayout,projectSyncOnzeTrotsMotion,applySyncOnzeTrotsMotion} from '@veyocast/content-templates/sync-slide-static-view';
import {createSyncTemplatePreview} from '../../apps/control/app/(shell)/dashboard/studio/sync-template-preview';
// Compare the actual full Chromium binary used by Worker with that same
// browser. The runner's headless-shell has different text hinting metrics.
test.use({launchOptions:{executablePath:chromium.executablePath()}});
function buildSyncCaptureHtml(presentation:SyncSlidePresentation,index=0){
 const directory=mkdtempSync(join(tmpdir(),'s291-html-')),input=join(directory,'input.json'),output=join(directory,'slide.html');
 writeFileSync(input,JSON.stringify(presentation));
 execFileSync(process.execPath,['--import','tsx','tests/helpers/s291-worker-frame.mts',input,output,'html',String(index)],{cwd:process.cwd(),timeout:15000});
 return readFileSync(output,'utf8');
}

const articleUrl='https://example.org/nieuws/een-echt-artikel?categorie=vereniging&bericht=20261024';
const title='Na ‘Lisa’ werd alleen fietsen nog minder zorgeloos, deze fietsbuddy’s begeleiden Amsterdamse feestgangers';
const evidence=process.env.S291_EVIDENCE_DIR;
function fixture(orientation:'portrait'|'landscape',headline=title,summary='Een veilig genormaliseerd tekstfragment. '.repeat(100).slice(0,4000),url:string|undefined=articleUrl):SyncSlidePresentation{
 const sample=createSyncTemplatePreview('rss');if(sample.rendererVersion!=='sync-onzetrots-v9')throw Error('Current OnzeTrots sample missing');
 return syncSlidePresentationSchema.parse({...sample,orientation,authoring:{...sample.authoring,visualRevision:'onzetrots-20261024',headerTexts:{rss:'NIEUWS'},headerSubtitles:{rss:'Eigen club · Nieuws'}},news:[],rich:{...sample.rich,news:[{id:'article-a',title:headline,intro:summary,source:'Eigen nieuwsleverancier',url,heroImage:sample.rich?.featureImage}]}});
}
async function mount(page:Page,presentation:SyncSlidePresentation,index=0){
 const assets=syncSlideRendererAssets(presentation),requests:string[]=[],errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>{
  const url=new URL(route.request().url()),asset=assets.find(asset=>asset.path===url.pathname);
  requests.push(url.pathname);
  if(!asset)return route.abort();
  return route.fulfill({body:readFileSync(join(process.cwd(),'apps/player/public',asset.path)),contentType:asset.mimeType});
 });
 await page.setViewportSize(presentation.orientation==='portrait'?{width:1080,height:1920}:{width:1920,height:1080});
 await page.setContent(buildSyncCaptureHtml(presentation,index));
 await page.evaluate(async()=>{await Promise.all([...document.fonts].map(font=>font.load()));await document.fonts.ready;});
 const panelCount=await page.evaluate(measureSyncOnzeTrotsV9Layout,undefined),ranks=await page.evaluate(measureSyncOnzeTrotsLayout,undefined);
 await page.evaluate(applySyncOnzeTrotsMotion,projectSyncOnzeTrotsMotion(1200,ranks,'normal',false,{panelCount,mode:'light',paused:true,introFinished:true,entranceAllowed:true}));
 return{requests,errors};
}

for(const orientation of ['landscape','portrait']as const)for(const kind of ['real','maximum','word','wide-word','short','no-summary','dense-url','maximum-url','no-url']as const){
 test(`current RSS ${orientation}/${kind}: full headline, bounded summary, reserved QR/footer`,async({page})=>{
  const headline=kind==='maximum'?'Volledige nieuwstitel met veel woorden en informatie voor het clubscherm. '.repeat(8).slice(0,400):kind==='wide-word'?'W'.repeat(400):kind==='word'?'Wedstrijdprogramma'.repeat(22).slice(0,400):kind==='short'?'Clubnieuws':title;
  const slide=fixture(orientation,headline,kind==='no-summary'?'':undefined,kind==='no-url'?undefined:kind==='maximum-url'?'https://example.org/'+('artikel-'.repeat(300)).slice(0,2028):kind==='dense-url'?'https://example.org/'+('artikel-'.repeat(45)):articleUrl);
  // Explicit undefined selects the default parameter; remove a missing URL after construction.
  if(kind==='no-url'&&slide.rendererVersion==='sync-onzetrots-v9')delete slide.rich!.news![0]!.url;
  const result=await mount(page,slide);
  const geometry=await page.evaluate(()=>{
   const box=(selector:string)=>document.querySelector<HTMLElement>(selector)!.getBoundingClientRect().toJSON();
   const h=document.querySelector<HTMLElement>('[data-ot-article-title]')!,summary=document.querySelector<HTMLElement>('[data-ot-summary]')!;
   const range=document.createRange();range.selectNodeContents(h);
   return{content:box('.rss-copy'),headline:box('[data-ot-article-title]'),glyphs:[...range.getClientRects()].map(r=>r.toJSON()),number:box('.article-number'),header:box('.slide-header-container'),footer:box('.slide-footer'),supplier:box('.rss-provider'),signature:box('.signature'),summary:summary.textContent,full:summary.dataset.otSummary,qr:document.querySelector('.rss-qr-zone svg')?.getBoundingClientRect().toJSON(),font:getComputedStyle(h).font,scrollWidth:h.scrollWidth,clientWidth:h.clientWidth};
  });
  expect(await page.locator('[data-ot-article-title]').textContent()).toBe(headline);
  for(const glyph of geometry.glyphs){expect(glyph.top).toBeGreaterThanOrEqual(geometry.content.top);expect(glyph.bottom).toBeLessThanOrEqual(geometry.content.bottom);expect(glyph.right).toBeLessThanOrEqual(geometry.content.right);}
  expect(geometry.headline.top).toBeGreaterThanOrEqual(geometry.header.bottom);
  expect(geometry.number.bottom).toBeLessThanOrEqual(geometry.content.bottom);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.signature.right).toBeLessThan(geometry.supplier.left);
  expect(geometry.supplier.right).toBeLessThanOrEqual(1920);
  expect(geometry.font).toContain('900');
  if(geometry.summary!==geometry.full&&geometry.summary)expect(geometry.summary).toMatch(/…$/);
  await expect(page.locator('.blue-cta')).toHaveCount(0);
  await expect(page.getByText('Lees verder',{exact:true})).toHaveCount(0);
  if(kind==='no-url')expect(geometry.qr).toBeUndefined();else{expect(geometry.qr!.width).toBeGreaterThan(250);expect(geometry.qr!.height).toBeCloseTo(geometry.qr!.width,3);expect(geometry.qr!.bottom).toBeLessThan(geometry.footer.top);}
  const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
  const {root}=await cdp.send('DOM.getDocument');
  const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'[data-ot-article-title]'});
  const rendered=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
  expect(rendered.fonts.length).toBeGreaterThan(0);expect(rendered.fonts.every(font=>font.postScriptName==='BarlowCondensed-Black'&&font.isCustomFont)).toBe(true);
  expect(result.errors).toEqual([]);
  const directory=evidence??mkdtempSync(join(tmpdir(),'s291-rss-'));mkdirSync(directory,{recursive:true});
  const screenshot=join(directory,`rss-${orientation}-${kind}.png`);await page.screenshot({path:screenshot});
  const target=slide.rendererVersion==='sync-onzetrots-v9'?slide.rich?.news?.[0]?.url:undefined;
  const decoded=JSON.parse(execFileSync(process.execPath,['--import','tsx','tests/helpers/s291-decode-qr.mts',screenshot,...(target?[target]:[])],{cwd:process.cwd(),encoding:'utf8',timeout:15000}));
  if(evidence)writeFileSync(join(evidence,`rss-${orientation}-${kind}.json`),JSON.stringify({geometry,rendered,decoded,requests:result.requests},null,2));
 });
}

test('the complete Worker frame has the same settled composition as the shared preview',async({page})=>{
 const slide=fixture('landscape','W'.repeat(400));await mount(page,slide);
 const directory=mkdtempSync(join(tmpdir(),'s291-frame-')),input=join(directory,'presentation.json'),output=join(directory,'frame.png');
 writeFileSync(input,JSON.stringify(slide));
 execFileSync(process.execPath,['--import','tsx','tests/helpers/s291-worker-frame.mts',input,output],{cwd:process.cwd(),timeout:45000});
 const frame=readFileSync(output);
 if(evidence){mkdirSync(evidence,{recursive:true});writeFileSync(join(evidence,'rss-worker-frame.png'),frame);writeFileSync(join(evidence,'rss-worker-preview.png'),await page.screenshot());writeFileSync(join(evidence,'rss-worker-preview.json'),JSON.stringify(await page.locator('.rss-copy').evaluate(node=>({article:node.getBoundingClientRect().toJSON(),compact:node.getAttribute('data-ot-tight-title'),font:getComputedStyle(node.querySelector('h3')!).font,title:node.querySelector('h3')!.getBoundingClientRect().toJSON()})),null,2));}
 const require=createRequire(join(process.cwd(),'apps/media-worker/package.json')),sharp=require('sharp');
 // Both drivers use the same full Chromium executable. Compare the whole
 // native raster with the existing 2% color-error bound; exact headline
 // geometry, loaded glyphs and QR destinations are asserted separately.
 const native=await sharp(frame).removeAlpha().raw().toBuffer(),preview=await sharp(await page.screenshot()).removeAlpha().raw().toBuffer();
 expect(native.length).toBe(preview.length);
 let difference=0;for(let index=0;index<native.length;index++)difference+=Math.abs(native[index]!-preview[index]!);
 expect(difference/native.length/255).toBeLessThan(.02);
 execFileSync(process.execPath,['--import','tsx','tests/helpers/s291-decode-qr.mts',output,articleUrl],{cwd:process.cwd(),timeout:15000});
 expect(frame.byteLength).toBeGreaterThan(10000);
 expect(await page.locator('.rss-qr-zone svg').count()).toBe(1);
});


test('an article change keeps the headline, source and final-frame QR on the same item',async({page})=>{
 const slide=fixture('landscape');if(slide.rendererVersion!=='sync-onzetrots-v9')throw Error('Current required');
 slide.rich!.news!.push({...slide.rich!.news![0]!,id:'article-b',title:'Tweede werkelijk getoonde fixtureartikel',source:'Tweede fixturebron',url:'https://example.org/nieuws/tweede-artikel'});
 const directory=mkdtempSync(join(tmpdir(),'s291-switch-'));
 for(const index of[0,1,0]){
  await mount(page,slide,index);const item=slide.rich!.news![index]!;
  await expect(page.locator('[data-ot-article-title]')).toHaveText(item.title);await expect(page.locator('.rss-provider')).toHaveText(item.source);
  const frame=join(directory,`article-${index}.png`);await page.screenshot({path:frame});
  execFileSync(process.execPath,['--import','tsx','tests/helpers/s291-decode-qr.mts',frame,item.url!],{cwd:process.cwd(),timeout:15000});
 }
});
