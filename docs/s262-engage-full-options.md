# S262 — Alle Engage-keuzes leesbaar publiceren

De rebuildcanon vereist twee tot vierentwintig antwoordopties. Sync weigerde
campagnes vanaf dertien keuzes. Nieuwe gekozen en handmatige polls bewaren nu
`optionsPerPage: 4`, alle oorspronkelijke optie-ID’s en de bronvolgorde. Wizard,
editor, export en Player gebruiken dezelfde paginateller. Vierentwintig opties
geven zes volledige pagina’s en minimaal achttien seconden afspeelduur.

De wizard heeft bereikbare vorige-/volgendeknoppen van minimaal 44 pixels en
laat alle pagina’s in beide oriëntaties controleren. Gemarkeerde landscape-
kaarten tonen maximaal vier antwoorden in een raster van twee bij twee, met
losse ruimte tussen de kolommen. Portrait gebruikt een compacte QR-strook en
expliciete vraagvarianten voor korte, middellange en lange vragen. OnzeTrots-
achtergronden, Source-fontfamilies, antwoordgegevens en QR-payload/quietzone
blijven behouden. Labels van 160 tekens worden volledig afgebroken; geen ellipsis,
clipping of automatische fontverkleining. De gecontroleerde antwoordfonts blijven
minimaal 26 pixels op het logische canvas.

Percentage en totaal worden over alle opties berekend. Na-stemmen en na-sluiten
houden verborgen aantallen op nul. De liveprojector behoudt de bevroren marker,
optie-ID’s, volgorde en lengte; een gewijzigde identiteit wordt geweigerd. Een
oude lege kaart krijgt nooit alsnog paginering bij een nieuwe bronrespons.

Historische ongemarkeerde documenten met twee tot twaalf antwoorden behouden
hun oorspronkelijke éénpaginaformaat, ID’s en binaryduur. Er is geen backfill of
wijziging van opgeslagen ontwerpen, publicaties of last-known-good releases.
Nieuwe pagina’s gebruiken de bestaande minimumduur van drie seconden per pagina,
het bestaande maximum van 120 seconden en de normale volledige video-export.

De Player onderhandelt afzonderlijk over
`X-VeyoCast-Sync-Engage-Paging: sync-engage-pages-v1`. Zonder deze capability
valideert de server nog steeds alle bevroren assets, hashes en de volledige duur,
maar verstuurt dezelfde complete PNG/MP4-binary zonder onbekend DOM-presentatieveld
of bijbehorende online Engage-uitbreiding. De normale Sync-capability blijft
vereist; ongeldige headers schakelen niets in. ETag en Vary onderscheiden de
profielen voor hoofd- en compositiereleases. Dit verandert geen offlineactivatie
of bestaande lokale releases en bewijst geen fysieke downgradecompatibiliteit.

De ene CLI-aangemaakte forwardmigratie
`20261019135521_sync_engage_full_options.sql` vervangt twee private gegenereerde
JSON-schemafuncties en hergebruikt één private paginateller in bestaande
Studio-validatie en releasefreeze. De overige bestaande guardinhoud blijft
bytegelijk behalve de twee paginatellercalls en `create or replace`. De helper
is immutable/security-invoker met lege search_path en zonder EXECUTE voor public,
anon, authenticated of service_role. JSONB-getallen 4 en 4.0 geven dezelfde
paginatelling. Alle 199 historische migraties blijven bytegelijk. Er komt geen
publieke RPC, RLS-policy, tabel, dependency, token of serviceworker bij.

## Uitgevoerde controles

- De eerste begrensde unit-/Player-run slaagde met 120 tests in elf bestanden.
  Na de projectorcorrecties slaagden de 55 getroffen legacy-/Playergevallen in
  vier bestanden. De laatste layout sloot met zeventien DOM-tests en scopedlint;
  de laatste CSS-only wijziging sloot afzonderlijk met lint0. Dit zijn
  overlappende gerichte runs, geen opnieuw uitgevoerde volledige foundation.
