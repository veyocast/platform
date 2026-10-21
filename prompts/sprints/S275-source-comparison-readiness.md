# S275 — Gereedheid van bestaande Source-tegenproef

CI opS271/e9a2c6d8 gaf65PASS/1FAIL: RESP-0059(1024×768/sources). De raw productieknoppen zijn terecht44px en de oorspronkelijke Source-knoppen36,59375px. De bestaande expliciete touch-tegenproef herstelt min-height:0 alleen voor vergelijking; de meetwaarde bleef56px i.p.v.48,59375px, exact de nog niet toegepaste44pxregel. Dezelfde fixture kent al een echte hosttijd-readinesspoll voor de mobiele tegenproef bij<=760; die dekt deze1024-case niet. Geen billingcode beïnvloedt sources.

Root is enige writer op veyocast/s275-source-comparison-readiness, /home/codex/repos/castivo-s275. Exacte ownership: tests/control/sync-source-geometry-comparison.spec.ts (uitsluitend na toevoegen bestaande sourceFilterTouchCss wachten tot zes filterknoppen werkelijk computed min-height:0 tonen vóór normalizedmeasure), docs/s275-source-comparison-readiness.md, dit prompt, eigen TASK_LEDGER-regel bij afzonderlijk stabiel anker. Alle66registraties/IDs/asserts/geometrytoleranties/rawproductiebeelden/Source/timeoutgates blijven behouden. De bestaande2000ms/25,50,100,250pollgrens wordt hergebruikt; geen retry of ruimer tijdsbudget. Geen product-, dependency-, asset-, canon- of workflowwijziging.

Bewaar originele S271CI/log/artifact ongewijzigd. Controleer exact inverse buiten de nieuwe await, scopedlint en echte bestaande66Source-comparisoncases op390/1440 en de vier oorspronkelijke aanvullende viewports; allecasesincl1024 moeten groen met0skips/retries. Geen nieuwe testcase of volledige product/AA/Sourcepixel/vijf-rondenclaim. Normale exacte-headCI vóór integratie.
# Aanvullende native invoerreadiness uit exacte CI

De eerste Control-CI op96df3dd239 is579PASS/1FAIL/629bestaandeSKIP.
De oorspronkelijke trace toont dat `fill("")` de naam op `Kantinemenu`
liet staan; de volgende klik ging daarom terecht naar Vormgeving. De
geplande native kopfocus uit `move()` was nog niet afgewacht. Dit is geen
bewijs dat de validatie lege namen accepteert: de naam was niet leeg.

Ownership wordt vóór wijziging uitgebreid met alleen
`tests/control/sync-create-wizard.spec.ts`: in het bestaande geval voor
tijdelijk onvolledige naam/duur wachten op de bedoelde kopfocus na de twee
stapwissels, en expliciet bevestigen dat beide velden echt leeg zijn vóór de
bestaande assertions. Geen andere testbody, helper, timeout, tolerantie,
retry, skip of productcode wijzigen. Behoud originele CI-trace/logs en
onderscheid de waargenomen ongewijzigde waarde van de focusrace-inferentie.
Voer de gehele bestaande wizardspec native uit; de66 Sourcevergelijkingen
blijven ongewijzigd tegenover hun reeds gesloten lokale PASS.
