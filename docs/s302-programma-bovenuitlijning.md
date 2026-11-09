# S302 — Vandaag op het veld boven uitlijnen

Op een volle liggende programmapagina verdeelde het raster zes wedstrijden
over twee automatische rijen. De laatste één tot drie wedstrijden kregen één
rij over de volle hoogte. De bestaande verticale centrering in de kaart liet
datum, logo’s, teamnamen en aftraptijd daardoor 159,3 px zakken op 1920×1080.

Het niet-lege, zelfstandige programmapaneel krijgt nu een eigen class. De
gedeelde OnzeTrots-stijl reserveert daar in landscape altijd twee gelijke
rijen. De kaarten behouden de eerste rij van de volle pagina; de tweede rij
blijft leeg. Preview, DOM-Player en nieuwe captures gebruiken hetzelfde
MatchPanel en dezelfde aanvullende stylesheet voor approved v1 en v9.

## Verificatie

- Oude bron: acht browsercases rood door de zichtbare verschuiving.
- Nieuwe bron: tien browsercases groen in 50,9 s, zonder skip/retry.
- Preview en Player-mediasubpad op 1920 × 1080: volle6→laatste3/2/1 voor v9,
  en volle6→laatste3 voor v1. De componenten wisselen zelf van pagina; geen
  seek, gesimuleerde klok, paginastate-overwrite of remount.
- Datum, beide geladen logo’s, lange teamnamen, aftraptijd, drie kolommen en
  kaartgeometrie blijven gelijk. Alle acht volle pagina’s behouden exact
  dezelfde geometrie en byte-identieke PNG ten opzichte van de oude bron.
- Beide renderers behouden de vijf portrait-rijen, uitslagen inclusief 0–0,
  de drie matchday-panelen en de lege programmatoestand.
- Workspace lint 30/30, typecheck 30/30 en test 30/30 groen. Respectievelijk
  23/23/26 taken uit cache; scoped lint/typen en 54 gerichte bestaande units
  ook groen. De normale CI/build en uitrol worden in de PR vastgelegd.

[Bronhashes, metingen en bewijsgrenzen](implementation/s302-programma-bovenuitlijning/acceptance.json)
horen bij de bevroren layout en browserspec. De lokale eerste unittestpogingen
misten bestaande sparse-checkoutreferenties; deze zijn ongewijzigd uit Git
teruggezet. De uiteindelijke volledige gate is daarna groen.

Gerichte browserproef:

```bash
PLAYWRIGHT_EXTERNAL_SERVERS=1 pnpm exec playwright test \
  tests/player/s302-programma-top-alignment.spec.ts \
  --project=chromium --workers=1
```

Dit bewijs gebruikt echte productiecomponenten met gecontroleerd lokaal
assettransport. Het start geen volledige Next/manifest/offline-sessie en
bewijst geen fysieke TV, Android WebView of LG. CI en hosted uitrol zijn
afzonderlijke gates. Bestaande vaste PNG/MP4-uitvoer blijft immutable; nieuwe
captures krijgen de gedeelde layout via de gewone renderflow.

Selectie, paginacapaciteit, afspeeltiming, huidige publicaties, tenantdata en
de overige slidefamilies worden door deze correctie niet gewijzigd.
