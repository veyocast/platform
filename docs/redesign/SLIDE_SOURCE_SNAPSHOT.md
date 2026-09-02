# Source snapshot en auditprovenance

## Repository

- URL: `https://github.com/veyocast/platform`
- Branch tijdens audit: `main`
- Commit: `6fe477a332ab6565a6bb3205959ebfe7766e9a2c`
- Commitdatum: `2026-09-01T20:37:58+02:00`
- Commitonderwerp: `Merge pull request #162 from veyocast/veyocast/s143-ledscores-mobile-logo-picker`
- Tracked files: 2.095
- Worktree na audit: schoon

Dit pakket is normatief voor deze commit. Een uitvoerende Codex moet bij een nieuwere HEAD de inventaris opnieuw genereren en nieuwe typen/controls aan de coverage matrix toevoegen vóór implementatie.

## Repository-instructies en canons

Volledig gelezen/gecontroleerd als governancebron:

- `AGENTS.md`
- `README.md`
- `PLANS.md`
- `TASK_LEDGER.md`
- relevante documenten onder `docs/technical/`
- relevante design-, security- en offlinecanons onder `docs/`
- relevante sprint-/planbestanden voor themes, dynamic content, Sportlink, Studio, Engage, sponsor en LED Scores
- root `package.json` en workspace scripts

De uitvoerende agent moet deze bij zijn eigen HEAD opnieuw volledig lezen; dit bestand vervangt ze niet.

## Contract- en datamodellen

Primair gecontroleerd:

- `packages/contracts/src/dynamic-content.ts`
- `packages/contracts/src/theme-engine.ts`
- `packages/contracts/src/sportlink-slide-blueprints.ts`
- LED Scores scene/live contracts onder `packages/contracts/src/`
- Studio contracts/templates onder `packages/studio/src/`
- Supabase-migraties voor tenant theme settings, dynamic slide versions/snapshots, Sportlink, birthdays, Engage, sponsor en LED Scores

Belangrijkste harde aantallen uit de code:

- 17 sport dynamic slide types;
- 20 dynamic content types inclusief menu, price list en news;
- 21 dynamic template types inclusief `ledscores_live_match`;
- 15 actief allowlisted Editorial Arena-types;
- 5 dormant/typed sporttypes;
- 10 bestaande theme-ID’s;
- 4 nieuwsvarianten;
- 9 Sportlink-blueprints;
- 8 LED realtime momentkeys;
- 6 sponsorposities;
- 11 Studio-categorieën × 2 formaten = 22 systeemtemplates.

## Moderne dynamische renderer

Primair gecontroleerd:

- `packages/content-templates/src/dynamic-template-view.ts`
- `packages/content-templates/src/editorial-arena-renderer.tsx`
- `packages/content-templates/src/editorial-arena-renderer.module.css`
- `packages/content-templates/src/editorial-arena-layout.ts`
- `packages/content-templates/src/editorial-arena-theme.ts`
- `packages/content-templates/src/menu-scene.tsx`
- bijbehorende Menu Scene CSS
- theme catalog/manifest/motionbestanden in `packages/content-templates/src/`

Vastgesteld:

- page families: menu, news, price-list, menu-v2, match, standing, birthday, arrivals en sport-list;
- sportspecifieke branches voor activities, cancellations, dressing rooms, results en officials;
- overige sporttypes kunnen momenteel te generiek vallen;
- vaste logical canvases 1920×1080 en 1080×1920;
- huidige page-size/density kan tot twintig sportitems toestaan, wat botst met de leesbaarheidsdoelen;
- viewmodel heeft één generieke itemlogo-URL en geen expliciete duale home/away-logovelden;
- huidige QR-weergave is kleiner dan de beoogde afstandsleesbaarheid.

## Static LG Legacy

Primair gecontroleerd:

- `apps/player/app/_lib/lg-legacy-page.ts`
- bijbehorende Player tests voor LG Legacy, offline, recovery en rendering

Vastgesteld:

