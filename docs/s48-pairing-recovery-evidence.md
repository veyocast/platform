# S48 — Pairing recovery en zelfherstel

## Fase 1: zelfstandige LG-herstelroute

### Opgeleverd

- `https://player.veyocast.nl/lg/recover` is als letterlijke HTML-response
  geïmplementeerd:
  - geen React-component;
  - geen hydration;
  - geen `/_next/`-clientchunks;
  - conservatieve ES5-stijl syntax;
  - eigen no-store- en CSP-responseheaders;
  - bruikbaar als top-level URL en vanuit de bestaande lokale LG-wrapper.
- De pagina toont en actualiseert zichtbaar:
  1. Playerstatus controleren;
  2. oude koppelpoging verwijderen;
  3. lokale cache herstellen;
  4. nieuwe koppeling voorbereiden.
- Soft recovery:
  - bewaart de anonieme installatie-ID;
  - controleert de huidige bearercredential met een begrensde requesttimeout;
  - bewaart een geldig of door tijdelijke storing niet te beoordelen
    credential;
  - verwijdert een definitief ongeldig, ingetrokken of beschadigd credential;
  - verwijdert pairingcode, expiry en lokale retrytimer;
  - probeert de bijbehorende pending sessie server-side in te trekken;
  - verwijdert uitsluitend Player-release-IndexedDB en VeyoCast Playercaches;
  - laat Device Lab- en automationdiagnostiek ongemoeid;
  - schrijft een herstelmarker met twee minuten TTL;
  - schrijft geen token, code of tenantdata naar de URL;
  - navigeert eenmaal met `location.replace` naar `/lg`.
- Hard recovery:
  - is een afzonderlijke knop;
  - vereist een native bevestiging;
  - verwijdert ook de lokale credential;
  - vernieuwt de installatie-ID.
- Iedere browsercapability wordt afzonderlijk gecontroleerd. Cache Storage-,
  IndexedDB- of serviceworkerfouten worden zichtbaar als waarschuwing behandeld
  en blokkeren de resterende stappen of redirect niet.
- `recover_pending_pairing_v1` annuleert atomair en idempotent uitsluitend een
  pending sessie waarvan de Player het ruwe credential bezit. Alleen de hash
  gaat naar PostgreSQL. Geslaagde cancellation schrijft privé recoverybewijs.

### Bewuste grenzen van fase 1

- Een geldige actieve schermbinding wordt bij soft recovery bewust niet
  ingetrokken.
- Fase 1 kende nog geen afzonderlijke Installation-entiteit,
  installatiecredential of remote commands. Die grens is door fase 2 hieronder
  opgeheven.
- HttpOnly demo- en Device Lab-cookies zijn geen pairingstate en worden niet
  door de browserpagina verwijderd.
- De route is lokaal production-buildbaar, maar staat nog niet op
  `player.veyocast.nl`. De production healthroute rapporteerde tijdens de
  nulmeting nog main-revision `de82605a`.
- Fysieke acceptatie op LG 43UL3J-EP kan pas na merge, database-migratie,
  staging/productiondeployment en bediening op het apparaat worden afgetekend.

## Verificatie fase 1

- Workspace lint, typecheck en Vitest: geslaagd.
- Player lint: geslaagd.
- Player typecheck: geslaagd.
- Player Vitest: 18 bestanden, 73 tests geslaagd.
- Player production build: geslaagd; `/lg/recover` en
  `/api/player/pairing/recover` staan als zelfstandige dynamische routes in het
  buildmanifest.
- Gerichte Chromiumrecovery: 4 tests geslaagd:
  - soft recovery bewaart installatie-ID;
  - definitief ongeldig credential wordt verwijderd;
  - geldig credential wordt behouden;
  - hard recovery vernieuwt installatie-ID;
  - Cache API-/IndexedDB-fouten blokkeren niet.
- Volledige Chromium Playersuite: 45 tests geslaagd, inclusief
  last-known-good/offline-, pairing- en recoveryregressies.
- Volledige Chromium toegankelijkheidssuite: 29 tests geslaagd. De
  recoverypagina past zonder horizontale of verticale overflow op 1280 × 720.
- Volledige Chromium E2E-run: 94 tests direct geslaagd en 5
  environmentafhankelijke visuele/live tests overgeslagen. Drie bestaande
  Control/Marketing-tests bereikten onder vier parallelle workers hun timeout;
  alle drie slaagden aansluitend gezamenlijk met één worker.
- Database reset: geslaagd met migration
  `20260728500000_pairing_recovery_foundation.sql`.
- RLS/database: 37 bestanden en 686 assertions geslaagd, inclusief 9 nieuwe
  pairingrecoveryassertions.

