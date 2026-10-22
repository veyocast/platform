# S285 — native referentie- en uitvoerbewijs

Bron `ae83f2b4312408eacae9f29177d3c743e104185b`, renderer
`sync-onzetrots-v1`. Alle 36 families × twee formaten × licht/donker komen
uit de echte `createSyncSlideCapture`; de oorspronkelijke app dient uitsluitend
als geverifieerde, lokale testreferentie.

| Uitvoer | Licht | Donker |
| --- | --- | --- |
| Worker liggend | [36 slides](worker-landscape-light.jpg) | [36 slides](worker-landscape-dark.jpg) |
| Bron liggend | [36 slides](reference-landscape-light.jpg) | [36 slides](reference-landscape-dark.jpg) |
| Worker staand | [36 slides](worker-portrait-light.jpg) | [36 slides](worker-portrait-dark.jpg) |
| Bron staand | [36 slides](reference-portrait-light.jpg) | [36 slides](reference-portrait-dark.jpg) |

Zes volledige vergelijkingsparen staan onder [native](native/). De
[matrix](native-matrix.json) bewaart native maten, identiteit, elapsedMs en
SHA-256 van alle 288 beelden. Ongemaskeerde pixeldifferenties zijn diagnostiek,
geen verruimde passdrempel. Verschillen tussen SVG-canvas- en CSS-transform-
rasterisatie blijven zichtbaar in de ruwe cijfers.

## Reproduceren

Gebruik de gepinde workspace, geïnstalleerde Playwright-Chromium en echte
FFmpeg/ffprobe. Kies nieuwe, eigen uitvoermappen:

```bash
pnpm exec tsx tests/helpers/sync-onzetrots-reference.mts /tmp/s285-reference
pnpm exec tsx tests/helpers/sync-onzetrots-matrix.mts /tmp/s285-worker /tmp/s285-reference
pnpm exec tsx tests/helpers/sync-onzetrots-special-cases.mts /tmp/s285-special-cases
```

De referentiehelper verifieert alle 259 SHA-256 bronbestanden, serveert alleen
die bestanden op een tijdelijke localhostpoort en sluit browser/server na de
144 screenshots. De brondatum staat vast op 22 oktober 2026, 12:00 UTC, zodat
ook relatieve demonstratiewedstrijden later reproduceerbaar blijven.
Beide paden gebruiken hetzelfde volledige Chromium-executable;
de standaard Headless Shell geeft andere font-hinting. Geen vervangen fonts,
CSS, geïnjecteerde prototypescripts of tweede productrenderer.

## Specifieke acceptatiebeelden

Deze extra native beelden komen eveneens rechtstreeks uit de actieve Worker,
met dezelfde gecontroleerde displayfixtures als de matrix. De
[manifestgegevens](special/special-cases.json) bewaren formaat, elapsedMs en SHA-256.
Overzichten: [liggend](special-landscape.jpg) en [staand](special-portrait.jpg).

| Geval | Werkelijke uitvoer |
| --- | --- |
| Blauwe eigen rij boven vast | [Eerste positie](special/standings-own-first-1200ms.png), [middenpositie na doorscrollen](special/standings-own-middle-20000ms.png) |
| Blauwe eigen rij onder vast | [Laatste positie tijdens de beginpauze](special/standings-own-last-1200ms.png) |
| Eigen rij op normale positie | [Middenpositie tijdens de beginpauze](special/standings-own-middle-1200ms.png) |
| Welkom, nul tot vier kaarten | [0](special/welcome-0.png), [1](special/welcome-1.png), [2](special/welcome-2.png), [3](special/welcome-3.png), [4](special/welcome-4.png) |
| Verjaardagen, vast raster | [2 gevuld](special/birthdays-2-portrait.png), [6 gevuld](special/birthdays-6-portrait.png) |
| Activiteiten, vast raster | [4 gevuld](special/activities-4-portrait.png), [6 gevuld](special/activities-6-portrait.png) |
| Agenda, vast raster | [0 gevuld](special/agenda-0-portrait.png), [6 gevuld](special/agenda-6-portrait.png) |
| Klok geheel boven score | [Native scorebord](native/worker-scoreboard-portrait-light.png) |
| Lange publieksvraag, 24 keuzes en QR | [Liggend](special/engage-long-landscape.png), [staand](special/engage-long-portrait.png); maximale testtekst, eerste van zes pagina's |

```bash
SITES_CAPTURE_TEST_CHROMIUM=$(node --input-type=module -e 'import {chromium} from "@playwright/test"; process.stdout.write(chromium.executablePath())')
pnpm exec tsx tests/helpers/sync-onzetrots-export.ts /tmp/s285-export "$SITES_CAPTURE_TEST_CHROMIUM"
S285_ONZETROTS_BINARIES=/tmp/s285-export pnpm exec playwright test tests/player/sync-onzetrots-export.spec.ts --project=chromium
```

De helper gebruikt de canonieke projector, verified geneste tenantafbeeldingen,
Chromium, de normale encoder en ffprobe. Alleen bronfeiten en signed-image-
transport zijn fixtures. Bestaande CI-voorbereiding maakt de volledige video
vóór de Player-cases; de test heeft geen skip of kunstmatige video.

## Motion en veiligheidsgrenzen

[Exportmetadata](motion/artifact.json) beschrijft de echte 38-secondenvideo.
Motionframes worden rechtstreeks uit dezelfde MP4 gedecodeerd. De browsertest
vergelijkt werkelijk gepresenteerde videoframes met DOM-geometrie op dezelfde
mediaTime en controleert vervolgens corrupte pending assets, koude offline-
start, oudere capability en EOF-herstart.

| 1,2 seconden | 9 seconden | 20 seconden | 37 seconden |
| --- | --- | --- | --- |
| [Native frame](motion/decoded-1200ms.png) | [Native frame](motion/decoded-9000ms.png) | [Native frame](motion/decoded-20000ms.png) | [Native frame](motion/decoded-37000ms.png) |

[Framechecksums](motion/frames.json) verwijzen naar exact dezelfde MP4-hash.

Pure/browser-/SQL-tests dekken thuisclub én teamidentiteit, filtering vóór vier
bezoekers, één gepinde eigen rij, nul/korte standen, pauze/hidden/reduced motion,
vaste slots 0–6 en vervolgpaging, fase/klok boven score, geneste assetgrenzen en
samengestelde tenant/team/poule/seizoencontext.

De [generatorreceipt](generation.json) bewaart de identieke outputhashes van
alle nieuwe generatoren. Historische SQL en legacyfixtures blijven de
originele referentie gebruiken.
