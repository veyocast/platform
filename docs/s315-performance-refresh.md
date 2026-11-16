# S315 — Performance, verversing en databasebelasting

## Samenvatting en bewijsgrens

Onderzoek op 16 november 2026, vanaf main
`67d8470198acec4272c47c4c7979b6071a915c4b`. Dit dossier onderscheidt
productiemetingen, lokale regressies en nog te meten effecten na uitrol.
Een snelle healthroute of een berekende besparing bewijst geen zichtbaar TV-frame.

De grootste aantoonbare kansen zijn niet overal sneller pollen. Het zijn
een ontbrekende index voor het tenantoverzicht, herhaalde providerassetlezingen,
dubbele assetvoorbereiding bij legacy-Menu-rendering, overbodige verborgen-tab-
refreshes, ongeldige binaire opdrachten door SQL NULL-logica en een laat
ontdekte publieke blogachtergrond.

## 1. Onderzochte keten

1. RSS/Sportlink/LED Scores haalt de toegestane brondata op onder de bestaande
   providerpolicy, limieten, leases en foutbackoff.
2. Brontransacties bewaren genormaliseerde feiten en queue-en een coalesced
   publicatiegegevensverversing. De oorspronkelijke slide- en versie-ID blijven.
3. `PublishedDataRefreshRunner` claimt een bestaande generatie en voltooit de
   versiegebonden projectie. Prijzen, selectie, configuratie, thema en assets
   volgen hun eigen immutable/provenancecontract.
4. Moderne Source/Menu-DOM-consumers bereiden descriptors, oorspronkelijke
   assets en rendererresources voor. Legacy/expliciete export vraagt een
   checksumgebonden PNG/MP4-cache met drie slots en een begrensd uploadbudget.
5. De manifestroute valideert het device en de effectieve opdracht, gebruikt
   conditionele identiteit en controleert de opdracht nogmaals na voorbereiding.
6. De Player behoudt lokale LKG-content, controleert ook bij dynamische
   afspeelbeurten op wijzigingen en wisselt alleen op een veilige grens.
7. Heartbeats en zichtbaar-framebewijs voeden Control. Route-refresh is niet
   hetzelfde als een bronimport of een voltooide publicatie.

Broncode: `apps/media-worker/src/index.ts`, `published-data-refresh-runner.ts`,
`dynamic-render-runner.ts`, `apps/player/app/api/player/manifest/route.ts`,
`apps/player/app/_components/player-runtime.tsx` en
`apps/player/app/_lib/lg-legacy-page.ts`.

## 2. Productiebaseline

### Actueel meetvenster: 20:30–21:30 UTC

Geaggregeerde Supabase-edge-logs; geen tokens, klantpayloads of secrets opgeslagen:

| API-pad, ingekort | Requests/uur |
| --- | ---: |
| provider_asset_cache | 1.571 |
| get_worker_queue_hint_v3 | 776 |
| claim_ledscores_connections_v2 | 699 |
| record_player_heartbeat_v3 | 432 |
| sync_player_automation_v1 | 431 |
| get_player_effective_target_v1 | 427 |
| claim_due_rss_sync_v1 | 253 |
| get_player_entitlement_v1 | 237 |
| apply_due_content_schedules_v1 | 235 |
| claim_due_sportlink_sync_v2 | 230 |
| claim_published_data_refresh_v1 | 113 |

Dit is een waargenomen uur, geen universele belasting per scherm. Aantallen
verschillen per actieve bron, scherm, afspeelbeurt, planning en datasetwijziging.
De healthadvisor meldde op dit meetmoment geen healthwaarschuwingen.

### Cumulatief queryprofiel

`pg_stat_statements` is sinds 13 oktober opgebouwd; onderstaande gemiddelden
zijn nadrukkelijk geen actuele p95 of meting van alleen 16 november:

- `complete_published_data_refresh_v1`: 10.232 calls, gemiddeld 416,61 ms.
- `get_player_effective_target_v1`: een gemeten genormaliseerde queryvariant
  heeft 300.356 calls, gemiddeld 3,19 ms; andere varianten bestaan daarnaast.
