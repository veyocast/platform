import {expect,test} from '@playwright/test';
import {syncSlidePollSchema} from '../../packages/contracts/src/sync-slide-presentation';
import {fixture,id,mount,next,origin,prepareWizardFixture} from '../helpers/sync-create-wizard-fixture';

test.beforeAll(prepareWizardFixture);
for(const width of [390,1440])for(const orientation of ['landscape','portrait']as const)test(`approved Engage keeps every bounded question and 2–24 choices readable (${width}/${orientation})`,async({context})=>{
 for(const count of [2,13,24]){
  const page=await context.newPage();try{await page.setViewportSize({width,height:1000});
  await page.addInitScript(()=>sessionStorage.clear());
  const data=fixture('engage');data.initialPresentation={...data.initialPresentation,headline:'Jouw stem.\nOnze club.',subtitle:'Een klein gebaar.\nEen groot clubgevoel.\nDoe mee via de QR-code.'};
  const state=await mount(page,data),title=count===24?'W'.repeat(160):'Wie was de uitblinker van deze wedstrijd?';
  const options=Array.from({length:count},(_,index)=>({id:id(100+index),label:`Keuze ${String(index+1).padStart(2,'0')} `+(index%2?'Samen voor de club. '.repeat(8):'Z'.repeat(151)).slice(0,151),votes:count===13?0:index+1}));
  const poll=syncSlidePollSchema.parse({id:id(31),title,status:'live',visibility:count===13?'after_vote':'live',optionsPerPage:4,options,publicUrl:'https://example.org/engage/own-campaign'})!;
  await page.route(`${origin}/__wizard/engage-selection`,route=>route.fulfill({json:{ok:true,poll,secureQrAvailable:true}}));
  await next(page);await page.getByRole('combobox',{name:'Gekoppelde publieksvraag',exact:true}).selectOption(id(31));await expect(page.locator('.poll-option')).toHaveCount(Math.min(4,count));await next(page);
  if(orientation==='portrait')await page.getByRole('button',{name:'Staand · 9:16',exact:true}).click();
  const preview=page.getByRole('complementary',{name:'Voorbeeld van je ontwerp'}),canvas=preview.locator('.vc-slide-preview');await canvas.scrollIntoViewIfNeeded();await page.evaluate(()=>document.fonts.ready);
  for(let index=0;index<Math.ceil(count/4);index++){
   await expect(canvas.locator('.poll-option > span')).toHaveText(options.slice(index*4,(index+1)*4).map(option=>option.label));await expect(canvas.locator('.poll-panel > h3')).toHaveText(title);
   if(count===13)await expect(canvas.locator('.poll-option > b')).toHaveCount(0);
   const geometry=await canvas.evaluate(element=>{
    const box=element.getBoundingClientRect(),panel=element.querySelector('.poll-panel')!.getBoundingClientRect(),footer=element.querySelector('.slide-footer')!.getBoundingClientRect();
    const nodes=[...element.querySelectorAll<HTMLElement>('.poll-panel > h3,.poll-panel > p,.poll-option > span,.ot-qr')].map(node=>{const rect=node.getBoundingClientRect(),parent=node.closest('.poll-option,.poll-panel,.engage-aside')!.getBoundingClientRect(),scale=rect.width/node.clientWidth;return{className:node.classList.value,rect:rect.toJSON(),parent:parent.toJSON(),inkRight:rect.left+Math.max(node.clientWidth,node.scrollWidth)*scale,inkBottom:rect.top+Math.max(node.clientHeight,node.scrollHeight)*scale};});
    return{box:box.toJSON(),panel:panel.toJSON(),footerTop:footer.top,nodes,rows:[...element.querySelectorAll('.poll-option')].map(node=>node.getBoundingClientRect().toJSON())};
   });
   // Brush glyphs can extend beyond their line box into a visible margin.
   // Check their full ink extent against the containing panel, not a clipped
   // line-box approximation that would reject the original font's ascenders.
   for(const node of geometry.nodes){expect(node.rect.left,node.className).toBeGreaterThanOrEqual(geometry.box.left);expect(node.inkRight,node.className).toBeLessThanOrEqual(Math.min(geometry.box.right,node.parent.right));expect(node.inkBottom,JSON.stringify({count,page:index,...node})).toBeLessThanOrEqual(Math.min(geometry.footerTop,node.parent.bottom));}
   for(const row of geometry.rows)expect(row.bottom).toBeLessThanOrEqual(geometry.panel.bottom);
   if(index<Math.ceil(count/4)-1)await preview.getByRole('button',{name:'Volgende keuzes',exact:true}).click();
  }
  expect(state.errors).toEqual([]);expect(state.creates).toEqual([]);await page.unroute(`${origin}/__wizard/engage-selection`);
  }finally{await page.close();}
 }
});