## Fase 2: zelfherstel, installatie-identiteit en remote recovery

### Pairing-state-machine

De runtime gebruikt nu centraal de expliciete states `BOOTING`,
`INSTALLATION_REGISTERING`, `UNPAIRED`, `PAIRING_REQUESTING`,
`PAIRING_CODE_ACTIVE`, `PAIRING_CLAIMING`, `PAIRED`, `ACTIVE`, `RECOVERING`,
`OFFLINE` en `ERROR`, met het laatste overgangstijdstip en de actieve
requeststart in lokale storage.

- Alle installatie- en pairingrequests hebben een timeout van 15 seconden en
  begrensde exponential back-off.
- Een request ouder dan 60 seconden wordt gecontroleerd vervangen; na twee
  minuten verschijnt de fysieke herstelmenu-instructie.
- Een verlopen tienminutencode wordt ingetrokken en automatisch vervangen,
  zonder reload.
- HTTP 500, 502, 503, 504, timeout, DNS- of offlinefouten verwijderen geen
  geldige schermcredential of last-known-good release.
- Definitieve machinecodes `INVALID_DEVICE_TOKEN`, `DEVICE_REVOKED`,
  `INSTALLATION_NOT_FOUND` en `BINDING_EXPIRED` verwijderen alleen het
  ongeldige credential, behouden de installatie-identiteit en starten
  automatisch nieuwe pairing.
- UI-copy maakt onderscheid tussen echt offline, een onbereikbare VeyoCast
  API, een pairingservicefout, codevernieuwing, ongeldige lokale state en een
  ingetrokken credential. De interne machinecode blijft zichtbaar als
  diagnosebewijs.

### Atomaire serverpairing

Migration `20260728510000_player_installations_commands_pairing.sql` voegt
toe:

- `player_installations` met een anonieme publieke identiteit en afzonderlijke
  installatiecredential, beide uitsluitend gehasht server-side;
- `pairing_sessions.installation_id` en een unieke partial index voor maximaal
  één actieve poging per installatie;
- een gehashte requestnonce voor idempotente code-aanvragen;
- `create_pairing_session_v4` met transactionele vervanging, tien minuten TTL,
  collisionretry en cleanup;
- `claim_pairing_session_v4` met row locks en transactionele
  installatie-/schermbinding;
- privé pairingevents voor create, claim, expire, cancel en recover.

Een claimfout maakt de poging niet half-gekoppeld. Een gelijktijdige dubbele
codeaanvraag levert door lock, nonce en unique index geen dubbele actieve
sessies op.

### Remote command-kanaal

`player_commands` en de installation-authenticated
`/api/player/commands`-route ondersteunen:

- `RELOAD_PLAYER`;
- `RECOVER_PAIRING`;
- `FORCE_UNPAIR`;
- `CLEAR_PLAYER_CACHE`.

Iedere opdracht heeft een unieke nonce, TTL, tenant/screen/installatiebinding
en afgeleverd-, acknowledged-, completed- of failed-status. De Player pollt via
de installatiecredential, onthoudt uitgevoerde nonces lokaal en bevestigt
terminal server-side, zodat een afgeleverde opdracht niet opnieuw wordt
uitgevoerd. Een verlopen opdracht wordt server-side failed en niet geleverd.

`RECOVER_PAIRING` behoudt scherm, tenant, playlist, planning en historie en
vervangt het kapotte devicecredential pas wanneer de Player de opdracht
uitvoert. `FORCE_UNPAIR` verbreekt binding en token, maar verwijdert het
schermobject, de contenttoewijzing of historie niet. `RELOAD_PLAYER` wijzigt
geen binding of storage. Alle beheerdersacties worden capability- en
tenantgebonden in PostgreSQL afgedwongen en geaudit.

### Control en fysieke bediening

Op **Control → Schermen → schermdetail → Meer acties** staan:

- **Koppeling herstellen**;
- **Ontkoppelen en nieuwe code**;
- **Player opnieuw laden**.

De bevestigingsdialogen beschrijven vooraf wat behouden en gewijzigd wordt.
Control toont `Wacht op player`, `Afgeleverd`, `Player herstelt`, `Geslaagd`,
`Mislukt` of `Verlopen` op basis van de opgeslagen commandtijden; dit is geen
browserrefresh-afhankelijke uitvoeringsstate.

Iedere Player-surface gebruikt hetzelfde lokale herstelmenu. Het opent na acht
seconden OK of via `OK, OK, OK, BACK, OK`, maar nooit door één normale
OK-actie. Het menu biedt opnieuw proberen, nieuwe code aanvragen, player
herladen, lokale cache herstellen, netwerkstatus, installatie-ID,
Playerversie en laatste foutcode.

