# S112 Menu Studio v2 — implementatie- en acceptatiebewijs

## Release-identiteit

- Datum: 2026-08-21
- Branch: `veyocast/s112-menu-studio-v2`
- Basis: `origin/main` op `d1729b15665e5ca0ff442effd26c3c7ee4fd3b35`
- Reden basiskeuze: de remote bevat geen `staging`-branch; `main` is volgens de
  repositorycanon de staging-equivalente deploymentbasis.
- Featureactivatie: alle zes tenantflags default `false`; lokale browserfixtures
  gelden uitsluitend voor de lokale testtenant.
- Hosted release-SHA: de uiteindelijke mergecommit; de beveiligde workflow en
  het opleverbericht leggen die SHA en beide environmentdeployments vast.

## Geleverde keten

### Contract, commands en opslag

- Strict `MenuDocument.v2` met category-, group-, image-, video-, logo-, text-
  en promo-blocks, twee orientationlayouts, stabiele refs en immutable
  publication-/assetmetadata.
- Invariants voor unieke IDs/productrefs, veilige bodyzones, floating
  collisions, NFC-subregellabels, maximaal 24 grapheme clusters, begrensde
  tekstfit en exacte shared/from/separate-prijssemantiek inclusief btw-basis.
- Eén pure commandreducer voor click/tap, native browserdrag/drop en
  toetsenbord, met begrensde undo/redo-history.
- Tenantgebonden `SECURITY DEFINER`-RPC's met lege `search_path`, server-side
  capabilitychecks, expected revision, `operationId`-idempotency en append-only
  operations/audit.
- Mutable draft/save en expliciete immutable snapshotpublicatie; bestaande
  playlistrelease- en Playeractivatiegrenzen blijven intact.

### Renderer en Player

- Eén `MenuScene` voor Control-preview, browser-Player en primaire
  browserthumbnail; LG Legacy gebruikt dezelfde resolved data, metrics, themes
  en assetmanifesten via zijn webOS-veilige adapter.
- Exact 1920×1080 en 1080×1920, uniforme contain-scale en de bindende
  portraitzones.
- Deterministische semantische paginering plus echte DOM-meting na
  `document.fonts.ready`, fail-visible overflow en bevroren
  `contentFitVersion=dom-measured-2.0.0`.
- Exact tien manifestthema's in light/dark en beide oriëntaties.
- Video poster/autoplay muted/start/end/loop, reduced-motion en pause wanneer
  verborgen.
- Release-envelope bevat de immutable Menu Studio-assets; incomplete/corrupte
  bundles activeren niet en last-known-good blijft beschikbaar.
- Een tijdens de brede gate gereproduceerde watchdoglacune is gesloten: zodra
  fallback werkelijk speelt, meldt de Player de recovery direct via heartbeat
  en wist hij het rapport pas na de bevestigde recovery-heartbeat.

### Control en media

- Desktop triptych en mobiele sequentiële panelen; bibliotheek, outline,
  canvas, inspector, theme/mode/orientation/page/zoom en Nederlandse
  herstelmeldingen.
- Categorie-, product-, groep-, tekst-, promo-, vrije subregel-, image-, video-
  en logo-acties delen dezelfde commands voor drag, click/tap en toetsenbord.
- Minimaal 44 px touchdoelen; desktop en echte 390×844-touchcontext zijn met axe
  zonder critical/serious violations bewezen.
- JPEG/PNG/WebP/GIF/SVG en MP4/WebM worden op magic bytes/MIME/omvang/dimensie/
  duur gecontroleerd. SVG wordt structureel fail-closed gesanitized; raster en
  SVG krijgen content-addressed thumbnails; GIF/video normaliseren via de
  bestaande worker naar geverifieerde MP4+poster.

### Compatibiliteit en rollout

- Bestaande `price_list` blijft dual-read en wordt niet automatisch opgeslagen,
  gebackfilld of opnieuw gepubliceerd.
- Additieve migration met default-off flags, operationlog, validators/RPC's en
  rolling worker-overload; geen destructieve DDL of datamutatie.
- Rollout en rollback staan in
  `docs/runbooks/menu-studio-v2-rollout.md`; featureactivatie is geen onderdeel
  van staging/productiondeployment.

## Lokale gates