- `record_player_heartbeat_v3`: 244.346 calls, gemiddeld 2,80 ms.
- De tenantbrede heartbeat-overzichtsquery: 91 calls, gemiddeld 3.100,54 ms.
- De Realtime-logical-decodingquery heeft het grootste cumulatieve totaal.
  Dat is beheerde infrastructuur; niet zonder onderzoek Realtime uitschakelen.

De server had circa 85.875 heartbeatrijen. Een begrensde read-only
`EXPLAIN (ANALYZE, BUFFERS)` voor het echte overzicht bevestigde een parallelle
sequential scan/sort: 806,876 ms, 2.530 gedeelde bufferhits, slechts 250
geretourneerde rijen. De bestaande indexen beginnen na `tenant_id` met
`device_id` of `screen_id`; zij leveren geen tenantbrede datumvolgorde.

### Publieke HTTP-steekproef

Eén niet-geauthenticeerde GET per route vanaf deze worker, inclusief netwerk:
homepage TTFB 128 ms, blog 261 ms, Control-login 178 ms en Player-health
133 ms; alle HTTP 200. Homepage circa 51,7 kB HTML. Dit is geen Lighthouse-,
LCP-, INP-, mobiele 4G- of end-userp95-meting.

### Aanvullende koude browsersteekproef

Eén Chromium-sample per route/variant, zonder scrollen, met lege browsercache:

| Variant | Homepage LCP | Blog LCP |
| --- | ---: | ---: |
| Desktop 1440×900, niet vertraagd | 340 ms | 428 ms |
| Viewport 390×844; 150 ms latency, 1,6 Mbps down, 0,75 Mbps up, 4× CPU | 1.840 ms | 3.492 ms |

Alle vier HTTP 200, geen pageerrors of horizontale overflow, fonts geladen;
CLS 0,0008–0,0021 in het observatievenster. Dit is een korte labsteekproef,
geen fysieke mobiele meting, INP of veld-CWV/p75. Een tweede mobiele blogproef
mat LCP 3.476 ms en identificeerde de introsectie als LCP-element. Haar
158-kB-achtergrond werd pas op 1.168 ms via CSS ontdekt en eindigde op
3.111 ms, terwijl navigatie- en prefetchresources dezelfde verbinding gebruikten.

VPS-steekproef vóór uitrol: 24 GB vrij (84% gebruikt), alle acht actieve
containers gezond, 3,2 GB beschikbaar RAM en load average 0,57. Bestaande
bouwpreflight eist 12 GiB en ruimt zo nodig uitsluitend oude ongebruikte
default-buildercache op met image/container/volumevingerafdrukken. Geen
onnodige imageprune of verwijdering van rollback-/andere projectdata uitgevoerd.

## 3. Geïmplementeerd

### A. Geordende heartbeat-index

De forwardmigration voegt alleen voor de bewezen query een B-tree toe:
`(tenant_id, created_at DESC) INCLUDE (screen_id, active_release_id, runtime_state)`.
De planner kan direct de nieuwste 250 rijen lezen zonder tenantbrede sortering.
RLS, toegang, referenties, historie en retentie wijzigen niet.
De migratie begrenst lockverwerving op 3 s en de statementduur op 15 s.
Een overschrijding faalt de migratie; er is geen stille bypass.

Een lokale rollbackfixture met 100.000 rijen en dezelfde bestaande indexvormen
mat 19,437 → 0,101 ms en 1.137 → 8 geraakte bufferpagina's. De regressie
controleert het werkelijke queryplan en bufferbezoek, niet een instabiele
milliseconden-SLA. Dit is geen na-uitrolmeting op productie.

### B. Begrensde providerassetmetadata en single-flight

`SupabaseLedScoresPlayerAssetRegistry` deelt gelijktijdige identieke lezingen
en bewaart alleen succesvolle immutable versie-ID's maximaal 60 s. De
bestaande zesuursgrens van de provider blijft een eerdere harde vervaldatum.
Een teruglopende klok invalideert de lokale cache. Missers en fouten worden
niet negatief gecachet. Bron-URL, externe identiteit, entitytype en client-
instance houden hun bestaande scheiding; geen authenticatie- of tenantquerycache.

