# S185 — Actuele publicatie en onafhankelijke live data

## Baseline en bewezen oorzaken

Onderzocht vanaf `4675c1c253aa1e59c0b6eef4127d414c921f0893`. De vier publieke
Control/Player-healthroutes voor staging en production rapporteerden deze SHA
op 19 september 2026. Dit bewijst geen actuele versie op fysieke apparaten.

- `apps/player/app/_components/player-runtime.tsx::advancePlayback` vereist
  `nextSelection.wrapped`; de gecontroleerde publicatiewissel wacht dus op de
  volledige loop. `syncOnlineManifest` houdt `syncInFlight` vast tijdens alle
  assetdownloads, verificatie en hydratatie. De normale hercontrole is 60 s
  (`app/_lib/player-runtime-config.ts`).
- `apps/player/app/_lib/lg-legacy-page.ts::nextItem` vereist eveneens `wrapped`.
  `syncManifest` houdt de manifestlock vast tijdens `preparePendingRelease`.
  `activatePendingRelease` controleert de kandidaat pas na lokale persistentie.
- `supabase/migrations/20260904212639_s146_sportlink_arrival_groups.sql`:
  trigger `dynamic_slide_auto_publishes_latest` roept
  `private.enqueue_dynamic_release_refresh_v1` aan. De private queue is echt
  publicatiewerk; `claim_dynamic_render_job_v1` verwerkt dit via
  `process_due_dynamic_release_refresh_v1`. De processor wacht op eerdere
  playerbevestigingen, renderjobs, 30 s settletijd en vijf minuten tussen batches.
  `publish_queued_dynamic_release_v1` kloont gebruikte immutable vertakkingen.
- `20260906143000_s153_slide_theme_backoffice.sql` introduceert daarnaast
  `process_theme_rollout_release_branches_v1` en
  `clone_theme_release_branch_v1`; S180 vervangt de clonefunctie. Dit is een
  afzonderlijke configuratieproducent en moet expliciet worden gemigreerd.
- `public.publish_playlist_to_targets_v3` zet geselecteerde schermen op default
  en wist `active_schedule_id`. Dat is niet geschikt voor defaultvernieuwing
  tijdens een actieve planning.
- `apps/player/app/_lib/player-release-envelope.ts` leest immutable releaseitems
  en snapshots. De item-ID is nu het nieuwe releaseitem-ID, niet `source_item_id`.
  Dat belemmert betrouwbare vergelijking met de daadwerkelijk actieve inhoud.
- `DynamicTemplateMedia` gebruikt de gedeelde `EditorialArenaRenderer`; Static
  LG heeft een zelfstandige runtime. De PNG is fallback, niet uitsluitend het
  zichtbare eindproduct. Verjaardagsprojectie rond lokale middernacht bestaat al.
- `/api/player/realtime` gebruikt device-geautoriseerde server-side Supabase
  Realtime met SSE naar de player, maar is gekoppeld aan LED Scores. Dat kanaal
  kan ook kleine publicatie-/data-invalidaties dragen, zonder goal-events samen
  te voegen of te vervangen.
- `player-cache.ts` heeft checksumcache en atomische active/previous-IDB-opslag.
  Die garanties blijven bestaan; verouderde voorbereiding mag ze niet overschrijven.

## Doel en uitvoeringsvolgorde

1. Gebruik de playlist-ID als stabiele publicatie-identiteit. Bewaar de actuele
   immutable configuratierevisie expliciet; overschrijf historische releases niet.
   Publicatiehashes bevatten configuratie, nooit actuele brondata of signed URLs.
2. Orden effectieve schermopdrachten met een eigen monotone `targetRevision`.
   Defaults, expliciete doelen en planningen blijven afzonderlijk betekenisvol.
3. Ontkoppel detectie van voorbereiding. Eén kandidaat met generatietoken,
   annuleerbare downloads en controles vóór persistentie én zichtbare activatie.
   Benut item-/paginagrenzen; speel correcte video uit. Vergelijk stabiele items
   met de actieve configuratie voor eenmalige wijzigingsvoorrang.
4. Houd gepubliceerde ontwerpen bevroren en ververs hun datasets centraal via
   bestaande bronflows. Alleen inhoudswijzigingen verhogen de datarevisie.
   Geen draftqueries vanuit players en geen publicatiebijwerking bij bronupdates.
5. Gebruik realtime als invalidatie, met geautoriseerde conditionele hercontrole
   binnen circa tien seconden en directe hercontrole bij reconnect/hervatting.
6. Test contracten, races, RLS, browser en Static LG; behoud goal-eventsemantiek,
   premium layouts, reduced motion en offline last-known-good.
7. Staging eerst via bestaande immutable deployment; production na groene gates
   en een inventarisatie van de bestaande productieomgeving. Migreer daarna uitsluitend Duindorp SV en
   observeer echte eerste-framebevestigingen. Retentie begint met een dry-run.

## Scope en operationele grenzen

