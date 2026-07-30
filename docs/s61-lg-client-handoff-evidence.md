# S61 — LG herstelcode-handoff en clientexception

## Fysiek bewijs

Op 30 juli 2026 maakte de standalone production-recovery op de LG
43UL3J-EP aantoonbaar herstelcode `8F EAFR`. Daarna navigeerde de pagina naar
`/lg`, waar eerst `PLAYER_CLIENT_EXCEPTION` verscheen. Opnieuw proberen liet
kort **Koppelcode maken** zien en eindigde vervolgens in
`PAIRING_RATE_LIMITED` met `POST /api/player/pairing` HTTP 429.

Dit sluit internet, TLS, installation registration en de S60-recoverygrant als
primaire oorzaak uit: die keten had de code al succesvol gemaakt.

## Oorzaak

De server stuurde pairing-expiry rechtstreeks terug als bijvoorbeeld:

```text
2026-07-30T13:48:32.536822+00:00
```

Dat PostgreSQL-formaat bevat microseconden. De gewone Player beoordeelde de
opgeslagen expiry met de ingebouwde browserdatumparser. Op een oude
webOS 6-browserengine is die niet-canonieke ISO-variant niet betrouwbaar. Een
ongeldige parse volgt bewust hetzelfde veilige pad als een verlopen code:
pending state wissen en opnieuw pairen. Daardoor ging de zojuist gemaakte code
verloren en ontstond een tweede aanvraag binnen de rate-limitperiode.

## Reparatie

- Pairingresponses normaliseren `expiresAt` naar canonieke UTC-milliseconden.
- De Player normaliseert defensief reeds opgeslagen microsecondewaarden.
- Zowel hervatte als nieuw ontvangen pairing-expiries gebruiken dezelfde
  parser.
- De standalone recovery toont de code zelf en blijft buiten React/Next-client
  wachten.
- Iedere drie seconden controleert zij met de pending credential de
  heartbeat:
  - 409 `PAIRING_PENDING`: blijven wachten met dezelfde code;
  - 200 `ok`: tijdelijke pairingvelden wissen en eenmaal naar `/lg`;
  - tijdelijke transport-/5xx-fout: code behouden en gecontroleerd opnieuw;
  - definitieve credentialfout: stoppen met zichtbare herstelactie.
- De clientfallback legt zonder stack, bericht, token of responsebody alleen
  foutcategorie, opstartfase, pad, tijdstip en browser-onlinehint vast.
- Een vroege clientexception mag maximaal één gecontroleerde reload per twee
  minuten uitvoeren. De marker wordt pas na tien stabiele runtimeseconden
  verwijderd.

## Geautomatiseerde verificatie

- Player Vitest: 27 bestanden, 97 tests geslaagd.
- Player lint en typecheck: geslaagd.
- Volledige workspace lint, typecheck en unit-tests: 28/28 Turbotaken per
  gate geslaagd.
- Player production build: geslaagd, inclusief secret-scan en
  webOS 6-compatibiliteitsguard.
- Volledige Player Chromiumset: 54 tests geslaagd.
- Offline Player Chromiumset: 7 tests geslaagd.
- Regressies bewijzen specifiek:
  - PostgreSQL-microseconden behouden de bestaande code en credential;
  - `/lg` doet in dat geval geen nieuwe pairingaanvraag;
  - standalone recovery vraagt precies één code;
  - recovery blijft op de statische code tijdens 409;
  - pas heartbeat 200 veroorzaakt cleanup en navigatie;
  - clientexceptions tonen veilige diagnose en geen wit Next-foutscherm.

## Resterende acceptatie

Na staging en production moet dezelfde LG opnieuw worden getest:

1. open `/lg/recover`;
2. wacht op de grote code;
3. laat de recoverypagina zichtbaar en claim de code in Control;
4. controleer dat pas daarna `/lg` opent;
5. controleer dat geen `PLAYER_CLIENT_EXCEPTION`, **Koppelcode maken** of
   nieuwe HTTP 429 verschijnt;
6. voer een koude herstart uit en bevestig dat de koppeling behouden blijft.

De codegrens is geautomatiseerd bewezen. De laatste hardwareacceptatie kan
alleen op firmware 03.24.90 worden afgetekend.
