# S78 — Android-videohandoff

## Aanleiding

De algemene Android-app toonde tussen twee video-items kort Androids
grijs/zwarte standaard videoposter met een playicoon. De HTML-video had al
`controls={false}`, muted autoplay en CSS die WebKit-mediacontrols verbergt.
Het zichtbare tussenbeeld ontstond desondanks doordat de Player bij de
itemgrens de nieuwe videolaag direct boven de oude laag plaatste. Android kon
zijn nog niet gestarte native videoposter daardoor één of meer frames
compositen.

## Herstel

`PlaybackScene` gebruikt nu een readiness-gestuurde handoff:

1. het bestaande media-element blijft als uitgaande laag gemount en zichtbaar;
2. de volgende video laadt en start in een niet-zichtbare laag;
3. na `playing` wacht de Player nog twee browser-renderframes;
4. pas daarna wordt de nieuwe laag zichtbaar en start cut, crossfade of wipe;
5. de uitgaande laag wordt na de overgang verwijderd.

Als de volgende video niet kan starten, blijft het vorige frame dus zichtbaar
terwijl de bestaande watchdog de normale retry/fallback uitvoert. Een
playbackfout maakt de actieve release niet mutable en verwijdert geen
last-known-good content.

De Android-host vult bovendien `WebChromeClient.getDefaultVideoPoster()` met
een minimale effen zwarte bitmap. Daarmee bevat ook een eventuele native
fallbackposter geen Android-playicoon. De hosted Player blijft de enige
playbackengine.

## Geautomatiseerd bewijs

- Player ESLint: groen.
- Player TypeScript: groen.
- Gerichte Chromium Player-suite: 6/6 groen.
- Volledige Player-suite: 66/66 groen.
- Player-offlinesuite: 7/7 groen.
- Player-unit: 121/121 groen.
- Player-productiebuild en webOS-guard: groen.
- Workspace lint, typecheck en unit: 28/28 taken per gate groen.
- Toegankelijkheid: 31/32 in de parallelle run; de enige trage,
  ongerelateerde Control-viewporttest is aansluitend samen met beide
  Player-runtimechecks serieel 3/3 groen.
- Android `lint`, `test` en `assembleStagingDebug`: groen voor de algemene en
  TV-module in een schone Android SDK-container.
- De overgangstest bewijst expliciet dat:
  - de inkomende video vóór het eerste frame verborgen is;
  - de uitgaande video in die periode zichtbaar blijft;
  - de inkomende video pas na `playing` zichtbaar wordt;
  - de uitgaande laag daarna begrensd verdwijnt.
- De bestaande mediacontroltest bewijst `controls={false}`, muted playback,
  `disablePictureInPicture`, `preload="auto"` en niet-interactieve video.

## Open fysieke gate

Minimaal één fysieke loop met drie opeenvolgende MP4-items op de
doel-Android/WebView-versie blijft nodig. De acceptatie is: geen playicoon,
grijs vlak of zwart tussenframe op twee volledige playlistloops.
