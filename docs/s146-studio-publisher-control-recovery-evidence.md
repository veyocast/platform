# S146 — Studio-, Publisher- en Control-recovery

Status: `READY_FOR_RELEASE`

Deployment: `NOT_DEPLOYED`

Datum: 5 september 2026

Branch: `veyocast/s146-studio-publisher-recovery`

Baseline: `6e6cb7221abd4a1c0bbd95baafc76c4b26991e16`

## Auditconclusie

S146 herstelt zes samenhangende regressies zonder bestaande content, assetlinks
of immutable playlistreleases te herschrijven. Sportlink-welkomstslides waren
technisch per team gemodelleerd, de schermformulieren lekten de volledige
releasehistorie naar een operationele keuzelijst, gewijzigde `latest`-snapshots
konden synchronisch releases blijven klonen zonder Player-backpressure,
renderjobs konden bij omgekeerde voltooiingsvolgorde een oudere snapshot
promoveren, publish maakte de targetlijst afhankelijk van optionele telemetry
en meerdere Control-loaders konden boven de standaard PostgREST-grens van 1.000
rijen stil onvolledig worden. Veel Control-routes vielen daarnaast terug op
generieke pre-FieldFlow-presentatie.

De oplossingen zijn respectievelijk: één aggregate component per aankomstdoel,
één bounded latest-plus-referenced fleetprojectie, deterministisch gepagineerde
Control-loaders, een duurzame per-playlistwachtrij met coalescing en
Player-backpressure, monotone snapshotpromotie met behouden provenance,
fail-soft preflight boven een harde schermlijst en centrale routespecifieke
shellmetadata. Historische snapshots blijven daarbij volledig onaangeroerd en
houden `snapshot_sequence = NULL`; alleen nieuwe snapshots krijgen via een
private sequence en insert-trigger een database-owned volgnummer. Payload,
status, assetkoppeling en releasehistorie blijven inhoudelijk ongewijzigd.

## 1. Sportlink-aankomstcomponenten

### Oorzaak

`buildSportlinkSlideDrafts` paste team × blueprint ook toe op
`sportlink.visitor_arrivals` en `sportlink.referee_arrivals`. De UI liet de
beheerder daardoor 22 aparte concepten maken wanneer 22 teams waren gekozen.

### Herstelcontract

- Per gekozen aankomstblueprint ontstaat precies één draft/component.
- Die draft draagt 1–100 unieke `teamContexts`; de eerste blijft als
  compatibele primaire `context` beschikbaar.
- Nieuwe teamselecties starten met `auto_current`. Daarbij zijn competitie,
  fase, poule en seizoen verplicht `null`; per team kan een aantoonbaar
  gesynchroniseerde context worden gepind.
- Zoeken, `Alle teams`, tags en verwijderen delen één selectiebron. De teller en
  live preview gebruiken dezelfde afgeleide drafts.
- Gewone programma-, uitslag- en standslides behouden team × type.
- De versie-editor normaliseert een legacy-aankomstslide zonder
  `teamContexts` naar de huidige teams en bewaart overrides bij herordenen.

### Databasegrens

Migratie `20260904212639_s146_sportlink_arrival_groups.sql` voegt bounded
validatie, een trigger en `create_sportlink_slide_batch_v3` toe. De command:

- vereist de bestaande `tenant.dynamic_slide.write`-capability en een actieve
  tenant;
- valideert dat ieder team actief is binnen dezelfde tenant en databron;
- weigert onbekende velden, meer dan 100 teams, dubbele team-ID's, ongeldige
  pinned contexten en een tweede component van hetzelfde aankomsttype;
- bindt idempotency aan een SHA-256-requesthash;
- bouwt maximaal 40 kaarten uit uitsluitend geselecteerde thuiswedstrijden;
- bewaart legacy slides zonder `teamContexts` via de bestaande snapshotroute;
- herschrijft geen historische snapshot of playlistrelease.

De validatie-, trigger- en snapshotfuncties hebben geen directe execute-rechten
voor publieke of clientrollen. De publieke v3-command is uitsluitend aan
`authenticated` toegekend en handhaaft daarna capability en tenantstatus.

## 2. Testportrait-keuzelijst en automatische releasegroei

### Bewezen oorzaken

De schermloader leverde alle immutable `playlist_releases` aan create- en
bulktoewijzing. Daardoor werd iedere historische versie als afzonderlijke
keuze getoond.

