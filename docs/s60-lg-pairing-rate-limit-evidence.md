# S60 — LG pairing rate-limit recovery

## Aanleiding

De fysieke LG 43UL3J-EP bereikte via `/lg` en `/lg/recover` herhaaldelijk
`POST /api/player/pairing` met HTTP 429. De diagnose bewees tegelijk dat
installation registration en recovery HTTP 200 gaven. Internet, TLS en de
Player-origin waren dus bereikbaar.

De zelfstandige recoverypagina beperkte `Retry-After` ten onrechte tot tien
seconden en maakte voor iedere retry een nieuwe requestnonce. Ook de gewone
Player roteerde de nonce na een langdurige tijdelijke storing. Daardoor telde
iedere nieuwe server-side creatie opnieuw mee en kon een Player herstel zelf
weer rate-limiten.

## Oplossing

- Alle tijdelijke pairingretries hergebruiken dezelfde requestnonce.
- De vastloopwatchdog biedt dezelfde idempotente aanvraag opnieuw aan.
- De zelfstandige LG-pagina respecteert `Retry-After` tot tien minuten.
- Credential-authenticated recovery maakt maximaal één recoverygrant per
  installatie per tien minuten.
- De eerstvolgende creatie mag daarmee door de installatiegrens heen, verbruikt
  de grant atomair en laat maximaal één pending pairing bestaan.
- De wereldwijde 300-per-minuutgrens blijft onvoorwaardelijk actief.
- Grants zijn privé, browserrollen hebben geen tabeltoegang en uitgifte wordt
  als pairingevent geaudit.

## Lokale verificatie

- Player lint: geslaagd.
- Player typecheck: geslaagd.
- Player production build en webOS 6-compatibiliteitscontrole: geslaagd.
- Player Vitest: 26 bestanden, 95 tests geslaagd.
- Database reset: geslaagd.
- RLS/database: 44 bestanden, 816 tests geslaagd.
- Gerichte Chromiummatrix: 19 tests geslaagd, inclusief:
  - bestaande HTTP 429 herstelt automatisch;
  - alle 429-retries gebruiken dezelfde nonce;
  - tijdelijke HTTP 503 gebruikt dezelfde nonce;
  - de zelfstandige recoveryroute blijft dezelfde nonce gebruiken;
  - verlopen pairing vernieuwt;
  - tijdelijke 503 verwijdert geen geldige schermcredential;
  - definitieve 410 start herpairing.

## Fysieke acceptatie

Na staging- en productiondeployment:

1. open eenmaal `https://player.veyocast.nl/lg/recover`;
2. verwacht vier afgeronde herstelstappen en daarna een nieuwe code;
3. koppel de code;
4. zet **Afspelen via URL** terug op `https://player.veyocast.nl/lg`;
5. voer een koude herstart uit en controleer dat de koppeling behouden blijft.

De code- en databasegrenzen zijn geautomatiseerd bewezen. Het uiteindelijke
schermbewijs op firmware 03.24.90 blijft een fysieke acceptatiestap.
