import{expect,test,type Page}from"@playwright/test";
import AxeBuilder from"@axe-core/playwright";
import{matchdayDatabaseFixture,matchdayFixture,matchdayPreflightFixture,matchdayUuid as id,mountMatchday,prepareMatchdayFixture}from"../helpers/matchday-fixture";

test.beforeAll(prepareMatchdayFixture);
async function chooseTarget(page:Page,name="Entree"){const trigger=page.getByRole("button",{name:/Doelschermen voor deze actie/});await trigger.click();await page.getByRole("checkbox",{name,exact:true}).check();await trigger.click();}
async function fieldAction(page:Page){await page.getByRole("combobox",{name:"Wedstrijd",exact:true}).selectOption(id(10));await page.getByLabel("Nieuw veld",{exact:true}).fill("2");await chooseTarget(page);await page.getByLabel("Reden",{exact:true}).fill("Veldverdeling gewijzigd");await page.getByRole("button",{name:"Actie controleren",exact:true}).click();}
async function confirm(page:Page){const dialog=page.getByRole("dialog");await expect(dialog).toBeVisible();await dialog.getByRole("button",{name:"Bevestigen",exact:true}).click();}

test("WDG-01 exact matches keep two matches for one team and another park team distinct",async({page})=>{await mountMatchday(page,matchdayFixture());await page.getByRole("button",{name:"Instellen",exact:true}).click();const main=page.getByRole("combobox",{name:"Hoofdwedstrijd",exact:true});await expect(main.locator("option")).toHaveCount(4);await expect(main).toHaveValue(id(10));await expect(main.locator(`option[value="${id(11)}"]`)).toContainText("Tegenstander 11");await expect(main.locator(`option[value="${id(12)}"]`)).toContainText("Eigen vereniging 2");});

test("WDG-02 overlapping physical screens require an explicit role decision",async({page})=>{await mountMatchday(page,matchdayFixture());await page.getByRole("button",{name:"Instellen",exact:true}).click();const trigger=page.getByRole("button",{name:/Doelen voor Entree/});await trigger.click();await page.getByRole("checkbox",{name:/Entree en clubmuur/}).check();await trigger.click();const overlap=page.getByRole("group",{name:"Overlappende doelen oplossen"});await expect(overlap).toBeVisible();await expect(overlap.getByRole("combobox")).toHaveValue("");await overlap.getByRole("combobox").selectOption("clubwall");await expect(overlap.getByRole("combobox")).toHaveValue("clubwall");});

test("WDG-03 published targets and versions do not mutate when draft options change",async({page})=>{const data=matchdayFixture();data.options.groups[0]!.screenIds.push(id(999));data.options.releases[0]!.version=9;await mountMatchday(page,data);const deliveries=page.locator('section[aria-labelledby="matchday-delivery-title"]');await expect(deliveries.locator("article")).toHaveCount(3);await expect(page.getByText(/Uitvoering: Actief · versie 1/)).toBeVisible();await expect(deliveries).not.toContainText("999");});

test("WDG-05 HTTP acceptance keeps per-player frame evidence separate",async({page})=>{const commands:unknown[]=[];await mountMatchday(page,matchdayFixture(),async(route,command)=>{commands.push(command);await route.fulfill({json:{ok:true,receipt:{outcome:"applied",requestId:(command.args[0] as{requestId:string}).requestId,runbookId:id(3),publicationId:id(4),actionId:id(200),actualRevision:1,message:"Klaargezet; wacht op Playerbewijs."}}});});await expect(page.getByText("Weergave bevestigd",{exact:true})).toHaveCount(2);await fieldAction(page);await expect(page.getByRole("dialog")).toContainText("Eigen vereniging 1 – Tegenstander 10");await expect(page.getByRole("dialog")).toContainText("Nieuw veld: 2");await expect(page.getByRole("dialog")).toContainText("Entree");await confirm(page);await expect(page.getByRole("status").filter({hasText:"Klaargezet; wacht op Playerbewijs."})).toBeVisible();expect(commands).toHaveLength(1);expect((commands[0] as{args:unknown[]}).args[0]).toMatchObject({runbookId:id(3),publicationId:id(4),matchId:id(10),field:"2",screenIds:[id(20)]});await expect(page.getByText("Weergave bevestigd",{exact:true})).toHaveCount(2);});

test("WDG-06 a lost response retries the identical actor-bound nonce and freezes other mutations",async({page})=>{const commands:unknown[]=[];await mountMatchday(page,matchdayFixture(),async(route,command)=>{commands.push(command);if(commands.length===1)return route.abort("failed");await route.fulfill({json:{ok:true,receipt:{outcome:"replayed",requestId:(command.args[0] as{requestId:string}).requestId,runbookId:id(3),publicationId:id(4),actionId:id(200),actualRevision:1,message:"Bestaande opdracht teruggevonden."}}});});await fieldAction(page);await confirm(page);const retry=page.getByRole("button",{name:"Dezelfde opdracht opnieuw proberen"});await expect(retry).toBeVisible();await expect(page.getByLabel("Nieuw veld",{exact:true})).toBeDisabled();await retry.click();await expect(page.getByText("Bestaande opdracht teruggevonden.",{exact:true})).toBeVisible();expect(commands).toHaveLength(2);expect(commands[1]).toEqual(commands[0]);});

