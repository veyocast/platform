# S295 — Uitslagen, poulewedstrijden en controle bij afspelen

Baseline: remote main `282bcec3e986207b5b01ea186325297b2b974b11`, opnieuw
opgehaald op 9 november 2026. Eigen branch/worktree en ownership staan in
[de sprintopdracht](../prompts/sprints/S295-sportlink-playback-refresh.md).
De lokale integratiegates zijn groen. [Bronhashes en geteste commit](implementation/s295-sportlink-playback-refresh/tested-source.json)
binden het bewijs aan de kandidaat; review, vereiste CI en hosted stagingacceptatie
blijven releasegates.

## Vastgestelde beginsituatie

Read-only diagnose bevestigt productieproject `gjmdqsukjfhmmblnmhqd` en
stagingproject `jibbtdicrptsyftobavq`. Beide publieke Players meldden de
baseline-SHA; beide databases hadden migratie `20261025203330`. De onderzochte
completionfuncties waren in beide projecten aanwezig met dezelfde bodyhashes.
De afzonderlijke Worker-image/readinesscontrole is via de bestaande beschermde
workflow aangevraagd. De inventaris noteerde daarvoor een wachtende
environmentreview. Player-health bewijst op zichzelf geen gezonde Worker;
de exacte Worker-image is daarmee nog niet bevestigd.

Duindorp SV gebruikt `Europe/Amsterdam`, bron
`02c66a89-caf5-43ec-8f48-bcbf1825e5a4`, verbinding
`7944b364-b1a2-4e27-911c-187fca3678c0`. Clubuitslagen gebruikt
`sportlink.club_results_previous_7_days`, alle eigen teams, thuis en uit,
`maxItems=200`. De gelezen landscapevariant gebruikt Source-protocol 2; de
gelezen portraitvariant protocol 1. Onze wedstrijddag gebruikt team `218380`,
`auto_current`, pool `826233` en competitie
`89578cd804224102bbc4210cf1eea97ec87ec203dd1ab5f4b2d8792f8b501322`;
de fase is `4e klasse`; de resolver leverde geen expliciet seizoen. De actuele
Source-renderer is
`sync-onzetrots-v9`. Beide gelezen matchdayoriëntaties gebruiken protocol 2.
Landscape-snapshot `241a626a-9b88-4195-b8bf-73409b5290a0` is met
`live_data_enabled=true` gebonden aan release
`acfda604-0db6-4c51-8724-3b9db6202a57`.

De effectieve policies waren ieder uur voor wedstrijden en details, dagelijks
voor competities. De gelezen competitiesync slaagde op 8 november
15:14:43 UTC; de volgende stond op 9 november 15:14:11 UTC. Een dagelijkse
policy kan officiële standgegevens bijna een dag later observeren; de precieze
publicatietijd bij Sportlink is niet gemeten. De gelezen stand had veertien
rijen. De nieuwste gelezen wedstrijdsync duurde 46,207 seconden en de
opvolgende detailrun 9,651 seconden. Dit zijn syncruntijden, geen gemeten
provider→zichtbaar-framevertraging.

De productieprofielen omvatten React op Android met WebView 156,
manifest 1+2 en Source DOM 2, plus de zelfstandige static-LG-runtime met
Chrome 79 en manifest 1. Oudere Windows-telemetrie meldde een oudere app-SHA.
Dit is gerapporteerde telemetrie; fysieke kandidaatacceptatie volgt daar niet
uit. De lokale ADB-inventaris leverde bij aanvang geen aangesloten apparaten op.

De gesanitiseerde inventaris staat in
[production-before.json](implementation/s295-sportlink-playback-refresh/production-before.json).
Het veld `observedAt` is een benaderend handmatig inventarislabel;
`observedAtApproximate: true` maakt die precisie expliciet. De afzonderlijke
run-/bindingtijdstippen zijn de gelezen databasetijdstippen. De inventaris
bevat configuraties, revisies, runmetadata en capabilities, geen
providercredentials, devicetokens of raw providerresponsen. De onjuiste
`match_count: 0`-velden zijn verwijderd: de gebruikte inventarisprojectie
leverde geen betrouwbare telling van de werkelijk geselecteerde datasets.
Daaruit wordt dus geen lege productieslide afgeleid. Productiegegevens,
publicaties en schermopdrachten zijn voor deze diagnose niet gewijzigd.

Een tweede precieze read-only meting op 00:50:05 UTC staat in
[production-datasets-readonly.json](implementation/s295-sportlink-playback-refresh/production-datasets-readonly.json).
Daarin zijn eigen resultaat `20935947` (3–1), andere poulewedstrijd `20935978`
(6–0), oude wedstrijd `20935254` van 31 oktober en eigen volgende wedstrijd
`20935814` afzonderlijk vastgelegd. De normale wedstrijdsync had deze rijen
om 00:46:05 opnieuw geraakt; `missing_sync_count` was daardoor weer nul.
Dit bevestigt geen drie opeenvolgende productiedetailruns. De officiële
stand bleef op de succesvolle sync van 8 november 15:14:43 staan; eigen team
positie 5, 13 punten, 20 voor en 18 tegen. `source_updated_at` is hier null,
dus exacte bronpublicatietijd kan niet uit deze tabellen worden gereconstrueerd.
Dit bestand bevat uitsluitend geselecteerde genormaliseerde diagnosevelden.

## Oorzaken en herstel

