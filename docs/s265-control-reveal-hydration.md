# S265 — Control wacht op resterende serverinvoegingen

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

## Correctie

De bestaande S250-parserbeveiliging in gepind Next 15.5.20 wacht voortaan voor
het gemarkeerde Control-document ook zolang de native `window.$RB`-array
entries bevat. De bestaande 8ms-herplanning geeft de browser gelegenheid de
serverfragmenten in te voegen. De queue en React-cursors worden alleen gelezen;
de oorspronkelijke Schedulerbody, fouten en herstelpaden blijven behouden.

Alleen `scheduler.production.js` en `scheduler.development.js` veranderen.
Node zonder document en documenten zonder Control-optin behouden de bypass.
Een volledige geïsoleerde Next-copy is vóór/na vergeleken: alle overige entries
en de gedeelde canonieke installatie zijn gelijk. `$RB` is een interne Fizz-grens
van deze vastgezette versie; een frameworkupdate vereist herbeoordeling.

Het open [React-issue37321](https://github.com/react/react/issues/37321)
beschrijft een parser-/revealrace en een vergelijkbare Schedulergrens. De
bijbehorende [PR37835](https://github.com/react/react/pull/37835) was op
20 oktober 2026 nog open. Dit is context, geen claim dat upstream een definitieve
fix heeft uitgebracht. De eigen diagnose en regressietests vormen het lokale bewijs.

## Lokale regressie en dependencycontrole

- Nieuwe publieke Schedulercontracttest: de oude parser-only versie faalt
  deterministisch in productie én development omdat de callback al bij twee
  pending nodes loopt. De kandidaat wacht tot de native Node-hostturn de queue
  vrijgeeft. Een document/windowstub bewijst hier de callbackgrens, geen Nextpagina.
- Kandidaat: **5/5 tests, 3,8s, nul skips/retries**, waaronder de vier behouden
  echte SSR/Suspense/browsercases. De opzettelijke structurele fout blijft React418
  melden. Lege queues, ongemarkeerde documenten en ontbrekend/null-window zijn meegenomen.
- Gerichte ESLint en strict spec-typecheck: echte exit0.
- PatchSHA `c6c7da4d389b1f7f5f1bf95cf5976a4753d92f4ed0977e45dc1941a24b5adcd5`.
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

Normale CI, daadwerkelijke geïntegreerde installatie, foundation, nieuwe
productiebuilds en de volledige ongewijzigde browserroutes blijven vereist.
De afgebroken leesrequest vraagt een eigen beoordeling. Er zijn **0/5 volledige
visuele reviewrondes** afgerond en geen nieuwe staging-/productie-uitrol uitgevoerd.
