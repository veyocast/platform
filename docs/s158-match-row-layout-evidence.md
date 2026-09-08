# S158 — Kolomvaste wedstrijdregels en eenvoudige paletten

Status: `READY_FOR_RELEASE`

Deployment: `NOT_DEPLOYED`

Datum: 8 september 2026

Branch: `veyocast/s158-match-row-layout`

Baseline: `3b9bd9a06800e58e88ebd197d94828cf05d95277`

## Resultaat

- Programma toont de configureerbare primaire velden in vaste kolomtracks op
  regel één en scheidsrechter, veld en sportpark circa half zo groot en rechts
  uitgelijnd op regel twee.
- Uitslagen gebruiken vaste tracks voor datum, tijd, beide logo's, teams en
  score; een onbekende uitslag behoudt een lege scorekolom.
- Rijen behouden vaste hoogte en deterministische paginering. Alleen landscape
  kan twee kolommen gebruiken; portrait blijft één kolom.
- Wizard en versie-editor bieden ieder optioneel veld afzonderlijk aan.
- Pouleprogramma en pouleuitslagen voor vandaag zijn volwaardige varianten naast
  de bestaande zevendagenvarianten.
- Moderne Player en Static LG gebruiken dezelfde volgorde, zichtbaarheid,
  score-nullsemantiek, themevariabelen en paginering.
- Op liggende fullscreen-gradientnieuwsslides staat de zichtbare QR nu verder
  naar rechts en exact gelijk met het bronlogo, zonder de 7,5%-safegrens te
  overschrijden; portrait blijft ongewijzigd.

## Scope-, data- en releasegrens

- Clubbreed selecteert uitsluitend gekozen actieve teams van exact dezelfde
  tenant en Sportlink-connection, beoordeeld op hun echte thuis-/uitzijde.
- Poulebreed bevriest exact één combinatie van competitie, fase, poule, seizoen
  en bron en toont daarbinnen ook wedstrijden tussen twee andere clubs.
- Een ontbrekende of ambigue `auto_current`-context levert een lege state en
  verbreedt nooit naar de volledige bron.
- De snapshot bewaart het volledige dertienvelden-displaycontract. De oude
  logo- en kleedkamervlaggen blijven uitsluitend compatibiliteitsaliases.
- Bestaande snapshots, releases en Player-LKG blijven immutable. Alleen nieuwe
  opvolgsnapshots doorlopen de bestaande gecontroleerde releaseketen.
- Private helpers zijn niet uitvoerbaar voor Data API-rollen; de bestaande
  capability-, tenantstatus- en source-authority blijven leidend.

## Eenvoudige tenantpaletten

- Eén hoofdkleur of standaardpalet genereert deterministisch een volledige
  lichte en donkere FieldFlow-tokenkaart.
- Beide modi bevatten exact 26 semantische rollen; steunkleur en beide
  logoplaatkleuren worden mee afgeleid.
- Iedere rol blijft daarna afzonderlijk vindbaar, bewerkbaar, herstelbaar en
  direct zichtbaar in het 16:9-livevoorbeeld.
- Status-, QR- en foto-overlayrollen behouden hun semantiek. Opslag bevat alleen
  concrete hex- of rgba-waarden.
- Preview, opslaanknop en server hanteren dezelfde vijf contrastchecks per
  modus. Ongeldige kleuren tonen oorzaak, gevolg en herstel en blokkeren opslag.

## Verificatie

Groen op de finale werkboom:

- `pnpm lint`, `pnpm typecheck` en `pnpm test`: elk 30/30 taken;
- `pnpm build`: 18/18 taken;
- `pnpm db:reset`;
- gerichte S158-pgTAP: 22/22;
- volledige `pnpm test:rls`: 76 bestanden en 1.921 assertions;
- `supabase db lint --local --level error`: geen bevindingen;
- `pnpm test:a11y`: 36 groen en 1 bewuste live-skip;
- gerichte theme-route Chromium-E2E: groen;
- E2E-map effectief 40 groen en 13 bewuste lokale-live-skips. De brede
  seriële run gaf 36 groen plus vier `Target/Page crashed`-gevallen nadat één
  Chromium-proces langdurig alle applicaties had gedragen; exact die vier
  Marketing-scenario's slaagden daarna samen vers 4/4 op nieuwe poorten;
- betrokken Editorial Arena-outputmatrix met 18 vernieuwde programma-/
  uitslaggoldens en 2 fullscreen-nieuwsgoldens: groen;
- geometrieasserties bewijzen in moderne Player en Static LG dat bronlogo,
  QR-container en zichtbaar QR-beeld liggend op exact 92 px rechts uitlijnen;
- `pnpm test:player`: 124/124;
- `pnpm test:player:offline`: 7/7;
- formele security-diffscan: geen bevindingen;
- `git diff --check`, ownershipcontrole, lockfilecontrole en changed-file
  credentialscan: groen.

## Bekende grens en release

De wijziging introduceert geen nieuw providerdatamodel en reconstrueert geen
ontbrekende wedstrijdinformatie. Onbekende scores en details blijven bewust
leeg. Fysieke LG-acceptatie blijft een afzonderlijke hardwaregate; de
Chrome-79-veilige Static-LG-pariteit is geautomatiseerd bewezen.

PR/CI en de beschermde exact-SHA staging- en productionreadbacks volgen via de
bestaande immutable deploymentworkflow.