1. De uitslagenaanvragen vertrouwden op verschillende providerdefaults voor
   weekoffset, gebruikten veertien dagen en beperkten de clubfeed tot honderd
   rijen. De officiële parameterlijst documenteert voor clubuitslagen offset
   -1 en voor pouleuitslagen -2; de artikelpagina noemt voor die laatste -1.
   De worker vraagt nu expliciet offset -2, vijftien dagen en
   `datum-omgekeerd`: veertien dagen terug tot en met vandaag. De clubcap is
   500. De artikelbeschrijving verankert offset 0 aan vandaag; de interpretatie
   van −2/15 als twee weken terug tot en met vandaag is daarop gebaseerd.
   De inclusieve einddag en werkelijke volledige providerdekking zijn zonder
   de live vergelijkingsproef nog niet onafhankelijk bevestigd.
   Bij een volle pagina volgt waar mogelijk een begrensde splitsing via
   de exacte eigen-teamidentiteiten, inclusief de bestaande lokale `-1`-
   sentinel. Zonder bewezen volledige dekking wordt geen afwezigheid afgeleid.
   De echte gecredentialde vergelijking van oude en nieuwe aanvragen ontbreekt
   nog; het gekozen aanvraagcontract is lokaal met providerfixtures getest.
2. De werkelijk aangeroepen historische writer telde ontbrekende recente
   wedstrijden van de hele verbinding bij iedere niet-lege wedstrijdarray.
   Een begrensde Programma-/detailbatch kon daardoor na drie runs een geldige
   poulewedstrijd deactiveren. Dezelfde upsert kon status en score door een
   latere Programmarij terugzetten. JSON `null` werd bovendien als aanwezige
   score beschouwd. De additieve completion `complete_sportlink_sync_v5`
   ontvangt nu observatieprovenance; bestaande v4-callers blijven ondersteund.
   Details vullen detailvelden aan en bepalen geen afwezigheid. Alleen
   volledige waarnemingen bepalen afwezigheid binnen hun eigen scope.
3. `expires_at` is aftrap plus twee dagen. De gewone zeven-dagenblueprints
   selecteerden al op de lokale periode en hadden deze vervalfilter niet in
   hun eigen uitslagenquery. Die query wordt dus niet als oorzaak van een
   algemene tweedagenafkap gepresenteerd. De rich matchdayquery gebruikte
   `expires_at` wél, en vereiste ten onrechte ook voor Programma een
   gepubliceerde score. De matchdayselectie gebruikt nu de lokale
   resultaatperiode en toekomstig eigen programma zonder die scorevereiste.
   Een serverqueue herberekent actieve gepubliceerde Sportlinkbindings na de
   lokale middernacht, ook zonder providerwijziging of geslaagde nieuwe sync.
4. Matchday filterde beide wedstrijdblokken exact op het geselecteerde team;
   de projector controleerde dat nogmaals. Andere poulewedstrijden konden
   daardoor niet in Uitslagen terechtkomen. Het nieuwe `poolResults`-blok
   controleert afzonderlijk tenant, verbinding, competitie, poule, seizoen en
   fase. Eigen programma en eigen resultaten houden hun strikte team- en
   thuis/uitselectie. Het bestaande paneel toont eerst de nieuwste eigen
   uitslag, daarna de nieuwste wedstrijden zonder het geselecteerde team,
   daarna eventueel oudere eigen resultaten. Wedstrijdcode ontdubbelt de set.
5. De gelezen eigen uitslag `20935947` had een andere synthetische
   `competition.externalId` dan zijn gecontroleerde
   `pool.competitionExternalId`. De productieprojectie bevatte de eigen 3–1
   wel: uitsluiting van juist deze uitslag is geen bewezen productiesymptoom.
   De interne inconsistentie is wel gereproduceerd. De worker bewaart nu de
   gecontroleerde competitie-identiteit bij de exacte poulecontext en wijst
   conflicterende fase- en seizoensinformatie af. Een ISO-datum zonder tijd
   negeerde daarnaast de losse `aanvangstijd`; die tijd wordt nu meegenomen
   voor aftrap en stabiele sortering op tijd plus wedstrijdcode.
6. De officiële stand had een dagelijkse broncadans, onafhankelijk van de
   reeds aanwezige wedstrijddata. Aanvullende vormverrijking kon een geldige
   nieuwe officiële stand blokkeren bij een falende uitslagenfeed. Nu blijven
   geldige standen per poule bruikbaar terwijl een andere poule faalt; verlies
   van ook maar één standrij tijdens normalisatie houdt het vorige volledige
   pouleblok. Geldig `[]` blijft een bevestigde lege/niet-gepubliceerde stand.
   De projector berekent doelsaldo uit de officiële `goalsFor/goalsAgainst`
   wanneer geen expliciet saldo beschikbaar is. De selectie kiest eerst de
   nieuwste stand in de exact opgeloste context en controleert daarna publicatie
   en de eigen rij. Zo kan een nieuwe bevestigde lege/niet-gepubliceerde stand
   niet terugvallen op een ouder gepubliceerd record met een andere provider-ID.
   Deze legale historische toestand is eerst rood bewezen; een geleasete 429
   bewaart de geldige stand en een latere geldige waarneming herstelt haar.
