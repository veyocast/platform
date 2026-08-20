# Theme-engine v2 — implementatie- en acceptatiecanon

## Catalogus en bronnen

De selecteerbare catalogus bestaat exact uit `editorial`, `obsidian`,
`atelier`, `velocity`, `heritage`, `halo`, `swiss`, `pavilion`, `tactical` en
`terrace`. De Theme Lab-zip is alleen als visuele bron gebruikt. De productiebron
is het gevalideerde manifest in de content-package; `fonts/fonts.lock.json`
legt de exacte lokale WOFF2-bytes, herkomst, OFL-licentie en SHA-256 vast.

De bestaande VeyoCast-lock-up is niet uit de labdemo overgenomen of
gereconstrueerd. Normale playback behoudt de locked merkasset en de bestaande
watermarkgrens.

## Resolutievolgorde

Veilige bestaande slide-instanceoverride → broncategorieoverride →
tenantstandaard → platformstandaard → veilige `editorial`-fallback. Iedere
snapshot bevat zowel de gekozen ref/policy als de bevroren mode. Een onbekende
ID, semver, token-, decoratie- of fontreferentie faalt manifestvalidatie.

## Render- en contentfitcontract

- vaste logische canvassen: 1920×1080 en 1080×1920;
- uniforme contain-fit, geen scrollbare slide en geen runtime-crop;
- menu/prijslijst gebruikt exact twee kolommen en de centrale 9/17-rijpagineerder;
- categorie plus product kosten ieder een rij; een vervolgpagina herhaalt de
  categoriekop;
- ontbrekende productmedia houdt een leeg slot zonder logo/icoon/initialen;
- stand: landschap 1–10 één kolom en 11–20 twee kolommen; portrait 1–20 één;
  meer dan 20 wordt gepagineerd;
- standkolommen: positie, badge/team, GS, W, G, V, DV, DT, +/−, laatste vijf,
  PT en zone. De eigen club krijgt accent plus tekst en wijzigt geen geometrie.

Alle capability-backed productiefamilies uit
`editorialArenaActiveSlideTypes` gaan door dezelfde renderer. Match of the day
is aan die gate toegevoegd. Poll/CTA is alleen fixturedata en wordt nergens als
live providerfunctie aangeboden.

## Twelve-editor

Een categorie-identiteit bestaat uit tenant (servercontext), databron/
providerconnection en source-category-ID. Het zichtbare label is een override
van maximaal 28 tekens en verandert de identiteit niet. Plaatsing bewaart
expliciete kolom en volgorde. De RPC voor tenantcategorie-overrides gebruikt
expected revision; stale writes geven `conflict` zonder mutatie. De prijslijst
blijft doorzoekbaar, toetsenbordbedienbaar en exact tweekoloms. Boven 200
producten wordt de kandidaat vóór selectie geweigerd; grotere geldige sets
pagineren zonder stille truncatie.

## Motion en performance

De enige transition keys zijn instant-cut (0 ms), arena-dissolve (420 ms),
editorial-shift (520 ms, maximaal 2,5% translate) en panel-reveal (560 ms).
De state machine is `IDLE → ENTERING → ACTIVE → EXITING`; ACTIVE-dwell begint
pas na enter-complete. Posterframes zijn deterministisch op 900 ms. Reduced
motion gebruikt maximaal 120 ms of een cut. De implementatie gebruikt geen
`Date.now()`, `Math.random()`, animated blur/filter/layout/shadow of
ongecontroleerde motionlagen. De regressietest doorloopt 1.000 cycli.

Begrotingen per slide: maximaal circa 800 DOM-nodes, 12 bewegende elementen en
2 compositinglagen. Het actuele gedeelde DOM blijft daar ruim onder; de fysieke
LG-run legt FPS, dropped frames, geheugen en temperatuur vast.

## Visuele matrix

`themeVisualMatrix` is het machineleesbare raster: alle tien thema’s × light/
dark × landscape/portrait × alle 18 getypeerde slidefamilies plus één expliciet
fixture-only poll/CTA-cel (760 cellen). De zes nog niet live capability-backed
sportfamilies en poll/CTA zijn als fixture-only gemarkeerd en worden niet als
providerfunctie aangeboden. Referentie: gepinde Chromium/Linux,
deviceScaleFactor 1, na `document.fonts.ready`. Tolerantie: maximaal 0,15%
perceptueel verschil en kanaaldelta 12. Clipping, kritieke tekst, prijzen,
scores, tabelkolommen en QR quiet zone hebben nultolerantie. Tests mogen
goldens niet automatisch accepteren.

## Bronstatus en externe gates

Twelve gebruikt de bestaande Excel/importpipeline. Sportlink en RSS gebruiken
uitsluitend bestaande genormaliseerde snapshots. Er is geen nieuwe of
gesimuleerde providerclaim. Fysiek LG-webOS en provider-sandboxacceptatie zijn
`UNTESTED` totdat de vereiste hardware/credentials beschikbaar zijn.