Positieve metadata en lopende lezingen hebben ieder maximaal 512 ingangen.
Bij overschrijding blijft een gewone geautoriseerde lezing mogelijk; geen
media, producten of playlistitems worden door deze geheugengrens geweigerd.
Succesvolle eigen activatie invalideert oude metadata én oude pendingregistratie,
zodat een late oude response de nieuwe cache niet opnieuw vult.

`LedScoresPlayerAssetImporter` deelt ook een volledige koude import, inclusief
download, native decode, upload en activatie. De sleutel bevat tevens tenant-ID.
Na voltooiing verdwijnt die single-flightregistratie; toekomstige aanvragen
volgen opnieuw de bestaande providerregistry en haar vervalregels.

Tests bewijzen 100 identieke warme/concurrente lezingen → één databaseaanvraag,
25 koude importaanvragen → één geverifieerde import en geen tenantoverschrijdende
importdeling. Een vertraagde lookup van vóór activatie mag de vervangende
cacheversie niet overschrijven; een mislukte activatie behoudt de bevestigde
goede versie. De besparing van het volledige productieverkeer is nog niet gemeten.
Sportlink gebruikt al een begrensde gebatchte logolezing; die wordt niet blind
vervangen door een tweede algemene cache.

### C. Eén assetresolutie per renderpoging

Een Menu-PNG-refresh loste assets eerst voor React-capture en daarna opnieuw
voor de Menu-binarymetadata op. De tweede lezing kon zelfs andere metadata
of ondertekende URL's zien. Eén lazy Promise per geclaimde poging levert nu
beide projecties exact dezelfde assetset. Volgende jobs/tenants krijgen een
nieuwe Promise. De bestaande generic-renderfallback, leasebewaking, volledige
assetcontrole, checksum en completion blijven bestaan.

### D. Control-refresh met zichtbaarheid en backpressure

Onboarding, automatiseringsvoortgang en thema-uitrol gebruiken een gedeelde
helper. Geen automatische routeaanvragen bij een verborgen tab of offline
browser. Terugkeer/onlineherstel vraagt eenmaal direct de actuele status op.
Een React/Nextrouter-transition moet gereed zijn voordat de volgende pollcyclus
begint; timers en dubbele browser-events veroorzaken geen overlappende requests.
Unmount verwijdert alle timers/listeners. Intervallen blijven respectievelijk
3/5/3 s; handmatige acties, opslag, toetsenbordbediening en huisstijl blijven.

### E. SQL NULL-guard voor legacy-binaire opdrachten

De Menu-enqueueguard gebruikte `NOT (protocol = 2 AND menuDocument aanwezig)`.
Bij een ontbrekend protocol werd dit NULL; de omringende `IF` sloeg daardoor
niet aan. Een historische menuversie kon onterecht dure, onvoltooibare binaire
cachetaken en uploadreserveringen krijgen. Productie bevatte opnieuw zo'n
historische fout naast actieve, geldige caches.

Dezelfde forwardmigration maakt uitsluitend die eligibilitycheck fail-closed
met `IS DISTINCT FROM TRUE`. De RED-proef reproduceert twee fouten. Na de fix
zijn twaalf regressies groen, inclusief onversioneerd/null/v1/v2 Menu,
bestaande Source-contracten en gesloten ACL's. De harness gebruikt de echte
functiebody met uitsluitend tijdelijke fixturetabellen; de oorspronkelijke
Source/Menu-contractproeven worden aanvullend uitgevoerd.

Oude snapshots, releases, cachebytes en reserveringen worden niet automatisch
verwijderd. Een verlopen lease bewijst niet dat een oude Storagewriter weg is.
De bestaande operator-drain/Storage-firstprocedure blijft noodzakelijk voor
reeds achtergebleven reserveringen; budget verhogen of SQL-only vrijboeken
zou de veiligheidsgrens breken.

### F. Vroege ontdekking van de blogachtergrond

