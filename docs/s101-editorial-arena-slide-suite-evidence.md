# S101 — Editorial Arena slidesuite v2

## Uitkomst

De bestaande dynamische slideketen heeft nu één v2-rendercontract voor
prijslijst, nieuws, stand, programma en uitslagen. Het vaste canvas, de
semantische tokenmaps, paginatie en het viewmodel worden gedeeld door Control-
preview en de gewone Player. De conservatieve LG Legacy-runtime consumeert
dezelfde immutable snapshotvelden en behoudt zijn lokale releasegedrag.

## Hoofdonderdelen

- `@veyocast/contracts`: Zod-contracten voor schema v2, light/dark en alle 26
  semantische kleurtokens, vier nieuwsvarianten en twee prijsfotomodi.
- `@veyocast/content-templates`: centrale defaults, cascade, contrastfunctie,
  vaste canvas-/framemetrics, prijsfit, sportkolommen, rijhoogte en paginatie.
- Control Slides: stap **Kleuren & uitstraling**, snelle thema-instellingen,
  een geavanceerde editor voor alle 26 tokens, reset/kopieeracties, een
  gelijktijdige landscape-/portraitpreview en dezelfde server-side
  kleur-/contrastgate voor light en dark.
- Prijsauthoring: toegankelijke drag-and-drop binnen en tussen kolommen,
  toetsenbord- en pijlalternatieven, categoriegebonden foto-overrides en
  productfocal-points. Nieuws heeft een eigen focal-pointauthoring.
- Player: één vaste browserrenderer voor de vijf families en een bijgewerkte
  lokale LG Legacy-uitvoer zonder providernetwerkpad.
- Supabase: migratie `20260813102834_editorial_arena_slide_suite_v2.sql` bevriest
  volledig opgeloste themawaarden in snapshots en verrijkt legacy snapshots
  niet-destructief. Bestaande immutable releases worden niet gewijzigd.
- Supabase: `20260813111541_editorial_arena_authoring_completion.sql` resolveert
  de handmatig gekozen product-ID's opnieuw binnen tenant en bron en bevriest
  exact die geordende set; vreemde, dubbele of niet-beschikbare referenties
  worden geweigerd.
- Thumbnail: de worker probeert eerst een Chromiumcapture van `/thumbnail`,
  waarin letterlijk `EditorialArenaRenderer` met dezelfde snapshot, tokens,
  fonts en opgeloste assets draait. Payloaddata staat alleen in het URL-fragment
  en bereikt geen serverlog. De bestaande immutable SVG→PNG-render blijft de
  automatische fallback wanneer browsercapture of assets tijdelijk falen.

## Providerstatus

De bestaande genormaliseerde RSS- en Sportlink-snapshots zijn in lokale
fixtures en databasefuncties geverifieerd. De Player vraagt geen provider op.
Twelve blijft de bestaande Excel/importpipeline; deze uitvoering bewijst geen
nieuwe live Twelve-API-koppeling. Ontbrekende afbeeldingen houden een ontworpen
lege ruimte en worden niet door een VeyoCast-placeholder vervangen.

## Renderer en overflow

- Landscape: 1920×1080; portrait: 1080×1920; uitsluitend uniforme contain-fit.
- Prijscapaciteit komt uit één metricsfunctie; een categorie kost één rij en
  foto aan/uit verandert de capaciteit niet.
- Sport: 10 regels landschap = één kolom, 11–20 = twee gelijke kolommen;
  portrait blijft één kolom; 21 regels levert een tweede pagina.
- De browserrenderer bevat geen letterlijke kleurwaarden. CSS gebruikt alleen
  `var(--vc-*)`; defaults staan in één tokenmodule.

## Security, migratie en rollback

De snapshotwrapper draait in `private`, met expliciete lege `search_path` en
zonder execute-rechten voor `public`, `anon` of `authenticated`. RLS-tests
bewijzen volledige tokenmaps in tenantgebonden snapshots. Rollback betekent de
nieuwe wrapperfunctie/migratie terugdraaien; reeds gemaakte schema-v2-snapshots
blijven zelfstandig leesbaar en bestaande releases zijn niet gemuteerd.

## Verificatie

- `pnpm lint`: 30/30 taken groen.
- `pnpm typecheck`: 30/30 taken groen.
- `pnpm test`: 30/30 taken groen; onder meer contracts 29/29, Control 142/142,
  Player 145/145 en content-templates 8/8.
- `pnpm build`: 18/18 taken groen; alleen reeds bestaande autoprefixerwarnings
  in `screen-automation.module.css`.
- `pnpm db:reset`: groen.
- `pnpm test:rls`: 45 bestanden, 910 assertions groen, waaronder gerichte
  immutable volgorde/focal-point- en cross-tenantreferentietests.
- `supabase db lint --local`: geen melding voor de nieuwe snapshotfunctie; de
  repository houdt vijf reeds bestaande lintissues in oudere functies.
- volledige Editorial Arena pixelmatrix: 48/48 groen als twaalf families ×
  twee oriëntaties × twee thema's, inclusief vaste-canvas-, overflow-,
  footer- en assetready-asserties. Baselines staan naast de Playwrighttest.
- `pnpm test:player --project=chromium --workers=1`: 81/81 groen; de
  matrix bevat 48 afzonderlijke `test.step`-cellen en 48 pixelasserties.
- `pnpm test:player:offline -- --project=chromium`: 7/7 groen.
- `pnpm test:e2e --project=chromium --workers=1`: 145 groen en 8 bewuste skips,
  inclusief de volledige accessibilitymatrix 35/35.
- `check-migration-safety.mjs` en `validate-vps-deployment.sh`: groen.
- productie-mediaworkerimage gebouwd als
  `veyocast-media-worker:s101-local`; de container start Chromium
  `151.0.7922.108` via het geconfigureerde `/usr/bin/chromium`.
- de container heeft daarna via `ReactDomDynamicThumbnailRenderer` de lokale
  `/thumbnail`-route gecaptured; resultaat was een geldige PNG van 58.764 bytes.

Visueel gecontroleerde bewijsbeelden:

- `docs/screenshots/s91-editorial-arena-news-landscape.png`;
- `docs/screenshots/s91-editorial-arena-news-portrait.png`;
- `docs/screenshots/s91-editorial-arena-standing-landscape.png`;
- `docs/screenshots/s91-editorial-arena-standing-portrait.png`.

## Externe validatiestatus

De publieke staging-Control en -Player antwoorden op 13 augustus 2026 gezond
op release `3405395`; manifest en serviceworker antwoorden eveneens met 200.
Die hosted release bevat deze lokale wijzigingen nog niet en `/thumbnail`
antwoordt daar daarom terecht met 404. De workflow accepteert uitsluitend een
actuele `main`-SHA, zodat hosted validatie van deze wijziging pas na integratie
en merge kan plaatsvinden.

Er is in deze uitvoeromgeving geen fysiek LG-scherm, model-/firmware-identiteit,
operator of Device Lab-campagnetoken aanwezig. Conform het fysieke protocol
blijft hardwareacceptatie daarom `UNTESTED`; desktop-Chromium en de LG
Legacy-tests worden niet als fysiek bewijs gepresenteerd.