Los daarvan bevatte de repository sinds S96 de generieke trigger
`dynamic_slide_auto_publishes_latest`. Wanneer een gereed gerenderde
`latest`-snapshot wijzigde, kloonde die trigger synchronisch iedere gebruikte
default-releasevertakking met die slide naar een nieuwe immutable release. Dat
is een concreet automatisch mechanisme waarmee een dynamische playlist veel
versies kan opbouwen. Welke actor, renderjob of snapshotwijziging de historische
`Testportrait`-productieversies precies heeft veroorzaakt, is zonder hosted
database- en auditreadback niet toewijsbaar.

### Bounded fleetprojectie

`latestAssignableScreenReleases` filtert gearchiveerde playlists, groepeert op
playlist-ID en kiest eerst de hoogste version en alleen bij gelijke version de
laatste `publishedAt`. De nieuwe tenant-scoped
`list_screen_fleet_releases_v1`-RPC retourneert daarvoor per
niet-gearchiveerde playlist de nieuwste release plus oudere releases die nog
daadwerkelijk door een scherm, schermgroep of actieve planning worden
gerefereerd. De schermflows tonen de playlistnaam en alleen de nieuwste
toewijsbare release; de referenced records blijven beschikbaar om actuele,
gewenste en last-known-good state eerlijk te verklaren.

De projectie is bounded naar betekenis, maar kan bij een grote tenant alsnog
meer dan 1.000 nieuwste en werkelijk gerefereerde records bevatten. Daarom
pagineert `loadScreenFleet` de RPC-uitvoer én schermen, devices, playlists,
groepen, groepslidmaatschappen, automatisering en venueprojecties met stabiele
sortering en een unieke ID-tiebreaker. Release Center en releasedetail passen
dezelfde aanpak toe op historie, items, assignments, schermen, devices,
heartbeats en syncevents. Zo wordt een serverlimiet niet langer stil als een
lege of gedeeltelijke operationele werkelijkheid gepresenteerd.

De applicatiegrens voor een nieuwe of gewijzigde schermtoewijzing gebruikt
daarnaast de actuele release van de gekozen playlist. De guarded
databasecommands vergrendelen de playlist en vergelijken het verwachte
release-ID opnieuw; een keuze die tijdens de journey veroudert faalt als
concurrencyconflict in plaats van ongemerkt een historische versie toe te
wijzen.

### Duurzame coalescing en Player-backpressure

S146 vervangt de synchrone triggeruitvoering forward-only door een private
wachtrij met één record per tenant en playlist:

- een eerste wijziging krijgt 30 seconden settletijd;
- volgende wijzigingen delen hetzelfde pending record en het coalescingvenster
  eindigt uiterlijk vijf minuten na de eerste aanvraag;
- na een publicatie start voor die playlist maximaal één nieuwe in aanmerking
  komende automatische batch per vijf minuten;
- render-readiness, workerbeschikbaarheid en Player-backpressure mogen de
  uitvoering langer uitstellen, zonder tussentijdse releases te maken;
- minimaal één paired Player moet een relevante default-releasevertakking
  werkelijk gebruiken en alle relevante default-Players moeten de vorige
  release als actief hebben bevestigd;
- alleen vertakkingen met zo'n paired, actieve default-Player worden gekloond,
  zodat ongebruikte, geplande en historische vertakkingen geen eigen
  automatische versies produceren;
- verdwenen, disabled of niet meer geldige targets worden terminal uit pending
  gehaald in plaats van eindeloos opnieuw gepolld.

De materialisatie bevriest de snapshotkeuze eenmaal per release-item en gebruikt
diezelfde keuze voor manifest en release-items. Een succesvolle batch maakt
uitsluitend nieuwe immutable releases en verplaatst daarna default- en gewenste
pointers. `active_release_id` blijft ongemoeid, zodat de Player zijn
last-known-good release houdt totdat de nieuwe release volledig is gedownload,
geverifieerd en veilig geactiveerd. Een fout rolt de gedeeltelijke batch terug,
houdt het ene queue-record pending, noteert alleen een gesaneerde foutcode en
gebruikt begrensde exponentiële retrybackoff.

Een handmatige lokale concurrentieproef heeft de lockgrens bovendien werkelijk
geraakt: tijdens een vastgehouden playlist-lock kreeg de publieke workerclaim
`SQLSTATE 55P03`. Het ene queue-record bleef `pending`, `attempt_count` werd 1,
`last_error_code` werd `55P03`, `not_before` schoof volgens de backoff naar de
toekomst en `dynamic.release.refresh_failed` werd geaudit. Dit is aanvullend
uitvoeringsbewijs naast de pgTAP-backoffasserties.