7. De Player controleerde periodiek, realtime en bij herstel; de werkelijke
   afspeelactivatie was geen eigen trigger. Alleen slide-ID onderscheidt
   herhaalde IDs, één-itemlussen en onafhankelijke zones niet. De activatie
   gebruikt release, zone, itempositie en een afzonderlijke afspeeliteratie en deelt de bestaande
   geautoriseerde conditionele controle, coalescing en backoff. Lokale
   geverifieerde inhoud speelt direct door; nieuwe inhoud wacht op een
   geschikte natuurlijke grens. Een ongewijzigde 200 tijdens voorbereiding
   van het eerste frame mag daarbij geen nieuwe afspeelpoging starten.
   Aanvaarding van nieuwe menudata op een paginagrens start evenmin een nieuwe
   beurt. Rendererclock en echte afspeeliteratie zijn gescheiden; de bestaande
   itemdeadline blijft staan en een vastgehouden zone schuift niet naar een
   ander item wanneer alleen haar pagina nieuwe feiten krijgt.
   De Player onthoudt daarnaast per echte afspeelbeurt en zone of een
   gevalideerd frame is getoond. Volledig voorbereide nieuwe feiten mogen
   vóór dat eerste frame instromen; zichtbare gewijzigde blokken houden hun
   natuurlijke grens, ook als een andere zone nog voorbereidt. Een datarender
   wist dit bewijs niet; oude callbacks moeten hun gegevens- en beurtidentiteit
   bewijzen. Het besluit wordt na asynchrone lokale opslag opnieuw gecontroleerd.
   De onafhankelijke review vond daarnaast een oudere-responsegrens: een lagere
   bronrevisie kon een nieuwere voorbereide kandidaat intrekken, en de eerdere
   configuratiecontrole keek alleen naar hoofditems. De guard vergelijkt nu ook wachtende en voorbereidend geaccepteerde
   kandidaten, vóór ETag-, token- of kandidaatmutatie. Iedere compositiezone
   krijgt haar eigen controle, ook wanneer alleen de hoofdpublicatie wisselt;
   dit geldt eveneens voor LG-binaries. Een technische voorbereidingsfout
   geeft uitsluitend de eigen tijdelijke kandidaat vrij. De nieuwe browser-
   regressies controleren main preparing/pending2 → stale1, zijdata2 → stale1
   en het bestaande LG-binarypad.
   De inventaris van de echte serverbuilders vond bovendien historische
   RSS/menu/productpayloads zonder numerieke bronrevisie en een MenuDocument-
   binaryroute die haar revisie wegliet. Het optionele top-level `dynamicData`
   voegt bronrevisie/contenthash en de immutable configuratie-identiteit toe,
   zonder het strikte oude payloadschema te veranderen. React en LG controleren
   dit veld tegen payload/snapshot/template en nemen het mee in hun guards.
   Een hogere revisie mag legitiem terugkeren naar een eerdere inhoudshash;
   een lagere revisie mag geen nieuwer actief, pending of voorbereidend blok
   vervangen. MenuDocument-feiten en binary moeten dezelfde revisie/hash hebben;
   zolang dat niet klopt, blijft de laatst geverifieerde inhoud in beeld.
   Ontbrekende of onbereikbare livegegevens vallen niet terug naar een oudere
   frozen snapshot. Signed URLs en `checked_at` veranderen deze identiteit niet.
   De echte bindingconstraints laten dezelfde historische snapshot bovendien
   tegelijk live en vastgezet publiceren. De oude snapshotbrede overlay wijzigde
   beide plaatsingen. Payload, revisiemetadata en vereiste media worden nu per
   release-item gekozen; een vastgezette plaatsing behoudt haar eigen feiten en
   assets terwijl de liveplaatsing doorververst.
   De brede LG-proef vond tevens een onnodige Sites-redraw bij een ongewijzigde
   200-respons. De refresh vergelijkt nu het werkelijk geïnstalleerde volledige
   document, inclusief hashgebonden assettokens. Gelijke inhoud behoudt DOM,
   animatie en paginaklok; signed-URL-toegang ververst afzonderlijk. Werkelijk
   gewijzigde inhoud houdt haar bestaande verificatie en natuurlijke grens.

8. De extra lege-uitkomstproef vond een oudere LG-acceptatiefout: een volledig
   geverifieerde kandidaat met nul afspeelbare items werd vóór opslag geweigerd.
   Daardoor bleven oude scores staan. Afspeelbaarheid bepaalde bovendien welke
   assets de cache valideerde, waardoor een koude herstart kon terugvallen op
   gegevens van vóór de lege uitkomst. Assetvolledigheid en inhoudselectie zijn
   nu gescheiden; pas na succesvolle opslag wist de runtime de oude media en
   toont zij haar bestaande lege/gereed-toestand. Een technische opslagfout
   behoudt de vorige geldige inhoud. De React-zone koos bij nul geschikte items
   nog item 0; een lege hoofdzone kon de volledige compositie verbergen. Lege
   zones krijgen nu een werkelijk zichtbare bestaande statuspresentatie en
   framebevestiging. Een begrensde lege grens laat geldige verse feiten weer
   instromen zonder fictieve afspeelactivatie of extra bronverzoeken.
   Een wijziging in de hoofdzone hield bovendien ook ongewijzigde zijzones
   vast en begon hun volgende beurt. Binnen dezelfde immutable compositie
   wachten nu alleen de werkelijk gewijzigde zones; de andere behouden hun
   canvas/decoder en oorspronkelijke deadline. Nieuwe publicaties blijven op
   de grenzen van alle vereiste zones wachten.
   De strengere assetinventaris zou bij een offline app-upgrade een oude
   gemengde LG-cache kunnen afwijzen: oudere code bewaarde de ongebruikte
   assets van lege historische items niet. Alleen de cacheleesroute kent
   daarvoor een beperkte uitzondering, na volledige envelopevalidatie en
   exacte vergelijking van de oude assetset. Alle afspeelbare bytes blijven
   geverifieerd. Revisiemetadata, moderne bronnen en nieuwe voorbereiding
   behouden de volledige asseteis; een geheel lege oude assetset blijft ongeldig.

