# S161 — Royal Current / Navy Glass v8 implementatierapport

Status op 10 september 2026: **lokale integratie- en releasegates groen;
beschermde CI en deployment volgen**.

## Bron en nulmeting

- Branch: `veyocast/s161-royal-current`.
- Implementatiebaseline: `e11140c99dffdc6a2f3272ae8af4439446c91538`
  (S160 bovenop `origin/main` `5bd5fdd`).
- Normatieve visuele bron: prototype v8,
  `f0e001f1f9af25d62e475226707863fd44a3795d`.
- Overdracht: `VeyoCast-Royal-Current-Overdracht-v1.zip`, packageversie 1.0,
  aangemaakt 9 september 2026.
- Historische productie-audit:
  `6fe477a332ab6565a6bb3205959ebfe7766e9a2c`, 1 september 2026; alleen
  minimuminventaris, niet als actuele HEAD gebruikt.

Uitgevoerd vanuit de volledig uitgepakte overdracht:

```text
python3 gereedschap/verify-package.py
PASS: 161 bestanden met SHA256; 64 surfaces; 101 eisen; 50 configuratietraces;
92 referentiecases; 973 lokale HTML/CSS-links. Geen browser-/productievalidatie
geclaimd.
```

De 92 referentiecases zijn expliciet als volgt verdeeld. Iedere `default` telt
Royal/Glass × landscape/portrait = vier cases.

| `slide_id` | Varianten | Cases |
|---|---|---:|
| `sport_results` | `default` | 4 |
| `sport_program` | `default` | 4 |
| `sport_standing` | `default` | 4 |
| `news` | `hero_split`, `fullscreen_gradient`, `news_grid`, `text_only` | 16 |
| `price_list` | `default` | 4 |
| `menu` | `default` | 4 |
| `sport_match_of_the_day` | `default` | 4 |
| `sport_next_match` | `default` | 4 |
| `sport_visitor_arrivals` | `1`, `2`, `3` | 12 |
| `sport_referee_arrivals` | `default` | 4 |
| `sport_dressing_rooms` | `default` | 4 |
| `sport_officials` | `default` | 4 |
| `sport_cancellations` | `default` | 4 |
| `sport_activities` | `default` | 4 |
| `sport_birthdays` | `default` | 4 |
| `ledscores_live_match` | `default` | 4 |
| `engage_poll` | `default` | 4 |
| `led_goal_own` | `default` | 4 |
| **Totaal** |  | **92** |

`SURFACE-COVERAGE.csv` bevat daarnaast alle productieoppervlakken zonder apart
goedgekeurd pixelvoorbeeld. Deze krijgen geen fictieve pixelmatchstatus.

## Gedeeld presentatiecontract

`packages/contracts/src/theme-engine.ts` voegt appearance v2 toe zonder v1 te
verwijderen. Nieuwe snapshots dragen:

```text
snapshotVersion: 2
appearance.schemaVersion: 2
appearance.designRevision: royal-current-v8
appearance.palette: { version, primary, background, secondary }
appearance.motionEnabled
appearance.typography
```

`packages/content-templates/src/royal-current-theme.ts` is de ene pure
palettegenerator voor Control, gedeelde renderer en Static LG-projectie. De
generator normaliseert 3/6-HEX, leidt Royal Current/Navy Glass af en materialiseert
alle 21 v8-CSS-rollen en de 26 semantische kleurrollen. `dynamic-template-view.ts` accepteert de v8-route alleen
wanneer de snapshot expliciet frozen v2 is; stale `editorial.theme` kan die
authority niet overschrijven. V1-snapshots blijven hun opgeslagen tokenmap
gebruiken.

## Renderer- en outputroutes

