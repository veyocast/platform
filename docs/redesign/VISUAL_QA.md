# FieldFlow visual QA

## S145 v1.6-status

De eerdere S144-platformcaptures zijn visueel afgewezen en door S145 vervangen;
ze gelden niet als goedgekeurde goldens. De vijf laatst
aangeleverde gebruikersreferenties zijn leidend voor de zichtbare uitvoering
van Overzicht, Planning, Schermen, Studio en Marketing. Security/RLS, locked
assets, toegankelijkheid, immutable releases en Player/offlinegedrag blijven
de hogere technische grenzen. De drie bronbestanden staan bytegelijk onder
`docs/screenshots/fieldflow/negative-baseline/`; de vereiste actuele matrix
staat in `VISUAL_QA.csv`. Nieuwe captures starten zonder automatische
goedkeuring. De gebruiker heeft de negen actuele bladen op 4 september 2026 als
“Perfect” geaccepteerd; hun status is nu `ACCEPTED_BY_USER_2026-09-04`.
Fysieke LG blijft `EXTERNAL_UNTESTED`; uitsluitend de S145-releasegate is
`WAIVED_BY_USER_2026-09-04`, zonder toestelbewijs.

Op 4 september 2026 is na de laatste codewijziging de volledige capturematrix
opnieuw uitgevoerd: één Playwrighttest was in 4,2 minuten groen en maakte 73/73 current
beelden. Dit zijn 71 primaire state-/routecaptures plus twee gerichte
opstellingsdetailcaptures. Samen met vijf targetbestanden, drie negatieve
baselines en negen contact sheets bevat het bewijs 90 PNG-bestanden. Alle 76
datarijen — drie negatieve baselines en 73 current captures — staan in
`VISUAL_QA.csv`.

De vier matrixbladen en vijf exacte side-by-sidebladen met hun hashes staan in
`GOLDEN_INDEX.md`. De technische gate controleert contracten, runtimefouten,
overflow, shellopbouw en controlhoogtes; zij voert geen automatische
pixelvergelijking met de targets uit. De acceptatiestatus is daarom niet door
Codex afgeleid, maar registreert de expliciete gebruikersbeslissing.

De twee witte herochips en de groene afspeelbalk liggen aantoonbaar boven de
gemaskeerde heroafbeelding. De desktopopstelling reserveert minimaal 32 px
tussen plattegrond en zonecopy; de twee extra detailcaptures bewijzen desktop-
en mobiele compositie. De robuuste marketingimage-wrapper houdt een niet
geladen of falend beeld visueel onzichtbaar tot een echte afbeelding gereed is,
zodat native broken-imageglyphs geen resterende bekende beperking zijn.
In de synthetische totale-foutstate verdwijnen daardoor ook de image-based
header- en footer-lock-ups. Dat voorkomt een defect browserartefact, maar biedt
geen nagemaakte tekst-/vectorfallback: op expliciete instructie blijft het
huidige officiële VeyoCast-icon leidend. Het schoon verdwijnen van de
image-based lock-ups bij totale image-failure blijft een bekende, door de
gebruiker geaccepteerde P2-grens.
De ingeklapte desktopzijbalk heeft bovendien een expliciete regressiecheck:
navigatie- en tenantcopy zijn verborgen en de tenantmarkering mag de 72px-rail
niet overschrijden. Deze gate ving tijdens de finale audit een cascadefout en
is na herstel opnieuw groen vastgelegd.

## Regels

- Bewijs gebruikt echte of expliciet generieke data; geen fictief klantbewijs.
- Viewports: 320, 390, 430, 768, 1024, 1280, 1440, 1600, 1920 en 2048 px.
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
| Fysieke LG 43UL3J-EP | geen aangesloten hardware; alleen S145-releasewaiver | EXTERNAL_UNTESTED / WAIVED_BY_USER_2026-09-04 |
| Android telefoon/tablet/TV | geen ADB/hardware op deze host | EXTERNAL_UNTESTED |
| Slide coverage | 64 functionele coveragerijen plus 64 moderne, 44 Menu Studio- en 16 Static-LG-goldens | VERIFIED_LOCAL |

## Evidence-index

Deze tabel wordt per slice aangevuld; `COMPLETE` vereist een gekoppeld bestand
of reproduceerbare testnaam.

| Slice | Viewports/modes | States | Evidence | Status |
|---|---|---|---|---|
| Foundation en shells | 320–1920 px; light/dark/reduced motion | nav/focus/disabled | 36 a11y-checks + brede Chromium-suite; routeledger | VERIFIED_LOCAL |
| Marketing en auth | 320–1920 px; light/dark | form/empty/error/success | a11y- en Chromium-suites; 23 assetderivatives | VERIFIED_LOCAL |
| Tenant en platform | desktop/mobile route- en actionstate-ledgers | bestaande regressiestates | Control-unitchecks, a11y- en Chromium-suites | VERIFIED_LOCAL |
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

## Exacte referenties en bekende visuele grenzen

De vier Control-currentcaptures zijn 1920×945. De full-page
Marketing-currentcapture is 1905×5961. De vijf exacte vergelijkingsbladen zetten
ieder target en current naast elkaar, maar kennen geen automatische
pixelacceptatie toe.

De gebruiker heeft de ontbrekende assetidentiteiten expliciet opgelost: het
huidige officiële locked VeyoCast-icon blijft behouden en FF-PHOTO-01, -06,
-05 en -04 zijn geaccepteerd voor respectievelijk hero, team-/clubmoment,
tactiek-/vrijwilligersblok en onderste CTA. De ronde target-lock-up en exacte
fotobronnen blijven alleen historische provenance-gaps; zij blokkeren de
S145-visual sign-off niet meer. Officiële semantische tokens blijven leidend
waar een targetkleur daarvan afwijkt. Studio toont eerlijk `Genereren`, omdat
die actie een render maakt en nog geen immutable publicatie uitvoert.

Vijf gewijzigde historische PNG's zijn expliciet door de gebruiker geaccepteerd
voor opname als `ACCEPTED_FOR_INCLUSION_BY_USER_2026-09-04`. Zij tellen niet
mee in de 90-bestanden-S145-evidenceset en krijgen geen nieuwe provenanceclaim.

## Externe visuele acceptatie

- Fysieke LG 43UL3J-EP: `EXTERNAL_UNTESTED`; er is geen toestel gekoppeld aan
  deze host. Uitsluitend de S145-releasegate is door de gebruiker geaccepteerd
  als `WAIVED_BY_USER_2026-09-04`; dit is geen fysieke testclaim. De
  Static-LG-bronvalidatie, 14 wrappertests, Chrome-79-suite en lokale
  IPK-build/inspectie zijn groen. De smoketest-IPK heeft SHA-256
  `634500c35699524e90d7de87cd82655b49360154a1e02ada37659d00660c763b`.
- Fysieke Android telefoon/tablet/TV: `EXTERNAL_UNTESTED`; er is geen ADB of
  hardware en de host mist Java/JAVA_HOME. De Expo-export, XML-parse,
  shellsyntax en browsergebaseerde Android-vormfactorchecks zijn lokaal groen.