9. Een afzonderlijke leased-coreproef bewees observatiechurn voor historische
   protocol-1-matchday- en verjaardagspayloads: uitsluitend nieuwe
   `fetchedAt`, `snapshotExpiresAt` of context-observatierevisies verhoogden
   `data_revision` van 1 naar 2 en veranderden `data_key`. De live
   PDD-completion vergelijkt daarvoor nu de inhoud met de bestaande
   semantische helper. Bij gelijke feiten blijven rawpayload, hash, revisie
   en `changed_at` gelijk; `checked_at` en `source_revision` registreren de
   nieuwe controle. Historische hashfuncties, frozen bytes en protocol 2
   veranderen niet. Tien concrete rode controles werden groen; afzonderlijke
   echte score-, stand-, verjaardag-, datumgrens- en lege-setwijzigingen blijven
   nieuwe inhoud. Dit is een bewezen oudere compatibiliteitsfout, geen claim
   dat juist Duindorps protocol-2-matchday hierop vastliep.

## Scope, perioden en compatibiliteit

Een volledige geldige lege waarneming maakt de zichtbare set direct leeg.
De historische rij blijft bestaan en behoudt de drie-waarnemingenbescherming
voor de `active`-status. Positieve partiële waarnemingen hebben per wedstrijd
een eigen tijdstip. Zo kan een volledige overlappende afwezigheid geen
tegelijk bevestigde aanwezigheid wissen; een volgende partiële wedstrijd B
wist wedstrijd A niet en maakt een eerder bevestigde intrekking van A ook
niet ongedaan. Programma- en resultaatdekking hebben afzonderlijke flags en
vensters. 4001/4031 geldt niet zonder meer als bewijs dat scores officieel
zijn afgeschermd; ambigue fouten behouden de geldige data. Een geldige lege
providercollectie levert de bestaande lege toestand.
Een ontbrekende, null, lege of onleesbare score in een verder herkenbare
uitslagenrij bewijst geen afscherming. De Worker laat die rij buiten de
writebatch en markeert de dekking als incompleet; andere geldige scores
kunnen doorgaan. Een expliciete officiële afgelasting blijft verwerkbaar.
De gedocumenteerde afscherming van uitslagen/standen levert geen resultaat;
geldige lege collecties en passende volledige afwezigheid blijven autoritatief.

Voor gewone blueprints blijft `previous_7_days` de lokale selectie
`[vandaag−7, vandaag)`, `today` exact de lokale kalenderdag en
`next_7_days` `[vandaag, vandaag+7)`. De matchdayresultaten gebruiken
`[vandaag−7, vandaag]`, inclusief vandaag; het eigen volgende programma blijft
op exacte team/context en toekomstige aftrap geselecteerd. Alle selectie gaat
voor de presentatielimiet. Een sync die zelf over lokale middernacht loopt,
levert wel geldige rijen maar geen nieuwe afwezigheidsautoriteit voor het
verschoven aanvraagvenster.

Een gepubliceerde matchday kan een optionele
`live_max_staleness_seconds` per bestaande syncpolicy gebruiken: 300–86400
seconden, standaard 3600; `NULL` houdt alleen de reguliere frequentie aan.
Een geautoriseerde, geaudite tenantopdracht kan dit aanpassen. De centrale
catch-up behoudt disabled policies, actieve leases, cooldown en retrybackoff.
Extra schermen maken geen afzonderlijke providerwaarnemingen. De frequentievelden
van bestaande policies worden niet herschreven.

De drie panelen en OnzeTrots-opmaak blijven bestaan. De portrait-CSS verborg
voorheen alle resultaatkaarten na de eerste. Alleen een gevalideerde set met
andere pouleteams krijgt nu ruimte voor maximaal drie bestaande kaarten;
oude eigen-team-only payloads behouden hun geometrie. De standscroll gebruikt
de werkelijke viewport en bestaande paginaduur. De canonaanvullingen staan in
[dynamic-slides-canon.md](dynamic-slides-canon.md) en
[player-offline-canon.md](player-offline-canon.md). Configuraties, snapshots,
playlistreleases, historische rendereridentiteiten en locked assets blijven
onder hun bestaande contract.

