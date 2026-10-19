# S255 — Bewaarde Studio-touchzones

Status: de ene uitgebreide bestaande interactietest is rood → groen en scoped
lint is groen. Alle14 tijdelijke links zijn verwijderd, Chrome is werkelijk
gesloten en bron/dependency-/assetguards zijn groen. Volledige foundation,
strictspecTSC en echte geïntegreerde Next-capture blijven open. Root autoriseert
de normale vijf-bestandencommit, push en draft-PR afzonderlijk; de SHA/URL komen
in de overdracht. Geen deployment of volledige visuele reviewronde uitgevoerd.

De eigen sparse branch begint op
`49a12c45948210dd367402bdd252fe06966ae59b`. Preflight selecteerde1182 tekstbestanden
(11.056.927 blobbytes, 13.742.080 verwachte gealloceerde bytes); met16MiB
metadatareserve bleef174.014.464 bytes geraamde rootdiskruimte over. De schone
checkout liet189.067.264 bytes werkelijk vrij. Geen dependencies geïnstalleerd
of tijdelijke module-/assetlinks aangemaakt. Preflight staat in
`/dev/shm/veyocast-s255-saved-studio-touch/sparse-preflight.json`.

## Echte waarneming

De lopende A-map is
`/dev/shm/veyocast-s244-built-actual-captures/a6d2490d-dc9a-4ae9-b7bd-9de782d75f34`.
Een gelezen checkpoint had SHA
`eaabe4bef0e20e5dcda0d4aaebadd97cb592db50bc930ed538f5cde66ae80f8e`,
status `PREPARING_READONLY`,219 beelden en5 geregistreerde errors. Het is een
tijdsgebonden metadataread, geen complete of bevroren eindcohort.

- `0006-actual-d088383f07fd`, PNG-SHA
  `09d5a98e6e17cec8dcb43af1a75d2bc1f8a136d81e551fb809c573db8b869832`.
- `0007-actual-61780bf66cfe`, PNG-SHA
  `c523cbc57fa3a0f109c07e96103b37bbf54b874d013b1627e37a2e6796691839`.

Beide native390-frames en hun bestaande computed-JSON tonen dezelfde enabled
uitlijning: Links/Midden/Rechts, font10px, hoogte29,5px, breedte circa98,67px.
`Clubbeelden en achtergrond` is een native summary met font14px en
310 × 21,6875px. De beelden zijn rechtstreeks bekeken met `view_image`; geen
contactsheet, verwerking, nieuw browserrequest of DOM-mutatie gebruikt.

De 10px-uitlijnregel komt uit de overgenomen Source `.vc-segmented > button`.
Dat verklaart de herkomst maar vervangt de geldende44px-touchgrens niet.
Deze taak raakt alleen de eigen saved-propertiesmodule, waar S241 al de
14px/44px-uitzondering voor andere auteurvelden vastlegt.

## Afgebakende wijziging

De combinatie `.sync-control` + eigen propertiesmodule +
`.vc-segmented[aria-labelledby] > button` vergroot uitsluitend de named
uitlijning naar minimaal44px en14px tekst. De data-modegroep met `aria-label`
valt erbuiten. Native summaries binnen diezelfde properties krijgen minimaal
44px en verticale padding; display/listmarker en browserbediening blijven
native. Het palet en alle bestaande handlers blijven behouden.

Geen componentbron, presentatiegegevens, previewcanvas, renderer, locked asset,
Sourcebestand, writer, autorisatie, immutable historie, nonce/CAS, afhankelijkheid
of DB verandert. De CSS-selectors omvatten uitsluitend auteurbediening.

## Voorbereide verificatie

De bestaande `sync-studio-workflows.spec.ts`-testcase
`an existing OnzeTrots design can choose Clubmuur again and retain it after saving and reloading`
behoudt alle eerdere checks voor achtergrondkeuze, canvas-background-URL,
één save, opgeslagen configuratie, reload en foutloze controller. De uitbreiding
toetst echte 390px-entry, de drie uitlijnknoppen, native summary-Enter open/dicht,
uitlijnkeuze en dezelfde controls op1440px na de bestaande save/reload. aXe wordt
alleen op `.vc-studio-properties` toegepast; het contentcanvas krijgt geen
algemene contrast- of AA-claim. Geen tolerantie, skip, deadline of retry wijzigt.