| Uitvoer | Implementatiepad | Authority |
|---|---|---|
| Modern dynamisch | `packages/content-templates/src/editorial-arena-renderer.tsx` + module-CSS | gedeelde `DynamicTemplateView` |
| Modern Menu | `packages/content-templates/src/menu-scene.tsx` | bevroren document/snapshot |
| Control preview | `apps/control/app/(shell)/dashboard/slides/new/dynamic-slide-live-preview.tsx` | dezelfde payload/viewmodel |
| Workerthumbnail | `apps/media-worker/src/dynamic-react-thumbnail.ts` en `dynamic-render-backend.ts` | snapshot + collected assets |
| Posterfallback | media-worker SVG/resvg en immutable PNG | dezelfde snapshotrevision |
| Static LG | `apps/player/app/_lib/lg-legacy-page.ts` | v1/v2 compatibiliteitsresolver, Chrome-79-veilige waarden |
| Engage/live/LED | `apps/player/app/_components/engage-playback-media.tsx` en LED-componenten | frozen presentatie + live bindings |
| Player-systeemstates | Player runtime/recovery/PWA-componenten + globale systeemtokens | product-owned systeemtheme |
| Studio | `packages/studio/src/templates.ts` en media-worker Studio-renderers | versieerbare curated templates; vrije designs intact |

De moderne v8-renderroute bevat de vaste landscape-/portraitshell, QR-only
nieuws, compacte afgelaststatus, fixed 1/2/3-welkomstslots, pinned standrij,
agenda-afbeeldingen en vaste pagina-/rijhoogtes. De Static-LG-route gebruikt
vooraf berekende kleuren en vermijdt de vereiste van moderne CSS-syntax.

## Control en configuratie

De tenanttheme-editor reduceert de primaire taak tot zes presets of custom HEX,
achtergrond `club|neutral`, optioneel tweede accent, motion en toegestane
typografie/schaal. Light en dark staan tegelijk in preview; alle 26 semantische
rollen per modus zijn zichtbaar, individueel aanpasbaar en worden direct in
dezelfde preview geprojecteerd. Een ongeldige draft overschrijft de laatst
geldige uitvoer niet. `themes/fieldflow/actions.ts` valideert server-side de
gegenereerde appearance/palette, rolkleuren en contrasten.

Nieuwe slide, nieuwe versie, Menu Studio, Sportlink bulk, verjaardagen, Engage,
LED Scores, sponsor en Studio tonen of gebruiken de centrale tenantstijl zonder
een tweede per-slide kleurengine te introduceren. Bestaande bronfilters,
poule/fase/team/thuis-uit, displayflags, assetkeuzes en usermedia blijven in hun
bestaande configuratiecontract. De volledige veldtrace staat in
`CONFIG-TRACE.csv`.

De Sportlink bulk-wizard en versie-editor projecteren programma- en
uitslagdrafts bovendien in één gedeelde responsieve rijpreview. Datum, tijd,
beide logo's, beide kleedkamers, scheidsrechter, veld, sportpark en één/twee
kolommen volgen rechtstreeks dezelfde genormaliseerde `display`-configuratie.
De preview gebruikt uitsluitend veldlabels en verzint geen providerwedstrijd,
score of locatie.

## Database en immutable compatibiliteit

Forward-only migratie
`supabase/migrations/20260909174500_s161_royal_current_theme.sql`:

1. valideert appearance v1 en v2 strict;
2. maakt alleen toekomstige ontbrekende tenantprofielen standaard v2;
3. bewaart de vorige snapshotbuilder onder
   `private.build_dynamic_snapshot_data_before_s161_royal_current`;
4. omhult de actuele builder en projecteert een geldig v2-profiel in nieuw
   gebouwde dynamische snapshots over alle families;
5. biedt de database-owner de begrensde operatie
   `private.reset_tenant_fieldflow_royal_v2(text,text,text,text)`, die exact één
   tenant op het v8-profiel zet, alleen immutable opvolgers bouwt en auditactie
   `tenant.theme.royal_current_reset` schrijft;
6. revoket Data-API-uitvoering voor builders, reset en validatorhelpers.

Er is geen update/backfill van historische snapshots of releases. Een bestaand
v1-profiel blijft v1 tot een expliciete edit. Player en worker blijven daardoor
oude content decodeerbaar houden, terwijl nieuwe immutable snapshots exact hun
resolved mode, timezone, settingsrevision en appearance dragen.