De activatiegrens omvat de bestaande Sportlink-/verjaardagspayloads, RSS/Nieuws,
Menu DOM, gekoppelde menu-/productdata, Source DOM/binary en overige beschikbare
Sites/Sync-/online-items. De zelfstandige LG-runtime heeft dezelfde
geautoriseerde controle aan zijn eigen daadwerkelijke afspeelpad gekoppeld.
Bij LG start de conditionele controle eenmaal per werkelijke
`playbackGeneration` vanuit `mediaReady`, na commit en twee animation frames;
compositiezones wachten op hun werkelijke compositiecommit. Dit is een directe
activatiecontrole, onafhankelijk van de periodieke timer. Zodra een LG-node is
gecommit, wisselen verse feiten op de natuurlijke item-/lusgrens, voor Sites
ook op de paginagrens. Bootstrap zonder node kan de nieuwste complete kandidaat
voor het eerste frame installeren. De fijnere React-regel voor een nog niet
zichtbare afspeelbeurt wordt voor een reeds gecommitteerde LG-node niet geclaimd.
Een profiel zonder ondersteunde DOM-renderer krijgt via de bestaande
`get_sync_binary_playback_v1`-route een voorbereide, geverifieerde actuele binary.
Zolang die nog niet gereed is, blijft zijn vorige complete lokale inhoud staan.
De bestaande binaryproeven controleren voorbereiding, revisiebinding,
decoderweergave en offlineherstel met expliciete binaryfixtures. Het exacte
nieuwe Sportlink-0–0/correctiebeeld is in deze lokale ketenproef alleen via DOM
zichtbaar gecontroleerd. Een profiel dat hiervoor uitsluitend binary kan
tonen, heeft dus nog een kandidaatproef van het werkelijk voorbereide
Sportlink-frame nodig; de routebeschrijving is geen vervanging voor dat bewijs.
Historische dynamische sportpayloads behouden hun bestaande skipcontract:
een leeg item valt uit de afspeelvolgorde; bij alleen lege items verschijnt de
gekoppeld/gereed-toestand. Een lege nevenzone en een lege hoofdzone binnen een
compositie behouden de andere geldige zones. Dit is afzonderlijk van de
bestaande lege panelen in Source DOM 2 en diens voorbereide binaryfallback.
Dit is een compatibiliteitspad; fysieke LG- of Androidacceptatie is hiermee
nog niet bewezen.
De actuele React- en zelfstandige LG-runtime sturen hun ondersteunde
Source-capabilityheader. Pre-capability clients zonder die header kunnen bij
historische Source-1-image/video uitsluitend de frozen binary ontvangen en
hebben ook deze nieuwe activatietrigger niet. Zij vallen buiten de garantie
voor deze kandidaat; een user-agentwijziging bewijst geen clientupgrade.
Engage/YouTube en overige bestaande realtimeuitvoer behouden hun eigen
livetransport; hun dynamische playlistitems activeren wel de manifestcontrole.

## Keten en lokaal bewijs

