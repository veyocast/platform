# VeyoCast Studio — release-evidence S40

Datum: 24 juli 2026  
Status: reviewgereed; niet gedeployd

## Implementatie

### Product en routes

- `/dashboard/studio`: tenantgescheiden overzicht, filters, renderstatus,
  archief/herstel en toegang tot huisstijlbeheer.
- `/dashboard/studio/new`: landscape/portrait, stilstaand/motion en
  system-/tenanttemplatekeuze.
- `/dashboard/studio/[designId]`: desktopcanvas met lagen, transforms,
  snapping, undo/redo, motiontijdlijn, preview, revisies en renderaanvraag.
- Dezelfde editorroute wordt op mobiel een sequentiële quick-editflow voor
  naam, achtergrond, tekst, beeldslots, preview en renderstatus.

### Belangrijkste componenten

- `@veyocast/studio`: versioned documentmodel, 22 systemtemplates,
  deterministische geometrie, tekstlayout, motion, brandkit en rendercontract.
- React Konva is uitsluitend de interactieve Control-adapter; opgeslagen data
  bevat geen library-JSON.
- IndexedDB bewaart per tenant/project een lokale herstelkopie. Server-autosave
  gebruikt revision guards; een conflict overschrijft nooit stilzwijgend.
- Iedere tiende save maakt een checkpoint. Render en restore maken altijd een
  immutable revisie.

### Database, Storage, rechten en audit

- Nieuwe tenanttabellen: `studio_projects`, `studio_project_drafts`,
  `studio_revisions`, `studio_revision_assets`, `studio_render_jobs`,
  `studio_exports`, `studio_command_receipts` en
  `studio_tenant_brand_kits`.
- Alle tenanttabellen gebruiken `tenant_id NOT NULL`, tenant-aware foreign
  keys, indexen en `FORCE ROW LEVEL SECURITY`.
- Human commands zijn guarded RPC's met capability-, tenantstatus-,
  idempotency- en revisioncontrole. Queueclaim/completion zijn alleen voor
  `service_role`.
- Custom rollen ondersteunen afzonderlijke create/edit-own/edit-all,
  template-, motion-, render-, archive- en brandkitbevoegdheden.
- Audit bevat actie, actor, tenant, project/job/media-ID en uitkomst; nooit
  documentinhoud, signed URL, cookie of token.
- Bron- en outputobjecten blijven private onder
  `tenants/{tenant_id}/assets/{asset_id}/...`.

### Renderarchitectuur en Publisher-integratie

1. Control bevriest de gevalideerde draft als immutable bronrevisie en
   reserveert idempotent een renderjob en media-ID.
2. De media-worker claimt met `SKIP LOCKED`, resolveert alleen ready assets uit
   dezelfde tenant en rendert zonder remote HTML, JavaScript, SVG of fonts.
3. PNG wordt exact sRGB 1920×1080 of 1080×1920. MP4 wordt H.264 Main, 30 fps,
   yuv420p, faststart, één videostream en nul audio.
4. Completion valideert object, checksum, dimensies en codec en maakt
   transactioneel een normaal `ready` media-item plus varianten en audit.
5. `Openen in Media` en `Openen in Publisher` gebruiken de bestaande flows.
   Playlistreleases en Player kennen geen Studio-document of render-runtime.

## Verificatie

| Controle | Exact commando | Resultaat |
|---|---|---|
| Schone migraties | `pnpm db:reset` | groen; alle migraties en seed toegepast |
| Tenantisolatie | `pnpm test:rls` | 32 bestanden, 625 assertions, PASS |
| Lint | `pnpm lint` | 22/22 Turbotaken groen |
| Typecheck | `pnpm typecheck` | 22/22 Turbotaken groen |
| Packages | `pnpm exec turbo test --concurrency=2` | 22/22 taken groen; 14 packages |
| Productiebuild | `pnpm exec turbo build --concurrency=2` | 14/14 taken groen |
| Studio-browser | `PLAYWRIGHT_CONTROL_ONLY=1 pnpm exec playwright test tests/e2e/studio.spec.ts tests/a11y/studio.spec.ts --project=chromium` | 4/4 groen |
| Brede Control-matrix | `PLAYWRIGHT_CONTROL_ONLY=1 pnpm exec playwright test tests/a11y/control-shell.spec.ts tests/a11y/screens-mobile.spec.ts tests/a11y/studio.spec.ts tests/e2e/control-shell.spec.ts tests/e2e/studio.spec.ts --project=chromium --workers=1` | 30/31 direct groen; één bestaande theme-test time-out |
| Theme-herhaling | hetzelfde bestand met `--grep "persists theme and density preferences" --retries=1` | 1/1 groen zonder retry |
| Workerimage | `docker build --target media-worker -f infra/production/Dockerfile -t veyocast-studio-worker-smoke:local .` | groen, frozen lockfile |
| Landscape codec | productionimage, `STUDIO_SMOKE_DURATION_SECONDS=5` | 1920×1080, 150 frames, 7,473 s |
| Portrait codec | productionimage, duur 5 en `STUDIO_SMOKE_FORMAT=portrait-hd` | 1080×1920, 150 frames, 7,711 s |
| Diffhygiëne | `git diff --check` | groen |