### Monotone renderpromotie en provenance

`dynamic_slide_snapshots.snapshot_sequence` is voor nieuwe snapshots een
database-owned, uniek en monotoon volgnummer. Historische snapshots worden niet
gebackfilld en blijven `NULL`. Een private sequence en insert-trigger kennen het
nummer alleen bij een nieuwe normale insert toe; een caller kan geen expliciete
sequence invoegen en een bestaande sequence kan niet worden bijgewerkt. Dit is
nodig omdat PostgreSQL `now()` binnen één transactie stabiel is en meerdere
snapshots dus dezelfde timestamp kunnen dragen.

`complete_dynamic_render_job_v1` mag een gereed resultaat alleen als
`current_snapshot_id` promoveren wanneer geen reeds gereed resultaat met een
hogere effectieve ordeningssleutel actief is. Die sleutel gebruikt
`snapshot_sequence NULLS LAST` en valt daarna terug op `created_at` en `id`.
De pgTAP-fixture rond omgekeerde voltooiingsvolgorde
voltooit bewust eerst de nieuwere en daarna de oudere job en bewijst dat de live
pointer niet terugloopt. Een verlopen renderlease op de laatste poging wordt
terminal `failed`, blokkeert de queue niet opnieuw en laat de laatste geldige
ready snapshot intact.

De trigger `resolve_dynamic_playlist_item_provenance` behandelt
`dynamic_slide_id`, `dynamic_snapshot_id` en `dynamic_selection_mode` als één
ondeelbare tuple. Een gedeeltelijke tuple wordt geweigerd; een expliciete tuple
moet bij dezelfde tenant, ready snapshot, media-asset en selectiemodus horen.
Bij een update met hetzelfde asset blijft bestaande provenance behouden. Alleen
een echte legacy image-only selectie mag nog deterministisch worden afgeleid,
waarbij een al in dezelfde playlist gevestigde slide-identiteit vóór de
current/latest snapshotvolgorde gaat. Gedeelde content-addressed fallbackassets
kunnen daardoor niet langer een playlistitem stil naar een andere dynamische
slide laten wijzen.

Dit is bewust geen historische cleanup. S146 verwijdert of muteert geen enkele
bestaande `Testportrait`-release. De generieke automatische bron is in code
bevestigd; de exacte provenance van afzonderlijke productieversies vereist na
deployment nog steeds een read-only hosted vergelijking van actoren,
timestamps, auditmetadata, snapshots en renderjobs. Daarover wordt niet
gespeculeerd.

## 3. Begrensde publicatiepreflight

### Oorzaak

`loadDraftPreflight` hing schermen, paired devices, duizend heartbeats en alle
release-items aan één samengestelde query. Een optionele telemetry- of
cachefout resulteerde in nul `screenStates`; de UI vertaalde dat ten onrechte
naar “geen doelschermen”.

### Herstel

- De tenant-scoped, niet-verwijderde schermlijst wordt eerst geladen en is de
  enige harde query voor targetselectie.
- Schermen en paired devices worden pagina voor pagina met een stabiele
  naam/ID- respectievelijk screen/ID-volgorde geladen. Ook een 1.001e scherm of
  device blijft daardoor zichtbaar en gekoppeld.
- Paired device state gebruikt de bounded `last_seen_at`- en opslagvelden op
  het device. Een fout degradeert alle betrokken checks naar `unknown` en toont
  een waarschuwing; schermen blijven selecteerbaar.
- Alleen unieke actieve release-ID's worden in batches van 100 naar checksum
  geprojecteerd. Er is geen tenantbrede all-release-items- of heartbeatscan.
- Cachedegradatie rekent conservatief alleen met aantoonbare checksums.
- De journey scheidt actieve/onderhoudsschermen van disabled schermen, biedt
  zoeken/alles selecteren/wissen en toont statusredenen per gekozen doel.
- `blocked` stopt doorgaan/publiceren; `warning` of `unknown` vraagt expliciete
  risicobevestiging. De server voert dezelfde beveiligde preflight opnieuw uit.

