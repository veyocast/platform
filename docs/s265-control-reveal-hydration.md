# S265 — Control wacht tot document en serverinvoegingen gereed zijn

De actuele normale productiebuild op `177e5d02…` meldde zeven React418-fouten
tijdens 182 route-readbacks en 559 native beelden. De 22 axe-metingen hadden
geen overtredingen; browser-, bron-, sessie-, build- en databaseguards sloten
gelijk af. De routecontrole bleef rood. Een van twee toegestane leesrequests werd
bovendien bij navigatie afgebroken; dat afzonderlijke transportsignaal blijft open.

Een expliciet geïnstrumenteerde diagnose op dezelfde build stopte op de eerste
mismatch in LED Scores. De oorspronkelijke mismatch/throw bleef aanwezig:
React verwachtte een `div`, de cursor wees naar een Suspense-comment en de
native Fizz-wachtrij bevatte nog twee nodes. Het document was al `interactive`.
De diagnose verving uitsluitend drie gepinde tijdelijke JS-responses met een
tag-only meetpunt bij de bestaande throw. Zij wijzigde geen productbron of
buildbestand en is geen acceptatiebewijs van een ongewijzigde build.

De eerste kandidaat op `188c806c…` doorstond de vier toepasselijke CI-workflows,
de gewone installatie en een echte productiebuild. Een extra ongewijzigde
browserproef bleef echter rood: 29/36 gevallen, twee React418-fouten en een
accountmenu dat na een vroege klik niet opende. Een afzonderlijk gedeclareerd
meetpunt registreerde vervolgens twee mismatches vóór de eerste klik: opnieuw
een verwachte `div` tegenover een Suspense-comment, nu bij een lege queue en
`interactive`. Dit toont dat de queuegrens alleen onvoldoende is; deze
geïnstrumenteerde 36-gevalproef is geen acceptatiebewijs.

## Correctie

De bestaande S250-beveiliging in gepind Next 15.5.20 wacht voor het gemarkeerde
Control-document tot `readyState` volledig `complete` is en daarnaast zolang
de native `window.$RB`-array entries bevat. De bestaande 8ms-herplanning geeft
de browser gelegenheid de documentfase en serverinvoegingen af te ronden.
De queue en React-cursors worden alleen gelezen; de oorspronkelijke
Schedulerbody, fouten en herstelpaden blijven behouden. De echte nieuwe build
moet deze strengere grens nog bevestigen.

Binnen Next veranderen alleen `scheduler.production.js` en
`scheduler.development.js`.
Node zonder document en documenten zonder Control-optin behouden de bypass.
Een volledige geïsoleerde Next-copy is vóór/na vergeleken: alle overige entries
en de gedeelde canonieke installatie zijn gelijk. `$RB` is een interne Fizz-grens
van deze vastgezette versie; een frameworkupdate vereist herbeoordeling.

Het accountmenu gebruikt daarnaast de bestaande `isInteractive`-grens van de
shell, net als zoeken en navigatieknoppen. De serverknop blijft disabled tot
de echte clienteffecten gestart zijn. Beide varianten krijgen deze expliciete
prop; na initialisatie blijven account, voorkeuren en uitloggen beschikbaar.
De platformfixture krijgt uitsluitend de exacte nieuwe shellbronhash.