De bestaande introfoto blijft exact hetzelfde bestand op dezelfde positie.
Alleen de blogindex declareert een image-preload met hoge fetchprioriteit,
zodat de browser niet op de stylesheet hoeft te wachten voor ontdekking.
Artikeldetails laden deze indexachtergrond niet extra. Geen nieuwe client-JS,
beeldcompressie, kleur, layout, brondata- of publicatiecachewijziging.

Een unitcontract koppelt de preload-URL aan de werkelijke CSS-achtergrond.
Twee Chromium-proeven renderen de echte Server Component naar HTML, vervangen
alleen Next Link/datatransport/CSS-modulebindings en vertragen de stylesheet.
Bij 390 en 1440 pixels begint de echte imageaanvraag vóór de CSS-completion;
na het toepassen van die stylesheet blijft het bij precies één download.
Dit bewijst resourceontdekking en hergebruik, niet een productie-LCP-SLA.

Een afzonderlijke lokale HTML-interventie gebruikte exact één opgevangen
productiedocument, in beide varianten lokaal geserveerd. Alleen de preloadlink
verschilde; drie afwisselende koude paren onder dezelfde mobiele vertraging:
baseline LCP 3.388/2.992/2.976 ms, preload 2.304/2.276/2.296 ms. Mediaan
2.992 → 2.296 ms (circa 23% lager); achtergrondontdekking circa 911–934 →
13–16 ms. Iedere proef downloadde die foto eenmaal en dezelfde 522.729
resourcebytes. Document-TTFB is in beide varianten door de interventie
uitgesloten. Dit is causaal labbewijs voor de preload, geen na-uitrolmeting,
fysieke telefoon of algemene siteversnellingsclaim.

## 4. Waarom niet alles cachen of sneller pollen?

- De bestaande Control-sessie gebruikt al request-scoped React `cache()`.
  Een procesbrede sessie-/membershipcache zou revocation en tenantisolatie schaden.
- De manifestroute controleert autorisatie en na voorbereiding opnieuw de
  effectieve target/data-identiteit. Beide controles zijn nodig tegen stale
  responses; geen globale volledige manifestcache toegevoegd.
- `QueueWakeup` deelt al één kleine readinesshint over zes lanes, met
  eindige safetyclaims en foutbackoff. De hint verleent geen lease.
- Geen generieke bronrevisie-shortcut: sportvensters, verjaardagen, thema's
  en planning kunnen door tijd veranderen zonder een nieuwe providerrow.
- De publieke blog leest bewust bevestigde publicatiegegevens direct;
  algemene responsecache zou de bestaande publish-/unpublishgarantie wijzigen.
- Marketing gebruikt al responsieve WebP-heroassets met hoge fetchprioriteit
  en lazy loading onder de vouw. Geen ongeteste cosmetische herbouw.
- Geen bulktoevoeging van alle advisor-indexen: iedere index kost opslag en
  INSERT/UPDATE/WAL-werk. Ook een nu ongebruikte index kan een zeldzame veilige
  delete/foreign-keycheck of geplande operationele handeling beschermen.

## 5. Geprioriteerd vervolg, met expliciete acceptatie

| Prioriteit | Vervolg | Bewijs vóór activering |
| --- | --- | --- |
| P0 operationeel | Achtergebleven binarywriters begrensd draineren en alleen bewezen inactieve Storageprefixes vrijgeven | Huidige/vorige artefacten identiek, exacte deleteset, Storage-readback, guarded DB-ack, actieve Playerframebevestiging |
| P1 | De 416-ms-projectie per fase profileren; gedeelde bronfeiten eventueel eenmaal per generatie normaliseren | Zelfde versiegebonden selectie, prijzen, timezone en tijdvensters; geen source-ingestlock; race-/generationproeven |
| P1 | Indexeffect en asset-/refreshverkeer na uitrol opnieuw meten | Vergelijkbaar 60-minutenvenster, queryplans, calls/s, p50/p95, WAL/CPU en foutpercentage |
| P1 | Routespecifieke overzichts-RPC's/paginering bij grotere tenants | Geen verlies van oude actieve releaseverwijzingen, juiste tellingen boven API-paginagrenzen en tenant-RLS |
| P2 | Queue-wakeup op het bestaande eventsysteem onderzoeken | Minder idleclaims zonder langere cold-joblatentie, reconnectherstel en periodieke safetyclaim |
| P2 | Openbare CWV op mobiel en echte apparaten meten | LCP/INP/CLS, koude/warme cache, trage verbinding, geen kwaliteits-/toegankelijkheidsverlies |
| P2 | Beheerde Realtime-, pooling- en retentiekosten per schaalniveau profileren | Geen verlies van wijzigingsmeldingen, audit-/framebewijs of offline herstelreferenties |