| Gate | Resultaat |
|---|---|
| `pnpm db:reset` | groen; volledige lokale database opnieuw opgebouwd |
| `pnpm test:rls` | groen; 50 bestanden, 991 assertions |
| `pnpm lint` | groen; 30/30 Turbo-taken |
| `pnpm typecheck` | groen; 30/30 Turbo-taken |
| `pnpm test` | groen; 30/30 Turbo-taken |
| `pnpm build` | groen; 18/18 Turbo-taken, Next.js productiebuilds en webOS-guard |
| Contracts | 44/44 groen, waarvan 15 Menu Studio-contracttests |
| Domain | 28/28 groen, waarvan 6 command/historytests |
| Content templates | 38/38 groen, waarvan 11 Menu Scene-tests |
| Control | 166/166 groen inclusief MIME/SVG/raster/thumbnailtests |
| Mediaworker | 84/84 groen inclusief GIF/WebM/poster en rolling RPC-contract |
| Player unit | 149/149 groen inclusief envelope, cache en LG adapter |
| Menu Scene browsermatrix | 40/40 theme×mode×orientation-goldens groen |
| Exact portrait/video | 20 echte DOM-productrijen, exacte zones, geen scroll; video poster/playback groen |
| Live Menu Studio | desktop DnD, productgroep, keyboard sort, save/publish, axe; echte touchcontext 390×844 en axe groen |
| `pnpm test:a11y -- --project=chromium` | 34 groen, 1 fixture-gated skip; één bestaande Twelve Products-navigatieflake geïsoleerd 1/1 groen |
| `pnpm test:e2e -- --project=chromium` | 144 groen, 9 bewuste skips; 10 Control-loadtime-outs na devserver-memoryrestart serieel 10/10 groen; watchdog na fix 1/1 groen |
| `pnpm test:player` | 89/90 groen inclusief volledige watchdogreeks en Menu Studio-matrix; bestaande LG-laagovergangsrace geïsoleerd 1/1 groen |
| `pnpm test:player:offline` | 7/7 groen |

De full-parallel a11y-run overschreed eenmaal de bestaande Twelve Products-
navigatietimeout; dezelfde ongewijzigde test was direct daarna geïsoleerd groen.
De live Menu Studio-test is in de algemene run bewust uitgeschakeld omdat hij
een expliciet gevlagde lokale Supabase-fixture vereist; met die fixture is hij
apart volledig groen.

De full-parallel E2E-run liet de Next-devserver expliciet wegens zijn
geheugendrempel herstarten. Tien Controlgevallen vielen tijdens die herstart op
navigatie/compilatie-time-outs en waren vervolgens samen met één worker 10/10
groen. De elfde uitvaller was de reproduceerbare recovery-heartbeat; na de fix
is dat geval geïsoleerd groen en ook groen binnen de volledige Player-
watchdogreeks. `pnpm test:player` had daarnaast één bekende LG-transitierace:
de twee crossfadelagen bestonden één assertie te lang; hetzelfde offline
last-known-good-geval was direct geïsoleerd groen en `test:player:offline` bleef
7/7 groen.

## Golden- en visueel bewijs

De 40 nieuwe goldens zijn intentioneel: Menu Studio introduceert een nieuw
versioned document en een nieuwe gedeelde scene; er bestonden geen v2-baselines
om te behouden. De matrix bevriest alle tien officiële themes in light/dark en
landscape/portrait, inclusief echte fontloading en DOM-overflowattributen.

- Desktop: `docs/screenshots/s112-menu-studio-desktop.png`
- Mobiel: `docs/screenshots/s112-menu-studio-mobile.png`
- Goldens: `tests/player/menu-studio-visual-matrix.spec.ts-snapshots/`

## Securitybewijs

- Tenant A kan tenant B-documenten, operations, producten en assets niet lezen,
  wijzigen of publiceren.
- Directe Data API-writes op operations zijn ingetrokken; menselijke writes
  lopen via capability-checked RPC's.
- Service-role blijft server/worker-only en komt niet in clientbundles; de
  productiebuildguard is groen.
- Storagepaden blijven tenant- en assetgebonden; alleen `ready`, checksum-
  geverifieerde varianten komen in een snapshot/release.
- Stale writes falen met `40001`; herhaalde operation-ID's zijn idempotent.
- Vrije subregels kunnen geen providerref, prijs of availability dragen en
  beïnvloeden geen groepsprijs.

## Bekende grenzen

- De repository heeft geen afzonderlijke antivirusscanner. S112 gebruikt de
  bestaande private media/quarantinearchitectuur en voegt fail-closed MIME,
  bytes, dimensions, duration, SVG en checksumvalidatie toe; een scanner is een
  platformbrede vervolgstap.
- De bestaande varianttaxonomie blijft `original|thumbnail|player_1080p`; de
  handoff-renditionnamen zijn niet naast het repositorymodel geïntroduceerd.
- Productfamilies gebruiken optionele stabiele `familyId` binnen de bestaande
  tenantproductcatalogus; er is geen tweede productmastertabel toegevoegd.
- Paginering is deterministisch en conservatief, waarna de echte DOM na
  fontloading als harde overflowcheck wordt gemeten. De serverlimieten en de
  40-cellenmatrix voorkomen onzichtbare crop; er is geen browser-afhankelijke
  repaginatielus die snapshots niet-deterministisch zou maken.
- Fysieke LG-hardwareacceptatie blijft `UNTESTED`; geautomatiseerde browser/LG-
  contracts, webOS-buildguard, incomplete-bundleweigering en offline
  last-known-good zijn wel releasegates.
