import{test,expect}from'@playwright/test';
import AxeBuilder from'@axe-core/playwright';
import{fixture,id,mount,next,prepareWizardFixture}from'../helpers/sync-create-wizard-fixture';
test.beforeAll(prepareWizardFixture);
for(const family of ['fixtures','results','matchday']as const)for(const value of ['both','home','away'])test(`${family} ${value} survives reload and is sent to source check and create`,async({page})=>{
 const state=await mount(page,fixture(family,true));
 await page.getByRole('combobox',{name:'Gekoppelde bron',exact:true}).selectOption(id(3));await next(page);
 if(family==='matchday')await page.getByRole('combobox',{name:'Team',exact:true}).selectOption('own-team');
 const field=page.getByRole('combobox',{name:'Wedstrijden',exact:true});await expect(field).toHaveValue('both');await field.selectOption(value);
 await page.reload();await expect(field).toHaveValue(value);await next(page);await next(page);
 await expect(page.locator('dd').filter({hasText:({both:'Thuis & uit',home:'Alleen thuis',away:'Alleen uit'}as Record<string,string>)[value]})).toBeVisible();
 await page.getByRole('button',{name:'Bron controleren',exact:true}).click();await expect(page.getByRole('button',{name:'Ontwerp maken',exact:true})).toBeEnabled();
 expect(state.creates).toHaveLength(0);await page.getByRole('button',{name:'Ontwerp maken',exact:true}).click();await expect.poll(()=>state.creates.length).toBe(1);
 const command=state.creates[0]!.input;if(command.kind!=='connected'||!('configuration'in command.command.request))throw Error('Connected command required');
 expect(command.command.request.configuration.teamSelection).toMatchObject({matchLocation:value});expect(state.errors).toEqual([]);
});
for(const width of[390,1440])test(`welcome days are editable and retained at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});const props=fixture('welcome',true);props.slideType='sport_visitor_arrivals';props.canCreateConnected=true;const state=await mount(page,props);
 await page.getByRole('combobox',{name:'Gekoppelde bron',exact:true}).selectOption(id(3));await next(page);
 await page.getByRole('listbox',{name:'Teams',exact:true}).selectOption('own-team');
 const days=page.getByRole('combobox',{name:'Dagen vooruit',exact:true});await expect(days).toHaveValue('7');await days.selectOption('14');await page.reload();await expect(days).toHaveValue('14');
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await next(page);await next(page);await expect(page.locator('dd').filter({hasText:'14 dagen · lege slide overslaan'})).toBeVisible();
 await page.getByRole('button',{name:'Bron controleren',exact:true}).click();await expect(page.getByRole('button',{name:'Ontwerp maken',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Ontwerp maken',exact:true}).click();await expect.poll(()=>state.creates.length).toBe(1);
 const command=state.creates[0]!.input;if(command.kind!=='connected'||!('configuration'in command.command.request))throw Error('Connected command required');
 expect(command.command.request.configuration.arrival).toMatchObject({minutesBefore:20160,emptyBehavior:'skip'});expect(state.errors).toEqual([]);
});