- dit is een afzonderlijke statische HTML/CSS/JS-implementatie en geen automatische output van de React-renderer;
- er bestaat een eigen allowlist van vijftien Editorial Arena-types;
- iedere FieldFlowwijziging vereist dus expliciete legacy-implementatie/paritybewijs;
- moderne CSS-features kunnen niet zonder Chromium 79-compatibiliteitscontrole worden gebruikt.

## Control, editors en wizards

Routes/components gecontroleerd voor:

- Slides en dynamic slide editor;
- Menu Studio en Menu Document v2;
- Sportlink bulk create en arrival/birthday flows;
- theme/display/review stappen en per-slide overrides;
- LED Scores live match, momentwizard en canvas;
- Engage;
- Sponsor Hub;
- YouTube;
- screen/player previews en thumbnails.

Vastgesteld configuratiegat:

- de Sportlink/dynamic draft kan `display`-instellingen bewaren terwijl de gecontroleerde snapshot-builder die niet volledig consumeert;
- arrivalvelden voor clublogo/sponsor en sponsorasset zijn niet volledig door iedere schakel verbonden;
- daarom is een veld-voor-veld config-to-render trace een P0-gate.

## Snapshot, assets en publicatie

Gecontroleerd:

- immutable dynamic slide version/snapshotmigraties;
- snapshotbuilder/RPC-projectie voor sport/news/menu;
- assetcollection voor brandlogo, menuassets, nieuws hero/provider/QR, sport logo/photo en birthday background;
- release/player LKG- en offlinepaden.

Vastgesteld:

- theme selection zit in immutable versies/snapshots;
- historische theme-ID’s mogen niet simpel worden verwijderd;
- nieuwe assetvelden zoals home/away-logo en arrival sponsor moeten ook in assetcollection en fallback worden opgenomen;
- previews en Player mogen niet van live providerdata of remote assets afhangen nadat een snapshot is gepubliceerd.

## Aanvullende surfaces

Gecontroleerd:

- Studio-systeemtemplates en motionpresets;
- Engage Player rendering en lokale fallback;
- YouTube online binding en fallback;
- sponsoroverlayposities en Proof of Play-context;
- LED live match, timeline, scene layer/bindings en acht momentkeys;
- Player pairing, setup, waiting, offline/LKG, recovery en accountstatussen;
- raw image/video playback en watermarkbeleid.

## Bestaande testdekking

De bestaande suites bevatten onder meer:

- Editorial Arena visual matrix met news, price, program, results en standings in modes/orientations/densities;
- Menu Studio visual matrix over tien themes, twee modes en twee orientations;
- birthday visual fixtures;
- arrival fixtures voor 1–4 kaarten, met een portrait-gat dat expliciet moet worden gesloten;
- Engage/YouTube playbacktests;
- LED goal/live tests;
- uitgebreide LG Legacy-, pairing-, recovery- en offlinetests.

FieldFlow vervangt de brede tien-theme-matrix door een diepere één-theme-matrix: alle families, beide modes/orientations, density, long strings, assets en edge states.

## Aangeleverde visuele referenties

Onder `references/`:

- `fieldflow-direction.png`: primaire stijlrichtiging voor oppervlakken, typografie, field contours en productcoherentie;
- `current-landscape-results.png`: recente landscape-resultaatstatus;
- `current-landscape-news.png`: recente landscape-nieuwsstatus;
- `current-portrait-results.png`: recente portrait-resultaatstatus;
- `earlier-portrait-news.jpg`, `earlier-portrait-standing.jpg`, `earlier-portrait-results.jpg`: probleemvoorbeelden voor leegte, row density, te kleine tekst en portraitcompositie;
- `prior-fieldflow-prompt-input.md`: eerder promptconcept als input, niet normatief.

Correcties op het eerdere promptconcept:

- geen tien publiek selecteerbare themes behouden; slechts één zichtbaar FieldFlow-thema;
- geen decoratief hard blauw dat met groen botst;
- geen nieuwe flip/bounce/overshootmotion;
- geen ongemotiveerde grote radii zonder canon delta;
- expliciete dekking van LG Legacy, system surfaces, Studio, Engage, sponsors, live overlays en config-to-render traces;
- historische immutable releases blijven compatibel.