Rollback is forward-only: laat actieve LKG staan, stop nieuwe rollout en voeg
zo nodig een opvolgmigratie toe die de wrapper terug laat delegeren naar de
bewaarde builder. Verwijder geen v2-data en rol applicatiecode niet terug naar
een versie zonder v2-decoder.

## Legacy- en LKG-invarianten

- Appearance v1 en alle historische renderbare theme-ID's blijven geldig voor
  opgeslagen snapshots; alleen authoring van nieuwe/muteerbare content is
  `fieldflow`.
- Static LG blijft een zelfstandige inline renderer. Royal Current wordt daar
  uitsluitend geactiveerd bij een valide frozen v2-payload; legacy payloads
  nemen niet ongemerkt de nieuwe CSS over.
- `READY`, `PLAYING`, `DOWNLOADING`, `VERIFYING`, `SWITCH_PENDING`,
  `OFFLINE_PLAYING`, `ERROR_RECOVERABLE` en `DISABLED` behouden hun bestaande
  betekenis. Themawijziging verandert geen pairing-, heartbeat-, cache- of
  release-state-machine.
- Online synchronisatie blokkeert een geldige lokale release niet. Een pending
  release wordt pas actief nadat alle vereiste bytes op grootte/hash zijn
  geverifieerd en wisselt alleen op de bestaande grens.
- Bij ontbrekende/ongeldige dynamische runtimepayload blijft de
  checksum-geverifieerde PNG van dezelfde snapshot de fallback. Bij tijdelijk
  netwerkverlies blijft de actieve LKG zichtbaar met hooguit de bestaande
  compacte offline-indicatie; geen Royal Current-systeemscherm mag die content
  volledig vervangen.
- Usermedia, sponsorcreatives en vrije Studio-ontwerpen blijven byte-eigendom
  van hun bestaande revision. De nieuwe stijl mag alleen hun omliggende
  product-owned status- of previewlaag beïnvloeden.

## Assets en licenties

Roboto 2.137 is lokaal opgenomen met Apache-2.0-licentie en notice:

| Gewicht | SHA-256 |
|---:|---|
| 400 | `48c3fa6f86c54f1d9bb519220713d4b0a1f8cd1a589a3c03b9fa82e98ecb13e3` |
| 500 | `24369e1b2461af9dcefecaf9cc93d64cf22a4c5bac32506100b9e21014507bcf` |
| 700 | `b4d07892cde715d50bb69c1982df496385d1dfd8f9d1867c31f19a3c8634cfae` |
| 900 (ook deterministische 800-resolutie) | `edcdf3f60252a5987bedc9c86b5422d972ba509bbbe60d58925310c744a33e28` |

Licentiehash:
`cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`;
noticehash:
`27a92a636b29310f20334936e777ab85620e354b062fd9b8f366707b1b1e22ca`.
Locked VeyoCast-assets worden niet gereconstrueerd. Automatische
logo-transparantie en een remote QR-generator zijn niet toegevoegd.

## Teststatus

Reeds tijdens de werkende integratie uitgevoerd:

