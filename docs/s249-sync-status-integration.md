# S249 — Neutrale status in de geïntegreerde test

S245 verwachtte dat iedere overige status bij het laden van de Sync-adapter
exact dezelfde kleur hield. S247 heeft daarna de daadwerkelijk onleesbare
neutrale accountstatus binnen Sync naar de bestaande vaste Source-inkt
`--text` gebracht. De geïntegreerde test verwacht nu deze goedgekeurde
presentatie. Er verandert geen productcode of CSS.

## Oorspronkelijke hosted fout

PR270 HEAD `bf458beeeab68f066d7ce5eaf6aa7101a93205b8`, Control-job
[117908920464](https://github.com/veyocast/platform/actions/runs/39206018717/job/117908920464):
**545 PASS / 2 FAIL / 629 bestaande SKIP**, totaal1176. Beide bestaande
`tests/control/sync-status-contrast.spec.ts:76`-cases390/1440 falen bij de
oorspronkelijke regel116: de negativecontrole noemt
`Andere gedeelde status neutral` ongewijzigd.

De ruwe fout toont uitsluitend de bedoelde voorgrond-/currentColor-dotdelta:
RGB23/32/30→RGB18/46/50. Het lichte contrast gaat van14,895946 naar12,850936:1;
border en alle andere gerapporteerde properties blijven gelijk. De S247-doc
beschrijft expliciet dezelfde Source-inkt en de bijbehorende dotdelta. Dit is
een botsing tussen testverwachtingen en geen bewezen nieuwe productfout.

Het volledige oorspronkelijke log blijft ongewijzigd onder
`/dev/shm/veyocast-s249-status-integration/original-control-job117908920464.log`,
327.483bytes, SHA256
`356e42f6bf4def26f8d98f14cc9ad53bd06acbdf5d67e0859fda87453c2d2c1a`.
De cases stoppen in Licht bij deze harde assertion. De daaropvolgende
gerichte aXe-, Donker- en shellnavigatiechecks zijn daardoor op deze hosted
head niet voltooid; de545 PASS maken die dekkingsgrens niet groen.

## Beperkte testcorrectie

Dezelfde twee cases behouden de vier bestaande amber/succesdoelen en alle
bestaande assertions voor statusbetekenis, tekst, achtergrond, border,
geometrie, fonts, dots, opgeslagen voorkeur, navigatie en focus. Andere
statuskleuren en de bestaande successbadge buiten Sync blijven volledige
negatieve voor/na-controles.

De neutrale gedeelde badge binnen Sync wordt positief gecontroleerd op de
werkelijk opgeloste `--text`-rol, directetekstcontrast minstens4,5 en een dot
die currentColor volgt. Alleen tekstkleur/contrast en dotkleur mogen ten
opzichte van de oude presentatie veranderen. Alle overige neutrale properties,
dotafmetingen en aria-hidden blijven exact gelijk. De volledige geïntegreerde
neutrale presentatie moet in Licht en opgeslagen Donker gelijk zijn. Een extra
echte gedeelde neutrale badge buiten Sync behoudt juist zijn volledige
oorspronkelijke presentatie. De bestaande gerichte aXe-controle omvat nu ook
de neutrale Sync-badge, met nul incomplete als vereiste.

De fixture blijft de echte componenten, het operationele readmodel, de
SSRvoorkeursbootstrap en de echte shell met gecontroleerde Next/session/action-
transportgrens renderen. Dit levert geen live Auth/RLS-, DB-, provider-,
hardware- of volledige routejourneyacceptatie op. Geen nieuwe cases, skips,
retries, limieten of versoepelde toleranties.

## Verificatiestatus

Scoped ESLint, strikte specTypeScript en diffcheck zijn groen. Na rootreview
slagen exact dezelfde twee Chromiumcases390/1440: **2 PASS / 0 FAIL / 0 SKIP**,
één worker en nul retries. Playwright rapporteert7,0s; de volledige opdracht
eindigt na7,619s metexit0. Neutraal meet in Licht én opgeslagen Donker op beide
breedtes **12,850936:1**, met voorgrondRGB18/46/50 en dezelfde currentColor-dot.
De vier gerichte aXe-rapporten bevatten nul violations én nul incomplete.
Alle oorspronkelijke amber/success-, overige negatieve-, voorkeurs-,
marker-/reduced-motion-/Escape-/focus-, pageerror- en nul-writegates slagen.

De testbron is SHA256
`61dc160de720ae53d1bbc6af2a50132939fd0297cbcaf26c4ae802c0f160fcd9`.
Het groene log `green-v2.log` heeft SHA256
`9936a221a7512f008e41ace24e9437efe3331c6062569ebe199195707183f252`.
Runner76350 eindigt werkelijk metexit0; Chromium1228/PID1014201 sluit netjes
metexit0. Een nieuwe `/proc`-scan, inclusief chrome-headless-shell, vindt geen
Chromeprocessen. Geen eigen Nextbuild, runtime of databaseactie.

De sparse worktree heeft dezelfde exacte basis en bewezen bestaande
dependencies. Alle twaalf tijdelijke workspace-node_moduleslinks en de
pathguarded assets-symlink zijn na uitvoering exact verwijderd. Alle16
assethashes blijven gelijk; Gitstatus bevat uitsluitend de vier toegewezen
paden. De oorspronkelijke ENOSPC-checkoutpoging, metadata, selectieomvang en
asset-/governancehashes staan apart in de RAMbewijsmap.

De eerste `pnpm exec`-lintpoging detecteerde de incomplete sparse workspace en
brak zijn automatische installvoorbereiding vóór modulesverwijdering af met
`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. Geen install of dependencywijziging
is uitgevoerd. De geslaagde statics gebruiken rechtstreeks de bestaande
gepinde ESLint-/TypeScript-node-CLIs via de geautoriseerde dependencylinks,
CPU4,5 en maximaal1024MiB Nodeheap. Ook de oorspronkelijke afgebroken poging
blijft als infrastructuurlog bewaard.

De eerste twee-casepoging `green-v1.log` eindigt vóór Chromiumlaunch met
één fixtureFAIL en één niet-uitgevoerde case. De sparse checkout had nog geen
workspace-node_moduleslink voor de echte UI-package; daardoor konden clsx en
tailwind-merge niet worden opgelost. LogSHA256
`e36ea17d32623bbb8c09f7101a774eb6796d7e1b03b31fde4d25b1217a90d8d5`,
JSONrapport en trace blijven behouden. Root autoriseerde de noodzakelijke
bestaande workspace-dependencylinks. De echte ongewijzigde beforeAll-compile
slaagt daarna eerst afzonderlijk zonder browser; dezelfde ongewijzigde
testbron wordt vervolgens groen. Geen installatie, CSSstub, assertionwijziging
of productfix voor deze infrastructuurfout.

Veertien statische invariantcontroles bevestigen onder andere de bytegelijke
volledige shell-/focus-/reduced-motionstaart, de bytegelijke oorspronkelijke
amber/successasserties, dezelfde vier targets, alle andere negatieve checks,
gelijke deadlines/caseaantallen en uitsluitend de eigen nieuwe ledgerregel.
Finale proof en bestandsfreeze:
`/dev/shm/veyocast-s249-status-integration/final-proof.json` en `freeze.json`.

Een volledige foundation wordt op deze beperkte sparse checkout niet
geclaimd of opnieuw uitgevoerd. Gecombineerde30/30 foundation, exacte hostedCI, sluitende gebouwde
capturecohort, vijf onafhankelijke volledige reviewronden en staging/productie
blijven afzonderlijke rootgates. De echte React418-diagnose en eerdere
captureharnasfouten blijven daarvan losstaande open bewijzen. Root heeft
de gerichte delta en de groene afsluiting gereviewd en een gewone commit,
push en eigen draftPR naar de S244-integratiebranch geautoriseerd. Geen
mainmerge of deployment door deze writer.
