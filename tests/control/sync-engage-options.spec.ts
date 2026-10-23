import AxeBuilder from '@axe-core/playwright';
import {expect,test,type Locator} from '@playwright/test';
import {syncSlidePollSchema,syncSlidePresentationSchema} from '../../packages/contracts/src/sync-slide-presentation';
import {createSyncStudioStarter} from '../../packages/studio/src/sync';
import {fixture,id,mount,next,origin,prepareWizardFixture} from '../helpers/sync-create-wizard-fixture';

test.beforeAll(()=>prepareWizardFixture());
// Keep this original Sync-v1 layout cohort on its frozen renderer. The new
// approved composition has its own cases; a new default must not erase these.
function legacyEngageFixture(){const data=fixture('engage'),base=createSyncStudioStarter({family:'engage',tenantName:data.tenantName,theme:'fieldflow'}).syncPresentation!;data.initialPresentation=syncSlidePresentationSchema.parse({...base,theme:'onzetrots-tv',style:{...base.style,background:'clubmuur'}});return data;}
for(const width of[390,1440])for(const orientation of['landscape','portrait']as const){
 test(`Engage toont alle 2–24 keuzes leesbaar in de wizard (${width}/${orientation})`,async({page},info)=>{
  await page.setViewportSize({width,height:1000});
  for(const count of[2,12,13,24]){
   const data=legacyEngageFixture();
   const options=Array.from({length:count},(_,i)=>({id:id(100+i),label:i%2===0?'Z'.repeat(160):`Speler ${String(i+1).padStart(2,'0')} · Eigen club · inzet, samenspel en sportiviteit. `.repeat(4).slice(0,160),votes:count===2||count===13?i+1:0}));
   const poll=syncSlidePollSchema.parse({id:id(31),title:'W'.repeat(160),status:'live',visibility:count===12?'after_vote':count===24?'after_close':'live',optionsPerPage:4,options,publicUrl:'https://example.org/engage/own-campaign'})!;
   // The production action is separately unit/DB-tested. This fixture controls
   // only that transport; the actual four-step UI, renderer and CSS stay real.
   await page.addInitScript(()=>sessionStorage.clear());
   const state=await mount(page,data);
   await page.route(`${origin}/__wizard/engage-selection`,route=>route.fulfill({json:{ok:true,poll,secureQrAvailable:true}}));
   await next(page);
   const choice=page.getByRole('combobox',{name:'Gekoppelde publieksvraag',exact:true});
   await expect(choice.locator(`option[value="${id(31)}"]`)).toHaveCount(1);
   await choice.selectOption(id(31));
   await expect(page.locator('.vc-engage-result')).toHaveCount(Math.min(4,count));
   await next(page);
   if(orientation==='portrait')await page.getByRole('button',{name:'Staand · 9:16',exact:true}).click();
   const preview=page.getByRole('complementary',{name:'Voorbeeld van je ontwerp'}),canvas=preview.locator('.vc-slide-preview');
   await canvas.scrollIntoViewIfNeeded();await page.evaluate(()=>document.fonts.ready);
   await expect(canvas).toBeVisible();
   const pages=Math.ceil(count/4),seen:string[]=[];
   for(let pageIndex=0;pageIndex<pages;pageIndex++){
    const expected=options.slice(pageIndex*4,(pageIndex+1)*4);
    await expect(canvas.locator('.vc-engage-result')).toHaveCount(expected.length);
    const ids=await canvas.locator('.vc-engage-result').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-option-id')!));
    expect(ids).toEqual(expected.map(option=>option.id));seen.push(...ids);
    await expect(canvas.locator('.sync-qr-svg')).toBeVisible();
    const geometry=await readGeometry(canvas);
    await info.attach(`choices-${count}-page-${pageIndex+1}`,{body:await canvas.screenshot(),contentType:'image/png'});
    await info.attach(`geometry-${count}-page-${pageIndex+1}`,{body:Buffer.from(JSON.stringify(geometry)),contentType:'application/json'});
    assertGeometry(geometry,orientation);
    if(count===12||count===24){await expect(canvas.locator('.vc-engage-result strong')).toHaveCount(0);await expect(canvas.locator('.vc-engage-result small')).toHaveCount(0);}
    if(pageIndex<pages-1){const nextPage=preview.getByRole('button',{name:'Volgende keuzes',exact:true});await nextPage.focus();await page.keyboard.press('Enter');}
   }
   expect(seen).toEqual(options.map(option=>option.id));
   if(pages>1){await expect(preview.getByRole('button',{name:'Volgende keuzes',exact:true})).toBeDisabled();const previous=preview.getByRole('button',{name:'Vorige keuzes',exact:true});expect((await previous.boundingBox())!.height).toBeGreaterThanOrEqual(44);await previous.click();await expect(canvas.locator('.vc-engage-result').first()).toHaveAttribute('data-option-id',options[(pages-2)*4]!.id);}
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
   await info.attach(`wizard-${count}`,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
   await next(page);await expect(page.getByRole('heading',{name:'Controleren',exact:true})).toBeVisible();
   await page.getByRole('button',{name:'Ontwerp maken',exact:true}).click();await expect.poll(()=>state.creates.length).toBe(1);
   const command=state.creates[0]!.input;expect(command.kind).toBe('manual');if(command.kind!=='manual')throw Error('manual');
   expect(command.document.syncPresentation?.poll?.options).toEqual(options);expect(command.document.motion).toMatchObject({enabled:true,durationMs:pages*5000});expect(state.errors).toEqual([]);
   await page.unroute(`${origin}/__wizard/engage-selection`);
  }
 });
}

async function readGeometry(canvas:Locator){
 return await canvas.evaluate(element=>{
     const canvas=element.getBoundingClientRect(),footer=element.querySelector('.vc-slide-footer')!.getBoundingClientRect();
     const rows=[...element.querySelectorAll<HTMLElement>('.vc-engage-result')].map(node=>{const label=node.querySelector<HTMLElement>('div>span')!,rect=node.getBoundingClientRect();return{id:node.getAttribute('data-option-id'),top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right,labelWidth:label.clientWidth,labelScroll:label.scrollWidth,labelHeight:label.clientHeight,labelScrollHeight:label.scrollHeight,lineClamp:getComputedStyle(label).webkitLineClamp,textOverflow:getComputedStyle(label).textOverflow,font:parseFloat(getComputedStyle(label).fontSize)};});
     const results=element.querySelector<HTMLElement>('.vc-engage-results')!,resultsRect=results.getBoundingClientRect(),meta=[...element.querySelectorAll<HTMLElement>('.vc-engage-total,.vc-engage-pages')].map(node=>{const r=node.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:node.clientWidth,scrollWidth:node.scrollWidth,height:node.clientHeight,scrollHeight:node.scrollHeight};});
     const qr=element.querySelector('.vc-engage-qr')!.getBoundingClientRect(),heading=element.querySelector<HTMLElement>('.vc-slide-content h2')!,headingRect=heading.getBoundingClientRect();
     return{canvas:{top:canvas.top,bottom:canvas.bottom,left:canvas.left,right:canvas.right,width:canvas.width,height:canvas.height},footerTop:footer.top,qr:{top:qr.top,bottom:qr.bottom,left:qr.left,right:qr.right},heading:{top:headingRect.top,bottom:headingRect.bottom,left:headingRect.left,right:headingRect.right,width:heading.clientWidth,scrollWidth:heading.scrollWidth,height:heading.clientHeight,scrollHeight:heading.scrollHeight,font:parseFloat(getComputedStyle(heading).fontSize)},results:{top:resultsRect.top,bottom:resultsRect.bottom,left:resultsRect.left,right:resultsRect.right},meta,rows};
    });
}
type Geometry=Awaited<ReturnType<typeof readGeometry>>;
function assertGeometry(geometry:Geometry,orientation:"landscape"|"portrait"){
    expect(geometry.canvas.width/geometry.canvas.height).toBeCloseTo(orientation==='portrait'?9/16:16/9,2);
    for(const row of geometry.rows){expect(row.top).toBeGreaterThanOrEqual(geometry.canvas.top);expect(row.bottom).toBeLessThanOrEqual(geometry.footerTop);expect(row.left).toBeGreaterThanOrEqual(geometry.canvas.left);expect(row.right).toBeLessThanOrEqual(geometry.canvas.right);expect(row.labelScroll).toBeLessThanOrEqual(row.labelWidth+1);expect(row.labelScrollHeight).toBeLessThanOrEqual(row.labelHeight+1);expect(['none','']).toContain(row.lineClamp);expect(row.textOverflow).not.toBe('ellipsis');expect(row.font/geometry.canvas.width*(orientation==='portrait'?1080:1920)).toBeGreaterThanOrEqual(26);}
    expect(geometry.heading.scrollWidth).toBeLessThanOrEqual(geometry.heading.width+1);expect(geometry.heading.scrollHeight).toBeLessThanOrEqual(geometry.heading.height+1);expect(geometry.heading.bottom).toBeLessThanOrEqual(geometry.rows[0]!.top);expect(geometry.heading.left).toBeGreaterThanOrEqual(geometry.canvas.left);expect(geometry.heading.right).toBeLessThanOrEqual(geometry.canvas.right);
    expect(geometry.qr.bottom).toBeLessThanOrEqual(geometry.footerTop);expect(geometry.qr.right).toBeLessThanOrEqual(geometry.canvas.right);
    if(orientation==='portrait')expect(geometry.rows.at(-1)!.bottom).toBeLessThanOrEqual(geometry.qr.top);
 expect(geometry.results.bottom).toBeLessThanOrEqual(geometry.footerTop);
 for(const meta of geometry.meta){expect(meta.top).toBeGreaterThanOrEqual(Math.max(...geometry.rows.map(row=>row.bottom)));expect(meta.bottom).toBeLessThanOrEqual(geometry.footerTop);expect(meta.left).toBeGreaterThanOrEqual(geometry.canvas.left);expect(meta.right).toBeLessThanOrEqual(geometry.canvas.right);expect(meta.scrollWidth).toBeLessThanOrEqual(meta.width+1);expect(meta.scrollHeight).toBeLessThanOrEqual(meta.height+1);}
 for(let i=0;i<geometry.rows.length;i++)for(let j=i+1;j<geometry.rows.length;j++){const a=geometry.rows[i]!,b=geometry.rows[j]!;expect(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top).toBe(true);}
 if(orientation==='landscape')expect(geometry.results.right).toBeLessThanOrEqual(geometry.qr.left);
}