Dit is een bestaande gecontroleerde HTTP-/Reactfixture@3313. Save wordt in de
fixture bewaard; er is geen verbinding met de live QA-database. De volledige
testprefix vóór deze bestaande testcase is bytegelijk; alle oorspronkelijke
regels van die testcase zijn in dezelfde volgorde behouden. Productmodule-SHA
`04ecad1f112de039aa0aac14037dc989e2edcc10ec488da1423c101ffba3e01a` en spec-SHA
`fdbe2569fbe42b8e08581eeb68d7597afdbea0b71ca4212e748339c84c1400ba` zijn tussen
rood en groen exact behouden, behalve de expliciet teruggelegde oude CSS.

## Werkelijke lokale uitvoering

Alle onderstaande bewijzen staan in
`/dev/shm/veyocast-s255-saved-studio-touch/` en blijven afzonderlijk behouden.
Eén worker, nul retries, CPU4,5, Nodeheap1024MiB, private RAM-temp/output en
`PLAYWRIGHT_EXTERNAL_SERVERS=1`; geen Next-server/build of installatie gestart.

1. Session53148 eindigde werkelijk met exit1: de sparse bestandsselectie miste
   het getrackte runtimebestand `tokens/veyocast-design-tokens.css`, vóór de UI-asserts.
   `first-red-report.json`, SHA
   `1eaa90be087f446a4467a03c1aafa35f96e38fc3dd619f1a9904c7699ebbbeac`, is een
   afzonderlijke infrastructuurfout, geen CSS-roodbewijs. De kandidaat-CSS is
   tussen de pogingen aantoonbaar hersteld. Root gaf daarna uitsluitend de
   veertiende, byte-exacte read-only runtime-tokenlink vrij; geen tokengeneratie
   of -edit. De oorspronkelijke diagnose dat het bestand Git-ignored of alleen
   gegenereerd zou zijn, was onjuist: het is getrackt als blob `0a3c574a…`.
   De oude ENOENT-reports en metadata zijn ongewijzigd behouden; een afzonderlijk
   `token-origin-correction.json` legt de gecorrigeerde herkomst vast.
2. Session98845 eindigde werkelijk met exit1,1FAIL/0SKIP in8,90s. Met exact de
   originele CSS-SHA
   `4d373f5bf84741c67b6bc5ce5c98a3ca8b2125e8f4bba111abb2f00f419957d0`
   rapporteerde dezelfde test werkelijk `Links` font10px tegenover de vereiste
   14px. `baseline-red-report.json` SHA
   `b14d77828e53b62718f88d1b0968a6d8493315d595667e64e194f7045bed79bf`.
3. Session70895 eindigde werkelijk met exit0,1PASS/0SKIP/0retry in6,20s. Exact
   dezelfde testcase met kandidaat-CSS toetste14px/min44px, Enter open/dicht,
   echte uitlijnkeuze, Clubmuur-keuze, één save, herladen,1440px-geometrie en
   properties-aXe met0violations. `final-report.json` SHA
   `1a87c2cb1d08fe4fbf75daf5eeb8d9ecca81f52f9830e6ab95a349179f79e27a`.
4. Scoped ESLint op de gewijzigde spec: session64875 werkelijk exit0. Eerdere
   `node --check` en de diffcheck eindigden ook met exit0. Er is geen volledige
   TypeScript-/foundationclaim; daarvoor volgt een afzonderlijk rootqueueslot.

`local-infrastructure-plan.json` en `-v2.json` blijven historisch bytegelijk.
Het uitgevoerde plan `local-infrastructure-plan-v3.json` (SHA
`ec33ceab4d662869593d4327a1bc996c6be700ef49cb701c70a84da6b4f71456`) bevat de
12 bestaande modulelinks, één assetslink en één read-only runtime-tokenlink.
De tokenbytes bleven18.455B/SHA
`368399f509423f166b8f8d7969a637d1a14772af34e2ced096137186fd66641c`, mode0640.
Geen gedeelde module of bronbestand werd gewijzigd.

`closure.json` SHA
`58e4059d21e97e260c22cbcf0aaadd36d1909ba995011ee6bfb7ca556dd11cc2`
legt echte runnerexits, Chrome[], exact verwijderde14 eigen symlinks en lege
zelfgemaakte oudermappen vast. RootHEAD49a,15 bron/dependency/tokenbestanden,
16 assets (2.782.734B) met SHA/bytes/mode en het gebonden installclosedproof
bleven gelijk; de eigen Gitstatus bevatte uitsluitend de vijf toegestane paden.
Alle oude reports, traces, bron-/kandidaatbytes en plannen zijn behouden. De
queue is daarna aan root/CI teruggegeven. Dit is een gerichte fixtureproef;
previewpixelvergelijking, volledige cohortacceptatie en vijf rondes zijn niet
bewezen.