### webOS 6 en clientfallback

- De Player declareert Chromium 79 als browsercompiletarget.
- De production build scant emitted Playerchunks op ongecompileerde optional
  chaining, nullish coalescing en logical assignment.
- Browserautomationvalidatie is een kleine client-side typeguard geworden,
  zodat Zod niet als moderne runtimechunk op de Player geladen wordt.
- `/lg/recover` blijft letterlijke HTML zonder normale clientbundle.
- Een vroeg inline `error`-/`unhandledrejection`-vangnet en de Next
  error-boundaries tonen `PLAYER_CLIENT_EXCEPTION`, retry, herstelroute en
  Playerversie in plaats van `Application error`.
- Service worker, IndexedDB, Cache Storage en lokale storage blijven allemaal
  afzonderlijk feature-detected; één schoonmaakfout blokkeert recovery niet.

De gekozen Chromium 79-grens volgt de officiële webOS TV 6.x
webengine-matrix. Exact gedrag van webOS Signage 6.0 op firmware 03.24.90
blijft onderdeel van de fysieke acceptatie.

## Verificatie fase 2

- Database reset: geslaagd met beide S48-migraties.
- Volledige RLS/database-suite: 38 bestanden, 724 assertions geslaagd.
- Nieuwe installatie-/command-RLS-suite: 38 assertions geslaagd.
- Player lint en typecheck: geslaagd.
- Player unit: 21 bestanden, 82 tests geslaagd.
- Control lint en typecheck: geslaagd.
- Control unit: 20 bestanden, 98 tests geslaagd.
- Player production build: geslaagd, inclusief secret scan en
  webOS-6-compatibiliteitsscan.
- Control production build: geslaagd, inclusief auth-boundary- en secretscan.
  De build meldt alleen de bestaande Autoprefixer-waarschuwingen voor `start`
  in het ongewijzigde screen-automation-stylesheet.
- Gerichte pairing/recovery/menu-browserrun: 18 tests geslaagd.
- Offline Playersuite: 7 tests geslaagd.
- Volledige Playersuite: 48 van 49 scenario's waren direct groen; één
  bestaande tekstverwachting is aan de nieuwe machinecopy aangepast en dat
  scenario is daarna groen herhaald.
- Volledige a11y-matrix: alle 29 scenario's geslaagd. Eén eerste
  parallelle devserverrun kreeg een Fast Refresh-reload; beide getroffen
  scenario's zijn warm/serieel groen herhaald.
- Volledige Chromium E2E-matrix: 99 direct geslaagd en 5 bewust
  environmentafhankelijk overgeslagen. Twee parallelle devserver-timeouts
  (Control-overzicht en marketingoverflow) zijn afzonderlijk groen herhaald.

- Definitieve workspacegate: 25 van 25 linttaken, 25 van 25 typechecktaken en
  25 van 25 unittaken geslaagd.

## Open release- en acceptatiegrenzen

- De branch wijzigt production niet automatisch. Database-migratie en Player-,
  Control- en eventuele workerdeployment moeten via het bestaande
  releaseproces worden uitgevoerd.
- `https://player.veyocast.nl/lg/recover` rapporteerde tijdens de nulmeting nog
  niet deze branchrevision.
- Alleen een fysieke uitvoering op LG 43UL3J-EP kan bewijzen dat de specifieke
  Signage-browser alle stappen uitvoert en binnen dertig seconden een code
  toont.
- De taak blijft daarom `in_progress` totdat deployment en het onderstaande
  fysieke protocol met gesaneerd bewijs zijn afgetekend.

## Fysiek testprotocol na deployment

1. Open via **Afspelen via URL** exact
   `https://player.veyocast.nl/lg/recover`.
2. Verwacht binnen vijf seconden het lokale herstelscherm met vier stappen.
3. Laat soft recovery automatisch starten of kies **Nu herstellen**.
4. Controleer dat iedere stap `OK` of een niet-blokkerende waarschuwing toont.
5. Verwacht automatische navigatie naar `/lg`.
6. Verwacht bij de huidige vastgelopen unpaired Player binnen maximaal
   dertig seconden een nieuwe code.
7. Koppel die code in Control aan het bestaande scherm.
8. Herstart het display volledig en controleer dat dezelfde schermkoppeling
   terugkomt.
9. Laat een nieuwe ongeclaimde code verlopen en controleer dat de Player
   zonder reload een andere code toont.
10. Leg model, webOS-versie, firmware, tijdstip, netwerk en foto’s van stappen
    en nieuwe code vast. Maak codes en eventuele identifiers onleesbaar voordat
    bewijs extern wordt gedeeld.