Dit zijn geen als voltooid voorgestelde wijzigingen. Speculatieve grote
schema-, protocol- of cachearchitectuurwijzigingen zonder meet- en racebewijs
horen niet in dezelfde hotfix.

## 6. Versheid en veilige grenzen

`bronwijziging → volgende toegestane providerpull → persist → dataqueue →
projectie/optionele encode → manifestsignaal/poll → download/verificatie →
natuurlijke afspeelgrens` is de echte totale vertraging.

De normale gedeelde workerhint wacht ongeveer 4–5 s; wachtrij, verwerking,
providerbackoff en safetyclaims kunnen dat verlengen. Na DOM-factcompletion
is geen algemene MP4/PNG-encode nodig voor een geschikte moderne consumer.
Legacybinaire refresh heeft bewust maximaal één encode per configuratie per
vijf minuten en blijft afhankelijk van daadwerkelijke output en cachecapaciteit.
LG controleert normaal iedere 8 s plus maximaal 750 ms jitter; download en
verificatie komen daarna. Een gemiste melding wordt dus ook door polling en
een volgende dynamische afspeelbeurt hersteld. Foutbackoff en offline zijn geen
normale-online-SLA; de laatste goede versie blijft spelen.

S315 verandert deze Player-/providerintervallen niet. Er is geen universele
maximale provider→TV-tijd te beloven: de bronpolicy, videoduur, playlist-/zonegrens
en verbindingssnelheid verschillen. De logo-metadata-TTL vertraagt geen prijs-,
score-, nieuws- of publicatiefeiten; een ongewijzigde logo-URL kan maximaal
60 s later opnieuw uit de registry worden gelezen, binnen de bestaande 6 uur.

## 7. Controles en uitrolstatus

Lokaal: foundation lint, typecheck en unit elk 32/32 tasks; gerichte cache-,
render- en refreshregressies; vijf Chromium-proeven; twaalf
enqueue-eligibilityproeven en negen index-/tenantproeven in rollbacktransacties.
De bestaande binaire regressie heeft 70 controles en het Menu-contract 27.
Na de goedgekeurde lokale reconciliatie zijn die proeven opnieuw uitgevoerd,
nu ook met alle 35 observatiecontroles groen. De derde browserproef monteert
de werkelijke hook in React StrictMode met een gecontroleerde Next-routeradapter:
een gesuspendeerde transition houdt de vorige content zichtbaar, veroorzaakt
geen overlappende polls, hervat na completion en stopt bij deactivatie/unmount.
Dit is geen volledige Next-RSC-netwerk- of fysieke TV-proef.
De twee aanvullende blogproeven bewaken vroege resourceontdekking zonder
dubbele download op desktop en mobiel; het blogunitcontract bewaakt de CSS-URL.
Zie het lokale verificatie-incident hieronder: de oorspronkelijke afzonderlijke
S315-fixtures rolden correct terug, maar een latere predecessor-harness niet volledig.
Het eerste volledige unitverzoek miste een bestaand native PNG-fixture in deze
sparse worktree. Het exacte tracked referentiebeeld is hersteld, niet vervangen
door nepuitvoer; de herhaalde volledige unitgate slaagt.

