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
```

De referentiehelper verifieert alle 259 SHA-256 bronbestanden, serveert alleen
die bestanden op een tijdelijke localhostpoort en sluit browser/server na de
144 screenshots. De brondatum staat vast op 22 oktober 2026, 12:00 UTC, zodat
ook relatieve demonstratiewedstrijden later reproduceerbaar blijven.
Beide paden gebruiken hetzelfde volledige Chromium-executable;
de standaard Headless Shell geeft andere font-hinting. Geen vervangen fonts,
CSS, geïnjecteerde prototypescripts of tweede productrenderer.

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