- Native V10 sloot acht van acht gevallen groen in 116,021 seconden, één worker,
  nul retries/skips/flaky, met 104 oorspronkelijke PNG’s en 84 geometrieën.
  De volledige twee/twaalf/dertien/vierentwintig-optielussen en de vraaggrenzen
  24/25/80/81/160, vier volledige 160-tekenlabels per pagina, gewone inhoud en
  laatste pagina’s met drie antwoorden zijn gecontroleerd op 390/1440 breed,
  landscape en portrait. Keyboard, wizard-create, aXe en alle harde
  inkt-/antwoord-/meta-/QR-/footergrenzen slaagden. Root bekeek gewone en maximale
  oorspronkelijke beelden en accepteerde de extra kolomruimte.
- De geïsoleerde gecombineerde DB-cohorte bevat de bestaande 199 migraties plus
  S262 en S261. V18 sloot met echte exit0: normale CLI-remote-reset van alle 201
  migraties, twee gerichte bestanden met 187 pgTAP-checks, alle 136 bestanden met
  4.454 checks en CLI-lint op errorniveau met `--fail-on error`. De pgTAP-tests
  draaiden in twee expliciete lokale `pg_prove`-containers met de normale
  CLI-testargumenten; dit is geen uitvoering van het volledige `supabase test db`
  commando. De S262-fixture levert 38 checks; de enige fixturecorrecties zijn
  de bestaande ownerclaim vóór de validaties en de bestaande interne campagne-ID.
- De wegwerp-DB gebruikte het echte schema-only auth/storage-archief en de
  exact gepinde normale CLI-bootstrap voor publieke defaultprivileges vóór alle
  applicatiemigraties. Managed owners/ACL’s/RLS/constraints bleven gelijk; geen
  rechtenherstel na migraties. De gewone CLI-telemetrie-opt-out voorkomt het
  bewezen PostHog-shutdowndefect. Alle oorspronkelijke rode bewijzen blijven
  afzonderlijk behouden. Alle eigen containers, groepen, Chrome, aliases en
  tijdelijke geheimen zijn gesloten/verwijderd; bron/dependencies/assets en
  bestaande containeridentiteiten bleven gelijk. QA57621/57622 en oude57722
  zijn niet gewijzigd.

De bewijsroot is privé:
`/dev/shm/veyocast-s262-engage-preparation-75daf4be-a8ae-466b-846f-f4c7f2d64e5b/`.
Native V10: `native-dbb49d59-2534-4d5c-8051-3dd586395215/closed.json`, SHA256
`44956f3e2e6ec0a1ab60d5f0795b2a3eb2fb1dba59dcac4fadfa47b219b3af30`.
Gecombineerde DB V18:
`db-helper-preparation/actor-a7a8db1a-85a4-4fa8-be32-ec7d98980984/closed.json`,
SHA256 `1bb27a0bcbabc8867bd34467642dc29e4ba105ac0540fe54ace465720413434b`.
De DB-cohorte bindt de S261-migratie `88d5b73f…`, eigen test `1060e05c…` en
de gereviewde S226-fixture `82601ab4…`; er is hiervoor geen bronmerge gedaan.

## Nog open

De echte 24-optie-MP4-keten met zes gedecodeerde pagina’s/QR-controle en de
identieke binary voor drie clientprofielen is alleen privé voorbereid. De
geïntegreerde foundation, normale volledige CLI/CI, volledige Player/offlinegates,
fysieke/24-uursproeven en staging/productie zijn nog open. De native wizard gebruikt
gecontroleerd actiontransport en bewijst geen live providerketen. Deze gerichte
controles tellen niet als een van de vijf volledige prototypevergelijkingen:
**0/5 volledige ronden afgerond**. Deze PR is een reviewbare functionele deelstap.