De regressiemocks modelleren de echte inclusieve PostgREST-ranges: een eerste
pagina van exact 1.000 records dwingt een tweede query met `range(1000, 1999)`
af. De fleettest bewijst afzonderlijk 1.001 schermen, devices, RPC-releases en
playlistlabels en controleert dat de release en het label van pagina twee als
toewijsbare optie terugkomen. De preflighttest bewijst 1.001 schermen én
devices, inclusief de devicekoppeling van het laatste scherm. De bestaande
cachetest bewijst bovendien paginering van actieve release-items voorbij 1.000.

De muterende lokale Publisher-journey is daarna end-to-end 1/1 groen in 31,0
seconden: de beheerder kon een werkelijk doelscherm kiezen, de beveiligde
publishactie voltooien en exact één nieuwe immutable playlistrelease
teruglezen. Daarmee is de kernregressie niet alleen via mocks maar ook tegen de
lokale Supabase-runtime bewezen.

## 4. Control-routeherstel

### Oorzaak

De shell had routespecifieke presentatie voor slechts Overzicht, Studio,
Schermen, Planning en Media. Alle overige tenantpagina's erfden generieke
secondary-copy en geometrie; de editorherkenning maakte het bovendien te
gemakkelijk om publish- of detailroutes als canvasworkspace te behandelen.

### Herstel

`getControlRoutePresentation` classificeert bekende routes en aliassen als
`reference`, `resource`, `journey`, `platform` of `secondary`. De shell emit
`data-route-family`, `data-route-layout` en `data-shell-mode`. Daardoor blijven
Playlists, Publicaties/Releases, Slides, Bronnen/Data sources,
Integraties/Products, Sponsor Hub, Engage, Team, Instellingen, Account, Support,
Activiteit/Auditlog en Playlist-sjablonen in één rustige FieldFlow-sidebar met
routespecifieke werkvlakregels.

Alleen een exacte playlist-editor en een echte Studio-designcanvasroute zijn
immersief. Publish, release-detail, slide-detail, bron-detail en
integratiedetail blijven standaardshell. De vijf goedgekeurde S145-routes en de
platformshell behouden hun eigen mapping. Op mobiel volgt de journey inhoud vóór
preview en blijven interactieve controls minimaal 44 px.

## 5. Visuele acceptatie

De finale 16-shot visualmatrix is in 55,4 seconden 1/1 groen afgerond. Zij dekt
desktop en mobiel in light en dark voor de herstelde Studio-, scherm- en
Publisheroppervlakken. De browsercontrole bevestigt per variant Axe zonder
blockers, geen horizontale overflow en op mobiel een zichtbaar actieve
wizardstap. Een onafhankelijke visuele review van dezelfde eindstaat meldde
geen blocker.

## Verificatieregister