De bestaande `scripts/probe-publication-runtime.mjs` is het startpunt voor
policy-, syncrun-, publicatie- en catalogusdiagnose. De inventaris registreerde
read-only workflowaanvragen voor
[publicatie/runtime](https://github.com/veyocast/platform/actions/runs/42538600641)
en [Worker/integraties](https://github.com/veyocast/platform/actions/runs/42538602901),
met een wachtende beschermde environmentreview. Beide aanvragen stonden op
9 november 03:43 UTC nog op `waiting` voor de baseline-SHA; kandidaat-readbacks
moeten na de normale deployment afzonderlijk worden vastgelegd.

De keten is Sportlink-response → mapper/verrijking → geleasete completion →
`sports_matches`/`sports_standings` → bronrevision/refreshqueue →
`published_dynamic_data` → geautoriseerd manifest met `data_key` in ETag →
schema-/assetgevalideerde lokale projectie → natuurlijke grens → zichtbaar
frame. De serviceworker omzeilt `/api/`. Signed URLs en observatietijden zijn
geen inhoud; protocol 2 behoudt de bestaande semantische hashnormalisatie.
Veilige `source_observation`-diagnostiek koppelt provider-correlatie,
artikel/scope, waarnemingstijd en tellingen aan de succesvolle sync-run,
zonder source rows of credentials te loggen.

De uitgevoerde lokale ketenprobe
[verify-s295-sportlink-publication.mts](../scripts/verify-s295-sportlink-publication.mts)
publiceert in een geïsoleerde database via de guarded authoring-, DOM-worker-
completion- en playlistpublicatiecommando's. De Sportlink- en standenmapper
verwerken representatieve records. De probe geeft expliciete scopeprovenance
mee aan v5, ververst de gepubliceerde binding en gebruikt de echte
`readSyncDynamicReleaseSnapshot`/`projectSyncDynamicReleaseData`-grens.
Zij maakt de transportfixture voor de Player en rolt beide tenanttransacties
terug. Descriptorbytes worden voorbereid; echte Storage-upload is in deze
lokale probe niet uitgevoerd.

Het vastgelegde
[local-publication-chain.json](implementation/s295-sportlink-playback-refresh/local-publication-chain.json)
toont voor landscape én portrait dezelfde immutable release per scenario:
publicatie revisie 1, alleen standwijziging revisie 2, nieuwe pouleuitslag 0–0
revisie 3, correctie op dezelfde wedstrijdcode revisie 4 en identieke observatie
opnieuw revisie 4 met gelijke contenthash. Een uitsluitend geïnstrumenteerde
lokale datumgrens verwijdert daarna de oudste pouleuitslag in revisie 5, zonder
providerwijziging; een bevestigde lege resultaatset wordt revisie 6 terwijl
stand en programma behouden blijven.
De fixture heeft veertien officiële standrijen, een eigen 3–1, een andere
poulewedstrijd met echte 0–0, eigen volgend programma en een uitgesloten andere
poule. De gewijzigde stand heeft positie 1, negen punten en doelsaldo +5; de
los gewijzigde pouleuitslag wordt 2–0. De probe controleert ook de ongewijzigde
manifesthash en het aantal releases. De completiontijden
zijn per bronrun opgenomen in het gekoppelde JSON-bewijs. Dit zijn lokale SQL/RPC-tijden,
geen provider- of schermdoorlooptijden.
De probe leest per stap tevens de echte `data_key` uit
`get_player_effective_target_v1`. Het gecontroleerde HTTP-transport gebruikt
die sleutel voor zijn ETag en registreert `If-None-Match` en 200/304; het
framebewijs koppelt dezelfde snapshot/revisie aan de inhoudshash. De
HTTP-afhandeling is een testfixture en geen claim van hosted deviceverkeer.

Gerichte tussenvalidatie, vóór de finale integratieronde: de volledige
media-workerunitset slaagde met 436 tests en 343 bestaande conditionele skips;
de integratiepackage met 230 tests. Worker/integraties typecheck, scoped
workerlint, volledige integratielint en diffcontrole slaagden. De nieuwe
workerobservatieproef omvat 32 gevallen, waaronder lopende lokale dag,
weekovergang, limiet 500 met teamfallback, `-1`, parserverlies, lege collecties,
onafhankelijke blokken, scorecorrectie/0–0, contextidentiteit en middernacht.
De finale gecombineerde lokale gates staan hieronder en in het gatebestand.

De aanvullende Playwrightscenario's gebruiken het echte webplayerpad en de
zelfstandige legacyruntime met expliciete netwerkfixtures. Zij verlengen het
periodieke interval boven de playlistduur en controleren zichtbare tekst,
200/304, afspeeltiming, één-itemlussen, herhaalde IDs, twee zones,
coalescing, trage/oude reacties, offlineherstel en meerdere afzonderlijk
geautoriseerde schermen. De matchdayproef leest de databasegegenereerde
transportfixture en controleert beide oriëntaties, veertien standrijen,
eigen markering, andere pouleuitslagen en onafhankelijke zichtbare wijzigingen.
De unieke Player-inventaris sluit 460 gevallen: 445 PASS en 15 expliciete
opt-in-skips, zonder open gevallen. De niet-Player-inventaris sluit 1352 gevallen:
721 PASS en 631 bestaande conditionele skips. Dit zijn gecontroleerde unies
van afzonderlijke invocaties, geen enkele volledig groene monolithische run.
[Player](implementation/s295-sportlink-playback-refresh/player-case-closure.json)
en [overige browsers](implementation/s295-sportlink-playback-refresh/nonplayer-case-closure.json)
bewaren geval-ID en eerdere fouten; de laatste observatie bepaalt de sluiting.
Player bewaart ook de build. De overige browserproeven verwijzen naar hun
[uitvoerbewijs](implementation/s295-sportlink-playback-refresh/nonplayer-proof-summary.json).

De volledige lokale publicatie-/frameproef is op build
`xY_Z2TviobCpHZ6QQ7BmI` met de finale migratie geslaagd: twee gevallen, 543,846 seconden, met zes
bevestigde revisieframes per oriëntatie en een koude offline herstart na de
lege uitslagset. [Het frame-index](implementation/s295-sportlink-playback-refresh/publication-frame-evidence.json)
bindt de bestanden met SHA-256 aan hun release, snapshot en build. De
[landscape](implementation/s295-sportlink-playback-refresh/sportlink-landscape-new-zero-result.png)-
en [portrait](implementation/s295-sportlink-playback-refresh/sportlink-portrait-new-zero-result.png)-beelden
tonen eigen 3–1, andere poulewedstrijd 0–0, eigen programma en de eigen
markering in de gewijzigde officiële stand. De proef controleert bovendien
dat de laatste van veertien standrijen geheel in de viewport verschijnt.

Onderstaande tijden lopen van het beschikbaar maken van de al berekende
dataset in het gecontroleerde manifesttransport tot leesbare panelen. De
periodieke controle stond op 120 seconden, boven de itemduur van 42/45
seconden; de echte activatiecontrole en natuurlijke wisselgrens leveren deze
tijden. Dit meet geen live Sportlink-publicatie of hosted netwerkvertraging.

| Gecontroleerde wijziging | Landscape, seconden | Portrait, seconden |
| --- | ---: | ---: |
| Alleen officiële stand | 41,803 | 44,797 |
| Nieuwe pouleuitslag 0–0 | 41,670 | 44,793 |
| Correctie naar 2–0 | 41,690 | 44,832 |
| Verloop bij lokale datumgrens | 23,688 | 24,643 |
| Geldige lege uitslagset | 41,785 | 44,881 |

Het afzonderlijke [runtimeframebewijs](implementation/s295-sportlink-playback-refresh/runtime-frame-evidence.json)
bevat elf sets op build `xY_Z2TviobCpHZ6QQ7BmI`: activatie voor Nieuws en
Sportlink in beide runtimes, gewone uitslagen, onafhankelijke lege zones,
ongewijzigde Sites-responsen, echte RSS-mediaprojectie en herstel van een oudere
gemengde offlinecache.
Bij items van vijf seconden en een pollinterval van zestig seconden waren
de gemeten wijzigingen tot zichtbaar frame 6,258 seconden voor browsernieuws,
5,254 voor browseruitslagen en 10,549/10,547 voor LG Nieuws/Uitslagen. Dit zijn
gecontroleerde bronwijzigingen, inclusief wachten op de natuurlijke grens;
geen providerpublicatietijden.

De gewone uitslagenproeven doorlopen dezelfde wedstrijdcode van 0–0 naar
2–0, verwijderen de oude wedstrijd, bewaren de geldige lege revisie bij een
koude offline herstart en herstellen naar verse revisie 6. Bij een geweigerde
LG-opslag blijft eerst de vorige geldige inhoud staan. De compositieproeven
laten hoofd- en zijzone afzonderlijk leeg worden en herstellen. De
oorspronkelijke zijzonegrens van negentien seconden bleef behouden: 19,110
seconden in de browser en 19,113 in LG volgens de gecontroleerde afspeelklok,
terwijl het hoofditem 120 seconden duurt. Een lege hoofdzone
laat de geldige zijzone zichtbaar en actief.

## Profielen en werkelijk bewijs

| Profiel | Uitvoerpad en beschikbare verificatie | Bewijsgrens |
| --- | --- | --- |
| Chromium webplayer | Echte Player-route, Source DOM 2, geverifieerde descriptor-/rendererassets en bestaande binaryfixtures; databasegegenereerde matchdaytransportfixture voor beide oriëntaties. | Twaalf bevestigde revisieframes, zichtbare tekst, volledige standscroll en koude offlineherstart op de finale build. Provider-/manifesttransport is expliciet gecontroleerd; geen hosted netwerkclaim. |
| LG legacy | Playwright oefent het echte `/lg/legacy`-pad en de zelfstandige runtime; bestaande binarylegacyproeven gebruiken een LG/Chrome-79-user-agent. | Chromium met een andere user-agent is geen Chrome-79-engine en geen fysieke LG. Model-/firmware-/decoderacceptatie van deze kandidaat ontbreekt. |
| Android WebView | Productietelemetrie meldt WebView 156, React, manifest 1+2 en Source DOM 2 op de baseline. | Geen aangesloten ADB-device; geen fysieke Android/WebView-kandidaatproef. Een gewone Chromiumrun vervangt die niet. |
| Hosted staging | Read-only baseline-inventaris en aangevraagde bestaande workflowdiagnose. | Kandidaat nog niet via een gereviewde main-SHA gedeployed; stagingcanary, exacte Worker-image en hosted zichtbare frames blijven afzonderlijke releasegates. |
| Echte Sportlink-bron | Geautoriseerde read-only opgeslagen configuratie, genormaliseerde tabellen, policies en syncruns. | Oude/nieuwe providerparameters zijn niet werkelijk naast elkaar gemeten. Bronpublicatietijd en provider→VeyoCast-doorlooptijd zijn onbevestigd. |

## Acceptatie per laag

| Geval | Uitgevoerde regressie | Concrete grens |
| --- | --- | --- |
| Nieuw resultaat, correctie, echte 0–0, stabiele revisie | [published chain SQL](../supabase/tests/s295_published_sportlink_chain.sql#L112), databasegegenereerde Playerfixture | SQL gebruikt synthetische genormaliseerde records; het separate Playerbewijs gebruikt de mapper/projectie-uitkomst. |
| Verdwijning bij Amsterdamse datumgrens | [matchday en gewone previous7-selectie](../supabase/tests/s295_published_sportlink_chain.sql#L172), [queue](../supabase/tests/s295_published_sportlink_chain.sql#L202) | Gewone builder en matchday afzonderlijk bewezen met scopeleden; klok in rollbacktransactie geïnstrumenteerd, geen fysieke nachtmeting. |
| Geldig leeg, gedeeltelijk of fout | [scope authority](../supabase/tests/s295_sportlink_observation_scope.sql#L108), workerobservatietests | Technische fouten zijn in de clienttests echte gecontroleerde HTTP-responsen; SQL krijgt expliciete complete/incomplete provenance. |
| Drie detailruns, later Programma, finale score behouden | [leased completions](../supabase/tests/s295_sportlink_observation_scope.sql#L91) | Geïsoleerde SQL-keten; bestaande productierijen worden niet gewijzigd. |
| Eigen thuis/uit, andere poule/fase uitgesloten | [membership](../supabase/tests/s295_sportlink_observation_scope.sql#L59), projector, gepubliceerde Playerfixture | Exacte resolvercontext en IDs; geen naamfallback voor selectie. |
| Losse officiële stand en onafhankelijke blokken | [standings publication](../supabase/tests/s295_published_sportlink_chain.sql#L145), worker/mapper/projector | Echte provider→VeyoCast-bronpublicatietijd ontbreekt. |
| Beleidsgrenzen en isolatie | [catch-up](../supabase/tests/s295_published_sportlink_chain.sql#L183), [RLS](../supabase/tests/s295_published_sportlink_chain.sql#L211) | Leases, disabled/NULL-policy, cooldown, retrybackoff, tenant- en anongrens deterministisch getest. |
| Protocol-1-observatie zonder inhoudswijziging | [leased semantische vergelijking](../supabase/tests/s295_published_sportlink_chain.sql#L267), [voor/na-bewijs](implementation/s295-sportlink-playback-refresh/legacy-semantic-final-proof.json) | Hash/revisie/key stabiel; echte feiten veranderen nog. Historische globale hashfuncties bytegelijk. |
| Portretstand van zeven/acht rijen na extra resultaatkaarten | Contract-/motiontests op vaste 9/14 seconden | Volledige heen/terugscroll past zonder de immutable duur te wijzigen; fysieke decoder niet gemeten. |

## Reproduceerbare lokale controles

De finale forwardmigratie is vanaf een lege eigen database inclusief seed
uitgevoerd. Project `veyocast-s295-verify` gebruikt poort 64432, migraties/tests/
seed via symlinks naar deze worktree. Op deze host is expliciete hostrouting
nodig: het gedeelde Docker-netwerk heeft ook een andere database met alias
`db`. Het onderstaande commando wijst uitsluitend naar de eigen testdatabase.

```bash
pnpm exec supabase --workdir /tmp/veyocast-s295-verify --network-id supabase_network_veyocast-s291 db reset
PGPASSWORD=postgres psql -h 127.0.0.1 -p 64432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'create extension if not exists pgtap with schema extensions'
docker run --rm --network host -e PGPASSWORD=postgres -v "$PWD:/repo:ro" public.ecr.aws/supabase/pg_prove:3.36 pg_prove --host 127.0.0.1 --port 64432 --username postgres --dbname postgres --ext .sql --recurse /repo/supabase/tests
S295_LOCAL_DB_PORT=64432 pnpm exec tsx scripts/verify-s295-sportlink-publication.mts
```

De laatste volledige RLS-run: 149 SQL-bestanden, 4937 assertions, PASS in
104 seconden. Database-lint (`public`, `private`) en advisors melden nul errors.
De normale release blijft een forwardmigratie; productie is niet gereset.

De verplichte mobiele Control-proef bevatte daarnaast op dezelfde baseline
een verouderde exacte URL-verwachting. `/dashboard/studio` verwees in de
productcode al naar `/dashboard/content`, terwijl de proef de oorspronkelijke
URL bleef eisen. De rode trace bewijst deze redirect; geheugenbelasting wordt
daarvoor niet als oorzaak aangevoerd. Alleen de verwachte canonieke bestemming
is gecorrigeerd. Alle vijftien routebezoeken, beide viewports, zichtbare
inhoud-, landmark- en scrollasserties en time-outs zijn behouden; de
productroute is niet veranderd.

## Open releasegates en concrete beperkingen

Workspace lint/typecheck/test slagen ieder 30/30; build 18/18. De finale
Player-unitset bevat 655 geslaagde tests. De releasehulpscripts slagen met
103 controles; Actionlint en 234 deploymentcontroles slagen eveneens. Database/RLS, beide browserinventarissen,
a11y en expliciete offlineproeven zijn lokaal gesloten. Het
[gatebestand](implementation/s295-sportlink-playback-refresh/local-gates.json)
en de bron-/gevalcertificaten bevatten de precieze afbakening. Een beschermde
workflow wordt niet omzeild. Vereiste CI op de PR-head, review, hosted
kandidaatdeployment en stagingcanary moeten daarna hun eigen
exact-SHA readback en zichtbare frames leveren. Bestaande Duindorp-playlists en
planningen zijn geen muterend testdoel.

De bronparameters zijn nog niet met echte Sportlinkcredentials vergeleken.
Daarom zijn de defaultoffset-/capverklaring en concrete provider→VeyoCast-
vertraging voor deze verbinding niet volledig live bevestigd. Het vervalfilter,
de brede historische missing-writer en de eigen-teamafbakening zijn wel in de
werkelijke code/SQL-keten aangetroffen en lokaal gereproduceerd. De productie-
inventaris is read-only en meet geen fysieke frames. De lokale publicatieproef
is rollbackbare databaseacceptatie met representatieve data; de browserfixture
is geen hosted stagingverbinding. Er was geen aangesloten Androiddevice en
geen beschikbare fysieke LG voor een kandidaatproef. Deze hardware- en
hosted-evidencegrenzen blijven afzonderlijk van geslaagde lokale tests staan.

Bronnen: [Sportlink-artikelen](https://sportlink-assist.freshdesk.com/nl/support/solutions/articles/9000062942-lijst-met-artikelen-van-club-dataservice),
[Sportlink-parameters](https://sportlink-assist.freshdesk.com/nl/support/solutions/articles/9000211117-lijst-met-parameters-in-club-dataservice).

## Vervolg via de bestaande stagingworkflow

De bestaande [deployworkflow](../.github/workflows/deploy.yml#L96) eist bij een
normale release de actuele `origin/main`-SHA. Een featurebranch naar staging
forceren zou deze gate omzeilen. Na review, groene vereiste CI en merge hoort
de main-release daarom via diezelfde workflow naar staging te gaan, met
`deploy_target=staging`, `mode=release` en de volledige gereviewde main-SHA.
De standaard main-push start eveneens eerst staging; productie vergt een
afzonderlijke expliciete dispatch.

Daarna moeten de bestaande publicatie-/integratieprobes op diezelfde SHA
release, migratie, Worker-image en capabilities bevestigen. Gebruik uitsluitend
een afzonderlijk stagingtestscherm/canaryplaylist. Het reeds gelezen interne
stagingcanarytenant `3f8fba9e-8eda-42ab-8c51-18dafa6ef970` bevatte alleen Menu/RSS;
daar is nog geen Sportlink-kandidaatbewijs verzameld. Voeg daar via de guarded
authoring/publicatieroute een eigen testconfiguratie toe met de gecontroleerde
team/poulecontext of expliciet gelabelde representatieve testdata. De bestaande
Duindorp-publicaties en planningen blijven buiten de muterende proef.

De hosted readback moet afzonderlijk vastleggen: bronobservatie en syncrun,
`checked_at`, `data_revision`/`content_hash`, manifest-ETag/200/304 en de
werkelijk zichtbare tekst met frame-/activatiecorrelatie. Herhaal de losse
standen- en poulewijziging, lokale datumgrens en offlineherstel in beide
oriëntaties. Dit is nog uit te voeren acceptatie; de lokale artifacts worden
hier niet als hosted bewijs hernoemd.