De codecsmokes valideren H.264, 30 fps, yuv420p, faststart, exacte duur en
nul audio. Unit- en workerintegratietests bewijzen daarnaast bytegelijke SVG/
PNG, text wrapping, motion, queueback-off, cancellation, leaseverlies,
idempotency, canonical storagepaden en outputafwijzing.

### Screenshots

- `docs/screenshots/s40-studio-overview-desktop.png` — 1440×960.
- `docs/screenshots/s40-studio-editor-desktop.png` — 1440×960.
- `docs/screenshots/s40-studio-editor-mobile.png` — 390×844.

Alle drie zijn visueel gecontroleerd. Overzicht en desktopeditor blijven binnen
de viewport; mobiel toont bewust geen mini-desktopcanvas en gebruikt minimaal
44px hoge interactieve quick-editcontrols.

## Commits

De branch bestaat uit kleine, toetsbare eenheden:

1. `b72f491`–`1351938`: integratiegrenzen, schema, motion, geometrie,
   groepen, boundarytests en gelockte fonts.
2. `39a912a`–`802d026`: operations/security, tokens, Publisherthumbnailfix,
   textlayout, privacy, dependencies, worker en codecsmoke.
3. `d4ab89b`–`cf0ca5a`: database/RLS, capabilities/navigatie,
   IndexedDB-herstel en heldere Publisher/Studio-naamgeving.
4. `1f45712`–`2ac895c`: revisies, brandkits, renderdocumentatie,
   deterministische huisstijl en tenantservices.
5. `7646c16`–`f4598d3`: editor-state, overzicht/aanmaak, responsive canvas,
   motioneditor en parameteriseerbare codecsmoke.
6. `a476133`–`008d970`: toegankelijke quick edit, revisie-UX,
   desktop/mobile browserbewijs en de expliciete Publisher-vervolgactie.

Gebruik `git log --reverse --oneline origin/main..veyocast/s40-studio` voor de
volledige commitlijst en exacte volgorde.

## Operationeel

### Configuratie en runtime

