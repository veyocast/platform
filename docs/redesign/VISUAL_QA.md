# FieldFlow visual QA

## Regels

- Bewijs gebruikt echte of expliciet generieke data; geen fictief klantbewijs.
- Viewports: 320, 390, 430, 768, 1024, 1280, 1440, 1600 en 1920 px.
- Light, dark, high contrast, reduced motion, 200% zoom en mobile large text
  worden per relevante surface gecontroleerd.
- Minimaal states: filled, first-empty, no-results, loading, slow, partial,
  stale, offline, retryable/fatal error, permission denied, disabled, read-only,
  processing, success, conflict, archived en destructive.
- Slidegoldens gebruiken 1920×1080 en 1080×1920. Geconfigureerde perceptuele
  afwijking is maximaal 0,15%; logo-, QR-, crop- en safe-area-regio's hebben
  nultolerantie.
- Console errors, hydrationwarnings, horizontale overflow, focusverlies,
  afgekapt Nederlands en status die alleen kleur gebruikt zijn failures.

## Nulmeting

| Surface | Baseline | Status |
|---|---|---|
| Control shell en routes | bestaande a11y- en brede Chromiumset; Atelier/Vector | BASELINED |
| Marketing | bestaande route- en homepagechecks | BASELINED |
| Control Mobile | Expo build en componenttests | BASELINED |
| Moderne Player | 116 browserchecks inclusief output en recovery | BASELINED |
| Static LG | legacy, probe en html-debug browserchecks | BASELINED_EMULATED |
| Fysieke LG 43UL3J-EP | geen aangesloten hardware | EXTERNAL_UNTESTED |
| Android telefoon/tablet/TV | geen ADB/hardware op deze host | EXTERNAL_UNTESTED |
| Slide coverage | 64 functionele coveragerijen plus 64 moderne, 44 Menu Studio- en 16 Static-LG-goldens | VERIFIED_LOCAL |

## Evidence-index

Deze tabel wordt per slice aangevuld; `COMPLETE` vereist een gekoppeld bestand
of reproduceerbare testnaam.

| Slice | Viewports/modes | States | Evidence | Status |
|---|---|---|---|---|
| Foundation en shells | 320–1920 px; light/dark/reduced motion | nav/focus/disabled | 36 a11y-checks + brede Chromium-suite; routeledger | VERIFIED_LOCAL |
| Marketing en auth | 320–1920 px; light/dark | form/empty/error/success | a11y- en Chromium-suites; 23 assetderivatives | VERIFIED_LOCAL |
| Tenant en platform | desktop/mobile route- en actionstate-ledgers | bestaande regressiestates | Control 304 unitchecks, a11y- en Chromium-suites | VERIFIED_LOCAL |
| Mobile en devicechrome | Expo Android-export plus browserhost | offline/recovery/permission | Expo build, Player 117, offline 7; Gradle/hardware extern | VERIFIED_LOCAL_PARTIAL_EXTERNAL |
| Slides modern | 1920×1080 en 1080×1920; light/dark | 16 representatieve varianten × 4 | 64 goldens in `editorial-arena-visual-matrix` | REVIEWED |
| Menu Studio modern | beide canvases; light/dark | 11 interne theme-ID's | 44 goldens; 40 legacy stabiel, 4 FieldFlow nieuw | REVIEWED |
| Slides static LG | beide canvases; light/dark | nieuwe team/sponsor/training/vrijwilligersfamilies | 16 Chrome-79 goldens plus bestaande LG-regressies | REVIEWED_EMULATED |
| Preview/poster/fallback | beide logical canvases | invalid/unsupported/offline | Player release-envelope-, 117 Player- en 7 offline-checks | VERIFIED_LOCAL |

Zie `GOLDEN_INDEX.md` voor het reviewoverzicht en reproduceerbare paden. De
64-rijige functionele slidecoverage wordt apart machineleesbaar bewaakt via
`SLIDE_COVERAGE.csv`, `CONFIG_TO_RENDER_TRACE.csv` en
`fieldflow-coverage.test.ts`; 64 visuele cellen zijn niet hetzelfde als 64
functionele coveragerijen.

## Externe visuele acceptatie

- Fysieke LG 43UL3J-EP: `EXTERNAL_UNTESTED`; er is geen toestel gekoppeld aan
  deze host. De Static-LG-bronvalidatie, 14 wrappertests, Chrome-79-suite en
  reproduceerbare IPK-build zijn lokaal groen.
- Fysieke Android telefoon/tablet/TV: `EXTERNAL_UNTESTED`; er is geen ADB of
  hardware en de host mist Java/JAVA_HOME. De Expo-export, XML-parse,
  shellsyntax en browsergebaseerde Android-vormfactorchecks zijn lokaal groen.
