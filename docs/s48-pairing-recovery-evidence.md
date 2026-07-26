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
- De bestaande server kent nog geen afzonderlijke Installation-entiteit of
  installatiecredential. Remote commands en herstel met behoud van een kapotte
  schermcredential volgen in de volgende fase.
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