for(const width of[390,1440])for(const orientation of['landscape','portrait']as const){
 test(`Engage bewaart de vraaggrenzen en gewone twee-kolomvorm (${width}/${orientation})`,async({context},info)=>{
  const cases=[24,25,80,81,160].map(length=>({name:`question-${length}`,title:'W'.repeat(length),count:13,long:true,last:false}));
  cases.push({name:'ordinary',title:'Wie was de uitblinker?',count:13,long:false,last:false},{name:'last-three',title:'W'.repeat(160),count:15,long:true,last:true});
  for(const sample of cases){
   const page=await context.newPage();
   try{
   await page.setViewportSize({width,height:1000});
   const options=Array.from({length:sample.count},(_,i)=>({id:id(100+i),label:sample.long?(i%2===0?'Z'.repeat(160):`Speler ${String(i+1).padStart(2,'0')} · Eigen club · inzet, samenspel en sportiviteit. `.repeat(4).slice(0,160)):`Speler ${String(i+1).padStart(2,'0')} · Eigen club`,votes:i+1}));
   const poll=syncSlidePollSchema.parse({id:id(31),title:sample.title,status:'live',visibility:'live',optionsPerPage:4,options,publicUrl:'https://example.org/engage/own-campaign'})!;
   await page.addInitScript(()=>sessionStorage.clear());await mount(page,legacyEngageFixture());
   await page.route(`${origin}/__wizard/engage-selection`,route=>route.fulfill({json:{ok:true,poll,secureQrAvailable:true}}));
   await next(page);await page.getByRole('combobox',{name:'Gekoppelde publieksvraag',exact:true}).selectOption(id(31));await expect(page.locator('.vc-engage-result')).toHaveCount(4);await next(page);
   if(orientation==='portrait')await page.getByRole('button',{name:'Staand · 9:16',exact:true}).click();
   const preview=page.getByRole('complementary',{name:'Voorbeeld van je ontwerp'}),canvas=preview.locator('.vc-slide-preview');
   if(sample.last)for(let i=0;i<3;i++)await preview.getByRole('button',{name:'Volgende keuzes',exact:true}).click();
   await canvas.scrollIntoViewIfNeeded();await page.evaluate(()=>document.fonts.ready);
   const geometry=await readGeometry(canvas);
   await info.attach(`boundary-choices-${sample.name}`,{body:await canvas.screenshot(),contentType:'image/png'});
   await info.attach(`boundary-geometry-${sample.name}`,{body:Buffer.from(JSON.stringify(geometry)),contentType:'application/json'});
   assertGeometry(geometry,orientation);
   await expect(canvas.locator('.vc-slide-content h2')).toHaveText(sample.title);
   const expected=sample.last?options.slice(12):options.slice(0,4);expect(geometry.rows.map(row=>row.id)).toEqual(expected.map(option=>option.id));
   if(sample.last)await expect(preview.getByRole('button',{name:'Volgende keuzes',exact:true})).toBeDisabled();
   if(sample.name==='ordinary'){await info.attach('boundary-wizard-ordinary',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);}
   await page.unroute(`${origin}/__wizard/engage-selection`);
   }finally{await page.close();}
  }
 });
}