test("WDG-06 a conflicting operator sees the conflict before another confirmation",async({page})=>{await mountMatchday(page,matchdayFixture(),async route=>{await route.fulfill({json:{ok:false,code:"CONFLICT",message:"Dit veld is inmiddels gewijzigd naar veld 3 om 13:01.",recovery:"Vernieuw en bevestig daarna opnieuw."}});});await fieldAction(page);await confirm(page);await expect(page.getByText(/inmiddels gewijzigd naar veld 3/)).toBeVisible();await expect(page.getByRole("dialog")).toHaveCount(0);await expect(page.getByRole("button",{name:"Dezelfde opdracht opnieuw proberen"})).toHaveCount(0);});

test("WDG-10 sold-out controls bind the exact frozen menu placement without a catalogue write",async({page})=>{const commands:{name:string;args:unknown[]}[]=[];await mountMatchday(page,matchdayFixture(),async(route,command)=>{commands.push(command);await route.fulfill({json:{ok:true,receipt:{outcome:"applied",requestId:(command.args[0] as{requestId:string}).requestId,runbookId:id(3),publicationId:id(4),actionId:id(200),actualRevision:1,message:"Beschikbaarheid klaargezet."}}});});await page.getByRole("combobox",{name:"Actie",exact:true}).selectOption("sold_out");await page.getByRole("combobox",{name:"Product op actief menu",exact:true}).selectOption(`menu:${id(80)}:bar-menu:${id(81)}`);await chooseTarget(page,"Kantine");await page.getByLabel("Reden",{exact:true}).fill("Broodjes tijdelijk op");await page.getByRole("button",{name:"Actie controleren"}).click();await expect(page.getByRole("dialog")).toContainText("Broodje gezond");await confirm(page);await expect(page.getByText("Beschikbaarheid klaargezet.",{exact:true})).toBeVisible();expect(commands[0]!.name).toBe("applyMatchdayAction");expect(commands[0]!.args[0]).toMatchObject({kind:"sold_out",productId:id(81),menuSnapshotId:id(80),placementId:"bar-menu",screenIds:[id(22)]});expect(commands[0]!.args[0]).not.toHaveProperty("price");});

test("WDG-11 an actor change drops an unresolved old-actor retry",async({page})=>{let requests=0;const data=matchdayFixture();await mountMatchday(page,data,async route=>{requests++;await route.abort("failed");});await fieldAction(page);await confirm(page);await expect(page.getByRole("button",{name:"Dezelfde opdracht opnieuw proberen"})).toBeVisible();await page.evaluate(({workspace,scope})=>(globalThis as unknown as{updateMatchdayWorkspace:(workspace:unknown,scope:string)=>void}).updateMatchdayWorkspace(workspace,scope),{workspace:data,scope:`${id(1)}:${id(102)}`});await expect(page.getByRole("button",{name:"Dezelfde opdracht opnieuw proberen"})).toHaveCount(0);expect(requests).toBe(1);});

test("WDG-11 a delegated volunteer has no global publication or configuration controls",async({page})=>{const data=matchdayFixture();data.permissions={canManageFeature:false,canEdit:false,canPublish:false,canDelegate:false};data.selected!.permittedActions=[{kind:"field",objectId:`match:${id(10)}:field`,screenIds:[id(20)],endsAt:"2026-11-09T18:00:00Z"}];await mountMatchday(page,data);await expect(page.getByRole("button",{name:"Werkplek uitschakelen"})).toHaveCount(0);await expect(page.getByRole("heading",{name:"Vrijwilligers toewijzen"})).toHaveCount(0);await expect(page.getByRole("combobox",{name:"Actie",exact:true}).locator("option")).toHaveCount(2);await page.getByRole("button",{name:"Instellen",exact:true}).click();await expect(page.getByText("Je kunt dit draaiboek binnen je toewijzing bedienen.",{exact:false})).toBeVisible();await expect(page.getByRole("button",{name:"Concept opslaan"})).toHaveCount(0);});

test("WDG-13 disabling the workbench preserves access to ordinary planning and blocks actions",async({page})=>{const data=matchdayFixture();data.enabled=false;await mountMatchday(page,data);await expect(page.getByRole("heading",{name:"Wedstrijddag staat uit"})).toBeVisible();await expect(page.getByRole("link",{name:"Gewone planning openen"})).toHaveAttribute("href","/dashboard/planning");await expect(page.getByLabel("Nieuw veld",{exact:true})).toBeDisabled();});