Het open [React-issue37321](https://github.com/react/react/issues/37321)
beschrijft een parser-/revealrace en een vergelijkbare Schedulergrens. De
bijbehorende [PR37835](https://github.com/react/react/pull/37835) was op
20 oktober 2026 nog open. Dit is context, geen claim dat upstream een definitieve
fix heeft uitgebracht. De eigen diagnose en regressietests vormen het lokale bewijs.

## Lokale regressie en dependencycontrole

- Eerste publieke Schedulercontracttest: de oude parser-only versie faalt
  deterministisch in productie én development omdat de callback al bij twee
  pending nodes loopt. De kandidaat wacht tot de native Node-hostturn de queue
  vrijgeeft. Een document/windowstub bewijst hier de callbackgrens, geen Nextpagina.
- Eerste kandidaat: **5/5 tests, 3,8s, nul skips/retries**, waaronder de vier behouden
  echte SSR/Suspense/browsercases. De opzettelijke structurele fout blijft React418
  melden. Lege queues, ongemarkeerde documenten en ontbrekend/null-window zijn meegenomen.
- Nieuwe lege-queue/interactieve contracttest en twee echte shell-SSR-tests
  falen alle drie op 188c. De herziening slaagt in **16/16 gevallen, 20,3s,
  nul skips/retries**: vier behouden echte streaming/Suspense/browsergevallen,
  twee Schedulercontracten, twee serverknopgevallen, zes bestaande complete
  account/voorkeur/aXe-gevallen en twee platformlayouts. Een opzettelijke
  structurele mismatch blijft React418 melden. Node-documentstubs bewijzen
  callbackvolgorde; zij vervangen geen actuele Next-routeacceptatie.
- Gerichte ESLint, volledige Control-typecheck en strict spec-typecheck van
  de herziening: alle echte exit0.
- Nieuwe patchSHA `4aa457ae66bd40d5bcf23ace1d2bdcdd26eb6bf05dc68adb3d9388bce352ee88`.
  Nieuwe lockSHA `f4df9b0ce4d4c67d0eca643bd0278867462ca4f345fef2c1f59c82693e2c75b8`.
  De twintig manifests zijn bytegelijk. Alleen vijf oude patchhashverwijzingen
  zijn gesynchroniseerd; na hashterugzetting zijn de lockbytes exact gelijk.
  Normale `pnpm install --frozen-lockfile --lockfile-only --offline --ignore-scripts`
  valideert de nieuwe lock met exit0 zonder node_modules te maken. Alle 20 importers,
  1387 packages en 1409 snapshots behouden versies, integrities en relaties.

De eerste gewone offline lock-only poging miste lokale metadata voor een
ongewijzigde semverdependency en is rood bewaard. Daarna zijn uitsluitend de
patchchecksums gesynchroniseerd en door de normale frozen-pnpmroute gevalideerd.
Geen online resolver of gewijzigde dependencyversie is gebruikt.

## Bewijs en vrijgavegrens

Private lokale bewijsroots zijn behouden:

- Normale routecontrole `d559bc45…`, checkpointSHA `4ec65a573ca57c0bb4701f0a1e1a532a81036c6688c11c8c50d991fd52a97e4a`.
- Throw-site `0c04366e…`, checkpointSHA `02c751b7fa17d41afde0107050935d533f319cdeec089bc6bea6503d3d4e6101`.
- Baselinefixture `c95a2cf5…`: echte exit1; kandidaat `e808370b…`: echte exit0,
  gesloten eigen processen, geen pressurestop of cleanupfout.
- Geïsoleerde Next-copy `737a7f10…`, closureSHA `43f3ef6dab79ba247ef1d700f2818342772e2c4d8d4b64fa096427f298a01a21`.
- Frozen-lockvalidatie `a1c15a36…`: echte exit0; de oorspronkelijke offlinefout
  `59938321…` blijft afzonderlijk bewaard.
- Nieuwe baseline `502da958…`: drie echte regressiefouten; herziening
  `c3352f35…`: 16/16 echte exit0, gesloten eigen processen.
- Nieuwe geïsoleerde Next-copy `dac68e4e…`: alleen twee Schedulerpayloads
  gewijzigd; de normale geïnstalleerde 188c-kandidaat blijft onaangeraakt.
- Nieuwe frozen-lockvalidatie `08917e4f…`: normale offline exit0, precies vijf
  patchhashverwijzingen, overige lockbytes/manifests gelijk.

Normale CI, daadwerkelijke geïntegreerde installatie, foundation, nieuwe
productiebuilds en de volledige ongewijzigde browserroutes blijven vereist.
De afgebroken leesrequest vraagt een eigen beoordeling. Er zijn **0/5 volledige
visuele reviewrondes** afgerond en geen nieuwe staging-/productie-uitrol uitgevoerd.
