# S155 — Welkomstinformatie en nieuwsbeeldkwaliteit

## Doel

Maak de bezoekersteamslide direct bruikbaar bij aankomst op het sportpark en
verbeter de leesbaarheid en beeldkwaliteit van de split-gradient nieuwsslide,
zonder tenant-, release- of offlinegrenzen te verzwakken.

## Scope

- Toon per thuiswedstrijd datum en aanvang compact boven twee gelijkwaardige
  teamregels.
- Toon beide kleedkamers en het veld als afzonderlijke wedstrijdinformatie.
- Gebruik uitsluitend de Sportlink-accommodatienaam van de tenantgebonden
  thuiswedstrijd. Een pagina met ontbrekende of verschillende accommodaties
  gebruikt de generieke sportparktekst.
- Vervang de Arena-headervermelding `VeyoCast` door de actuele lokale datum en
  tijd; de locked lock-up linksonder blijft de enige softwarewatermark.
- Plaats de QR-code van fullscreen/split-gradient nieuws rechtsonder in de
  volledige veilige canvaszone, zonder zichtbare URL.
- Versterk het donkere verloop en kies bij RSS zo mogelijk de grootste
  beschikbare bronafbeelding zonder aspectratiovervorming.
- Verrijk bestaande `latest`-bezoekersteamslides via nieuwe immutable
  snapshots en de bestaande veilige auto-publicatieketen.

## Niet in scope

- Historische snapshots, releases of Player last-known-good muteren.
- Sportlink-accommodaties reconstrueren of vrije namen automatisch met
  `Sportpark` aanvullen.
- Foto-inhoud genereren wanneer de RSS-bron alleen een kleine afbeelding
  aanbiedt.
- De tenantlogoheader van Menu Studio v2 vervangen; die route bevat geen
  `VeyoCast`-tekst en heeft een eigen canvascontract.

## Acceptatie

- Datum en `Aanvang` hebben dezelfde typografie en zijn aantoonbaar kleiner
  dan beide teamnamen.
- Thuis- en uitteam hebben dezelfde visuele hiërarchie.
- `Kleedkamers:`, `Thuis: … | Uit: …` en `Veld: …` zijn zichtbaar en vallen
  terug op `volgt` wanneer Sportlink geen waarde levert.
- Alleen tenant-eigen gevalideerde thuiswedstrijden leveren bezoekerskaarten;
  uitwedstrijden en vreemde wedstrijden blijven uitgesloten.
- De header toont een specifieke accommodatie alleen wanneer alle kaarten op
  de zichtbare pagina exact dezelfde niet-lege `venueName` hebben.
- Iedere Editorial Arena-header toont `dd-mm-yyyy | uu:mm` in de bevroren
  tenanttijdzone; er staat geen extra `VeyoCast`-tekst rechtsboven.
- De fullscreen nieuws-QR staat rechtsonder in liggend en staand, bevat alleen
  scaninstructie en code, en de QR-link blijft intern intact.
- RSS-bronselectie verkiest aantoonbaar grotere full-size bronnen boven
  thumbnails; Playerbeelden behouden hun aspectratio.

## Releasegates

- `pnpm lint`, `pnpm typecheck`, `pnpm test` en `pnpm build`.
- Verse `pnpm db:reset`, gerichte S155-pgTAP en volledige `pnpm test:rls`.
- `pnpm test:a11y` en Chromium-E2E inclusief liggend/staand visueel bewijs.
- `pnpm test:player` en `pnpm test:player:offline`, inclusief LG Legacy.
- Diffcheck, ownershipcontrole, secretscan, PR/CI en exact-SHA staging- en
  productiedeployment.