test("offline mobile operation retains read evidence and blocks mutations",async({page,context})=>{await mountMatchday(page,matchdayFixture());await context.setOffline(true);await expect(page.getByText(/Je bent offline/)).toBeVisible();await expect(page.getByLabel("Nieuw veld",{exact:true})).toBeDisabled();await expect(page.getByText("Weergave bevestigd",{exact:true})).toHaveCount(2);await context.setOffline(false);await expect(page.getByLabel("Nieuw veld",{exact:true})).toBeEnabled();});

for(const width of[320,1440])test(`WDG-14 operation and configuration remain readable at ${width}px`,async({page},info)=>{await page.setViewportSize({width,height:900});const{errors}=await mountMatchday(page,matchdayFixture());await expect(page.getByRole("heading",{name:"Eigen vereniging 1 – Tegenstander 10",exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);await page.screenshot({path:info.outputPath(`matchday-operation-${width}.png`),fullPage:true});await page.getByRole("button",{name:"Instellen",exact:true}).click();await expect(page.getByRole("heading",{name:"Draaiboek instellen"})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`matchday-configuration-${width}.png`),fullPage:true});expect(errors).toEqual([]);});


test("WDG-02 publication preflight blocks unsupported expiry and shows the existing planning winner",async({page})=>{
 const data=matchdayFixture(),preflight=matchdayPreflightFixture(data,id(21)),commands:{name:string;args:unknown[]}[]=[];
 await mountMatchday(page,data,async(route,command)=>{commands.push(command);expect(command.name).toBe("previewMatchday");expect(command.args.slice(0,2)).toEqual([id(3),2]);await route.fulfill({json:{ok:true,preflight}});});
 await page.getByRole("button",{name:"Instellen",exact:true}).click();
 await page.getByRole("button",{name:"Publicatie controleren",exact:true}).click();
 const review=page.getByRole("region",{name:"Controle per doelscherm",exact:true});
 await expect(review.getByRole("article")).toHaveCount(3);
 await expect(review).toContainText("Bestaande noodmelding");await expect(review).toContainText("Override heeft voorrang");
 await expect(review).toContainText("Reguliere entreeloop");await expect(review).toContainText("Planning hervat vanaf");
 await expect(review).toContainText("Playerupgrade vereist");
 await expect(page.getByRole("button",{name:"Draaiboek publiceren",exact:true})).toBeDisabled();
 expect(commands).toHaveLength(1);await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("WDG-01 exact preflight and all three frozen targets precede a separate publication confirmation",async({page})=>{
 const data=matchdayFixture(),preflight=matchdayPreflightFixture(data),commands:{name:string;args:unknown[]}[]=[];
 await mountMatchday(page,data,async(route,command)=>{commands.push(command);if(command.name==="previewMatchday")return route.fulfill({json:{ok:true,preflight}});expect(command.name).toBe("publishMatchday");const input=command.args[0]as{requestId:string};await route.fulfill({json:{ok:true,receipt:{outcome:"applied",requestId:input.requestId,runbookId:id(3),publicationId:id(4),actionId:null,actualRevision:3,message:"Publicatie klaargezet; Playerbewijs volgt per scherm."}}});});
 await page.getByRole("button",{name:"Instellen",exact:true}).click();await page.getByRole("button",{name:"Publicatie controleren",exact:true}).click();
 const links=page.getByRole("link",{name:"Opgeslagen publicatievoorbeeld bekijken",exact:true});await expect(links).toHaveCount(3);
 for(const[index,target]of data.selected!.publication!.targets.entries())await expect(links.nth(index)).toHaveAttribute("href",`/dashboard/matchday/preview/${target.defaultReleaseId}`);
 await page.getByRole("button",{name:"Draaiboek publiceren",exact:true}).click();
 const dialog=page.getByRole("dialog");for(const name of["Entree","Clubmuur","Kantine"])await expect(dialog).toContainText(name);
 expect(commands).toHaveLength(1);await confirm(page);await expect(page.getByText("Publicatie klaargezet; Playerbewijs volgt per scherm.",{exact:true})).toBeVisible();
 expect(commands).toHaveLength(2);expect(commands[1]!.args[0]).toMatchObject({runbookId:id(3),expectedRevision:2,preflightId:preflight.id});
 await expect(page.getByText("Weergave bevestigd",{exact:true})).toHaveCount(0);
});

for(const kind of["phase","postponed","cancelled"]as const)test(`WDG-04 main ${kind} requires every frozen target explicitly`,async({page})=>{
 const data=matchdayFixture(),commands:{name:string;args:unknown[]}[]=[];
 await mountMatchday(page,data,async(route,command)=>{commands.push(command);const input=command.args[0]as{requestId:string};await route.fulfill({json:{ok:true,receipt:{outcome:"applied",requestId:input.requestId,runbookId:id(3),publicationId:id(4),actionId:id(200),actualRevision:1,message:"Hoofdwedstrijdactie klaargezet."}}});});
 await page.getByRole("combobox",{name:"Actie",exact:true}).selectOption(kind);
 if(kind!=="phase")await page.getByRole("combobox",{name:"Wedstrijd",exact:true}).selectOption(id(10));
 await page.getByLabel("Reden",{exact:true}).fill("Bewuste hoofdwedstrijdwijziging");
 const button=page.getByRole("button",{name:"Actie controleren",exact:true});await expect(button).toBeDisabled();
 await chooseTarget(page,"Entree");await expect(button).toBeDisabled();expect(commands).toHaveLength(0);
 await chooseTarget(page,"Clubmuur");await expect(button).toBeDisabled();await chooseTarget(page,"Kantine");await expect(button).toBeEnabled();
 await button.click();const dialog=page.getByRole("dialog");for(const name of["Entree","Clubmuur","Kantine"])await expect(dialog).toContainText(name);await expect(dialog).toContainText("Tegenstander 10");
 await confirm(page);await expect(page.getByText("Hoofdwedstrijdactie klaargezet.",{exact:true})).toBeVisible();
 expect(commands).toHaveLength(1);expect(commands[0]!.args[0]).toMatchObject({kind,runbookId:id(3),matchId:id(10),screenIds:[id(20),id(21),id(22)]});
});

test("WDG-11 a partial volunteer grant cannot promote a main phase to other frozen targets",async({page})=>{
 const data=matchdayFixture();data.permissions={canManageFeature:false,canEdit:false,canPublish:false,canDelegate:false};
 data.selected!.permittedActions=[{kind:"phase",objectId:`match:${id(10)}:phase`,screenIds:[id(20)],endsAt:"2026-11-09T18:00:00Z"}];
 const commands:unknown[]=[];await mountMatchday(page,data,async(route,command)=>{commands.push(command);await route.abort();});
 await page.getByRole("combobox",{name:"Actie",exact:true}).selectOption("phase");await chooseTarget(page,"Entree");
 await page.getByLabel("Reden",{exact:true}).fill("Alleen eigen doelrecht");
 await expect(page.getByRole("button",{name:"Actie controleren",exact:true})).toBeDisabled();
 const trigger=page.getByRole("button",{name:/Doelschermen voor deze actie/});await trigger.click();
 await expect(page.getByRole("checkbox",{name:"Entree",exact:true})).toBeChecked();await expect(page.getByRole("checkbox",{name:"Clubmuur",exact:true})).toHaveCount(0);await expect(page.getByRole("checkbox",{name:"Kantine",exact:true})).toHaveCount(0);await trigger.click();
 expect(commands).toEqual([]);await expect(page.getByRole("dialog")).toHaveCount(0);
});

for(const revision of[0,7])test(`WDG-06 closing uses mutable lifecycle CAS ${revision}, independent of immutable version`,async({page})=>{
 const data=matchdayFixture();data.selected!.publication!.version=12;data.selected!.objectRevisions=revision?[{key:`publication:${id(4)}`,revision}]:[];
 const commands:{name:string;args:unknown[]}[]=[];await mountMatchday(page,data,async(route,command)=>{commands.push(command);const input=command.args[0]as{requestId:string};await route.fulfill({json:{ok:true,receipt:{outcome:"applied",requestId:input.requestId,runbookId:id(3),publicationId:id(4),actionId:null,actualRevision:revision+1,message:"Herstel klaargezet; wacht op Playerbewijs."}}});});
 await page.getByRole("button",{name:"Afsluiten en planning hervatten",exact:true}).click();
 const dialog=page.getByRole("dialog");for(const name of["Entree","Clubmuur","Kantine"])await expect(dialog).toContainText(name);
 expect(commands).toEqual([]);await confirm(page);await expect(page.getByText("Herstel klaargezet; wacht op Playerbewijs.",{exact:true})).toBeVisible();
 expect(commands[0]!.name).toBe("closeMatchday");expect(commands[0]!.args[0]).toMatchObject({runbookId:id(3),publicationId:id(4),expectedRevision:revision,operation:"close"});
 await expect(page.getByText("Weergave bevestigd",{exact:true})).toHaveCount(2);
});


test("WDG-07 ending an action waits for distinct restoration evidence and does not resurrect it",async({page})=>{
 const data=matchdayFixture(),commands:{name:string;args:unknown[]}[]=[];
 data.selected!.actions=[{id:id(200),publicationId:id(4),revision:3,objectKey:`match:${id(10)}:field`,kind:"field",matchId:id(10),productId:null,menuSnapshotId:null,placementId:null,value:"2",actorLabel:"Wedstrijddienst",startsAt:"2026-11-09T11:55:00Z",endsAt:"2026-11-09T12:20:00Z",status:"active",contentHash:"b".repeat(64),screenIds:[id(20)]}];
 data.selected!.deliveries[0]!.actionId=id(200);data.selected!.deliveries[0]!.actionRevision=3;
 await mountMatchday(page,data,async(route,command)=>{commands.push(command);const input=command.args[0]as{requestId:string};await route.fulfill({json:{ok:true,receipt:{outcome:"applied",requestId:input.requestId,runbookId:id(3),publicationId:id(4),actionId:id(200),actualRevision:4,message:"Herstel klaargezet; wacht op de geldende planning en Playerbewijs."}}});});
 await page.getByRole("button",{name:"Beëindigen en herstellen",exact:true}).click();
 await expect(page.getByRole("dialog")).toContainText("De oude correctie verschijnt niet opnieuw.");await confirm(page);
 await expect(page.getByText("Herstel klaargezet; wacht op de geldende planning en Playerbewijs.",{exact:true})).toBeVisible();
 expect(commands[0]!.name).toBe("endMatchdayAction");expect(commands[0]!.args[0]).toMatchObject({runbookId:id(3),publicationId:id(4),actionId:id(200),expectedRevision:3});
 await expect(page.getByText("Planning hervat",{exact:true})).toHaveCount(0);
 const waiting=structuredClone(data);waiting.selected!.actions[0]!.status="ended";waiting.selected!.deliveries[0]!.status="restoring";waiting.selected!.deliveries[0]!.renderedAt=null;
 await page.evaluate(workspace=>(globalThis as unknown as{updateMatchdayWorkspace:(workspace:unknown)=>void}).updateMatchdayWorkspace(workspace),waiting);
 await expect(page.getByRole("button",{name:"Beëindigen en herstellen",exact:true})).toHaveCount(0);await expect(page.getByText("Herstel klaargezet",{exact:true})).toBeVisible();
 const restored=structuredClone(waiting);restored.selected!.deliveries[0]!.status="restored";restored.selected!.deliveries[0]!.renderedAt="2026-11-09T12:00:05Z";restored.selected!.deliveries[0]!.confirmedReleaseId=id(210);
 await page.evaluate(workspace=>(globalThis as unknown as{updateMatchdayWorkspace:(workspace:unknown)=>void}).updateMatchdayWorkspace(workspace),restored);
 await expect(page.getByText("Planning hervat",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Beëindigen en herstellen",exact:true})).toHaveCount(0);
 expect(commands).toHaveLength(1);
});

test("WDG-12 absent newer source options retain frozen match identity and explicit unknown observations",async({page})=>{
 const data=matchdayFixture();data.options.matches=[];data.options.contexts=[];
 data.selected!.publication!.configuration.matches[0]!.observedAt=null;data.selected!.publication!.configuration.matches[0]!.lastSuccessfulSyncAt=null;
 const commands:unknown[]=[];await mountMatchday(page,data,async(route,command)=>{commands.push(command);await route.abort();});
 await expect(page.getByRole("heading",{name:"Eigen vereniging 1 – Tegenstander 10",exact:true})).toBeVisible();
 await expect(page.getByText("Vooraf",{exact:true})).toBeVisible();
 await expect(page.getByText(/Bronobservatie:.*Onbekend.*laatste geslaagde broncontrole:.*Onbekend/)).toBeVisible();
 const matches=page.getByRole("combobox",{name:"Wedstrijd",exact:true});await expect(matches.locator(`option[value="${id(10)}"]`)).toContainText("Tegenstander 10");
 await expect(matches.locator(`option[value="${id(11)}"]`)).toContainText("Tegenstander 11");await expect(matches.locator(`option[value="${id(12)}"]`)).toContainText("Eigen vereniging 2");
 await expect(page.getByText("Weergave bevestigd",{exact:true})).toHaveCount(2);expect(commands).toEqual([]);
});

test("WDG-11 delegated workspace labels its restricted scope without unrelated match or target metadata",async({page})=>{
 const data=matchdayFixture(),selected=data.selected!,publication=selected.publication!,allowedMatch=publication.configuration.matches.find(match=>match.id===id(11))!;
 data.permissions={canManageFeature:false,canEdit:false,canPublish:false,canDelegate:false};selected.readScope="delegated";
 selected.configuration={...selected.configuration,matches:[allowedMatch],mainMatchId:null,roles:[selected.configuration.roles[0]!]};
 publication.configuration={...publication.configuration,matches:[allowedMatch],mainMatchId:null,roles:[publication.configuration.roles[0]!]};
 publication.targets=publication.targets.filter(target=>target.screenId===id(20));selected.deliveries=selected.deliveries.filter(delivery=>delivery.screenId===id(20));
 selected.permittedActions=[{kind:"field",objectId:`match:${id(11)}:field`,screenIds:[id(20)],endsAt:"2026-11-09T18:00:00Z"}];
 data.options={contexts:[],matches:[],screens:[],groups:[],releases:[],members:[],menuPlacements:[],ledConfigurations:[]};
 const commands:unknown[]=[];await mountMatchday(page,data,async(route,command)=>{commands.push(command);await route.abort();});
 await expect(page.getByText("Alleen toegewezen wedstrijden en schermen",{exact:true})).toBeVisible();
 const matches=page.getByRole("combobox",{name:"Wedstrijd",exact:true});await expect(matches.locator("option")).toHaveCount(2);await expect(matches).toContainText("Tegenstander 11");
 await expect(page.getByText(/Tegenstander 10|Tegenstander 12|Eigen vereniging 2/)).toHaveCount(0);
 const deliveries=page.locator('section[aria-labelledby="matchday-delivery-title"]');await expect(deliveries.getByRole("article")).toHaveCount(1);await expect(deliveries).toContainText("Entree");await expect(deliveries).not.toContainText("Clubmuur");await expect(deliveries).not.toContainText("Kantine");
 await page.getByRole("button",{name:"Instellen",exact:true}).click();await expect(page.getByRole("button",{name:"Concept opslaan",exact:true})).toHaveCount(0);expect(commands).toEqual([]);
});


test("actual isolated RPC publication renders exact frozen matches and queued targets without a frame claim",async({page})=>{
 const capture=matchdayDatabaseFixture(),data=capture.workspace,selected=data.selected!,publication=selected.publication!;
 expect(capture.published.publicationId).toBe(publication.id);expect(capture.published.runbookId).toBe(selected.id);expect(capture.published.actualRevision).toBe(selected.draftRevision);
 expect(capture.preflight.draftRevision).toBe(capture.publishInput.expectedRevision);expect(capture.preflight.id).toBe(capture.publishInput.preflightId);
 expect(capture.actionReceipt.publicationId).toBe(publication.id);expect(capture.actionConflict.outcome).toBe("conflict");
 const issued=capture.deviceActions.actions[0]!;
 expect(issued.actionId).toBe(capture.actionReceipt.actionId);expect(issued.publicationId).toBe(publication.id);
 expect(capture.ackInput).toMatchObject({deliveryId:issued.deliveryId,actionId:issued.actionId,contentHash:issued.contentHash,actionRevision:issued.actionRevision});
 expect(capture.ackReceipt).toMatchObject({accepted:true,deliveryId:issued.deliveryId,phase:"received"});
 const commands:unknown[]=[];const{errors}=await mountMatchday(page,data,async(route,command)=>{commands.push(command);await route.abort();});
 const main=publication.configuration.matches.find(match=>match.id===publication.configuration.mainMatchId)!;
 await expect(page.getByRole("heading",{name:`${main.homeTeamName} – ${main.awayTeamName}`,exact:true})).toBeVisible();
 const deliveries=page.locator('section[aria-labelledby="matchday-delivery-title"]');await expect(deliveries.getByRole("article")).toHaveCount(publication.targets.length);
 for(const target of publication.targets)await expect(deliveries.getByRole("heading",{name:target.screenName,exact:true})).toBeVisible();
 await expect(page.getByText("Weergave bevestigd",{exact:true})).toHaveCount(0);
 await page.getByRole("button",{name:"Instellen",exact:true}).click();const picker=page.getByRole("combobox",{name:"Hoofdwedstrijd",exact:true});
 await expect(picker).toHaveValue(main.id);await expect(picker.locator("option")).toHaveCount(publication.configuration.matches.length+1);
 for(const match of publication.configuration.matches)await expect(picker.locator(`option[value="${match.id}"]`)).toContainText(match.awayTeamName);
 const labels=await picker.locator("option").allTextContents();expect(new Set(labels).size).toBe(labels.length);
 expect(commands).toEqual([]);expect(errors).toEqual([]);
});

test("actual isolated RPC preflight keeps its exact saved draft basis and requires separate publication confirmation",async({page})=>{
 const capture=matchdayDatabaseFixture(),data=capture.beforePublishWorkspace,selected=data.selected!,preflight=capture.preflight,commands:{name:string;args:unknown[]}[]=[];
 expect(selected.draftRevision).toBe(preflight.draftRevision);expect(preflight.runbookId).toBe(selected.id);expect(selected.publication).toBeNull();
 const{errors}=await mountMatchday(page,data,async(route,command)=>{commands.push(command);expect(command.name).toBe("previewMatchday");expect(command.args.slice(0,2)).toEqual([selected.id,selected.draftRevision]);await route.fulfill({json:{ok:true,preflight}});});
 await page.getByRole("button",{name:"Instellen",exact:true}).click();await page.getByRole("button",{name:"Publicatie controleren",exact:true}).click();
 const review=page.getByRole("region",{name:"Controle per doelscherm",exact:true});await expect(review.getByRole("article")).toHaveCount(preflight.targets.length);
 for(const target of preflight.targets){await expect(review.getByRole("heading",{name:new RegExp(`^${target.screenName} · `)})).toBeVisible();for(const interval of target.planning)await expect(review.getByText(interval.winnerName,{exact:true}).first()).toBeVisible();}
 expect((await review.getByRole("link",{name:"Opgeslagen publicatievoorbeeld bekijken",exact:true}).evaluateAll(elements=>elements.map(element=>element.getAttribute("href")))).sort()).toEqual(preflight.targets.map(target=>`/dashboard/matchday/preview/${target.defaultReleaseId}`).sort());
 await page.getByRole("button",{name:"Draaiboek publiceren",exact:true}).click();const dialog=page.getByRole("dialog");
 for(const target of preflight.targets)await expect(dialog).toContainText(target.screenName);
 expect(commands).toHaveLength(1);await dialog.getByRole("button",{name:"Terug",exact:true}).click();expect(commands).toHaveLength(1);
 await expect(page.getByText("Weergave bevestigd",{exact:true})).toHaveCount(0);expect(errors).toEqual([]);
});

test("actual isolated delegated RPC exposes only granted exact objects and keeps global metadata links absent",async({page})=>{
 const capture=matchdayDatabaseFixture(),data=capture.delegatedWorkspace,selected=data.selected!,publication=selected.publication!;
 expect(selected.readScope).toBe("delegated");expect(data.permissions.canPublish).toBe(false);for(const rows of Object.values(data.options))expect(rows).toEqual([]);
 const commands:unknown[]=[];const{errors}=await mountMatchday(page,data,async(route,command)=>{commands.push(command);await route.abort();},{canReadScreens:true});
 await expect(page.getByText("Alleen toegewezen wedstrijden en schermen",{exact:true})).toBeVisible();
 const matches=page.getByRole("combobox",{name:"Wedstrijd",exact:true});
 expect((await matches.locator("option").evaluateAll(elements=>elements.map(element=>(element as HTMLOptionElement).value))).filter(Boolean).sort()).toEqual(publication.configuration.matches.map(match=>match.id).sort());
 const deliveries=page.locator('section[aria-labelledby="matchday-delivery-title"]');await expect(deliveries.getByRole("article")).toHaveCount(publication.targets.length);
 for(const target of publication.targets)await expect(deliveries.getByRole("heading",{name:target.screenName,exact:true})).toBeVisible();
 for(const target of capture.workspace.selected!.publication!.targets.filter(target=>!publication.targets.some(allowed=>allowed.screenId===target.screenId)))await expect(page.getByText(target.screenName,{exact:true})).toHaveCount(0);
 await expect(page.getByText(/Eigen tweede team|Parktegenstander/)).toHaveCount(0);await expect(page.getByRole("link",{name:"Bron- en publicatiebewijs openen",exact:true})).toHaveCount(0);
 await page.getByRole("button",{name:"Instellen",exact:true}).click();await expect(page.getByRole("button",{name:"Concept opslaan",exact:true})).toHaveCount(0);
 expect(commands).toEqual([]);expect(errors).toEqual([]);
});

test("WDG-13 an explicitly closed runbook is closed before its original end time",async({page})=>{
 const data=matchdayFixture();data.selected!.publication!.status="closed";data.runbooks[0]!.status="closed";
 const commands:unknown[]=[];await mountMatchday(page,data,async(route,command)=>{commands.push(command);await route.abort();});
 await expect(page.getByText(/Uitvoering: Afgesloten · versie 1/)).toBeVisible();
 await expect(page.getByRole("button",{name:"Actie controleren",exact:true})).toBeDisabled();
 await expect(page.getByRole("button",{name:"Afsluiten en planning hervatten",exact:true})).toBeDisabled();
 expect(commands).toEqual([]);
});

for(const scenario of["known-version","unknown-version","no-screen-right","delegated-screen-right"]as const)test(`WDG-12 delivery evidence ${scenario} preserves version and screen-read boundaries`,async({page})=>{
 const data=matchdayFixture(),selected=data.selected!,publication=selected.publication!,delivery=selected.deliveries[0]!;
 delivery.actionId=id(200);delivery.actionRevision=333;
 if(scenario==="unknown-version")delivery.confirmedReleaseId=id(999);
 if(scenario==="delegated-screen-right"){
  data.permissions={canManageFeature:false,canEdit:false,canPublish:false,canDelegate:false};selected.readScope="delegated";
  const allowed=publication.configuration.matches.find(match=>match.id===id(11))!;
  selected.configuration={...selected.configuration,matches:[allowed],mainMatchId:null,roles:[selected.configuration.roles[0]!]};
  publication.configuration={...publication.configuration,matches:[allowed],mainMatchId:null,roles:[publication.configuration.roles[0]!]};
  publication.targets=publication.targets.filter(target=>target.screenId===id(20));selected.deliveries=[delivery];
  selected.permittedActions=[{kind:"field",objectId:`match:${id(11)}:field`,screenIds:[id(20)],endsAt:"2026-11-09T18:00:00Z"}];
  data.options={contexts:[],matches:[],screens:[],groups:[],releases:[],members:[],menuPlacements:[],ledConfigurations:[]};
 }
 const commands:unknown[]=[];const{errors}=await mountMatchday(page,data,async(route,command)=>{commands.push(command);await route.abort();},{canReadScreens:scenario!=="no-screen-right"});
 const section=page.locator('section[aria-labelledby="matchday-delivery-title"]'),card=section.getByRole("article").filter({has:page.getByRole("heading",{name:"Entree",exact:true})});
 await expect(card).toContainText(scenario==="unknown-version"||scenario==="delegated-screen-right"?"Bevestigde publicatie: Versie onbekend":"Bevestigde publicatie: Gewone entree · versie 1");
 await expect(card).not.toContainText("versie 333");await expect(card.getByText("Actierevisie 333",{exact:true})).toBeHidden();
 await card.getByText("Afleverdetails",{exact:true}).click();await expect(card.getByText("Actierevisie 333",{exact:true})).toBeVisible();
 const links=section.getByRole("link",{name:"Bron- en publicatiebewijs openen",exact:true}),mayLink=scenario==="known-version"||scenario==="unknown-version";
 await expect(links).toHaveCount(mayLink?publication.targets.length:0);
 if(mayLink)expect((await links.evaluateAll(elements=>elements.map(element=>element.getAttribute("href")))).sort()).toEqual(publication.targets.map(target=>`/dashboard/screens/${target.screenId}`).sort());
 expect(commands).toEqual([]);expect(errors).toEqual([]);
});

for(const temporaryVisible of[true,false])test(`WDG-12 restored release keeps its own confirmation time after ${temporaryVisible?"a visible":"an unshown"} temporary release`,async({page})=>{
 const data=matchdayFixture(),delivery=data.selected!.deliveries[0]!,restoredRelease={...data.options.releases[0]!,id:id(83),label:"Gewone planning B",version:7};
 data.options.releases.push(restoredRelease);
 delivery.status=temporaryVisible?"rendered":"prepared";delivery.renderedAt=temporaryVisible?"2026-11-09T11:00:00Z":null;delivery.confirmedReleaseId=temporaryVisible?id(30):null;
 delivery.confirmedAt=temporaryVisible?"2026-11-09T11:00:00Z":null;
 const{errors}=await mountMatchday(page,data);
 const card=page.locator('section[aria-labelledby="matchday-delivery-title"]').getByRole("article").filter({has:page.getByRole("heading",{name:"Entree",exact:true})});
 if(temporaryVisible){await expect(card).toContainText("Bevestigde publicatie: Gewone entree · versie 1");await expect(card.getByText(/^Bevestigd op:/)).toContainText("12:00");}
 else await expect(card).toContainText("Bevestigde publicatie: Weergave onbekend");
 const restored=structuredClone(data),after=restored.selected!.deliveries[0]!;after.status="restored";after.confirmedReleaseId=restoredRelease.id;after.confirmedAt="2026-11-09T11:05:00Z";
 await page.evaluate(workspace=>(globalThis as unknown as{updateMatchdayWorkspace:(workspace:unknown)=>void}).updateMatchdayWorkspace(workspace),restored);
 await expect(card).toContainText("Planning hervat");await expect(card).toContainText("Bevestigde publicatie: Gewone planning B · versie 7");
 const confirmation=card.getByText(/^Bevestigd op:/);await expect(confirmation).toContainText("12:05");await expect(confirmation).not.toContainText("12:00");
 if(temporaryVisible){await expect(card.getByText(/^Eerder tijdelijk frame:/)).toBeHidden();await card.getByText("Afleverdetails",{exact:true}).click();await expect(card.getByText(/^Eerder tijdelijk frame:/)).toContainText("12:00");}
 else await expect(card.getByText(/^Eerder tijdelijk frame:/)).toHaveCount(0);
 expect(errors).toEqual([]);
});

for(const status of["rendered","restored"]as const)test(`WDG-12 a legacy ${status} delivery only reuses frame time for the rendered release`,async({page})=>{
 const data=matchdayFixture(),delivery=data.selected!.deliveries[0]!;
 delivery.status=status;delivery.renderedAt="2026-11-09T11:00:00Z";delete(delivery as Partial<typeof delivery>).confirmedAt;
 const{errors}=await mountMatchday(page,data);
 const card=page.locator('section[aria-labelledby="matchday-delivery-title"]').getByRole("article").filter({has:page.getByRole("heading",{name:"Entree",exact:true})});
 if(status==="rendered"){await expect(card.getByText(/^Bevestigd op:/)).toContainText("12:00");await expect(card.getByText(/^Eerder tijdelijk frame:/)).toHaveCount(0);}
 else{await expect(card.getByText("Bevestigd op: Onbekend",{exact:true})).toBeVisible();await card.getByText("Afleverdetails",{exact:true}).click();await expect(card.getByText(/^Eerder tijdelijk frame:/)).toContainText("12:00");}
 expect(errors).toEqual([]);
});
