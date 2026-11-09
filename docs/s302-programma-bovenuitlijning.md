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

## Volledige Control-gate afmaken

De ongewijzigde Control-suite op PR333 werd na de joblimiet van 45 minuten
afgebroken: 1.414 vereiste gevallen, 772 PASS, 629 bestaande SKIP, 0 FAIL en 13 nog
onafgerond. Dezelfde eerdere PR332-job was succesvol in 36 min 47 s. Deze
looptijdvariatie laat te weinig marge voor de volledige bestaande suite.
De Control-job krijgt daarom 60 minuten; Player houdt 105 minuten en de
overige jobs 45 minuten. Alle cases, de enkele worker, individuele 60s-budgets,
asserties en artifactregistratie blijven gelijk. De afgebroken run telt niet
als PASS. De nieuwe PR334-head doorloopt alle toepasselijke CI opnieuw.

Referenties: PR333-run 42694386510/job 129422205855; vorige groene
PR332-run 42654264299/job 129288482433. Deze workflowcorrectie verandert
uitsluitend de joblimiet en is afzonderlijk gereviewd.

PR334 integreert ook de afzonderlijk gereviewde bron van PR333 via een gewone
dependencymerge. De volledige nieuwe bronboom gaat met normale CI naar main;
de afgebroken PR333-gate wordt daarmee niet als geslaagd aangemerkt.