| Gate | Uitkomst |
|---|---|
| Overdrachtverifier | PASS, exacte aantallen hierboven |
| Workspace lint/typecheck/test | elk groen: 30/30 workspaces |
| Content templates unit | groen: 13 bestanden / 109 tests, inclusief 44 palettevectors, volledige kleuraliasprojectie, wedstrijd-uitlijnregressies en sponsor-paginering |
| Control unit | groen: 71 bestanden / 391 tests; gedeelde Sportlink-rijpreview 3/3 en tenantaanmaakfeedback |
| Control lint/typecheck | groen op de actuele geïntegreerde diff |
| Workspace build | groen: 18/18 workspaces, inclusief Control-, Player-, Media Worker-, Marketing- en Android-export |
| Verse `pnpm db:reset` | groen met de finale S161-migratie |
| S161-pgTAP | groen: 1 bestand / 62 tests |
| Volledige RLS-suite | groen: 78 bestanden / 2.009 tests |
| Lokale DB-lint | groen op errorniveau: `results: []` |
| Bronreferentie-browsergate | groen: `tests/player/royal-current-handover-reference.spec.ts`, 92/92 in 1,2 minuut met unieke IDs, doelcanvas, Roboto, assets, primary, motion-off, geen controls/overflow en niet-lege capture |
| Productie-implementation coverage | groen: 92/92 in 176,54 seconden; 80 via `/thumbnail` + `EditorialArenaRenderer`, 12 via de normale Player-runtime; expliciet geen pixelmatch/ref-new-diff |
| Moderne visualspec | groen: 4/4 tests met een 64/64 gereviewde en vernieuwde goldenmatrix voor 16 varianten × light/dark × landscape/portrait |
| Wedstrijduitlijning | groen: browserasserties voor vaste rijhoogte, veldvolgorde, onafhankelijke optionele velden en lege onbekende score; twee gereviewde liggende twee-kolomsgoldens |
| Sponsor spotlight | groen: 4/4 light/dark × landscape/portrait met één creative per pagina, containment, scheiding en minimaal 4,5:1 tekstcontrast |
| Control Sportlink-preview | groen: 3/3 componenttests; dezelfde draft/displayconfig en geen fictieve providerdata |
| Control a11y | groen: 36 Chromium-checks; één expliciete live-afhankelijkheid overgeslagen |
| Player browser suite | groen: 128 tests; twee expliciete handover/coverage-tests zijn bewust overgeslagen |
| Player offline suite | groen: 7/7 Chromium-tests; LKG, corrupte pending-assets, range-service-worker en offline-start blijven gedekt |

Nog niet als geslaagd claimen:

- brede Control Chromium buiten de a11y- en gerichte previewgates;
- resterende modern/LG/preview/posterpariteit en prototype-ref/new/diff-
  pixelreview; de 92/92 implementation coverage is nadrukkelijk geen pixelmatch;
- aanvullende goldens buiten de groene moderne 64/64-, twee-koloms- en
  sponsor-spotlightmatrix;
- fysieke LG, CI, exacte staging-/production-SHA en deployreadback.

De CSV-matrices gebruiken daarom `IMPLEMENTED_TEST_PENDING`, `PARTIAL_PENDING`
of `PRESERVED_REVERIFY` en geen ongefundeerde `DONE`-status.

## Bekende grenzen bij deze bewijsversie

- De packageverifier valideert hashes, matrices, referentie-links en bronchecks;
  hij is geen browser-, QR-, device- of productieacceptatie.
- De 92 meegeleverde referenties zijn HTML, geen vooraf goedgekeurde screenshots.
  Hun bronrenderbaarheid én de afzonderlijke productie-implementation coverage
  zijn ieder 92/92 getest; dat is nog geen pixelvergelijking tussen beide.
- Een fysieke LG-acceptatie en 4K/kijkafstandcontrole zijn externe hardwaregates.
- Deployment en de hosted Auth-redirectallowlist horen bij de finale
  operationele release. De allowlist is externe omgevingsconfiguratie en is in
  dit document niet als lokaal uitgevoerd gemarkeerd.

## Finale releasevelden

Deze waarden blijven bewust invulbaar tot de root-run ze feitelijk oplevert:

| Onderdeel | Feitelijke status |
|---|---|
| Finale S161-commit | `PENDING` |
| PR/CI | `PENDING` |
| Staging exact-SHA + healthreadback | `PENDING` |
| Production exact-SHA + healthreadback | `PENDING` |
| Hosted tenant/theme readback | `PENDING` |
| Hosted Auth-redirectallowlist | `EXTERNAL_CONFIG_PENDING` |
| Fysieke LG | `EXTERNAL_UNTESTED` |

## Bewijsindex

- [`SURFACE-COVERAGE.csv`](SURFACE-COVERAGE.csv)
- [`CONFIG-TRACE.csv`](CONFIG-TRACE.csv)
- [`EISEN.csv`](EISEN.csv)
- [`S161 sprintcontract`](../../../prompts/sprints/S161-royal-current-v8.md)