De eerste lokale Chromium-proeven gebruikten de aanwezige andere browserbinary
via een afzonderlijke niet-gecommitte testconfig. Voor het aanvullende
watchdogonderzoek is daarna de daadwerkelijk gepinde Chromium 1228 in een
afzonderlijke taakcache geïnstalleerd. De vijf nieuwe browserproeven en de
volledige watchdogsuite zijn ook daarmee groen. Geen productionconfig of
normale gepinde CI-browsergate is vervangen.

De schone volledige migratie/RLS-, build-, browser/a11y-, Player/offline- en
native Workerimagegates blijven verplicht vóór normale uitrol. Productie heeft
op dit dossiermoment alleen read-only onderzoek gehad; geen nieuwe code of
migratie is als live voorgesteld. Fysieke Android/LG-acceptatie, CWV-veldmetingen
en een nieuwe vergelijkbare productie-uurmeting zijn nog afzonderlijke bewijzen.

## 8. Lokaal verificatie-incident en goedgekeurd herstel

De gedeelde lokale container `supabase_db_veyocast-s295` liep dertien
migratiebestanden achter op deze kandidaat. Om de bestaande Menu-proef met
de juiste voorgangers te controleren, voegde de agent die bestanden samen
binnen een bedoelde rollbacktransactie. Dat was onveilig: het bestaande
`20261111020903_rss_onzetrots_layouts.sql` bevat een eigen `BEGIN`/`COMMIT`.
Daardoor werden de voorgaande wijzigingen gecommit en liep de resterende
schema-aanvulling vóór de eigen testtransactie buiten die rollback.

De fout is door deze verificatiestap veroorzaakt, niet door de nieuwe
applicatiecode of door een productie-uitrol. De agent heeft de verdere
schemahandelingen gestopt en de afwijking expliciet gemeld.
Een daaropvolgende uitsluitend read-only controle bevestigt:

- nul tenants en nul Auth-gebruikers in deze lokale database;
- migratiehistorie nog op `20261109000829`, maar schema-aanvullingen uit de
  dertien bestanden `20261109113947` tot en met `20261116213059` aanwezig;
- onder meer `sponsor_play_events_campaign_period_idx` en de nieuwe
  `player_heartbeats_tenant_recent_idx` bestaan nu lokaal;
- het eigenlijke Menu-testfixture is wel teruggedraaid;
- staging en productie zijn niet gemigreerd, gedeployd of anderszins gewijzigd.

De gebruiker koos expliciet voor behoud van lokale gegevens en gecontroleerde
reconciliatie met huidige main. Vóór uitvoering is een volledige private
custom-formatbackup gemaakt en zowel checksum als volledige archiveleesbaarheid
gecontroleerd. Een lokaal operatorscript gebruikte één transactie met
lock-/statementgrenzen, exacte functie-/indexguards en bewaarde oude historie.
Het script voerde geen eerdere migratie opnieuw uit: uitsluitend de twaalf
aantoonbaar uitgevoerde mainbestanden zijn met hun oorspronkelijke SQL en
bronhashes geregistreerd. Alleen de twee nog niet uitgerolde S315-schemaeffecten
zijn teruggedraaid, zonder eigenaarschap of functiegrants te veranderen.

Na commit van die lokale hersteltransactie: 225 historieregels, laatste versie
`20261113124946`, geen S315-historieregel of -index, oorspronkelijke mainfunctie
hersteld, nog steeds nul tenants en nul Auth-gebruikers. Geen reset, geen
verwijderde domein-/Auth-/Storagegegevens en geen staging-/productiewrites.
De backup en het uitvoeringsbewijs blijven privé buiten Git beschikbaar.

De vijf gerichte SQL-suites zijn vervolgens opnieuw uitgevoerd door alleen
de transactie-vrije S315-migratie in een rollbackfixture toe te passen. Alle
153 controles slagen; een afsluitende controle bevestigt opnieuw de ongewijzigde
mainhistorie en afwezigheid van de kandidaatindex. Transactionele voorgangers
worden niet meer samengevoegd in zo'n harness; volledige replay blijft een
verplichte schone disposable-CI-gate. Het incident blijft expliciet onderdeel
van dit dossier, ook na geslaagd herstel.

## 9. Hosted bewijs en expliciet geautoriseerde watchdogfixture

