# S292 — Onderzoek en uitvoering

## Vastgestelde baseline

De oorspronkelijke werkboom stond schoon op `b57b5372`. Na `git fetch origin`
bleek remote main `4cb895c363c69bf754184902e804fda2792ac85c`; S292 werkt in een
afzonderlijke worktree op die actuele baseline. Geen repository teruggezet.

Alle vier publieke Control/Player-healthroutes rapporteerden op 25 oktober
dezelfde volledige `4cb895c3…`-SHA. De productiegeschiedenis eindigt op migratie
`20261024173000`. Stagingrun
[40153130765](https://github.com/veyocast/platform/actions/runs/40153130765) en
productionrun
[40154302557](https://github.com/veyocast/platform/actions/runs/40154302557)
zijn geslaagd. Dit is baselinebewijs, geen S292-uitrol.

De expliciet door de gebruiker goedgekeurde read-only productieprobe
[40200937195](https://github.com/veyocast/platform/actions/runs/40200937195)
bevestigt een gezonde, niet herstartende worker op dezelfde SHA en actuele
readiness. Zes gekoppelde apparaten rapporteren verschillende oudere
appversies; het recent actieve scherm meldt Static LG / Chrome 79. Geen van
deze readbacks bewijst een nieuwe DOM-v2-capability of fysieke acceptatie.

## Bewezen fouten en correcties

**RSS.** De daadwerkelijk gemigreerde `complete_scheduled_rss_sync_v2` weigert
meer dan 51 media-objecten. De echte veilige AD-fetch/parser levert voor zowel
`/nieuws/rss.xml` als `/voetbal/rss.xml` 30 artikelen, 30 hero-kandidaten, 30 QR's
en één channel-logo: maximaal 61 objecten. De drie betrokken bronnen gebruiken
deze twee URL's; Sportnieuws en Voetbal wijzen beide naar `/voetbal/rss.xml`.
Productiedatabaselogs rond 13:32 UTC melden `invalid RSS payload`, gelijk aan de
mislukte bronruns. De zichtbare generieke fout maskeert deze completionfout.
Vorige bruikbare artikelen bestaan nog; de externe feeds waren tijdens deze
controle bereikbaar. Ook Omroep West heeft dezelfde interne completionfout.

De forwardmigratie begrenst vijftig artikelen op maximaal 101 media-objecten
en maximaal twee per artikel plus één logo. De kopgrens is consequent 400
tekens in parser, canoniek contract, tabel en huidige completionfuncties;
overlange koppen falen expliciet vóór mediawerk. Geen kop afgekapt om groen te
worden. Leaseverlenging houdt een geldige grote batch in eigendom; een nieuwere
poging met dezelfde workernaam kan niet door een oude poging worden afgerond
of afgekeurd. Een exact completionreceipt wordt transactioneel bewaard, zodat
een verloren antwoord veilig kan worden herhaald. Veilige completioncode,
fase en bestaande run-correlatie blijven beschikbaar, zonder raw DB-tekst.

**Verjaardagen.** De echte wizardcompiler verwijdert de blueprintbinding en
herstelde `sportlink.birthdays` niet. De rijke databasebuilder routeert juist
op die sleutel. De compiler herstelt de binding nu. Een bevestigde lege feed
gebruikt het echte succesvolle `public_people`-syncmoment wanneer er geen
persoonrecord met `source_fetched_at` is. Er wordt geen actuele tijd verzonnen.
De bron mag 250 records bevatten; periode/team/privacyselectie vindt plaats
vóór de afzonderlijke presentatiegrens van 200 rijen en bestaande duurgrenzen.
Schema-, identiteit-, freshness- en projectiefouten worden niet langer als
selectie-overflow gemeld. De historische Control-logregel voor correlatie
`0bf762d9-6fa8-46ce-8f07-2d4c02af4f36` is nog niet teruggelezen; deze specifieke
screenshot is dus niet uitsluitend op correlatie-ID aan de oorzaak gekoppeld.

**Matchday.** Een read-only aanroep van de huidige productiebronbuilder voor
het aanwezige ontwerp en team `218380` telt **6 resultaten en 12 fixtures
zonder dat geselecteerde team**. De live functie bevat de `both OR predicate`
uit S291. De nieuwe selectie vereist altijd exact teamlidmaatschap, daarna pas
thuis/uit/both. De projector controleert bovendien ieder wedstrijditem naast
de datasetcontext. Resultaten vereisen een gespeelde status, echte score en
aftraptijd in het verleden; fixtures vereisen een toekomstige geplande aftrap.
Stabiele tijd-/ID-sortering bepaalt de volgorde. De volledige poulestand blijft
behouden. Een ambigue automatische competitie blijft expliciet onbeschikbaar;
een geldig vastgezette context zonder A-wedstrijden blijft leeg, ook als B wel
wedstrijden heeft.

**Player-resources.** Een echte DOM-browsertest reproduceert bij een wijziging
van alleen gecontroleerde standgegevens zes extra `FontFace.load`-aanroepen.
De voorbereiding hing af van nieuwe objectreferenties. De component gebruikt
nu de renderer en de daadwerkelijke lokale resource-identiteiten als sleutel;
dezelfde bronupdate doet nul extra fontloads en rapporteert niet nogmaals een
eerste frame. Echte gewijzigde resources blijven de volledige voorbereiding
doorlopen. Beeld-URL's worden vóór decode gededupliceerd. Dit is gemeten
aanroeptelling, geen gemeten download-, CPU- of volledige latentieverbetering.

## Routekaart en versiegrenzen

| Ingang | Preview en opslag | Publicatie en Player |
|---|---|---|
| Content / algemene Studio | Bestaande directe gedeelde DOM-preview; revision/idempotency | Handmatige historische documenten houden hun bestaande geregistreerde uitvoer |
| Sportlink Studio | Wizardcompiler → read-only preview-RPC → canonieke payload → projector → dezelfde DOM-compositie | Nieuwe opt-in definitie → lichte descriptorqueue → ready zonder capture; originele assets en app shell gecontroleerd vóór eerste frame |
| Nieuws/RSS | Veilige serverfetch → parser → echte foto's/QR/logo → transactionele completion; preview leest opgeslagen set | Zelfde onafhankelijke protocol-2-route; gewone feiten verversen via published_dynamic_data |
| Twelve / Sync Menu | Echte handmatige/Twelve-productbron, goedgekeurde prijs-/configuratiebinding en directe gedeelde menucompositie | Nieuwe opt-in Sync-menu's gebruiken protocol 2; gepubliceerde prijzen behouden hun bestaande expliciete goedkeuringsregels |
| Historische MenuDocument / Sites Menu Studio | Eigen MenuDocument/widget/prijsroute en SitesMenuWidgets/SitesApprovedMenu; eigen directe DOM-preview/opslag | Behoudt de bestaande binaire publicatievoorwaarden. Geen ongefundeerde claim dat deze andere route is omgebouwd of dezelfde timings heeft |

Nieuwe protocol-2-uitvoer is een `composition` met één immutable JSON-original,
maximaal 550.000 bytes, zonder poster. De descriptor bevat alleen bekende
productrenderer, presentatie en gecontroleerde resource-identiteiten. Fonts,
originele foto's en logo's blijven afzonderlijke checksumassets. De Player
krijgt geen providercredentials, remote HTML of uitvoerbare templates.

Een expliciete `sync-dynamic-v2` consumer krijgt manifest 2. De bijgewerkte
standalone LG vraagt expliciet het bestaande binary-v1-contract en bevestigt
de werkelijk getoonde datarevisie na paint. Nieuwe feiten gaan op een itemgrens
in en de vorige getoonde set van dezelfde publicatie blijft herstelbaar.
Oudere clients zonder deze onderhandeling behouden hun bevroren binary. De oudere strikte
metadata/fallbackcontrole blijft ongewijzigd. Werkelijke legacyvraag activeert
de bestaande cache met drie begrensde slots; een cache die nog voorbereidt
houdt die player bij zijn laatste werkende release. Moderne doelen wachten
daar niet op. Download bestand is een afzonderlijke, bevoegde aanvraag; dezelfde
inhoud hergebruikt de uitvoer en een concept wordt niet ongemeld gepubliceerd.

Een eigen DOM-workerclaim voorkomt wachten achter een lange native export.
De bestaande bron-/exportlussen blijven gescheiden en delen één compact hint-
request. Leases, retries, actuele revisies, oorspronkelijke assetautorisatie en
referentiegebonden opruiming blijven gelden. Een read-only inventaris telt 369 gegenereerde beeldrecords (5.789.612
geregistreerde bytes), 12 release-itemreferenties en 9 verschillende objectpaden.
Dit is metadata, geen gedeelde-objectbesparing. Er zijn geen productieassets
verwijderd. Een moderne bronupdate zonder legacyvraag doet geen capture.
Observation-only tijden en signed URL's veranderen de semantische identiteit
niet; de Amsterdamse verjaardagselectiedag blijft wel onderdeel daarvan.

De producer staat standaard uit. Activeren vereist een service-only, gelogde
opdracht met de geverifieerde consumer-SHA. Dit is geen toestemming om bestaande
playlistinhoud of planningen te vervangen. Historische releases blijven immutable.

## Offline en echte zichtbaarheid

De nieuwe route controleert de bestaande service-workercontroller, matching
cached document/code/styles, descriptorchecksums, rendererfonts en alle beelden.
Nieuwe feiten gaan op een natuurlijke grens in. De lokale herstelversie wordt
pas na een zichtbaar, niet-nul frame vastgelegd; heartbeat bevestigt afzonderlijk
snapshot, contentHash en dataRevision. Een foutieve kandidaat overschrijft die
herstelversie niet. Een renderexception herstelt de vorige geverifieerde data.
De bestaande versie-1-herstelplaats blijft beschikbaar voor een approllback;
naast de actieve DOM-versie wordt maximaal één eerdere DOM-versie behouden.

De nieuwe browsergevallen controleren echte fonts, foto, QR en leverancierlogo,
beide oriëntaties/thema's, natuurlijke datawissel zonder extra descriptor/font-
/resource-downloads, lagere revisies, corrupte descriptor en origineel beeld,
offline reload en een echte geïnjecteerde React-layoutfout met herstel en behoud
van de versie-1-cache. Dit zijn Chromiumproeven, geen fysieke LG-/Android-PASS.

## Metingen en verificatie

Alle muterende SQL-proeven draaien in de eigen database `veyocast-s292` op
localhost 63271 en rollen fixtures terug. Gedeelde/hosted databases zijn niet
hersteld of gereset. De forwardmigraties verruimen RSS begrensd en voegen een
nieuwe contractversie toe; oude RPC-signaturen blijven beschikbaar.

- Echte compiler → preview-RPC → payload → projector → OnzeTrots-renderer en
  guarded create: 12 birthdaycombinaties (0/8 personen, 7/14/21 dagen, 2 formaten).
- Echte guarded Source-create → nieuwe workerclaim → descriptorcompletion →
  Publisher batch → targetpublicatie: Menu/RSS × twee formaten. Bronwijziging
  verhoogt alleen dataRevision 1→2; identieke hercontrole houdt 2, zonder extra
  snapshot/publicatie/export. Lease-/tenantpadfences en exacte replay werken.
- Een exportaanvraag voor een ongepubliceerd ontwerp maakt nul releases.
  Een bezette zware exportlease blokkeert een tweede DOM-ontwerp niet.
- RSS-SQL: 25/26/50 artikelen met alle maximaal 101 media, langere koppen,
  optioneel ontbrekende foto, atomair behoud, leases en idempotente retry.
  Matchday controleert ieder A/B/A2-item en volledige stand. De volledige
  SQL-run telt 145 bestanden en 4.799 assertions; database-lint heeft nul findings.

Een lokale native meting van de twee bestaande routes in de kandidaatbuild
levert Menu 2.385 bytes descriptor tegenover 2.533.177 bytes MP4 + 2.071.985 bytes
poster; RSS met drie pagina's 3.022 bytes tegenover 7.889.668 bytes MP4 +
2.634.241 bytes poster. De exports duurden één keer 34,30 s en 84,93 s (4 s/120
frames en 12 s/360 frames, Chromium, FFmpeg 5.1.9, gedeelde development-VPS,
encodercontainer maximaal 2 CPU/1 GiB). Geen productie-/oude-SHA-baseline en geen
p95 voor exports. Er is lokaal geen echte Storage-upload bij deze vergelijking.

Per fixture zijn 30 pure descriptorvoorbereidingen in hetzelfde proces gemeten
(inclusief de eerste koude aanroep; geen losse cold-start-p95): Menu
landscape p50 0,73 ms/p95 2,21 ms; portrait 0,65/1,13 ms; RSS landscape
0,83/1,29 ms, portrait 1,12/2,03 ms. Dit omvat projectie/validatie/serialisatie;
geen DB/netwerk, queue, bronacquisitie, browserstart of nieuw beelddecode.
De uitvoerbestanden bevatten de meetopzet en samplesamenvattingen. De routes zijn
lokaal apart gemeten, zonder daar een productieversnellingsfactor uit af te leiden.

De twee ontwikkel-VPS-feedsamples (276 en 127 ms; 49.184 en 52.374 bytes,
beide 30 artikelen) bewijzen bereikbaarheid, geen volledige sync-p95. De
300-seconden encodergrens is uitsluitend een timeoutbudget. Opslagwinst is niet
uit recordtellingen afgeleid; actieve/historische assets zijn niet verwijderd.

## Gates en uitrolstatus

De host kan geen extra inotify-instance openen. Gebouwde Next-apps gebruiken
geen devwatchers en maken de vereiste browsergates uitvoerbaar. Geen hostwijziging
of beheerderactie meer nodig. De oude EMFILE/ontwikkelserverfouten en één
unitdeadline tijdens gecombineerde belasting blijven als ruwe logs bewaard;
geen testassertie of timeout is verwijderd om groen te worden.

Bevestigd: Control+a11y/E2E 94 PASS/22 bestaande conditionele skips; workspace
lint/typecheck/test ieder 30/30; volledige build 18/18 plus finale Player-build.
De brede Player-/offlinerun telt 385 PASS/15 conditionele skips. Na de laatste
LG-compatibiliteitsdelta zijn de 90 relevante Player-/offlinegevallen opnieuw
groen zonder skips of retries, waaronder de twaalf nieuwe DOM-gevallen en drie
werkelijke standalone-LG-binarygevallen. Een eigen onjuiste controle op het
aantal verborgen pairingvelden is gecorrigeerd naar zichtbaarheid en behoud
van de credential; de betreffende rode logs blijven beschikbaar. Ruwe logs staan onder
`/home/codex/.local/state/veyocast-s292` en in de eigen `/tmp/castivo-s292-*` logs.
Screenshots en compacte meetresultaten staan naast dit document.

De aparte MenuDocument/widget-publicatieroute wordt nog afgerond; het snelle
Sync-menu is daarvoor geen vervangend bewijs. Er is nog geen S292-PR of
deployment. Na de aanvullende implementatie en groene gates volgt de
bestaande PR/review/main→staging→expliciete productieflow voor exact de actuele
SHA. Verplichte GitHub-environmentreviews worden behouden. Postdeploy zijn de
drie echte RSS-syncs en hun reguliere cyclus, verjaardagsbroncontrole,
matchday-teamselectie, consumeronderhandeling en live framebevestiging nog
te controleren. Geen fysieke hardwareacceptatie of complete uitrol geclaimd.