S185 bezit relevante publicatie-, player-, worker-, contract-, database-, test-
en documentatiepaden. Locked merkassets, dependencies en andere tenants vallen
buiten inhoudelijke mutaties. Eén branch/worktree, geen wijziging aan andere
worktrees. Geen credentials, ruwe productiedatasets of debugexports in Git.

De beschikbare Supabase-connector toont andere Duindorp-projecten, niet VeyoCast.
GitHub Environment bevestigt production `csrakhciqvehitplvale`, staging
`jibbtdicrptsyftobavq`. Connectoraccess op VeyoCast wordt geweigerd. Bestaande
Tailscale SSH vraagt een aanvullende login; die toegang is aangevraagd.

## Uitrol- en rollbackgates

Stop bij tenantisolatiefout, stale-targetactivatie, verlies van offline fallback,
rode relevante testgate of niet-verifieerbare configuratiemapping. Geen cleanup
voordat referenties en herstelkopie aantoonbaar zijn. Approllback gebruikt de
bestaande deploymentrollback naar de vorige immutable image; databasewijzigingen
zijn forward-only en moeten die oudere player blijven ondersteunen.

Status: onderzoek afgerond voor de kernpaden; implementatie en live inventarisatie
lopen. Geen uitrol, tenantcutover, performanceclaim of fysieke hardwareacceptatie.

## Implementatiecontract en uitzonderingen

- `playlist_publications` wijst per playlist naar één immutable configuratie.
  Bestaande records krijgen een exacte mapping; hun bytes worden niet gewijzigd.
  Herhaald publiceren met dezelfde configuratiehash maakt geen nieuwe revisie.
- `screens.target_revision` ordent opdrachten onafhankelijk van playlistversies.
  De scheduler vergrendelt het scherm vóór de actuele planningselectie en negeert
  evaluaties die ouder zijn dan zijn laatst verwerkte beslissing.
- `published_dynamic_data` bewaart alleen live gegevens bij een gepubliceerde
  snapshotselectie. De rendererconfiguratie komt uit de exacte gepubliceerde
  slideversie. Thema en ontwerp blijven bevroren; providerfoto's en logo's kunnen
  via de dataset wijzigen. Alleen werkelijk gewijzigde inhoud verhoogt de revisie.
  Historische, onbereikbare selecties worden niet meer ververst. Een recente
  offline player heeft dertig dagen bescherming via zijn actieve referentie.
- De oude dynamische publicatietrigger is verwijderd. De renderclaim roept geen
  publicatieverwerking meer aan. De drie oude workerfuncties
  blijven tijdelijk als resultaatloze adapter beschikbaar voor reeds gestarte
  workers. Hun private queue krijgt geen nieuwe producent. Een bewuste thema-
  wijziging mag nog één configuratie publiceren, mits zowel de thema-instelling
  als de bronpublicatie nog actueel zijn. Historische vastzettingen vertakken niet.
- React en Static LG bereiden hooguit één kandidaat voor. Downloads, persistentie
  en callbacks controleren de generatie. Detectie wacht niet op downloads; het
  device-geautoriseerde SSE-kanaal invalideert alleen relevante actuele doelen en
  databindings. Hercontrole: 8 s plus maximaal 750 ms jitter; uitval gebruikt backoff.
- Een handmatige wijziging krijgt één eerste afspeelronde met gewijzigde zichtbare
  items vooraan, vergeleken met werkelijk actieve inhoud. Een actieve planning of
  sponsorplan behoudt de afgesproken volgorde. Dit is een expliciete uitzondering
  op wijzigingsvoorrang. Live data veranderen index, itemtimer en configuratie niet.
- Het bestaande offlinecontract vereist een volledige geverifieerde lokale
  publicatie vóór activatie. Daarom blijft volledige mediacaching hier verplicht.
  Een groot ongecachet bestand later in de playlist kan de voorbereiding verlengen;
  dat wordt niet als natuurlijke-overgangswachttijd gemeld. De snelheidstest geldt
  voor reeds beschikbare media. Er is geen nieuwe gedeeltelijk-offline toestand.
- Runtimeversie, configuratie- en targetrevisie zijn afzonderlijk. De heartbeat
  bewaart één compact actueel synchronisatiedetail. De eerste-framebevestiging
  volgt op de gepresenteerde DOM/frame; Control leidt succes niet uit online-zijn af.
  `committedAt` komt uit de WAL-notificatie bij de overeenkomende targetrevisie.
  Zonder ontvangen commitbewijs blijft dit veld leeg; `targetWrittenAt` bewaart
  afzonderlijk het eerdere database-schrijfmoment. Metingen tussen apparaten
  vereisen daarnaast bekende klokafwijking. Boundary/framevertraging is monotoon.
- Cachecollectie beschermt actieve, voorgaande, voorbereide en nog zichtbare media.
  Generatieannulering verwijdert geen gedeelde checksumbytes. Object-URL's van een
  uitgaande transitie worden pas na de overgang vrijgegeven.

## Uitvoering via bestaande bevoegdheidsgrens