De eerste volledige hosted eindrun op `7139ffb22` bevestigt 161 SQL-bestanden /
5.628 assertions na schone migratiereplay; echte private uploads, selectie,
TUS-herstel, immutable publicatie en eerste frame; alle foundationgates en
19 builds; de echte Workerimage met 354 geverifieerde assets, zes native
RSS-captures, zestien menuproducten, SVG en H.264. Marketing 27 browserproeven,
Control en alle vijf oorspronkelijke Sites-/responsivegates slagen eveneens.

Van 536 oorspronkelijke Playerproeven faalt één oude watchdogproef in shard 1;
drie shards slagen en de aggregate closure blijft terecht rood. Niets wordt
gedeployd of op main samengevoegd met deze rode gate. Eerst leek de diagnose-
tekst verouderd. De bewaarde native trace toont echter ook extra decodefouten:
de Player rapporteert al RESTART_LOOP met recoveredAt en vervolgens een lege
foutheartbeat, terwijl de oorspronkelijke proef exact SKIP_ITEM verwacht.
De ongewijzigde proef slaagt tienmaal op de bestaande mainimage met dezelfde
gepinde browser. Dit is een timingafhankelijke vermenging van herstelniveaus,
niet een door S315 gewijzigde Player of slechts een tekstcorrectie.

De gebruiker autoriseert eerst gericht testherstel en daarna expliciet een
deterministische tweefoutenfixture plus aparte foutenreeksproef. De oorspronkelijke
naam en exacte SKIP_ITEM-, item-ID-, zichtbare fallback-, recoveredAt- en
foutopruimingsasserties blijven bestaan. De fixture laat echte native fouten
van corrupte videobytes door, één per video-instance en alleen voor de
verwachte itemvolgorde. Extra foutmeldingen tellen niet ongemerkt als een
ander scenario. De extra proef gebruikt een tweede defect playlistitem en
eist na precies drie toegelaten fouten exact RESTART_LOOP voor dat item,
daarna hetzelfde echte fallbackframe en dezelfde heartbeatopruiming. Beide
bewaken bovendien de daadwerkelijk getoonde retrytekst tussen fout één en twee.
Geen OR-versoepeling van herstelacties, timeoutverhoging, skip of Playerdelta.

Gericht: beide scenario's vijfmaal groen met gepinde Chromium. Vervolgens
de volledige watchdogsuite plus de vijf nieuwe Control/Marketingproeven:
11/11 groen in productie-servermodus. De eerste lokale brede proef gebruikte
abusievelijk de dev-testmodus tegen een productionbuild; alleen de bestaande
stallassertie gebruikte daardoor 2,5 s in plaats van haar bestaande 14,5 s.
Met de juiste bestaande modus is die proef groen, zonder test-/timeoutwijziging.

Deze aanvullende browserproef gebruikt een begrensde, read-only QA-container
van de bestaande mainimage op een alleen-lokale poort via SSH, zonder
Supabasecredentials. Het is geen fysieke TV- of tenantproef en verandert geen
live playlist of omgeving. Alle normale hostedgates moeten op de daaropvolgende
testfix-SHA opnieuw slagen vóór staging-/productiepromotie. Actuele resultaten
en uitrolbewijs horen bij [PR 344](https://github.com/veyocast/platform/pull/344).

## Primaire referenties

- [PostgreSQL: ORDER BY en indexen](https://www.postgresql.org/docs/current/indexes-ordering.html): B-tree + LIMIT kan de eerste rijen direct leveren.
- [Next.js useRouter](https://nextjs.org/docs/app/api-reference/functions/use-router): refresh is een router-/Server Component-update, geen providerimport.
- [React useTransition](https://react.dev/reference/react/useTransition): pendingstatus en transitions ondersteunen niet-blokkerende updates.
- [React link](https://react.dev/reference/react-dom/components/link): declaratieve image-preload, fetchprioriteit en plaatsing in de documenthead.
- [Supabase indexadvisor](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys): waarschuwingen vragen query-/write-analyse, geen blinde indexstorm.