| Gate | Status op 5 september 2026 | Bewijs / nog vereist |
|---|---|---|
| Control routemapping | `PASS` | 28/28 gerichte navigatietests; publish/detail niet immersief |
| Control lint | `PASS` | finale workspace-run; Control-doel groen |
| Control typecheck + unit | `PASS` | finale Control-typecheck en 60 bestanden/346 tests groen |
| Desktop Control sanity | `PASS` | lokale Playlists-route toont één sidebar en FieldFlow-resourcewerkvlak |
| Mobiel Control sanity | `PASS` | lokale Playlists-route op 390 px in light en dark |
| S146 contracts | `PASS` | 1 bestand, 10/10 tests |
| S146 domain | `PASS` | 1 bestand, 12/12 tests |
| S146 Control gericht | `PASS` | 5 bestanden, 44/44 tests: routes, wizard-UX-contract, editorstate, releaseprojectie en preflight |
| PostgREST-paginatie gericht | `PASS` | 2 Vitest-bestanden/9 tests; 1.001 fleet-schermen, devices, RPC-releases en playlistlabels plus 1.001 preflightschermen/devices |
| Sportlink batch/snapshot gericht | `PASS` | 88/88 pgTAP-asserties, inclusief aggregate aankomstcomponenten en bounded tenant/contextvalidatie |
| Dynamische releasequeue/render gericht | `PASS` | 124/124 pgTAP-asserties: enqueue zonder synchrone release, coalescing, vijfminutengrens, Player-acknowledgement, branchfilter, rollback/retry, LKG, terminale cleanup, provenance, immutable sequence-ACL en legacy/nieuwe omgekeerde rendercompletion |
| Releasepreflight/-assignment gericht | `PASS` | 27/27 pgTAP-asserties, inclusief capability/tenantgrens en actuele-releaseguard |
| `pnpm db:reset` | `PASS` | volledige verse lokale database opgebouwd met migratie `20260904212639` |
| Volledige RLS | `PASS` | 70 pgTAP-bestanden/1.720 assertions groen |
| Supabase DB lint | `PASS` | `pnpm exec supabase db lint --local --level error`: `results: []` |
| Supabase hosted advisors | `POST_DEPLOY_PENDING` | security- en performancereadback volgen op staging en productie |
| Workspace lint/typecheck/test | `PASS` | finale worktree: lint 30/30, typecheck 30/30 en test 30/30 |
| Workspace build | `PASS` | finale worktree: 18/18 builddoelen groen |
| A11y | `PASS` | volledige suite: 36 groen en 1 bewust conditioneel overgeslagen scenario |
| Brede Chromium | `PASS` | 191 groen en 23 intentioneel overgeslagen; één lokale Next-devserver restart-timeout, waarna de volledige 30-combinatie mobile-scrolltest geïsoleerd 1/1 groen was in 54,9 seconden |
| 16-shot visualmatrix | `PASS` | desktop/mobile × light/dark 1/1 in 55,4 seconden; Axe, overflow en zichtbare actieve mobiele stap groen; onafhankelijke review zonder blocker |
| Player | `PASS` | `pnpm test:player`: 117/117 |
| Player offline | `PASS` | `pnpm test:player:offline`: 7/7 |
| Muterende Publisher-journey | `PASS` | 1/1 in 31,0 seconden: echt doelscherm gekozen en exact één nieuwe immutable release gemaakt |
| Handmatige queue-lock/backoff | `PASS` | vastgehouden playlist-lock leverde `55P03`; pending bleef behouden met poging 1, foutcode, toekomstige `not_before` en audit-event |
| `git diff --check` + secret/ownership audit | `PASS` | diffcheck en correcte changed-file secret-patternscan groen; exact één migratie, geen lockfile- of workflowwijziging |
| PR/CI, merge, staging, productie | `NOT_STARTED` | exact dezelfde merge-SHA/image-digest en readbacks |

Een eerdere brede Control-unitrun tijdens parallelle implementatie was niet
groen doordat twee statische UX-contracttests nog naar de vervangen
Sportlink-markup verwezen. Die contracttests zijn aangepast; daarna zijn zowel
de gerichte suite als de volledige Control-suite groen geworden. De finale
workspacebrede lint-, typecheck-, test-, build-, a11y-, Chromium-, Player- en
offlinegates zijn daarna eveneens afgerond. De eenmalige lokale
Next-devserver restart-timeout tijdens de Chromium-run is niet als productpass
weggeschreven: de volledige betrokken mobile-scrollmatrix is daarna in 54,9
seconden geïsoleerd 1/1 groen uitgevoerd. De afzonderlijke 16-shot visualmatrix
is eveneens groen en onafhankelijk zonder blocker beoordeeld.

## Deploy- en rollbackbewijs dat nog moet volgen

1. commit en PR bevatten uitsluitend S146-ownershippaden;
2. CI en migration/RLS-gates zijn groen op de exacte commit;
3. main merge-SHA en container/image-digest zijn vastgelegd;
4. staging migreert forward en bewijst login, Studio-wizard, screen latest-
   releasekeuze, gepagineerde bounded fleet-RPC, publish targets bij gezonde én
   gedegradeerde telemetry, monotone snapshotpromotie en één coalesced
   releasequeuecyclus;
5. productie gebruikt exact hetzelfde artifact en herhaalt de read-only health-
   en routechecks plus één geautoriseerde functionele smoke;
6. hosted auditreadback vergelijkt de bevestigde generieke autotrigger met de
   actoren, timestamps, snapshots, renderjobs en auditmetadata van historische
   `Testportrait`-versies, zonder records te verwijderen of ontbrekende
   provenance in te vullen;
7. rollback zet applicatiecode terug vóór eventuele databasefunctie-rollback;
   bestaande JSON blijft compatibel en immutable snapshots/releases blijven
   behouden.

Alle lokale implementatie-, database-, statische, browser-, Player- en
muterende Publisher-gates zijn vastgelegd. S146 is daarmee
`READY_FOR_RELEASE` en `NOT_DEPLOYED`. PR/CI en de exact-SHA staging-/
productiepromotie met hosted advisors en readbacks blijven de volgende
releasefase.
