# S129 — bezoekerswelkomstscherm

## Architectuurbevinding

De bestaande `Programma`-mapper vulde `isHomeMatch` met een regex over
`eigenteam ?? teamvolgorde`. Daardoor maakte `eigenteam=JA` ook een
uitwedstrijd tot thuiswedstrijd. De officiële Club.Dataservice-lijst beschrijft
`teamvolgorde` bij Programma; `eigenteam` is geen gedocumenteerde thuis/uit-
discriminator. Zie [Club.Dataservice-artikelen](https://sportlink-assist.freshdesk.com/nl/support/solutions/articles/9000062942-lijst-met-artikelen-van-club-dataservice)
en [parameters](https://sportlink-assist.freshdesk.com/nl/support/solutions/articles/9000211117-lijst-met-parameters-in-club-dataservice).

De bestaande keten is hergebruikt:

```text
Club.Dataservice Programma
→ bestaande server-only Sportlink-worker
→ tenantgebonden sports_matches + private provider_asset_cache
→ immutable dynamic snapshot
→ gedeelde browser/thumbnailrenderer + LG Legacy-adapter
→ immutable releaseasset + Player Last Known Good
```

## Implementatiekeuzes

- Alleen een exact ondersteunde `teamvolgorde` (`thuis`, `home`, `t`, `1` of
  `thuisteam`) maakt een nieuwe providerregel thuis; ontbrekende of onbekende
  waarden falen gesloten.
- Detaildata mag tijden en ruimtes verrijken, maar overschrijft de vanuit
  Programma bewezen thuis/uit-status niet.
- De migratie herleidt bestaande rijen uitsluitend wanneer het huidige
  thuisteam-ID exact overeenkomt met een actief, clientgebonden team uit
  dezelfde tenant en Sportlinkverbinding.
- De snapshotbuilder controleert de actuele match opnieuw en bevriest
  `homeMatch: true`. Browser en LG weigeren oude of gemanipuleerde
  bezoekersitems zonder die markering.
- Een uitteamlogo wordt alleen vanuit een bestaande, private en SSRF-gevalideerde
  providerversie toegevoegd. De Player ontvangt alleen een immutable asset-ID,
  checksum en lokale/signed release-URL; nooit de provider-URL.
- Club.Dataservice garandeert niet voor iedere tegenstander een logo. Er wordt
  daarom geen scraping of Voetbal.nl-automatisering toegevoegd; zonder veilige
  providerversie blijft de nette nummerfallback bestaan.

## Raster en visueel contract

Landscape gebruikt 1×1, 2×1, 3×1 en 2×2 voor respectievelijk één tot vier
wedstrijden. Portrait gebruikt 1×1, 1×2, 1×3 en 2×2. Het logo staat in een
contrastvaste voorgrondplaat en als 150% vergrote uitsnede op exact 30% opacity
achter de inhoud. Reduced motion schakelt alleen introductiebeweging uit en
verandert de bedoelde logo-opacity niet.

De vier goedgekeurde visuele regressiebeelden staan naast
`tests/player/welcome-arrivals-motion.spec.ts` in de bijbehorende
`-snapshots`-map. De transparante schildfixture is testbewijs, geen merkasset.

## Database en security

Migratie `20260829125034_s129_home_match_welcome.sql`:

- corrigeert bestaande homeflags tenant- en connectiongebonden;
- wraps de canonieke snapshotfunctie met een fail-closed thuiswedstrijdfilter;
- voegt alleen bestaande private providerversies als logoasset toe;
- maakt uitsluitend voor geraakte latest-slides een nieuwe contenthash gereed;
- trekt directe uitvoerrechten op beide private functies expliciet in.

De pgTAP-regressie bewijst thuisselectie, uitsluiting van de uitwedstrijd,
expliciete marker, logoasset zonder provider-URL en niet-uitvoerbaarheid door een
authenticated rol.

## Verificatie

Volledig groen:

- integrations: 71 tests;
- content templates: 43 tests;
- media-worker: typecheck en 89 tests;
- Player unit: 167 tests;
- verse database-reset;
- volledige RLS: 63 bestanden en 1.343 assertions, inclusief S129 8/8;
- workspace lint/typecheck/test: 30/30 packages;
- productiebuild: 18/18 packages, inclusief webOS-compatibiliteitsguard;
- a11y: 36 groen, 1 bewuste live-fixture-skip;
- brede Chromiumrun: 178 groen, 20 bewuste live- of evidence-skips;
- Playerbrowser: 105/105;
- offline Player: 7/7;
- gedeelde browserrenderer: 4/4 inclusief vier landscape-goldens en portrait;
- LG Legacy-thuisfilter/logo: 1/1.

Hosted staging- en productionreadback worden na merge/deployment in de PR en
eindrapportage vastgelegd.