- Er zijn geen nieuwe publieke environmentvariabelen of secrets toegevoegd.
- Worker gebruikt de bestaande `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, worker-ID, pollinterval en timeoutconfiguratie.
- Runtime vereist de productionimage met lokaal gebundelde Inter-fonts,
  Resvg/Sharp, FFmpeg en ffprobe.
- Eén workerproces verwerkt maximaal één Studiorender tegelijk. De databaselease
  maakt horizontaal schalen met unieke worker-ID's veilig.
- Composegrens: 1,5 vCPU, 1536 MiB, PID 256, read-only root en tijdelijk volume.
  De encoder-time-out is 55 seconden; maximaal 30 seconden, 30 fps en 200 lagen.

### Monitoring en rollback

- Structurele events: queuepoll, completion, retry/failure, cancellation en
  leaseverlies; payloads zijn geredigeerd.
- Kalibreer alerts voor oudste queued job, p95, retryratio, validatorfouten,
  readiness, RSS en `/tmp` voordat productievolume wordt toegelaten.
- Runtime rollback is veilig: een oude worker negeert Studiojobs, die queued
  blijven; Media, Publisher en Player blijven functioneren.
- Databasewijzigingen zijn additief en worden vooruit gerold. Muteren of
  verwijderen van reeds gepubliceerde output is geen herstelstrategie.

## Eindbeslislog

### 1. Workerprofiel, capaciteit en quota — vervolgactie vóór brede productie

- **Probleem:** normale medianormalisatie en Studio delen nu 1,5 vCPU/1536 MiB.
- **Voorlopige default:** één Studiorender per worker, maximaal 30 seconden,
  200 lagen en drie pogingen.
- **Omkeerbaar:** queuecontract en leases zijn onafhankelijk van containeraantal.
- **Alternatief A:** bestaand profiel horizontaal schalen met unieke worker-ID's.
- **Alternatief B:** een afzonderlijk Studio-workerprofiel met eigen CPU/RAM.
- **Kosten/licentie:** geen nieuwe softwarelicentie; wel VPS/containercapaciteit.
- **Data/migratie:** geen datamigratie; alleen deployment- en quotaconfiguratie.
- **Performance:** A deelt piekbelasting, B is beter voorspelbaar.
- **Security:** beide behouden service-role en dezelfde tenantvalidatie; B
  verkleint de operationele blast radius.
- **Aanbeveling:** na stagingbenchmarks een afzonderlijk Studio-profiel kiezen
  zodra p95 of normale media-SLO onder gedeelde belasting verslechtert.
- **Beslissing Danny:** budget en toegestane renderwachttijd vaststellen.

### 2. Production-SLO en documentcomplexiteit — vervolgactie vóór claims

- **Probleem:** vijf seconden eenvoudige landscape/portraitoutput is bewezen,
  maar 10/15/30 seconden en 25/100/200-laags documenten nog niet.
- **Voorlopige default:** 55 seconden harde timeout, geen commerciële SLO.
- **Omkeerbaar:** documentlimieten en workerresources zijn begrensde config/code.
- **Alternatief A:** huidige limieten handhaven en complexe jobs vooraf weigeren.
- **Alternatief B:** meer resources en een hogere timeout per Studio-profiel.
- **Kosten/licentie:** A minimaal; B meer compute en mogelijk lagere throughput.
- **Data/migratie:** geen; bestaande immutable jobs blijven reproduceerbaar.
- **Performance:** A voorspelbaarder, B accepteert rijkere ontwerpen.
- **Security:** een harde resourcegrens blijft in beide gevallen vereist tegen
  tenantgedreven resource-uitputting.
- **Aanbeveling:** benchmarkmatrix uitvoeren en daarna per duur/lagenprofiel een
  expliciete toelatingsmatrix publiceren.
- **Beslissing Danny:** gewenste maximale ontwerpcomplexiteit en wachttijd.

### 3. Gegenereerde media vervangen of versioneren — toekomstige optimalisatie

- **Probleem:** iedere export maakt veilig een nieuw media-item; veel iteraties
  kunnen de bibliotheek vullen.
- **Voorlopige default:** altijd nieuw item, nooit een asset in een immutable
  release muteren.
- **Omkeerbaar:** later kan een expliciete lineage/replacementlaag boven
  media-assets worden toegevoegd.
- **Alternatief A:** blijvend alleen nieuwe assets maken.
- **Alternatief B:** nieuwe assetversie met opt-in vervanging in alleen drafts.
- **Kosten/licentie:** A meer opslag; B extra product-, migratie- en UX-werk.
- **Data/migratie:** B vereist lineage en verwijzingsmigratie voor drafts, nooit
  voor bestaande releases.
- **Performance:** A eenvoudig; B kan bibliotheekruis verminderen.
- **Security:** B vraagt dezelfde tenant-, capability- en concurrencyguards.
- **Aanbeveling:** V1 bij A houden; pas B ontwerpen op basis van echt gebruik.
- **Beslissing Danny:** nu geen besluit nodig; evalueren na pilottelemetrie.

## Resterende risico's

| Risico | Ernst | Bewijs | Mitigatie | Eigenaar/vervolg |
|---|---|---|---|---|
| Geen echte stagingtransactie van Studio naar Media/Publisher | hoog voor deploy, niet voor merge review | lokale DB/workerintegratie groen, remote niet aangeraakt | exacte image deployen; PNG/MP4/cancel/retry runbook uitvoeren | Platform operations |
| Geen complexe 10/15/30-sec benchmark | middel | alleen 5-sec beide oriëntaties | matrix uit operations uitvoeren, quota/SLO vastleggen | Product + operations |
| Geen fysieke clientmatrix | middel | servercodec bewezen, decoder/cache niet | Android, Google TV en LG-modellen testen | QA/hardware |
| Gedeelde workerresource | middel | één container verwerkt media en Studio | monitoren, benchmarken, zo nodig splitsen | Operations |
| Bestaande theme-E2E was eenmaal traag | laag | 30/31 direct; geïsoleerd 1/1 groen | CI-retry/compilewarmte monitoren; geen Studiofail | Frontend |

Studio is daarmee code-, security-, build- en lokaal rendergereed voor review.
Staging- en hardwaregates blijven bewust zichtbaar; er is niets gepusht of
gedeployd.