`.github/workflows/current-publication-maintenance.yml` draait uitsluitend vanaf
main op de bestaande omgevingsrunner met de bestaande DB-ownersecret. `inventory`
leest één exact bevestigde tenant en maakt een begrensde technische
voor-/nameting zonder tokens of inhoudelijke brondata. `cutover` vereist de juiste
Control- en Player-SHA, fixed light en Europe/Amsterdam. De ownerfunctie publiceert
uitsluitend gebruikte playlists, behoudt planning en defaults, raakt geen actieve
playerbevestiging aan en schrijft een expliciet systeemauditevent zonder gebruikers-
JWT te simuleren. Iedere playlist is een afzonderlijke hervatbare transactie.
Een optioneel playlist-ID begrenst de canary; een observatievenster van maximaal
180 seconden bewaart de echte playerbevestigingen. `refresh` plant alleen gebruikte
RSS-/Sportlink-bronnen via bestaande workers, leases en cooldowns. Twelve Excel
en handmatige producten houden hun expliciete import-/bewerkflow.

De inventarisatie werkt ook vóór de S185-databasemigratie. Die baseline telt tevens
andere tenants met recent actieve dynamische players; hun compatibiliteit moet
vóór productioncutover beoordeeld worden. Voor-/nametingen bewaren scherm-, groep-
en planningverwijzingen. De beheerworkflow is lokaal end-to-end getest tegen de
geïsoleerde fixture; dit is geen bewijs van uitgevoerde productiehandelingen.

De retentie-uitvoer is een dry-run: aantallen onbereikbare oude configuraties,
provenanceverwijzingen en een bovengrens van de releasebytes. Dit is geen bewezen
netto opslagwinst: gedeelde assets, logo's, foto's en doelpuntintro's vergen een
aparte referentiecontrole. Er zijn nog geen records of assets verwijderd.

Een cataloguscontrole van de gemigreerde database vindt nog precies twee
release-materializers: `private.materialize_publication_configuration_v1` voor
bewust publiceren en `private.clone_theme_release_branch_v1` voor een bewuste,
nog actuele themaconfiguratie. De brontriggers roepen geen release-materializer
meer aan. Het bestaande renderwerk blijft beschikbaar voor Studio/posterfallback.

## Lokaal verificatiebewijs

- Verse migratiereset in de geïsoleerde database `veyocast-s185`: geslaagd.
  RLS: 84 bestanden, 2.173 assertions. Database-lint: geen errors; zes reeds
  bestaande functiewaarschuwingen. De gedeelde lokale database is niet gereset.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`: elk 30/30 workspacetaken groen.
  De Player-suite bevat 327 geslaagde unittests in 59 bestanden.
- De volledige Chromium-run had 278 geslaagde tests en 30 expliciete live-opt-ins
  overgeslagen. Drie initiële fouten zijn afzonderlijk hersteld/gecontroleerd:
  de oude publicatiepagina-labels, een Next-dev-herstart in Studio en renderskew
  tijdens een zwaar belaste goalfixture. Geen blijvende uitsluiting toegevoegd.
- De volgende gecombineerde toegankelijkheids-, verjaardag-, goal- en offlinerun
  slaagde met 58 tests en één live-opt-in overgeslagen. De vier nieuwe
  verjaardagsbeelden zijn visueel bekeken: lightmode, begrensde kaartcanvas,
  confetti vóór de foto en achter de tekst; cleanup, motion-off en Amsterdamse
  middernacht zijn automatisch gecontroleerd.
- Tien aanvullende browserintegratietests slagen voor React en Static LG:
  tien pending doelen worden één laatste doel, laat afgeronde B-download na D,
  playlist A/revisie 100 naar B/revisie 1, live data zonder remount, nieuwe opdracht
  tijdens een vertraagde echte IDB-commitcallback en procesherstart tussen complete
  IDB-commit en zichtbare activatie. Herstel gebruikt complete lokale inhoud.
- In de fixture met 25 items van vijf seconden werd alleen publicatie 1 en daarna
  11 bevestigd. Gewijzigd item 20 kwam direct eerst. Gemeten extra vertraging na de
  itemgrens: React 29,0 ms; Static LG 49,2 ms. Dit zijn twee Chromium-metingen met
  beschikbare media, geen P95, productienetwerkmeting of fysieke LG-acceptatie.
  De fixture heeft geen WAL-commitbewijs en rapporteert `committedAt=null`.
- Een mislukte lokale cachecollectie blokkeert latere voorbereiding niet. Deze
  foutweg heeft een regressietest; gecancelde voorbereiding verwijdert geen bytes
  die een nieuwer doel deelt.

De productie-inventarisatie bewaart commandorondlooptijd afzonderlijk van de
playertrace. Die tijd omvat CLI-start, netwerk en SQL; zij wordt niet gepresenteerd
als uitsluitend databasewachttijd. Live commit→signaal-P95 en Control-responstijden
zijn nog niet bewezen. De definitieve productiebuild is groen (18/18), evenals beide workflowvalidators.
Twaalf aanvullende React/Static LG-goalintrotests zijn groen: oriëntatiekeuze,
volledig beeld, natuurlijk einde en veilige videofallback. CI en uitrol volgen
op deze lokale resultaten.
